// All page looks live here. server.js just calls these functions.
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "sigmaboy789265@gmail.com";
function esc(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

const HEAD = `
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230a1b24'/%3E%3Ccircle cx='16' cy='16' r='11' fill='none' stroke='%231f4352' stroke-width='2'/%3E%3Cpath d='M16 16 L25.5 10.5 A11 11 0 0 1 25.5 21.5 Z' fill='%23ffd479' opacity='.8'/%3E%3Ccircle cx='16' cy='16' r='3.5' fill='%23ffd479'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{--night:#0a1b24;--panel:#0f2833;--panel2:#143341;--line:#1f4352;--foam:#e8f1ee;--mist:#93adb4;--lamp:#ffd479;--flare:#ff6a4d;--amber:#ffb84d;--kelp:#46c08f}
*{box-sizing:border-box}
html{background:var(--night)}
body{margin:0;background:var(--night);color:var(--foam);font-family:"Instrument Sans",system-ui,sans-serif;line-height:1.6;font-size:16px}
a{color:inherit}
:focus-visible{outline:2px solid var(--lamp);outline-offset:3px;border-radius:4px}
h1,h2{font-family:Fraunces,Georgia,serif;font-weight:700;letter-spacing:-.02em;line-height:1.1;margin:0}
.wrap{max-width:1040px;margin:0 auto;padding:0 24px}
.top{display:flex;align-items:center;justify-content:space-between;padding:22px 0}
.brand{display:flex;align-items:center;gap:10px;font-family:Fraunces,serif;font-weight:700;font-size:20px;text-decoration:none}
.brand svg{width:26px;height:26px}
.toplink{color:var(--mist);font-size:14px;text-decoration:none}
.toplink:hover{color:var(--foam)}
.btn{display:inline-block;background:var(--lamp);color:#2a1d00;font-weight:600;text-decoration:none;padding:14px 26px;border-radius:999px;border:0;font:600 16px "Instrument Sans",sans-serif;cursor:pointer;transition:transform .15s,box-shadow .15s}
.btn:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(255,212,121,.3)}
.hero{display:grid;grid-template-columns:1.1fr .9fr;gap:48px;align-items:center;padding:56px 0 72px}
.hero h1{font-size:clamp(38px,6vw,64px);margin-bottom:20px}
.lede{color:var(--mist);font-size:18px;max-width:30em;margin:0 0 30px}
.fine{color:var(--mist);font-size:13.5px;margin:14px 0 0}
.scene{position:relative;width:min(100%,360px);aspect-ratio:1;margin:0 auto;border-radius:50%;border:1px solid var(--line);overflow:hidden;background:repeating-radial-gradient(circle,transparent 0 44px,var(--line) 44px 45px),var(--panel)}
.beam{position:absolute;inset:0;background:conic-gradient(from 0deg,transparent 0 280deg,rgba(255,212,121,.5) 360deg);animation:sweep 7s linear infinite}
.lamp{position:absolute;left:50%;top:50%;width:14px;height:14px;margin:-7px;border-radius:50%;background:var(--lamp);box-shadow:0 0 24px 6px rgba(255,212,121,.6)}
.blip{position:absolute;width:12px;height:12px;border-radius:50%;animation:pulse 3.5s ease-in-out infinite}
.b1{left:68%;top:22%;background:var(--flare);box-shadow:0 0 16px 4px rgba(255,106,77,.7)}
.b2{left:24%;top:40%;background:var(--amber);box-shadow:0 0 14px 3px rgba(255,184,77,.6);animation-delay:1.2s}
.b3{left:58%;top:76%;background:var(--kelp);box-shadow:0 0 12px 3px rgba(70,192,143,.5);animation-delay:2.2s}
@keyframes sweep{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:.35;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}}
.sample{border-top:1px solid var(--line);padding:56px 0}
.sample h2,.points h2{font-size:30px;margin-bottom:24px}
.points{border-top:1px solid var(--line);padding:56px 0 40px}
.pgrid{display:grid;grid-template-columns:1fr 1fr;gap:36px 56px}
.pgrid h3{font-size:17px;margin:0 0 6px;font-weight:600}
.pgrid p{margin:0;color:var(--mist);max-width:28em}
.foot{border-top:1px solid var(--line);padding:28px 0 56px;color:var(--mist);font-size:13.5px}
.foot nav{display:flex;flex-wrap:wrap;gap:8px 22px;margin-top:12px}
.foot a{color:var(--lamp)}
/* sample dashboard */
.mock{border:1px solid var(--line);border-radius:18px;background:var(--panel);overflow:hidden}
.mockbar{display:flex;justify-content:space-between;gap:4px 16px;flex-wrap:wrap;padding:14px 20px;border-bottom:1px solid var(--line);background:var(--panel2);font-size:14px;color:var(--mist)}
.mockbar strong{color:var(--foam);font-weight:600}
.mock .group{margin:0;padding:4px 20px 0;opacity:.9}
.mock .group h2{font-size:17px;padding-top:10px}
.mock .group .rows{border-top:0;margin-top:0}
.mock .row{padding:14px 0}
.mockbar a{color:var(--lamp)}
.badge{display:inline-block;margin-right:10px;background:var(--panel);border:1px solid var(--line);color:var(--lamp);font-size:12px;font-weight:600;padding:1px 9px;border-radius:999px}
.mock .group:last-child .row:last-child{border-bottom:0}
.mock .mute{display:inline-block;pointer-events:none}
/* comparison */
.vs{border-top:1px solid var(--line);padding:56px 0}
.vs h2,.data h2{font-size:30px;margin-bottom:10px}
.sub{color:var(--mist);max-width:36em;margin:0 0 28px}
.sub a{color:var(--lamp)}
.vstable{overflow-x:auto;border:1px solid var(--line);border-radius:18px;background:var(--panel)}
.vs table{width:100%;border-collapse:collapse;min-width:540px}
.vs th,.vs td{text-align:left;padding:14px 18px;border-top:1px solid var(--line);font-size:15px;vertical-align:top}
.vs thead th{border-top:0;background:var(--panel2);font-weight:600}
.vs thead th:last-child{color:var(--lamp)}
.vs tbody th{font-weight:600;white-space:nowrap}
.vs td{color:var(--mist)}
.vs td:last-child{color:var(--foam)}
/* permissions and data */
.data{border-top:1px solid var(--line);padding:56px 0 40px}
.facts{margin:0;display:grid;grid-template-columns:1fr 1fr;gap:28px 56px}
.facts dt{font-weight:600;font-size:17px;margin:0 0 6px}
.facts dd{margin:0;color:var(--mist);max-width:30em}
.facts code{background:var(--panel2);padding:1px 6px;border-radius:6px;font-size:.88em;color:var(--foam)}
/* digest rows */
.rows{list-style:none;margin:0;padding:0}
.row{display:grid;grid-template-columns:14px 1fr auto;gap:16px;padding:18px 0;border-bottom:1px solid var(--line)}
.row .dot{width:10px;height:10px;border-radius:50%;margin-top:8px}
.high .dot{background:var(--flare);box-shadow:0 0 12px 3px rgba(255,106,77,.55)}
.medium .dot{background:var(--amber);box-shadow:0 0 10px 2px rgba(255,184,77,.45)}
.low .dot{background:var(--kelp);box-shadow:0 0 8px 2px rgba(70,192,143,.35)}
.title{font-weight:600;font-size:16.5px}
.repo{display:inline-block;margin-left:8px;color:var(--mist);font-size:13px;background:var(--panel2);padding:1px 8px;border-radius:999px}
.wait{display:inline-block;margin-left:8px;color:#2b0a03;background:var(--flare);font-size:12px;font-weight:600;padding:1px 8px;border-radius:999px}
.why{margin:4px 0 0;color:var(--mist);font-size:15px;max-width:42em}
.mute{background:none;border:1px solid var(--line);color:var(--mist);padding:6px 14px;border-radius:999px;font:500 13px "Instrument Sans",sans-serif;cursor:pointer}
.actions{display:flex;gap:8px;align-items:flex-start}
.mute:hover{color:var(--foam);border-color:var(--mist)}
/* dashboard */
.dash{max-width:760px;margin:0 auto;padding:0 24px 80px}
.dash h1{font-size:clamp(32px,5vw,44px);margin:28px 0 8px}
.summary{color:var(--mist);margin:0 0 32px;font-size:17px}
.group{margin-top:36px}
.group h2{font-size:22px;display:flex;align-items:baseline;gap:10px}
.group h2 small{font:500 14px "Instrument Sans",sans-serif;color:var(--mist)}
.group .rows{margin-top:6px;border-top:1px solid var(--line)}
.mailbar{margin-top:44px;padding:22px;border:1px solid var(--line);border-radius:18px;background:var(--panel)}
.mailbar p{margin:0 0 12px;color:var(--mist);font-size:15px}
.mailbar form{display:flex;flex-wrap:wrap;gap:10px}
.mailbar input{flex:1 1 220px;min-width:0;background:var(--night);border:1px solid var(--line);color:var(--foam);padding:11px 16px;border-radius:999px;font:400 15px "Instrument Sans",sans-serif}
.mailbar .btn{padding:11px 22px;font-size:15px}
.ok{color:var(--kelp);margin:10px 0 0;font-size:14px}
.mutedbar{display:flex;justify-content:space-between;align-items:center;margin-top:32px;color:var(--mist);font-size:14px}
.linkbtn{background:none;border:0;color:var(--lamp);cursor:pointer;font:500 14px "Instrument Sans",sans-serif;text-decoration:underline}
.empty{margin-top:28px;padding:32px;border:1px dashed var(--line);border-radius:18px;color:var(--mist)}
.empty h2{font-size:22px;color:var(--foam);margin-bottom:8px}
.loading{text-align:center;padding:120px 0;color:var(--mist)}
.mini{position:relative;width:84px;height:84px;margin:0 auto 20px;border-radius:50%;border:1px solid var(--line);overflow:hidden;background:var(--panel)}
.mini .beam{animation-duration:2.4s}
.err{text-align:center;padding:90px 0}
.err h2{font-size:26px;margin-bottom:10px}
.row.more,.group.more{display:none}
.loadmore{text-align:center;margin-top:32px}
@media(max-width:820px){.hero{grid-template-columns:1fr;padding:32px 0 48px;gap:36px}.pgrid,.facts{grid-template-columns:1fr}.row{grid-template-columns:14px 1fr}.row .actions{grid-column:2}}
@media(prefers-reduced-motion:reduce){.beam,.blip{animation:none}.blip{opacity:1}.btn{transition:none}}
</style>`;

const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" fill="none" stroke="#1f4352" stroke-width="2"/><path d="M16 16 L28 9 A14 14 0 0 1 28 23 Z" fill="#ffd479" opacity=".75"/><circle cx="16" cy="16" r="3.5" fill="#ffd479"/></svg>`;

function page(title, body) {
  return `<!doctype html><html lang="en"><head><title>${esc(title)}</title>${HEAD}</head><body>${body}</body></html>`;
}

function landing(loggedIn) {
  const cta = loggedIn
    ? `<a class="btn" href="/dashboard">Open your digest</a><p class="fine">You're signed in.</p>`
    : `<a class="btn" href="/auth/github">Log in with GitHub</a><p class="fine">Free during early access. We only ask to read your notifications and basic profile, never your code.</p>`;
  // Sample digest. Summaries only say what the summarizer can really know (title, type, reason, repo).
  const mockGroups = [
    ["high", "Needs you now", [
      ["Review requested: Fix login redirect", "acme/web", "You were asked to review this pull request. Check the login redirect change.", "Waiting 3d"],
      ["CI failed on feature/billing", "acme/api", "A check failed on the billing branch. Open the run to see what broke, then fix or re-run it.", ""],
    ]],
    ["medium", "Worth a look today", [
      ["Mentioned in Rate limit headers", "acme/api", "You were mentioned in this issue. No direct question is asked of you.", ""],
    ]],
    ["low", "Can wait", [
      ["New comment on Update README", "acme/docs", "A thread you follow has activity. Nothing is asked of you.", ""],
    ]],
  ];
  const mockRows = mockGroups.map(([cls, label, items]) =>
    `<section class="group"><h2>${label} <small>${items.length}</small></h2><ul class="rows">` +
    items.map(i => `<li class="row ${cls}"><span class="dot"></span><div><span class="title">${i[0]}</span><span class="repo">${i[1]}</span>${i[3] ? `<span class="wait">${i[3]}</span>` : ""}<p class="why">${i[2]}</p></div><div class="actions"><span class="mute">Done</span><span class="mute">Mute</span></div></li>`).join("") +
    `</ul></section>`
  ).join("");
  return page("GitHub Digest: the signal in your notifications", `
<div class="wrap">
  <header class="top"><a class="brand" href="/">${LOGO}GitHub Digest</a>${loggedIn ? '<a class="toplink" href="/logout">Log out</a>' : '<a class="toplink" href="/auth/github">Log in</a>'}</header>
  <section class="hero">
    <div>
      <h1>Your GitHub inbox, swept for what needs you.</h1>
      <p class="lede">GitHub Digest reads your notifications and sorts them by what is actually waiting on you. Review requests and failed builds come first. Everything else can wait.</p>
      ${cta}
    </div>
    <div class="scene" role="img" aria-label="A lighthouse beam sweeping across three notifications"><div class="beam"></div><span class="blip b1"></span><span class="blip b2"></span><span class="blip b3"></span><span class="lamp"></span></div>
  </section>
  <section class="sample"><h2>What your morning looks like</h2><div class="mock" role="group" aria-label="Sample digest, not real data"><div class="mockbar"><span><span class="badge">Example</span><strong>A sample digest, not real data</strong></span>${loggedIn ? '<a href="/dashboard">Open yours</a>' : '<a href="/auth/github">Log in to see yours</a>'}</div>${mockRows}</div></section>
  <section class="points"><h2>Built to cut the noise</h2><div class="pgrid">
    <div><h3>See what is waiting on you</h3><p>Reviews and mentions that sit untouched for 2 days or more get flagged.</p></div>
    <div><h3>Sorted by real priority</h3><p>Review requests and failed builds rise to the top. Passive activity stays out of the way.</p></div>
    <div><h3>Plain-English summaries</h3><p>Each thread gets a short note on what it is actually asking of you.</p></div>
    <div><h3>Mute a thread for good</h3><p>One click and a thread you don't care about stops showing up. Unmute all whenever you like.</p></div>
  </div></section>
  <section class="vs"><h2>Why not GitHub's own inbox?</h2><p class="sub">GitHub's inbox lists activity as it happens. GitHub Digest works out what is waiting on you and puts that first.</p>
    <div class="vstable"><table>
      <thead><tr><th scope="col"><span class="sr" style="position:absolute;left:-9999px">Feature</span></th><th scope="col">GitHub inbox</th><th scope="col">GitHub Digest</th></tr></thead>
      <tbody>
        <tr><th scope="row">Order</th><td>Newest activity first, plus filters you set up yourself</td><td>Review requests, questions and failed builds first</td></tr>
        <tr><th scope="row">Left waiting</th><td>No flag for threads that sit untouched</td><td>Flagged after 2 days</td></tr>
        <tr><th scope="row">What a thread wants</th><td>Open it to find out</td><td>A plain-English note on your most urgent threads</td></tr>
        <tr><th scope="row">Noise</th><td>Unsubscribe or mark done one thread at a time</td><td>Mute a thread, unmute everything in one click</td></tr>
      </tbody>
    </table></div></section>
  <section class="data"><h2>What we access and what we keep</h2><p class="sub">You log in with GitHub OAuth. Here is what happens with that access. The full policy is on the <a href="/privacy">privacy page</a>.</p>
    <dl class="facts">
      <div><dt>Permissions</dt><dd><code>read:user</code> for your username and <code>notifications</code> to read your notification list. The Done button uses it to mark a thread done on GitHub. We never ask for repository access, so your code stays out of reach.</dd></div>
      <div><dt>AI summaries</dt><dd>For your most urgent threads (up to 20), the title, type, reason and repo name go to Google Gemini. Never thread contents, your token or your email.</dd></div>
      <div><dt>What we store</dt><dd>Your GitHub username, your access token (encrypted), the IDs of threads you mute, and your email if you save one. Notifications are fetched live and their content is not kept in our database.</dd></div>
      <div><dt>Leaving</dt><dd>Revoke access any time in GitHub under Settings, Applications. To delete what we store, email us and it is removed.</dd></div>
    </dl></section>
  <footer class="foot">Early access. Everything is free while this grows. Built by one person, so expect rough edges, and feedback is welcome.
    <nav aria-label="Footer"><a href="mailto:${esc(CONTACT_EMAIL)}">Email feedback</a><a href="/privacy">Privacy</a></nav></footer>
</div>`);
}

function dashboardShell(username) {
  return page("Your digest", `
<div class="dash">
  <header class="top" style="padding-left:0;padding-right:0"><a class="brand" href="/">${LOGO}GitHub Digest</a><span><span class="toplink" style="margin-right:14px">${esc(username)}</span><a class="toplink" href="/logout">Log out</a></span></header>
  <div id="content" class="loading"><div class="mini"><div class="beam"></div><span class="lamp"></span></div>Sweeping your notifications…</div>
</div>
<script>
fetch('/dashboard-data'+window.location.search).then(function(r){if(r.redirected){window.location.href=r.url;return null}return r.text()}).then(function(h){if(h!==null)document.getElementById('content').outerHTML=h}).catch(function(){document.getElementById('content').innerHTML='<div class="err"><h2>The digest did not load.</h2><a class="btn" href="/dashboard">Try again</a></div>'});
</script>`);
}

const PAGE_SIZE = 10;

function digestHtml(o) {
  const g = o.grouped;
  const hi = g.HIGH.length, me = g.MEDIUM.length, lo = g.LOW.length;
  const summary = o.total === 0 ? "Nothing new in the last 7 days."
    : hi > 0 ? `${hi} ${hi === 1 ? "thread needs" : "threads need"} you now. ${me + lo} can wait.`
    : `Nothing urgent. ${me + lo} ${me + lo === 1 ? "thread" : "threads"} to look at when you have time.`;
  const meta = { HIGH: ["high", "Needs you now"], MEDIUM: ["medium", "Worth a look today"], LOW: ["low", "Can wait"] };
  let groups = "";
  let shown = 0;
  ["HIGH", "MEDIUM", "LOW"].forEach(level => {
    if (!g[level].length) return;
    const m = meta[level];
    const hideGroup = shown >= PAGE_SIZE;
    groups += `<section class="group${hideGroup ? " more" : ""}"><h2>${m[1]} <small>${g[level].length}</small></h2><ul class="rows">`;
    g[level].forEach(item => {
      const hide = shown >= PAGE_SIZE;
      shown++;
            groups += `<li class="row ${m[0]}${hide ? " more" : ""}"><span class="dot"></span><div><span class="title">${esc(item.title)}</span><span class="repo">${esc(item.repo)}</span>${item.stale ? `<span class="wait">Waiting ${item.daysOld}d</span>` : ""}<p class="why">${esc(item.why)}</p></div><div class="actions"><form action="/done" method="POST"><input type="hidden" name="id" value="${esc(item.id)}"><button class="mute" type="submit">Done</button></form><form action="/mute" method="POST"><input type="hidden" name="id" value="${esc(item.id)}"><button class="mute" type="submit">Mute</button></form></div></li>`;
      });
            groups += `</ul></section>`;
  });
  const loadMore = shown > PAGE_SIZE
    ? `<div class="loadmore"><button class="btn" type="button" onclick="var r=document.querySelectorAll('.row.more');for(var i=0;i<${PAGE_SIZE}&&i<r.length;i++){r[i].classList.remove('more');var s=r[i].closest('.group');if(s)s.classList.remove('more')}if(r.length<=${PAGE_SIZE})this.parentNode.remove()">Load more</button></div>`
    : "";
  const empty = o.total === 0 ? `<div class="empty"><h2>All quiet</h2><p>When GitHub sends review requests, mentions, comments or failed builds, they appear here sorted by what needs you. Daily email is coming soon.</p></div>` : "";
  const muted = o.mutedCount > 0 ? `<div class="mutedbar"><span>${o.mutedCount} ${o.mutedCount === 1 ? "thread" : "threads"} muted</span><form action="/unmute-all" method="POST"><button class="linkbtn" type="submit">Unmute all</button></form></div>` : "";
  return `<div id="content">
  <h1>Your digest</h1><p class="summary">${summary}</p>
  ${empty}${groups}${loadMore}${muted}
  <div class="mailbar"><p>Daily email is coming soon. Save your email now and it switches on when it's ready.</p>
    <form action="/save-email" method="POST"><input type="email" name="email" placeholder="you@example.com" value="${esc(o.email)}" aria-label="Email address" required><button class="btn" type="submit">Save email</button></form>
    ${o.saved ? '<p class="ok">Email saved.</p>' : ""}</div>
</div>`;
}
function errorHtml() {
  return `<div id="content" class="err"><h2>We could not fetch your digest.</h2><p style="color:var(--mist)">GitHub may be slow right now.</p><a class="btn" href="/dashboard">Try again</a></div>`;
}

module.exports = { landing, dashboardShell, digestHtml, errorHtml };
