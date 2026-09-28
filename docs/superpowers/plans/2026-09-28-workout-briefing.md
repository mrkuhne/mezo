# Eligazítás (workout briefing) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A fresh workout start opens an "Eligazítás" briefing phase (duration range, counts, niggle, challenge picker, overload line, exercise list, sticky Indulás); the active phase drops every session-level panel, keeps a tappable per-exercise challenge badge (release / take back), and the card head swaps the Múlt hét/Ma a cél cells for a delta chip.

**Architecture:** A third phase `'brief'` inside `ActiveWorkoutSession` (`ActiveWorkoutPage.tsx`), chosen once at mount (`open ? 'active' : 'brief'`). The start POST moves from the mount effect to the Indulás tap. Pure helpers in `logic/briefing.ts` (duration range, pre-tick rule, decision diff) and `logic/progressionChip.ts`; one presentational `components/WorkoutBriefing.tsx`; one `ChallengeDetailGlass` in `components/WorkoutMenuGlass.tsx` replacing `WorkoutChallengesGlass`.

**Tech Stack:** React 18 + TS, TanStack Query, vitest + RTL + msw, Playwright layout specs, `prototype.css` skin.

**Spec:** `docs/superpowers/specs/2026-09-28-workout-briefing-design.md` · **Prototype (build target):** `docs/design_2.0/prototypes/elo/edzes.html` routes `#indulas`, `#session/uj`, gbox `qb` · **bd:** mezo-mgu2r

## Global Constraints

- Hungarian UI copy exactly as in the prototype: "Eligazítás", "ennyi várható, a saját tempód alapján", "Küldetések · ma" / "Mit vállalsz ma?", "Az előre bepipáltakat javaslom. Passzolni ér — és edzés közben is elengedheted bármelyiket.", "A mai sor" / "Gyakorlatok", "Indulás · N küldetéssel" / "Indulás küldetés nélkül", "Elengedem", "Visszaveszem", "elengedve".
- Pre-tick rule: already accepted (status accepted/hit/miss) OR `type === 'overload'` OR (`risk === 'low'` AND `confidence != null` AND `confidence >= 0.7`).
- Duration range: `m = estimateSessionMinutes(...)`; `lo = round5(m*0.9)`, `hi = max(round5(m*1.1), lo+5)`; `round5 = x => Math.round(x/5)*5`. Unknown while the timing profile is pending → skeleton text, never 0.
- Icons only from the 3D sprite (`Icon3D`): t-clock, t-bandage, t-quest, t-up, t-tick, t-play, t-skip. No emoji.
- Unticked proposed challenges are never dismissed. Decisions never block the start.
- No backend change. Mock mode keeps page-local accept state.

---

### Task 1: Pure helpers — `logic/briefing.ts`, `logic/progressionChip.ts`

**Files:** Create `frontend/src/features/train/logic/briefing.ts`, `briefing.test.ts`, `progressionChip.ts`, `progressionChip.test.ts`.

**Produces:**
```ts
export function durationRange(minutes: number): [number, number] | null   // null when minutes <= 0
export function preTicked(challenges: Challenge[], accepted: Record<string, boolean>): Record<string, boolean>
export function briefingDecisions(challenges: Challenge[], ticked: Record<string, boolean>, accepted: Record<string, boolean>): { accept: string[]; undo: string[] }
export function progressionChip(p: ProgressionSignal): { text: string; tone: 'up' | 'hold' | 'down' }
```
- `briefingDecisions`: accept = ticked && !accepted && no outcome status (hit/miss/inconclusive); undo = !ticked && accepted && status === 'accepted'.
- `progressionChip`: weight + → `↑ +2,5 kg` up; weight − or deload → `↓ −2,5 kg` down; rep → `↑ +1 ism.` up; hold → `tartjuk` hold. hu-HU number format.

- [ ] Write tests (range 78 → [70,85]; 0 → null; 20 → [20,25]; pre-tick on the mock seed ch1 0.72 low ✓, ch-overload ✓, ch2 0.81 ✓, a 0.68 ✗, a null-confidence non-overload ✗, an accepted 0.5 ✓; decisions diff; chip for each lever) → run `CI=true pnpm vitest run src/features/train/logic/briefing.test.ts src/features/train/logic/progressionChip.test.ts` → FAIL → implement → PASS → commit `feat(train): briefing + progression-chip helpers (mezo-mgu2r)`.

### Task 2: `WorkoutBriefing` component

**Files:** Create `frontend/src/features/train/components/WorkoutBriefing.tsx`, `WorkoutBriefing.test.tsx`; CSS in `src/styles/prototype.css` inside the `uveg edzes session` block (before `/* ── /uveg edzes session ── */`).

