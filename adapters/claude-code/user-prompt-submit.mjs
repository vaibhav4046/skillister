#!/usr/bin/env node
/**
 * Claude Code UserPromptSubmit adapter.
 * Match-gated: emits nothing when no route fires, so it costs zero standing
 * tokens. Never blocks the prompt.
 * Disable with SKILLISTER=off.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compile, route, render } from "../../src/router.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

let data = "";
process.stdin.on("data", (c) => (data += c));
process.stdin.on("end", () => {
  try {
    if (String(process.env.SKILLISTER || "").toLowerCase() === "off") process.exit(0);
    const input = JSON.parse(data || "{}");
    const prompt = input.prompt || input.user_prompt || "";
    const { routes } = JSON.parse(fs.readFileSync(path.join(ROOT, "registry", "routes.json"), "utf8"));
    const out = render(route(compile(routes), prompt));
    if (out) process.stdout.write(out);
  } catch {
    /* never block the prompt */
  }
  process.exit(0);
});
