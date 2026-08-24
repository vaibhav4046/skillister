# skillister

**You have hundreds of agent skills installed. Your agent uses about six of them.**

Skills are matched to your request by their description. That works at twenty skills. At two hundred it degrades. At a thousand it stops working entirely, and the pack you installed last week never fires again.

Skillister fixes discovery. It indexes every skill on your machine, ranks them against a real query, and maps task shapes to exact skill names so the right one actually runs.

```bash
npx skillister index
npx skillister find supply chain dependency risk
npx skillister route "the login page is broken"
```

```
$ skillister find supply chain dependency risk
supply-chain-risk-auditor    Audits a project's dependencies for supply-chain risk: version-matched
                             advisories for direct dependencies and the full lockfile tree...

$ skillister route "the login page is broken"
SKILLISTER routes for this prompt:
- "systematic-debugging" + "diagnosing-bugs" :: Hypothesis loop, no guess-patching. Find the root
  cause before editing, and grep every caller of the function you are about to touch.
```

---

## Why this exists

Every other repository in this space is a pile of skills. There are several, they are large, and they compete on count.

Piling on more skills makes the problem worse. A thousand-skill dump does not give your agent a thousand capabilities; it gives it a search problem it silently fails. Skillister is the missing half: the part that decides *which* skill, *when*.

Two things it does that a skill list cannot:

**Ranking that survives scale.** Naive text matching lets a five-word skill name beat a precise two-word one just by containing more of your query. Skillister weights how much of a skill's *name* your query covers, then applies a specificity prior that down-weights hits drawn from very large collections. One hit out of a fifteen-skill curated pack is stronger evidence than one out of a thousand-skill dump.

**Routes that cannot lie.** A route names exact skills. CI asserts every routed name exists in a real built index, so a route can never recommend a skill nobody has installed.

### See it for yourself

`skillister compare` runs both scorers over the same index, so the claim is testable instead of asserted. Real output from an index of 1203 skills, where one installed pack contributes 753 of them:

```
$ skillister compare open source a repo

  naive (substring count)                    skillister (coverage + specificity prior)
  ---------------------------------------    ---------------------------------------
  collecting-open-source-intelligence        open-sourcing
  performing-open-source-intelligence-...    collecting-open-source-intelligence
  open-sourcing                              performing-open-source-intelligence-...

  naive picked from "Anthropic-Cybersecurity-Skills" (753 skills),
  skillister picked from "open-sourcing" (1 skill).
```

```
$ skillister compare security audit

  naive (substring count)                    skillister (coverage + specificity prior)
  ---------------------------------------    ---------------------------------------
  performing-security-headers-audit          audit-context-building
  auditing-terraform-infrastructure-for-...  ponytail-audit
  auditing-cloud-with-cis-benchmarks         performing-security-headers-audit
```

**Where it helps, and where it does not.** The gain shows up on queries built from common words, which is exactly where a large pack's keyword-dense names crowd out a short precise one. On queries containing a distinctive term the two agree, because there was never any ambiguity to resolve. Both scorers still miss on vague requests like `test my code`, which is what routes are for: shapes that come up constantly get an explicit route rather than a search.

Run `skillister find --naive <query>` against your own machine and judge it yourself.

## We do not host other people's skills

Skillister links to upstream packs. It does not copy them.

That is partly ethics and partly law. Trail of Bits ships under CC-BY-SA-4.0, which is copyleft, and Anthropic's skills repository has no licence at all, which means all rights reserved. Any repository that mirrors those into an MIT bundle is either relicensing work it does not own or infringing outright. Authors keep their attribution, their licence, and their stars.

You get the same convenience without that: `skillister install <pack>` prints the exact upstream install path, including the platform quirks that break it.

## Install

```bash
npm install -g skillister
skillister index
skillister doctor
```

Or without installing anything: `npx skillister@latest doctor`.

### Wire it into your agent

**Claude Code** gets hooks that arm the index at session start and route every prompt:

```bash
skillister init claude-code   # prints the settings.json block to paste
```

**Codex, Cursor, Gemini CLI, opencode, anything else** gets an instruction snippet:

```bash
skillister init generic       # prints a block for AGENTS.md / .cursorrules / GEMINI.md
```

