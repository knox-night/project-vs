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
  res.send(ui.landing(!!req.session.token));
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

const ui = require("./ui.js");

// Step 3a: Serve a lightweight page immediately, which then fetches the real digest in the background
app.get("/dashboard", async (req, res) => {
  if (!(await ensureSession(req, res))) return;
  res.send(ui.dashboardShell(req.session.username));
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
        req.session.destroy(() => {});
        res.clearCookie("username");
        return res.redirect("/auth/github");
      }
      throw err;
    }
    const mutedIds = await getMutedIds(req.session.username);
    const grouped = await buildDigest(notifications, mutedIds);
    const user = await getUser(req.session.username);

    res.send(ui.digestHtml({
      grouped,
      total: notifications.length,
      email: user && user.email ? user.email : "",
      saved: !!req.query.saved,
      mutedCount: mutedIds.length,
    }));
  } catch (err) {
    console.error(err);
    res.send(ui.errorHtml());
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
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_TEST_EMAIL !== "true") {
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