/**
 * Optional reasoning layer.
 *
 * Routing and ranking are deterministic and work with no network and no key.
 * A model adds one thing on top: judgement about which of several plausible
 * candidates actually fits an ambiguous request, and in what order.
 *
 * Every provider here has a genuine free tier. Nothing is required: with no key
 * set, `plan()` returns the deterministic result and says so. A tool that stops
 * working when an API key is missing is not a tool, it is a demo.
 */

/**
 * Ordered by free-tier generosity and latency, best first. All but Gemini speak
 * the OpenAI chat-completions shape.
 */
export const PROVIDERS = [
  {
    id: "groq",
    env: "GROQ_API_KEY",
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.3-70b-versatile",
    free: "Free tier, no card. Fastest of the four.",
    signup: "https://console.groq.com/keys",
  },
  {
    id: "cerebras",
    env: "CEREBRAS_API_KEY",
    url: "https://api.cerebras.ai/v1/chat/completions",
    model: "llama-3.3-70b",
    free: "Free tier, no card.",
    signup: "https://cloud.cerebras.ai",
  },
  {
    id: "openrouter",
    env: "OPENROUTER_API_KEY",
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: "meta-llama/llama-3.3-70b-instruct:free",
    free: "Models with a :free suffix cost nothing.",
    signup: "https://openrouter.ai/keys",
  },
  {
    id: "gemini",
    env: "GEMINI_API_KEY",
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    model: "gemini-2.0-flash",
    dialect: "gemini",
    free: "Free tier via AI Studio, no card.",
    signup: "https://aistudio.google.com/apikey",
  },
];

export function activeProvider() {
  return PROVIDERS.find((p) => process.env[p.env]) || null;
}

async function callOpenAI(p, prompt, signal) {
  const res = await fetch(p.url, {
    method: "POST",
    signal,
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env[p.env]}` },
    body: JSON.stringify({
      model: p.model,
      temperature: 0,
      max_tokens: 700,
      messages: [
        { role: "system", content: "You select and order developer tooling. Answer only with the requested JSON. No prose." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${p.id} returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return j.choices?.[0]?.message?.content || "";
}

async function callGemini(p, prompt, signal) {
  const res = await fetch(`${p.url}?key=${encodeURIComponent(process.env[p.env])}`, {
    method: "POST",
    signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 700 },
    }),
  });
  if (!res.ok) throw new Error(`${p.id} returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return j.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

function extractJson(text) {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Ask a model to choose among candidates the index already produced.
 *
 * The model never invents names: it is given a closed list and its answer is
 * filtered against that list afterwards. A hallucinated skill is dropped rather
 * than shown, which keeps the guarantee that a recommendation always resolves.
 *
 * @param {string} task the user's request
 * @param {{name:string,description:string}[]} candidates from the index
 * @param {{routes?:object[], timeoutMs?:number}} [opts]
 */
export async function plan(task, candidates, opts = {}) {
  const provider = activeProvider();
  const allowed = new Set(candidates.map((c) => c.name));

  const deterministic = {
    provider: null,
    reasoning: "No model key set, so this is the deterministic ranking. Set GROQ_API_KEY (free) for judgement on ambiguous requests.",
    chain: (opts.routes || []).flatMap((r) => r.skills).filter((s) => allowed.has(s)).slice(0, 3),
  };
  if (!deterministic.chain.length) deterministic.chain = candidates.slice(0, 2).map((c) => c.name);

  if (!provider) return deterministic;

  const list = candidates.map((c) => `- ${c.name}: ${(c.description || "").slice(0, 160)}`).join("\n");
  const prompt = [
    `Task: ${task}`,
    ``,
    `Installed skills that might apply:`,
    list,
    ``,
    `Pick at most 3, ordered so that any process skill (one that sets a method, like debugging or planning) runs before a domain skill (one that supplies content).`,
    `Use ONLY names from the list above. If nothing genuinely fits, return an empty chain.`,
    ``,
    `Reply with JSON only: {"chain": ["name", ...], "reasoning": "one sentence"}`,
  ].join("\n");

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), opts.timeoutMs || 15000);
  try {
    const text = provider.dialect === "gemini" ? await callGemini(provider, prompt, ac.signal) : await callOpenAI(provider, prompt, ac.signal);
    const parsed = extractJson(text);
    if (!parsed || !Array.isArray(parsed.chain)) return { ...deterministic, reasoning: `${provider.id} returned no usable JSON; fell back to the deterministic ranking.` };

    // Closed-list filter: this is what stops a model inventing a skill.
    const chain = parsed.chain.filter((n) => allowed.has(n)).slice(0, 3);
    const dropped = parsed.chain.filter((n) => !allowed.has(n));

    return {
      provider: provider.id,
      model: provider.model,
      chain,
      dropped,
      reasoning: String(parsed.reasoning || "").slice(0, 300),
    };
  } catch (e) {
    return { ...deterministic, reasoning: `${provider.id} failed (${String(e.message).slice(0, 120)}); fell back to the deterministic ranking.` };
  } finally {
    clearTimeout(timer);
  }
}
