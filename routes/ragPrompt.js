// ragPrompt.js
// Builds a "RAG-style" prompt by combining the user's question with their recent readings.
// The LLM is instructed to answer ONLY using the supplied readings (no outside knowledge).

module.exports = function buildRagPrompt(userQuestion, readings) {

  // Debug: confirm how many readings we got from MongoDB
  console.log("🔍 RAG Prompt Builder — received", readings.length, "readings");

  // Convert each reading into a human-readable bullet line:
  // Example: "• At 12/15/2025, 7:04 PM, HR=78, SpO2=97"
  // NOTE: toLocaleString() uses the server's locale/timezone.
  // If server timezone differs from user timezone, displayed times may be off.
  const formatted = readings
    .map(r => {
      return `• At ${new Date(r.ts).toLocaleString()}, HR=${r.hr}, SpO2=${r.spo2}`;
    })
    // Join all bullet lines into one block separated by newlines
    .join("\n");

  // Build the final prompt sent to the LLM
  // - Strong instruction to only use the readings
  // - Safety: no medical diagnosis
  // - Includes the user's question verbatim
  // - Includes an explicit instruction for what to say if no data exists
  const finalPrompt = `
You are an AI Health Assistant. Base your answer ONLY on the user's health readings below.
Do NOT give medical diagnosis. Provide general insights based strictly on the supplied data.

User's recent health data:
${formatted}

User question:
"${userQuestion}"

Your response (based only on the above data, if there is no data in User's recent health data, say "No data available"):
`;

  // Debug: print the full prompt being sent to Ollama (can be noisy; disable in production)
  console.log("📝 Final Prompt Sent to Ollama:\n", finalPrompt);

  // Return the prompt string to the caller (ai route)
  return finalPrompt;
};