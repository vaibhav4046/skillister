#!/usr/bin/env node
/**
 * Claude Code SessionStart adapter.
 * Refreshes the index only when it is stale, then arms the orchestrator so the
 * skill system is on by default instead of something to remember.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { indexPath } from "../../src/roots.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const MAX_AGE_DAYS = 7;

try {
  const p = indexPath();
  let index = null;
  try { index = JSON.parse(fs.readFileSync(p, "utf8")); } catch { /* no index yet */ }

  const built = index ? Date.parse(index.built) || 0 : 0;
  if (!index || Date.now() - built > MAX_AGE_DAYS * 864e5) {
    execFileSync(process.execPath, [path.join(ROOT, "bin", "skillister.mjs"), "index"], { stdio: "ignore", timeout: 60000 });
    index = JSON.parse(fs.readFileSync(p, "utf8"));
  }

  if (index?.count) {
    process.stdout.write(
      `SKILLISTER ARMED - ${index.count} skills indexed.\n` +
      `For non-trivial or multi-phase work, invoke the "orchestrate" skill: it looks skills up and sequences them.\n` +
      `Never invent a skill name. Look it up: skillister find <domain words>. Not in the index means not installed.`
    );
  }
} catch { /* never block the session */ }
process.exit(0);
