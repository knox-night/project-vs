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

// Add an email column if it doesn't exist yet (safe to run every time)
try {
  db.exec(`ALTER TABLE users ADD COLUMN email TEXT`);
} catch (err) {
  // Ignore error if column already exists
  if (!err.message.includes('duplicate column name')) {
    throw err;
  }
}

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

// Save/update a user's email address
function saveEmail(githubUsername, email) {
  const stmt = db.prepare(`
    UPDATE users SET email = ? WHERE github_username = ?
  `);
  stmt.run(email, githubUsername);
}
// Get every user who has saved an email address
function getAllUsers() {
  const stmt = db.prepare('SELECT * FROM users WHERE email IS NOT NULL');
  return stmt.all();
}
module.exports = { db, saveUser, getUser, saveEmail, getAllUsers };