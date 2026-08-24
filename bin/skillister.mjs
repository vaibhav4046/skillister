#!/usr/bin/env node
/**
 * skillister - find, route, and install agent skills across any agent CLI.
 *
 *   skillister index            build the skill index from every detected host
 *   skillister find <query>     rank installed skills against a query
 *   skillister route <prompt>   show which skills a prompt should trigger
 *   skillister packs            list registry packs
 *   skillister install <id>     install a pack from its own upstream repository
 *   skillister init [host]      wire skillister into a host CLI
 *   skillister stats            index breakdown by collection
 *   skillister doctor           check the install and report problems
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { execFileSync } from "node:child_process";

import { build, find } from "../src/index.mjs";
import { compile, route, render } from "../src/router.mjs";
import { resolveRoots, detectHosts, skillisterHome, indexPath } from "../src/roots.mjs";
import { auditPack, formatAudit } from "../src/audit.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

const packsFile = () => path.join(ROOT, "registry", "packs.json");
const routesFile = () => path.join(ROOT, "registry", "routes.json");

/**
 * Skills bundled inside a host CLI with no SKILL.md on disk. Without these the
 * index would report them missing, and "not indexed means not installed" would
 * be a false statement.
 */
const BUILTINS = [
  { name: "dataviz", description: "Charts, graphs, plots, dashboards, data visualization." },
  { name: "artifact-design", description: "Design guidance and fundamentals for Artifacts." },
  { name: "simplify", description: "Review changed code for reuse, simplification, and efficiency." },
  { name: "run", description: "Launch and drive this project's app to see a change working." },
  { name: "claude-api", description: "Claude API and SDK reference: models, streaming, tool use, MCP." },
];

function loadIndex({ rebuild = false } = {}) {
  const p = indexPath();
  if (!rebuild && fs.existsSync(p)) {
    try {
      return read(p);
    } catch {
      /* fall through to a rebuild */
    }
  }
  return buildIndex();
}

function buildIndex() {
  const roots = resolveRoots();
  const index = build(roots, BUILTINS);
  fs.mkdirSync(skillisterHome(), { recursive: true });
  fs.writeFileSync(indexPath(), JSON.stringify(index), "utf8");
  return index;
}

function fmt(sk) {
  const tag = sk.plugin ? `${sk.plugin}:${sk.name}` : sk.name;
  return `${tag.padEnd(38)} ${(sk.description || "").slice(0, 110)}`;
}

