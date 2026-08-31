# Karakter Slice 7 — Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the epic's backend chapter — the living feature doc plus the three deferred follow-ups the S2/S4/S5 reviews parked — bd `mezo-1gim.11` (closing `mezo-1gim.2`, `.4`, `.7`, `.9`).

**Architecture:** No new architecture. Task 1 documents what S1–S6 built (`docs/features/character.md`, the repo's 10-section feature-doc format). Tasks 2–4 are small, independent code changes inside `feature/character` plus one generator wiring in `feature/proactive`.

**Tech Stack:** The repo's existing feature-doc format + `scripts/lint-docs.mjs`; Spring Boot 4 / JPA / JUnit Testcontainers for the code tasks.

## Global Constraints

- Every code change stays inside the switch/idiom rules the epic already follows: beans on `CHARACTER_SWITCH` (+ `COMPANION_SWITCH` where an LLM is involved), `@Transactional` method-level only, no raw exceptions outside `techcore`, no `companion → character` import, no bare `List<String>` mapped with `SqlTypes.JSON`.
- The existing Character ITs are the regression proof for every task — do not weaken or delete an assertion to make a change fit.
- Local tests focused only: `cd backend && ./mvnw test -Dtest=<Pattern> -Dmezo.test.use-testcontainers=true`. A `deadlock detected` TRUNCATE failure is known flakiness (bd `mezo-oou9`) — rerun once before investigating.
- Conventional commits with bd id `mezo-1gim.11`; regenerate `docs/CODEMAP.md` whenever files are added; `node scripts/lint-docs.mjs --errors-only` must pass after Task 1.
- No contract change in this slice — `api/` and the FE client must stay untouched.

---

### Task 1: `docs/features/character.md`

**Files:**
- Create: `docs/features/character.md`
- Modify: `docs/features/README.md` (the domain index table)
- Modify: `docs/CODEMAP.md` (regenerate)

**Interfaces:** none — documentation only.

- [ ] **Step 1: Read the format before writing a word**

Read `docs/features/companion.md` and `docs/features/proactive.md` (the closest siblings — both are
AI-domain docs with switch-gated crons and LLM pipelines) for the section structure, frontmatter
shape (`title`, `type`, `status`, `updated`, `tags`, `key_files`, `related`), the one-line summary
convention, and the "what actually exists NOW" discipline. Also read `docs/features/README.md`'s
table to see how a domain row is phrased. THEN read the epic's own sources of truth:
`docs/superpowers/specs/2026-08-27-user-character-dossier-design.md` and the six slice plans in
`docs/superpowers/plans/2026-08-2*-character-slice*.md`.

- [ ] **Step 2: Verify every claim against the code before writing it**

The doc must describe what is IN the repo, not what the spec wanted. For each section, open the
actual classes under `backend/src/main/java/io/mrkuhne/mezo/feature/character/` and
`api/feature/character/character.yml`. Anything the spec describes but the code does not implement
(e.g. the bootstrap corpus's missing sources until Task 3 lands) is written as an explicit gap, not
as shipped behavior.

- [ ] **Step 3: Write the doc**

Cover, in the sibling docs' section order: the concept and dual consumer; the 7 CORE dimensions +
CHAPTERs; the persona team and the identity guardrails; the five tables and their typed jsonb
envelopes; the detector catalog as it actually exists (5 detectors, per-detector switches); the
nightly observation pass; the weekly konzílium (proposal → szkeptikus → integrátor → claim
lifecycle → portraits → outcome → consumption) and its honesty rules (no fabricated turns); the
bootstrap and monthly deep read; the `[Karakter]` prompt block and where it is injected; the claim
feedback loop and what it does and does not guarantee; the switch/cron matrix (every
`mezo.feature.character.*` and `mezo.techcore.cron.character-*` key with its default); the API
surface; the test map; and a "known gaps / follow-ups" section naming the open bd ids.

- [ ] **Step 4: Verify**

Run: `node scripts/lint-docs.mjs --errors-only` (must PASS) and `node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check`.

- [ ] **Step 5: Commit**

```bash
git add docs/features/character.md docs/features/README.md docs/CODEMAP.md
git commit -m "docs(features): character domain doc — the Karakter dossier as built (mezo-1gim.11)"
```

---

### Task 2: Detector polish (`mezo-1gim.4`)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/UnderLoggingDetector.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/LoggingGapDetector.java`
- Modify: the five detectors under `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/` (switch gating)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/character/detector/DetectorTest.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterObservationServiceIT.java`

**Interfaces:** no signature changes — `CharacterDetector.key()/detect(DetectorInput)` and
`DetectorRegistry.runAll` stay exactly as they are.

Five items, all from the S2 final review (bd `mezo-1gim.4`):

1. **Hungarian number formatting** — `UnderLoggingDetector` renders `BigDecimal.toString()`
   (`81.2`, `+0.6`); the rest of the app's Hungarian text uses a decimal comma. Format the weight
   endpoints and the delta with a comma (a small private helper; do not pull in a locale-dependent
   formatter that could vary by JVM default — format deterministically).
2. **Dead branch** — the `sign = delta.signum() >= 0 ? "+" : ""` ternary in the same class is dead
   (the detector only fires when `delta ≥ 0.3`). Drop it.
3. **Streak qualifier** — `LoggingGapDetector` caps its streak at the 14-day window, so a longer gap
   reports as exactly `14. napja` and silently drops the `(utolsó: …)` clause. When the streak hits
   the cap, say so honestly (e.g. `legalább 14 napja`) instead of asserting a precise number.
4. **Detector bean switch-gating** — the five detectors are plain `@Component`s while
   `DetectorRegistry`/`CharacterSignalReads` carry `@ConditionalOnProperty(CHARACTER_SWITCH)`, so
   with the feature off five orphan beans stay in the context. Gate them the same way (house idiom:
   switch off ⇒ bean absent). Note `DetectorRegistry` injects `List<CharacterDetector>` — verify an
   empty list still constructs cleanly with the switch off, and add/extend a switch-off IT
   assertion if the existing one does not already cover it.
5. **Quiet-day assertion** — `CharacterObservationServiceIT.quietDay_noSignals_zeroRowsAndNoLlmCall`
   asserts zero rows but never that NO LLM call happened, so the zero-cost claim rides on reading
   the service. Pin it: count calls through the fake (read `FakeCompanionLlm` for a counter or add a
   narrowly-scoped test-only one, mirroring an existing seam) or assert via the LLM audit log that
   no `character` call was recorded for that run.

- [ ] **Step 1: Write/extend the failing tests first** (formatting, cap qualifier, switch-off bean
  absence, quiet-day no-LLM), run them, watch them fail.
- [ ] **Step 2: Implement all five items.**
- [ ] **Step 3: Run** `cd backend && ./mvnw test -Dtest='DetectorTest,Character*,ArchitectureTest' -Dmezo.test.use-testcontainers=true` — green.
- [ ] **Step 4: Commit**

```bash
git add backend/src
git commit -m "fix(character): detector polish — HU numbers, honest streak cap, switch-gated beans (mezo-1gim.11)"
```

---

### Task 3: Bootstrap corpus (`mezo-1gim.7`)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterHistoryReads.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterHistoryReadsIT.java`

**Interfaces:** `gatherHistory(UUID)` keeps its signature and return type.

Spec §6 names the bootstrap corpus as "daily summaries, journal, patterns, facts, weekly reviews,
life events"; the shipped read covers only daily summaries, CONFIRMED patterns and prompt-eligible
facts. Add the three missing sources:

- **Weekly reviews** — `feature/proactive`'s `weekly_review` rows (read `WeeklyReviewRepository` and
  the entity for the real finder/field names). Route to every expert like daily summaries (they are
  whole-life prose), capped like them.
- **Journal entries** — `feature/journal`'s `JournalEntryRepository` (the S2 detector already uses
  `findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnDescCreatedAtDesc`); route to
  `pszichologus` (emotional signal), capped.
