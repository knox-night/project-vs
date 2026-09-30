// github.js
// One place for talking to the GitHub notifications API.

async function fetchNotifications(token, days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const response = await fetch(
    `https://api.github.com/notifications?since=${since}&all=true`,
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

  return response.json();
}

module.exports = { fetchNotifications };
