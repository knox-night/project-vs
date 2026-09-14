const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function summarizeThread(notification) {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 60,
    messages: [
      {
        role: 'user',
        content: `You're summarizing a GitHub notification for a busy developer. In 1-2 short sentences, plain English, tell them exactly what action (if any) is being asked of them.

Title: ${notification.subject.title}
Type: ${notification.subject.type}
Reason: ${notification.reason}
Repo: ${notification.repository.full_name}

Summary:`,
      },
    ],
  });

  return message.content[0].text.trim();
}

module.exports = { summarizeThread };