# Coaching Observer S3 — Tile and Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A wide **Proaktív coaching** tile on the Mező hub opening a three-page surface — hub, Megfigyelő (every rule's verdict for a day, in severity order, with evidence, day paging and the day's timeline) and A napi kártya (the winning card, why it won, and the existing actions) — rendered entirely from what the S2 endpoint already returns, per design 2.0.

**Architecture:** Pure read-side UI over `useCoachingTrace` (S2, `mezo-6269.2`) plus one small new card hook. **No per-`flagKey` markup anywhere**: the tiles are generated from the server's ordered `rules[]`, and `domain` → wash + clay icon goes through ONE map with a safe fallback (`PatternsPage`/`bucketize` is the precedent), so a round-2 rule appears without a frontend change. Pages follow the `DiagnosisListPage`/`DiagnosisDetailPage` anatomy (`MozaikPage` → `PageHead` → `PageHero` → `PageBody` → `EntranceGroup`), routes follow the flat `/mezo/*` registration idiom. One backend task leads: the blocking `mezo-y43v` contradiction between `winner` and `cardOutcome` is resolved at its source before any pixel is drawn.

**Tech Stack:** React 19 · TypeScript · TanStack Query · react-router · Vitest + Testing Library + MSW · Playwright visual goldens · design 2.0 `mozaik`/`clay` kit + `styles/prototype.css` tokens. Backend (Task 1 only): Java 21 / Spring Boot / JPA / contract-first OpenAPI.

## Global Constraints

- **Driving issue:** `mezo-6269.3` (S3). Task 1 carries `mezo-y43v` instead — the P1 blocker filed by the S2 close review. Commit subjects: `feat(insights): … (mezo-6269.3)`, `fix(companion): … (mezo-y43v)`.
- **Spec:** `docs/superpowers/specs/2026-09-05-coaching-observer-design.md` §6, §7. S1 (`mezo-6269.1`) and S2 (`mezo-6269.2`) are merged; `GET /api/companion/flags/trace`, `useCoachingTrace`, `mockCoachingDay` and `flagKey` on the card all exist already.
- **Branch:** `feat/coaching-observer` (already checked out in this worktree). One self-PR → CI green → `gh workflow run premerge.yml -f pr=<n>` → local `--no-ff` merge → push `main`.
- **The surface recomputes nothing.** It renders `label`, `domain`, `reasonText`, `facts`, `rank`, `outcome`, `disposition`, `cardOutcome` exactly as the server sent them. No thresholds, no severity table, no Hungarian per-rule copy in the frontend.
- **No per-`flagKey` map in the frontend.** The only key-shaped map allowed is `domain → { wash, icon }`, and it MUST fall back safely for an unknown domain. A `flagKey` the frontend has never seen renders correctly — this is a tested guarantee (spec §7), not an aspiration.
- **State vocabulary (screen copy, verbatim):** `Jelzett` · `Rendben` · `Nem mérhető` · `Pihenőn` · `Nyertes`. Hungarian everywhere; numbers stay as the server rendered them (they already carry the Hungarian decimal comma).
- **Honest states (mezo-yew / mezo-0xl):** four-way on every page — loading / real error / degraded-or-absent / genuinely empty. Never a fabricated count during an unresolved fetch. `useDualQuery` is the only sanctioned dual-mode read; `const { data = seed } = useQuery(...)` is banned and `src/data/dualMode.guard.test.ts` fails the build on it.
- **`VITE_USE_MOCK` unset means mock.** Every test that must exercise the real arm stubs it: `vi.stubEnv('VITE_USE_MOCK', 'false')`. The gate is `pnpm test && VITE_USE_MOCK=false pnpm test`.
- **Mock mode must render fully.** The companion feed mock is `[]` by design; the coaching surfaces get their own deterministic seeds (`mockCoachingDay` from S2 + the card mock in Task 3) so `pnpm dev` and the visual job show real content.
- **Frontend conventions** (`docs/references/frontend_conventions.md`, MANDATORY read before writing code): four layers; routed leaves are `*Page`; presentational → `features/insights/components/`; pure logic → `features/insights/logic/`; data hooks imported from `@/data/hooks` **only**; deep absolute `@/` imports, no relative `../`, no barrels; tests colocated.
- **Design 2.0 is mandatory** (`docs/design_2.0/`): poster anatomy, domain washes, clay icons — **never emoji**, never a flat settings list. Tokens only (`--mz-*`); no raw hex in new CSS, so dark mode follows for free. New CSS goes in `frontend/src/styles/prototype.css` in its own section, next to the Diagnózis block.
- **`Karakter`/`Diagnózis` have a deliberate DOM-order-vs-stagger-order mismatch** on the Mező hub — do not "fix" it when inserting the new tile (spec §3).
- **Visual goldens are two-platform** (darwin + linux). Adding pages adds shots; the Mező hub tile moves an existing shot. Regenerate BOTH platforms via `gh workflow run update-visual-baselines.yml -r feat/coaching-observer`, and remember the bot commit does not trigger CI (`gh pr close <n> && gh pr reopen <n>`).
- **CODEMAP freshness:** `node scripts/gen-codemap.mjs` re-run and `docs/CODEMAP.md` committed in the same change. Focused test runs do not catch this.
- **Contract drift is CI-gated:** any `api/feature/**` edit — description-only included — needs `cd api/generate && npm run generate:api` **and** `cd frontend && pnpm generate:api`, with `api/openapi.yml` and `frontend/src/data/_client/api.gen.ts` committed alongside.
- **Testcontainers** for every backend IT touching this persistence: `-Dmezo.test.use-testcontainers=true`. The fixed-DB mode races and fakes failures.
- **Worktree discipline:** run everything from `/Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/padding-2px-all-pages-3479e4`. Never `cd` to the primary repo — it sits on `main`.

---

## File Structure

**Backend (Task 1 only)**

| File | Responsibility |
|---|---|
| `backend/.../feature/companion/flags/service/DailyCardPort.java` *(modify)* | `DeliveredCard` gains `deliveredAt` — the instant the card was written. |
| `backend/.../feature/proactive/service/DailyCardAdapter.java` *(modify)* | Supplies it from `companion_message.created_at`. |
| `backend/.../feature/companion/flags/service/FlagTraceReadService.java` *(modify)* | `cardOutcome` only for a closing row that existed WHEN the card was chosen. |
| `api/feature/companion/companion.yml` *(modify)* | Says out loud what `winner` and `cardOutcome` each mean, and which one the surface badges. |
| `backend/src/test/.../flags/FlagTraceReadServiceIT.java` *(modify)* | Both halves of the contradiction, with a backdated card. |

**Frontend — logic and data**

| File | Responsibility |
|---|---|
| `frontend/src/features/insights/logic/coachingCopy.ts` *(new)* | The screen vocabulary, `domain → wash/icon` with fallback, per-rule state derivation, the day's split, small time/date copy. Pure. |
| `frontend/src/features/insights/logic/coachingCopy.test.ts` *(new)* | Its tests, including the unknown-domain / unknown-key guarantee. |
| `frontend/src/data/insights/coachingCardHooks.ts` *(new)* | `useCoachingCard(date)` — the day's delivered advice card, dual-mode. |
| `frontend/src/data/insights/coachingCardMock.ts` *(new)* | The deterministic demo card that matches `mockCoachingDay`'s winner. |
| `frontend/src/data/insights/coachingCardHooks.test.tsx` *(new)* | Mock seed + real-mode mapping + honest empty. |
| `frontend/src/data/insights/coachingTraceMock.ts` *(modify)* | `earliestDate` derived from the requested day instead of a fixed literal. |
| `frontend/src/data/hooks.ts` *(modify)* | Barrel exports — S2 left `useCoachingTrace` unexported. |

**Frontend — components and pages**

| File | Responsibility |
|---|---|
| `frontend/src/features/insights/components/VerdictArc.tsx` *(new)* | The segmented arc drawing the day's split. One segment per rule, coloured by state. |
| `frontend/src/features/insights/components/CoachingRuleTile.tsx` *(new)* | One rule: rank badge, clay icon, wash by outcome, state chip, one evidence line, expandable evidence rows. |
| `frontend/src/features/insights/pages/CoachingHubPage.tsx` *(new)* | `/mezo/coaching` — winner poster, the split, two wide tiles. |
| `frontend/src/features/insights/pages/CoachingObserverPage.tsx` *(new)* | `/mezo/coaching/megfigyelo` — day pager, every rule in severity order, the day's timeline. |
| `frontend/src/features/insights/pages/CoachingCardPage.tsx` *(new)* | `/mezo/coaching/kartya` — the card, „Miért ez nyert", the existing actions. |
| `…/pages/CoachingHubPage.test.tsx`, `…/CoachingObserverPage.test.tsx`, `…/CoachingCardPage.test.tsx` *(new)* | Colocated page tests, both modes where it matters. |
| `frontend/src/app/router.tsx` *(modify)* | Three flat `/mezo/coaching*` registrations. |
| `frontend/src/features/insights/pages/MezoHubPage.tsx` *(modify)* | The wide tile inside the existing `<Mosaic>`. |
| `frontend/src/features/insights/pages/MezoHubPage.test.tsx` *(modify)* | The tile's line and its honest absence. |
| `frontend/src/features/insights/pages/insights.nav.test.tsx` *(modify)* | Hub tile → page navigation. |
| `frontend/src/styles/prototype.css` *(modify)* | `§ Proaktív coaching megfigyelő` — the rule tile, the day switcher, the timeline, the arc. |
| `frontend/tests/visual/visual.spec.ts` *(modify)* | Three new shots. |

**Docs**

| File | Responsibility |
|---|---|
| `docs/features/insights.md` *(modify)* | The three new surfaces and the one map that keeps them round-2-proof. |
| `docs/features/companion.md` *(modify)* | The `winner` / `cardOutcome` semantics settled in Task 1. |
| `docs/CODEMAP.md` *(regenerate)* | New pages, components, hooks. |

---

### Task 1: Settle `winner` vs `cardOutcome` before drawing anything (`mezo-y43v`)

**Why this is task one.** `FlagTraceReadService` derives `day.winner` from the day's delivered card but `rules[].cardOutcome` from each rule's CLOSING row. A rule that won the card at 10:00 and turned `clear` by 20:00 comes back as `winner = X` **and** `rules[X] = { outcome: clear, cardOutcome: null }` — the observer would render „Nyertes: Alvásadósság" on a tile labelled „Rendben". The mirror case is worse: a rule that first raised at 20:00, hours after the card was chosen, is stamped `lost` although it never competed. Neither half lies alone; the surface turns them into a contradiction. Fixing it in the UI would mean the frontend deciding what the engine meant — exactly what this feature exists not to do.

**The resolution.** `cardOutcome` becomes what its contract already claims: the correlation of the rule's state **at the moment the card was chosen**. A closing row that came into being *after* the card was delivered says nothing about that decision, so it reports `null`. `day.winner` stays what it is — the day's delivered card — and is the ONLY source the surface badges „Nyertes" from (Task 5/6 enforce that with tests).

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/DailyCardPort.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/DailyCardAdapter.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagTraceReadService.java:79-170`
- Modify: `api/feature/companion/companion.yml` (the `FlagTraceWinnerResponse` and `cardOutcome` descriptions)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/FlagTraceReadServiceIT.java`

**Interfaces:**
- Consumes: nothing from later tasks.
- Produces: `DailyCardPort.DeliveredCard(UUID cardId, String adviceKey, Instant deliveredAt)`. Wire shape is unchanged — `cardOutcome` is still `won | lost | null`; only *when* `null` appears changes. The frontend needs no type change.

- [ ] **Step 1: Write the two failing tests**

Add to `FlagTraceReadServiceIT`. The card's `created_at` is `@CreationTimestamp` and non-updatable, so it is backdated with a native UPDATE — the `FlagLogPopulator.raiseAt` seam's own idiom. Add the field-injected EntityManager next to the existing `@Autowired` fields (the house exception to constructor DI, as `FlagLogPopulator` documents):

