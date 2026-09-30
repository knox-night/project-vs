// fetch-notifications.js
// CLI: fetch your GitHub notifications from the last 7 days and print the digest.
require("dotenv").config();
const { fetchNotifications } = require("./github.js");
const { buildDigest, printDigest } = require("./digest.js");

const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN) {
  console.error("Missing GITHUB_TOKEN. Put it in .env or set it before running:");
  console.error("  export GITHUB_TOKEN=your_token_here   (Mac/Linux)");
  console.error("  set GITHUB_TOKEN=your_token_here       (Windows cmd)");
  process.exit(1);
}

async function main() {
  console.log("Fetching your GitHub notifications from the last 7 days...\n");

  try {
    const notifications = await fetchNotifications(TOKEN);

    if (notifications.length === 0) {
      console.log("No new notifications in the last 7 days.");
      return;
    }

    console.log(`Found ${notifications.length} notification(s):\n`);

    const grouped = await buildDigest(notifications);
    printDigest(grouped);
  } catch (err) {
    console.error("Failed to fetch notifications:", err.message);
    process.exitCode = 1;
  }
}

main();
