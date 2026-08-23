/**
 * All site data comes from the repository itself, fetched at runtime rather
 * than bundled. Merging a registry pull request updates the site within the
 * revalidate window with no redeploy.
 *
 * GitHub is called unauthenticated by default (60 req/hr, shared). Set
 * GITHUB_TOKEN in the Vercel project for 5000 req/hr. Every fetch degrades to
 * cached or partial data rather than throwing, so the page always renders.
 */

const RAW = "https://raw.githubusercontent.com/vaibhav4046/skillister/main";
const API = "https://api.github.com";

export const REVALIDATE = 1800; // 30 minutes

function ghHeaders() {
  const h = { accept: "application/vnd.github+json", "user-agent": "skillister-site" };
  if (process.env.GITHUB_TOKEN) h.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

async function json(url, opts = {}) {
  try {
    const res = await fetch(url, { ...opts, next: { revalidate: REVALIDATE } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getPacks() {
  return (await json(`${RAW}/registry/packs.json`)) || { packs: [], rejected: [] };
}

export async function getRoutes() {
  return (await json(`${RAW}/registry/routes.json`)) || { routes: [] };
}

export async function getBenchmarks() {
  return (await json(`${RAW}/registry/benchmarks.json`)) || { packs: [], generated: null };
}

/** Live repo facts for one pack. Null when rate-limited, never throws. */
export async function getRepo(repo) {
  return await json(`${API}/repos/${repo}`, { headers: ghHeaders() });
}

/** Live star counts for many packs at once. */
export async function getRepos(repos) {
  const out = {};
  const results = await Promise.all(repos.map((r) => getRepo(r)));
  repos.forEach((r, i) => {
    const d = results[i];
    if (d) out[r] = { stars: d.stargazers_count, forks: d.forks_count, issues: d.open_issues_count, pushedAt: d.pushed_at, license: d.license?.spdx_id || "NONE", description: d.description };
  });
  return out;
}

/**
 * Live search for skill packs not yet in the registry. This is the "actively
 * investigating GitHub" half: the page shows what exists right now, not a list
 * frozen at build time.
 */
export async function discover(known = new Set()) {
  const queries = ["claude code skills", "agent skills"];
  const seen = new Map();

  for (const q of queries) {
    const d = await json(`${API}/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=30`, { headers: ghHeaders() });
    for (const r of d?.items || []) {
      if (known.has(r.full_name.toLowerCase())) continue;
      if (r.stargazers_count < 150) continue;
      if (seen.has(r.full_name)) continue;
      seen.set(r.full_name, {
        repo: r.full_name,
        stars: r.stargazers_count,
        forks: r.forks_count,
        license: r.license?.spdx_id || "NONE",
        pushedAt: r.pushed_at,
        description: r.description || "",
        url: r.html_url,
      });
    }
  }
  return [...seen.values()].sort((a, b) => b.stars - a.stars).slice(0, 40);
}

export function ago(iso) {
  if (!iso) return "unknown";
  const days = Math.floor((Date.now() - Date.parse(iso)) / 864e5);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} mo ago`;
  return `${Math.floor(days / 365)} yr ago`;
}

export function num(n) {
  if (n === undefined || n === null) return "-";
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}
