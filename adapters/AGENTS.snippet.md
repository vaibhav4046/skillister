<!-- skillister: paste into AGENTS.md, GEMINI.md, .cursorrules, or any agent instruction file -->

## Skill discovery

Many skills are installed on this machine. Their names do not all fit in context, so **look them up instead of guessing**.

```bash
skillister find <domain words>     # rank installed skills against a query
skillister route "<the request>"   # which skills this request should trigger
```

Query with domain words, not task verbs: `skillister find python dependency audit` beats `skillister find help me check my deps`.

The index is disk truth. **If a skill is not in it, it is not installed** — do not invent a name.

Before non-trivial work:

1. Restate the goal, then work backward from what must be true when it is done.
2. Classify the shape: research / plan / build / debug / review / verify / write.
3. `skillister route` the request, and `skillister find` anything the routes miss.
4. Sequence: process skill first, then domain skills. A process skill sets the method; a domain skill supplies the content.
5. Announce the chain in one line before running it.
6. Verify by exercising the change end to end. Type-checking is not verification.

Cap the chain at three skills. A skill that does not fit is worse than no skill.
