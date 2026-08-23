#!/usr/bin/env node
/**
 * Prompt evals.
 *
 * Every route declares the prompts that must fire it and the prompts that must
 * not. This runs all of them. It is the difference between "we collected some
 * skills" and "we can show these skills activate on the right request".
 *
 * Two failure modes it catches that static validation cannot:
 *   - a route that stops firing after someone tightens its regex
 *   - a route that steals prompts belonging to another route
 *
 * No API key, no network: routing is deterministic, so the evals are too.
 *
 *   node test/eval.mjs           run every route
 *   node test/eval.mjs debug     run one route
 *   node test/eval.mjs --verbose show every prompt, not just failures
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compile, route } from "../src/router.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const only = args.find((a) => !a.startsWith("--"));

const { routes } = JSON.parse(fs.readFileSync(path.join(ROOT, "registry", "routes.json"), "utf8"));
const compiled = compile(routes);

// Routing is capped at 2 in production so output cannot bloat context. Evals
// lift the cap: we are asking "did this route fire at all", not "did it win".
const MAX = routes.length;

let pass = 0;
const failures = [];

function fired(prompt, id) {
  return route(compiled, prompt, MAX).some((r) => r.id === id);
}

for (const r of routes) {
  if (only && r.id !== only) continue;

  for (const prompt of r.evals?.should || []) {
    if (fired(prompt, r.id)) {
      pass++;
      if (verbose) console.log(`  ok    [${r.id}] fires on: "${prompt}"`);
    } else {
      failures.push({ id: r.id, kind: "should fire", prompt });
    }
  }

  for (const prompt of r.evals?.shouldNot || []) {
    if (!fired(prompt, r.id)) {
      pass++;
      if (verbose) console.log(`  ok    [${r.id}] stays quiet on: "${prompt}"`);
    } else {
      failures.push({ id: r.id, kind: "should NOT fire", prompt });
    }
  }
}

// A prompt that fires more routes than the production cap means the top two are
// arbitrary. Worth surfacing, not worth failing over.
const noisy = [];
for (const r of routes) {
  for (const prompt of r.evals?.should || []) {
    const n = route(compiled, prompt, MAX).length;
    if (n > 3) noisy.push({ prompt, n });
  }
}

const total = pass + failures.length;
console.log(`\nprompt evals: ${pass}/${total} passed across ${only ? 1 : routes.length} routes`);

if (noisy.length) {
  console.log(`\n${noisy.length} prompt(s) fire more than 3 routes; the production cap of 2 makes the winner arbitrary:`);
  for (const n of noisy.slice(0, 8)) console.log(`  ${n.n} routes  "${n.prompt}"`);
}

if (failures.length) {
  console.error(`\n${failures.length} failing:`);
  for (const f of failures) console.error(`  [${f.id}] ${f.kind}: "${f.prompt}"`);
  process.exit(1);
}
