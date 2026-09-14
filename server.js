require("dotenv").config();
const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const { buildDigest } = require("./digest.js");
const { saveUser, getUser, saveEmail, getAllUsers, muteNotification, getMutedIds } = require("./db.js");
const { sendDigestEmail } = require("./email.js");
const cron = require("node-cron");
const app = express();

const PORT = 3000;

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}));
app.use(cookieParser());

app.get("/", (req, res) => {
  const styles = `
    <style>
      body {
        font-family: -apple-system, "Segoe UI", sans-serif;
        background: #10131a;
        color: #e2e6ee;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        margin: 0;
        text-align: center;
      }
      .card { max-width: 380px; padding: 0 24px; }
      h1 {
        font-family: "JetBrains Mono", monospace;
        font-weight: 700;
        font-size: 24px;
        color: #4fd1c5;
        letter-spacing: -0.02em;
        margin: 0 0 10px;
      }
      p { color: #8b93a3; font-size: 14.5px; margin: 0 0 22px; }
      a.button {
        display: inline-block;
        background: #4fd1c5;
        color: #0b1512;
        font-weight: 600;
        text-decoration: none;
        padding: 10px 20px;
        border-radius: 6px;
        font-size: 14.5px;
      }
    </style>
  `;

  if (req.session.token) {
    res.send(`
      ${styles}
      <div class="card">
        <h1>Your Digest</h1>
        <p>You're logged in.</p>
        <a class="button" href="/dashboard">View your digest</a>
      </div>
    `);
  } else {
    res.send(`
      ${styles}
      <div class="card">
        <h1>Your Digest</h1>
        <p>A daily summary of your GitHub activity, sorted by what actually matters.</p>
        <a class="button" href="/auth/github">Log in with GitHub</a>
      </div>
    `);
  }
});

