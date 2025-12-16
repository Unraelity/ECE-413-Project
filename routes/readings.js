// routes/readings.js
// Handles:
//  - POST /readings         (webhook from Particle -> store reading in MongoDB)
//  - GET  /readings?day=...  (fetch readings for a given day for logged-in user)
//  - GET  /readings/weekly-summary (7-day HR summary for logged-in user)

const express = require('express');
const router = express.Router();

const auth = require("../middleware/auth");     // JWT auth middleware (expects x-auth, sets req.user)
const Device = require("../models/device");     // Device model (maps Particle deviceId -> internal _id)
const Reading = require("../models/reading");   // Reading model (ts, hr, spo2)

// Luxon for consistent timezone handling / day boundaries
const { DateTime } = require("luxon");

// App timezone (important for "day" calculations)
const ZONE = "America/Phoenix";

// Shared secret for webhook authentication (Particle -> your server)
const INTEGRATION_SECRET = process.env.INTEGRATION_SECRET || "dev-secret";

// ==========================================================
// POST /readings
// Webhook endpoint: accepts readings published from Particle
//
// Expected request headers:
//  - x-integration-key: must match INTEGRATION_SECRET
//
// Expected body shape (based on your webhook):
//  {
//    deviceId: "<particle_device_id>",     (topDeviceId)
//    reading: "{\"hr\":78,\"spo2\":97}",   (stringified JSON payload)
//    ts: <optional timestamp>              (either seconds since epoch or date string)
//  }
// ==========================================================
router.post("/", async (req, res) => {
  // Verify webhook secret to prevent random people from inserting data
  const secret = req.get("x-integration-key");
  if (secret !== INTEGRATION_SECRET) {
    return res.status(401).json({ error: "Bad integration key" });
  }

  // Pull top-level fields from body
  const { deviceId: topDeviceId, reading, ts: topTs } = req.body || {};

  // Validate required fields
  if (!topDeviceId || typeof reading !== "string") {
    return res.status(400).json({ error: "Missing deviceId/reading" });
  }

  // Normalize variables
  let deviceId = topDeviceId;
  let hr;
  let spo2;

  // Parse the "reading" string into an object like { hr: ..., spo2: ... }
  try {
    const payload = JSON.parse(reading);
    if (payload && typeof payload === "object") {
      // Convert to numbers (could become NaN if payload values are not numeric)
      hr = Number(payload.hr);
      spo2 = Number(payload.spo2);
    }
  } catch (e) {
    // reading wasn't valid JSON
    return res.status(400).json({ error: "Payload is not an object" });
  }

  // Redundant check (deviceId already validated above) but harmless
  if (!deviceId) return res.status(400).json({ error: "Missing deviceId" });

  // Validate numbers
  if (!Number.isFinite(hr)) {
    return res.status(400).json({ error: "Invalid hr" });
  }
  if (!Number.isFinite(spo2)) {
    return res.status(400).json({ error: "Invalid spo2" });
  }

  // Guard against obviously bad readings (both 0)
  if ((Number(hr) === 0) && (Number(spo2) === 0)) {
    return res.status(400).json({ error: "Invalid reading (hr/spo2 both 0)" });
  }

  // Map the Particle deviceId to your internal Device document
  const dev = await Device.findOne({ particleId: deviceId }).select("_id");
  if (!dev) return res.status(404).json({ error: "Device not registered" });

  // Build a timestamp for the reading
  // - default: now
  // - if ts provided:
  //    * if numeric => assume seconds since epoch, convert to ms
  //    * else => try Date(ts)
  let stamp = new Date();
  const ts = topTs;
  if (ts) {
    const n = Number(ts);
    stamp = Number.isFinite(n) ? new Date(n * 1000) : new Date(ts);
  }

  // Reject invalid timestamps
  if (isNaN(stamp.getTime())) return res.status(400).json({ error: "Invalid ts" });

  // Create reading document in MongoDB
  const doc = await Reading.create({ deviceId: dev._id, ts: stamp, hr, spo2 });

  // Return created reading id
  return res.status(201).json({ _id: doc._id });
});

// ==========================================================
// GET /readings?day=YYYY-MM-DD
// Returns all readings for the logged-in user for that local day (America/Phoenix).
// Requires x-auth header (JWT).
// ==========================================================
router.get("/", auth, async (req, res) => {
  // Day string from query parameters
  const dayStr = String(req.query.day || "");

  // Parse "YYYY-MM-DD" in the specified timezone and compute day window
  const start = DateTime.fromISO(dayStr, { zone: ZONE }).startOf("day");
  if (!start.isValid) return res.status(400).json({ error: "Invalid day" });

  // End of that day window (exclusive)
  const end = start.plus({ days: 1 });

  // Find the current user by email from JWT payload
  const me = await require("../models/customer").findOne({ email: req.user.email });

  // Find all devices owned by that user
  const devs = await Device.find({ ownerId: me._id }).select("_id");
  const ids = devs.map(d => d._id);

  // Fetch readings for those devices within [start, end)
  // Sort oldest -> newest for charting
  const docs = await Reading.find({
    deviceId: { $in: ids },
    ts: { $gte: start.toJSDate(), $lt: end.toJSDate() }
  })
    .sort({ ts: 1 })
    .select("ts hr spo2"); // only send needed fields

  res.json(docs);
});

// ==========================================================
// GET /readings/weekly-summary
// Returns aggregated HR stats for the last 7 local days (America/Phoenix):
//  - avg HR
//  - min HR
//  - max HR
// Requires x-auth header (JWT).
// ==========================================================
router.get("/weekly-summary", auth, async (req, res) => {
  // Find current user
  const me = await require("../models/customer").findOne({ email: req.user.email });

  // Get their device ids
  const devs = await Device.find({ ownerId: me._id }).select("_id");
  const ids = devs.map(d => d._id);

  // Compute the start date-time for the 7-day window (today minus 6 days, at local midnight)
  const start = DateTime.now()
    .setZone(ZONE)
    .startOf("day")
    .minus({ days: 6 })
    .toJSDate();

  // Mongo aggregation:
  // 1) match readings in the last 7 days for this user's devices
  // 2) group by local day string (YYYY-MM-DD) using timezone
  // 3) compute avg/min/max for HR
  // 4) project into a cleaner shape for the frontend
  // 5) sort by date ascending
  const agg = await Reading.aggregate([
    { $match: { deviceId: { $in: ids }, ts: { $gte: start } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$ts", timezone: ZONE } },
        avg: { $avg: "$hr" },
        min: { $min: "$hr" },
        max: { $max: "$hr" }
      }
    },
    { $project: { _id: 0, date: "$_id", avg: 1, min: 1, max: 1 } },
    { $sort: { date: 1 } }
  ]);

  res.json(agg);
});

module.exports = router;