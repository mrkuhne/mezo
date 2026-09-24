---
name: emlekezet
description: Session driver for the Mezo emlékezete programme (epic mezo-d6ivw, 2026-09-24) — turning confirmed insights, person memory, effect tracking and the transparency hub into ONE coherent memory engine and AI experience, surfaced primarily on the csapatfal world. One slice per fresh session, and every slice OPENS with a joint brainstorm (recon + web) before any spec, plan or code. Use when the user invokes /emlekezet or asks to continue the Mezo emlékezete / memória-motor work.
---

# Mezo emlékezete session driver

**One fresh session = one slice, and every slice starts with a brainstorm.** The flow is:
**brainstorm (recon + web + owner) → spec delta + owner OK → plan → build → gates → merge →
deploy.** Never skip the brainstorm and never merge without the owner's OK on the spec delta
(and on the prototype, where there is UI). The owner set this flow on 2026-09-24.

## Why brainstorm-first (owner decision 2026-09-24): do not re-litigate

The base spec cut six slices, but the owner's standing goal is bigger than any slice:
**the app's separate learning subsystems must converge into ONE engine and ONE AI
experience** — and that experience most likely lives on the **csapatfal** (the mezo-a9bo7
world). No slice is "just implement the spec section": each session first re-examines, with
fresh eyes, how its slice pulls the five subsystems together. The spec section is the floor,
not the ceiling; genuinely better unifying moves go to the owner as options.

## Owner decisions (2026-09-24): do not re-litigate

- **Extend the existing Deep-Memory platform** (mezo-b3pp, 90% done). No second memory system.
- **Person facts auto-save** — no approval queue. A discreet **"Megjegyeztem: …" chip with
  undo** at capture; "ezt ne jegyezd meg" works in-conversation; full view/edit/delete on the
  person page and in the hub.
- **All three effect trackings:** per-person, per-event-type, and re-checking confirmed
  observations over time (drift → a new observation, "korábban igaz volt, most másképp").
- **One central hub** (Tudástár extended: Rólad / Emberek / Megerősített észrevételek /
  Hatások), every item with provenance link + use-toggle.
- **Proactive:** confirmed knowledge must work in *messages/interventions*, not only chat.
- **Non-causal, hedged phrasing** with strength and confidence shown separately (Exist.io
  pattern); **no ranking of relationships** (Monica lesson); refuted observations never
  resurface.
- **UI is Üveg canon, dark only**, prototype + owner OK before any screen is built.

## Canon (read every session, in this order)

1. **`docs/superpowers/specs/2026-09-24-mezo-emlekezete-design.md`** — the base spec:
   the six slices, prior art, codebase terrain with anchors, traps.
2. `bd show mezo-d6ivw` and the slice bead — scope, dependencies, and any comments from
   earlier sessions or Hermes escalations.