- **Life events** — the `LIFE_EVENT` graph nodes (`feature/companion`'s graph package — find the
  repository and the node-kind constant); route to `antropologus`, capped.

Every added source follows the existing rules: a documented cap constant, per-line text capped the
same way, `refIds` as `"<kind>:<uuid>"`, no invented text. Dependency direction check: `character →
proactive` and `character → journal` must not create a cycle (`ArchitectureTest#feature_slices_are_cycle_free`)
— verify before writing, and if a cycle would close, use the port idiom (`WeekReviewSource` is the
precedent) instead of a direct repository import.

Also widen the routing coverage the S4 review flagged as shallow: parameterize
`CharacterHistoryReadsIT`'s routing test so every keyword-map entry and every fact category is
asserted, not two of them.

- [ ] **Step 1: Write the failing IT cases** (one per new source + the parameterized routing), run, fail.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Run** `cd backend && ./mvnw test -Dtest='CharacterHistoryReadsIT,CharacterBootstrapIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true` — green.
- [ ] **Step 4: Commit**

```bash
git add backend/src
git commit -m "feat(character): widen the bootstrap corpus — weekly reviews, journal, life events (mezo-1gim.11)"
```

---

### Task 4: `[Karakter]` in the weekly review (`mezo-1gim.9`) + ship

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeeklyReviewGenerator.java`
- Test: extend `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterPromptWiringIT.java`
- Modify: `docs/CODEMAP.md` (regenerate), `docs/features/character.md` (fold in Tasks 2–4's changes)

**Interfaces:** consumes `CharacterPromptSource.render(UUID)` via `ObjectProvider` — the S5 idiom.

`WeeklyReviewGenerator.gather` builds its own `ÚJ TÉNYEK` section instead of calling
`knowledgeFactService.renderPromptBlock`, which is why S5 skipped it. Add the block deliberately
next to that section, using the same `ObjectProvider` + `""`-when-absent helper the other three
consumers use, so all four surfaces speak from the one formatter. Extend `CharacterPromptWiringIT`
with a weekly-review case asserting the payload carried the block.

- [ ] **Step 1: Write the failing IT case**, run, fail.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Update `docs/features/character.md`** so it describes the state AFTER Tasks 2–4
  (the doc was written against the pre-follow-up code — re-verify its detector, corpus and
  prompt-consumer sections and fix anything now stale).
- [ ] **Step 4: Final gates** — `cd backend && ./mvnw test -Dtest='Character*,Konzilium*,ClaimLifecycle*,DetectorTest,WeeklyReview*IT,ArchitectureTest' -Dmezo.test.use-testcontainers=true`, `./mvnw compile -q`, `node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check`, `node scripts/lint-liquibase.mjs`, `node scripts/lint-docs.mjs --errors-only`, and confirm `api/`+`frontend/` are untouched (`git diff --name-only origin/main...HEAD | grep -E '^(api|frontend)/'` must be empty).
- [ ] **Step 5: Commit**

```bash
git add backend/src docs
git commit -m "feat(character): [Karakter] block in the weekly review + doc refresh (mezo-1gim.11)"
```

- [ ] **Step 6: Ship** — push `feat/character-s7-consolidation`, self-PR → CI green → `git pull --rebase`
  on main → `--no-ff` merge (`ALLOW_MAIN_COMMIT=1` if the merge needs a manual commit) → push →
  delete branch → close `mezo-1gim.11` AND the four follow-ups it closes (`mezo-1gim.2`, `.4`, `.7`,
  `.9`) → `bd dolt push`.

## Out of scope

The FE (`/me` Karakter page) — it waits on the design 2.0 Karakter prototype round, per the spec's
sequencing decision. The known CI flakiness (`mezo-oou9`) is its own issue.