**Props:**
```ts
interface WorkoutBriefingProps {
  title: string; eyebrow: string
  minutes: [number, number] | null           // null → "…" pending
  exerciseCount: number; setCount: number
  niggle: { muscleLabel?: string; detail?: string } | null
  challenges: Challenge[]; pending: boolean; failed: boolean; onRetry?: () => void
  ticked: Record<string, boolean>; onToggle: (id: string) => void
  overload: WorkoutPlan['overloadSummary']
  exercises: { id: string; name: string; muscle: string; sets: number; goal: string | null; chip: { text: string; tone: string } | null }[]
  onBack: () => void; onStart: () => void; starting?: boolean
  kalauzButton?: React.ReactNode
}
```
Anatomy = prototype `briefing()`: `.wk-top.wos-top.wbr-top` (back ‹, "Eligazítás", kalauz ?; `data-kalauz-anchor="session-start"`), frameless `.wbr-hero` (t-clock art, eyebrow, big `70–85` + `perc`, subline, two `uv-flat` pills), `.warmstrip.wos-warn` niggle, `.wbr-quests.glass` (--c gold) with rows `.wbr-q` button `aria-pressed` (type label via `challengeTypeLabel`, exercise, target, `challengeConfidenceLine`), pending → `ChallengeGenerationLoader`, failed → text + Újra, empty → "Ma nincs küldetés — ehhez az edzéshez még kevés az előzmény.", `WorkoutOverloadLine`, eyebrow "A MAI SOR" + "Gyakorlatok", flat `.wbr-row` per exercise (MuscleChip 28, name, `N szett · cél X`, t-quest when a ticked challenge targets it), sticky `.wbr-foot` primary button with t-play.

- [ ] Tests: renders the range text "70–85"; pending minutes renders "…"; toggling calls onToggle; foot label "Indulás · 3 küldetéssel" vs "Indulás küldetés nélkül"; t-quest marker only on exercises with ticked challenges; pending/failed/empty states; no niggle node when null. Run → FAIL → implement → PASS → commit.

### Task 3: Brief phase in `ActiveWorkoutPage` + start moves to Indulás

**Files:** Modify `frontend/src/features/train/pages/ActiveWorkoutPage.tsx` (header comment, `Phase`, start effect `:418-441`, render), `ActiveWorkoutPage.test.tsx`, `.crossDay/.resumeFresh/.realFinish` tests as needed.

- `type Phase = 'brief' | 'active' | 'summary'`; `useState<Phase>(() => (open ? 'active' : 'brief'))`.
- `ticked` state: `useState<Record<string,boolean> | null>(null)`; effective `ticked ?? preTicked(challenges, acceptedMap)` (so a late challenge fetch still pre-ticks).
- Delete the mount effect; `handleStart()`: `if (startedRef.current) return; startedRef.current = true; enteredAtRef.current = Date.now(); const d = briefingDecisions(...)`; mock → `setAcceptedChallenges(ids ticked)`; live → `d.accept.forEach(id => decide(id,'accept')); d.undo.forEach(id => decide(id,'undo'))`; `setStartedIds(new Set(ids ticked))`; `if (!open && todaySession) runStart(false)`; `setPhase('active')`.
- Brief render: `<WorkoutBriefing …/>` with `minutes = timingProfilePending ? null : durationRange(estimateSessionMinutes(W.exercises, timingProfile ?? undefined))`; `onBack = onExit`.
- Active render: delete the quest row (`doneSets === 0 && …`), the niggle banner, `<WorkoutOverloadLine>`.
- Test helper: `setup()` renders then `fireEvent.click(screen.getByRole('button', { name: /^Indulás/ }))` (mock is synchronous); new `setupBrief()` without the click. Replace the no-prep tests (`:113-135`, `:1882`) with: fresh start renders the briefing (no `.wo-card`), Indulás renders the list, real mode: start POST fires only on Indulás (msw spy) and exactly once, resume (open instance) renders the list directly.

- [ ] Write/adjust tests → FAIL → implement → PASS both modes → commit.

### Task 4: Active-phase badge + detail glass; menu loses Küldetések

**Files:** Modify `components/WorkoutCard.tsx` (prop `challenges`, `onOpenChallenge`), `components/WorkoutMenuGlass.tsx` (delete `WorkoutChallengesGlass` + the Küldetések row + its props; add `ChallengeDetailGlass`), `ActiveWorkoutPage.tsx`, tests (`WorkoutMenuGlass.test.tsx`, `ActiveWorkoutPage.test.tsx :171-211, :2036-2069`).

