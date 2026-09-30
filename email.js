require("dotenv").config();
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

// Sender must be on a domain verified in Resend, or delivery only works to your own address.
const FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendDigestEmail(toEmail, grouped) {
  const colors = { HIGH: "#f85149", MEDIUM: "#d29922", LOW: "#3fb950" };

  let html = `
    <div style="font-family: -apple-system, Segoe UI, sans-serif; background:#0d1117; color:#c9d1d9; padding:30px; max-width:600px; margin:auto;">
      <h1 style="color:#58a6ff;">Your GitHub Digest</h1>
  `;

  let hasAny = false;

  ["HIGH", "MEDIUM", "LOW"].forEach((level) => {
    if (!grouped[level] || grouped[level].length === 0) return;
    hasAny = true;
    html += `<h2 style="color:${colors[level]}">${level} PRIORITY</h2><ul style="list-style:none;padding:0;">`;
    grouped[level].forEach((item) => {
      const waiting = item.stale ? ` &middot; <b style="color:#f85149;">waiting ${item.daysOld}d</b>` : "";
      html += `<li style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:12px 16px;margin-bottom:10px;">
                 <b style="color:#e6edf3;">${escapeHtml(item.title)}</b> (${escapeHtml(item.repo)})${waiting}<br>Why: ${escapeHtml(item.why)}
               </li>`;
    });
    html += "</ul>";
  });

  if (!hasAny) {
    html += "<p>No new notifications in the last 7 days.</p>";
  }

  html += "</div>";

  const result = await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: "Your GitHub Digest",
    html: html,
  });

  // Resend returns { data, error } instead of throwing, so surface failures ourselves.
  if (result.error) {
    throw new Error(`Resend error: ${result.error.message || JSON.stringify(result.error)}`);
  }

  return result;
}

module.exports = { sendDigestEmail };
