// fetch-notifications.js
// Step 1: Fetch your GitHub notifications from the last 24 hours

const TOKEN = process.env.GITHUB_TOKEN;
const { buildDigest, printDigest } = require("./digest.js");

if (!TOKEN) {
  console.error("Missing GITHUB_TOKEN. Set it before running:");
  console.error("  export GITHUB_TOKEN=your_token_here   (Mac/Linux)");
  console.error("  set GITHUB_TOKEN=your_token_here       (Windows cmd)");
  process.exit(1);
}

async function fetchNotifications() {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const response = await fetch(
    `https://api.github.com/notifications?since=${since}&all=true`,
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${errorText}`);
  }

  const notifications = await response.json();
  return notifications;
}

async function main() {
    console.log("Fetching your GitHub notifications from the last 7 days...\n");

  try {
    const notifications = await fetchNotifications();

    if (notifications.length === 0) {
      console.log("No new notifications in the last 7 days.");
      return;
    }

        console.log(`Found ${notifications.length} notification(s):\n`);

    const grouped = buildDigest(notifications);
    printDigest(grouped);
  } catch (err) {
    console.error("Failed to fetch notifications:", err.message);
  }
}

main();