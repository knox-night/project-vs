require("dotenv").config();
const express = require("express");
const session = require("express-session");
const { buildDigest } = require("./digest.js");
const { saveUser } = require("./db.js");
const app = express();

const PORT = 3000;

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}));

app.get("/", (req, res) => {
  if (req.session.token) {
    res.send('You are logged in! <a href="/dashboard">View your digest</a>');
  } else {
    res.send('GitHub Digest server is running! <a href="/auth/github">Login with GitHub</a>');
  }
});

// Step 1: Redirect user to GitHub's login page
app.get("/auth/github", (req, res) => {
  const redirectUri = "http://localhost:3000/auth/callback";
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

    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.send("Something went wrong during login.");
  }
});

// Step 3: Show the logged-in user's actual digest
app.get("/dashboard", async (req, res) => {
  if (!req.session.token) {
    return res.redirect("/auth/github");
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
    const grouped = buildDigest(notifications);

    let html = "<h1>Your GitHub Digest</h1>";

    ["HIGH", "MEDIUM", "LOW"].forEach((level) => {
      if (grouped[level].length === 0) return;
      html += `<h2>${level} PRIORITY</h2><ul>`;
      grouped[level].forEach((item) => {
        html += `<li><b>${item.title}</b> (${item.repo})<br>Why: ${item.why}</li>`;
      });
      html += "</ul>";
    });

    if (notifications.length === 0) {
      html += "<p>No new notifications in the last 7 days.</p>";
    }

    res.send(html);
  } catch (err) {
    console.error(err);
    res.send("Something went wrong fetching your digest.");
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});