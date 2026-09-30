require("dotenv").config();
const { createClient } = require("@libsql/client");
const crypto = require("crypto");

// Connects to Turso online. If the Turso settings are missing (e.g. on your laptop),
// it falls back to a local file so you can still test.
const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:project-vs.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

if (!/^[0-9a-fA-F]{64}$/.test(process.env.TOKEN_ENCRYPTION_KEY || "")) {
  throw new Error(
    "TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes). Generate one with: " +
    "node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
  );
}
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

// Turns a database row into a plain object like { github_username: "...", email: "..." }
function rowToObject(result, row) {
  const obj = {};
  result.columns.forEach((col, i) => {
    obj[col] = row[i];
  });
  return obj;
}

// Create the tables if they don't exist yet (runs once when the server starts)
const ready = client.batch(
  [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      github_username TEXT UNIQUE NOT NULL,
      access_token TEXT NOT NULL,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS muted_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      github_username TEXT NOT NULL,
      notification_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(github_username, notification_id)
    )`,
  ],
  "write"
);
ready.catch((err) => console.error("Database setup failed:", err));

// Save a new user or update their token if they already exist
async function saveUser(githubUsername, accessToken) {
  await ready;
  await client.execute({
    sql: `
      INSERT INTO users (github_username, access_token)
      VALUES (?, ?)
      ON CONFLICT(github_username)
      DO UPDATE SET access_token = excluded.access_token, updated_at = CURRENT_TIMESTAMP
    `,
    args: [githubUsername, encryptToken(accessToken)],
  });
}

// Get a user by their GitHub username
async function getUser(githubUsername) {
  await ready;
  const result = await client.execute({
    sql: "SELECT * FROM users WHERE github_username = ?",
    args: [githubUsername],
  });
  if (result.rows.length === 0) return undefined;
  const user = rowToObject(result, result.rows[0]);
  if (user.access_token) {
    user.access_token = decryptToken(user.access_token);
  }
  return user;
}

// Save/update a user's email address
async function saveEmail(githubUsername, email) {
  await ready;
  await client.execute({
    sql: "UPDATE users SET email = ? WHERE github_username = ?",
    args: [email, githubUsername],
  });
}

// Get every user who has saved an email address
async function getAllUsers() {
  await ready;
  const result = await client.execute("SELECT * FROM users WHERE email IS NOT NULL");
  return result.rows.map((row) => {
    const user = rowToObject(result, row);
    if (user.access_token) {
      user.access_token = decryptToken(user.access_token);
    }
    return user;
  });
}

// Mute a notification thread for a user
async function muteNotification(githubUsername, notificationId) {
  await ready;
  await client.execute({
    sql: `
      INSERT OR IGNORE INTO muted_notifications (github_username, notification_id)
      VALUES (?, ?)
    `,
    args: [githubUsername, String(notificationId)],
  });
}

// Get all muted notification IDs for a user
async function getMutedIds(githubUsername) {
  await ready;
  const result = await client.execute({
    sql: "SELECT notification_id FROM muted_notifications WHERE github_username = ?",
    args: [githubUsername],
  });
  return result.rows.map((row) => row[0]);
}

// Remove ALL muted notifications for a user (unmute all)
async function unmuteAll(githubUsername) {
  await ready;
  await client.execute({
    sql: "DELETE FROM muted_notifications WHERE github_username = ?",
    args: [githubUsername],
  });
}

module.exports = { client, saveUser, getUser, saveEmail, getAllUsers, muteNotification, getMutedIds, unmuteAll };