# Contributing

Almost everything here is JSON. You should not need to touch the engine.

```bash
git clone https://github.com/vaibhav4046/skilldex && cd skilldex
npm test
```

`npm test` runs static validation and the prompt evals. Both must pass. There are no other dependencies and no API key.

## Adding a pack

Edit `registry/packs.json`.

```json
{
  "id": "short-slug",
  "name": "Human readable name",
  "repo": "owner/name",
  "license": "MIT",
  "redistributable": true,
  "tags": ["security", "python"],
  "summary": "One or two sentences on what it is actually good for.",
  "install": { "type": "claude-marketplace", "ref": "owner/name", "plugin": "plugin-name" },
  "recommended": ["skill-one", "skill-two"]
}
```

- `license` is required, and must be what the repository actually declares. Check it; do not assume MIT.
- `redistributable: false` for copyleft or unlicensed packs, and then a `caution` field explaining the constraint. Validation enforces this pairing.
- `install.type` is `claude-marketplace`, `claude-local-wrapper`, or `git-clone`. Use `claude-local-wrapper` when the repo has no `marketplace.json`, or declares a `github` source that resolves over SSH, and put the reason in `install.why`. That field saves the next person an hour.
- `recommended` should be the handful worth taking, not the whole pack. A hundred-skill pack with a hundred recommendations is not curation.
- Add the pack to the README table. Validation fails if the repo is not linked there.

### What gets rejected

Bulk dumps, mixed-quality collections, and anything that reads as generated in volume. There are already several thousand-skill repositories and they are the reason discovery is broken. If a pack is excellent but narrow, that is fine, say so in the summary and let people install it deliberately.

Rejections go in the `rejected` array with a reason, so the same repository does not get proposed every month.

## Adding a route

Edit `registry/routes.json`.

```json
{
  "id": "deps",
  "match": "\\b(dependenc(y|ies)|supply ?chain|lock ?file)\\b",
  "suppress": "\\bsupply-chain-risk-auditor\\b",
  "skills": ["supply-chain-risk-auditor"],
  "advice": "One line the agent reads. Say what to do, not what the skill is called.",
  "evals": {
    "should": ["check my package.json for vulnerabilities", "audit our dependencies"],
    "shouldNot": ["rename this variable"]
  }
}
```

Rules the tests enforce:

- Every name in `skills` must resolve in a built index. A route pointing at a skill nobody has installed is worse than no route.
- `evals.should` and `evals.shouldNot` are both required. Write the negatives honestly: pick prompts that are genuinely nearby, not absurd ones. `"rename this variable"` is a real test; `"what is the weather"` mostly is not.
- `suppress` should catch the case where the prompt already names the skill, so the agent is not told about something it just invoked.
- Keep `match` tight. A greedy pattern steals prompts from other routes, and the eval suite will tell you when it does.

Run one route while iterating:

```bash
node test/eval.mjs deps --verbose
```

## Adding a skill

First-party skills live in `skills/<name>/SKILL.md` and must be original work under MIT. If it belongs to someone else, it belongs in the registry as a pack, not copied in here.

Frontmatter `name` has to match the directory name, and the description has to be substantial enough to route on. One clause is not enough.

## Style

Plain English. No em-dashes. Say the concrete thing rather than the impressive-sounding one. If a paragraph defends a decision at more length than the decision itself takes, cut the paragraph.
