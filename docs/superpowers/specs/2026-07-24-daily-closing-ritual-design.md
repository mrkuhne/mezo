# Napzárás — sleep-anchored daily closing ritual (design spec)

- **Date:** 2026-07-24 · **bd:** `mezo-vrq3` (epic; children `mezo-huzd` R1 · `mezo-hvmx` R2 · `mezo-ilsj` R3 · `mezo-mzbz` R4) · **Driving ADR:** [0010](../../decisions/0010-gamified-growth-xp-feedback-not-payment.md) (XP is feedback, not payment)
- **Source:** owner request — a sparkly, animation-rich end-of-day ritual: evaluate the day, award XP, show progress, summarize events across routines/quests/fuel/supplements/training/journaling/check-ins; connect to growth-skill progress and coins; grounded in habit/ritual psychology.
- **Decided with Daniel in-session** (4 explicit choices + 2 browser-mockup rounds via the visual companion, 2026-07-24). Approved mockups: warm-night + lavender palette, live CSS choreography per act, and the sleep-anchored evening timeline.
- Builds on the habit engine ([habit.md](../../features/habit.md)), the quest/activity economy ([growth.md](../../features/growth.md)), the intention reflection ([intention.md](../../features/intention.md)), the account progression header ([growth.md §2](../../features/growth.md)), Today, and the proactive evening note ([proactive.md](../../features/proactive.md)).

## 1. Goal

**Napzárás** is a full-screen, five-act evening closing ritual that turns the scattered end-of-day interactions into one anchored habit: it recaps the day's story, closes the remaining open loops (missed check-in, evening reflection, journal), stages the day's XP/coin/skill harvest as the celebratory peak, and hands off into the existing sleep-prep evening routine. The whole evening is choreographed from the sleep goal's bed anchor: **day → Napzárás ritual → sleep-prep (evening chain) → lights out.**

## 2. Psychology foundation (what the design encodes)

| Principle | Source | Design consequence |
|---|---|---|
| Rituals work through fixed sequence, repetition, and symbolic framing; they reduce anxiety and restore perceived control | Norton/Gino/Hobson (ritual research); HBS "rituals decrease anxiety" | Always the same 5 acts in the same order; a fixed opening line („A nap véget ért. Zárjuk le.") and closing line („A nap le van zárva. Elengedheted."); a distinct full-screen night world as the symbolic space |
| Peak-end rule: a day is remembered by how it ends | Kahneman | The celebratory peak (Harvest) is act 4, near the end; the actual end is calm (Release) — a good ending retroactively improves the whole day's memory |
| Closing open loops before sleep reduces intrusive rumination | Zeigarnik effect; worry-journal studies | Act 3 exists solely to close what's still open — then explicitly declares the day closed |
| Visible progress is the strongest daily motivator | Amabile (progress principle) | Skill bars animate from old→new value; "közel a szint" hints; streak status shown every night |
| Celebration ("Shine") anchors habits; earned sparkle delights, constant sparkle cheapens | Fogg (Tiny Habits) | Confetti/twinkle burst only in Harvest and scaled to what actually happened; a thin day gets warmth, not fireworks |
| No punishment, no streak anxiety | ADR 0010; Finch/Fabulous case studies | Missed ritual lapses silently (habit strength fades, never zeroes); expired quests dim, never red; bad days soften the copy and skip gap-listing |

## 3. Decisions

