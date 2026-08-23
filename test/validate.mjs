#!/usr/bin/env node
/**
 * Static validation. Runs on every pull request, needs no API key and no
 * network. Everything here is a hard failure: a broken registry entry that
 * merges is a broken install for whoever runs it next.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "../src/index.mjs";
import { compile } from "../src/router.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

let failures = 0;
let checks = 0;

function check(ok, label, detail = "") {
  checks++;
  if (!ok) {
    failures++;
    console.error(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
  }
}

/* ------------------------------------------------------------------- packs */

console.log("packs.json");
const packs = read(path.join(ROOT, "registry", "packs.json"));
check(packs.schema === 1, "schema version is 1");
check(Array.isArray(packs.packs) && packs.packs.length > 0, "has at least one pack");

const seenIds = new Set();
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const INSTALL_TYPES = new Set(["claude-marketplace", "claude-local-wrapper", "git-clone"]);

for (const p of packs.packs) {
  const at = `pack "${p.id}"`;
  check(!!p.id, `${at} has an id`);
  check(!seenIds.has(p.id), `${at} id is unique`);
  seenIds.add(p.id);
  check(REPO_RE.test(p.repo || ""), `${at} repo is owner/name`, p.repo);
  check(!!p.license, `${at} declares a licence`);
  check(typeof p.redistributable === "boolean", `${at} declares redistributable`);
  check(!!p.summary && p.summary.length > 20, `${at} has a real summary`);
  check(Array.isArray(p.tags) && p.tags.length > 0, `${at} has tags`);
  check(INSTALL_TYPES.has(p.install?.type), `${at} install.type is known`, p.install?.type);
  if (p.install?.type === "claude-local-wrapper") {
    check(/^https:\/\/.+\.git$/.test(p.install.url || ""), `${at} wrapper url is an https .git url`, p.install.url);
    check(!!p.install.why, `${at} explains why it needs a wrapper`);
  }
  // A pack that cannot be redistributed must say so where a reader will see it.
  if (p.redistributable === false) {
    check(!!p.caution, `${at} is non-redistributable and carries a caution note`);
  }
}

/* ------------------------------------------------------------------ routes */

console.log("routes.json");
const routes = read(path.join(ROOT, "registry", "routes.json"));
check(routes.schema === 1, "schema version is 1");

const seenRouteIds = new Set();
for (const r of routes.routes) {
  const at = `route "${r.id}"`;
  check(!!r.id, `${at} has an id`);
  check(!seenRouteIds.has(r.id), `${at} id is unique`);
  seenRouteIds.add(r.id);
  check(Array.isArray(r.skills) && r.skills.length > 0, `${at} names at least one skill`);
  check(!!r.advice && r.advice.length > 20, `${at} has real advice`);

  for (const key of ["match", "suppress"]) {
    if (!r[key]) continue;
    try {
      new RegExp(r[key], "i");
    } catch (e) {
      check(false, `${at} ${key} is a valid regex`, e.message);
    }
  }

  check(!!r.evals?.should?.length, `${at} declares eval prompts that must fire it`);
  check(!!r.evals?.shouldNot?.length, `${at} declares eval prompts that must not fire it`);
}

// A route that can never lose to another is fine; a route that never wins is dead weight.
check(routes.routes.length === seenRouteIds.size, "no duplicate route ids");
try {
  compile(routes.routes);
  check(true, "all routes compile");
} catch (e) {
  check(false, "all routes compile", e.message);
}

/* ------------------------------------------------------------------ skills */

console.log("skills/");
const skillsDir = path.join(ROOT, "skills");
const skillFiles = fs
  .readdirSync(skillsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => path.join(skillsDir, d.name, "SKILL.md"));

check(skillFiles.length > 0, "ships at least one first-party skill");
for (const f of skillFiles) {
  const rel = path.relative(ROOT, f);
  check(fs.existsSync(f), `${rel} exists`);
  if (!fs.existsSync(f)) continue;
  const fm = parseFrontmatter(f);
  check(!!fm, `${rel} has parseable frontmatter`);
  check(!!fm?.name, `${rel} declares a name`);
  check(!!fm?.description && fm.description.length > 40, `${rel} description is substantial enough to route on`);
  check(fm?.name === path.basename(path.dirname(f)), `${rel} name matches its directory`);
}

/* -------------------------------------------------------------------- docs */

console.log("docs");
for (const f of ["README.md", "LICENSE", "CONTRIBUTING.md", "docs/usage.txt", "adapters/AGENTS.snippet.md"]) {
  check(fs.existsSync(path.join(ROOT, f)), `${f} exists`);
}

// Every pack in the registry must be linked from the README, or nobody finds it.
const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
for (const p of packs.packs) {
  check(readme.includes(p.repo), `README links ${p.repo}`);
}

/* ------------------------------------------------------------------ report */

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) {
  console.error(`${failures} failing`);
  process.exit(1);
}
