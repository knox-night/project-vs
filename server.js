require("dotenv").config();
const crypto = require("crypto");

for (const name of ["SESSION_SECRET", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "TOKEN_ENCRYPTION_KEY"]) {
  if (!process.env[name]) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const { buildDigest } = require("./digest.js");
const { fetchNotifications } = require("./github.js");
const { sendDigestEmail } = require("./email.js");
const { saveUser, getUser, saveEmail, getAllUsers, muteNotification, getMutedIds, unmuteAll } = require("./db.js");
const cron = require("node-cron");
const app = express();
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.set("trust proxy", 1);
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
});

const dataLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
});
const PORT = process.env.PORT || 3000; // Render supplies PORT

// Fixed base URL (not the Host header). Must match the callback URL in your GitHub OAuth app.
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
// Secure cookies only work over https (Render). On your laptop (http) they must be off.
const USE_SECURE_COOKIES = BASE_URL.startsWith("https://");

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: USE_SECURE_COOKIES,
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000, // 1 day
  },
}));
app.use(cookieParser(process.env.SESSION_SECRET));
app.get("/", (req, res) => {
  res.set("Cache-Control", "no-store");
  const styles = `
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      * { box-sizing: border-box; }
      body {
        font-family: -apple-system, "Segoe UI", sans-serif;
        background: #10131a;
        color: #e2e6ee;
        margin: 0;
        line-height: 1.6;
      }
      .hero {
        max-width: 640px;
        margin: 0 auto;
        padding: 80px 24px 48px;
        text-align: center;
      }
      .badge {
        display: inline-block;
        font-size: 12.5px;
        color: #4fd1c5;
        border: 1px solid #2a3040;
        background: #171c25;
        padding: 4px 12px;
        border-radius: 20px;
        margin-bottom: 20px;
        font-family: "JetBrains Mono", monospace;
      }
      h1 {
        font-family: "JetBrains Mono", monospace;
        font-weight: 700;
        font-size: 34px;
        color: #4fd1c5;
        letter-spacing: -0.02em;
        margin: 0 0 14px;
      }
      .tagline {
        color: #8b93a3;
        font-size: 16.5px;
        margin: 0 0 30px;
        max-width: 460px;
        margin-left: auto;
        margin-right: auto;
      }
      a.button {
        display: inline-block;
        background: #4fd1c5;
        color: #0b1512;
        font-weight: 600;
        text-decoration: none;
        padding: 12px 26px;
        border-radius: 6px;
        font-size: 15px;
      }
      .muted-note {
        color: #565e6e;
        font-size: 13px;
        margin-top: 14px;
      }
      .features {
        max-width: 640px;
        margin: 0 auto;
        padding: 20px 24px 70px;
        display: grid;
        gap: 14px;
      }
      .feature {
        background: #171c25;
        border: 1px solid #2a3040;
        border-radius: 10px;
        padding: 18px 20px;
      }
      .feature b {
        color: #e2e6ee;
        font-size: 15px;
        display: block;
        margin-bottom: 4px;
      }
      .feature span {
        color: #8b93a3;
        font-size: 14px;
      }
      .pricing {
        max-width: 640px;
        margin: 0 auto 60px;
        padding: 0 24px;
        text-align: center;
        color: #565e6e;
        font-size: 13.5px;
      }
    </style>
  `;
  if (req.session.token) {
    res.send(`
      ${styles}
      <div class="hero">
        <div class="badge">GITHUB NOTIFICATIONS, SORTED</div>
        <h1>Your Digest</h1>
        <p class="tagline">You're logged in and ready to go.</p>
        <a class="button" href="/dashboard">View your digest</a>
        <div class="muted-note">Head to your dashboard to see what needs attention today.</div>
      </div>
      <div class="features">
        <div class="feature">
          <b>⏳ Know what's waiting on you</b>
          <span>Reviews and mentions that have sat untouched for 2+ days get flagged automatically.</span>
        </div>
        <div class="feature">
          <b>🎯 Sorted by real priority</b>
          <span>Review requests and failed builds surface first — passive activity stays out of your way.</span>
        </div>
        <div class="feature">
          <b>🔇 Mute the noise</b>
          <span>One click to stop seeing a thread you don't care about, permanently.</span>
        </div>
        <div class="feature">
          <b>📬 Delivered daily</b>
          <span>For now, check your dashboard anytime. Daily email delivery is on the way.</span>
        </div>
      </div>
    `);
  } else {
    res.send(`
      ${styles}
      <div class="hero">
        <div class="badge">GITHUB NOTIFICATIONS, SORTED</div>
        <h1>Stop drowning in GitHub notifications</h1>
        <p class="tagline">A daily digest that tells you what actually needs your attention today — not just everything that happened.</p>
        <a class="button" href="/auth/github">Log in with GitHub</a>
        <div class="muted-note">Free while in early access. No credit card required.</div>
        <div class="muted-note">Only asks for access to your notifications and basic profile — never your code.</div>
      </div>
      <div class="features">
        <div class="feature">
          <b>⏳ Know what's waiting on you</b>
          <span>Reviews and mentions that have sat untouched for 2+ days get flagged automatically — so nothing important slips through.</span>
        </div>
        <div class="feature">
          <b>🎯 Sorted by real priority</b>
          <span>Review requests and failed builds surface first. Passive activity — comments you're just watching — stays out of your way.</span>
        </div>
        <div class="feature">
          <b>🔇 Mute the noise</b>
          <span>One click to stop seeing a thread you don't care about, permanently.</span>
        </div>
        <div class="feature">
          <b>📬 Delivered daily</b>
          <span>For now, check your dashboard anytime. Daily email delivery is on the way.</span>
        </div>
      </div>
      <div class="pricing">
        Early access: everything is free right now. This is a new project built by one person, so expect rough edges. Feedback is welcome.
      </div>
    `);
  }
});