function sh(cmd, args) {
  return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/**
 * Live repo facts. Uses the gh CLI when present (authenticated, 5000 req/hr),
 * falls back to the public API (60 req/hr), and returns {} rather than
 * throwing when neither is available - an audit without stars is still a
 * useful audit.
 */
function repoMeta(repo) {
  try {
    const raw = sh("gh", ["api", `repos/${repo}`, "--jq", "{stars:.stargazers_count,forks:.forks_count,issues:.open_issues_count,license:(.license.spdx_id // \"NONE\"),pushedAt:.pushed_at,description:.description}"]);
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------ install */

function installPack(id) {
  const { packs } = read(packsFile());
  const pack = packs.find((p) => p.id === id || p.repo === id);
  if (!pack) {
    console.error(`No pack "${id}". Run \`skillister packs\` to list them.`);
    process.exit(1);
  }

  console.log(`${pack.name}  (${pack.license})`);
  if (pack.caution) console.log(`  caution: ${pack.caution}`);

  const { install } = pack;
  if (install.type === "claude-marketplace") {
    console.log(`\n  claude plugin marketplace add ${install.ref}`);
    if (install.plugin && install.plugin !== "*") {
      console.log(`  claude plugin install ${install.plugin}@${install.ref.split("/")[1] || install.ref}`);
    } else {
      console.log(`  claude plugin install <plugin>@<marketplace>   # pick from the pack, do not take all of it`);
    }
    if (pack.recommended?.length) console.log(`\n  recommended: ${pack.recommended.join(", ")}`);
  } else if (install.type === "claude-local-wrapper") {
    console.log(`\n  This repo needs the local-wrapper install path.`);
    if (install.why) console.log(`  why: ${install.why}`);
    console.log(`\n  skillister wrapper add ${pack.id} ${install.url} ${install.ref || "main"}`);
  } else if (install.type === "git-clone") {
    console.log(`\n  git clone --depth=1 ${install.url} <your-skills-dir>/${pack.id}`);
  }
  console.log(`\n  source: https://github.com/${pack.repo}`);
}

/**
 * Claude Code cannot add a marketplace for a repo that has no
 * .claude-plugin/marketplace.json, and resolves `source: github` over SSH,
 * which fails on machines without a GitHub host key. A local wrapper
 * marketplace with an explicit HTTPS url source sidesteps both.
 */
function wrapperAdd(id, url, ref = "main") {
  const dir = path.join(process.env.HOME || process.env.USERPROFILE, ".claude", "local-marketplaces", "skillister");
  const file = path.join(dir, ".claude-plugin", "marketplace.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });

  let mp = { $schema: "https://anthropic.com/claude-code/marketplace.schema.json", name: "skillister-wrappers", owner: { name: "skillister" }, plugins: [] };
  if (fs.existsSync(file)) mp = read(file);

  if (!mp.plugins.some((p) => p.name === id)) {
    mp.plugins.push({ name: id, description: `Installed via skillister from ${url}`, source: { source: "url", url, ref } });
    fs.writeFileSync(file, JSON.stringify(mp, null, 2), "utf8");
  }

  console.log(`wrapper marketplace: ${file}`);
  console.log(`\nNow run:\n  claude plugin marketplace add ${dir}\n  claude plugin install ${id}@skillister-wrappers`);
}

/* -------------------------------------------------------------------- init */

function init(host = "claude-code") {
  const hooks = path.join(ROOT, "adapters", "claude-code");
  if (host !== "claude-code") {
    console.log(`Generic setup for ${host}:`);
    console.log(`  Add this to your agent instructions file (AGENTS.md, .cursorrules, GEMINI.md):\n`);
    console.log(fs.readFileSync(path.join(ROOT, "adapters", "AGENTS.snippet.md"), "utf8"));
    return;
  }
  console.log(`Claude Code setup. Add to ~/.claude/settings.json:\n`);
  console.log(
    JSON.stringify(
      {
        hooks: {
          SessionStart: [{ hooks: [{ type: "command", command: `node "${path.join(hooks, "session-start.mjs")}"`, timeout: 15 }] }],
          UserPromptSubmit: [{ hooks: [{ type: "command", command: `node "${path.join(hooks, "user-prompt-submit.mjs")}"`, timeout: 3 }] }],
        },
      },
      null,
      2,
    ),
  );
  console.log(`\nThen: node ${path.join(ROOT, "bin", "skillister.mjs")} index`);
}

/* ------------------------------------------------------------------ doctor */

function doctor() {
  const hosts = detectHosts();
  const roots = resolveRoots();
  const index = loadIndex();
  const { routes } = read(routesFile());
  const have = new Set(index.skills.map((s) => s.name));

  const routed = new Set();
  for (const r of routes) for (const s of r.skills) routed.add(s);
  const missing = [...routed].filter((s) => !have.has(s));

  console.log(`hosts detected : ${hosts.join(", ") || "none"}`);
  console.log(`roots scanned  : ${roots.length}`);
  console.log(`skills indexed : ${index.count}`);
  console.log(`index built    : ${index.built}`);
  console.log(`routes         : ${routes.length}`);
  console.log(`routed skills  : ${routed.size} (${missing.length} not installed)`);
  if (missing.length) {
    console.log(`\nRoutes point at skills you have not installed:\n  ${missing.join(", ")}`);
    console.log(`Install the packs that provide them: skillister packs`);
  }
  const top = Object.entries(index.sizes).sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log(`\nlargest collections:`);
  for (const [k, v] of top) console.log(`  ${String(v).padStart(5)}  ${k}`);
}

/* --------------------------------------------------------------------- cli */

const [, , cmd, ...rest] = process.argv;

switch (cmd) {
  case "index":
  case "build": {
    const i = buildIndex();
    console.log(`indexed ${i.count} skills from ${resolveRoots().length} roots -> ${indexPath()}`);
    break;
  }
  case "find": {
    const naive = rest.includes("--naive");
    const q = rest.filter((a) => a !== "--naive").join(" ");
    const hits = find(loadIndex(), q, 12, { naive });
    if (!hits.length) console.log("(no matching skill)");
    else hits.forEach((h) => console.log(fmt(h)));
    break;
  }
  case "compare": {
    // Side by side proof that the ranking does something. Same index, same
    // query, only the scorer changes.
    const index = loadIndex();
    const q = rest.join(" ");
    const naive = find(index, q, 3, { naive: true });
    const ranked = find(index, q, 3);
    const col = (sk) => `${(sk.plugin ? `${sk.plugin}:${sk.name}` : sk.name).slice(0, 44)}`;
    console.log(`query: "${q}"\n`);
    console.log(`  naive (substring count)                      skillister (coverage + specificity prior)`);
    console.log(`  ${"-".repeat(44)}     ${"-".repeat(44)}`);
    for (let i = 0; i < 3; i++) {
      const l = naive[i] ? col(naive[i]) : "";
      const r = ranked[i] ? col(ranked[i]) : "";
      console.log(`  ${l.padEnd(44)}     ${r}`);
    }
    const sizes = index.sizes;
    if (naive[0] && ranked[0] && naive[0].name !== ranked[0].name) {
      console.log(
        `\n  naive picked from "${naive[0].collection}" (${sizes[naive[0].collection]} skills), ` +
          `skillister picked from "${ranked[0].collection}" (${sizes[ranked[0].collection]} skills).`,
      );
    }
    break;
  }
  case "route": {
    const { routes } = read(routesFile());
    const out = render(route(compile(routes), rest.join(" ")));
    if (out) console.log(out);
    break;
  }
  case "packs": {
    const { packs, rejected } = read(packsFile());
    for (const p of packs) {
      console.log(`${p.id.padEnd(20)} ${String(p.license).padEnd(14)} ${p.repo}`);
      console.log(`${" ".repeat(20)} ${p.summary}`);
    }
    console.log(`\nDeliberately not listed (${rejected.length}): ${rejected.map((r) => r.repo).join(", ")}`);
    console.log(`See registry/packs.json for why.`);
    break;
  }
  case "install":
    installPack(rest[0]);
    break;
  case "audit": {
    // Clone shallow into a temp dir and measure the pack. Stars do not tell
    // you whether the skills will load; this does.
    const target = rest[0];
    if (!target) {
      console.error("usage: skillister audit <owner/repo | ./local/dir>");
      process.exit(1);
    }
    let dir = target;
    let meta = {};
    let tmp = null;
    if (!fs.existsSync(target)) {
      tmp = fs.mkdtempSync(path.join(os.tmpdir(), "skillister-"));
      dir = tmp;
      process.stderr.write(`cloning ${target}...\n`);
      try {
        sh("git", ["clone", "--depth=1", "--quiet", `https://github.com/${target}.git`, dir]);
      } catch (e) {
        console.error(`clone failed: ${String(e.message).split("\n")[0]}`);
        process.exit(1);
      }
      meta = repoMeta(target);
    }
    const result = auditPack(dir, meta);
    console.log(formatAudit(target, result));
    if (result.issues.length && rest.includes("--issues")) {
      console.log(`\nissues:`);
      for (const i of result.issues) console.log(`  - ${i}`);
    } else if (result.issueCount) {
      console.log(`\n  run with --issues to list all ${result.issueCount}`);
    }
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
    break;
  }
  case "bench": {
    // Audit every registry pack and print a leaderboard. `--json` writes the
    // machine-readable form the site and the workflow consume.
    // `--candidates` audits the discovered-but-not-yet-listed packs instead,
    // so promotion into the registry is decided by measurement.
    const useCandidates = rest.includes("--candidates");
    const limit = Number((rest.find((a) => a.startsWith("--limit=")) || "").split("=")[1]) || 0;
    let packs;
    if (useCandidates) {
      const file = path.join(ROOT, "registry", "candidates.json");
      const list = fs.existsSync(file) ? read(file).candidates : [];
      packs = list.map((c) => ({ id: c.repo.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), repo: c.repo, license: c.license }));
      if (limit) packs = packs.slice(0, limit);
    } else {
      packs = read(packsFile()).packs;
    }
    const rows = [];
    for (const p of packs) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "skillister-"));
      try {
        process.stderr.write(`auditing ${p.repo}...\n`);
        sh("git", ["clone", "--depth=1", "--quiet", `https://github.com/${p.repo}.git`, tmp]);
        const meta = repoMeta(p.repo);
        const r = auditPack(tmp, meta);
        rows.push({ id: p.id, repo: p.repo, license: p.license, ...meta, score: r.score, verdict: r.verdict, skills: r.total, metrics: r.metrics, issueCount: r.issueCount });
      } catch (e) {
        rows.push({ id: p.id, repo: p.repo, error: String(e.message).split("\n")[0] });
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    }
    rows.sort((a, b) => (b.score || 0) - (a.score || 0));
    if (rest.includes("--json")) {
      console.log(JSON.stringify({ generated: new Date().toISOString(), packs: rows }, null, 2));
    } else {
      console.log(`\n${"pack".padEnd(22)} ${"score".padEnd(7)} ${"skills".padEnd(7)} ${"stars".padEnd(7)} verdict`);
      console.log("-".repeat(72));
      for (const r of rows) {
        if (r.error) { console.log(`${r.id.padEnd(22)} error: ${r.error}`); continue; }
        console.log(`${r.id.padEnd(22)} ${String(r.score).padEnd(7)} ${String(r.skills).padEnd(7)} ${String(r.stars ?? "?").padEnd(7)} ${r.verdict}`);
      }
    }
    break;
  }
  case "wrapper":
    if (rest[0] === "add") wrapperAdd(rest[1], rest[2], rest[3]);
    else console.log("usage: skillister wrapper add <id> <https-url> [ref]");
    break;
  case "init":
    init(rest[0]);
    break;
  case "stats": {
    const i = loadIndex();
    console.log(`${i.count} skills, built ${i.built}`);
    Object.entries(i.sizes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .forEach(([k, v]) => console.log(`  ${String(v).padStart(5)}  ${k}`));
    break;
  }
  case "doctor":
    doctor();
    break;
  default:
    console.log(fs.readFileSync(path.join(ROOT, "docs", "usage.txt"), "utf8"));
}
