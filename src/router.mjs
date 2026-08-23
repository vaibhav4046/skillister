/**
 * Prompt routing.
 *
 * Description-matching stops working somewhere around a few hundred installed
 * skills: the agent no longer reliably picks the right one, so good skills sit
 * unused. Routes map a task SHAPE to exact skill names.
 *
 * Routes are DATA (registry/routes.json), not code, so contributors add them by
 * pull request without touching the engine.
 */

/**
 * A route fires when `match` hits and `suppress` does not. `suppress` exists so
 * a prompt that already names the skill does not get told about it again.
 *
 * @typedef {object} Route
 * @property {string} id
 * @property {string} match      regex source, case-insensitive
 * @property {string} [suppress] regex source, case-insensitive
 * @property {string[]} skills   skill names this route recommends
 * @property {string} advice     one line shown to the agent
 */

export function compile(routes) {
  return routes.map((r) => ({
    ...r,
    _match: new RegExp(r.match, "i"),
    _suppress: r.suppress ? new RegExp(r.suppress, "i") : null,
  }));
}

/**
 * @param {Route[]} compiled routes from compile()
 * @param {string} prompt
 * @param {number} [max] cap on routes returned, so output never bloats context
 */
export function route(compiled, prompt, max = 2) {
  const p = String(prompt || "");
  if (!p.trim()) return [];
  return compiled
    .filter((r) => r._match.test(p) && !(r._suppress && r._suppress.test(p)))
    .slice(0, max);
}

/** Render routes as the plain text an agent reads. Harness-agnostic. */
export function render(hits) {
  if (!hits.length) return "";
  const lines = hits.map((r) => `- ${r.skills.map((s) => `"${s}"`).join(" + ")} :: ${r.advice}`);
  return ["SKILLDEX routes for this prompt:", ...lines].join("\n");
}

/**
 * Every skill name any route can emit. Used by the test suite to prove the
 * router cannot recommend a skill that does not exist.
 */
export function routedSkillNames(routes) {
  const out = new Set();
  for (const r of routes) for (const s of r.skills) out.add(s);
  return out;
}