| # | Decision | Choice + rationale |
|---|---|---|
| D1 | Form | **Full-screen 5-act story flow** at route `/ritual` (the `train/session` precedent: `AppLayout` child, `hideTabBar`). Exit ✕ anytime; nothing is written until the close fires (entering act 4), so abandoning is consequence-free. |
| D2 | Evening choreography | **Sleep-anchored gateway.** The window opens at `bedTime − mezo.ritual.lead-min` (default **75′**), computed from the existing `SleepAnchorPort` (no sleep goal → the port's config ghost). The ritual comes BEFORE sleep prep; act 5 hands off into the evening chain. **Soft gate:** the sleep-prep routine is recommended-after, never locked behind the ritual (ADR 0010 — no hard locks). |
| D3 | Integration with existing evening surfaces | **The ritual is the evening home, composing — not duplicating.** Act 3 inline-closes what is open — missing 20:00 check-in (`CheckInSheet`), evening reflection (inline `Igen/Részben/Nem` via `reflect`), optional journal (`ActivityLogSheet`) — through the SAME hooks/sheets Today uses. Wind-down/sleep-prep habits are NOT in the ritual (they come after it). Existing Today surfaces remain usable. |
| D4 | Reward mechanics | **Small closure XP + coin stage.** Completing the ritual earns a small fixed XP through a new **`evening_ritual` DERIVED habit** (metric `ritual_closed`, skill `mindset`, **xp 10**) riding the existing HABIT award tail — **no new progression source** (the intention precedent). The ritual is also the stage where the day's coin events (quest +10 / all-3 +20, streak milestones) visibly "pay out". 1×/day, not farmable. |
| D5 | Scope | **Full backend now, two slices:** a deliberately thin `feature/ritual` domain (R2) + the `mezo-huzd` gamification ledger (R1). No mock-only interim for the ritual itself. |
| D6 | Gamification ledger simplification | **No duplicate XP table.** `level_up_event` (source-typed, gains payload, timestamped) IS the XP ledger; account `totalXp`/`level` are served server-side from skill-band sums. R1 builds only what's missing: `gamification_profile`, `coin_event`, `owned_title`, the profile/day/title/saver endpoints, server-side coin awards, and read-time streak computation. |
| D7 | Streak & coin correctness | Streak computed **on read** over **business dates** of XP events (honest chip — no lazy rollover), 1-day gap + held saver → auto-consume (`coin_event: saver_used`). Coin awards idempotent by `source_ref` (quest id, `level-N`, `streak-7`…). Resolves all three `mezo-huzd` hand-off notes. |
| D8 | Animation | **CSS-first, no new dependency.** A new `rz-*` family extending the Napív `np-*` keyframes (arc draw, staggered pops/rises, twinkle field, transform-only confetti burst) + one new shared `CountUp` primitive (rAF count-up, tabular-nums). Everything behind `prefers-reduced-motion` guards; reduced motion = static step transitions. |
| D9 | Entry points | ① **Today `RitualCard`** in the "Teendők ma" zone with three states — waiting (before the window, shows opening time), open (glow CTA), done (quiet ✓). ② The **`evening_ritual` habit row** in `RoutineCard`'s evening chain navigating to `/ritual` (new `habitAction` kind). |
| D10 | Visual direction | **Warm night + lavender** (the approved mockups): the dark theme's warm tokens (`--warm`/`--ink` dark values) as the night world, `--lav`/`--lav-deep` as the ritual accent, `--amber` for XP, `--sage` for done-marks. Both themes must hold (visual harness is 2-theme). |

## 4. The five acts

Fixed order, ~4 minutes total. Progress dots (`● ● ○ ○ ○`) in the status row; ✕ exits anytime.

| Act | Content | Data | Motion |
|---|---|---|---|
| **1 · Megérkezés** | Night-sky takeover, breathing moon, twinkles; fixed opening line „A nap véget ért. Zárjuk le együtt."; glowing `Kezdjük 🌙` CTA | none | `breath` pulse, `rise` staggers, `glowp` CTA pulse |
| **2 · A napod íve** | The `DayArc` reprise, large: the arc draws itself, then the day's beats pop on in sequence — check-ins, workout/sport, then event rows: training done, meals + protein, supplements n/m, weight, sleep, journal entries, intention foci | `useDayRecap(date)` — pure composition over existing reads (quests, habits, check-ins, activities, intention, fuel timeline, train, sleep, weight) | `np-draw` arc, `pop` dots with `--i` delays, `rise` rows |
| **3 · Zárás** (the only interactive act) | Open loops only: missing 20:00 check-in → opens `CheckInSheet`; evening reflection → inline `Igen/Részben/Nem` (`useIntentionActions.reflect`); „Történt még valami ma?" → `ActivityLogSheet`; already-closed items listed dim with ✓. Nothing open → a quiet „Minden hurok zárva ✓" beat | same hooks Today uses; `intention_reflect` habit completes derived | first pending row glows (`--wash-lav`), rows rise staggered |
| **4 · Termés** (the peak) | `POST /api/ritual/close` fires on entry → habit read completes `evening_ritual` (+10 XP level-up payload). Stage: day XP total counts up, per-source chips pop in (📜 quests · ☀️ rutin · ✍️ napló · 🏋️ edzés · 🌙 napzárás), coin events chime in, skill bars grow old→new with „még N XP a Lv M-ig" hints, streak flame, title unlock if due; twinkle + confetti burst at the counter's landing | `GET /api/gamification/day/{date}` + `useProgressionProfile` + the habit read's levelUps | `CountUp`, staggered `pop`s, bar `grow`, `fall` confetti (transform-only), `np-twinkle` field |
| **5 · Elengedés** | The arc closes into a full circle around the moon; companion „napzárás" note if present (`useCompanionNote`); fixed closing line „A nap le van zárva. Elengedheted. 🌙"; **handoff panel**: „Most jön · alvás-előkészítés" with the evening chain's next steps + `Esti rutin indítása →` CTA (navigates to `/today`, evening `RoutineCard`) | `useCompanionNote()`, evening chain from `useHabitDay` | circle `draw`, gentle rises, breathing moon |

**Bad-day softening (ADR 0010):** on a rough day (`?day=rough` scenario / thin data) act 2 lists only what WAS (no gap list), act 4 celebrates whatever exists with warm copy („Ma ennyi fért bele. Az is számít."), no perfect-day language, confetti scaled down. Expired quests never appear as failures anywhere in the flow.

## 5. Backend — `feature/ritual` (R2, `mezo-hvmx`)

Deliberately thin; the intention-domain precedent (records the fact, never awards XP).

- **Table `ritual_day`:** `id uuid pk`, `created_by`, soft-delete cols, `ritual_date date`, `closed_at timestamptz`. Partial unique `uq_ritual_day_user_date (created_by, ritual_date) where is_deleted = false`. Migration `{ts}_mezo-hvmx_create_ritual_day.sql`; table added to `ResetDatabase` TRUNCATE list.
- **`RitualService`** (gated `mezo.feature.ritual.enabled`):
  - `getDay(userId, date)` → `{date, closed, closedAt?, window{opensAt, prepStartsAt, bedTime}}` — window from `SleepAnchorPort.resolve(userId)`: `opensAt = bed − lead-min` (75), `prepStartsAt = bed − prep-lead-min` (45). Pure read, never 404 for a valid date.
  - `close(userId, date)` — **today only** (else 409 `RITUAL_NOT_TODAY`); **idempotent**: an already-closed day returns the same response (re-watching the ritual is not an error). Inserts the `ritual_day` row, awards nothing.
- **Contract** `api/feature/ritual/ritual.yml` (tag `Ritual` → `RitualApi`): `GET /api/ritual/day/{date}` → `RitualDayResponse`; `POST /api/ritual/close` `{date}` → `RitualDayResponse`. Errors via `SystemMessage` per `error_handling.md`.
- **Habit wiring:** `habit-catalog.json` gains **`evening_ritual`** („Napzárás", EVENING, DERIVED, `metric: ritual_closed`, `skillKey: mindset`, xp 10, anchor „vacsora után, lefekvés előtt"); EVENING chain renumbered to 6 rows (no_stim 1 · last_meal 2 · intention_reflect 3 · **evening_ritual 4** · wind_down 5 · bedtime_next_day 6). `HabitEvaluator` gains the `ritual_closed` case reading `RitualDayRepository` directly (plain JPA bean, the intention-repos precedent), registered in `INTRADAY_METRICS`. Dependency stays one-way (habit → ritual).
- **Config:** switch `mezo.feature.ritual.enabled` (+ `FeaturesConfiguration.RITUAL_SWITCH`); `RitualProperties` (`mezo.ritual`, `@Validated`): `lead-min` 75, `prep-lead-min` 45.

## 6. Backend — `feature/gamification` (R1, `mezo-huzd`)

The account ledger slice, simplified per D6 — `level_up_event` is the XP ledger; only the missing pieces are built:

- **Tables:** `gamification_profile` (one live row per user: `coins`, `streak_days`, `streak_savers`, `equipped_title_key`, `last_streak_date`), `coin_event` (`reason` ∈ quest|all3|level_up|streak_7|streak_30|streak_100|saver_used|purchase, `amount` ±int, `source_ref_id varchar`, `occurred_on date`; idempotency: partial unique `(created_by, reason, source_ref_id) where is_deleted = false`), `owned_title` (`title_key`, `acquired_at`).
- **Contract** `api/feature/gamification/gamification.yml` (tag `Gamification`):
  - `GET /api/gamification/profile` → `{totalXp, level, coins, streakDays, streakAlive, streakSavers, equippedTitleKey, ownedTitleKeys[]}` — totalXp = Σ `cumulativeXp` across all skill bands; level from the account curve (`xpToNext(n) = 80 + 40·(n−1)`, ported server-side). Retires the FE `fetchDerivedGamification` interim.
  - `GET /api/gamification/day/{date}` → `{xpBySource[{source, xp}], xpTotal, coinEvents[{reason, amount}], coinTotal, streakDays, streakAlive}` — XP part aggregates the day's `level_up_event` rows by `source_type`; coin part lists the day's `coin_event` rows. **The Harvest read.**
  - `POST /api/gamification/title/{key}/buy` (409 insufficient coins / already owned), `POST /api/gamification/title/{key}/equip` (ladder titles equip only if level-unlocked), `POST /api/gamification/saver/buy` (200 🪙, max 2 held). Prices/rules move from the FE mock store (`titleCatalog.ts`, `gamificationStore.ts`) into a backend catalog + `GamificationProperties`.
- **Coin awarding (server-side, deterministic, idempotent by `source_ref`):** quest completion tail → +10 (`source_ref` = quest id) and +20 when it is the day's 3rd completion (`all3-{date}`); account level crossing detected on the shared progression award tail → +50 (`level-{N}`); streak milestone reached (7/30/100) → +50/+150/+500 (`streak-{N}-{startDate}`).
- **Streak:** computed on read over the **business dates** of XP events (a quest's `quest_date`, an activity's `occurred_on`, else the event's local date) — the backdated-log decision from the hand-off notes; gap of 1 with a held saver → auto-consume (writes `saver_used`, decrements saver). No lazy rollover — the chip is honest on a fresh day.
- **Demodata:** `@Profile("demodata")` Java seed — profile + a few day-scoped coin/XP events so the demo Harvest is never empty.
- **FE hook swap:** `useGamification`/`useTitles`/`useGamificationActions` switch to the real endpoints with **unchanged signatures**; `canMutate` true in real mode (TitleShopSheet's shop goes live); new `useGamificationDay(date)` barrel-exported. Mock mode keeps the existing local store.

## 7. Frontend design (R3, `mezo-ilsj`)

**Feature structure** (`frontend/src/features/ritual/`): `pages/RitualPage.tsx` (composition root: act state machine, close-on-act-4, sheet mounts) · `components/{ArrivalStep,DayStoryStep,LoopsStep,HarvestStep,ReleaseStep}.tsx` · `logic/ritualRecap.ts` (pure: merge the day's reads into a timeline) + `logic/harvestStages.ts` (pure: reward staging order/timing). Route `/ritual` as `AppLayout` direct child; `hideTabBar` extended to it.

**Data layer** (`data/ritual/`): `ritualApi.ts` · `ritualMock.ts` (seed: open window computed from a fixed 22:30 bed anchor, `closed: false`) · `ritualHooks.ts` — `useRitualDay(date)` (`useDualQuery`, honest-empty in real mode), `useRitualActions(date).close()` (mock: cache-patch + `awardGamificationEvent({type:'HABIT', xpOverride:10})`, the intention first-focus precedent; real: POST then invalidate `['ritualDay',date]` + `['habitDay',date]` + `['dailyQuests',date]` + `['gamificationDay',date]` + `['gamification']` + `['progressionProfile']`), and `useDayRecap(date)` (composition over existing hooks — **zero new fetches**). All barrel-exported from `data/hooks.ts`.

**Today integration:** `RitualCard` (`features/today/components/`) in the "Teendők ma" zone, under `RoutineCard` — three states from `useRitualDay`: **waiting** (before `window.opensAt`: quiet card, „{opensAt}-kor nyílik"), **open** (glow CTA „Zárjuk le a napot ✨" → `/ritual`), **done** (quiet ✓ row). The card gates by the window, but a direct `/ritual` visit is allowed any time today (close is today-only server-side) — the window nudges, never locks (D2). URL scenario `?ritual=waiting|open|done` for demo/tests (the `?day=` precedent). `habitAction.ts` gains a `ritual` kind → navigate `/ritual` for the `evening_ritual` row.

**Animation:** new `rz-*` CSS family in `prototype.css` reusing/extending `np-draw`/`np-pop`/`np-twinkle`/`pulse-soft` + new `fall` (confetti) and `glowp` keyframes; `CountUp` in `shared/ui/` (rAF, respects reduced motion by jumping to the final value). Every loop/entrance behind `prefers-reduced-motion` guards; component tests stub `matchMedia` to reduce (the `LevelUpScreen.test.tsx` pattern).

## 8. Integrations

- **← Sleep goal:** the window derives from `SleepAnchorPort` (the `HabitTargets` idiom); no sleep-goal-side change.
- **← Habit:** `evening_ritual` DERIVED habit + evaluator case; act 5's handoff points at the SAME evening chain surface (`RoutineCard`) — the sleep-prep habits themselves stay outside the ritual (D3).
- **← Intention / Check-in / Activity:** act 3 reuses `useIntentionActions.reflect`, `CheckInSheet` + `useCheckins.saveCheckIn`, `ActivityLogSheet` — one write path per signal, no duplication.
- **← Proactive:** act 5 renders the existing 20:30 heartbeat „napzárás" note when present (honest absence otherwise). No proactive-side change.
- **→ Progression:** closure XP rides the HABIT tail; the Harvest stage reads `level_up_event`-derived aggregates + the progression profile. No new source type.
- **→ Gamification:** the ritual is the primary consumer of `GET /api/gamification/day/{date}`; quest/streak/level coin events become visible nightly.
- **→ Today:** `RitualCard` + the `evening_ritual` row; no changes to the greeting/day-arc data.

## 9. Testing

**Backend ITs:** `RitualApiIT` (window with/without sleep goal, close idempotency, `RITUAL_NOT_TODAY`, switch-off 404), `RitualEntityIT`, `HabitEvaluatorIT` + `ritual_closed` case (+ chain-count updates: EVENING 6), `GamificationApiIT` (profile derivation, day aggregation, title buy/equip/saver rules), `GamificationCoinIT` (quest +10/+20, level-up +50, milestones — idempotent re-runs), `GamificationStreakIT` (business-date streak, saver auto-consume, read-time honesty). New populators (`RitualPopulator`, `GamificationPopulator`); new tables in `ResetDatabase`.

**Frontend (both modes green):** `ritualHooks`/`gamificationHooks` tests (dual-mode, invalidation fan-out, mock award-once), `RitualPage` flow test (act progression, ✕ exit writes nothing, close fires once entering act 4), per-act component tests (reduced-motion stubbed), `RitualCard` three states + URL scenarios, `habitAction` new kind, `CountUp` unit test. Gate: `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.

**Visual:** +2 Playwright goldens (`/ritual` Arrival + Harvest, frozen clock, both themes), darwin + linux sets via the usual workflow.

## 10. Implementation epics

| Epic | bd | Scope | Depends on |
|---|---|---|---|
| R1 | `mezo-huzd` | Gamification ledger backend + FE hook swap (§6) | — |
| R2 | `mezo-hvmx` | Ritual domain backend + habit wiring (§5) | — |
| R3 | `mezo-ilsj` | Ritual FE flow + Today card + animations (§4, §7) | R1, R2 |
| R4 | `mezo-mzbz` | Visual goldens, reduced-motion audit, `docs/features/ritual.md` + touched feature docs | R3 |

R1 ∥ R2 in parallel; each epic = own bd issue + `feat/` branch + self-PR + CI-green merge per the house git flow.

## 11. Out of scope (v1)

- PWA push/notification reminder at window opening (the habit-engine deferral stands).
- Hard-gating the sleep-prep routine behind the ritual (soft order only — D2).
- A "day grade" self-rating in the ritual (the intention reflection + 20:00 check-in already carry the evaluative signal; no duplicate question).
- Weekly/monthly recap acts (the Insights Weekly + Memoir surfaces own that horizon).
- Companion-generated dynamic copy inside the ritual beyond the existing heartbeat note (a later flavor slice, the `QuestFlavor` precedent).
- Retroactively closing a past day (a missed ritual lapses quietly — ADR 0010).