```java
    /** The card's created_at is @CreationTimestamp + non-updatable (OwnedEntity), so a controlled
     *  delivery instant needs a native UPDATE — the FlagLogPopulator.raiseAt seam's own idiom. */
    @PersistenceContext
    private EntityManager em;

    private UUID cardAt(UUID userId, String adviceKey, Instant deliveredAt) {
        UUID id = card(userId, adviceKey);
        em.createNativeQuery("update companion_message set created_at = :at where id = :id")
            .setParameter("at", deliveredAt).setParameter("id", id).executeUpdate();
        em.flush();
        em.clear();
        return id;
    }
```

with the imports `jakarta.persistence.EntityManager` and `jakarta.persistence.PersistenceContext`.

```java
    @Test
    void a_rule_that_went_clear_after_winning_is_not_stamped_with_a_card_outcome() {
        UUID userId = createUser();
        // Won the card at 10:00 …
        flagLogPopulator.raiseAt(userId, FlagKey.SLEEP_DEBT, "evaluator", sleepDebt(1.4), at(10));
        trace(userId, FlagKey.SLEEP_DEBT, "raised", null, "logged", null, at(10));
        UUID cardId = cardAt(userId, FlagKey.SLEEP_DEBT, at(11));
        // … and turned clear by 20:00, which is the row the day CLOSES on.
        trace(userId, FlagKey.SLEEP_DEBT, "clear", null, null,
            new FlagVerdict.ClearEvidence("deficit_hours", 0.4, 1.0, null), at(20));

        FlagTraceReadService.TraceDay day = service.read(userId, DAY);
        FlagTraceReadService.RuleState sleep = day.rules().stream()
            .filter(r -> r.flagKey().equals(FlagKey.SLEEP_DEBT)).findFirst().orElseThrow();

        // The card is still the day's card — that is a fact about the DAY, not about the rule's
        // closing state, so the winner keeps naming it (the surface badges „Nyertes" from here).
        assertThat(day.winner()).isNotNull();
        assertThat(day.winner().flagKey()).isEqualTo(FlagKey.SLEEP_DEBT);
        assertThat(day.winner().cardId()).isEqualTo(cardId);
        // But the closing row is a LATER state than the decision, so it carries no card outcome:
        // „Rendben" plus a „Nyertes" stamp on the same tile is the contradiction this closes.
        assertThat(sleep.outcome()).isEqualTo("clear");
        assertThat(sleep.cardOutcome()).isNull();
    }

    @Test
    void a_rule_that_first_raised_after_the_card_never_competed_and_is_not_lost() {
        UUID userId = createUser();
        flagLogPopulator.raiseAt(userId, FlagKey.SLEEP_DEBT, "evaluator", sleepDebt(1.4), at(7));
        trace(userId, FlagKey.SLEEP_DEBT, "raised", null, "logged", null, at(7));
        cardAt(userId, FlagKey.SLEEP_DEBT, at(8));
        // Late-eating only becomes true in the evening — hours after the card was chosen.
        flagLogPopulator.raiseAt(userId, FlagKey.LATE_EATING, "evaluator",
            FlagPayloadEnvelope.lateEating(new FlagPayloadEnvelope.LateEating(120, 3, 2, Map.of())),
            at(20));
        trace(userId, FlagKey.LATE_EATING, "raised", null, "logged", null, at(20));

        FlagTraceReadService.TraceDay day = service.read(userId, DAY);
        Map<String, FlagTraceReadService.RuleState> byKey = day.rules().stream()
            .collect(java.util.stream.Collectors.toMap(
                FlagTraceReadService.RuleState::flagKey, r -> r));

        assertThat(byKey.get(FlagKey.SLEEP_DEBT).cardOutcome()).isEqualTo("won");
        assertThat(byKey.get(FlagKey.LATE_EATING).outcome()).isEqualTo("raised");
        assertThat(byKey.get(FlagKey.LATE_EATING).cardOutcome()).isNull();
    }
```

> Check `FlagPayloadEnvelope.lateEating`'s exact record component list before running (`grep -n "record LateEating" -A 4 backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/entity/FlagPayloadEnvelope.java`) and pass the real components — the point of the fixture is a payload that exists, not these particular numbers.

- [ ] **Step 2: Run them and watch them fail**

```bash
cd backend && ./mvnw test -Dtest='FlagTraceReadServiceIT' -Dmezo.test.use-testcontainers=true -DargLine="-Xmx2g"
```

Expected: both new tests FAIL — the first with `cardOutcome` `"won"` where `null` is expected, the second with `"lost"` where `null` is expected. The other tests in the file stay green.

- [ ] **Step 3: Carry the delivery instant through the port**

`DailyCardPort.java` — extend the record and say why:

```java
    /**
     * @param adviceKey  the card's SEVERITY key — a {@link FlagKey} for a flag-sourced card, or a
     *                   setup-check key for a setup-sourced one, which matches none of the flags.
     * @param deliveredAt when the card was written, i.e. the instant the ranking actually chose it.
     *                   The observer needs it to answer "was this rule's state PART of that
     *                   decision" — a trace row written after this instant says nothing about the
     *                   card, in either direction (bd mezo-y43v).
     */
    record DeliveredCard(UUID cardId, String adviceKey, Instant deliveredAt) {
    }
```

with `import java.time.Instant;`.

`DailyCardAdapter.java` — one line:

```java
            .map(row -> new DeliveredCard(row.getId(), row.getContent().adviceKey(), row.getCreatedAt()));
```

- [ ] **Step 4: Use it in the read service**

In `FlagTraceReadService.read`, alongside `winnerKey`:

```java
        Instant deliveredAt = card.map(DailyCardPort.DeliveredCard::deliveredAt).orElse(null);
```

pass it into `stateOf(userId, ordered.get(i), i + 1, cutoff, winnerKey, deliveredAt)`, widen that method's signature, and replace the card-outcome block with:

```java
        // The correlation is to the DECISION, not to the day: a row that came into being after the
        // card was chosen was not part of it. Without this guard the same day reports both
        // „Nyertes: X" and „X — Rendben" (a rule that won at 10:00 and cleared by 20:00), and
        // stamps `lost` on a rule that first raised in the evening and never competed (mezo-y43v).
        String cardOutcome = null;
        if (OUTCOME_RAISED.equals(row.getOutcome())
            && DISPOSITION_LOGGED.equals(row.getDisposition())
            && winnerKey != null
            && deliveredAt != null
            && !row.getOccurredAt().isAfter(deliveredAt)) {
            cardOutcome = flagKey.equals(winnerKey) ? CARD_WON : CARD_LOST;
        }
```

- [ ] **Step 5: Run the whole IT and confirm green**

```bash
cd backend && ./mvnw test -Dtest='FlagTraceReadServiceIT' -Dmezo.test.use-testcontainers=true -DargLine="-Xmx2g"
```

Expected: PASS, all tests in the file.

- [ ] **Step 6: Say it in the contract**

In `api/feature/companion/companion.yml`, replace the `FlagTraceWinnerResponse` description with:

```yaml
      description: >-
        The rule whose raise became the day's card — a fact about the DAY, read back from the
        delivered card. This is the ONLY source of a „Nyertes" badge; a client must never infer the
        winner from `cardOutcome`, which describes a rule's state at decision time and is null once
        that rule has changed since (mezo-y43v). Null when no card was delivered, or when the card
        came from a setup check rather than a flag — that key is none of the flag rules.
```

and the `cardOutcome` description with:

```yaml
          description: >-
            The rule's correlation to the day's card AT THE MOMENT THE CARD WAS CHOSEN, derived at
            read time and never stored. Non-null only when the rule raised, was logged, the day's
            card was flag-sourced, and the rule's closing row already existed when the card was
            delivered. A rule that has changed state since — including the winner itself, if it
            later went clear — reports null here while `winner` above still names it; a rule that
            first raised after the card reports null because it never competed (mezo-y43v).
```

- [ ] **Step 7: Regenerate the contract artefacts**

```bash
cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api
```

Expected: `api/openapi.yml` picks up the descriptions; `frontend/src/data/_client/api.gen.ts` may not change at all (descriptions only) — both are committed as-is.

- [ ] **Step 8: Commit**

```bash
git add backend/src/main backend/src/test api/feature api/openapi.yml frontend/src/data/_client/api.gen.ts && git commit -m "fix(companion): correlate cardOutcome to the decision instant, not the day (mezo-y43v)"
```

- [ ] **Step 9: Close the blocker**

```bash
bd close mezo-y43v --reason "cardOutcome is now the correlation at the card's delivery instant; winner stays the day's card and is the only source of the Nyertes badge. Contract says both out loud; FlagTraceReadServiceIT covers both halves."
```

---

### Task 2: The screen vocabulary and the one map that keeps S3 round-2-proof

**Files:**
- Create: `frontend/src/features/insights/logic/coachingCopy.ts`
- Test: `frontend/src/features/insights/logic/coachingCopy.test.ts`

**Interfaces:**
- Consumes: `CoachingRule`, `CoachingTraceDay` from `@/data/types` (S2).
- Produces, for every later frontend task:
  - `type CoachingState = 'raised' | 'suppressed' | 'clear' | 'unavailable'`
  - `stateOf(rule: CoachingRule): CoachingState`
  - `STATE_LABEL: Record<CoachingState, string>` · `WINNER_LABEL: string`
  - `STATE_CHIP: Record<CoachingState, string>` (the `mzp-stch` modifier)
  - `visualOf(domain: string): { wash: MozaikWash; icon: ClayIconName }`
  - `washOf(rule: CoachingRule): MozaikWash`
  - `splitOf(day: CoachingTraceDay): { raised: number; suppressed: number; clear: number; unavailable: number; total: number }`
  - `winnerRuleOf(day: CoachingTraceDay): CoachingRule | undefined`
  - `losersOf(day: CoachingTraceDay): CoachingRule[]`
  - `hhmm(iso: string): string` · `dayLabel(date: string, today: string): string`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from 'vitest'
import {
  STATE_LABEL, WINNER_LABEL, dayLabel, hhmm, losersOf, splitOf, stateOf, visualOf, washOf,
  winnerRuleOf,
} from '@/features/insights/logic/coachingCopy'
import { mockCoachingDay } from '@/data/insights/coachingTraceMock'
import type { CoachingRule } from '@/data/types'

const rule = (over: Partial<CoachingRule>): CoachingRule => ({
  flagKey: 'k', label: 'L', domain: 'sleep', rank: 1, outcome: 'clear', reasonText: 'r',
  facts: [], ...over,
})

describe('the screen vocabulary', () => {
  test('a cooldown-suppressed raise reads Pihenőn, not Jelzett — it did not vanish', () => {
    const suppressed = rule({ outcome: 'raised', disposition: 'suppressed_by_cooldown' })
    expect(stateOf(suppressed)).toBe('suppressed')
    expect(STATE_LABEL[stateOf(suppressed)]).toBe('Pihenőn')
  })

  test('the four other states carry the spec words', () => {
    expect(STATE_LABEL[stateOf(rule({ outcome: 'raised', disposition: 'logged' }))]).toBe('Jelzett')
    expect(STATE_LABEL[stateOf(rule({ outcome: 'clear' }))]).toBe('Rendben')
    expect(STATE_LABEL[stateOf(rule({ outcome: 'unavailable' }))]).toBe('Nem mérhető')
    expect(WINNER_LABEL).toBe('Nyertes')
  })
})

describe('the round-2 guarantee', () => {
  test('an unknown domain falls back instead of rendering nothing', () => {
    const fallback = visualOf('something_the_frontend_has_never_seen')
    expect(fallback.wash).toBeTruthy()
    expect(fallback.icon).toBeTruthy()
    expect(fallback).toEqual(visualOf('general'))
  })

  test('every domain the server can send has its own visual', () => {
    for (const domain of ['sleep', 'training', 'nutrition', 'recovery', 'habits', 'logging', 'body']) {
      expect(visualOf(domain)).not.toEqual(visualOf('general'))
    }
  })

  test('the wash follows the OUTCOME: flagged = domain colour, fine = calm, unmeasurable = muted', () => {
    expect(washOf(rule({ outcome: 'raised', disposition: 'logged', domain: 'sleep' })))
      .toBe(visualOf('sleep').wash)
    expect(washOf(rule({ outcome: 'clear', domain: 'sleep' }))).toBe('sage')
    expect(washOf(rule({ outcome: 'unavailable', domain: 'sleep' }))).toBe('white')
  })
})

