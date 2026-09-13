const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

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
      html += `<li style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:12px 16px;margin-bottom:10px;">
                 <b style="color:#e6edf3;">${item.title}</b> (${item.repo})<br>Why: ${item.why}
               </li>`;
    });
    html += "</ul>";
  });

  if (!hasAny) {
    html += "<p>No new notifications in the last 7 days.</p>";
  }

  html += "</div>";

  const result = await resend.emails.send({
    from: "onboarding@resend.dev",
    to: toEmail,
    subject: "Your GitHub Digest",
    html: html,
  });

  return result;
}

module.exports = { sendDigestEmail };