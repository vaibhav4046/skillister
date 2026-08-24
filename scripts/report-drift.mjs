#!/usr/bin/env node
/**
 * Drift report for the weekly refresh.
 *
 * A registry is only trustworthy if entries can leave it. This compares the
 * fresh audit against the policy bar and against the candidate scores, and
 * reports two things a human should look at:
 *
 *   - listed packs that have fallen below the bar (demote, or accept and note why)
 *   - unlisted candidates that clear it (promote, or reject with a reason)
 *
 * Prints Markdown to stdout. Exits 0 always: this informs a pull request, it
 * does not gate anything.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
  } catch {
    return null;
  }
};

const packs = read("registry/packs.json");
const bench = read("registry/benchmarks.json");
const candScores = read("registry/candidate-scores.json");

if (!packs || !bench) process.exit(0);

const bar = packs.policy?.minScore ?? 85;
const byId = Object.fromEntries((bench.packs || []).map((b) => [b.id, b]));
const rejected = new Set((packs.rejected || []).map((r) => r.repo.toLowerCase()));
const listed = new Set(packs.packs.map((p) => p.repo.toLowerCase()));

const demote = [];
for (const p of packs.packs) {
  const b = byId[p.id];
  if (!b) continue;
  if (b.error) {
    demote.push(`- **${p.repo}** could not be audited: ${b.error}`);
  } else if (b.score < bar) {
    demote.push(`- **${p.repo}** scored ${b.score}, below the bar of ${bar} (${b.verdict})`);
  }
}

const promote = [];
for (const c of candScores?.packs || []) {
  if (c.error || !c.repo) continue;
  if (rejected.has(c.repo.toLowerCase())) continue;
  if (listed.has(c.repo.toLowerCase())) continue; // already in the registry
  if (c.score >= bar) {
    promote.push(`- **${c.repo}** scores ${c.score} with ${c.skills} skills (${c.license})`);
  }
}

const out = ["", "## Drift", ""];

if (demote.length) {
  out.push(`### Listed packs now below the bar (${demote.length})`, "", ...demote, "");
  out.push("Demote them, or keep them and record why the exception is justified.", "");
} else {
  out.push("Every listed pack still clears the bar.", "");
}

if (promote.length) {
  out.push(`### Unlisted packs that clear the bar (${promote.length})`, "", ...promote, "");
  out.push("Promote the ones that are genuine skill packs. Everything else belongs in `rejected` with a reason, so it is not proposed again next week.", "");
}

process.stdout.write(out.join("\n"));
