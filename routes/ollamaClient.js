const axios = require("axios");

// Replace this with your ngrok public URL
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";

module.exports = async function callOllama(prompt) {
  console.log("🌐 Ollama URL:", OLLAMA_URL);
  console.log("📨 Sending to Ollama model: phi3:mini");
  console.log("📝 Prompt length:", prompt.length);
  try {
    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: "phi3:mini",
      prompt,
      stream: false
    }, {
      timeout: 300000
    });

  console.log("📩 Raw Ollama API Response:", response.data);


    return response.data.response;
  } catch (err) {
    console.error("Ollama request failed:", err.message);
    throw err;
  }
};
