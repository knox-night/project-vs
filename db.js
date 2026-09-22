require("dotenv").config();
const Database = require('better-sqlite3');

const db = new Database('project-vs.db');
const crypto = require("crypto");

const ENCRYPTION_KEY = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, "hex");

function encryptToken(token) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Store iv, authTag, and ciphertext together, separated by colons
  return iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted.toString("hex");
}

function decryptToken(encryptedToken) {
  const [ivHex, authTagHex, dataHex] = encryptedToken.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(dataHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

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

// Create muted_notifications table if it doesn't already exist
db.exec(`
  CREATE TABLE IF NOT EXISTS muted_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    github_username TEXT NOT NULL,
    notification_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(github_username, notification_id)
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
  stmt.run(githubUsername, encryptToken(accessToken));
}

// Get a user by their GitHub username
function getUser(githubUsername) {
  const stmt = db.prepare('SELECT * FROM users WHERE github_username = ?');
  const user = stmt.get(githubUsername);
  if (user && user.access_token) {
    user.access_token = decryptToken(user.access_token);
  }
  return user;
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
  const users = stmt.all();
  return users.map(user => {
    if (user.access_token) {
      user.access_token = decryptToken(user.access_token);
    }
    return user;
  });
}
// Mute a notification thread for a user
function muteNotification(githubUsername, notificationId) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO muted_notifications (github_username, notification_id)
    VALUES (?, ?)
  `);
  stmt.run(githubUsername, notificationId);
}

// Get all muted notification IDs for a user
function getMutedIds(githubUsername) {
  const stmt = db.prepare('SELECT notification_id FROM muted_notifications WHERE github_username = ?');
  return stmt.all(githubUsername).map(row => row.notification_id);
}
// Remove ALL muted notifications for a user (unmute all)
function unmuteAll(githubUsername) {
  const stmt = db.prepare('DELETE FROM muted_notifications WHERE github_username = ?');
  stmt.run(githubUsername);
}

module.exports = { db, saveUser, getUser, saveEmail, getAllUsers, muteNotification, getMutedIds, unmuteAll };