---
name: orchestrate
description: Pick and sequence the right skills for a task out of everything installed on this machine, then run them. Use when a task is non-trivial and it is not obvious which skills apply, when the user says "orchestrate", "use the right skills", or when a request spans several phases (research, plan, build, review, verify). Do not use for a single obvious one-step request.
---

# Orchestrate

Hundreds or thousands of skills may be installed. Their names cannot all sit in context, so **look them up instead of guessing**.

## The lookup primitive

```bash
skilldex find <query words>    # ranked matches: plugin:name -- description
skilldex route "<request>"     # routes that fire for this exact request
skilldex doctor                # what is installed, what routes point at nothing
```

Query with **domain words, not task verbs**. `skilldex find python dependency audit` beats `skilldex find help me check my deps`. Run two or three short queries rather than one long one; the scorer favours short specific names over long ones that happen to contain your words.

The index is disk truth. **If a skill is not in it, it is not installed** — do not invent a name.

## Procedure

1. **Restate the goal** in one line, then work backward: what must be true when this is done?
2. **Classify the shape** — research / plan / build / debug / review / verify / write. Multi-phase tasks get more than one.
3. **Route and look up.** `skilldex route` the request first; `skilldex find` whatever the routes do not cover.
4. **Sequence**: process skill first, then domain skills. A process skill sets the method; a domain skill supplies the content. Never run a domain skill before the process skill that governs it.
5. **Dispatch**: independent legs can go to parallel subagents in one message; dependent legs stay sequential. Only fan out when the work is genuinely parallel and bulky.
6. **Verify before "done"**: exercise the change end to end and show the real output. Type-checking is not verification.

## Rules

- **Announce the chain before running it**: "Using X to A, then Y to B." One line. If the user disagrees they stop you before the work, not after.
- **Two skills is usually the answer.** A ten-skill chain is a plan you will not finish. Cap at three unless a full pipeline was requested.
- **A skill that does not fit is worse than no skill.** If lookup returns nothing that genuinely matches, say so and do the work directly.
- Anything you would report as fact — a bug, a root cause, a security finding — gets an independent pass whose job is to refute it, before you report it.
- Respect the host project's own conventions over any general skill. A repo with an established workflow wins.