// Step 1: Redirect user to GitHub's login page
app.get("/auth/github", authLimiter, (req, res) => {
  // Random "state" ties the callback to this browser, blocking login CSRF
  const state = crypto.randomBytes(16).toString("hex");
  req.session.oauthState = state;

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: `${BASE_URL}/auth/callback`,
        scope: "read:user notifications",
    prompt: "select_account",
    state,
  });

  req.session.save(() => {
    res.redirect(`https://github.com/login/oauth/authorize?${params}`);
  });
});

// Step 2: GitHub redirects back here with a "code"
app.get("/auth/callback", authLimiter, async (req, res) => {
  const { code, state } = req.query;
  const expectedState = req.session.oauthState;
  delete req.session.oauthState;

  if (typeof code !== "string" || typeof state !== "string" || !expectedState || state !== expectedState) {
    return res.status(400).send('Login failed: invalid or expired login request. <a href="/auth/github">Try again</a>');
  }

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
      return res.status(400).send(`Error: ${escapeHtml(tokenData.error_description)}`);
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

    if (!userData.login) {
      throw new Error("Could not read GitHub username");
    }

    req.session.username = userData.login;
    await saveUser(userData.login, tokenData.access_token);

    // Long-lived cookie so we can find this user again even if the session expires
    res.cookie("username", userData.login, {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      secure: USE_SECURE_COOKIES,
      sameSite: "lax",
      signed: true,
    });

    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.send("Something went wrong during login.");
  }
});

// Shared: make sure a session is present, recovering from the long-lived cookie if needed.
// Returns true if the request can proceed, or false after already sending a redirect.
async function ensureSession(req, res) {
  if (req.session.token) return true;

  const username = req.signedCookies.username; // signed, so it cannot be forged
  if (!username) {
    res.redirect("/auth/github");
    return false;
  }

  const user = await getUser(username);
  if (!user) {
    res.redirect("/auth/github");
    return false;
  }

  req.session.token = user.access_token;
  req.session.username = user.github_username;
  return true;
}

