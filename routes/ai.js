const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");

const Reading = require("../models/reading");
const Customer = require("../models/customer");
const Device = require("../models/device");
const ragPrompt = require("./ragPrompt");
const ollamaClient = require("./ollamaClient");

router.post("/ask", auth, async (req, res) => {
  try {
    const email = req.user.email;
    const question = req.body.question;

    console.log("🧠 /ai/ask — email:", email, "question:", question);

    if (!question) {
      return res.status(400).json({ error: "Missing question" });
    }

    // 1️⃣ Get customer
    const customer = await Customer.findOne({ email });
    if (!customer) {
      return res.status(401).json({ error: "Customer not found" });
    }

    // 2️⃣ Get devices owned by customer
    const devices = await Device.find({ customerId: customer._id }).select("_id");

    if (devices.length === 0) {
      console.log("⚠️ No devices found for customer");
    }

    const deviceIds = devices.map(d => d._id);

    // 3️⃣ Get recent readings from those devices
    const readings = await Reading.find({ deviceId: { $in: deviceIds } })
      .sort({ ts: -1 })
      .limit(50);

    console.log("📊 Readings retrieved:", readings.length);

    // 4️⃣ Build RAG prompt
    const prompt = ragPrompt(question, readings);

    // 5️⃣ Call LLM
    const reply = await ollamaClient(prompt);

    res.json({ reply });
  } catch (err) {
    console.error("❌ AI error:", err);
    res.status(500).json({ error: "AI assistant failed" });
  }
});

module.exports = router;

