const express = require('express');
const router = express.Router();
const auth = require("../middleware/auth");
const Device = require("../models/device");
const Reading = require("../models/reading");

const INTEGRATION_SECRET = process.env.INTEGRATION_SECRET || "dev-secret";

// post user readings
router.post("/", async (req, res) => {
  // Webhook auth
  const secret = req.get("x-integration-key");
  if (secret !== INTEGRATION_SECRET) return res.status(401).json({ error: "Bad integration key" });

  const { deviceId, reading, ts } = req.body || {};

  const parts = reading.split(",").map(s => s.trim());
  if (parts.length >= 2) {
    hr = Number(parts[0]);
    spo2 = Number(parts[1]);
  }

  if (!deviceId || !Number.isFinite(hr) || !Number.isFinite(spo2)) {
    return res.status(400).json({ error: "Missing deviceId/hr/spo2" });
  }

  let stamp = new Date();
  if (ts) {
    const n = Number(ts);
    stamp = Number.isFinite(n) ? new Date(n * 1000) : new Date(ts); // seconds OR ISO
  }
  if (isNaN(stamp.getTime())) return res.status(400).json({ error: "Invalid ts" });

  const doc = await Reading.create({ deviceId: dev._id, ts: stamp, hr, spo2 });
  return res.status(201).json({ _id: doc._id });
});

// get the user’s readings for that day
router.get("/", auth, async (req, res) => {
  const day = new Date(req.query.day);
  if (isNaN(day)) return res.status(400).json({ error: "Invalid day" });
  const next = new Date(day); next.setDate(next.getDate() + 1);
  const me = await Device.find({ ownerId: (await require("../models/customer").findOne({ email: req.user.email }))._id })
                         .select("_id");
  const ids = me.map(d => d._id);
  const docs = await Reading.find({ deviceId: { $in: ids }, ts: { $gte: day, $lt: next } })
                            .sort({ ts: 1 }).select("ts hr spo2");
  res.json(docs);
});

// get weekly summary of readings
router.get("/weekly-summary", auth, async (req, res) => {
  const me = await require("../models/customer").findOne({ email: req.user.email });
  const devs = await Device.find({ ownerId: me._id }).select("_id");
  const ids = devs.map(d => d._id);
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const agg = await Reading.aggregate([
    { $match: { deviceId: { $in: ids }, ts: { $gte: new Date(sevenDaysAgo.setHours(0,0,0,0)) } } },
    { $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$ts" }},
        avg: { $avg: "$hr" }, min: { $min: "$hr" }, max: { $max: "$hr" }
    }},
    { $project: { _id: 0, date: "$_id", avg: 1, min: 1, max: 1 } },
    { $sort: { date: 1 } }
  ]);
  res.json(agg);
});
module.exports = router;