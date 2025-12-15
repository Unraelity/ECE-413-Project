module.exports = function buildRagPrompt(userQuestion, readings) {

  console.log("🔍 RAG Prompt Builder — received", readings.length, "readings");

  const formatted = readings.map(r => {
    return `• At ${new Date(r.ts).toLocaleString()}, HR=${r.hr}, SpO2=${r.spo2}`;
  }).join("\n");

  const finalPrompt = `
You are an AI Health Assistant. Base your answer ONLY on the user's health readings below.
Do NOT give medical diagnosis. Provide general insights based strictly on the supplied data.

User's recent health data:
${formatted}

User question:
"${userQuestion}"

Your response (based only on the above data, if there is no data in User's recent health data, say "No data available"):
`;

  console.log("📝 Final Prompt Sent to Ollama:\n", finalPrompt);

  return finalPrompt;
};
