// test-digest.js
// Testing digest.js with fake sample notifications (no real GitHub API needed)

const { buildDigest, printDigest } = require("./digest.js");

const fakeNotifications = [
  {
    reason: "review_requested",
    subject: { title: "Fix login bug", type: "PullRequest" },
    repository: { full_name: "my-app" },
  },
  {
    reason: "watching",
    subject: { title: "Someone starred your repository", type: "Repository" },
    repository: { full_name: "my-app" },
  },
  {
    reason: "ci_activity",
    subject: { title: "CI build failed on main branch", type: "CheckSuite" },
    repository: { full_name: "my-app" },
  },
  {
    reason: "mention",
    subject: { title: "can you check this?", type: "Issue" },
    repository: { full_name: "my-app" },
  },
  {
    reason: "comment",
    subject: { title: "New comment on closed issue (no question asked)", type: "Issue" },
    repository: { full_name: "old-project" },
  },
];

const grouped = buildDigest(fakeNotifications);
printDigest(grouped);