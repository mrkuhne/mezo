# Train Titanium T1 — Overload Summary Honesty (A1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** a session that DROPS load is never presented as progressive overload — the day
summary splits the weight lever by sign and the FE shows drops as their own honest chip.

**Architecture:** `OverloadSummary` gains a `weightDown` counter; `WorkoutService` tallies on
the SIGN of `ProgressionSignal.deltaKg` instead of the lever alone; `PrepFejlodesPage` renders
`−súly` separately and a drops-only day never claims `⚡ Túlterhelés`. `ProgressionDecider`'s
lever vocabulary is untouched (other readers depend on it — fix the consumers).

**Tech stack:** OpenAPI contract-first (fragment + merged + regenerated api.gen.ts in ONE
commit), Spring service + Testcontainers IT, RTL component test.

**Driving artifacts:** openGym-audit handoff §A1 (2026-09-15), bd `mezo-88iwa.2`,
branch `feat/train-a1-overload-honesty`.

## Global Constraints

Everything in `2026-09-15-train-titanium-slices.md` §Global Constraints. Verbatim from the
handoff: do NOT change `ProgressionDecider`'s levers; `Lever.WEIGHT` meaning "the load moved"
is fine. `OverloadChallengeGenerator.java:74` already filters `deltaKg > 0` — leave it.

---

### Task 1: Contract — `weightDown` on `OverloadSummary`

**Files:**
- Modify: `api/feature/train/train.yml:3092-3102` (schema `OverloadSummary`)
- Modify: `api/openapi.yml` (regenerate merge), `frontend/src/data/_client/api.gen.ts` (regenerate)

**Interfaces:**
- Produces: `OverloadSummary { weightUp: number; weightDown: number; repUp: number; hold: number }`
  (all required).

- [ ] **Step 1:** In the fragment, extend the schema:

```yaml
    OverloadSummary:
      type: object
      description: >-
        Day-level count of how many exercises move via each lever (PrepHero chip).
        weightUp counts load INCREASES only; a load reduction (grind back-off) counts in
        weightDown and must never be presented as progressive overload.
      required: [weightUp, weightDown, repUp, hold]
      properties:
        weightUp:
          type: integer
        weightDown:
          type: integer
        repUp:
          type: integer
        hold:
          type: integer
```

- [ ] **Step 2:** Regenerate the merged contract and the FE client
(`cd api/generate && npm run generate:api`, or the repo's documented equivalent — check
`api/generate/package.json` scripts), confirm `weightDown` appears in
`frontend/src/data/_client/api.gen.ts`.

