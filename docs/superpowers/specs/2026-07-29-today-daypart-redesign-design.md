# „Napszak-arcok" — the Today (Mai) screen re-composition (mezo-mvb4)

**Date:** 2026-07-29 · **Status:** approved by Daniel (4 browser mockups reviewed side by side) · **Driving bd epic:** mezo-mvb4
**Reference artifact:** [`2026-07-29-today-daypart-redesign-mockup.html`](2026-07-29-today-daypart-redesign-mockup.html) — four 440 px phone columns (A · Akció-konzol, B · Műszerfal, C · reggel, C · este) built on the app's real tokens + fonts. Open it from the frontend dev server (`frontend/public/`) or directly in a browser.

---

## 1. Context & problem

The Today screen (`/today`, tab „Ma") is the PWA's landing surface and has grown by accretion across eight slices (Napív S3 `mezo-8141`, gamified header `mezo-k7rn`, action-first `mezo-gj2y`, intention `mezo-a686`, ritual `mezo-ilsj`, habit `mezo-d1jb`, sleep night-layer `mezo-d71m`, quest restyle `mezo-vj0b`). Every slice was individually sound; the sum is not.

Full-page captures of the current screen in mock mode (morning 09:12 and evening 21:05) show four concrete defects:

1. **Thirteen distinct card idioms on one screen.** `.intent`, `.dayarc`, `.np-hero`, `.card`+`.quest-row`, `.ritcard`, the `RoutineCard` thread, `.beats`, `.brief`, `.scard`, the fuel left-rail list, `.wdb`, `.zonediv`, plus the plain `.card` used by three components — each with its own radius, accent, CTA shape and internal rhythm. The only genuinely repeatable card language in the app is Train's `.todaycard` (icon shield + eyebrow tag/time + display title + `.metapill` facts + full-width CTA, `DoneBar` once logged).
2. **No guidance.** ~2570 CSS px of scroll (≈3 phone screens) carrying ~14 co-equal CTAs (`Indítsuk →`, `Edzés`, `+15 XP`, `Naplózz`, `Zárjuk le a napot ✨`, `Pipa` ×2, three chevrons, `koppints`, `bővebben`, `+ Log`, `+ Fókusz`, `szerkeszt`). Nothing states what to do next.
3. **The screen does not follow the day.** At 21:05 it still renders „KÖVETKEZŐ · MA 17:00 / Indítsuk →" (a past session in the future tense), the „Reggeli briefing · 06:30" at full size, and a fuel timeline marking 18:11 as `MOST`. Only the greeting, the habit chain and the ritual card are time-aware.
4. **Duplication.** The morning weigh-in is simultaneously a daily quest **and** a habit-chain row. The workout is simultaneously the hero, a quest and a habit row.

**Goal:** a professionally guided Today. **No functionality may be lost**; restructuring, re-parenting and deleting redundant surfaces is allowed and desired. Frontend-only — no backend, no API-contract change.

## 2. Decision

Four directions were prototyped as real browser mockups and reviewed side by side:

| | Direction | Verdict |
|---|---|---|
| A | Akció-konzol — one `MOST` hero + compact list; briefing/arc/stats/fuel moved to a sub-page | rejected — exiles too much |
| B | Műszerfal — one scroll, four zones, unified cards, merged todo card | partially adopted (the merged todo card) |
| C | Napszak-vezérelt — three faces of the same screen behind daypart pills | **chosen** |
| — | C + B's merged todo card | **adopted** |

**Rationale.** A and B both re-dress the same fourteen CTAs; only C fixes defect 3 *structurally*. C also reuses an idiom already proven in this app — Train Mai's `DayStrip` navigator over a single day's content — which is exactly the surface Daniel named as the one that works. It gives the pills, colors and motion the brief asked for, and nothing has to leave the app: content is time-bucketed, not exiled.

## 3. The day model — three sleep-anchored faces

A new pure module `frontend/src/features/today/logic/dayFace.ts` derives the three windows from `useSleepGoal()`'s `wakeTime`/`bedTime` — **the same anchor `windDown.ts` and the Napzárás window already use, so there is one clock and no drift.**

| Face | Window | Example (wake 06:30, bed 22:30) |
|---|---|---|
| 🌅 `reggel` | `[wake − MORNING_LEAD_MIN, wake + MORNING_SPAN_MIN)` | 06:00 – 11:30 |
| ☀️ `nap` | `[wake + MORNING_SPAN_MIN, bed − EVENING_LEAD_MIN)` | 11:30 – 18:30 |
| 🌙 `este` | `[bed − EVENING_LEAD_MIN, wake − MORNING_LEAD_MIN)` | 18:30 – 06:00 |

Constants: `MORNING_LEAD_MIN = 30` (re-exported from / kept numerically identical to `windDown.ts`), `MORNING_SPAN_MIN = 300`, `EVENING_LEAD_MIN = 240`.

- **`MORNING_LEAD_MIN` is deliberately the same 30 minutes at which `windDownPhase`'s `night` ends**, so the day closes a circle: `night → reggel → nap → este (dim → winddown) → night`. The `dim`/`winddown`/`night` sub-phases live *inside* the `este` face and keep their current behavior.
- All math is minute-of-day and **wrap-aware** (a past-midnight bed works), mirroring `windDown.ts`.
- **Degenerate-anchor guard:** with an extreme sleep goal the `nap` window could compute empty or inverted. `faceWindows()` clamps so the three windows always tile the 24 h circle in order and `nap` receives whatever residue remains (possibly zero-length, in which case `dayFace()` can never return `nap` — but never returns `undefined`).

**Exported API:** `dayFace(now: Date, goal: AnchorTimes): DayFace`, `faceWindows(goal: AnchorTimes): Record<DayFace, {start: number; end: number}>`, `faceOf(hhmm: string, goal: AnchorTimes): DayFace`.

### Selection & URL

`?dp=reggel|nap|este` is the single source of truth for which face renders, following the `TrainTodayPage` `?day=` precedent exactly:

- the selection is **derived from the URL, never mirrored into state**, so a reload, a back step and a tab re-entry can never disagree with what renders;
- `params.get('dp')` is `null` when absent and `''` when blank — both skip parsing and mean „the current face" (the `Number(null) === 0` trap that once pinned Train to Monday);
- an unknown value falls back to the current face;
- writes use `setSearchParams(next, { replace: true })` — face-hopping is a view switch, not a history step.

**Act-anywhere.** Every action available on a face works while that face is merely *selected*, not current: retroactive `Pipa` on a morning habit at 22:00, an early evening-stack log at 16:00. This generalizes `RoutineCard`'s existing midday-expand affordance (`mezo-km27`), whose whole point was retroactive logging.

## 4. One card language

### 4.1 The shared primitives

Train's `.todaycard` is promoted from `features/train/components/TodaySessionCard.tsx` into two **domain-free** `shared/ui` primitives:

- **`ItemCard`** — `{ tone, emoji, tag, time?, title, facts[], logged, loggedSummary?, loggedDetail?, stateLabel?, ctaLabel?, onLog? }`. Modality-gradient surface, 44 px icon shield (swapped for a check when `logged`), eyebrow (tag · time), display title, `.metapill` facts, full-width CTA — or a `DoneBar` once logged. Without `ctaLabel` the card is read-only.
- **`ItemRow`** — the compact variant: 34 px shield + title + subtitle + either a right-aligned time or an action pill. Same tone tokens.

`features/train/components/TodaySessionCard.tsx` becomes a thin wrapper over `ItemCard`. **Binding constraint: the Train Mai must stay pixel-identical** — the existing `train-light/dark` visual goldens are the proof, and they must pass unchanged in S1.

`shared/ui` is domain-free by house rule; both primitives take only presentation props and import nothing from `@/data/*`, so this placement is correct (unlike a `Today`-specific card, which would belong in `features/today/components/`).

### 4.2 The Today-local components

Exactly four, all under `features/today/components/`:

- **`DayFaceStrip`** — the three pills. `role="tablist"`, one `role="tab"` per face with `aria-selected`; ink fill on the active pill; each pill carries its own open-item counter, which **replaces `DayArc` as the day-progress indicator**. Same visual family as Train's `.daychip`.
- **`FaceHeroCard`** — the chain hero: progress bar + the **next** step promoted to a highlighted row with its action + the remaining steps as `.metapill`s.
- **`TodoCard`** — the merged todo card (direction B's contribution): one progress bar, small-caps group labels (`REGGELI RUTIN · 3/8`, `NAPI KÜLDETÉSEK · 1/3`, `FUEL`, `CHECK-IN`), uniform rows.
- **`DoneFold`** — the collapsed `✓ Kész · N tétel · +XP` row at the foot of every face.

Plus three face compositions: `FaceMorning`, `FaceDay`, `FaceEvening` (named with the `Face` prefix to avoid colliding with `logic/dayFace.ts`).

### 4.3 The glue — `logic/todayItems.ts`

A pure module that normalizes **six sources** onto one `TodayItem` shape, buckets them by face, deduplicates, and partitions open vs. done:

| Source | Hook | Contributes |
|---|---|---|
| daily quests | `useDailyQuests(date)` | day-wide todo rows (CTA via the existing `questAction.ts`) |
| habit chains | `useHabitDay(date)` | morning/evening chain rows (CTA via the existing `habitAction.ts`) |
| check-ins | `useCheckins()` | one row per slot, bucketed by slot time |
| fuel timeline | `useFuelPreview()` | one row per slot, bucketed by slot time |
| train sessions | `useToday()` (workout, volleyball) | the `nap`-face hero |
| ritual + wind-down | `useRitualDay`, `windDownPhase` | the `este`-face hero + the wind-down card |

**Dedup rules (the defect-4 fix), table-tested:**
- a quest and a habit describing the same act (morning weigh-in) collapse into **one** row that carries both rewards;
- a session that is already the face hero never re-appears as a row;
- a completed item appears **only** in `DoneFold`, never in the open list.

**Day-wide items** (open daily quests, the creed chip) render on *every* face — only one face is mounted at a time, so this is not visual duplication.

`questAction.ts`, `habitAction.ts` and `growthToday.ts` are kept and called from here; the JSX-embedded conditionals they currently sit inside are what disappears.

## 5. Content map

**Fixed chrome on every face:** `AppHero` (unchanged) → single-line `GreetingHeader` (date · Reta · time) → `DayFaceStrip`.

### 🌅 Reggel
1. **Hero** — the morning chain in `FaceHeroCard`. When the chain is complete the hero switches to the day's first timed item.
2. **Mezo · reggeli briefing** — `BriefingCard` re-dressed as an `ItemCard`, carrying `alvás 7.2h · súly 78.6 · Reta D3` as `.metapill`s. *This is where `QuickStatsRow`'s „how am I starting" half lands.*
3. **Vezérelv chip** + `+ Mai fókusz` — the creed one-liner; full editing stays in `CreedSheet`/`IntentionSheet`.
4. **`TodoCard`** — open quests + the morning check-in slots + morning fuel rows.
5. **„Ma még vár rád"** — compact `ItemRow`s previewing later faces' items; tapping one switches to that face. *This is the guidance.*
6. Conditional: `VulnerabilityCard`, `CompanionNoteCard`.

### ☀️ Nap
1. **Hero** — the day's session as an `ItemCard` with its real `Indítsuk →` CTA (or `DoneBar` when complete). On a rest day: the rest-day card with `+ Saját edzés`.
2. **`TodoCard`** — remaining quests + the 14:00 check-in + afternoon fuel rows.
3. `CompanionNoteCard` (midday nudge).
4. Evening preview rows.

### 🌙 Este
1. **Hero** — Napzárás as an `ItemCard` in its three states (waiting / open / done). Inside the `dim`/`winddown` window the **Esti leállás** card sits above it in the same language, carrying the `wind_down` habit's `Pipa`; in `night` phase the existing dark „Éjszakai mód" row is unchanged.
2. **`TodoCard`** — evening chain + the 20:00 check-in + evening stack + leftover quests.
3. **Intention reflection** row (`IntentionBanner`'s evening half).
4. **„Ahogy a nap telt"** — the day's completed items with their `DoneBar` summaries + `+N XP ma`. *This is where `QuickStatsRow`'s other half lands.*

**Nothing moves to another tab.** Today simply stops duplicating what Fuel and Én already own.

## 6. Component fate

**New:** `shared/ui/{ItemCard,ItemRow}.tsx` · `features/today/logic/{dayFace,todayItems}.ts` · `features/today/components/{DayFaceStrip,FaceHeroCard,TodoCard,DoneFold,FaceMorning,FaceDay,FaceEvening}.tsx` — each with a colocated test.

**Changed:** `TodayPage.tsx` (composition root only) · `features/train/components/TodaySessionCard.tsx` (thin wrapper) · `BriefingCard` / `IntentionBanner` / `RitualCard` / `WindDownBanner` (re-dressed onto `ItemCard`) · `styles/prototype.css`.

**Deleted (components + their tests):** `DayArc.tsx`, `ZoneDivider.tsx`, `CheckInStrip.tsx`, `QuickStatsRow.tsx`, `FuelTimelinePreview.tsx`, `WorkoutTeaser.tsx`, `VolleyballCard.tsx`, `RoutineCard.tsx`, `TodayQuestsCard.tsx`, `shared/ui/QuickStat.tsx`.

**Deleted CSS families:** `.dayarc`/`.arc-*`, `.beats`/`.beat`, `.scard`, `.zonediv`, `.np-hero*`.

**Explicitly kept:** `logic/dayArc.ts` — **still used by `features/ritual/components/DayStoryStep.tsx`** (the Napzárás „Nap története" act reuses `buildArcPoints`/`pointXY`); `RetaPhaseBar` (Fuel + medication); every sheet; `AnchorModeView`.

**Untouched:** every data hook and the `data/hooks.ts` barrel, the entire backend, the API contract.

## 7. Motion

Drawn from the existing `np-*` vocabulary so Today moves like Train and Ritual, not like a fourth thing.

1. **Face switch** — the active pill's ink background **slides** (`translateX`, 260 ms `--np-ease-ios`), it does not cross-fade. Outgoing face: 160 ms `opacity 0 + translateY(-8px)`. Incoming face: the existing **`np-anim` stagger** (`--i` 0…n, 70 ms each). Direction-aware — forward enters from the left, backward from the right (±14 px).
2. **Ticking an item** — `np-pop` on the status disc (existing `.3 → 1.15 → 1`), the row washes sage over 220 ms, the `+N XP` pill floats up, then the row **collapses over 260 ms into `DoneFold`**, whose counter `np-pop`s. This is the „the day is progressing" feedback nothing currently gives.
3. **Progress bars** — the existing `progress-mbar-grow` (`--w` custom prop) on `FaceHeroCard` and `TodoCard`.
4. **Hero swap** — old card 180 ms fade-out, new `np-rise`.
5. **Entrance** — header → pills → hero → cards `np-anim` stagger, the same rhythm Train Mai already uses.
6. **Live signal** — a quiet pulse on the active pill **only** when an item is open *and* currently due. Not permanent decoration.
7. **Reduced motion** — everything is disabled under `@media (prefers-reduced-motion: reduce)`, guarded by a `todayReducedMotion.test.ts` modelled on `features/ritual/reducedMotionGuard.test.ts`. Without this the Playwright goldens (which run `reducedMotion: 'reduce'`) flake.

## 8. Risks & mitigations

1. **`AnchorModeView`** stays *above* the daypart model — the `?day=rough` early return is unchanged and never mixes with face selection.
2. **Visual coverage is frozen at 13:42**, which is the `nap` face. Add `today-reggel` and `today-este` goldens with their own fixed clocks, or the two most interesting surfaces ship uncovered.
3. **`useSleepGoal` becomes a root dependency of Today.** In real mode, while `isPending`, render a layout-matched **skeleton** (the `TrainTodaySkeleton` precedent) — never a flashing fallback face.
4. **`todayItems.ts` is the riskiest unit** (six sources, dedup). Built test-first; dedup rules as table tests.
5. **Visual goldens** for `today-*` must be regenerated on both platforms — darwin locally (`pnpm test:visual:update`), linux via the `update-visual-baselines.yml` workflow.
6. **Mock/real parity.** Mock `useSleepGoal()` returns fixed anchors, so faces are deterministic in mock mode. Both `pnpm test` and `VITE_USE_MOCK=true pnpm test` must stay green.

## 9. Testing

- **Pure:** `dayFace.test.ts` (boundaries, midnight wrap, degenerate anchors, `faceOf`), `todayItems.test.ts` (face bucketing, the dedup table, day-wide items, open/done partitioning).
- **Component:** `ItemCard`, `ItemRow`, `DayFaceStrip`, `FaceHeroCard`, `TodoCard`, `DoneFold`, and the three faces.
- **Composition:** `TodayPage.test.tsx` rewritten — face derived from the clock, `?dp=` override, unknown/blank `dp`, act-anywhere, AnchorMode early return, `DoneFold` contents.
- **Guard:** `todayReducedMotion.test.ts`.
- **Gate:** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — both modes green.
- **Visual:** `today-{reggel,nap,este}` × light/dark × darwin+linux; `train-*` goldens must pass **unchanged** after S1.

## 10. Slicing

| bd | Slice | Content |
|---|---|---|
| `mezo-jyua` | **S1 — the language** | `ItemCard`/`ItemRow` into `shared/ui`, `TodaySessionCard` rebuilt on top. Zero visual change; the Train goldens prove it. |
| `mezo-ly8c` | **S2 — the brain** | `dayFace.ts` + `todayItems.ts`, test-first, no UI change. |
| `mezo-j7u4` | **S3 — the faces** | `DayFaceStrip` + `FaceHeroCard` + `TodoCard` + `DoneFold` + three faces + `TodayPage` re-composition; the ten deletions and the CSS removals land here. |
| `mezo-1khu` | **S4 — the polish** | motion, a11y, skeleton, visual goldens, ADR + docs; move the mockup HTML out of `frontend/public/` next to this spec. |

S1 is independently shippable and green. Stopping after any slice leaves no half-finished surface.

## 11. Documentation obligations

- **ADR** `docs/decisions/0011-today-daypart-faces.md` — why daypart faces, why the sleep anchor, why the four context blocks dissolve.
- `docs/features/today.md` — §1/§2/§3/§8/§9/§10 rewritten.
- `docs/features/_platform-design-system.md` — the new shared `ItemCard`/`ItemRow` family and the deleted CSS families.
- Today-facing paragraphs in `habit.md`, `ritual.md`, `intention.md`, `growth.md`, `fuel.md`.
- `node scripts/lint-docs.mjs` to clear staleness.
