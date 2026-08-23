#!/usr/bin/env node
/**
 * Weekly discovery: search GitHub for skill repositories that are not already
 * in the registry, and emit a Markdown report for a human to review.
 *
 * It proposes. It does not merge. A firehose of auto-added packs would recreate
 * exactly the problem this project exists to solve.
 *
 * Needs the `gh` CLI, which GitHub Actions provides and authenticates.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const QUERIES = ["claude code skills", "agent skills", "claude skills marketplace", "skills.sh agent"];
const MIN_STARS = 200;
const MAX_SKILLS = 200; // above this a pack is a dump, not a curation
const PER_QUERY = 25;

function gh(args) {
  try {
    return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
}

const packs = JSON.parse(fs.readFileSync(path.join(ROOT, "registry", "packs.json"), "utf8"));
const known = new Set([...packs.packs.map((p) => p.repo), ...packs.rejected.map((r) => r.repo)].map((r) => r.toLowerCase()));

const seen = new Map();
for (const q of QUERIES) {
  const raw = gh(["search", "repos", q, "--sort", "stars", "--limit", String(PER_QUERY), "--json", "fullName,stargazersCount,description,updatedAt"]);
  if (!raw) continue;
  let rows = [];
  try {
    rows = JSON.parse(raw);
  } catch {
    continue;
  }
  for (const r of rows) {
    if (known.has(r.fullName.toLowerCase())) continue;
    if (r.stargazersCount < MIN_STARS) continue;
    if (!seen.has(r.fullName)) seen.set(r.fullName, r);
  }
}

const candidates = [];
for (const [repo, meta] of seen) {
  const branch = gh(["api", `repos/${repo}`, "--jq", ".default_branch"]).trim();
  if (!branch) continue;

  const countRaw = gh(["api", `repos/${repo}/git/trees/${branch}?recursive=1`, "--jq", '[.tree[].path|select(endswith("SKILL.md"))]|length']).trim();
  const skills = Number(countRaw) || 0;
  if (skills === 0) continue; // not a skill pack

  const license = gh(["api", `repos/${repo}`, "--jq", '.license.spdx_id // "NONE"']).trim();
  const hasMarketplace = gh(["api", `repos/${repo}/contents/.claude-plugin/marketplace.json`, "--jq", ".name"]).includes("marketplace.json");

  candidates.push({
    repo,
    stars: meta.stargazersCount,
    skills,
    license,
    hasMarketplace,
    updated: (meta.updatedAt || "").slice(0, 10),
    description: (meta.description || "").slice(0, 120),
    flags: [
      skills > MAX_SKILLS ? `**${skills} skills** - check it is curation, not a dump` : null,
      license === "NONE" ? "**no licence** - all rights reserved, registry only, never vendor" : null,
      /^(CC-BY-SA|GPL|AGPL)/.test(license) ? `**${license}** - copyleft, registry only` : null,
      !hasMarketplace ? "no marketplace.json - needs the local-wrapper install path" : null,
    ].filter(Boolean),
  });
}

candidates.sort((a, b) => b.stars - a.stars);

if (!candidates.length) process.exit(0);

const lines = [
  "## Candidate skill packs",
  "",
  `${candidates.length} repositories not yet in the registry, at least ${MIN_STARS} stars, containing at least one SKILL.md.`,
  "",
  "Nothing here is approved. Read each one, then add the good ones to `registry/packs.json` and the rest to `rejected` with a reason.",
  "",
  "| Repo | Stars | Skills | Licence | Updated |",
  "|---|---|---|---|---|",
];
for (const c of candidates) {
  lines.push(`| [${c.repo}](https://github.com/${c.repo}) | ${c.stars} | ${c.skills} | ${c.license} | ${c.updated} |`);
}
lines.push("");
for (const c of candidates) {
  lines.push(`### ${c.repo}`);
  if (c.description) lines.push(`> ${c.description}`);
  for (const f of c.flags) lines.push(`- ${f}`);
  lines.push("");
}

process.stdout.write(lines.join("\n"));

// Machine-readable form for the site. Every entry here has been verified to
// contain at least one SKILL.md, which full-text search alone cannot tell you:
// searching "agent skills" returns LLM platforms and study guides whose READMEs
// merely use the words.
fs.writeFileSync(
  path.join(ROOT, "registry", "candidates.json"),
  JSON.stringify(
    {
      generated: new Date().toISOString(),
      note: "Verified candidates: each was checked via the git tree API and contains at least one SKILL.md. Presence here is not an endorsement.",
      minStars: MIN_STARS,
      candidates,
    },
    null,
    2,
  ) + "\n",
  "utf8",
);
