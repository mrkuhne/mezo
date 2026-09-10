# Mezo Titanium — production rebuild handoff

This guide turns the accepted Titanium prototype direction into a repeatable production rebuild
workflow for Claude. It complements the paste-ready
[master prompt](CLAUDE_TITANIUM_REBUILD_PROMPT.md) and the
[feature coverage register](TITANIUM_FEATURE_COVERAGE_REGISTER.md). The workflow decision is
recorded in [ADR 0041](../decisions/0041-feature-coverage-before-titanium-production-rebuild.md).

The central product idea is a **strange, intelligent presence that already knows me**. Mezo is a
companion, not a dashboard mascot and not a coach issuing orders. The visual system can be
colorful, tactile, gamified and technically expressive, while the amount of stimulation changes
with the job of each page.

## 1. Owner contract and the only delivery gate

The owner participates in three design activities:

1. the short superpowers brainstorm, one question at a time;
2. the page-level feature coverage conversation, where every discovered capability receives an
   explicit destination decision;
3. review and explicit approval of the working interactive prototype.

Prototype approval is authorization to carry the exact approved scope through the remaining
workflow without another integration-choice menu: final spec, implementation plan, subagent
implementation, reviews and corrections, PR, CI, premerge verification, local `--no-ff` merge,
push, deployment and production smoke test. A new user decision is needed only if later evidence
contradicts the approved manifest, a destructive/data-loss choice appears, credentials are
missing, or a real external blocker prevents safe completion.

Repository skills that normally stop before merge are defaults for an unapproved scope. This
owner instruction explicitly replaces that stop after prototype approval. It does not waive TDD,
review, CI, premerge, documentation, security, migration or deployment gates.

## 2. Mandatory workflow

| Phase | Required output | User interaction | Exit condition |
| --- | --- | --- | --- |
| 0. Orient | Fresh branch/repo state and relevant rules | None | `AGENTS.md`, `CLAUDE.md`, roadmap and skills understood |
| 1. Recon | Prior-art report and CODEMAP-first code terrain | Brainstorm may begin while agents research | Backend, frontend and related domains mapped |
| 2. Brainstorm | Agreed problem, hierarchy, flow and visual approach | One Hungarian question at a time | Conceptual design sections accepted |
| 3. Design spec | Dated spec with Prior art and Codebase terrain | Review is part of brainstorm | Concept is concrete enough to audit |
| 4. Coverage audit | Evidence-backed feature manifest | Decide every capability individually | No `UNKNOWN`; every row is placed |
| 5. Prototype | Mobile, interactive, representative page/flow | Iterate visually and behaviorally | Owner explicitly approves prototype |
| 6. Plan | Bite-sized TDD implementation plan + bd dependencies | None unless new contradiction appears | Plan covers every accepted manifest row |
| 7. Implement | Production code, tests and living docs | None | Plan and coverage manifest implemented |
| 8. Review | Spec-compliance, code-quality and final holistic reviews | None | All critical/important findings fixed |
| 9. Ship | Green CI + premerge, merge, push, deploy, smoke evidence | None | Production behavior verified |

The prototype belongs before the implementation plan. Brainstorming first approves the concept so
prototype code is not speculative; the prototype then resolves the exact interaction and visual
details that the production plan must reproduce.

## 3. CODEMAP-first reconnaissance

Start at [CODEMAP](../CODEMAP.md). Never begin with a repository-wide grep. For the target page,
read its feature block and recursively follow related blocks. Read the linked living feature docs
before opening implementation files. CODEMAP answers where; feature docs explain how and why.

Claude's mandatory brainstorm recon launches two read-only subagents in parallel, following
`.claude/skills/brainstorm-recon/SKILL.md`:

- **researcher:** no more than five relevant primary/reference sources, with a compact sourced
  prior-art report; external findings worth retaining follow the research-wiki workflow;
- **investigator:** CODEMAP-first terrain report with current routes, hooks, APIs, state owners,
  relevant tests and probable integration seams.

The dedicated coverage audit then goes deeper than the brainstorm recon.

### Backend map

For every target and related feature, record:

- OpenAPI fragment, operations, request/response types and generated interfaces;
- controllers, services, tool calls, repositories, entities, tables and migrations;
- ownership/security rules, scheduled/proactive jobs, notifications and AI-memory inputs/outputs;
- validation, empty/error states, provenance and tests/populators;
- capabilities implemented in the backend but absent or hidden in the current UI.

### Frontend map

Record:

- routed sections/pages, full-screen flows, sheets and hidden/deep-linked surfaces;
- every read/mutation hook from `@/data/hooks`, dual-mode behavior and local state owner;
- quick actions, notifications, companion handoffs, history/date behavior and cross-domain links;
- loading, empty, error, disabled, historical and reduced-motion states;
- current production behavior, useful prototype behavior and mismatches between them.

### Related-feature map