describe('the day, summarised', () => {
  const day = mockCoachingDay('2026-09-03')

  test('the split counts every rule exactly once', () => {
    const s = splitOf(day)
    expect(s.total).toBe(day.rules.length)
    expect(s.raised + s.suppressed + s.clear + s.unavailable).toBe(s.total)
    expect(s.raised).toBeGreaterThan(0)
    expect(s.suppressed).toBeGreaterThan(0)
  })

  test('the winner comes from day.winner, never from a cardOutcome guess (mezo-y43v)', () => {
    expect(winnerRuleOf(day)?.flagKey).toBe(day.winner?.flagKey)
    // A day whose winner has since gone clear still names it — and a stray `won` on some other
    // rule must not be able to hijack the badge.
    const drifted = {
      ...day,
      rules: day.rules.map((r) =>
        r.flagKey === day.winner?.flagKey
          ? { ...r, outcome: 'clear' as const, disposition: undefined, cardOutcome: undefined }
          : r),
    }
    expect(winnerRuleOf(drifted)?.flagKey).toBe(day.winner?.flagKey)
    expect(winnerRuleOf({ ...day, winner: undefined })).toBeUndefined()
  })

  test('the beaten candidates are the other logged raises, in severity order', () => {
    const losers = losersOf(day)
    expect(losers.map((r) => r.flagKey)).not.toContain(day.winner?.flagKey)
    losers.forEach((r) => expect(r.cardOutcome).toBe('lost'))
    expect(losers.map((r) => r.rank)).toEqual([...losers.map((r) => r.rank)].sort((a, b) => a - b))
  })
})

