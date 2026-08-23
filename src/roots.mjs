/**
 * Where skills live, per host CLI.
 *
 * Skilldex is harness-agnostic: it detects every supported agent CLI present on
 * the machine and indexes all of them, so one index serves Claude Code, Codex,
 * Cursor, Gemini CLI, opencode, and a plain ./skills directory at once.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const HOME = os.homedir();

/** name -> directories that may contain SKILL.md files. */
const HOSTS = {
  "claude-code": [
    [HOME, ".claude", "skills"],
    [HOME, ".claude", "plugins", "cache"],
  ],
  codex: [[HOME, ".codex", "skills"]],
  cursor: [[HOME, ".cursor", "skills"]],
  gemini: [[HOME, ".gemini", "skills"]],
  opencode: [[HOME, ".config", "opencode", "skills"]],
  amp: [[HOME, ".amp", "skills"]],
};

/** Project-local skill directories, relative to cwd. */
const PROJECT = [
  [".claude", "skills"],
  [".codex", "skills"],
  [".cursor", "skills"],
  [".agent", "skills"],
  ["skills"],
];

function exists(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Every host CLI whose skill directory actually exists on this machine. */
export function detectHosts() {
  return Object.keys(HOSTS).filter((h) => HOSTS[h].some((seg) => exists(path.join(...seg))));
}

/**
 * @param {object} [opts]
 * @param {string} [opts.cwd] project root to scan for local skills
 * @param {string[]} [opts.extra] additional absolute directories to index
 * @returns {{dir:string, source:string}[]}
 */
export function resolveRoots(opts = {}) {
  const cwd = opts.cwd || process.cwd();
  const roots = [];

  for (const [host, dirs] of Object.entries(HOSTS)) {
    for (const seg of dirs) {
      const dir = path.join(...seg);
      if (exists(dir)) roots.push({ dir, source: host });
    }
  }
  for (const seg of PROJECT) {
    const dir = path.join(cwd, ...seg);
    if (exists(dir)) roots.push({ dir, source: "project" });
  }
  for (const dir of opts.extra || []) {
    if (exists(dir)) roots.push({ dir, source: "extra" });
  }
  return roots;
}

/** Where skilldex keeps its own state. Override with SKILLDEX_HOME. */
export function skilldexHome() {
  return process.env.SKILLDEX_HOME || path.join(HOME, ".skilldex");
}

export function indexPath() {
  return path.join(skilldexHome(), "index.json");
}
