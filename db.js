const Database = require('better-sqlite3');
const db = new Database('project-vs.db');

// Create users table if it doesn't already exist
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    github_username TEXT UNIQUE NOT NULL,
    access_token TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Save a new user or update their token if they already exist
function saveUser(githubUsername, accessToken) {
  const stmt = db.prepare(`
    INSERT INTO users (github_username, access_token)
    VALUES (?, ?)
    ON CONFLICT(github_username)
    DO UPDATE SET access_token = excluded.access_token, updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(githubUsername, accessToken);
}

// Get a user by their GitHub username
function getUser(githubUsername) {
  const stmt = db.prepare('SELECT * FROM users WHERE github_username = ?');
  return stmt.get(githubUsername);
}

module.exports = { db, saveUser, getUser };