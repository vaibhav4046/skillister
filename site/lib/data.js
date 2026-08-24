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

// One upstream fetch a minute at most, so a merged registry change is visible
// almost immediately. Vercel's data cache survives redeploys, so a long TTL
// here means a pushed change stays invisible even after a forced deploy.
export const REVALIDATE = 60;

function ghHeaders() {
  const h = { accept: "application/vnd.github+json", "user-agent": "skillister-site" };
  if (process.env.GITHUB_TOKEN) h.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

/**
 * Registry reads bypass the framework data cache deliberately.
 *
 * Vercel's data cache survives redeployments, so a cached registry entry keeps
 * serving after a merge even through a forced deploy - the site would claim to
 * be live while showing last week's packs. These files are a few kilobytes from
 * a CDN, so fetching them per render is cheap and makes "live" literally true.
 *
 * GitHub API calls keep the cache: they are rate-limited and far less critical.
 */
async function json(url, { fresh = false, ...opts } = {}) {
  try {
    const res = await fetch(url, fresh ? { ...opts, cache: "no-store" } : { ...opts, next: { revalidate: REVALIDATE } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getPacks() {
  return (await json(`${RAW}/registry/packs.json`, { fresh: true })) || { packs: [], rejected: [] };
}

export async function getRoutes() {
  return (await json(`${RAW}/registry/routes.json`, { fresh: true })) || { routes: [] };
}

export async function getBenchmarks() {
  return (await json(`${RAW}/registry/benchmarks.json`, { fresh: true })) || { packs: [], generated: null };
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

export async function getCandidates() {
  return (await json(`${RAW}/registry/candidates.json`, { fresh: true })) || { candidates: [], generated: null };
}

/**
 * Verified discovery.
 *
 * Full-text search alone is not enough: querying GitHub for "agent skills"
 * returns LLM platforms, study guides and admin dashboards whose READMEs merely
 * use the words. The only reliable signal is whether the repository actually
 * contains SKILL.md files, and checking that costs one API call per repository.
 *
 * Reads entirely from data the weekly workflow committed. That workflow runs
 * inside GitHub Actions, which hands it an authenticated token for free, so
 * this page needs no credential of its own and cannot be rate-limited. Forty
 * live calls per render here would have exhausted the anonymous hourly budget
 * on its own and taken the rest of the site down with it.
 */
export async function discover() {
  const { candidates, generated } = await getCandidates();
  return {
    generated,
    items: candidates.map((c) => ({ ...c, url: `https://github.com/${c.repo}` })),
  };
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
