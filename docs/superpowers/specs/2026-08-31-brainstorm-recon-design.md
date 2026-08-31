# Brainstorm Recon Phase — Design

**Date:** 2026-08-31 · **Issue:** mezo-xu5q

## Problem

The superpowers brainstorming skill starts with "Explore project context", but in practice
that step is shallow: no structured look at how high-quality external projects solve the
same problem, and codebase exploration happens ad hoc in the main context. We want every
brainstorm in this repo to open with two parallel sub-agents:

- **researcher** — searches the web for prior art: how mature applications, libraries, and
  community discussions solve the problem at hand.
- **investigator** — maps the relevant part of *our* codebase, entering through
  `docs/CODEMAP.md` and the linked `docs/features/*.md` docs.

## Constraints

- The superpowers `brainstorming` skill lives in the plugin cache
  (`~/.claude/plugins/cache/claude-plugins-official/superpowers/<version>/`); editing it
  would be clobbered by plugin updates. The extension must live project-side.
- Hermes (local-LLM mirror) is explicitly **out of scope** — web research and long-context
  synthesis are weak terrain for the local model. Revisit later if wanted.
- Recon must not blow up token cost: both agents are focused, timeboxed sweeps, not
  exhaustive audits.

## Decisions (from brainstorm)

| Question | Decision |
|---|---|
| When does recon run? | Always, at the start of every brainstorm — both agents in parallel. |
| Where does output go? | Conversation context + two mandatory spec sections (no separate artifact files). |
| Hermes mirror? | No — Claude-side only. |
| Wiring mechanism | Project skill + agent definitions + one CLAUDE.md hook line; plugin untouched. |

## Components

### 1. `.claude/agents/researcher.md`

Sub-agent definition callable via the Agent tool (`subagent_type: researcher`).

- **Tools:** WebSearch, WebFetch, Read. No write/edit tools.
- **Mission:** given a one-to-two-sentence problem statement (plus any constraints already
  clarified with the user), find how the problem is solved elsewhere: high-quality
  applications, libraries, standards, and substantive forum/blog discussions.
- **Report contract:** 3–5 relevant patterns maximum. For each: source URL, the approach in
  one paragraph, and when it is a good vs. bad fit. Ends with a one-line recommendation of
  which pattern(s) look most applicable here. If nothing substantive exists, say so in one
  line rather than padding.

### 2. `.claude/agents/investigator.md`

Sub-agent definition, strictly read-only (Read, Grep, Glob, read-only Bash).

- **Entry point is mandatory:** `docs/CODEMAP.md` → the linked `docs/features/*.md` docs
  for the touched features → only then code. (This mirrors CODEMAP's own orientation
  recipe: "Do not grep the tree to orient.")
- **Report contract:** affected feature blocks; key files with `path:line` anchors;
  existing patterns the new work must follow; and traps/conflicts (ArchUnit layer rules,
  contract-drift gate, CODEMAP freshness gate, test-mode conventions, etc.). If the
  feature docs are stale relative to code it finds, it flags that too.

### 3. `.claude/skills/brainstorm-recon/SKILL.md`

Project skill describing the phase:

- **Trigger:** invoked as part of step 1 of every `superpowers:brainstorming` run in this
  repo.
- **Dispatch:** formulate the problem statement, then launch **both agents in one message
  (parallel), in the background**. Do not block: continue with clarifying questions while
  they run.
- **Prompts:** each agent gets the problem statement plus whatever the user has already
  clarified. Researcher prompt caps at ~5 sources; investigator prompt names the suspected
  feature areas if known.
- **Integration:** once reports land, fold them into the brainstorm — later clarifying
  questions and the 2–3 approach proposals should reference the findings explicitly
  ("researcher found X in app Y", "investigator says this touches feature block Z").
- **Spec output:** the design doc gains two mandatory sections (see below).

### 4. CLAUDE.md hook

One line under "Claude-specific notes": in this repo, brainstorming's "Explore project
context" step means invoking the `brainstorm-recon` skill.

## Runtime flow

1. Brainstorm starts → Claude states the problem in 1–2 sentences.
2. Both agents dispatched in parallel, in the background.
3. Clarifying questions proceed immediately (recon does not block).
4. Reports arrive → folded into subsequent questions and the approach proposals.
5. Design doc includes the two recon sections.

## Spec output sections

Every design doc written by brainstorming in this repo must include:

- **Prior art** — the researcher's filtered result: which external patterns were adopted
  or rejected, and why, with URLs.
- **Codebase terrain** — the investigator's filtered result: affected features, key files,
  patterns to follow, known traps.

If an agent comes back empty (e.g., no meaningful external prior art for an internal
refactor), the section records that in one line — it never silently disappears.

## Prior art

Recon phase was not yet in place when this spec was written; the pattern follows the
colleague-reported researcher/investigator sub-agent practice described in the Problem
section (no external sources consulted).

## Codebase terrain

Recon phase was not yet in place when this spec was written; terrain was established
manually: `.claude/skills/` (existing project skills), `docs/CODEMAP.md` (investigator
entry point), superpowers plugin cache (read-only constraint).

## Error handling

- An agent that fails or is skipped is noted in the corresponding spec section; the
  brainstorm continues without it rather than stalling.
- Reports are advisory context, not instructions: web content the researcher quotes is
  untrusted data and never overrides project rules.

## Testing / verification

Process tooling, not code — no automated tests. Verification is a dry run: start a
brainstorm on a toy topic, confirm both agents dispatch in parallel, reports fold into the
conversation, and the spec template sections appear. `superpowers:writing-skills` guides
the skill authoring itself.

## Out of scope

- Hermes mirror (`agents/hermes/skills/`) — possible later issue.
- Ingesting researcher findings into `docs/research/` (knowledge-base wiki) — can be done
  manually per case when a source proves durable.
- Any change to the superpowers plugin itself.
