# Edzés előtti felkészítő képernyő ("Eligazítás") — design

**bd:** mezo-mgu2r · **Date:** 2026-09-28 · **Domain:** Edzés (train) · **Owner decisions:** in this brainstorm (2026-09-28)

## 1. Goal

When the owner starts a workout, show one intermediate **briefing** screen: the day's
challenges (küldetések) to opt into, the expected duration, exercise/set counts, the
overload summary, the niggle warning, and the exercise list. Tapping **Indulás** starts the
workout. The active workout screen then loses every session-level panel; only the
per-exercise challenge badge stays, and tapping it releases / takes back that challenge.

## 2. Reversal of a recorded decision

mezo-e1ii9 (Train parity P1) retired the prep phase ("the workout opens in the card list";
`ActiveWorkoutPage.tsx:1-19`, `docs/features/train.md` §2, tests
`ActiveWorkoutPage.test.tsx:113,123-135,1882`). The owner explicitly reverses that here
(2026-09-28). **Not coming back** from the old prep (`2026-07-24-prep-mission-briefing-design.md`):
the XP forecast, the 6-tile mosaic, "Értem · jó így", the "A mai küldetések" tile button.
The new briefing is a single scrollable glass screen with one sticky primary action.
bd mezo-n6yqh (P0, "remove the prep mosaic") is stale and is closed with a pointer here.

## 3. Owner decisions

| # | Decision |
|---|---|
| D1 | The briefing is shown **on every fresh start** (option A). Suggested challenges are pre-ticked, so "Indulás" alone is enough. |
| D2 | **Resume skips it**: an already-open workout instance (resume FAB, "Folytassuk", reload mid-session) lands straight on the card list. |
| D3 | Mid-workout, the challenge badge on the exercise card is **tappable**: release (elengedés) or take back (visszavétel), no penalty (option A). |
| D5 | The card's **"Múlt hét / Ma a cél" cells go** — the pre-filled set rows already carry the recommendation. The progression delta survives as a small chip beside the set count in the card head ("↑ +2,5 kg" / "↑ +1 ism." / "tartjuk" / "↓ −2,5 kg"). The fixed-step progression logic itself is a separate follow-up (mezo-bk7sn). |
| D4 | Briefing content: challenge picker, expected duration, exercise+set counts, overload summary, niggle warning, exercise list. **Not** the per-muscle load ladder (it lives on Mai). |

## 4. Design

### 4.1 Flow

- `/train/session` (and `?day=`) opens the **briefing phase** when no workout instance is
  open for the resolved day; otherwise the active phase, as today.
- Implemented as a **phase of `ActiveWorkoutSession`**, not a separate route:
  `type Phase = 'brief' | 'active' | 'summary'`. This keeps the outer guard chain intact
  (day pin, pending skeleton, resume-fresh latch, empty redirect, completed-day redirect),
  keeps the mock-mode page-local accept state alive across brief → active, and needs no new
  `hideChrome` / `navModel` / `pageIndex` entries.
- The **start POST moves** from the mount effect to the **Indulás** tap
  (`runStart` stays once-per-mount via `startedRef`, same failed-start strip + retry on the
  active phase). Back from the briefing = navigate back, nothing recorded, no instance created.
- Initial phase: `'active'` if an instance is already open (the existing `open` flag the
  start effect reads, `ActiveWorkoutPage.tsx:434`) or — mock mode — the seeded session
  already has logged sets; else `'brief'`. Decided once at mount (latched), so a refetch after
  Indulás never flips back to brief.

### 4.2 Briefing screen (top → bottom)

1. **Top bar** — back, title "Eligazítás", `?` (kalauz anchor `session-start` moves here).
2. **Hero (frameless radial halo)** — session name, big numeral **duration range**
   ("~50–60 perc"), and pills: N gyakorlat · M sorozat.
   - Range: `estimateSessionMinutes` (profile-calibrated) → `[round5(m·0.9), round5(m·1.1)]`,
     min width 5 min. Held pending (skeleton) while the timing profile loads — never 0.
3. **Niggle warning** (only if `W.niggleWarning`) — same copy as today's banner.
4. **Küldetések** glass card — reuses the `WorkoutChallengesGlass` row anatomy (variant B of
   `uveg-kuldetes.html`), inline instead of in a GlassBox. Honest states: pending
   (`ChallengeGenerationLoader`), failed + Újra, "Ma nincs küldetés", list.
   - Each row: type icon + label, exercise, target, confidence line, toggle.
   - **Pre-tick rule:** already-accepted rows; the deterministic overload challenge; LLM
     challenges with `risk === 'low'` and `confidence >= 0.7`. Everything else unticked.
   - Ticks are **local draft** until Indulás.
5. **Túlterhelés** line — `WorkoutOverloadLine` moved here unchanged.
6. **Gyakorlatlista** — ordered exercises, each with planned sets × reps @ weight; the
   exercise carrying a ticked challenge shows the `t-quest` badge (updates live with ticks).
7. **Sticky foot button** — "Indulás · N küldetéssel" / "Indulás küldetés nélkül".

On Indulás: for each ticked row not yet accepted → `decide(accept)`; for each unticked row
currently accepted → `decide(undo)`; unticked proposed rows stay **proposed** (never
dismissed; they get no badge and are not offered mid-workout — the badge of D3 only exists
for challenges accepted at Indulás). Decisions fire in parallel with the start POST; a
decision failure shows a toast and leaves the row in its server state — it never blocks the
start. Mock: writes the page-local `acceptedChallenges` map.

