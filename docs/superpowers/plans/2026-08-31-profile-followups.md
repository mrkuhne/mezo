# W4.3 profile follow-ups — Implementation Plan (`mezo-b3pp.35`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** clear four deferred minors from the W4.3 (`mezo-b3pp.17`) final review. Backend only — no contract change, no frontend.

**Scope decision, taken with the maintainer.** The bd's first item ("`meta.profile` is written but never read — surface it or drop the envelope") conflates two separable things:
- The **staleness** problem it cites (a months-old profile looks identical to a fresh one) does **not** need the envelope: `GraphNodeEntity` already carries `@UpdateTimestamp updatedAt`. Surfacing that is a contract-first vertical (schema → mapper → FE type → card) and is filed separately as **`mezo-b3pp.39`**.
- The **envelope** itself carries diagnostic counts, not a date. It stays as a deliberate write-only forensic record — readable from the DB when explaining a surprising profile — and the docs say so, so the next reader does not re-file it as dead code.

So this slice ships items 2–5.

**Tech Stack:** Java 21 / Spring Boot, Testcontainers ITs.

## Global Constraints

- **bd id on every commit subject:** `(mezo-b3pp.35)`. Conventional-commit subjects.
- **Backend only.** No contract change, no frontend change. Do not touch `api/**`, `frontend/**`, or run the generators.
- **Spec §11:** integration-first tests. No new table → `support/ResetDatabase.java` and populators untouched. Config bounds live on the `@Valid` properties record.
- **IDENT-3:** the never-throws contract in item 2 is an identity guarantee, not a nicety — the profile block is optional, the turn is not.
- **Backend gate:** focused ITs only (`./mvnw clean test -Dtest='...' -Dmezo.test.use-testcontainers=true`, Docker up). Testcontainers mode is mandatory.
- **Docs in the same change:** `docs/features/companion.md`'s W4.3 section.

---

### Task 1: The four fixes

**Files:**
- Modify: `backend/.../companion/profile/service/ProfileAssembler.java`
- Modify: `backend/.../companion/profile/config/ProfileProperties.java`
- Test: new `ProfilePromptAssemblerFailureIT` (item 2) + extend the existing profile IT (grep `ProfileAssembler` under `backend/src/test`) for items 3–4

- [ ] **Step 1: Write the failing tests**

Read the existing profile ITs and `ChatServiceGraphBlockFailureIT` (the copyable precedent named by the bd) first, and mirror their harness. Cases:

```
ProfilePromptAssemblerFailureIT (item 2) — the never-throws contract:
  testRender_shouldReturnEmptyBlock_whenTheProfileReadFails
    make the profile read blow up (mock/stub the collaborator the assembler reads through —
    ChatServiceGraphBlockFailureIT shows how this codebase does it, ~15 lines)
    => render() returns "" (or whatever its empty contract is) and does NOT throw
    => the surrounding turn is unaffected
    The catch is CORRECT today; this test exists so a future refactor that removes it fails loudly.

ProfileAssembler (item 3) — the window filter:
  testRenderPayload_shouldReadOnlyTheConfiguredWindow_whenRetiredWindowRowsExist
    seed rollups for the SAME scope under two different window_days (e.g. 30 and 14) —
    nothing deletes retired windows, so both rows genuinely coexist
    => the payload contains ONE line for that scope, from the configured window
    => today it emits two contradictory lines

  testRenderPayload_shouldStateTheConfiguredWindowInTheHeader_whenItIsNotThirty
    with feedback-learning.window-days overridden to something ≠ 30
    => the VISSZAJELZÉSEK header names that number, not a hardcoded 30

ProfileAssembler (item 4) — the double count:
  testFeedbackSignals_shouldCountEachVerdictOnce_whenAFeedMessageIsRolledUpTwice
    seed a surface:feed_message rollup AND a feed:<kind> rollup covering the same verdicts
    => the signal count equals the surface total, not the sum of both

ProfileProperties (item 5):
  testRenderMaxTokens_shouldRejectAFloorThatCannotFitTheHeader — or the equivalent bounds
    assertion this repo uses for @Valid records (grep for an existing properties-validation IT;
    `FeedbackLearningPropertiesIT` is a likely precedent). If the repo has no such idiom, skip
    the test and rely on the annotation change — say so in your report rather than inventing a
    harness.
```

- [ ] **Step 2: Run and confirm failure**

```bash
cd backend && ./mvnw clean test -Dtest='Profile*' -Dmezo.test.use-testcontainers=true
```

- [ ] **Step 3: Item 3 — filter rollups by the configured window, and stop hardcoding 30**

`ProfileAssembler` reads `rollupRepository.findByCreatedByAndDeletedFalseOrderByScopeAsc(userId)` — every window ever rolled up. The rollup table's unique key is `(created_by, scope, window_days)` and nothing deletes retired windows, so after a `feedback-learning.window-days` change the assembler reads BOTH windows: two contradictory lines per scope, under a header that still says "utolsó 30 nap", and `feedbackSignals` roughly doubles.