Skillister indexes every host CLI it finds on the machine, so one index serves all of them at once.

## The registry

16 packs, listed only if `skillister audit` scores them 85+ and they are a genuine skill pack. Star count is not a criterion. `skillister packs` prints this, including the 8 that were deliberately left out and why.

| Pack | Licence | What it is good for |
|---|---|---|
| [obra/superpowers](https://github.com/obra/superpowers) | MIT | Agentic skills framework and software development methodology |
| [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | MIT | Production-grade engineering skills covering the full lifecycle: spec, plan, build, verify, review, ship |
| [trailofbits/skills](https://github.com/trailofbits/skills) | CC-BY-SA-4.0 | Security research, vulnerability detection, and code-quality skills from Trail of Bits |
| [mattpocock/skills](https://github.com/mattpocock/skills) | MIT | Engineering and productivity skills: grilling a plan until it holds, spec and ticket synthesis, deep-module design, diagnosis loops |
| [blader/humanizer](https://github.com/blader/humanizer) | MIT | Rewrites AI-sounding text so it reads naturally, without changing what it says |
| [mvanhorn/last30days-skill](https://github.com/mvanhorn/last30days-skill) | MIT | Researches a topic across Reddit, X, YouTube and Hacker News, so answers about what is current do not come from a stale training cutoff |
| [kepano/obsidian-skills](https://github.com/kepano/obsidian-skills) | MIT | Official Obsidian skills: the Obsidian CLI, Markdown conventions, Bases, JSON Canvas, and Defuddle |
| [anthropics/skills](https://github.com/anthropics/skills) | NONE | Document processing (docx, pptx, xlsx, pdf), artifact building, MCP server authoring, and skill creation |
| [phuryn/pm-skills](https://github.com/phuryn/pm-skills) | MIT | Product management from discovery through strategy, execution and launch |
| [google/skills](https://github.com/google/skills) | Apache-2.0 | Official skills for Google products: Cloud, Gemini, Ads and Workspace |
| [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) | NOASSERTION | An output style that strips articles, filler and hedging from responses, cutting token use substantially on long sessions |
| [github/awesome-copilot](https://github.com/github/awesome-copilot) | MIT | GitHub's own library of instructions, agents and skills for Copilot |
| [muratcankoylan/Agent-Skills-for-Context-Engineering](https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering) | MIT | Context engineering, multi-agent architecture and production agent patterns |
| [virgiliojr94/book-to-skill](https://github.com/virgiliojr94/book-to-skill) | MIT | Turns a book or paper (PDF, EPUB, DOCX, Markdown) into a structured skill, extracting the frameworks, principles and anti-patterns so an agent can apply them while you work |
| [calesthio/OpenMontage](https://github.com/calesthio/OpenMontage) | AGPL-3.0 | Agentic video production: editing pipelines, media tooling and a large set of production skills |
| [KKKKhazix/khazix-skills](https://github.com/KKKKhazix/khazix-skills) | MIT | A small, tightly written collection covering goal definition and code tidiness |

The registry also records install quirks that cost real time to find. For example: `claude plugin install` fails with `Host key verification failed` when a marketplace declares a `github` source, because it resolves to SSH. `skillister wrapper add` works around it in one command.

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
git clone https://github.com/vaibhav4046/skillister && cd skillister
# edit registry/packs.json or registry/routes.json
npm test
```

New routes need eval prompts in both directions. CI rejects a route without them, and rejects any route pointing at a skill that does not resolve. See [CONTRIBUTING.md](CONTRIBUTING.md).

A weekly workflow scans GitHub for trending skill repositories and opens a pull request proposing them. A human still decides. Curation is the product; an auto-merged firehose would be the thing this repository exists to argue against.

## Who this is not for

- **You have five skills installed.** Discovery is not your problem. Come back at fifty.
- **You want a thousand skills in a zip.** Deliberately not that. Three repositories already do it and none of them made your agent smarter.
- **You want it to pick skills autonomously with no oversight.** Routes are suggestions your agent reads. It still decides, and it should still tell you what it chose before it runs.
- **You need skills to work offline with no upstream.** Skillister installs from source repositories. Clone what you need yourself.

## Licence

MIT. Indexed packs stay under their own licences, held by their own authors.