Follow CODEMAP links, feature-doc `related` values and actual API/data dependencies in both
directions. A redesign of one page must account for upstream inputs and downstream consumers. Pay
special attention to code blocks without their own living feature document: `activity`, `aidraft`,
`appnotification`, `feedback`, `llmlog`, `meal`, `medication`, `notification`, `nutrition`,
`people`, `progression`, `quest`, `quickinput` and `telemetry`.

## 4. Feature coverage conversation

Copy the relevant rows from the
[master register](TITANIUM_FEATURE_COVERAGE_REGISTER.md) into a dated page-specific coverage
record under `docs/design_2.0/`. Expand each domain row into one row per actual capability,
subflow, mutation and consequential state discovered in code.

Each row must contain:

| Field | Meaning |
| --- | --- |
| Capability | User-readable Hungarian description |
| Evidence | CODEMAP block plus concrete route/hook/endpoint/tool/test |
| Current behavior | What production really does today |
| Frequency/value | Daily, weekly, rare, automatic, admin or supporting |
| Destination | Exact page, subpage, sheet, companion action or background behavior |
| Decision | `KEEP`, `MERGE`, `MOVE`, `DEFER` or `DROP` |
| Preservation test | Observable proof that the decision survived implementation |
| Owner note | The user's reason or required presentation |

Discuss rows in Hungarian and in coherent page-sized batches, but make every capability visible
and individually decidable. Translate technical findings into plain behavior. `DROP` and `DEFER`
always require an explicit owner decision; silence is never consent. `MERGE` must name the new
canonical home and the old entry points/deep links to preserve or redirect. Background functions
can remain invisible, but they still need a row and a preservation test.

No prototype work starts while a relevant row is `UNKNOWN`. Freeze the decided table into the
design spec. This table is product coverage evidence; bd remains the source for implementation
tasks and dependencies.

## 5. Prototype acceptance standard

Build or extend an isolated prototype under
`docs/design_2.0/prototypes/companion-titanium/`. Do not change production behavior while design
approval is pending. Reuse the existing Titanium renderer, icons, navigation and in-memory demo
state instead of producing a disconnected visual mock.

The prototype must show:

- the dominant real-world flow from entry to completion;
- every `KEEP`, `MERGE` and `MOVE` decision that affects the page hierarchy;
- meaningful state changes with representative, clearly fictional demo data;
- historical/date behavior where relevant, plus empty, loading, error and disabled states when
  these materially change the interaction;
- companion voice/tool handoffs and their confirmation boundary;
- 390–430 px mobile layout, keyboard/tap alternatives, no horizontal overflow and honored
  `prefers-reduced-motion`;
- enough depth to judge the page, not just a landing screen or static card wall.

Claude runs the prototype, opens it in a mobile viewport, exercises the primary flow and captures
the relevant views for the owner. Feedback loops update both prototype and coverage/spec. The
approval question must name the page and approved revision. Only an unambiguous affirmative answer
opens the autonomous production phase.

## 6. Titanium design canon

### Product voice and companion

- Mezo feels like a continuous intelligent presence with memory and context.
- Voice uses first-person plural: “csináljuk”, never orders or moralizes.
- The main companion is a living liquid-titanium form, not a human avatar and not a gendered
  character. It can be large where presence is the task and compact where logging is the task.
- The form turns slowly right-to-left. Four independently tilted orbital rings and small planets
  move at different calm speeds. Occasional short local seam flashes suggest neural firing; the
  whole body does not strobe.
- Listening/thinking/celebrating reactions stay local and restrained. Haptics use the already
  reduced intensity. Pause and reduced-motion paths are mandatory.
- The companion can open and prefill actual app flows through explicit tool boundaries: meal
  analysis/logging, workout start, journal writing and other audited actions. It never pretends a
  write succeeded before confirmation.

### Navigation and hierarchy

- A miniature app/companion mark at bottom-left opens five domains: `Nap`, `Edzés`, `Fuel`,
  `Mezo`, `Én`.
- Each domain exposes four contextual destinations:

  | Domain | Destinations |
  | --- | --- |
  | Nap | Mai · Beszélgetés · Rutin · Napzárás |
  | Edzés | Mai · Terhelés · Napló · Tervek |
  | Fuel | Mai · Receptek · Kamra · Kiegészítők |
  | Mezo | Felfedezések · Előrejelzések · Karakter · Tudástár |
  | Én | Áttekintés · Súly · Alvás · Napló |

- Deeper capabilities live behind the correct summary, detail, progressive disclosure or
  companion action; four menu items are not permission to delete the rest.
- Weight, sleep, journal, Fuel Today and Train Today share one date. Horizontal swipe moves one day;
  arrows/calendar provide accessible alternatives; cross-domain switching preserves the date.
- Each root answers one main question and presents one primary action. Long analysis moves one
  level deeper.

### Visual language

- Dark graphite/titanium is the current foundation. Use colored light and material depth to keep
  it alive rather than filling the page with equal dark cards.
