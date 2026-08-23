/**
 * Pack auditing: score a skill pack on things that can be measured, not vibes.
 *
 * Stars measure popularity. They do not tell you whether a pack's skills will
 * actually load, whether their descriptions are specific enough to route on, or
 * whether half of them are copies of each other. This measures that, so a good
 * pack with 40 stars can beat a bulk pack with 40,000.
 *
 * Every check is deterministic and reproducible: same commit in, same score
 * out. Nothing here calls a model.
 */

import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter, EXCLUDE } from "./index.mjs";

/**
 * Description text that could describe almost anything gives the host agent
 * nothing to match on, which is how skills end up installed but never used.
 */
const VAGUE = /^(a |an |the )?(skill|tool|helper|utility|guide|assistant)( for| to| that)?\b/i;

/** Language that tells an agent WHEN to reach for the skill. */
const TRIGGER = /\b(use (this|when|it)|when the user|invoke|trigger|applies? (to|when)|for when)\b/i;

export const WEIGHTS = {
  parseable: 30, // a skill whose frontmatter does not parse never loads at all
  described: 25, // routing quality depends almost entirely on this
  triggers: 15,
  naming: 10,
  unique: 10,
  lean: 5,
  licensed: 5,
};

function walkSkills(dir, out = [], depth = 0) {
  if (depth > 10) return out;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (EXCLUDE.test(full + path.sep)) continue;
    if (e.isDirectory()) walkSkills(full, out, depth + 1);
    else if (e.name === "SKILL.md") out.push(full);
  }
  return out;
}

function pct(n, d) {
  return d === 0 ? 0 : n / d;
}

/**
 * @param {string} dir a checked-out pack
 * @param {object} [meta] repo metadata (license, pushed_at) when available
 */
export function auditPack(dir, meta = {}) {
  const files = walkSkills(dir);
  const total = files.length;

  if (total === 0) {
    return { total: 0, score: 0, verdict: "not a skill pack", metrics: {}, issues: ["no SKILL.md files found"] };
  }

  let parseable = 0;
  let described = 0;
  let triggers = 0;
  let namedWell = 0;
  let bytes = 0;
  const names = new Map();
  const issues = [];

  for (const f of files) {
    const rel = path.relative(dir, f);
    let size = 0;
    try {
      size = fs.statSync(f).size;
    } catch {
      /* counted as unparseable below */
    }
    bytes += size;

    const fm = parseFrontmatter(f);
    if (!fm) {
      issues.push(`unparseable frontmatter: ${rel}`);
      continue;
    }
    parseable++;

    const desc = fm.description || "";
    // 80 characters is roughly where a description stops being a label and
    // starts carrying enough signal to match a request against.
    if (desc.length >= 80 && !VAGUE.test(desc)) described++;
    else if (desc.length < 80) issues.push(`thin description (${desc.length} chars): ${rel}`);

    if (TRIGGER.test(desc)) triggers++;

    const dirName = path.basename(path.dirname(f));
    if (fm.name === dirName) namedWell++;
    else issues.push(`name "${fm.name}" does not match directory "${dirName}"`);

    names.set(fm.name, (names.get(fm.name) || 0) + 1);
  }

  const duplicates = [...names.entries()].filter(([, n]) => n > 1);
  for (const [n, c] of duplicates) issues.push(`duplicate skill name "${n}" appears ${c} times`);

  const avgBytes = Math.round(bytes / total);
  const metrics = {
    total,
    parseable: pct(parseable, total),
    described: pct(described, total),
    triggers: pct(triggers, total),
    naming: pct(namedWell, total),
    unique: pct(names.size, total),
    avgBytes,
    // Above ~20KB a skill is a document the agent must read in full before it
    // can act, which costs context on every invocation.
    lean: avgBytes <= 20000 ? 1 : Math.max(0, 1 - (avgBytes - 20000) / 40000),
    licensed: meta.license && meta.license !== "NONE" ? 1 : 0,
    staleDays: meta.pushedAt ? Math.floor((Date.now() - Date.parse(meta.pushedAt)) / 864e5) : null,
  };

  let score = 0;
  for (const [k, w] of Object.entries(WEIGHTS)) score += (metrics[k] ?? 0) * w;
  score = Math.round(score);

  // A pack nobody has touched in a year is a maintenance risk regardless of
  // how well it scores on structure.
  if (metrics.staleDays !== null && metrics.staleDays > 365) {
    score = Math.round(score * 0.85);
    issues.push(`no commits in ${metrics.staleDays} days`);
  }

  const verdict =
    score >= 85 ? "excellent" : score >= 70 ? "solid" : score >= 50 ? "usable, with gaps" : "below bar";

  return { total, score, verdict, metrics, issues: issues.slice(0, 40), issueCount: issues.length };
}

export function formatAudit(name, result) {
  const m = result.metrics;
  const bar = (v) => "#".repeat(Math.round((v || 0) * 20)).padEnd(20, ".");
  const lines = [
    `${name}`,
    `  score      ${result.score}/100  (${result.verdict})`,
    `  skills     ${result.total}`,
  ];
  if (result.total) {
    lines.push(
      `  parseable  ${bar(m.parseable)} ${(m.parseable * 100).toFixed(0)}%`,
      `  described  ${bar(m.described)} ${(m.described * 100).toFixed(0)}%   (>=80 chars, not boilerplate)`,
      `  triggers   ${bar(m.triggers)} ${(m.triggers * 100).toFixed(0)}%   (says when to use it)`,
      `  naming     ${bar(m.naming)} ${(m.naming * 100).toFixed(0)}%   (name matches directory)`,
      `  unique     ${bar(m.unique)} ${(m.unique * 100).toFixed(0)}%   (no duplicate names)`,
      `  avg size   ${m.avgBytes} bytes`,
    );
    if (m.staleDays !== null) lines.push(`  last push  ${m.staleDays} days ago`);
    if (result.issueCount) lines.push(`  issues     ${result.issueCount}`);
  }
  return lines.join("\n");
}
