const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

async function summarizeThread(notification) {
  const prompt = `You're summarizing a GitHub notification for a busy developer. In 1-2 short sentences, plain English, tell them exactly what action (if any) is being asked of them.

Title: ${notification.subject.title}
Type: ${notification.subject.type}
Reason: ${notification.reason}
Repo: ${notification.repository.full_name}

Summary:`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 200 },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Gemini API error ${res.status}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Gemini returned no text');
  }

  return text.trim();
}

module.exports = { summarizeThread };