describe('the small copy', () => {
  test('hhmm renders the local wall clock of an instant', () => {
    const iso = '2026-09-03T14:00:00Z'
    const d = new Date(iso)
    const expected = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    expect(hhmm(iso)).toBe(expected)
  })

  test('the day label says ma / tegnap, then the date', () => {
    expect(dayLabel('2026-09-06', '2026-09-06')).toBe('ma')
    expect(dayLabel('2026-09-05', '2026-09-06')).toBe('tegnap')
    expect(dayLabel('2026-09-01', '2026-09-06')).toContain('szept')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd frontend && pnpm test src/features/insights/logic/coachingCopy.test.ts
```

Expected: FAIL — `Failed to resolve import "@/features/insights/logic/coachingCopy"`.

- [ ] **Step 3: Write the module**

```ts
// ============================================================
// Mezo · Proaktív coaching — the observer's screen vocabulary (mezo-6269.3).
// Spec 2026-09-05 §6. The ONLY frontend-side interpretation of the trace:
// four state words, one domain → wash/icon map with a safe fallback, and a
// handful of counts. There is deliberately NO per-flagKey map here — the
// server sends `label`, `domain`, `reasonText` and `facts` precisely so a
// round-2 rule appears without a frontend change (spec §5).
// ============================================================
import { huMonthDay } from '@/shared/lib/dates'
import type { ClayIconName } from '@/shared/ui/clay'
import type { MozaikWash } from '@/shared/ui/mozaik'
import type { CoachingRule, CoachingTraceDay } from '@/data/types'

/** The four things a rule can BE on screen. `suppressed` is not a wire outcome: it is
 *  `raised` + `suppressed_by_cooldown`, i.e. "true, but it spoke recently" — the answer to
 *  „miért nem látom", and the one state round 1 threw away entirely. */
export type CoachingState = 'raised' | 'suppressed' | 'clear' | 'unavailable'

export function stateOf(rule: CoachingRule): CoachingState {
  if (rule.outcome !== 'raised') return rule.outcome
  return rule.disposition === 'suppressed_by_cooldown' ? 'suppressed' : 'raised'
}

/** Screen copy, verbatim from the spec's state vocabulary (§6). */
export const STATE_LABEL: Record<CoachingState, string> = {
  raised: 'Jelzett',
  suppressed: 'Pihenőn',
  clear: 'Rendben',
  unavailable: 'Nem mérhető',
}

export const WINNER_LABEL = 'Nyertes'

/** `mzp-stch` modifiers — the Diagnózis chip recipe, reused rather than re-invented. */
export const STATE_CHIP: Record<CoachingState, string> = {
  raised: 'act',
  suppressed: 'pend',
  clear: 'ok',
  unavailable: 'mut',
}

/** domain → the tile's colour wash and clay icon. The server owns the DOMAIN; this owns how a
 *  domain LOOKS. Fallback is not defensive dressing: it is the mechanism that lets a round-2 rule
 *  ship backend-only (`FlagCatalog.DOMAIN_FALLBACK` is literally `general`). */
const DOMAIN_VISUAL: Record<string, { wash: MozaikWash; icon: ClayIconName }> = {
  sleep: { wash: 'lav', icon: 'i-alvas' },
  training: { wash: 'coral', icon: 'i-edzes' },
  nutrition: { wash: 'sage', icon: 'i-fuel' },
  recovery: { wash: 'sky', icon: 'i-hold' },
  habits: { wash: 'gold', icon: 'i-lang' },
  logging: { wash: 'white', icon: 'i-naplo' },
  body: { wash: 'rose', icon: 'i-suly' },
}

const FALLBACK_VISUAL: { wash: MozaikWash; icon: ClayIconName } = { wash: 'white', icon: 'i-mezo' }

export function visualOf(domain: string): { wash: MozaikWash; icon: ClayIconName } {
  return DOMAIN_VISUAL[domain] ?? FALLBACK_VISUAL
}

/** Spec §6.3: flagged = domain colour, fine = calm, unmeasurable = muted. The domain colour is
 *  spent on the rules that have something to say. */
export function washOf(rule: CoachingRule): MozaikWash {
  const state = stateOf(rule)
  if (state === 'raised' || state === 'suppressed') return visualOf(rule.domain).wash
  return state === 'clear' ? 'sage' : 'white'
}

export interface CoachingSplit {
  raised: number
  suppressed: number
  clear: number
  unavailable: number
  total: number
}

export function splitOf(day: CoachingTraceDay): CoachingSplit {
  const split: CoachingSplit = { raised: 0, suppressed: 0, clear: 0, unavailable: 0, total: 0 }
  for (const rule of day.rules) {
    split[stateOf(rule)] += 1
    split.total += 1
  }
  return split
}

/** The day's card, resolved to its rule. From `day.winner` ONLY — `cardOutcome` describes a rule's
 *  state at the decision instant and is null once that rule has changed since, so inferring the
 *  winner from it renders „Nyertes" on nothing at all some days (bd mezo-y43v). */
export function winnerRuleOf(day: CoachingTraceDay): CoachingRule | undefined {
  const key = day.winner?.flagKey
  return key == null ? undefined : day.rules.find((r) => r.flagKey === key)
}

/** „Miért ez nyert" — the raises that were on the table and lost, most severe first. The array is
 *  already in severity order, so this only filters. */
export function losersOf(day: CoachingTraceDay): CoachingRule[] {
  return day.rules.filter((r) => r.cardOutcome === 'lost')
}

/** The local wall clock of an instant — the house idiom (`humanGeneratedAt`, `buildDayPlan`). */
export function hhmm(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function dayLabel(date: string, today: string): string {
  if (date === today) return 'ma'
  const yesterday = new Date(`${today}T12:00:00`)
  yesterday.setDate(yesterday.getDate() - 1)
  const iso = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
  return date === iso ? 'tegnap' : huMonthDay(date).toLowerCase()
}
```

> Verify the two icon names that are not already used on a Mező surface before running (`grep -n "i-hold\|i-lang\|i-alvas\|i-suly\|i-naplo\|i-fuel\|i-edzes\|i-mezo" frontend/src/shared/ui/clay/index.tsx`). All eight are in `ClayIconName`; if a future rename breaks one, TypeScript fails the build rather than rendering a blank.

- [ ] **Step 4: Run the test and confirm it passes**

```bash
cd frontend && pnpm test src/features/insights/logic/coachingCopy.test.ts && VITE_USE_MOCK=false pnpm test src/features/insights/logic/coachingCopy.test.ts
```

Expected: PASS in both modes (the module is pure — the second run guards against an accidental mode-dependent import).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/insights/logic/coachingCopy.ts frontend/src/features/insights/logic/coachingCopy.test.ts && git commit -m "feat(insights): the coaching observer's screen vocabulary and domain visuals (mezo-6269.3)"
```

---

### Task 3: The data layer the pages consume

Three small gaps S2 left: the trace hook is not on the `@/data/hooks` barrel (so no page may import it yet, per the four-layer rule), the mock's `earliestDate` is a fixed literal that lands *after* the visual harness's frozen clock (the day pager would be dead in every golden), and there is no hook for the day's card — the companion feed mock is `[]`, so the card page would be empty in mock mode and in the visual job.

**Files:**
- Modify: `frontend/src/data/insights/coachingTraceMock.ts:64`
- Create: `frontend/src/data/insights/coachingCardMock.ts`
- Create: `frontend/src/data/insights/coachingCardHooks.ts`
- Test: `frontend/src/data/insights/coachingCardHooks.test.tsx`
- Modify: `frontend/src/data/hooks.ts`

**Interfaces:**
- Consumes: `mockCoachingDay` (S2), `feedApi.get(date): Promise<FeedMessage[]>`, `useDualQuery`.
- Produces: `useCoachingCard(date: string): { card: FeedMessage | null; isPending: boolean; isError: boolean }` and `mockCoachingCard(date: string): FeedMessage`, both re-exported from `@/data/hooks`, plus `useCoachingTrace` on the same barrel.

- [ ] **Step 1: Write the failing test**

```tsx
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mockCoachingCard } from '@/data/insights/coachingCardMock'
import { useCoachingCard } from '@/data/insights/coachingCardHooks'
import { mockCoachingDay } from '@/data/insights/coachingTraceMock'
import { API_BASE } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'

describe('mock mode', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('the demo card IS the demo day’s winner — the two seeds cannot drift apart', () => {
    const { result } = renderHook(() => useCoachingCard('2026-09-03'),
      { wrapper: makeHookWrapper() })
    const day = mockCoachingDay('2026-09-03')
    expect(result.current.card?.flagKey).toBe(day.winner?.flagKey)
    expect(result.current.card?.id).toBe(day.winner?.cardId)
    expect(result.current.card?.kind).toBe('advice')
    expect(result.current.card?.actions?.length).toBeGreaterThan(0)
    expect(result.current.isPending).toBe(false)
  })

  test('the demo card carries the winner’s own evidence lines', () => {
    const day = mockCoachingDay('2026-09-03')
    const winner = day.rules.find((r) => r.flagKey === day.winner?.flagKey)
    expect(mockCoachingCard('2026-09-03').facts).toEqual(winner?.facts)
  })
})

describe('real mode', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('picks the day’s ONE advice row out of the feed', async () => {
    server.use(http.get(`${API_BASE}/api/proactive/feed`, () => HttpResponse.json([
      { id: 'm1', kind: 'morning', eyebrow: 'Reggel', body: ['jó reggelt'], refs: [],
        generatedAt: '2026-09-03T06:00:00Z' },
      { id: 'm2', kind: 'advice', eyebrow: 'Alvás', body: ['aludj többet'], refs: [],
        facts: ['x'], suggestions: ['y'], flagKey: 'sleep_debt',
        actions: [{ key: 'shift_sleep_anchor', label: 'Korábbi lefekvés' }],
        generatedAt: '2026-09-03T08:00:00Z' },
    ])))
    const { result } = renderHook(() => useCoachingCard('2026-09-03'),
      { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.card?.id).toBe('m2'))
    expect(result.current.card?.flagKey).toBe('sleep_debt')
  })

  test('an unresolved fetch is null, never the demo card', () => {
    const { result } = renderHook(() => useCoachingCard('2026-09-03'),
      { wrapper: makeHookWrapper() })
    expect(result.current.isPending).toBe(true)
    expect(result.current.card).toBeNull()
  })

  test('a day with no advice row is honestly empty, not an error', async () => {
    server.use(http.get(`${API_BASE}/api/proactive/feed`, () => HttpResponse.json([])))
    const { result } = renderHook(() => useCoachingCard('2026-09-03'),
      { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.card).toBeNull()
    expect(result.current.isError).toBe(false)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd frontend && pnpm test src/data/insights/coachingCardHooks.test.tsx
```

Expected: FAIL — the two new modules do not resolve.

- [ ] **Step 3: Write the mock card**

`frontend/src/data/insights/coachingCardMock.ts`:

```ts
import { mockCoachingDay } from '@/data/insights/coachingTraceMock'
import type { FeedMessage } from '@/data/types'

/**
 * The demo day's delivered card (mezo-6269.3). Derived FROM `mockCoachingDay` rather than typed out
 * beside it: the observer and the card page are two views of ONE decision, and a hand-copied
 * winner would let them drift into showing different rules — the exact incoherence this feature
 * exists to remove. The real companion feed mock stays `[]` (Phase-1 byte parity, and the Nap
 * thread's own goldens depend on it) — this seed is scoped to the coaching surface.
 */
export function mockCoachingCard(date: string): FeedMessage {
  const day = mockCoachingDay(date)
  const winner = day.rules.find((r) => r.flagKey === day.winner?.flagKey)
  return {
    id: day.winner?.cardId ?? 'mock-card-1',
    kind: 'advice',
    eyebrow: winner?.label ?? 'A nap kártyája',
    body: [{ type: 'p', text: 'A heti terhelésed magas, a bevitel viszont a cél alatt maradt. Ma tegyél be egy tisztességes ebédet — nem hősködés, csak fedezet.' }],
    refs: [],
    facts: winner?.facts ?? [],
    suggestions: ['Egy plusz szénhidrátos fogás ebédre.', 'Edzés után 30 percen belül egyél.'],
    flagKey: winner?.flagKey,
    actions: [{ key: 'lighten_tomorrow', label: 'Könnyítsd a holnapot' }],
    generatedAt: `${date}T08:00:00Z`,
  }
}
```

> `actions[].key` must be a real `AdviceActionKey` member — check with `grep -n "AdviceActionKey" -A 6 frontend/src/data/types.ts` and pick one that exists; `lighten_tomorrow` is in `ACTION_INVALIDATES` today.

- [ ] **Step 4: Write the hook**

`frontend/src/data/insights/coachingCardHooks.ts`:

```ts
import { mockCoachingCard } from '@/data/insights/coachingCardMock'
import { feedApi } from '@/data/today/feedApi'
import { useDualQuery, DEFAULT_QUERY_STALE_TIME_MS } from '@/data/useDualQuery'
import { localDateString } from '@/shared/lib/dates'
import type { FeedMessage } from '@/data/types'

/**
 * The ONE advice card delivered on `date` (mezo-6269.3) — the coaching surface's own read of the
 * companion feed. Not `useCompanionFeed`: that hook swallows a failed fetch into `[]`, which the
 * card page cannot tell apart from "no card today". Here the two are different screens, so the
 * read goes through `useDualQuery` and keeps `isPending`/`isError` honest. The query key is the
 * feed's own prefix + date, so `useAdviceActions`' invalidation of `['companionFeed']` refreshes
 * this card too — the applied state stays server-driven, with no second action path.
 */
export function useCoachingCard(date: string = localDateString()): {
  card: FeedMessage | null
  isPending: boolean
  isError: boolean
} {
  const { data, isPending, isError } = useDualQuery<FeedMessage | null>({
    queryKey: ['companionFeed', date, 'advice'],
    mockData: mockCoachingCard(date),
    realFetch: () => feedApi.get(date).then((rows) => rows.find((m) => m.kind === 'advice') ?? null),
    realEmpty: null,
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
  })
  return { card: data, isPending, isError }
}
```

- [ ] **Step 5: Make the demo day's floor follow the day it is asked for**

In `frontend/src/data/insights/coachingTraceMock.ts`, replace the fixed `earliestDate: '2026-08-28'` with a derived one, and import `addDays`:

```ts
import { addDays } from '@/shared/lib/dates'
```

```ts
    // Derived, not a literal: the visual harness freezes the clock in MAY, so a fixed August
    // floor made the day pager's „vissza" dead in every golden — and dead in `pnpm dev` on any
    // day outside that window. Thirteen days is enough to page through and still hit a floor.
    earliestDate: addDays(date, -13),
```

- [ ] **Step 6: Put both hooks on the barrel**

In `frontend/src/data/hooks.ts`, beside the other `@/data/insights/*` lines:

```ts
export { useCoachingTrace } from '@/data/insights/coachingTraceHooks'
export { useCoachingCard } from '@/data/insights/coachingCardHooks'
```

- [ ] **Step 7: Run the tests and confirm they pass**

```bash
cd frontend && pnpm test src/data/insights/ && VITE_USE_MOCK=false pnpm test src/data/insights/
```

Expected: PASS in both modes, including S2's existing `coachingTraceHooks.test.tsx` (no test asserts the old `earliestDate` literal).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/data && git commit -m "feat(insights): the day's coaching card hook and its demo seed (mezo-6269.3)"
```

---

### Task 4: The two presentational pieces and their CSS

**Files:**
- Create: `frontend/src/features/insights/components/VerdictArc.tsx`
- Test: `frontend/src/features/insights/components/VerdictArc.test.tsx`
- Create: `frontend/src/features/insights/components/CoachingRuleTile.tsx`
- Test: `frontend/src/features/insights/components/CoachingRuleTile.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (new section after the Diagnózis block, `grep -n "Diagnózis (mezo-hqfi.4)" frontend/src/styles/prototype.css`)

**Why not `CollapsibleStrip`:** the shared strip's header takes a `string` eyebrow and has no slot for a rank badge or a clay icon, and spec §6.3 needs both plus an outcome wash. Widening the shared primitive for one caller would push feature semantics into `shared/ui` (which must stay domain-free). `CoachingRuleTile` therefore owns its own header but copies the strip's interaction contract exactly: a `<button aria-expanded aria-controls>` toggling a `hidden` body.

**Interfaces:**
- Consumes: `stateOf`, `washOf`, `visualOf`, `STATE_LABEL`, `STATE_CHIP`, `WINNER_LABEL` (Task 2); `CoachingRule`, `CoachingSplit`.
- Produces:
  - `<VerdictArc split={CoachingSplit} size?: number />`
  - `<CoachingRuleTile rule={CoachingRule} winner?: boolean delayMs?: number />`

- [ ] **Step 1: Write the failing tests**

`VerdictArc.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { VerdictArc } from '@/features/insights/components/VerdictArc'

describe('VerdictArc', () => {
  test('draws one segment per rule — the arc IS the day, not a decoration', () => {
    const { container } = render(
      <VerdictArc split={{ raised: 2, suppressed: 1, clear: 8, unavailable: 3, total: 14 }} />,
    )
    expect(container.querySelectorAll('.mzo-arcseg')).toHaveLength(14)
  })

  test('says the split in words for a screen reader', () => {
    render(<VerdictArc split={{ raised: 2, suppressed: 1, clear: 8, unavailable: 3, total: 14 }} />)
    expect(screen.getByRole('img', { name: '2 jelzett, 1 pihenőn, 8 rendben, 3 nem mérhető' }))
      .toBeInTheDocument()
  })

  test('an unresolved day draws nothing rather than an empty ring of fabricated calm', () => {
    const { container } = render(
      <VerdictArc split={{ raised: 0, suppressed: 0, clear: 0, unavailable: 0, total: 0 }} />,
    )
    expect(container.querySelector('svg')).toBeNull()
  })
})
```

`CoachingRuleTile.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { CoachingRuleTile } from '@/features/insights/components/CoachingRuleTile'
import type { CoachingRule } from '@/data/types'

const rule = (over: Partial<CoachingRule> = {}): CoachingRule => ({
  flagKey: 'sleep_debt', label: 'Alvásadósság', domain: 'sleep', rank: 6,
  outcome: 'clear', reasonText: 'alvás 6,8 h átlag — a 6,0 h küszöb fölött',
  facts: ['Mért érték: 6,8 · küszöb: 6,0'], ...over,
})

describe('CoachingRuleTile', () => {
  test('shows rank, name, state and the one evidence line without being opened', () => {
    render(<CoachingRuleTile rule={rule()} />)
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('Alvásadósság')).toBeInTheDocument()
    expect(screen.getByText('Rendben')).toBeInTheDocument()
    expect(screen.getByText('alvás 6,8 h átlag — a 6,0 h küszöb fölött')).toBeInTheDocument()
  })

  test('tapping expands the evidence rows', async () => {
    render(<CoachingRuleTile rule={rule()} />)
    const head = screen.getByRole('button', { name: /Alvásadósság/ })
    expect(head).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(head)
    expect(head).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Mért érték: 6,8 · küszöb: 6,0')).toBeVisible()
  })

  test('a rule with nothing to show is not expandable — no empty drawer', () => {
    render(<CoachingRuleTile rule={rule({ outcome: 'unavailable', facts: [] })} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Nem mérhető')).toBeInTheDocument()
  })

  test('a cooldown-suppressed raise reads Pihenőn — it does not vanish', () => {
    render(<CoachingRuleTile rule={rule({ outcome: 'raised', disposition: 'suppressed_by_cooldown' })} />)
    expect(screen.getByText('Pihenőn')).toBeInTheDocument()
  })

  test('the winner carries the gold ring and the Nyertes stamp', () => {
    const { container } = render(<CoachingRuleTile rule={rule()} winner />)
    expect(screen.getByText('Nyertes')).toBeInTheDocument()
    expect(container.querySelector('.mzo-rule.is-winner')).not.toBeNull()
  })

  test('a rule the frontend has never seen renders whole (the round-2 guarantee)', () => {
    render(<CoachingRuleTile rule={rule({
      flagKey: 'round_two_rule', label: 'Új szabály', domain: 'something_new', rank: 1,
      reasonText: 'Rendben.', facts: [],
    })} />)
    expect(screen.getByText('Új szabály')).toBeInTheDocument()
    expect(screen.getByText('Rendben')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run them and watch them fail**

```bash
cd frontend && pnpm test src/features/insights/components/VerdictArc.test.tsx src/features/insights/components/CoachingRuleTile.test.tsx
```

Expected: FAIL — neither component resolves.

- [ ] **Step 3: Write `VerdictArc`**

```tsx
// ============================================================
// Mezo · Proaktív coaching — the day's verdict split as a graphic (mezo-6269.3).
// Data drawn as a graphic, per design 2.0: one segment per rule, in state
// order, so the ring IS the day. Tokens only — dark mode follows.
// ============================================================
import type { CoachingSplit } from '@/features/insights/logic/coachingCopy'

const STATE_STROKE: Array<[keyof Omit<CoachingSplit, 'total'>, string, string]> = [
  ['raised', 'var(--mz-stch-act-ink)', 'jelzett'],
  ['suppressed', 'var(--mz-stch-pend-ink)', 'pihenőn'],
  ['clear', 'var(--mz-stch-ok-ink)', 'rendben'],
  ['unavailable', 'var(--mz-stch-mut-ink)', 'nem mérhető'],
]

/** The split as a segmented ring. Renders NOTHING when the day has no rules — an unresolved or
 *  never-evaluated day must not draw a full circle of calm (the honest-states rule). */
export function VerdictArc({ split, size = 96 }: { split: CoachingSplit; size?: number }) {
  if (split.total === 0) return null
  const r = size / 2 - 7
  const c = 2 * Math.PI * r
  const seg = c / split.total
  const gap = Math.min(3, seg * 0.35)
  const label = STATE_STROKE
    .filter(([key]) => split[key] > 0)
    .map(([key, , word]) => `${split[key]} ${word}`)
    .join(', ')

  let index = 0
  const segments = STATE_STROKE.flatMap(([key, stroke]) =>
    Array.from({ length: split[key] }, () => {
      const offset = -index * seg
      index += 1
      return (
        <circle key={`${key}-${index}`} className="mzo-arcseg" cx={size / 2} cy={size / 2} r={r}
          stroke={stroke} strokeDasharray={`${seg - gap} ${c - seg + gap}`} strokeDashoffset={offset} />
      )
    }),
  )

  return (
    <svg className="mzo-arc" width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      role="img" aria-label={label}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>{segments}</g>
    </svg>
  )
}
```

- [ ] **Step 4: Write `CoachingRuleTile`**

```tsx
// ============================================================
// Mezo · Proaktív coaching — one rule's verdict (mezo-6269.3).
// Spec 2026-09-05 §6.3. Poster anatomy, not a settings row: rank badge,
// clay icon by domain, wash by outcome, state chip, one evidence line —
// and the frozen numbers behind it one tap away. Generated from the
// server's fields alone; there is no per-flagKey markup anywhere.
// Not `CollapsibleStrip`: its header takes a plain-string eyebrow and has
// no rank/icon slot, and widening it for one caller would put feature
// semantics into the domain-free shared kit. The interaction contract is
// copied verbatim (aria-expanded + aria-controls + a hidden body).
// ============================================================
import { useId, useState } from 'react'
import { ClayIcon } from '@/shared/ui/clay'
import { cn } from '@/shared/lib/cn'
import {
  STATE_CHIP, STATE_LABEL, WINNER_LABEL, stateOf, visualOf, washOf,
} from '@/features/insights/logic/coachingCopy'
import type { CoachingRule } from '@/data/types'

export function CoachingRuleTile({ rule, winner = false, delayMs = 0 }: {
  rule: CoachingRule
  /** The day's card came from this rule — read from `day.winner`, NEVER from `cardOutcome`
   *  (mezo-y43v): a winner that has since gone clear reports no card outcome at all. */
  winner?: boolean
  delayMs?: number
}) {
  const [open, setOpen] = useState(false)
  const bodyId = useId()
  const state = stateOf(rule)
  const expandable = rule.facts.length > 0

  const head = (
    <>
      <span className={rule.rank === 1 ? 'mzp-rankb' : 'mzp-rankb two'}>{rule.rank}</span>
      <ClayIcon name={visualOf(rule.domain).icon} size={26} />
      <span className="mzo-rule-nm">{rule.label}</span>
      {winner && <span className="mzp-stch prop">{WINNER_LABEL}</span>}
      <span className={`mzp-stch ${STATE_CHIP[state]}`}>{STATE_LABEL[state]}</span>
      {expandable && <span className="mz-chev" aria-hidden="true">▾</span>}
    </>
  )

  return (
    <div className={cn('mzo-rule', `mz-w-${washOf(rule)}`, 'rise', winner && 'is-winner', open && 'open')}
      style={{ '--d': `${delayMs}ms` } as React.CSSProperties}>
      {expandable ? (
        <button type="button" className="mzo-rule-head" aria-expanded={open} aria-controls={bodyId}
          onClick={() => setOpen((o) => !o)}>
          {head}
        </button>
      ) : (
        <div className="mzo-rule-head">{head}</div>
      )}
      <div className="mzo-rule-why">{rule.reasonText}</div>
      {expandable && (
        <div className="mzo-rule-body" id={bodyId} hidden={!open}>
          {rule.facts.map((fact, i) => (
            <div key={i} className="mzp-evrow"><span className="vl">{fact}</span></div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Add the CSS**

Append to `frontend/src/styles/prototype.css`, directly after the Diagnózis section. The prefix is `mzo-` (**m**e**z**o **o**bserver) — `mzc-` is already the chat family's 112 rules, and two unrelated features sharing a prefix is how a stylesheet stops being greppable:

```css
/* ===== Proaktív coaching megfigyelő (mezo-6269.3) — a döntés mint felület.
   Anatómia: rangjelvény + clay ikon + állapotcsip egy sorban, alatta EGY
   bizonyítéksor, kinyitva a fagyasztott számok. A mosás a VERDIKTÉ (jelzett =
   domén-szín, rendben = nyugodt, nem mérhető = tompa) — a színt arra költjük,
   aminek mondanivalója van. Csak tokenek, így a sötét mód magától követi. ===== */
.mzo-rule { border-radius: 21px; padding: 11px 13px;
  /* .mz-w-* only SETS --mz-wash (see .mz-tile) — the background is the consumer's job. */
  background: var(--mz-wash, var(--mz-wash-white)); }
.mzo-rule.is-winner { border: 1px solid var(--mz-decring); box-shadow: var(--mz-shadow-dec); }
.mzo-rule-head { display: flex; align-items: center; gap: 8px; width: 100%;
  background: none; border: 0; padding: 0; text-align: left; color: inherit; }
.mzo-rule-nm { font-size: 13px; font-weight: 700; }
.mzo-rule-head .mzp-stch { margin-left: auto; }
.mzo-rule-head .mzp-stch + .mzp-stch { margin-left: 0; }
.mzo-rule-head .mz-chev { transition: transform 0.18s ease; }
.mzo-rule.open .mzo-rule-head .mz-chev { transform: rotate(180deg); }
.mzo-rule-why { font-size: 11px; font-weight: 300; line-height: 1.45; margin-top: 6px;
  color: var(--mz-ink-soft); }
.mzo-rule-body { margin-top: 6px; }

/* A nap váltója — a Fuel napléptető (.flog-daysw) idiómája, coaching hangnemben. */
.mzo-daysw { display: flex; align-items: center; justify-content: center; gap: 12px; }
.mzo-daysw button { width: 30px; height: 30px; border-radius: 11px; border: 0;
  background: var(--mz-wash-white); box-shadow: var(--mz-shadow-lav); font-size: 15px;
  color: var(--mz-ink-soft); }
.mzo-daysw button:disabled { opacity: 0.35; box-shadow: none; }
.mzo-dlbl { display: flex; flex-direction: column; align-items: center; min-width: 108px; }
.mzo-dlbl b { font-size: 14px; font-weight: 800; }
.mzo-dlbl small { font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--mz-ink-mut); }

/* A nap idővonala — csak akkor, ha VOLT változás (üres doboz helyett semmi). */
.mzo-tl { display: flex; flex-direction: column; gap: 7px; }
.mzo-tlrow { display: flex; align-items: baseline; gap: 8px; font-size: 11px; font-weight: 300; }
.mzo-tlrow .tm { font-size: 10px; font-weight: 800; font-variant-numeric: tabular-nums;
  color: var(--mz-ink-mut); flex: none; }
.mzo-tlrow .nm { font-weight: 700; flex: none; }

/* A verdikt-gyűrű: szabályonként egy szegmens. */
.mzo-arc { display: block; }
.mzo-arcseg { fill: none; stroke-width: 7; stroke-linecap: round; }

/* „Miért ez nyert" — a legyőzött jelöltek rangsora (ez sehol máshol nincs az appban). */
.mzo-loser { display: flex; align-items: center; gap: 8px; font-size: 11px; padding: 6px 0;
  border-bottom: 0.5px dashed var(--mz-chat-refch-bd); }
.mzo-loser:last-of-type { border-bottom: none; }
.mzo-loser .nm { font-weight: 700; }
.mzo-loser .rk { margin-left: auto; font-size: 10px; color: var(--mz-ink-mut);
  font-variant-numeric: tabular-nums; }
```

> The hairline is `var(--mz-chat-refch-bd)` — the exact token `.mzp-evrow` already uses, so the two evidence families stay identical. Re-check with `grep -n "mzp-evrow" -A 2 frontend/src/styles/prototype.css` before typing it.

- [ ] **Step 6: Run the tests and confirm they pass**

```bash
cd frontend && pnpm test src/features/insights/components/ && VITE_USE_MOCK=false pnpm test src/features/insights/components/
```

Expected: PASS in both modes.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/insights/components frontend/src/styles/prototype.css && git commit -m "feat(insights): the rule tile and the verdict arc (mezo-6269.3)"
```

---

### Task 5: `/mezo/coaching` — the hub

**Files:**
- Create: `frontend/src/features/insights/pages/CoachingHubPage.tsx`
- Test: `frontend/src/features/insights/pages/CoachingHubPage.test.tsx`
- Modify: `frontend/src/app/router.tsx` (beside the `mezo/diagnozis` registrations)

**Interfaces:**
- Consumes: `useCoachingTrace` (barrel, Task 3); `splitOf`, `winnerRuleOf`, `stateOf`, `STATE_LABEL` (Task 2); `VerdictArc` (Task 4).
- Produces: the route `/mezo/coaching` and the two tile targets `/mezo/coaching/megfigyelo` and `/mezo/coaching/kartya` (registered in Tasks 6 and 7).

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { QueryWrapper } from '@/test/queryWrapper'
import { CoachingHubPage } from '@/features/insights/pages/CoachingHubPage'

const renderPage = () =>
  render(<MemoryRouter><CoachingHubPage /></MemoryRouter>, { wrapper: QueryWrapper })

describe('CoachingHubPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('leads with the winner and its rank, then the split and the two doors', async () => {
    renderPage()
    expect(screen.getByText('Proaktív coaching')).toBeInTheDocument()
    // The winner is named from day.winner — the demo day's rank-2 rule.
    expect(await screen.findByText('Terhelés–táplálás')).toBeInTheDocument()
    expect(screen.getByText('2/14')).toBeInTheDocument()
    // The split, as cells: 2 jelzett + 1 pihenőn + 8 rendben + 3 nem mérhető in the demo day.
    expect(screen.getByText('Jelzett')).toBeInTheDocument()
    expect(screen.getByText('Pihenőn')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Megfigyelő' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'A napi kártya' })).toBeInTheDocument()
  })

  test('the arc draws one segment per rule', () => {
    const { container } = renderPage()
    expect(container.querySelectorAll('.mzo-arcseg')).toHaveLength(14)
  })
})

describe('CoachingHubPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('an unresolved day fabricates nothing — no zero split, no winner', () => {
    const { container } = renderPage()
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(container.querySelectorAll('.mzo-arcseg')).toHaveLength(0)
    expect(screen.queryByText('Terhelés–táplálás')).not.toBeInTheDocument()
  })

  test('a genuinely empty day says so instead of showing a blank', async () => {
    renderPage()
    await waitFor(() =>
      expect(screen.getByText('Még nem futott kiértékelés — az első után itt látod a döntést.'))
        .toBeInTheDocument())
  })
})
```

> The demo day's exact split (2/1/8/3 of 14) is what `mockCoachingDay` seeds today. If a round-2 rule joins the seed, update the two literals — or derive them from `mockCoachingDay` in the test, which is what `coachingTraceHooks.test.tsx` already does for its own counts.

- [ ] **Step 2: Run it and watch it fail**

```bash
cd frontend && pnpm test src/features/insights/pages/CoachingHubPage.test.tsx
```

Expected: FAIL — the page does not resolve.

- [ ] **Step 3: Write the page**

```tsx
// ============================================================
// Mezo · Proaktív coaching — a hub (mezo-6269.3, spec 2026-09-05 §6.2).
// A döntés maga a felület: a nyertes posztere ranggal, a nap 14 verdiktjének
// megoszlása gyűrűként és cellákként, alatta a két ajtó (Megfigyelő · A napi
// kártya). Semmit nem számol újra — a szerver mondatait rendezi képpé.
// Őszinte állapotok: betöltés / hiba / még sosem futott kiértékelés.
// ============================================================
import { useNavigate } from 'react-router-dom'
import { Mosaic, MozaikPage, PageBody, PageHead, PageHero, StatCell, StatStrip, Tile } from '@/shared/ui/mozaik'
import { EntranceGroup, useCountUp } from '@/shared/ui/mozaik/motion'
import { useCoachingTrace } from '@/data/hooks'
import { VerdictArc } from '@/features/insights/components/VerdictArc'
import { STATE_LABEL, splitOf, winnerRuleOf } from '@/features/insights/logic/coachingCopy'

export function CoachingHubPage() {
  const navigate = useNavigate()
  const { day, isPending, isError } = useCoachingTrace()
  const split = splitOf(day)
  const winner = winnerRuleOf(day)
  const flagged = useCountUp(split.raised + split.suppressed)
  const empty = !isPending && !isError && split.total === 0

  return (
    <MozaikPage tone="gold">
      <PageHead onBack={() => navigate('/mezo')} label="‹ Mezo" />
      <PageHero spot="s-orb-figyel" iconSize={54} name="Proaktív coaching"
        big={split.total === 0 ? undefined : flagged}
        sub={split.total === 0 ? 'a motor döntése, ahogy megszületett' : `${split.total} szabály · ma ennyi jelzett`}>
        <VerdictArc split={split} />
      </PageHero>
      <PageBody principle="Ez a felület nem dönt — azt mutatja meg, mit döntött a motor, és mi alapján.">
        <EntranceGroup className="col gap-md">
          {isPending && <div className="card" style={{ padding: 18 }} aria-busy="true" />}
          {isError && (
            <div className="card" style={{ padding: 18, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--mz-ink-soft)' }}>
                Most nem tudom megmutatni a mai döntést — próbáld újra kicsit később.
              </p>
            </div>
          )}
          {empty && (
            <div className="card" style={{ padding: 18, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--mz-ink-soft)', lineHeight: 1.5 }}>
                Még nem futott kiértékelés — az első után itt látod a döntést.
              </p>
            </div>
          )}

          {/* A nap kártyája — a nyertes a day.winner-ből, sosem a cardOutcome-ból (mezo-y43v):
              egy szabály megnyerheti a napot és estére „Rendben"-re válthat. */}
          {winner != null && day.winner != null && (
            <div className="mzp-pred propcard rise" style={{ '--d': '0ms' } as React.CSSProperties}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="mzp-rankb">{`${day.winner.rank}/${split.total}`}</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{winner.label}</span>
                <span className="mzp-stch prop" style={{ marginLeft: 'auto' }}>Nyertes</span>
              </div>
              <p style={{ fontSize: 11, fontWeight: 300, lineHeight: 1.55, marginTop: 7 }}>
                {winner.reasonText}
              </p>
            </div>
          )}

          {split.total > 0 && (
            <StatStrip>
              <StatCell value={split.raised} label={STATE_LABEL.raised} />
              <StatCell value={split.suppressed} label={STATE_LABEL.suppressed} />
              <StatCell value={split.clear} label={STATE_LABEL.clear} />
              <StatCell value={split.unavailable} label={STATE_LABEL.unavailable} />
            </StatStrip>
          )}

          <Mosaic>
            <Tile wash="lav" icon="i-eletjel" eyebrow="Megfigyelő" delayMs={160} wide
              aria-label="Megfigyelő"
              line={split.total === 0 ? undefined : `mind a ${split.total} szabály, súlyossági sorrendben`}
              onClick={() => navigate('/mezo/coaching/megfigyelo')} />
            <Tile wash="gold" icon="i-level" eyebrow="A napi kártya" delayMs={200} wide
              aria-label="A napi kártya"
              line={winner?.label}
              onClick={() => navigate('/mezo/coaching/kartya')} />
          </Mosaic>
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
```

> `i-level` is a guess at the card-shaped clay icon — pick a real member of `ClayIconName` (`grep -n "ClayIconName" -A 14 frontend/src/shared/ui/clay/index.tsx`); `i-level` in that list or `i-ertesites` are both defensible for "the card the app sent you". Never an emoji.

- [ ] **Step 4: Register the route**

In `frontend/src/app/router.tsx`, beside the Diagnózis pair, with the lazy/eager import style the neighbours use:

```tsx
      // Proaktív coaching (mezo-6269.3) — the decision made visible: hub → Megfigyelő → a napi
      // kártya. Flat `/mezo/*` siblings, the `mezo/diagnozis` idiom; static segments only, so
      // no ordering hazard with a param route.
      { path: 'mezo/coaching', element: <CoachingHubPage /> },
```

- [ ] **Step 5: Run the tests and confirm they pass**

```bash
cd frontend && pnpm test src/features/insights/pages/CoachingHubPage.test.tsx && VITE_USE_MOCK=false pnpm test src/features/insights/pages/CoachingHubPage.test.tsx
```

Expected: PASS in both modes.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/insights/pages/CoachingHubPage.tsx frontend/src/features/insights/pages/CoachingHubPage.test.tsx frontend/src/app/router.tsx && git commit -m "feat(insights): the proactive coaching hub page (mezo-6269.3)"
```

---

### Task 6: `/mezo/coaching/megfigyelo` — the Observer

The slice's centrepiece: every rule, in severity order, for a chosen day — plus what changed inside that day.

**Files:**
- Create: `frontend/src/features/insights/pages/CoachingObserverPage.tsx`
- Test: `frontend/src/features/insights/pages/CoachingObserverPage.test.tsx`
- Modify: `frontend/src/app/router.tsx`

**Interfaces:**
- Consumes: `useCoachingTrace(date)`; `CoachingRuleTile` (Task 4); `splitOf`, `stateOf`, `hhmm`, `dayLabel`, `STATE_LABEL` (Task 2); `addDays`, `localDateString`, `huWeekdayFullIso` (`@/shared/lib/dates`).
- Produces: the route `/mezo/coaching/megfigyelo`, deep-linkable by `?d=YYYY-MM-DD`.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { QueryWrapper } from '@/test/queryWrapper'
import { CoachingObserverPage } from '@/features/insights/pages/CoachingObserverPage'
import { mockCoachingDay } from '@/data/insights/coachingTraceMock'
import { localDateString } from '@/shared/lib/dates'

const renderPage = (entry = '/mezo/coaching/megfigyelo') =>
  render(<MemoryRouter initialEntries={[entry]}><CoachingObserverPage /></MemoryRouter>,
    { wrapper: QueryWrapper })

describe('CoachingObserverPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders EVERY rule, in the severity order the server sent — the order is the decision', () => {
    const { container } = renderPage()
    const day = mockCoachingDay(localDateString())
    const names = Array.from(container.querySelectorAll('.mzo-rule-nm')).map((n) => n.textContent)
    expect(names).toEqual(day.rules.map((r) => r.label))
  })

  test('all five screen states are on the page, none of them silently dropped', () => {
    renderPage()
    expect(screen.getAllByText('Jelzett').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Rendben').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Nem mérhető').length).toBeGreaterThan(0)
    expect(screen.getByText('Pihenőn')).toBeInTheDocument()
    expect(screen.getByText('Nyertes')).toBeInTheDocument()
  })

  test('a rule opens onto its frozen numbers', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /Alvásadósság/ }))
    expect(screen.getByText(/Alvásadósság: 1,4 óra\/éjszaka/)).toBeVisible()
  })

  test('the day’s timeline lists what changed, with the local wall clock', () => {
    renderPage()
    expect(screen.getByText('A nap változásai')).toBeInTheDocument()
    expect(screen.getAllByText(/Késői evés/).length).toBeGreaterThan(0)
  })

  test('paging back asks for the previous day and stops at the floor', async () => {
    renderPage()
    const back = screen.getByRole('button', { name: 'Előző nap' })
    await userEvent.click(back)
    expect(screen.getByText('tegnap')).toBeInTheDocument()
    // Forward is live again once we have left today.
    expect(screen.getByRole('button', { name: 'Következő nap' })).toBeEnabled()
  })

  test('today cannot be paged forward — there is no tomorrow to explain', () => {
    renderPage()
    expect(screen.getByRole('button', { name: 'Következő nap' })).toBeDisabled()
    expect(screen.getByText('ma')).toBeInTheDocument()
  })
})

describe('CoachingObserverPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('an unresolved day shows no rule tiles at all — never 14 fabricated „Rendben"', () => {
    const { container } = renderPage()
    expect(container.querySelectorAll('.mzo-rule')).toHaveLength(0)
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  test('a day with nothing flagged says so, and a day with no changes shows no timeline box', async () => {
    renderPage()
    await waitFor(() =>
      expect(screen.getByText('Ezen a napon még nem futott kiértékelés.')).toBeInTheDocument())
    expect(screen.queryByText('A nap változásai')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd frontend && pnpm test src/features/insights/pages/CoachingObserverPage.test.tsx
```

Expected: FAIL — the page does not resolve.

- [ ] **Step 3: Write the page**

```tsx
// ============================================================
// Mezo · Megfigyelő — minden szabály verdiktje egy napra (mezo-6269.3,
// spec 2026-09-05 §6.3). A tábla SORRENDJE maga az információ: ez a rangsor
// választotta a napi kártyát. Nap-lapozó (a padló a szerver earliestDate-je),
// szabályonként egy csempe kinyíló bizonyítékkal, alul a nap átmenetei —
// utóbbi csak akkor, ha volt változás (üres doboz helyett semmi).
// Nulla per-flagKey markup: a szerver tömbjét rendereljük, ahogy jött.
// ============================================================
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useCoachingTrace } from '@/data/hooks'
import { CoachingRuleTile } from '@/features/insights/components/CoachingRuleTile'
import { dayLabel, hhmm, splitOf } from '@/features/insights/logic/coachingCopy'
import { addDays, huWeekdayFullIso, localDateString } from '@/shared/lib/dates'

export function CoachingObserverPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const today = localDateString()
  const asked = params.get('d')
  // A future ?d= is not an error worth a screen — it clamps to today, the FuelLogPage idiom.
  const date = asked != null && asked <= today ? asked : today

  const { day, isPending, isError } = useCoachingTrace(date)
  const split = splitOf(day)
  // The floor is the SERVER's: it knows when tracing started. While it is unknown (unresolved
  // fetch) paging back stays open rather than pretending there is no history.
  const canBack = day.earliestDate == null || date > day.earliestDate
  const canForward = date < today
  const empty = !isPending && !isError && split.total === 0

  const step = (deltaDays: number) => {
    const next = addDays(date, deltaDays)
    setParams((prev) => {
      const q = new URLSearchParams(prev)
      if (next === today) q.delete('d')
      else q.set('d', next)
      return q
    }, { replace: true })
  }

  return (
    <MozaikPage tone="lav">
      <PageHead onBack={() => navigate('/mezo/coaching')} label="‹ Coaching" />
      <PageHero name="Megfigyelő"
        sub={split.total === 0 ? undefined : `${split.raised + split.suppressed} jelzett · ${split.total} szabály`}>
        <div className="mzo-daysw">
          <button type="button" aria-label="Előző nap" disabled={!canBack} onClick={() => step(-1)}>‹</button>
          <span className="mzo-dlbl">
            <b>{dayLabel(date, today)}</b>
            <small>{huWeekdayFullIso(date).toLowerCase()}</small>
          </span>
          <button type="button" aria-label="Következő nap" disabled={!canForward} onClick={() => step(1)}>›</button>
        </div>
      </PageHero>
      <PageBody principle="A sorrend a döntés: felül a legsúlyosabb, és pontosan ebből választott a motor.">
        <EntranceGroup className="col gap-md">
          {isPending && <div className="card" style={{ padding: 18 }} aria-busy="true" />}
          {isError && (
            <div className="card" style={{ padding: 18, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--mz-ink-soft)' }}>
                Ezt a napot most nem tudom beolvasni — próbáld újra kicsit később.
              </p>
            </div>
          )}
          {empty && (
            <div className="card" style={{ padding: 18, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--mz-ink-soft)', lineHeight: 1.5 }}>
                Ezen a napon még nem futott kiértékelés.
              </p>
            </div>
          )}
          {split.total > 0 && split.raised + split.suppressed === 0 && (
            <p style={{ fontSize: 11, color: 'var(--mz-ink-soft)', textAlign: 'center' }}>
              Ma egy szabály sem jelzett — mind a {split.total} rendben.
            </p>
          )}

          {day.rules.map((rule, i) => (
            <CoachingRuleTile key={rule.flagKey} rule={rule}
              winner={rule.flagKey === day.winner?.flagKey} delayMs={40 + i * 30} />
          ))}

          {day.transitions.length > 0 && (
            <>
              <span className="mz-eyebrow" style={{ color: 'var(--mz-ink-soft)' }}>A nap változásai</span>
              <div className="mzo-tl">
                {day.transitions.map((t, i) => (
                  <div key={`${t.at}-${t.flagKey}-${i}`} className="mzo-tlrow">
                    <span className="tm">{hhmm(t.at)}</span>
                    <span className="nm">{t.label}</span>
                    <span>{t.reasonText}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
```

- [ ] **Step 4: Register the route**

```tsx
      { path: 'mezo/coaching/megfigyelo', element: <CoachingObserverPage /> },
```

- [ ] **Step 5: Run the tests and confirm they pass**

```bash
cd frontend && pnpm test src/features/insights/pages/CoachingObserverPage.test.tsx && VITE_USE_MOCK=false pnpm test src/features/insights/pages/CoachingObserverPage.test.tsx
```

Expected: PASS in both modes.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/insights/pages/CoachingObserverPage.tsx frontend/src/features/insights/pages/CoachingObserverPage.test.tsx frontend/src/app/router.tsx && git commit -m "feat(insights): the Megfigyelő — every rule's verdict for a day (mezo-6269.3)"
```

---

### Task 7: `/mezo/coaching/kartya` — the winning card and why it won

**Files:**
- Create: `frontend/src/features/insights/pages/CoachingCardPage.tsx`
- Test: `frontend/src/features/insights/pages/CoachingCardPage.test.tsx`
- Modify: `frontend/src/app/router.tsx`

**Interfaces:**
- Consumes: `useCoachingCard(date)` (Task 3), `useCoachingTrace(date)`, `useAdviceActions` (`@/data/hooks`), `losersOf`/`winnerRuleOf` (Task 2).
- Produces: the route `/mezo/coaching/kartya`.

**The action path is the existing one.** `useAdviceActions` + `ACTION_INVALIDATES`, with the applied state read from the server's `applied` stamp — never a disabled-button fake, never a second action path (`NapMezoPage.tsx:245-270` is the reference render).

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { QueryWrapper } from '@/test/queryWrapper'
import { CoachingCardPage } from '@/features/insights/pages/CoachingCardPage'

const renderPage = () =>
  render(<MemoryRouter><CoachingCardPage /></MemoryRouter>, { wrapper: QueryWrapper })

describe('CoachingCardPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('shows the card with its facts and suggestions', () => {
    renderPage()
    expect(screen.getByText('Terhelés–táplálás')).toBeInTheDocument()
    expect(screen.getByText(/7 napos terhelés 412 perc/)).toBeInTheDocument()
    expect(screen.getByText('Egy plusz szénhidrátos fogás ebédre.')).toBeInTheDocument()
  })

  test('„Miért ez nyert" ranks the beaten candidates — this exists nowhere else in the app', () => {
    renderPage()
    expect(screen.getByText('Miért ez nyert')).toBeInTheDocument()
    expect(screen.getByText('Alvásadósság')).toBeInTheDocument()
    expect(screen.getByText('rang 6')).toBeInTheDocument()
  })

  test('the action button is the existing advice path, not a parallel one', () => {
    renderPage()
    expect(screen.getByRole('button', { name: 'Könnyítsd a holnapot' })).toBeInTheDocument()
  })
})

describe('CoachingCardPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('an unresolved fetch shows neither a card nor a fabricated absence', () => {
    const { container } = renderPage()
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(screen.queryByText('Ma nem érkezett kártya.')).not.toBeInTheDocument()
  })

  test('no card today says exactly that, rather than inventing one', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Ma nem érkezett kártya.')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd frontend && pnpm test src/features/insights/pages/CoachingCardPage.test.tsx
```

Expected: FAIL — the page does not resolve.

- [ ] **Step 3: Write the page**

```tsx
// ============================================================
// Mezo · A napi kártya — a győztes, és amit legyőzött (mezo-6269.3,
// spec 2026-09-05 §6.4). A kártya anatómiája a NapMezoPage-en bevált
// recept (tények + javaslatok + akciók), a „Miért ez nyert" sáv pedig az
// egyetlen hely az appban, ahol a legyőzött jelöltek is látszanak.
// Az akciók a MEGLÉVŐ úton futnak (useAdviceActions + ACTION_INVALIDATES),
// szerver-vezérelt applied állapottal — soha nem tiltott gomb hamisítja.
// ============================================================
import { useNavigate } from 'react-router-dom'
import { Icon } from '@/shared/ui/Icon'
import { ClayIcon } from '@/shared/ui/clay'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { useAdviceActions, useCoachingCard, useCoachingTrace } from '@/data/hooks'
import { losersOf, visualOf, winnerRuleOf } from '@/features/insights/logic/coachingCopy'
import { localDateString } from '@/shared/lib/dates'

export function CoachingCardPage() {
  const navigate = useNavigate()
  const date = localDateString()
  const { card, isPending, isError } = useCoachingCard(date)
  const { day } = useCoachingTrace(date)
  const advice = useAdviceActions()
  const winner = winnerRuleOf(day)
  const losers = losersOf(day)

  return (
    <MozaikPage tone="gold">
      <PageHead onBack={() => navigate('/mezo/coaching')} label="‹ Coaching" />
      <PageHero name="A napi kártya" sub={winner?.label} />
      <PageBody principle="Egy kártya naponta — itt az is látszik, mi ellen nyert.">
        <EntranceGroup className="col gap-md">
          {isPending && <div className="card" style={{ padding: 18 }} aria-busy="true" />}
          {isError && (
            <div className="card" style={{ padding: 18, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--mz-ink-soft)' }}>
                A mai kártyát most nem tudom betölteni — próbáld újra kicsit később.
              </p>
            </div>
          )}
          {!isPending && !isError && card == null && (
            <div className="card" style={{ padding: 18, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--mz-ink-soft)', lineHeight: 1.5 }}>
                Ma nem érkezett kártya.
              </p>
            </div>
          )}

          {card != null && (
            <div className="mzp-pred propcard rise" style={{ '--d': '0ms' } as React.CSSProperties}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ClayIcon name={visualOf(winner?.domain ?? 'general').icon} size={26} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>{card.eyebrow}</span>
              </div>
              {card.body.map((p, i) => (
                <p key={i} style={{ fontSize: 12, fontWeight: 300, lineHeight: 1.6, marginTop: 7 }}>
                  <SafeMarkdown text={p.text} />
                </p>
              ))}
              {card.facts != null && card.facts.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {card.facts.map((f, i) => (
                    <div key={i} className="mzp-evrow"><span className="vl">{f}</span></div>
                  ))}
                </div>
              )}
              {card.suggestions != null && card.suggestions.length > 0 && (
                <ul style={{ marginTop: 8, paddingLeft: 16, fontSize: 11.5, fontWeight: 300, lineHeight: 1.55 }}>
                  {card.suggestions.map((s, i) => <li key={i}><SafeMarkdown text={s} /></li>)}
                </ul>
              )}
              {/* Server-driven applied state — the NapMezoPage contract, reused verbatim. */}
              {card.actions != null && card.actions.length > 0 && (
                card.applied != null ? (
                  <div className="nap-mzmsg-applied">
                    <Icon name="check" size={12} />
                    {card.actions.find((a) => a.key === card.applied!.actionKey)?.label ?? card.applied.actionKey}
                  </div>
                ) : (
                  <div className="mzp-decrow" role="group" aria-label="Javasolt lépés">
                    {card.actions.map((a) => (
                      <button key={a.key} type="button" className="mzp-cta" disabled={advice.pending}
                        onClick={() => advice.apply(card.id, a.key)}>
                        {a.label}
                      </button>
                    ))}
                    {advice.failedId === card.id && (
                      <span className="nap-mzmsg-actionerr" role="alert">Nem sikerült — próbáld újra.</span>
                    )}
                  </div>
                )
              )}
            </div>
          )}

          {losers.length > 0 && (
            <div className="mzp-pred lav rise" style={{ '--d': '70ms' } as React.CSSProperties}>
              <span className="mz-eyebrow" style={{ color: 'var(--mz-ink-soft)' }}>Miért ez nyert</span>
              <div style={{ marginTop: 6 }}>
                {losers.map((r) => (
                  <div key={r.flagKey} className="mzo-loser">
                    <span className="nm">{r.label}</span>
                    <span>alacsonyabb súlyosság</span>
                    <span className="rk">{`rang ${r.rank}`}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
```

> `card.applied` and `card.actions[].key` follow `FeedMessage` (`frontend/src/data/types.ts:26-44`) — `apply(id, actionKey)` takes the card's own id, which is the `companion_message` row id the observer's `winner.cardId` also names.

- [ ] **Step 4: Register the route**

```tsx
      { path: 'mezo/coaching/kartya', element: <CoachingCardPage /> },
```

- [ ] **Step 5: Run the tests and confirm they pass**

```bash
cd frontend && pnpm test src/features/insights/pages/CoachingCardPage.test.tsx && VITE_USE_MOCK=false pnpm test src/features/insights/pages/CoachingCardPage.test.tsx
```

Expected: PASS in both modes.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/insights/pages/CoachingCardPage.tsx frontend/src/features/insights/pages/CoachingCardPage.test.tsx frontend/src/app/router.tsx && git commit -m "feat(insights): the daily card page with the beaten candidates (mezo-6269.3)"
```

---

### Task 8: The tile on the Mező hub

**Files:**
- Modify: `frontend/src/features/insights/pages/MezoHubPage.tsx` (the `<Mosaic>` block, after the Karakter tile)
- Modify: `frontend/src/features/insights/pages/MezoHubPage.test.tsx`
- Modify: `frontend/src/features/insights/pages/insights.nav.test.tsx`
- Modify: `frontend/src/styles/prototype.css:6123` (the shared wide-tile rule)

**Interfaces:**
- Consumes: `useCoachingTrace` (barrel), `splitOf`/`winnerRuleOf` (Task 2), `VerdictArc` (Task 4), the `/mezo/coaching` route (Task 5).
- Produces: nothing later tasks depend on, except the moved `insights-mintak` golden (Task 9).

**Trap:** the tile goes INSIDE the existing `<Mosaic>`, and `Karakter`/`Diagnózis` have a deliberate DOM-order-vs-stagger-order mismatch (spec §3) — do not "tidy" the neighbouring `delayMs` values. A `wide` `Tile` ignores `children`, so the poster tile follows the Diagnózis idiom instead: a normal `Tile` with the full-row class and its graphics as children.

- [ ] **Step 1: Write the failing test**

Add to `MezoHubPage.test.tsx`:

```tsx
describe('MezoHubPage — the Proaktív coaching tile (mezo-6269.3)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('carries the day’s flagged count, the winner and the split arc', async () => {
    renderHub()
    const tile = await screen.findByRole('button', { name: 'Proaktív coaching' })
    expect(tile).toHaveTextContent('Terhelés–táplálás')
    expect(tile.querySelectorAll('.mzo-arcseg')).toHaveLength(14)
  })
})

describe('MezoHubPage — the coaching tile is honest while unresolved', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('no arc and no winner line before the day resolves', () => {
    renderHub()
    const tile = screen.getByRole('button', { name: 'Proaktív coaching' })
    expect(tile.querySelectorAll('.mzo-arcseg')).toHaveLength(0)
    expect(tile).not.toHaveTextContent('Terhelés–táplálás')
  })
})
```

> Reuse whatever render helper `MezoHubPage.test.tsx` already defines (it may be called something other than `renderHub`) — read the file first and match it rather than adding a second helper.

Add to `insights.nav.test.tsx`, inside the existing real-mode describe:

```tsx
  test('the coaching tile opens the hub, and the hub opens both surfaces', async () => {
    const router = renderApp('/mezo')
    await userEvent.click(await screen.findByRole('button', { name: 'Proaktív coaching' }))
    expect(router.state.location.pathname).toBe('/mezo/coaching')
    await userEvent.click(await screen.findByRole('button', { name: 'Megfigyelő' }))
    expect(router.state.location.pathname).toBe('/mezo/coaching/megfigyelo')
    router.navigate('/mezo/coaching')
    await userEvent.click(await screen.findByRole('button', { name: 'A napi kártya' }))
    expect(router.state.location.pathname).toBe('/mezo/coaching/kartya')
  })
```

- [ ] **Step 2: Run them and watch them fail**

```bash
cd frontend && pnpm test src/features/insights/pages/MezoHubPage.test.tsx src/features/insights/pages/insights.nav.test.tsx
```

Expected: FAIL — no button named `Proaktív coaching`.

- [ ] **Step 3: Add the tile**

In `MezoHubPage.tsx`, with the other tile lines:

```tsx
  // Proaktív coaching (mezo-6269.3): the engine's own decision, one tap away. Honest while
  // unresolved — no arc, no winner name, no fabricated zero (the hub's rule for every tile line).
  const { day: coachingDay, isPending: coachingPending } = useCoachingTrace()
  const coachingSplit = splitOf(coachingDay)
  const coachingWinner = winnerRuleOf(coachingDay)
  const coachingLine = coachingPending || coachingSplit.total === 0
    ? undefined
    : `${coachingSplit.raised + coachingSplit.suppressed} jelzett · ${coachingSplit.total} szabály`
```

and, inside the `<Mosaic>` after the Karakter tile:

```tsx
          {/* Proaktív coaching (mezo-6269.3) — a full-row poster tile, the Diagnózis idiom:
              a plain Tile with the span-both class, because a `wide` Tile drops its children
              and this one carries graphics (the split arc + the winner's name). */}
          <Tile wash="sky" icon="i-eletjel" eyebrow="Proaktív coaching" delayMs={480}
            aria-label="Proaktív coaching" className="mzh-eb-sky mzh-t-coaching"
            line={coachingLine} onClick={() => navigate('/mezo/coaching')}>
            {coachingWinner != null && (
              <div className="mzo-hubposter">
                <VerdictArc split={coachingSplit} size={62} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{coachingWinner.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--mz-ink-soft)' }}>a mai kártya</div>
                </div>
              </div>
            )}
          </Tile>
```

with the imports `import { VerdictArc } from '@/features/insights/components/VerdictArc'` and `import { splitOf, winnerRuleOf } from '@/features/insights/logic/coachingCopy'`, plus `useCoachingTrace` added to the existing `@/data/hooks` import list.

CSS — extend the existing full-row rule and add the poster row:

```css
.mzh-t-diag, .mzh-t-karakter, .mzh-t-coaching { grid-column: 1 / -1; align-items: flex-start; text-align: left; }
.mzo-hubposter { display: flex; align-items: center; gap: 11px; margin-top: 6px; }
```

- [ ] **Step 4: Run the tests and confirm they pass**

```bash
cd frontend && pnpm test src/features/insights/pages/ && VITE_USE_MOCK=false pnpm test src/features/insights/pages/
```

Expected: PASS in both modes — including the pre-existing `MezoHubPage` assertions, which the new tile must not disturb.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/insights frontend/src/styles/prototype.css && git commit -m "feat(insights): the Proaktív coaching tile on the Mező hub (mezo-6269.3)"
```

---

### Task 9: Visual goldens

**Files:**
- Modify: `frontend/tests/visual/visual.spec.ts` (the `SCREENS` list and the header count comment)
- Regenerated: `frontend/tests/visual/visual.spec.ts-snapshots/*` (both platforms, by the workflow)

**What moves:** three new screens × 2 themes = 6 new shots per platform, plus the existing `insights-mintak` shot (which is `/insights` → `/mezo`, i.e. the hub the new tile lands on) which legitimately changes.

- [ ] **Step 1: Add the three screens**

```ts
  // Proaktív coaching (mezo-6269.3): the hub, the Megfigyelő with all rules + the day's
  // timeline, and the winning card with its beaten candidates. All three read the deterministic
  // mock day (`coachingTraceMock` / `coachingCardMock`), whose timestamps and `earliestDate`
  // derive from the requested day — so the frozen clock alone pins them.
  ['mezo-coaching', '/mezo/coaching'],
  ['mezo-coaching-megfigyelo', '/mezo/coaching/megfigyelo'],
  ['mezo-coaching-kartya', '/mezo/coaching/kartya'],
```

Update the header comment's shot count in the same edit (it is maintained by hand, `visual.spec.ts:5-16`).

- [ ] **Step 2: Generate the darwin goldens locally and LOOK at them**

```bash
cd frontend && pnpm test:visual:update --grep 'coaching|insights-mintak'
```

Then actually open the three new PNGs under `frontend/tests/visual/visual.spec.ts-snapshots/` and check the design, not just that files appeared: poster anatomy, domain washes, clay icons (no emoji anywhere), the rank badges, the arc, the timeline row, and both themes legible. A golden is a design review artefact here, not only a regression net.

- [ ] **Step 3: Confirm the suite is green against the fresh goldens**

```bash
cd frontend && pnpm test:visual --grep 'coaching|insights-mintak'
```

Expected: PASS.

- [ ] **Step 4: Commit the darwin set**

```bash
git add frontend/tests/visual && git commit -m "test(insights): visual goldens for the coaching surfaces (mezo-6269.3)"
```

- [ ] **Step 5: Regenerate the linux set on CI after the branch is pushed**

Run this AFTER Task 10's push (the workflow pushes a bot commit back to the branch):

```bash
gh workflow run update-visual-baselines.yml -r feat/coaching-observer
```

Then, because the bot commit is made with `GITHUB_TOKEN` and therefore triggers no CI:

```bash
gh pr close <n> && gh pr reopen <n>
```

- [ ] **Step 6: Pull the bot commit back before doing anything else**

```bash
git pull --rebase
```

---

### Task 10: Docs, CODEMAP, gates, PR

**Files:**
- Modify: `docs/features/insights.md`
- Modify: `docs/features/companion.md`
- Regenerate: `docs/CODEMAP.md`

- [ ] **Step 1: Document the surfaces in the insights feature doc**

In `docs/features/insights.md`, in the doc's own voice and sections (§4/§5/§10 per the template):

- The three routes and what each answers: `/mezo/coaching` (which rule won and how the day split), `/mezo/coaching/megfigyelo` (every rule's verdict in severity order, the day pager, the day's transitions), `/mezo/coaching/kartya` (the card, the beaten candidates, the existing actions).
- **The order is information** — the array arrives ranked and is rendered in that order; the frontend never sorts or ranks.
- **The one map**: `coachingCopy.visualOf` (domain → wash + clay icon) with a `general` fallback, and why there is no per-`flagKey` map anywhere — this is what makes a round-2 rule appear with no frontend change.
- The state vocabulary (`Jelzett` · `Rendben` · `Nem mérhető` · `Pihenőn` · `Nyertes`) and where `Pihenőn` comes from (a raise suppressed by cooldown, which round 1 discarded silently).
- `useCoachingCard` and why it does not reuse `useCompanionFeed` (that hook degrades a failed fetch to `[]`, which this page must distinguish from "no card today"), plus the coaching-scoped mock seeds and why the companion feed mock stays `[]`.
- The winner rule: badged from `day.winner` only, never from `cardOutcome` — with a pointer to the companion doc for the semantics.

- [ ] **Step 2: Record the settled semantics in the companion doc**

Where `docs/features/companion.md` describes the trace read surface, state what Task 1 fixed: `winner` is a fact about the day (the delivered card); `cardOutcome` is a rule's correlation to the decision **at the card's delivery instant**, and is null both for a rule that has changed since and for one that first raised after the card. Name `mezo-y43v` and the `DailyCardPort.deliveredAt` seam.

- [ ] **Step 3: Regenerate the CODEMAP**

```bash
node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check
```

Expected: `--check` clean.

- [ ] **Step 4: Lint the docs**

```bash
node scripts/lint-docs.mjs
```

Expected: no new orphans, broken links or staleness flags.

- [ ] **Step 5: Run the real gates**

Frontend — **both modes**, plus the build:

```bash
cd frontend && pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build
```

Backend — Task 1's blast radius plus the convention gates:

```bash
cd backend && ./mvnw clean test -Dtest='io.mrkuhne.mezo.feature.companion.**,io.mrkuhne.mezo.feature.proactive.**,ArchitectureTest' -Dmezo.test.use-testcontainers=true -DargLine="-Xmx2g"
```

Contract drift:

```bash
cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api && cd .. && git diff --exit-code -- api/openapi.yml frontend/src/data/_client/api.gen.ts
```

Expected: exit 0.

- [ ] **Step 6: Commit the docs**

```bash
git add docs && git commit -m "docs(insights): the coaching observer surfaces and the settled winner semantics (mezo-6269.3)"
```

- [ ] **Step 7: Push and open the self-PR (the CI gate)**

```bash
git push -u origin feat/coaching-observer
```

```bash
gh pr create --fill --base main
```

Then run Task 9 Steps 5–6 (linux goldens + close/reopen + pull).

- [ ] **Step 8: Wait for CI green, then re-check against the CURRENT main**

```bash
gh pr checks --watch
```

```bash
gh workflow run premerge.yml -f pr=<number>
```

Expected: both green. `premerge.yml` is the one that catches a PR whose own tick predates the base it will actually merge into — and the visual goldens are exactly the kind of thing a moved main breaks.

- [ ] **Step 9: Merge locally with `--no-ff` and push**

```bash
git checkout main && git pull --rebase && git merge --no-ff feat/coaching-observer && git push && git branch -d feat/coaching-observer && git push origin --delete feat/coaching-observer
```

> From the worktree, never by `cd`-ing to the primary repo — that checkout sits on `main`.

- [ ] **Step 10: Close the issues, refresh the tracker backup, hand off**

```bash
node scripts/check-beads-backup.mjs --fix
```

```bash
bd close mezo-6269.3 && bd close mezo-6269 && bd dolt push && git add .beads/issues.jsonl && git commit -m "chore(beads): refresh the tracker export after S3 (mezo-6269.3)" && git push && git status
```

Expected: `git status` shows "up to date with origin". Close the epic only if nothing else under it is still open (`bd show mezo-6269`) — the follow-ups filed by the S1/S2 reviews (`mezo-6269.4` … `mezo-6269.9`, `mezo-rmxz`, `mezo-dads`, `mezo-nrkk`, `mezo-p757`, `mezo-yh1h`) are independent of the surfaces and may well outlive it; if they do, leave the epic open and say so in the handoff.

---

## Self-review

**Spec coverage.** §6 state vocabulary → Task 2. §6.1 the hub tile (poster anatomy, one big numeral, the winner beneath, the segmented arc) → Tasks 4 + 8. §6.2 `/mezo/coaching` (own back chip, winner poster with a rank badge, the split as a strip, two wide tiles) → Task 5. §6.3 the Observer (day pager, all rules in severity order, rank badge + clay icon + outcome wash, one evidence line, tap-to-expand evidence rows, the day's timeline present only when there were transitions, no per-rule markup) → Tasks 4 + 6. §6.4 the card page (the proven card anatomy, „Miért ez nyert", actions on the existing `useAdviceActions` path with server-driven applied state) → Task 7. §6.5 honest four-way states → every page task, both modes. §7 testing (the round-2 guarantee, cooldown visible as `Pihenőn`, actions through the existing path, goldens for the new pages and the moved hub golden) → Tasks 2, 4, 6, 7, 9. §3 traps (mock mode renders fully, `VITE_USE_MOCK`, honest states, the deliberate stagger mismatch, visual baselines, Hungarian copy) → Global Constraints and Tasks 3, 8, 9.

**Beyond the spec, deliberately.** Task 1 is not in the spec's S3 line — it is `mezo-y43v`, filed by the S2 close review as a P1 blocker on this slice, and it must land before the surfaces because the alternative is the frontend deciding what the engine meant. The plan resolves it at the source and states the resolution in the contract.

**Three decisions worth flagging on review:**
1. **`CoachingRuleTile` is bespoke, not `CollapsibleStrip`.** The shared strip's header takes a `string` eyebrow and has no rank/icon slot; widening a domain-free `shared/ui` primitive for one caller is the worse trade. The interaction contract (`aria-expanded` + `aria-controls` + a hidden body) is copied exactly, so behaviour and accessibility do not fork.
2. **`useCoachingCard` rather than `useCompanionFeed`.** The feed hook degrades every failure to `[]`, which this page cannot tell apart from "no card today" — the honest-states rule needs the difference. Same query-key prefix, so `useAdviceActions`' existing invalidation still refreshes it.
3. **The demo card is derived from `mockCoachingDay`.** Two hand-written seeds would eventually name two different winners on two pages of the same decision — the precise incoherence this feature exists to remove.

**Placeholder scan.** No TBDs. Four places deliberately say "verify before typing" rather than guessing: the `FlagPayloadEnvelope.lateEating` component list, the `AdviceActionKey` member used by the mock card, the two clay icon names, and `MezoHubPage.test.tsx`'s existing render helper. Each names the exact command that answers it.

**Type consistency.** `CoachingState` / `stateOf` / `STATE_LABEL` / `STATE_CHIP` / `visualOf` / `washOf` / `splitOf` / `CoachingSplit` / `winnerRuleOf` / `losersOf` / `hhmm` / `dayLabel` are defined once in Task 2 and used under those exact names in Tasks 4–8. `VerdictArc({ split, size })` and `CoachingRuleTile({ rule, winner, delayMs })` are defined in Task 4 and called with those props in Tasks 5, 6 and 8. `useCoachingCard(date) → { card, isPending, isError }` is defined in Task 3 and destructured that way in Task 7. `DailyCardPort.DeliveredCard(cardId, adviceKey, deliveredAt)` is Task 1's only signature change, and no frontend type moves with it.
