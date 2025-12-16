// routes/devices.js
// Routes for registering, listing, and deleting devices tied to a logged-in user.

const express = require('express');
const router = express.Router();

// Auth middleware: expects JWT in x-auth header, decodes it, and sets req.user (ex: { email })
const auth = require("../middleware/auth");

// Mongoose models
const Device = require("../models/device");
const Customer = require("../models/customer");

const crypto = require("crypto");

// ==========================================================
// POST /devices
// Register a new device for the currently logged-in user
// Body: { name, particleId }
// ==========================================================
router.post("/", auth, async (req, res) => {
  try {
    // Find the logged-in user ("owner") by the email inside the JWT payload
    const owner = await Customer.findOne({ email: req.user.email });
    if (!owner) return res.status(404).json({ error: "Owner not found" });

    // Pull fields from request body
    const { name, particleId } = req.body;

    // Basic validation: require a name
    if (!name) return res.status(400).json({ error: "Missing name" });

    // Create the Device document and associate it with this ownerId
    // NOTE: particleId is optional here; if you require it, add a check.
    const dev = await Device.create({ ownerId: owner._id, name, particleId });

    // Return the newly created device (only the fields the client needs)
    return res.status(201).json({
      _id: dev._id,
      name: dev.name,
      particleId: dev.particleId
    });
  } catch (e) {
    // Catch server/DB errors
    return res.status(500).json({ error: e.message });
  }
});

// ==========================================================
// GET /devices
// Get all devices for the currently logged-in user
// ==========================================================
router.get("/", auth, async (req, res) => {
  // Find current user by JWT email
  const me = await Customer.findOne({ email: req.user.email });

  // Get all devices owned by this user, selecting only fields needed by the UI
  const list = await Device.find({ ownerId: me._id }).select("_id name particleId");

  // Return array of devices
  return res.json(list);
});

// ==========================================================
// DELETE /devices/:id
// Delete a device by its id, but only if it belongs to the logged-in user
// ==========================================================
router.delete("/:id", auth, async (req, res) => {
  // Find current user by JWT email
  const me = await Customer.findOne({ email: req.user.email });

  // Delete only if BOTH match:
  // - _id equals the id in the URL
  // - ownerId equals the current user's id
  // This prevents deleting other users' devices.
  const del = await Device.deleteOne({ _id: req.params.id, ownerId: me._id });

  // deletedCount will be 1 if a device was deleted, otherwise 0
  return res.json({ deleted: del.deletedCount });
});

// Export router so the server can mount it (ex: app.use("/devices", router))
module.exports = router;