- Large custom clay/titanium SVG spot graphics and large numerals are primary information. Never
  substitute emoji or a generic icon library where a designed asset belongs.
- Use domain color, glow, progress, reward and motion deliberately. Training may be dopamine-heavy;
  self-reflection and night flows stay calmer while sharing material, typography and icon DNA.
- Data should become graphics: circular meters, gauges, sparklines, trajectories and small
  constellations with text equivalents. Avoid paragraphs that restate visible numbers.
- Avoid equal-size card stacks, excessive empty card interiors, repeated explanatory copy and a
  container around every row. Use open composition, separators and progressive disclosure.
- Gamification gives feedback and celebration. XP is never currency, quests have no failure state,
  streaks are not weaponized, and regressions are never framed in red or shame.
- Unknown AI confidence says `tanulom`; missing data is honest; derived claims expose provenance.

### Current calibration examples

- **Nap Mai:** full companion because arrival, orientation and conversation are the purpose.
- **Fuel Mai:** YAZIO-inspired information hierarchy in Mezo materials: large 3D bowl and energy
  arc, dominant remaining-kcal number, compact goal − food + movement equation, four animated
  protein/carbohydrate/fat/fibre circles, one icon-led log action and flat meal rows.
- **Task pages:** compact companion, one visually interesting answer, one primary action and the
  records needed now.
- **Mezo:** editorial depth, evidence and linked observations; patterns, experiments, forecasts,
  character claims, knowledge and memory link to one canonical item rather than duplicate it.

## 7. Source pack and reading order

Read only what the target needs, in this order:

1. `AGENTS.md`, `CLAUDE.md`, relevant skills and
   [roadmap](../milestones/roadmap.md).
2. [CODEMAP](../CODEMAP.md), then relevant living feature docs and house references.
3. Identity and original IA context:
   [UI/IA redesign handoff](2026-08-26-ui-ia-redesign-handoff.md).
4. Titanium foundation:
   [motion study](2026-09-09-companion-titanium-motion.md),
   [Nap prototype](2026-09-09-nap-titanium-prototype.md) and
   [navigation/actions](2026-09-09-titanium-navigation-demo.md).
5. Domain examples as relevant:
   [workout flow](2026-09-09-titanium-workout-flow.md),
   [food flow](2026-09-09-titanium-food-flow.md),
   [Mezo deep](2026-09-09-titanium-mezo-deep.md),
   [Én and Nap deep](2026-09-10-titanium-me-nap-deep.md), and
   [ADR 0040](../decisions/0040-titanium-personal-day-prototype-state.md).
6. Earlier domain audits under `docs/design_2.0/` as leads only. Revalidate them against current
   CODEMAP and code; they are dated artifacts.
7. Assets and production primitives:
   `docs/design_2.0/assets/`, `frontend/src/shared/ui/mozaik/` and
   `frontend/src/shared/ui/clay/`.

The current interactive laboratory is `docs/design_2.0/prototypes/companion-titanium/` and runs on
its documented strict Vite port. Treat its sample state as design evidence, never as proof of a
production contract.

## 8. Autonomous implementation and review

After prototype approval:

1. update the dated design spec with the approved prototype and frozen coverage manifest;
2. use `writing-plans` to create a bite-sized checkboxed plan in `docs/superpowers/plans/`, while
   bd owns the durable task/dependency graph;
3. create/claim the bd issue and an isolated `feat/<topic>` worktree/branch;
4. execute via `superpowers:subagent-driven-development`, with explicit file ownership and a
   conflict scan before parallel work;
5. use TDD for behavior, including focused preservation tests named in the manifest;
6. run implementer self-review, spec-compliance review and code-quality review per task; fix all
   critical and important findings, then run one holistic final review;
7. update every affected living feature doc, decision/infrastructure docs where required, CODEMAP
   generation outputs where applicable and the beads backup;
8. run focused local tests, both explicit frontend modes, build, doc lint and other relevant local
   gates; the repository CI remains the authoritative full backend integration gate;
9. push, open/update the self-PR, wait for all `ci.yml` jobs, then run `premerge.yml` against the
   current main and wait for green;
10. pull/rebase current main, merge locally with `--no-ff`, push main, sync bd, delete the feature
    branch, deploy through `mezo-deploy` and the current k3s/ArgoCD runbook, and smoke-test the
    approved production flow.

Never weaken tests, skip a failing gate or reinterpret the manifest to make shipping easier. After
two failed attempts on the same blocker, record the evidence in bd and report the blocker clearly.

## 9. Definition of done

The slice is complete only when all of these facts are true:

- every relevant CODEMAP capability appears in the frozen coverage record;
- the production result matches the owner-approved prototype and preservation tests;
- no critical/important review finding remains;
- focused local gates, CI and current-main premerge are green;
- living feature/design/decision/infra docs tell the truth about the shipped result;
- branch, PR, bd and off-machine tracker backup are synchronized;
- main is pushed, deployment is healthy and the production smoke path is recorded.