```ts
// WorkoutCard
challenges?: { id: string; label: string; target: string; state: 'accepted' | 'released' | 'hit' | 'miss' }[]
onOpenChallenge?: (id: string) => void
// ChallengeDetailGlass
{ open: boolean; challenge: Challenge | null; state: 'accepted'|'released'|'hit'|'miss'; tint: string; onToggle: () => void; onClose: () => void }
```
- Card pills: one `button.wo-note.wos-pill-quest` per challenge; released → `is-released` + "elengedve · <s>target</s>"; aria-label `"<label> küldetés · vállalva|elengedve"`.
- Page: `startedIds` (ids ticked at Indulás) — badge list = challenges with `exerciseId === id` and (`acceptedMap[c.id]` || `startedIds.has(c.id)`); state from status/acceptedMap. Glass kind `'challenge'` with `id` = challenge id; toggle = existing `toggleChallenge`. Hit/miss → outcome, no action button.
- [ ] Tests: badge shows after Indulás on the challenged card; tap → glass → Elengedem → badge "elengedve"; Visszaveszem restores; menu has no Küldetések row. → FAIL → implement → PASS → commit.

### Task 5: Card head delta chip replaces ProgressionBanner

**Files:** `components/WorkoutCard.tsx` (drop `<ProgressionBanner>`; in `.wo-card-copy` add `<small className={'wo-delta is-'+tone}>` from `progressionChip`), `prototype.css` (`.wo-delta`), `ProgressionBanner.tsx` stays (own test; not rendered on the card — note in header comment), `prototypeCssStructure.test.ts` if it asserts the banner inside the card.
- [ ] Tests: EX1 card shows the chip text, no "Múlt hét" / "Ma a cél" text; an exercise without progression has no chip. → commit.

### Task 6: Kalauz, docs, codemap, prototype sync, gates, ship

- Kalauz `features/tutorial/registry/train.ts:340-365`: intro voice → "Indulás előtt egy eligazítás: mennyi idő, milyen küldetések. Utána minden gyakorlat egy listában."; hogyan voice drop "A fejléc ⋯ gombja alatt lakik a küldetés" → "A küldetés a gyakorlatán ül — koppints rá, ha elengednéd."
- Docs: `docs/features/train.md` §2 (briefing, badge, delta chip; fix stale ChallengeCard text), `docs/features/proactive.md:582` (`accept|dismiss|undo`), feature index row, `docs/milestones/roadmap.md` dated entry, `elo/README.md` Edzés row.
- `node scripts/gen-codemap.mjs`; `node scripts/lint-docs.mjs` 0/0.
- Layout spec: `/train/session` sticky check accepts `.wk-top` on the brief phase (already does); add a 320px no-horizontal-overflow check on the briefing.
- Gates: `CI=true pnpm test` (mock) + `CI=true VITE_USE_MOCK=false pnpm test`; `pnpm build`; `pnpm exec playwright test -c tests/layout/playwright.config.ts`.
- Ship: close mezo-n6yqh as stale → pull --rebase → merge `--no-ff` detached → push main → deploy green → prod check → `check-beads-backup --fix` → close mezo-mgu2r.

## Kész, ha… (acceptance)

1. Mai "Indítsuk" (fresh day) → Eligazítás; "Folytassuk"/lebegő gomb/reload with an open workout → straight to the list.
2. Eligazítás matches prototype `#indulas`: range numeral, 2 pills, niggle (only if any), challenge card with pre-tick rule, overload line, exercise list with t-quest markers, sticky Indulás label counting ticks; pending/failed/empty challenge states; back leaves without creating a workout.
3. Indulás: start POST once (real), accepted/undo decisions sent, list opens at 0 sets.
4. Active list: no quest row, no niggle banner, no overload line, menu without Küldetések; badge on challenged cards; tap → glass → Elengedem/Visszaveszem works; released badge dimmed "elengedve".
5. Card head: delta chip instead of Múlt hét/Ma a cél and no set count.
6. 320px no horizontal overflow; reduced motion respected (no new animation without the `prefers-reduced-motion` guard).
7. Parity: logging, rest dock, set edit, skip/reorder, notes, records, finish + ceremony (accepted challenges + outcomes) unchanged.
8. Gates green: FE both modes, layout specs, build, codemap, lint-docs 0/0.
9. Docs updated (train.md, proactive.md, feature index, roadmap, elo README).
10. Merged + pushed, deploy workflow green, production URL shows the briefing.
11. Living prototype matches the build and is republished.
