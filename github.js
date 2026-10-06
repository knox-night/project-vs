// github.js
// One place for talking to the GitHub notifications API.

async function fetchNotifications(token, days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const PER_PAGE = 50; // GitHub's maximum per request
  const MAX_PAGES = 3; // up to 150 notifications in total
  const all = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const response = await fetch(
      `https://api.github.com/notifications?since=${since}&per_page=${PER_PAGE}&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      const err = new Error(`GitHub API error ${response.status}: ${errorText}`);
      err.status = response.status;
      throw err;
    }

    const batch = await response.json();
    all.push(...batch);
    if (batch.length < PER_PAGE) break; // no more pages
  }

  return all;
}
async function markThreadDone(token, id) {
  const response = await fetch(`https://api.github.com/notifications/threads/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`GitHub API error ${response.status}`);
  }
}

module.exports = { fetchNotifications, markThreadDone };