const DASHBOARD_STYLES = `
  <meta name="viewport" content="width=device-width, initial-scale=1">
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
    .email-form form {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .email-form input {
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 9px 12px;
      border-radius: 6px;
      flex: 1 1 200px;
      min-width: 0;
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
    .loading-wrap {
      text-align: center;
      padding: 120px 24px;
    }
    .spinner {
      width: 28px;
      height: 28px;
      margin: 0 auto 16px;
      border: 3px solid var(--border);
      border-top-color: var(--brand);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .loading-text {
      color: var(--text-muted);
      font-size: 14.5px;
    }
  </style>
`;

// Step 3a: Serve a lightweight page immediately, which then fetches the real digest in the background
app.get("/dashboard", async (req, res) => {
  if (!(await ensureSession(req, res))) return;

  res.send(`
    ${DASHBOARD_STYLES}
    <div id="content" class="loading-wrap">
      <div class="spinner"></div>
      <div class="loading-text">Loading your digest…</div>
    </div>
    <script>
      fetch('/dashboard-data' + window.location.search)
        .then(function (res) {
          if (res.redirected) {
            window.location.href = res.url;
            return null;
          }
          return res.text();
        })
        .then(function (html) {
          if (html !== null) {
            document.getElementById('content').outerHTML = html;
          }
        })
        .catch(function () {
          document.getElementById('content').innerHTML =
            '<p style="color:var(--text-muted);">Something went wrong loading your digest. <a href="/dashboard" style="color:var(--brand);">Try again</a></p>';
        });
    </script>
  `);
});

// Step 3b: Does the actual GitHub fetch + AI summarizing + returns the digest HTML
app.get("/dashboard-data", dataLimiter, async (req, res) => {
  if (!(await ensureSession(req, res))) return;

  try {
    let notifications;
    try {
      notifications = await fetchNotifications(req.session.token);
    } catch (err) {
      if (err.status === 401) {
        // Token is invalid/expired: clear the stale session and cookie, send them to log in again
        req.session.destroy(() => {});
        res.clearCookie("username");
        return res.redirect("/auth/github");
      }
      throw err;
    }
    const mutedIds = await getMutedIds(req.session.username);
    const grouped = await buildDigest(notifications, mutedIds);

    const user = await getUser(req.session.username);
    const currentEmail = escapeHtml(user && user.email ? user.email : "");
    const mutedCount = mutedIds.length;

    let html = `
      <div id="content">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <h1>Your Digest</h1>
            <p class="subtitle">GitHub activity from the last 7 days</p>
          </div>
          <a href="/logout" style="color:var(--text-muted);font-size:13px;text-decoration:underline;margin-top:6px;">Log out</a>
        </div>
        <div class="email-form">
          <p style="margin:0 0 10px;color:var(--text-muted);font-size:13.5px;">Daily email digest is coming soon. Save your email now and it will switch on when it's ready.</p>
          <p style="margin:0 0 10px;color:var(--text-muted);font-size:13.5px;">Daily email digest is coming soon. Save your email now and it will switch on when it's ready.</p>
          <form action="/save-email" method="POST">
            <input type="email" name="email" placeholder="your@email.com" value="${currentEmail}" required>
            <button type="submit">Save email</button>
          </form>
          ${req.query.saved ? '<p style="color:var(--low);margin-top:10px;font-size:14px;">Email saved</p>' : ''}
        </div>
        ${mutedCount > 0 ? `
        <div style="display:flex;align-items:center;justify-content:space-between;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 16px;margin-bottom:20px;font-size:13.5px;color:var(--text-muted);">
          <span>${mutedCount} thread${mutedCount === 1 ? '' : 's'} muted</span>
          <form action="/unmute-all" method="POST">
            <button type="submit" style="background:none;color:var(--brand);border:none;font-size:13px;cursor:pointer;text-decoration:underline;">Unmute all</button>
          </form>
        </div>
        ` : ''}
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
                   <b>${escapeHtml(item.title)}</b><span class="repo-tag">${escapeHtml(item.repo)}</span>${staleBadge}
                   <span class="why">${escapeHtml(item.why)}</span>
                   <form action="/mute" method="POST" style="margin-top:8px;">
                     <input type="hidden" name="id" value="${item.id}">
                     <button type="submit" style="background:var(--surface-2);color:var(--text-muted);border:1px solid var(--border);padding:4px 10px;border-radius:5px;font-size:12px;cursor:pointer;">Mute</button>
                   </form>
                 </li>`;
      });
      html += "</ul>";
    });

    if (notifications.length === 0) {
      html += `
        <div class="empty-state">
          <b style="color:var(--text);display:block;margin-bottom:6px;font-size:15px;">No new activity in the last 7 days</b>
          <span>Once you get GitHub notifications — review requests, mentions, comments, failed builds — they'll show up here sorted by what actually needs your attention.</span>
          <br><br>
          <span>Daily email delivery is coming soon.</span>
        </div>
      `;
    }

    html += "</div>";
    res.send(html);
  } catch (err) {
    console.error(err);
    res.send(`
      <div id="content" style="text-align:center;padding:60px 24px;">
        <p style="font-size:16px;">Something went wrong fetching your digest.</p>
        <a href="/dashboard" style="color:var(--brand);">Try again</a>
      </div>
    `);
  }
});