### 4.3 Active screen after the change

Removed: the quest row `.wos-fresh` (`ActiveWorkoutPage.tsx:1206-1277`), the `⋯` menu's
Küldetések row + `WorkoutChallengesGlass` mount, `WorkoutOverloadLine`, the niggle banner.

Kept / extended: the card badge `.wos-pill-quest`. It becomes a **button**:
- Shown for challenges that were accepted at Indulás **or** released during this session
  (session-local `touched` set so a released one stays visible).
- Accepted: full-colour badge. Released: dimmed, strikethrough target, label "elengedve".
- Tap → small glass sheet: challenge label, target, why (1–2 lines), one button
  "Elengedem" (→ `undo`) or "Visszaveszem" (→ `accept`). Resolved (hit/miss) challenges:
  badge shows the outcome, sheet has no action.

Card head (D5): `ProgressionBanner` (`components/ProgressionBanner.tsx`, mounted at
`WorkoutCard.tsx:235`) is no longer rendered on the card; the head's set-count line gains a
`progressionDeltaLabel`-based chip (up = coral, hold/down/deload = amber). The first-ever
exercise cue line (`WorkoutCard.tsx:131-135`) is unchanged.

Ceremony and review unchanged (they already show accepted challenges only).

### 4.4 Error handling

- Challenges pending/failed on the briefing never block Indulás.
- Start POST failure → active phase with the existing failed-start strip + retry (unchanged).
- Decide failure (briefing or badge) → toast "Nem sikerült menteni", state reverts to server.

### 4.5 Testing

- Rewrite the no-prep assertions in `ActiveWorkoutPage.test.tsx` (113, 123-135, 171-211,
  1882, 2036-2069) to: fresh start renders the briefing; resume renders the card list;
  Indulás fires start once + decisions; pre-tick rule; badge release/take-back; removed
  panels absent on the active phase. Both modes (`CI=true`, mock + `VITE_USE_MOCK=false`).
- `crossDay`, `resumeFresh`, `realFinish` suites stay green.
- `tests/layout/layout.spec.ts` `/train/session` chrome-free check covers the briefing; add
  a 320px no-horizontal-overflow check for the briefing.
- Backend: no change.

## 5. Prior art (researcher)

- **Hevy Trainer** (https://www.hevyapp.com/features/workout-plan-generator/) — preview with
  exercise count, estimated duration, exercise list, one Start; logger without session
  panels, the goal inline per exercise. **Adopted** as the overall split.
- **Fitbod** (https://help.fitbod.me/hc/en-us/sections/31812780318743-Exercise-Workout-Customization)
  — duration as a range. **Adopted** (range). Rejected: pre-start edits that vanish.
- **JuggernautAI** (https://powerliftingtechnique.com/juggernaut-ai-review/) — pre-session
  step justified because it changes the session. **Adopted** the rationale (ticks visibly
  change the badges/button); rejected the questionnaire (check-in already exists).
- **Duolingo quests** (https://duolingo.fandom.com/wiki/Quests) — small curated set, graded.
  **Partially adopted**: cap stays at the backend's 3 LLM + 1 overload; rejected auto-assign
  in favour of pre-tick + opt-out.
- **Hitman briefing** (https://www.feralinteractive.com/en/manuals/hitman/latest/linux/) —
  briefing then clean run with a marker only on the tracked item. **Adopted**; rejected tabs.
- Resume skips the briefing (friction note) — **adopted** (D2).

## 6. Codebase terrain (investigator)

- Feature **train**: `frontend/src/features/train/pages/ActiveWorkoutPage.tsx` (guard
  `:101-167`, session `:211`, `Phase` `:81`, start `:418-444`, accept state `:304,370-403`,
  quest row `:1206-1277`, overload `:1278`, niggle `:1160`, cards `:1279-1303`),
  `components/WorkoutCard.tsx:105,209` (badge), `components/WorkoutMenuGlass.tsx:103,131,227-324`
  (menu row, picker), `components/WorkoutOverloadLine.tsx`, `logic/sessionLength.ts:68`,
  `logic/challengeDisplay.ts`.
- Feature **proactive** owns challenges (`ProactiveChallengeService.java:65,93`): keyed by
  (templateSessionId, date) so they exist before the start POST; accept/undo allowed until
  resolved — no backend change needed. Naming trap: `quest` feature = daily quests, unrelated.
- Data: `data/train/challengeHooks.ts:26,56` (mock `decide` is a no-op → page-local state),
  mock `data/train/train.ts:850,938`.
- Kalauz: `features/tutorial/registry/train.ts:69,219,341,358` (`session-start` anchor).
- Traps: resume paths must not land on the briefing; day pin + completed-day latches; mock
  accept state is page-local (solved by the phase approach); custom workouts may have no
  challenges; regenerate CODEMAP after merge.
- Stale docs to fix in the same change: `train.md` §2 (ChallengeCard, "no prep"),
  `proactive.md:582` (undo), `ActiveWorkoutPage.tsx:18` header (`complete` phase).

## 7. Out of scope

Per-muscle load on the briefing (D4); editing/reordering exercises on the briefing;
backend changes; daily quests.
