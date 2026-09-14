// digest.js
// Step 2: Categorize notifications by urgency
const { summarizeThread } = require('./summarizer');

function categorizeNotification(n) {
  const reason = n.reason;
  const title = n.subject.title.toLowerCase();

  // High urgency: you're directly asked to do something
  if (reason === "review_requested") {
    return { level: "HIGH", why: "Someone needs your review" };
  }
  if (reason === "mention" && title.includes("?")) {
    return { level: "HIGH", why: "You were mentioned with a question" };
  }
  if (reason === "ci_activity" || title.includes("failed")) {
    return { level: "HIGH", why: "A build or check failed" };
  }

  // Medium urgency: worth a look, not urgent
  if (reason === "mention") {
    return { level: "MEDIUM", why: "You were mentioned" };
  }
  if (reason === "comment") {
    return { level: "MEDIUM", why: "New comment on something you're involved in" };
  }

  // Low urgency: informational only
  return { level: "LOW", why: "No action needed" };
}

async function buildDigest(notifications, mutedIds = []) {
  const grouped = { HIGH: [], MEDIUM: [], LOW: [] };

  for (const n of notifications) {
    if (mutedIds.includes(n.id)) continue;

    const { level } = categorizeNotification(n);
    let why;
    try {
      why = await summarizeThread(n);
    } catch (err) {
      console.error("AI summary failed, falling back:", err.message);
      why = categorizeNotification(n).why; // fallback to keyword reason
    }
      const daysOld = Math.floor(
      (Date.now() - new Date(n.updated_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    const stale = level === "HIGH" && daysOld >= 2;

    grouped[level].push({
      id: n.id,
      title: n.subject.title,
      repo: n.repository.full_name,
      why,
      stale,
      daysOld,
    });
  }

  // Show stale (waiting-on-you) items first within each section
  ["HIGH", "MEDIUM", "LOW"].forEach((level) => {
    grouped[level].sort((a, b) => (b.stale ? 1 : 0) - (a.stale ? 1 : 0));
  });

  return grouped;
}
function printDigest(grouped) {
  console.log("\n=== YOUR GITHUB DIGEST ===\n");

  ["HIGH", "MEDIUM", "LOW"].forEach((level) => {
    if (grouped[level].length === 0) return;
    console.log(`--- ${level} PRIORITY ---`);
    grouped[level].forEach((item, i) => {
      console.log(`${i + 1}. ${item.title}`);
      console.log(`   Repo: ${item.repo}`);
      console.log(`   Why: ${item.why}\n`);
    });
  });
}

module.exports = { buildDigest, printDigest, categorizeNotification };