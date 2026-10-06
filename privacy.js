const privacyPage = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Privacy Policy - GitHub Digest</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0b1622; color: #d6e2ee; max-width: 720px; margin: 0 auto; padding: 32px 20px; line-height: 1.6; }
  h1, h2 { color: #4fd1c5; }
  a { color: #4fd1c5; }
</style>
</head>
<body>
<h1>Privacy Policy</h1>
<p>Last updated: October 2026</p>
<p>GitHub Digest (githubdigest.space) is a small independent project built by one person. This page explains what data it uses and why.</p>

<h2>What we collect</h2>
<p>When you log in with GitHub, we store your GitHub username and an access token that lets us read your notifications. The token is encrypted in our database. If you choose to save an email address, we store that too.</p>

<h2>How we use it</h2>
<p>We use your token to fetch your GitHub notifications and show them on your dashboard. If you saved an email, we send you a daily digest. We do not sell your data or use it for advertising.</p>

<h2>AI summaries</h2>
<p>To write short summaries, the title, type, reason and repository name of some of your notifications are sent to Google's Gemini API. We do not send your token or your email to Gemini.</p>

<h2>Services we use</h2>
<p>Render (hosting), Turso (database), Resend (sending emails), Google Gemini (AI summaries) and GitHub (login). Each of them processes data on our behalf.</p>

<h2>Cookies</h2>
<p>We use a session cookie and a cookie that keeps you logged in for 30 days. We do not use tracking or advertising cookies.</p>

<h2>Deleting your data</h2>
<p>You can revoke access any time at GitHub: Settings, Applications, Authorized OAuth Apps. To delete your stored data (username, token, email), email me at YOUR_EMAIL_HERE and I will remove it.</p>

<h2>Contact</h2>
<p>Questions? sigmaboy789265@gmail.com .</p>

<p><a href="/">Back to home</a></p>
</body>
</html>`;

module.exports = { privacyPage };