3. **The five subsystems the brainstorm must survey** (this is the unification mandate):
   - **RAG / unified memory** — the memory serving platform (`MEZO_MEMORY_SERVING_MODE`,
     mezo-i7x5v), embeddings, recall, consolidation ladder (mezo-b3pp W3.x).
   - **Knowledge & graph** — `knowledge_fact`, candidate inbox, graph promotion,
     `PersonalContextAssembler`, Tudástár + Rólad pages.
   - **Konzílium** — the character council and its editions (`character_council_edition`;
     the csapatfal's `team_edition*` is a different lease row — name trap from /csapatfal).
   - **Chat** — prompt blocks assembled in `ChatService.turnContext`
     (`[Észrevételek]`, knowledge facts, people snapshot, recall).
   - **Üzenetek / proaktív** — JITAI-lite heartbeat + intervention library (mezo-b3pp W5.2),
     daily messages, the csapatfal evening edition (mezo-a9bo7 Act II).
4. For the experience surface: the **/csapatfal** skill + its spec and
   `docs/design_2.0/prototypes/uveg-uzenofal.html` (the approved world, with the
   Üzenőfal · A csapat · Rólad · Emlékek dock); the **/uvegesites** skill §1 for prototype
   rules; the üveg bible for material. Coordinate with mezo-me75u U8/U9 and mezo-a9bo7 —
   **never build the same screen twice.**
5. `docs/features/{companion,insights,me,today,proactive,character}.md` — parity sources.

## Procedure (one slice)

### 0. Pick the slice
1. `gh run list --branch main --limit 3`. **A red main outranks everything:** fix it first.
2. `bd list -l epic:mezo-emlekezete` is the authority. Take the lowest-numbered open
   `mezo-d6ivw.N` whose blockers are closed (order S1 → S2 → S3 → S4 → S5 → S6; S1 is
   independent), unless the owner named one. `bd show <id>` carries the scope.
3. If everything is closed, say so in two sentences and stop. Do not invent a slice.
4. `bd update <id> --claim`, then work in an isolated worktree on `feat/emlekezet-s<N>`.

### 1. Brainstorm: ALWAYS, before anything else
- Invoke **superpowers:brainstorming**; its step 1 is the **brainstorm-recon** skill
  (researcher: external prior art on the web; investigator: this codebase, CODEMAP-first) —
  both dispatched in parallel, in the background.
- The recon prompts must include the slice's scope AND the standing unification question:
  *how does this slice move the five subsystems toward one engine and one experience, and
  does its surface belong on the csapatfal?*
- Clarifying questions and options go to the owner **in Hungarian, business language**
  (CLAUDE.md §Communication): A helyzet / A gond / A lehetőségek (2–3, with felt costs) /
  Az ajánlásom. One question per message.
- Outcome: a **spec delta** — a dated section appended to the base spec (or a new spec file
  for a big slice) recording the decisions, committed. **Stop and wait for the owner's OK
  on the delta before planning.**

### 2. Plan (after the spec OK)
- Invoke **superpowers:writing-plans** for the slice; save under `docs/superpowers/plans/`.
- Where the slice has UI: a clickable prototype **before implementation**, per the
  /uvegesites Procedure §1 verbatim (HTTP serve, cache-bust `?v=N`, "Új ikonok" sheet,
  §3.4 ranking, chrome from `fuel-uveg.html` untouched); csapatfal-world screens extend
  `uveg-uzenofal.html` per /csapatfal. **Owner OK on the prototype before code.**

### 3. Build
- Execute the plan with superpowers:subagent-driven-development or
  superpowers:executing-plans. TDD (superpowers:test-driven-development) for all logic.
- House patterns: code decides status, the LLM never; optional collaborators via
  `ObjectProvider`, fail-open; async after-commit listeners swallow-and-log; feature
  switches for every new bean (`REFLECTION_SWITCH`, `PEOPLE_SWITCH`,
  `KNOWLEDGE_GRAPH_SWITCH` family).

### 4. Gates (house rules, non-negotiable)
- Backend: focused ITs for what changed (`./mvnw test -Dtest=...`); the full suite only
  with `-Dmezo.test.use-testcontainers=true` when warranted.
- FE tests in **both** modes with `CI=true` (`VITE_USE_MOCK` unset AND `=false`);
  `pnpm build`; affected `frontend/tests/layout` specs.
- Runtime pass with the `verify` skill on the touched surfaces, dark only, 320px, reduced
  motion.
- API/contract changes hit the contract-drift gate. `node scripts/gen-codemap.mjs` after
  file moves **and after every merge**; `node scripts/lint-docs.mjs` clean if docs changed.

### 5. Merge + deploy ("no-wait, net stays", AGENTS.md §Git Workflow)
1. `git pull --rebase` origin main onto the branch; re-run quick gates if anything came in.
2. From the worktree: `git checkout --detach origin/main && git merge --no-ff
   feat/emlekezet-s<N>`, regenerate the codemap, `git push origin HEAD:main`. Subject
   carries the bead id: `feat(companion): <mit> (mezo-d6ivw.N)`.
3. Watch the `deploy` workflow for the pushed commit until it succeeds. If `ci` goes red,
   fixing it comes before anything else.
4. Delete the feature branch.

### 6. Close
- Append the slice's lessons to the base spec's (create on first use) **"Slice lessons"
  appendix** as numbered rules — only what a later slice would otherwise pay for again.
- Close the bead with a result summary; update `docs/features/*` touched (knowledge-base
  skill) — the investigator already flagged `me.md:425` and the `PersonEntity.knownFacts`
  comment as stale: fix them in S3 at the latest.
- Session close per CLAUDE.md: `node scripts/check-beads-backup.mjs --fix` + commit,
  `bd dolt push`, `git push`, `git status` clean.
- Report to the owner **in Hungarian**: what he can now see in the app in user-visible
  terms, what the next slice is, and what you did *not* do and why.

## Traps (paid for already — bible for this programme)

- **Evidence labels are persisted** in `pattern_event.evidenceRefs` and double as LLM
  grounding text — format at read time in `ObservationFeedService`, never by rewriting
  stored events (S1).
- **User confirm ≠ engine confirm** today: only `PatternService.applyEngineConfirm`
  promotes to `knowledge_fact` + graph; rows without a test plan are never evaluated
  (`HypothesisEvaluationService`). S2 unifies this — don't fix it "in passing" elsewhere.
- **ArchUnit direction is companion → people, never reverse.** Extraction listeners live
  in companion and write through a people-owned service port. Check-in notes come through
  the `NarrativeNoteSource` port.
- `person.known_facts` is legacy/seed-only and stays read-only; new facts go to the
  normalized `person_fact` table (spec §S3).
- Person extraction runs only as phase 4 of `GraphMaintenanceJob` — it needs the
  KNOWLEDGE_GRAPH **and** graph-maintenance switches on in the environment you verify in.
- Time-relative test fixtures break after midnight — anchor stamps to the queried day.
- The primary checkout sits on main: always work from a worktree; merges go detached-HEAD →
  `git push origin HEAD:main`.
- Prototype pages served via `file://` render script-less in the in-app browser — HTTP
  server + `?v=N`, always.
- Merge silently drops CODEMAP entries — regenerate after every merge, including the final
  one onto main.
