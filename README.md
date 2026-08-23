# skilldex

**You have hundreds of agent skills installed. Your agent uses about six of them.**

Skills are matched to your request by their description. That works at twenty skills. At two hundred it degrades. At a thousand it stops working entirely, and the pack you installed last week never fires again.

Skilldex fixes discovery. It indexes every skill on your machine, ranks them against a real query, and maps task shapes to exact skill names so the right one actually runs.

```bash
npx @vaibhav4046/skilldex index
npx @vaibhav4046/skilldex find supply chain dependency risk
npx @vaibhav4046/skilldex route "the login page is broken"
```

```
$ skilldex find supply chain dependency risk
supply-chain-risk-auditor    Audits a project's dependencies for supply-chain risk: version-matched
                             advisories for direct dependencies and the full lockfile tree...

$ skilldex route "the login page is broken"
SKILLDEX routes for this prompt:
- "systematic-debugging" + "diagnosing-bugs" :: Hypothesis loop, no guess-patching. Find the root
  cause before editing, and grep every caller of the function you are about to touch.
```

---

## Why this exists

Every other repository in this space is a pile of skills. There are several, they are large, and they compete on count.

Piling on more skills makes the problem worse. A thousand-skill dump does not give your agent a thousand capabilities; it gives it a search problem it silently fails. Skilldex is the missing half: the part that decides *which* skill, *when*.

Two things it does that a skill list cannot:

**Ranking that survives scale.** Naive text matching lets a five-word skill name beat a precise two-word one just by containing more of your query. Skilldex weights how much of a skill's *name* your query covers, then applies a specificity prior that down-weights hits drawn from very large collections. One hit out of a fifteen-skill curated pack is stronger evidence than one out of a thousand-skill dump.

**Routes that cannot lie.** A route names exact skills. CI asserts every routed name exists in a real built index, so a route can never recommend a skill nobody has installed.

### See it for yourself

`skilldex compare` runs both scorers over the same index, so the claim is testable instead of asserted. Real output from an index of 1203 skills, where one installed pack contributes 753 of them:

```
$ skilldex compare open source a repo

  naive (substring count)                    skilldex (coverage + specificity prior)
  ---------------------------------------    ---------------------------------------
  collecting-open-source-intelligence        open-sourcing
  performing-open-source-intelligence-...    collecting-open-source-intelligence
  open-sourcing                              performing-open-source-intelligence-...

  naive picked from "Anthropic-Cybersecurity-Skills" (753 skills),
  skilldex picked from "open-sourcing" (1 skill).
```

```
$ skilldex compare security audit

  naive (substring count)                    skilldex (coverage + specificity prior)
  ---------------------------------------    ---------------------------------------
  performing-security-headers-audit          audit-context-building
  auditing-terraform-infrastructure-for-...  ponytail-audit
  auditing-cloud-with-cis-benchmarks         performing-security-headers-audit
```

**Where it helps, and where it does not.** The gain shows up on queries built from common words, which is exactly where a large pack's keyword-dense names crowd out a short precise one. On queries containing a distinctive term the two agree, because there was never any ambiguity to resolve. Both scorers still miss on vague requests like `test my code`, which is what routes are for: shapes that come up constantly get an explicit route rather than a search.

Run `skilldex find --naive <query>` against your own machine and judge it yourself.

## We do not host other people's skills

Skilldex links to upstream packs. It does not copy them.

That is partly ethics and partly law. Trail of Bits ships under CC-BY-SA-4.0, which is copyleft, and Anthropic's skills repository has no licence at all, which means all rights reserved. Any repository that mirrors those into an MIT bundle is either relicensing work it does not own or infringing outright. Authors keep their attribution, their licence, and their stars.

You get the same convenience without that: `skilldex install <pack>` prints the exact upstream install path, including the platform quirks that break it.

## Install

```bash
npm install -g @vaibhav4046/skilldex
skilldex index
skilldex doctor
```

Or without installing anything: `npx @vaibhav4046/skilldex@latest doctor`.

### Wire it into your agent

**Claude Code** gets hooks that arm the index at session start and route every prompt:

```bash
skilldex init claude-code   # prints the settings.json block to paste
```

**Codex, Cursor, Gemini CLI, opencode, anything else** gets an instruction snippet:

```bash
skilldex init generic       # prints a block for AGENTS.md / .cursorrules / GEMINI.md
```

Skilldex indexes every host CLI it finds on the machine, so one index serves all of them at once.

## The registry

Curated, with reasons. `skilldex packs` prints this, including what was deliberately left out and why.

| Pack | Licence | What it is good for |
|---|---|---|
| [obra/superpowers](https://github.com/obra/superpowers) | MIT | Process: brainstorming, systematic debugging, TDD, verification |
| [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | MIT | Frontend, performance, Core Web Vitals, shipping |
| [trailofbits/skills](https://github.com/trailofbits/skills) | CC-BY-SA-4.0 | Security review, static analysis, supply chain, modern Python |
| [mattpocock/skills](https://github.com/mattpocock/skills) | MIT | Specs, tickets, deep-module design, diagnosis loops |
| [blader/humanizer](https://github.com/blader/humanizer) | MIT | Rewriting text that reads as generated |
| [mvanhorn/last30days-skill](https://github.com/mvanhorn/last30days-skill) | MIT | Answering "what is current" past a training cutoff |
| [kepano/obsidian-skills](https://github.com/kepano/obsidian-skills) | MIT | Obsidian CLI, Markdown, Bases, Defuddle |
| [anthropics/skills](https://github.com/anthropics/skills) | none stated | Documents, artifacts, MCP servers |

The registry also records install quirks that cost real time to find. For example: `claude plugin install` fails with `Host key verification failed` when a marketplace declares a `github` source, because it resolves to SSH. `skilldex wrapper add` works around it in one command.

## Everything is tested

```bash
npm test
```

**Static validation** checks every registry entry: schema, unique ids, valid regexes, `owner/name` repo format, a declared licence, a caution note on anything non-redistributable, and that every pack is actually linked from this README.

**Prompt evals** are the part that matters. Every route declares prompts that must fire it and prompts that must not:

```json
"evals": {
  "should":    ["the login page is broken", "tests are flaky on CI"],
  "shouldNot": ["write me a haiku", "run systematic-debugging on this"]
}
```

CI runs all of them on every pull request. It catches the two failures static checks miss: a route that quietly stops firing after someone tightens its regex, and a route that steals prompts belonging to another route. No API key and no network, because routing is deterministic.

## Contributing

Adding a pack or a route is a pull request against JSON. No engine changes.

```bash
git clone https://github.com/vaibhav4046/skilldex && cd skilldex
# edit registry/packs.json or registry/routes.json
npm test
```

New routes need eval prompts in both directions. CI rejects a route without them, and rejects any route pointing at a skill that does not resolve. See [CONTRIBUTING.md](CONTRIBUTING.md).

A weekly workflow scans GitHub for trending skill repositories and opens a pull request proposing them. A human still decides. Curation is the product; an auto-merged firehose would be the thing this repository exists to argue against.

## Who this is not for

- **You have five skills installed.** Discovery is not your problem. Come back at fifty.
- **You want a thousand skills in a zip.** Deliberately not that. Three repositories already do it and none of them made your agent smarter.
- **You want it to pick skills autonomously with no oversight.** Routes are suggestions your agent reads. It still decides, and it should still tell you what it chose before it runs.
- **You need skills to work offline with no upstream.** Skilldex installs from source repositories. Clone what you need yourself.

## Licence

MIT. Indexed packs stay under their own licences, held by their own authors.