- [ ] **Step 3:** `cd backend && ./mvnw -q test-compile` — the generated Java DTO gains the
field; expect the build to FAIL at `WorkoutService` only if the builder became stricter,
otherwise pass (required fields on OpenAPI don't force builder args). Fix nothing else yet.

- [ ] **Step 4:** Commit — `git add api frontend/src/data/_client/api.gen.ts && git commit -m "feat(api): OverloadSummary splits the weight lever by sign — weightDown (mezo-88iwa.2)"`

### Task 2: Backend tally on the sign of deltaKg

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WorkoutService.java:243-278`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/train/service/ProgressionDeciderTest.java`
- Test: the existing `WorkoutTodayIT`-family IT that asserts the summary (find the test
  asserting `overloadSummary` — `grep -rl overloadSummary backend/src/test`); extend it.

**Interfaces:**
- Consumes: `p.progression().getLever()`, `p.progression().getDeltaKg()`
  (`ProgressionSignal`, nullable deltaKg — null on rep/hold).

- [ ] **Step 1:** Extend `ProgressionDeciderTest` with the sign assertion (decider unchanged —
this pins the contract the tally depends on):

```java
@Test
void grindBelowRange_dropsLoad_withNegativeDelta() {
    // rp < repMin AND slack <= 0 → Lever.WEIGHT with a NEGATIVE deltaKg
    var d = ProgressionDecider.decide(ref(6, 1), 8, 12, 2,
        new BigDecimal("2.5"), new BigDecimal("2.5"), false);
    assertThat(d.lever()).isEqualTo(Lever.WEIGHT);
    assertThat(d.deltaKg()).isNegative();
}
```

(Adapt the helper/record names to the file's existing idiom — the test class already builds
`decide(...)` calls; copy its existing arrange style.)

- [ ] **Step 2:** Run it: `./mvnw -q test -Dtest='ProgressionDeciderTest' -Dmezo.test.use-testcontainers=true` — PASS
(the decider already behaves this way; the test freezes it).

- [ ] **Step 3:** Change the tally in `WorkoutService` (the `switch` at :266-270):

```java
int weightUp = 0;
int weightDown = 0;
int repUp = 0;
int hold = 0;
…
if (p.progression() != null) {
    var signal = p.progression();
    switch (signal.getLever()) {
        case WEIGHT -> {
            if (signal.getDeltaKg() != null && signal.getDeltaKg().signum() < 0) weightDown++;
            else weightUp++;
        }
        case REP -> repUp++;
        default -> hold++; // HOLD, DELOAD
    }
}
…
OverloadSummary overloadSummary = hypertrophyGate.getIfAvailable() != null
    ? OverloadSummary.builder().weightUp(weightUp).weightDown(weightDown).repUp(repUp).hold(hold).build()
    : null;
```

(If the generated DTO's `getDeltaKg()` is `Double`/`BigDecimal`, adapt the sign check to the
actual type — `signum()` for BigDecimal, `< 0` for Double.)

- [ ] **Step 4:** Extend the summary-asserting IT with a seeded drop case: history where the
last session's top set has `reps < repMin` at `rir <= targetRir` (the grind branch), assert the
response carries `weightDown == 1` and `weightUp == 0` for that exercise's contribution.
Follow the IT's existing seeding idiom verbatim (same fixture builders).

- [ ] **Step 5:** Run the focused ITs + `ArchitectureTest`:
`./mvnw -q test -Dtest='ProgressionDeciderTest,WorkoutTodayIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true`
(replace `WorkoutTodayIT` with the file found in Step 4's grep). Expect PASS.

- [ ] **Step 6:** Commit — `git commit -m "feat(train): overload summary tallies the weight lever by sign (mezo-88iwa.2)"`

### Task 3: FE — the honest chip

**Files:**
- Modify: `frontend/src/features/train/pages/prep/PrepFejlodesPage.tsx:77-92`
- Test: `frontend/src/features/train/pages/prep/PrepFejlodesPage.test.tsx` (create beside the
  page if none exists; if a test file exists, extend it)
- Modify: the train mock fixture (`frontend/src/data/train/train.ts`) — the seeded
  `overloadSummary` gains `weightDown` (one day with a non-zero value so mock mode exercises it).

**Interfaces:**
- Consumes: `overload.weightDown` from the regenerated types.

- [ ] **Step 1:** Write the failing RTL test:

```tsx
it('a drops-only day never claims overload, and shows the honest −súly chip', () => {
  // arrange with overload = { weightUp: 0, weightDown: 2, repUp: 0, hold: 3 } via the page's
  // existing data seam (mock fixture or hook mock — copy the file's existing test setup idiom)
  expect(screen.queryByText(/Túlterhelés/)).toBeNull();
  expect(screen.getByText(/2× −súly/)).toBeInTheDocument();
});

it('a mixed day shows both directions side by side', () => {
  // overload = { weightUp: 1, weightDown: 1, repUp: 0, hold: 2 }
  expect(screen.getByText(/Túlterhelés/)).toBeInTheDocument();
  expect(screen.getByText(/1× \+súly/)).toBeInTheDocument();
  expect(screen.getByText(/1× −súly/)).toBeInTheDocument();
});
```

- [ ] **Step 2:** Run (both modes) — FAIL.

- [ ] **Step 3:** Implement: the card renders when
`(overload.weightUp + overload.repUp + overload.weightDown) > 0`; the `⚡ Túlterhelés` title
only when `(overload.weightUp + overload.repUp) > 0` — a drops-only day titles the card
`Visszavett súlyok` instead (no ⚡, no overload claim); the chip list adds
`overload.weightDown > 0 ? `${overload.weightDown}× −súly` : null` after `+rep`.

- [ ] **Step 4:** Run both FE modes — PASS. **Step 5:** Commit —
`git commit -m "feat(train): a load drop shows as −súly, never as overload (mezo-88iwa.2)"`

### Task 4: Gates, docs, ship

- [ ] **Step 1:** `node scripts/gen-codemap.mjs --check`; update `docs/features/train.md`'s
overload-summary paragraph (grep `OverloadSummary` in the doc) with the sign-split rule.
- [ ] **Step 2:** Full FE both modes + `pnpm build`; focused BE gate from Task 2 Step 5.
- [ ] **Step 3:** Push, self-PR `feat(train): overload summary honesty — weightDown (mezo-88iwa.2)`,
CI green, premerge, `--no-ff` merge per the worktree recipe, close `mezo-88iwa.2`.

## Self-review notes

- Handoff §A1 coverage: contract (Task 1), sign tally (Task 2), FE distinct chip + no-overload
  claim on drops-only days (Task 3), decider untouched, ChallengeGenerator untouched. Tests:
  decider negative-delta pin, IT split assertion, RTL drops-only + mixed.
- Type care: `deltaKg` nullable — null routes to `weightUp` only for positive/unknown WEIGHT
  moves; the decider always sets deltaKg on WEIGHT (both branches), so null-WEIGHT is
  theoretical; the `else weightUp++` keeps it total.
