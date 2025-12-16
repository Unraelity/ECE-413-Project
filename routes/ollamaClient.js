// ollamaClient.js
// Small helper that sends a prompt to an Ollama server and returns the model's text reply.

const axios = require("axios"); // HTTP client for making requests

// Base URL for the Ollama server.
// - Defaults to local Ollama instance
// - Can be overridden by setting OLLAMA_URL in your environment (e.g., ngrok URL)
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";

/**
 * callOllama(prompt)
 * Sends a prompt to Ollama's /api/generate endpoint using the model "phi3:mini".
 *
 * @param {string} prompt - The full prompt string (your RAG prompt).
 * @returns {Promise<string>} - The model's generated response text.
 */
module.exports = async function callOllama(prompt) {
  // Debug logs (useful during development to confirm URL/model/prompt size)
  console.log("🌐 Ollama URL:", OLLAMA_URL);
  console.log("📨 Sending to Ollama model: phi3:mini");
  console.log("📝 Prompt length:", prompt.length);

  try {
    // POST request to Ollama generate endpoint
    const response = await axios.post(
      `${OLLAMA_URL}/api/generate`,
      {
        model: "phi3:mini", // which model to use (must be available in your Ollama instance)
        prompt,             // the text prompt you want the model to answer
        stream: false       // stream=false means the response comes back as one JSON object
      },
      {
        timeout: 300000     // 300 seconds (5 minutes) timeout to allow slower generations
      }
    );

    // Log the full raw response (handy for debugging unexpected output)
    console.log("📩 Raw Ollama API Response:", response.data);

    // Ollama returns a JSON object; the generated text is typically in `response`
    // Example: { response: "...", done: true, ... }
    return response.data.response;
  } catch (err) {
    // If request fails (network, timeout, server down), log and re-throw
    console.error("Ollama request failed:", err.message);
    throw err;
  }
};