Fix: add a repository finder scoped to `windowDays` and use it, then derive the header text from the same config value instead of the literal `30`:
```java
        out.append("VISSZAJELZÉSEK (utolsó ").append(windowDays).append(" nap):\n")
```
Read how `ProfileAssembler` reaches the feedback-learning window (it may need the property injected — check whether `ProfileProperties` or `CompanionProperties.FeedbackLearning` owns `windowDays`, and use the SAME source the rollup job writes with, or the filter and the data will disagree). Say in your report which source you used and why.

**Do not** take the bd's alternative ("render the row's own window"): that would keep emitting several windows' contradictory lines in one profile, which is the problem, not the fix.

- [ ] **Step 4: Item 4 — count each verdict once**

`feedbackSignals` sums `stats.total()` across ALL scopes. The scope taxonomy is `style`, `surface:<artifact_kind>`, `feed:<feed_kind>`, `intervention:<key>` — and `surface:*` is the complete, non-overlapping partition (one row per artifact kind), while `feed:*` and `intervention:*` are refinements of a subset. A `feed_message` verdict therefore lands in both `surface:feed_message` and `feed:<kind>` and is counted twice.

Fix: sum only `surface:`-prefixed scopes. Add a comment stating why that prefix is the canonical partition, so nobody "fixes" it back to all-scopes later. Note this affects only the meta number and the `signals == 0` skip gate's magnitude — never which rows are rendered.

- [ ] **Step 5: Item 5 — raise the token floor**

`ProfileProperties.renderMaxTokens` is `@Min(50)`, but `PROFILE_HEADER` alone costs ~48 tokens, leaving 2 for the prose at the floor. Not violated today, but a longer header would leave zero. Raise the floor to a value that leaves room for a genuinely useful profile — **200** is the suggestion — and justify the number in the field's javadoc against the header's measured cost. Check `application.yml`'s configured value is comfortably above the new floor; if it is not, stop and report rather than lowering the floor to fit.

- [ ] **Step 6: Run the tests**

```bash
cd backend && ./mvnw clean test -Dtest='Profile*,FeedbackLearning*' -Dmezo.test.use-testcontainers=true
```
Include the feedback-learning ITs: item 3 touches how rollup rows are read, and those tests own the writing side.

- [ ] **Step 7: Commit**

```bash
git add backend
git commit -m "fix(companion): profile reads one rollup window, counts verdicts once, never throws (mezo-b3pp.35)"
```

---

### Task 2: Docs + gates

- [ ] **Step 1: Docs**

`docs/features/companion.md`'s W4.3 section must now say:
- The profile payload reads **only the configured `feedback-learning.window-days`** rollup rows, and the header states that number rather than a hardcoded 30 — with the reason: retired windows are never deleted, so an unfiltered read would emit two contradictory lines per scope under a stale header.
- `feedbackSignals` counts **`surface:*` scopes only**, because that prefix is the complete non-overlapping partition while `feed:*`/`intervention:*` are refinements of a subset — a `feed_message` verdict lands in two rows and would otherwise be counted twice. Say that it affects the meta number and the skip gate's magnitude, not which rows render.
- `ProfilePromptAssembler`'s never-throws contract now has a failure-path IT, and why one was needed: the catch is correct today, so the test guards against a future refactor removing it.
- `renderMaxTokens`' floor and the reasoning against the header's cost.
- **And the envelope decision:** `ProfileMetaEnvelope` is a deliberate write-only forensic record — nothing reads `meta.profile` in production, by design, so it can explain a surprising profile from the DB without re-running the job. Say this explicitly, and cross-reference **`mezo-b3pp.39`** for the separate staleness/`updatedAt` surfacing, so neither gets re-filed as dead code or as a missed gap.

Bump `updated:`.

- [ ] **Step 2: Gates**

```bash
cd backend && ./mvnw clean test -Dtest='Profile*,FeedbackLearning*,ChatServiceGraphBlock*' -Dmezo.test.use-testcontainers=true
node scripts/lint-docs.mjs
node scripts/gen-codemap.mjs --check
grep -c '<<<<<<<\|>>>>>>>' docs/CODEMAP.md
```
No frontend gate — no TypeScript, no contract. The last command MUST print `0` (`mezo-ag1b`: `gen-codemap --check` only reads the `CODEMAP:BODY` region, so a corrupted header slips past it).

- [ ] **Step 3: Commit**

```bash
git add docs
git commit -m "docs(features): companion — profile window filter, signal counting, failure IT (mezo-b3pp.35)"
```

---

## Self-Review

- **bd coverage.** Item 1 → resolved as a scope decision with the maintainer and split: the envelope stays (documented as write-only forensic), the staleness half became `mezo-b3pp.39`. Items 2–5 → Task 1 Steps 3–5 plus the failure IT, each with its own test.
- **What this plan pins down beyond the bd:** item 3's *two* halves. The bd offers "filter by window_days, or render the row's own window"; the second option is rejected in writing because it leaves the contradictory-lines problem intact. And the fix must read `windowDays` from the SAME source the rollup job writes with, or the filter silently matches nothing — called out explicitly as something to verify, not assume.
- **Item 4's blast radius is bounded on purpose:** it changes the meta number and the skip gate's magnitude, never which rows render. Saying so in the docs stops a future reader treating a changed count as a regression.
- **Placeholders.** The failure IT and the properties-bounds test defer to existing precedents by name; where the repo may have no idiom (properties validation), the plan says to skip and report rather than invent a harness.
