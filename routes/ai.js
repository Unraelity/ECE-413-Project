// Import Express and create a router for "/ai" endpoints
const express = require("express");
const router = express.Router();

// Auth middleware that:
// - reads JWT from x-auth header
// - decodes it
// - sets req.user (ex: { email: ... })
const auth = require("../middleware/auth");

// Mongoose models
const Reading = require("../models/reading");
const Customer = require("../models/customer");
const Device = require("../models/device");

// Helper that builds a Retrieval-Augmented Generation (RAG) prompt
// using the user's question + recent readings
const ragPrompt = require("./ragPrompt");

// Client that sends the prompt to your LLM (Ollama) and returns the response text
const ollamaClient = require("./ollamaClient");

/**
 * POST /ai/ask
 * Protected route (requires valid JWT).
 *
 * Expected body:
 *   { "question": "..." }
 *
 * Response:
 *   { "reply": "..." }
 */
router.post("/ask", auth, async (req, res) => {
  try {
    // Pull the authenticated user's email from the decoded JWT payload
    const email = req.user.email;

    // The user's question is sent in the request body
    const question = req.body.question;

    // Debug logging (useful in dev; consider trimming in production)
    console.log("🧠 /ai/ask — email:", email, "question:", question);

    // Validate input: question must exist
    if (!question) {
      return res.status(400).json({ error: "Missing question" });
    }

    // 1) Look up the customer document by email
    // (This ties the JWT identity to a DB record)
    const customer = await Customer.findOne({ email });

    // If the customer doesn't exist, treat as unauthorized
    // (JWT might be valid but user isn't in DB anymore)
    if (!customer) {
      return res.status(401).json({ error: "Customer not found" });
    }

    // 2) Find devices owned by this customer
    // Select only _id to reduce payload (we only need ids for reading lookup)
    const devices = await Device.find({ customerId: customer._id }).select("_id");

    // Not fatal: user can still ask questions, but the prompt will have no readings context
    if (devices.length === 0) {
      console.log("⚠️ No devices found for customer");
    }

    // Extract the ObjectIds into a simple array
    const deviceIds = devices.map(d => d._id);

    // 3) Fetch recent readings for all of the customer's devices
    // - $in matches any reading whose deviceId is in deviceIds
    // - sort by timestamp descending (newest first)
    // - limit to 50 to keep prompt size manageable
    const readings = await Reading.find({ deviceId: { $in: deviceIds } })
      .sort({ ts: -1 })
      .limit(50);

    console.log("📊 Readings retrieved:", readings.length);

    // 4) Build the RAG prompt:
    // combine the user's question + the recent readings into a single prompt string
    const prompt = ragPrompt(question, readings);

    // 5) Call the LLM (Ollama) using your client wrapper
    // This should return the model's reply (string)
    const reply = await ollamaClient(prompt);

    // Send the reply back to the browser
    res.json({ reply });
  } catch (err) {
    // If anything fails (DB errors, LLM errors, etc.), log and return 500
    console.error("❌ AI error:", err);
    res.status(500).json({ error: "AI assistant failed" });
  }
});

// Export router so it can be mounted in your server, e.g. app.use("/ai", router)
module.exports = router;