// Step 1: Redirect user to GitHub's login page
app.get("/auth/github", (req, res) => {
  const redirectUri = `${req.protocol}://${req.get("host")}/auth/callback`;
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&scope=read:user,notifications`;
  res.redirect(githubAuthUrl);
});

// Step 2: GitHub redirects back here with a "code"
app.get("/auth/callback", async (req, res) => {
  const code = req.query.code;

  try {
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return res.send(`Error: ${tokenData.error_description}`);
    }

    req.session.token = tokenData.access_token;

    // Fetch the logged-in user's GitHub username
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/vnd.github+json",
      },
    });
    const userData = await userResponse.json();

    req.session.username = userData.login;
    saveUser(userData.login, tokenData.access_token);

    // Long-lived cookie so we can find this user again even if the session expires
    res.cookie("username", userData.login, {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
    });

    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.send("Something went wrong during login.");
  }
});

// Step 3: Show the logged-in user's actual digest
app.get("/dashboard", async (req, res) => {
  // If session has a token, use it directly
  if (!req.session.token) {
    // Session is gone — try to recover using the long-lived cookie
    const username = req.cookies.username;
    if (!username) {
      return res.redirect("/auth/github");
    }

    const user = getUser(username);
    if (!user) {
      return res.redirect("/auth/github");
    }

    // Restore the session from the database
    req.session.token = user.access_token;
    req.session.username = user.github_username;
  }

  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const response = await fetch(
      `https://api.github.com/notifications?since=${since}&all=true`,
      {
        headers: {
          Authorization: `Bearer ${req.session.token}`,
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
    const mutedIds = getMutedIds(req.session.username);
    const grouped = await buildDigest(notifications, mutedIds);

    const user = getUser(req.session.username);
    const currentEmail = user && user.email ? user.email : "";

    let html = `
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
      <style>
        :root {
          --bg: #10131a;
          --surface: #171c25;
          --surface-2: #1e2430;
          --border: #2a3040;
          --text: #e2e6ee;
          --text-muted: #8b93a3;
          --brand: #4fd1c5;
          --high: #ef6461;
          --medium: #e7b34c;
          --low: #7fbf7f;
        }
        body {
          font-family: -apple-system, "Segoe UI", sans-serif;
          background: var(--bg);
          color: var(--text);
          padding: 56px 24px;
          max-width: 640px;
          margin: auto;
          line-height: 1.55;
        }
        h1 {
          font-family: "JetBrains Mono", monospace;
          font-weight: 700;
          font-size: 26px;
          color: var(--brand);
          letter-spacing: -0.02em;
          margin: 0 0 4px;
        }
        .subtitle {
          color: var(--text-muted);
          font-size: 14px;
          margin: 0 0 28px;
        }
        .email-form {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 18px 20px;
          margin-bottom: 28px;
        }
        .email-form input {
          background: var(--bg);
          border: 1px solid var(--border);
          color: var(--text);
          padding: 9px 12px;
          border-radius: 6px;
          margin-right: 8px;
          width: 240px;
          font-size: 14px;
        }
        .email-form button {
          background: var(--brand);
          color: #0b1512;
          border: none;
          padding: 9px 16px;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
        }
        .section-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: var(--text-muted);
          margin: 28px 0 10px;
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }
        ul { list-style: none; padding: 0; margin: 0; }
        li {
          background: var(--surface);
          border: 1px solid var(--border);
          border-left: 3px solid var(--border);
          border-radius: 8px;
          padding: 14px 16px;
          margin-bottom: 10px;
        }
        li b { color: var(--text); font-weight: 600; }
        .repo-tag {
          font-family: "JetBrains Mono", monospace;
          font-size: 12px;
          color: var(--text-muted);
          background: var(--surface-2);
          padding: 2px 6px;
          border-radius: 4px;
          margin-left: 6px;
        }
        .why {
          display: block;
          color: var(--text-muted);
          font-size: 13.5px;
          margin-top: 6px;
        }
        .empty-state {
          border: 1px dashed var(--border);
          border-radius: 10px;
          padding: 24px;
          color: var(--text-muted);
          font-size: 14.5px;
        }
      </style>
      <h1>Your Digest</h1>
      <p class="subtitle">GitHub activity from the last 7 days</p>
      <div class="email-form">
        <form action="/save-email" method="POST">
          <input type="email" name="email" placeholder="your@email.com" value="${currentEmail}" required>
          <button type="submit">Save email for daily digest</button>
        </form>
        ${req.query.saved ? '<p style="color:var(--low);margin-top:10px;font-size:14px;">Email saved</p>' : ''}
      </div>
    `;

    const priorityMeta = {
      HIGH: { label: "High priority", color: "var(--high)" },
      MEDIUM: { label: "Medium priority", color: "var(--medium)" },
      LOW: { label: "Low priority", color: "var(--low)" },
    };

    ["HIGH", "MEDIUM", "LOW"].forEach((level) => {
      if (grouped[level].length === 0) return;
      const meta = priorityMeta[level];
      html += `<div class="section-label"><span class="dot" style="background:${meta.color}"></span>${meta.label}</div><ul>`;
      grouped[level].forEach((item) => {
        const staleBadge = item.stale
          ? `<span style="background:var(--high);color:#1a0f0f;font-size:11px;font-weight:600;padding:2px 7px;border-radius:4px;margin-left:6px;">⏳ Waiting ${item.daysOld}d</span>`
          : "";
        html += `<li style="border-left-color:${meta.color}">
                   <b>${item.title}</b><span class="repo-tag">${item.repo}</span>${staleBadge}
                   <span class="why">${item.why}</span>
                   <form action="/mute" method="POST" style="margin-top:8px;">
                     <input type="hidden" name="id" value="${item.id}">
                     <button type="submit" style="background:var(--surface-2);color:var(--text-muted);border:1px solid var(--border);padding:4px 10px;border-radius:5px;font-size:12px;cursor:pointer;">Mute</button>
                   </form>
                 </li>`;
      });
      html += "</ul>";
    });

    if (notifications.length === 0) {
      html += '<div class="empty-state">No new activity in the last 7 days.</div>';
    }
    res.send(html);
  } catch (err) {
    console.error(err);
    res.send("Something went wrong fetching your digest.");
  }
});

app.post("/save-email", express.urlencoded({ extended: true }), (req, res) => {
  if (!req.session.username) {
    return res.redirect("/auth/github");
  }
  saveEmail(req.session.username, req.body.email);
  res.redirect("/dashboard?saved=1");
});

app.post("/mute", express.urlencoded({ extended: true }), (req, res) => {
  if (!req.session.username) {
    return res.redirect("/auth/github");
  }
  muteNotification(req.session.username, req.body.id);
  res.redirect("/dashboard");
});

app.get("/test-email", async (req, res) => {
  if (!req.session.username) {
    return res.redirect("/auth/github");
  }

  const user = getUser(req.session.username);
  if (!user || !user.email) {
    return res.send("No email saved for this user yet. Save one on /dashboard first.");
  }

  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const response = await fetch(
      `https://api.github.com/notifications?since=${since}&all=true`,
      {
        headers: {
          Authorization: `Bearer ${req.session.token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );
    const notifications = await response.json();
    const mutedIds = getMutedIds(req.session.username);
    const grouped = await buildDigest(notifications, mutedIds);

    const result = await sendDigestEmail(user.email, grouped);
    res.send(`Email sent! Result: ${JSON.stringify(result)}`);
  } catch (err) {
    console.error(err);
    res.send("Failed to send email: " + err.message);
  }
});

async function sendAllDigests() {
  const users = getAllUsers();
  console.log(`Running daily digest job for ${users.length} user(s)...`);

  for (const user of users) {
    try {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const response = await fetch(
        `https://api.github.com/notifications?since=${since}&all=true`,
        {
          headers: {
            Authorization: `Bearer ${user.access_token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        }
      );
      const notifications = await response.json();
      const mutedIds = getMutedIds(user.github_username);
      const grouped = await buildDigest(notifications, mutedIds);

      await sendDigestEmail(user.email, grouped);
      console.log(`Sent digest to ${user.email}`);
    } catch (err) {
      console.error(`Failed to send digest to ${user.email}:`, err.message);
    }
  }
}

// Run the daily digest job every day at 8:00 AM
cron.schedule("0 8 * * *", () => {
  sendAllDigests();
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});