// routes/devices.js
const express = require('express');
const router = express.Router();
const auth = require("../middleware/auth");
const Device = require("../models/device");
const Customer = require("../models/customer");
const crypto = require("crypto");

// register a device
router.post("/", auth, async (req, res) => {
  try {
    const owner = await Customer.findOne({ email: req.user.email });
    if (!owner) return res.status(404).json({ error: "Owner not found" });
    const { name, particleId } = req.body;
    if (!name) return res.status(400).json({ error: "Missing name" });
    const apiKey = crypto.randomBytes(16).toString("hex");
    const dev = await Device.create({ ownerId: owner._id, name, particleId, apiKey });
    return res.status(201).json({
      _id: dev._id, name: dev.name, particleId: dev.particleId, apiKey: dev.apiKey
    });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

// get user device
router.get("/", auth, async (req, res) => {
  const me = await Customer.findOne({ email: req.user.email });
  const list = await Device.find({ ownerId: me._id }).select("_id name apiKey");
  return res.json(list);
});

// delete a device
router.delete("/:id", auth, async (req, res) => {
  const me = await Customer.findOne({ email: req.user.email });
  const del = await Device.deleteOne({ _id: req.params.id, ownerId: me._id });
  return res.json({ deleted: del.deletedCount });
});

module.exports = router;