app.post("/save-email", express.urlencoded({ extended: true }), async (req, res) => {
  if (!req.session.username) {
    return res.redirect("/auth/github");
  }
  const email = String(req.body.email || "").trim();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.redirect("/dashboard");
  }
  await saveEmail(req.session.username, email);
  res.redirect("/dashboard?saved=1");
});

app.post("/mute", express.urlencoded({ extended: true }), async (req, res) => {
  if (!req.session.username) {
    return res.redirect("/auth/github");
  }
  const id = String(req.body.id || "");
  if (!/^\d+$/.test(id)) {
    return res.redirect("/dashboard");
  }
  await muteNotification(req.session.username, id);
  res.redirect("/dashboard");
});

app.post("/unmute-all", async (req, res) => {
  if (!req.session.username) {
    return res.redirect("/auth/github");
  }
  await unmuteAll(req.session.username);
  res.redirect("/dashboard");
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error("Logout error:", err);
    res.clearCookie("username");
    res.set("Cache-Control", "no-store");
    res.redirect("/");
  });
});

app.get("/test-email", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).send("Not found");
  }
  if (!req.session.username) {
    return res.redirect("/auth/github");
  }

  const user = await getUser(req.session.username);
  if (!user || !user.email) {
    return res.send("No email saved for this user yet. Save one on /dashboard first.");
  }

  try {
    const notifications = await fetchNotifications(req.session.token);
    const mutedIds = await getMutedIds(req.session.username);
    const grouped = await buildDigest(notifications, mutedIds);

    const result = await sendDigestEmail(user.email, grouped);
    res.send(`Email sent! Result: ${JSON.stringify(result)}`);
  } catch (err) {
    console.error(err);
    res.send("Failed to send email: " + err.message);
  }
});

async function sendAllDigests() {
  const users = await getAllUsers();
  console.log(`Running daily digest job for ${users.length} user(s)...`);

  for (const user of users) {
    try {
      const notifications = await fetchNotifications(user.access_token);
      const mutedIds = await getMutedIds(user.github_username);
      const grouped = await buildDigest(notifications, mutedIds);

      await sendDigestEmail(user.email, grouped);
      console.log(`Sent digest to ${user.email}`);
    } catch (err) {
      console.error(`Failed to send digest to ${user.email}:`, err.message);
    }
  }
}

// Run the daily digest job every day at 8:00 AM
// (timezone: set DIGEST_TIMEZONE to an IANA zone name; defaults to UTC, which is what servers run in)
cron.schedule("0 8 * * *", () => {
  sendAllDigests();
}, { timezone: process.env.DIGEST_TIMEZONE || "UTC" });

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});