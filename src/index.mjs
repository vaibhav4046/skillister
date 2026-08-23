/**
 * Skill discovery: scan the filesystem for SKILL.md files, parse their
 * frontmatter, and build a queryable index.
 *
 * Deliberately dependency-free and harness-agnostic. Roots are supplied by the
 * caller (see src/roots.mjs), so this works for Claude Code, Codex, Cursor,
 * Gemini CLI, or a bare directory of skills.
 */

import fs from "node:fs";
import path from "node:path";

const MAX_HEAD_BYTES = 4096; // frontmatter only; never read whole skill bodies
const MAX_DEPTH = 10;

/**
 * Mirror copies for other harnesses, vendored dependencies, and test fixtures.
 * Indexing these surfaces skills the running agent does not actually load.
 */
export const EXCLUDE =
  /[\\/](\.cursor|\.windsurf|\.codex|\.gemini|\.git|\.in_use|node_modules|deprecated|__tests__|test-fixtures)[\\/]/i;

const STOP = new Set([
  "the", "a", "an", "for", "and", "with", "to", "of", "in", "on",
  "my", "this", "how", "do", "i", "is", "it", "that", "at", "by",
]);

function walk(dir, out = [], depth = 0) {
  if (depth > MAX_DEPTH) return out;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (EXCLUDE.test(full + path.sep)) continue;
    if (e.isDirectory()) walk(full, out, depth + 1);
    else if (e.name === "SKILL.md") out.push(full);
  }
  return out;
}

/**
 * Minimal YAML frontmatter reader. Handles quoted scalars and folded blocks
 * (`>-`, `|`). CR is stripped up front because `.` in a JS regex does not match
 * \r, which would silently blank the description of every CRLF file.
 */
export function parseFrontmatter(file) {
  let head;
  try {
    const fd = fs.openSync(file, "r");
    const buf = Buffer.alloc(MAX_HEAD_BYTES);
    const n = fs.readSync(fd, buf, 0, MAX_HEAD_BYTES, 0);
    fs.closeSync(fd);
    head = buf.subarray(0, n).toString("utf8").replace(/\r/g, "");
  } catch {
    return null;
  }
  if (!head.startsWith("---")) return null;

  const end = head.indexOf("\n---", 3);
  const lines = (end === -1 ? head : head.slice(0, end)).split("\n");

  const out = {};
  for (let i = 0; i < lines.length; i++) {
    const m = /^([a-zA-Z_-]+):\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    const key = m[1].toLowerCase();
    if (key !== "name" && key !== "description") continue;
    let val = m[2].trim();
    if (val === ">-" || val === ">" || val === "|" || val === "|-") {
      const parts = [];
      for (let j = i + 1; j < lines.length && /^\s+\S/.test(lines[j]); j++) {
        parts.push(lines[j].trim());
        i = j;
      }
      val = parts.join(" ");
    }
    val = val.replace(/^["']|["']$/g, "").trim();
    if (val) out[key] = val;
  }
  return out.name ? out : null;
}

/** The owning plugin, from a Claude Code cache path. Null elsewhere. */
function pluginOf(file) {
  const m = /[\\/]cache[\\/]([^\\/]+)[\\/]([^\\/]+)[\\/]/.exec(file);
  return m ? m[2] : null;
}

/**
 * The collection a skill ships in, used as a specificity prior at query time.
 * One hit out of a 1000-skill dump is weaker evidence than one out of a
 * 15-skill curated pack.
 */
function collectionOf(file, plugin, rootDir) {
  if (plugin) return plugin;
  const rel = path.relative(rootDir, file).split(/[\\/]/);
  return rel.length > 2 ? rel[0] : "local";
}

/**
 * @param {{dir: string, source: string}[]} roots
 * @param {{name:string, description:string}[]} builtins Skills bundled inside a
 *   host CLI that have no SKILL.md on disk. Without these, "not in the index"
 *   would wrongly imply "not installed".
 */
export function build(roots, builtins = []) {
  const seen = new Map(); // name -> entry; shortest path wins (the canonical copy)

  for (const { dir, source } of roots) {
    for (const file of walk(dir)) {
      const fm = parseFrontmatter(file);
      if (!fm) continue;
      const plugin = pluginOf(file);
      const entry = {
        name: fm.name,
        description: (fm.description || "").slice(0, 400),
        source,
        plugin,
        collection: collectionOf(file, plugin, dir),
        path: file,
      };
      const prev = seen.get(fm.name);
      if (!prev || file.length < prev.path.length) seen.set(fm.name, entry);
    }
  }

  for (const b of builtins) {
    if (seen.has(b.name)) continue;
    seen.set(b.name, {
      name: b.name,
      description: b.description,
      source: "builtin",
      plugin: null,
      collection: "builtin",
      path: "(bundled in the host CLI)",
    });
  }

  const skills = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  const sizes = {};
  for (const s of skills) sizes[s.collection] = (sizes[s.collection] || 0) + 1;

  return { version: 1, built: new Date().toISOString(), count: skills.length, sizes, skills };
}

export function tokenize(query) {
  return String(query || "")
    .toLowerCase()
    .split(/[^a-z0-9+#.-]+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

export function score(skill, terms, sizes) {
  const nameStr = skill.name.toLowerCase();
  const nameTokens = nameStr.split(/[^a-z0-9+#.]+/).filter(Boolean);
  const desc = (skill.description || "").toLowerCase();

  let s = 0;
  let matchedNameTokens = 0;
  for (const t of terms) {
    if (nameStr === t) s += 20;
    else if (nameTokens.includes(t)) {
      s += 6;
      matchedNameTokens++;
    } else if (nameStr.includes(t)) s += 2;
    if (desc.includes(t)) s += 1;
  }
  if (!s) return 0;

  // Specificity: "open-sourcing" matching 1 of its 2 tokens is a tighter fit
  // than "performing-open-source-intelligence-gathering" matching 2 of its 5.
  s += 20 * (matchedNameTokens / nameTokens.length);

  // Collection prior: down-weight hits drawn from very large dumps.
  const n = (sizes && sizes[skill.collection]) || 1;
  return s / (1 + Math.log10(n) / 2);
}

/**
 * The obvious first implementation: count query hits in the name and
 * description, weight the name higher, done. Kept so the ranking claim is
 * testable rather than asserted - `skillister find --naive` runs this instead,
 * and `skillister compare` shows both side by side.
 *
 * It fails in one specific way. A long hyphenated name contains more of your
 * query by accident than a short precise name does on purpose, so a
 * thousand-skill dump wins every query it is entered into.
 */
export function scoreNaive(skill, terms) {
  const name = skill.name.toLowerCase();
  const desc = (skill.description || "").toLowerCase();
  let s = 0;
  for (const t of terms) {
    if (name.includes(t)) s += 5;
    if (desc.includes(t)) s += 1;
  }
  return s;
}

export function find(index, query, limit = 12, { naive = false } = {}) {
  const terms = tokenize(query);
  if (!terms.length) return [];
  const scorer = naive ? (sk) => scoreNaive(sk, terms) : (sk) => score(sk, terms, index.sizes);
  return index.skills
    .map((sk) => ({ sk, s: scorer(sk) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || a.sk.name.length - b.sk.name.length)
    .slice(0, limit)
    .map((r) => r.sk);
}
