# Train „Mai nap” — day-strip navigation, colour-coded session cards, separate Heti page (design spec)

- **Date:** 2026-07-28 · **bd:** `mezo-9bbc` (this feature) · builds on `mezo-lruy` (stacked day rows + meta pills, shipped in PR #97) · **Feature doc:** [train.md](../../features/train.md)
- **Source:** owner (Daniel) request — the Mai view still feels "össze vannak dobálva", needs too much downward scrolling; the cards should carry the modality's colour, and a logged session should be signalled bigger and more clearly. He explicitly asked which day-navigation option is better: side-scrollable days, day tabs, or today-only + a separate weekly view.
- **Decided with Daniel in-session** (browser mockup round, `docs/design/train-mai-mockup-v1.html`, 2026-07-28):
  - **Card language = K3** — modality wash gradient + 44px icon shield; logged state swaps the icon to a check and replaces the CTA with a `donebar`.
  - **Palette = extended** — `cross` gets amber-deep, `trx` gets lav-deep (today all three sports share `--tag-sport`).
  - **Day navigation = A + C together** — a horizontal `DayStrip` on Mai for same-page day switching **and** a separate detailed `/train/week` („Heti”) page that takes over the seven expanded `WeeklyDayRow` cards + `LoadTiles`.
  - **Non-today days:** past days are **retroactively loggable**, future days are read-only („Tervezett”). Gym direct-start/review keeps working in both directions (unchanged from `mezo-bxpg`/`mezo-j3x0`).
- **Measured baseline** (440×956, mock week, before this change): the Mai page is **2.51 viewports** tall; the seven `.dayrow` cards alone are **1260 px** (~52% of the scroll). Gym hero 216 px, morning nudge 160 px, load tiles 56 px, meso entry + page head 114 px.

## 1. Goal

Make Mai a **one-day page**: it answers "what am I doing today, and did I do it" within roughly one viewport, while keeping the two things the weekly list is actually used for — *seeing the week's rhythm* and *jumping to another day* — via a compact day strip. Move the detailed weekly list to its own `Heti` page, where it may stay as verbose as it likes. Give every session card the colour of its modality and a loud, unmistakable logged state.

**Target:** Mai ≈ **1.15 viewports** on the densest mock day (3 sessions); `/train/week` carries the rest.

**No backend change.** Both log endpoints already accept an explicit `date` (`SportSessionCreateRequest.date` optional — server defaults to now; `RunSessionLogRequest.date` required), and the weekly agenda is already fully client-side derived, so day switching needs **no new fetch**.

## 2. Scope

**In scope (`mezo-9bbc`):**
- K3 card language for `TodaySessionCard` + the gym hero's done-state adopting the same `donebar`.
- Two new modality token pairs (`cross`, `trx`) + a tone map in `logic/sportKinds.ts`.
- New `DayStrip` component + `selectedDay` state on `TrainTodayPage` (+ `?day=` deep link).
- New `/train/week` route + `WeeklyPage` + 7th sub-nav tab; the `WeeklyDayRow` list and `LoadTiles` move there.
- Retroactive logging for past days (sheets take a date), read-only rendering for future days.

**Out of scope:**
- Editing an already-logged session in place (still needs a backend `PUT` — existing `mezo-0p3` follow-up). Tapping a logged card re-opens the sheet and creates/overwrites exactly as today.
- Any change to the active-workout flow (`/train/session`), the review page, or the mesocycle surfaces.
- Cross-domain reuse of `DayStrip` (Fuel/Insights day navigation). Designed domain-free enough to promote later, but it ships in `features/train/components/` until a second consumer exists.

## 3. Card language (K3)

`TodaySessionCard` (`features/train/components/TodaySessionCard.tsx`, introduced in `mezo-lruy`) is restyled, not rewritten — same props plus `tone` widening and a richer logged state.

**Not-logged layout:**
```
┌────────────────────────────────────────┐   background:
│ ┌────┐  FUTÁS · 12:00           [MOST] │   linear-gradient(150deg,
│ │ 🏃 │  Sprint-intervallum            │     var(--wash-run), var(--surface) 78%)
│ └────┘                                 │
│ [RPE 9–10] [5 kör] [~35 perc]          │   .metapill row (unchanged)
│ ┌────────────────────────────────────┐ │
│ │      ＋ Naplózd a futást            │ │   full-width .todaycard-cta
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘
```
- `.todaycard-icon` — 44×44, radius 15, `var(--surface)` shield, `--np-shadow-row`, emoji inside (🏋️ gym · 🏐 röpi · 🤸 cross · 🪢 TRX · 🏃 futás — the emoji already live in `SPORT_EMOJI`).
- The eyebrow (`{TAG} · {time}`) and the display title stack to the icon's right; the state chip (`MOST` / `ESTE` / `MA` / `TERVEZETT`) sits top-right.
- **State-chip copy** — exactly four values, derived in one helper (`logic/sessionState.ts`), no time-of-day vocabulary beyond these: **`MOST`** (today and the session's start hour is within ±1 h of now), **`MA`** (today, otherwise), **`ELMARADT`** (a past day, unlogged), **`TERVEZETT`** (a future day). A logged session shows no state chip — its eyebrow already reads `{TAG} · MEGVAN`. (The mockup's `ESTE` label is dropped; it would be a second, redundant vocabulary.)

**Logged layout:** background swaps to `linear-gradient(150deg, var(--wash-sage), var(--surface) 78%)`, the icon shield becomes `var(--sage-deep)` with a white check, the eyebrow reads `{TAG} · MEGVAN`, and the CTA is replaced by the **`donebar`**:
```
┌──────────────────────────────────────┐
│ (✓)  RPE 8 · 60 perc                 │   .donebar — wash-sage, radius 16
│      07:12-kor logolva               │   30px sage-deep check circle
└──────────────────────────────────────┘   + bold summary + quiet timestamp line
```
The `donebar` is a **new shared-in-Train presentational piece** (`components/DoneBar.tsx`) so the gym hero's `Kész · N szett — Megnézem →` button adopts the identical look; the gym variant keeps its navigation to `/train/review/{id}` (the whole bar is the tap target).

**Timestamp line:** the logged-at time comes from the logged session's `time` field (sport) / the log's own date (running); when absent, the second line is omitted rather than faked.

## 4. Palette — five modality tones

`prototype.css` gains two token pairs next to the existing three (light + `data-theme="dark"` overrides, matching the S8 Pulse pattern):

| tone | accent (light) | wash (light) | accent (dark) | wash (dark) |
|---|---|---|---|---|
| gym | `--tag-gym` `#C4622F` | `--wash-gym` `#FFEDE6` | existing | existing |
| sport (röpi) | `--tag-sport` `#B14B5E` | `--wash-sport` `#FBE9EC` | existing | existing |
| **cross** | **`--tag-cross` `#B07A2E`** | **`--wash-cross` `#FBF0DD`** | `#E0A458` | `rgba(224,164,88,.16)` |
| **trx** | **`--tag-trx`** = `--lav-deep` | **`--wash-trx` `#F0EDF8`** | `--lav-deep` (dark) | `rgba(171,159,210,.16)` |
| futás | `--tag-run` `#3E6E9E` | `--wash-run` `#E7F0F8` | existing | existing |

- `.typetag-cross`/`.typetag-trx` and `.stag-cross`/`.stag-trx` variants are added; `TodaySessionCard`'s `tone` prop widens to `'gym' | 'sport' | 'cross' | 'trx' | 'run'` and keeps driving `--tc-accent`/`--tc-wash`.
- `logic/sportKinds.ts` gains `SPORT_TONE: Record<SportKind, Tone>` (`volleyball → 'sport'`, `cross → 'cross'`, `trx → 'trx'`), so every consumer resolves the tone from one place. `WeeklyDayRow`'s `.stag` and `LoadTiles`' `.lic` follow the same map.
- **`LoadTiles` stays three tiles** (gym / sport / futás) — the sport tile aggregates all three sports, so it keeps `--tag-sport`. Splitting the tiles is out of scope.

## 5. Mai page — `DayStrip` + selected day

### 5a. `DayStrip.tsx` (`features/train/components/`)
Presentational, no data access, **fully pre-derived input** (no predicates threaded in): props are `items: DayStripItem[]`, `selected: string`, `onSelect(day: string)`. `DayStripItem = { day: string; dayNumber: number; isToday: boolean; dots: Tone[]; doneCount: number; sessionCount: number }` — built by the page from the agenda (a small pure helper next to `weekAgenda.ts`). The component must not import `@/data/*`.

Each chip (62 px wide, radius 20, `.daychip`):
- day label (`HÉT`, or `MA` on today) + the month day number;
- a dot row — one 6 px dot per session, coloured by the session's tone (so a mixed day reads `🟠🔵🔴` at a glance);
- a done marker line: one `✓` per logged session, `—` when nothing is logged, `pihenő` on an empty day (the chip itself goes dashed/transparent);
- today = coral ring, selected = solid `--ink` fill, empty = dashed.
Horizontal scroll (`overflow-x:auto`, no visible scrollbar), `scroll-snap-type: x proximity` so chips settle cleanly; the selected chip is scrolled into view on mount (`scrollIntoView({ inline: 'center' })`, skipped under reduced motion).

### 5b. `TrainTodayPage` changes
- New `const [selectedDay, setSelectedDay] = useState<string>(...)`: **always today** unless a `?day=` search param names a valid weekday (this is what the Heti page links to). An empty today stays selected and shows the rest-day card — never auto-jump to another day, the page must open on "today" every time.
- Everything below the strip renders the **selected** day: `daySessions()` over that agenda day (the helper is unchanged), the rest-day card, the "+ Saját edzés" CTA.
- **Today-only blocks stay gated on `selectedDay === todayKey`:** the morning-training nudge, the open-instance resume card, and the "Ma pihenőnap" copy (a non-today empty day reads „Nincs tervezett edzés” instead).
- Page-head over-line follows the selection (`Edzés · Csütörtök · W3`); when a non-today day is selected, the `h1` becomes that day's name and a `← Ma` chip (`.pgact-np`) returns to today.
- **Removed from this page:** the `Heti terv` section (`WeeklyDayRow` list + section head + footer "+ Saját edzés" row) and `LoadTiles` — both move to §6. The provenance note ("A gym a mesociklus szerint…") moves with them.

### 5c. Non-today behaviour
| | gym | sport / futás |
|---|---|---|
| **past, logged** | `donebar` → review (`workoutIdByDate`) | `donebar`, tap re-opens the sheet for that date |
| **past, unlogged** | direct-start (`gymDayTarget`, unchanged) | `ELMARADT` chip + `＋ Pótold` CTA → sheet **with that date** |
| **today** | three-state gate (unchanged) | today's log flow (unchanged) |
| **future** | direct-start (unchanged — you may train a day early) | `TERVEZETT` chip, **no CTA** |

Retroactive logging threads a `date` through the sheets: `SportLogSheet` and `RunLogSheet` take an optional `date` prop (default: today) and put it in the request body — `SportSessionCreateRequest.date` is already optional-with-server-default, `RunSessionLogRequest.date` is already required and currently always today. Done-state matching already works per date (`sportDoneOn(iso, kind)`, `runLoggedFor(key)` + `weekDoneDates`), so a retroactive log lights up its day's chip on the next invalidate.

## 6. `Heti` page — `/train/week`

- `TRAIN_TABS` gains `{ id: 'week', to: '/train/week', label: 'Heti' }` **after** `Mai`; the route is registered as a child of `TrainSection` (so it keeps `AppHero` + the sub-nav dropdown).
- `pages/WeeklyPage.tsx`: `.pghead-np` (`Edzés · W{n}` / „Heti terv”) → `LoadTiles` → the seven `WeeklyDayRow` cards (the `mezo-lruy` stacked form, unchanged) → dashed "+ Saját edzés" footer → the provenance note.
- **Drill-in:** a `WeeklyDayRow` tap that isn't a gym-specific action navigates to `/train?day={dayKey}` (Mai, with that day selected). The existing gym-specific taps keep their current targets (review / direct-start), so muscle memory is preserved.
- `WeeklyPage` needs the same agenda derivation as Mai. The `agenda` build in `TrainTodayPage` (gym schedule + sport slots + runs + custom-by-date, ~35 lines) is **extracted into `logic/weekAgenda.ts`** as a pure `buildWeekAgenda({ gymTimes, sportSlots, runningBlock, weekWorkouts })` so both pages derive it identically instead of duplicating it. This is the one refactor the change requires; it also shrinks `TrainTodayPage` (currently ~500 lines after `mezo-lruy`).
- Loading: reuse `TrainTodaySkeleton`'s idiom with a `WeeklySkeleton` (page-head + tiles + 7 row placeholders).
- Empty (no active meso): the same ghost as Mai's — "+ Tervezz mesociklust" + the dashed "+ Saját edzés" row.

## 7. Files

**New:** `features/train/components/DayStrip.tsx` (+ test) · `features/train/components/DoneBar.tsx` (+ test) · `features/train/logic/weekAgenda.ts` (+ test) · `features/train/pages/WeeklyPage.tsx` (+ test) · `features/train/pages/WeeklySkeleton.tsx`

**Modified:** `TodaySessionCard.tsx` (K3 + tones + DoneBar) · `TrainTodayPage.tsx` (selected day, strip, removals, `?day=`) · `WeeklyDayRow.tsx` (tone map for cross/TRX, drill-in click) · `logic/sportKinds.ts` (`SPORT_TONE`) · `pages/tabs.ts` (7th tab) · `app/router.tsx` (`/train/week`) · `sheets/SportLogSheet.tsx` + `sheets/RunLogSheet.tsx` (optional `date` prop) · `styles/prototype.css` (cross/TRX tokens, `.daystrip`/`.daychip`, `.todaycard-icon`, `.donebar`; `.dayrow` untouched)

## 8. Testing

- `DayStrip.test.tsx` — dot colours per tone, done markers, today ring vs selected fill, empty-day dashed chip, `onSelect` fires.
- `DoneBar.test.tsx` — summary + timestamp line, timestamp omitted when absent, tap fires the handler.
- `TodaySessionCard.test.tsx` — five tones map to the right classes; logged state swaps icon/eyebrow/CTA→DoneBar; `TERVEZETT` renders no CTA.
- `weekAgenda.test.ts` — pure derivation: gym+sport+run+custom merge, ISO dates per weekday, `isToday` flag.
- `TrainTodayPage.test.tsx` — day switching renders the other day's sessions with no refetch; `?day=` initialises the selection; `← Ma` returns; morning nudge/resume card hidden on a non-today selection; past unlogged sport shows `＋ Pótold` and the sheet receives that date; future day renders no CTA.
- `WeeklyPage.test.tsx` — seven rows + tiles render; a row tap navigates to `/train?day=…`; ghost state without a meso.
- `train.nav.test.tsx` — the `Heti` tab exists and routes.
- Visual: regenerate `train-light/dark` (both platforms) + add `train-heti-light/dark` to `SCREENS`.
- Gate: `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` + `pnpm test:visual`, and the CI PR gate for the full suite.

## 9. Docs

- `docs/features/train.md` — rewrite the `Mai` composition paragraph (day strip + selected-day semantics + non-today matrix), add a `Heti` subsection, update the file map and the §"gotchas" entry about `WeeklyDayRow`.
- `docs/features/_platform-design-system.md` — the two new token pairs, `.daystrip`/`.daychip`, `.todaycard-icon`, `.donebar`.
- Mockup kept at `docs/design/train-mai-mockup-v1.html` (the decision record for K1/K2/K3 + A/B/C).

## 10. Risks & open ends

- **Hidden week tail.** The strip's last chips are off-screen on a 440 px viewport — accepted (the mockup made this visible); the `Heti` tab is the full view. Mitigation: scroll-snap + centring the selected chip.
- **Emoji rendering.** The icon shield leans on platform emoji (already true for the existing type tags). If a glyph looks wrong on Android/Chrome, the shield can take an `Icon` glyph instead without layout change.
- **Two "week" surfaces.** `Heti` (agenda) vs the Gym tab's own week view may read as duplication. They differ in purpose (cross-modality agenda vs gym split editing); if it still confuses, a later pass can merge them — explicitly not now.
- **Retroactive log correctness.** Only the client date changes; server-side `created_by`/ownership and the XP/level-up path are untouched. Worth one manual check that a retroactive sport log does not re-trigger a streak bonus for today.
