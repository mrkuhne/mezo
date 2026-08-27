# Heti áttekintés (Én / Heti) — exhaustive feature audit (2026-08-27)

> Ground truth for the design_2.0 redesign round of the weekly review. Produced from the
> merged `feat/weekly-review` slice (bd mezo-p2tr, PR #270, v2.52.0). Read together with
> `2026-08-27-en-feature-audit.md` (the Én tab) and the prototypes README.

**Scope:** bd `mezo-p2tr`, PR #270 `feat/weekly-review`, merged as `eb7fcbd9` ("feat: Heti áttekintés (Én/Heti) — weekly data + AI review + chat anchor"). Released in `v2.52.0`. 24 commits, ~130 files.

**Design of record:**
- `docs/superpowers/specs/2026-08-27-weekly-review-design.md` (211 lines, "approved by user")
- `docs/superpowers/plans/2026-08-27-weekly-review.md` (544 lines, 12 tasks)

---

## 1. IA & routes

### 1.1 Where "Heti" lives

| Item | Value | File |
|---|---|---|
| Route | `/me/week` (child of `me` → keeps the Én sub-nav chrome) | `frontend/src/app/router.tsx:159` |
| Component | `WeekPage` | `frontend/src/features/me/pages/WeekPage.tsx` |
| Tab entry | `{ id: 'week', to: '/me/week', label: 'Heti' }` — position **4 of 10**, right after `Napló` | `frontend/src/features/me/pages/tabs.ts:12` |

Full `ME_TABS` order (`tabs.ts:8-19`): `Profil` (`/me`, end) · `Growth` · `Napló` · **`Heti`** · `Cél` · `Súly` · `Alvás` · `Emberek` · `Tudás` · `Értesítés`. Rendered through the shared `SubNavDropdown` inside `AppHero`.

### 1.2 Day drill?

**There is no separate day route.** Day drill-down is *in-page expansion only* — a single-open accordion held in `WeekPage` local state (`WeekPage.tsx:130,177`). Expanded state is **not** in the URL and is lost on reload / week step.

### 1.3 The `/insights/weekly` redirect

`frontend/src/app/router.tsx:135-138`: `{ path: 'weekly', element: <Navigate to="/me/week" replace /> }` — no history entry. Test: `router.weeklyRedirect.test.tsx`. `INSIGHTS_TABS` no longer contains `weekly` (7 tabs remain: Minták / Memoár / Tudástár / Chat / Előrejelzések / Kísérletek / Memória).

**Deleted in the same slice:** `insights/pages/WeeklyPage.tsx`, `insights/components/GrowthWeekCard.tsx`, `data/insights/growthWeekApi.ts`, most of `weeklyHooks.ts` (only `isoWeekNumber` survives for memoirApi). The Growth-week card was **not** re-mounted on `/me/week` — see §8.

### 1.4 Week navigation (`weekNav.ts`)

`frontend/src/features/me/logic/weekNav.ts` — three pure functions: `prevMonday`, `nextMonday`, `isCurrentWeek(startIso) => startIso === mondayIso()`.

**Boundaries:**
- **Forward:** hard-stopped at the current week (`›` chip `disabled`).
- **Backward: UNLIMITED.** No lower bound, no "no data before X" guard, no first-week detection. Past empty weeks render all-null rows.
- Week selection lives in `?start=` written with `{ replace: true }` — stepping does **not** grow the history stack.

**`?start=` resolution** (`WeekPage.tsx:54-62`): must match `/^\d{4}-\d{2}-\d{2}$/`, be a real date, **and** `getDay() === 1` (Monday). Anything else silently falls back to the current week. No error, no toast.

Week title: `deriveWeekTitle(start)` from `data/fuel/fuelWeekHooks.ts:62-67` → `'Máj 18 – 24'`, cross-month `'Jún 29 – Júl 5'`. Visual golden: `me-heti` at `/me/week`.

---

## 2. The API contracts

### 2.1 `GET /api/me/week/{start}` — live deterministic week data

**Contract:** `api/feature/me-week/me-week.yml` (tag `MeWeek`). **Controller:** `feature/companion/controller/MeWeekController.java`, gated on `COMPANION_SWITCH`.

`start` path param **must be an ISO Monday** → `400 ME_WEEK_START_NOT_MONDAY`. **No 404** — a week with zero data still returns 7 all-null days.

**`MeWeekResponse`** — required `[start, days, weekly]`; `days` is **always exactly 7**, ascending; `weekly` object always present, fields inside nullable.

**`MeWeekDay`** — required `[date, subscores, checkinCount, workoutCount]`:

| Field | Type | Nullable | Semantics |
|---|---|---|---|
| `date` | date | no | |
| `score` | integer | **yes** | 0–100; `null` = „tanulom" (<2 non-null subscores) |
| `subscores` | `MeWeekSubscores` | no (object) | |
| `kcal` | number | yes | consumed; `null` when **nothing logged** (not 0) |
| `proteinG` / `carbsG` / `fatG` | number | yes | |
| `kcalTarget` / `proteinTargetG` | number | yes | from `FuelDayService` — present even on a day with no meals |
| `weightKg` | number | yes | latest weigh-in of the day (by `createdAt`) |
| `sleepMin` | integer | yes | `round(durationH × 60)` |
| `sleepQuality` | number | yes | 1–10 dial |
| `checkinCount` | integer | **no** | 0 on empty day, never omitted |
| `checkinEnergyAvg` | number | yes | mean of non-null energies, scale 2 |
| `workoutCount` | integer | **no** | gym (done) + sport + run |
| `xp` | integer | yes | `DAILY_XP` series |

**`MeWeekSubscores`** — all four nullable ints 0–100: `sleep`, `fuel`, `checkin`, `activity`. `null` = the domain logged nothing that day.

**`MeWeekAggregates`** — every field nullable:

| Field | Semantics |
|---|---|
| `score` | `round(mean(non-null day scores))`; `null` when fewer than 2 present |
| `prevWeekScore` | same rollup over `start-7 .. start-1` |
| `avgKcal` / `avgProteinG` | mean over days **with logged kcal** only |
| `avgSleepMin` | mean over days with sleep |
| `avgCheckinEnergy` | mean over days with an energy avg |
| `checkinRatio` | `filledSlots / (4 × elapsedDays)`; `elapsedDays` = 7 for a past week, else `clamp(today-start+1, 1, 7)` (`MeWeekService.java:229-237`) |
| `latestWeightKg` | latest weigh-in in the week not after today |
| `weightWeeklyRateKg` | `WeightTrendService.computeTrend` — **EWMA, global, not week-scoped** |
| `totalXp` | sum of non-null day XP; `null` when none |

### 2.2 `GET /api/proactive/weekly-review/{start}`

`proactive.yml:269-305`. **Never lazily generates.** `200` / `400 WEEKLY_REVIEW_START_NOT_MONDAY` / `401` / `404 RESOURCE_NOT_FOUND` (no row).

**`WeeklyReviewResponse`** — required, **all non-nullable**: `[id, weekStart, summary, dayNotes, highlights, generatedAt, stale]`.

| Field | Semantics |
|---|---|
| `id` | the row id — **doubles as the `weekly_review` feedback artifactId** |
| `summary` | the review prose |
| `dayNotes` | `{date, note}[]` — **sparse**: only days the model commented on; filtered to the week at parse time |
| `highlights` | `{kind, label}[]` — `kind ∈ Pattern | Fact | LifeEvent | Memory` (FE RefTag kinds), **model-SELECTED by index from code-collected candidates, never invented** |
| `generatedAt` | date-time |
| `stale` | best-effort probe — see §4.5 |

**There is NO status field.** Row exists = ready; 404 = not ready (or never will be). A failed generation leaves *no row* — indistinguishable from "not generated yet".

### 2.3 `POST /api/proactive/weekly-review/{start}/regenerate`

No body. `200` fresh response (`stale: false` hard-set) / `400` not Monday / `404` regeneration yielded no row (empty week) / `409 WEEKLY_REVIEW_WEEK_NOT_COMPLETE` (guard: `weekStart.plusDays(7).isAfter(now)`). Soft-deletes the live row, then generates **synchronously** (one LLM call inside the request).

### 2.4 `GET /api/proactive/weekly-review/{start}/digest`

**Always 200** — independent of the review row. (Non-Monday still 400s via shared controller guard.)

**`WeeklyReviewDigestResponse`** — all required, non-nullable:

| Field | Item shape |
|---|---|
| `patterns` | `{pairKey, title, event}` — `event ∈ confirmed | reinforced | promoted` |
| `newFacts` | `{id, text}` |
| `lifeEvents` | `{id, title, occurredOn}` |
| `memoir` | **boolean** (presence only) |
| `predictions` | `{id, title, status}` — `status ∈ pending | validated | missed` |

### 2.5 `POST /api/companion/conversation` (anchored conversation)

`CreateConversationRequest` gained optional `context: {kind: '^(week|day)$', date}`. Response `201 ConversationResponse` — **the opening assistant message is NOT in this response**; the FE navigates and the message-list fetch picks it up.

### 2.6 Feedback contract

`weekly_review` added as the **6th** artifact kind: `^(chat_message|feed_message|weekly_suggestion|weekly_review|memoir|prediction)$`. FE mirror: `data/feedback/feedbackTypes.ts:5-11`.

### 2.7 Reused endpoint

`GET /api/proactive/weekly-suggestion?date=` → `{id, weekStart, prose, generatedAt}`, 404 when no narrative memory in the prior week. Feeds `WeekNextCard`.

### 2.8 Migrations

- `202608271200…create_weekly_review.sql` — `weekly_review(id, created_by, is_deleted, created_at, week_start, summary, day_notes jsonb, highlights jsonb, generated_at)` + partial unique `(created_by, week_start) where is_deleted = false`
- `202608271500…feedback_weekly_review_kind.sql` — check constraint re-add with 6th kind
- `202608271800…ai_conversation_context.sql` — `ai_conversation` + `context_kind varchar(10)`, `context_date date`

---

## 3. Per-screen UI inventory (current state)

### 3.0 `WeekPage` layout, top to bottom (`WeekPage.tsx:138-198`)

1. **Header** `div.pghead-np.lav` — eyebrow **„Én · heti áttekintés"**, `h1` `deriveWeekTitle(start)`, two chips **`‹`** (`Előző hét`) / **`›`** (`Következő hét`, disabled on current week)
2. **`WeekHero`** — `{week && …}`
3. **`StatStrip`** — `{week && …}`
4. **`WeekScoreBars`** — `{week && …}`
5. **7 × `WeekDayCard`** — `{week && …}`
6. **`WeekReviewCard`** — always rendered
7. **`WeekDiscoveries`** — always mounted; renders `null` when empty
8. **`WeekNextCard`** — `{currentWeek && …}` only

**Loading state: NONE.** `useMeWeek` returns only `{week, mode}` — `isPending`/`isError` discarded (`meWeekHooks.ts:20-28`). Real-mode unresolved fetch ⇒ items 2–5 render nothing (no skeleton, no spinner). **Error state: NONE** — visually identical to loading.

### 3.1 `WeekHero` (local, `WeekPage.tsx:86-121`)

- Score present: big number `week.weekly.score` (display face, 56px/600) + span **„/100"**.
- Score null: **„tanulom"** (34px, tertiary) + **„még gyűjtöm az adatokat a heti értékeléshez"** (11px).
- **Delta chip** only when both `score` and `prevWeekScore` non-null: `+N`/`N`, green when `delta >= 0`, red otherwise. **Delta 0 renders as green `"0"`, not `±0`.**
- Spec called for a `ScoreRing` here; shipped as a flat big number.

### 3.2 `StatStrip` — 6 cells (`weeklyStatCells`, `WeekPage.tsx:75-84`)

| Label | Value | Null |
|---|---|---|
| „Kcal átlag" | `round(avgKcal)` + `kcal` | `—` |
| „Fehérje" | `round(avgProteinG)` + `g` | `—` |
| „Alvás" | `fmtSleepH` → „7ó 19p" | `—` |
| „Check-in" | `round(checkinRatio*100)` + `%` | `—` |
| „Súly trend" | `+/−/± {abs.toFixed(2)} kg/hét` (U+2212) | `—` |
| „XP" | `String(totalXp)` | `—` |

### 3.3 `WeekScoreBars` (48 lines)

Hand-rolled inline SVG, `viewBox 0 0 300 60`, `aria-hidden`. `BAR_W 24`, `GAP 16`, `MAX_H 48`, `rx 3`. `h = score == null ? 2 : max(2, score/100*48)` — linear.

**Coloring: single color `var(--dv-lav)`**, no score banding. Opacity `0.9` real / **`0.35` null** ("tanulom" day = faint 2px stub, distinct from a genuine 0 = solid stub).

**Axis hardcoded** `['H','K','Sz','Cs','P','Sz','V']` — **Szerda and Szombat are both `'Sz'`**; labels not derived from dates. No labels, tooltips, interaction, today marker.

### 3.4 `WeekDayCard` (148 lines)

Container: surface card, radius 20, `opacity: future ? 0.45 : 1`.

**Collapsed header** (button, `disabled={!canExpand}`):
- **Score badge:** `ScoreRing pct size=32 stroke=3 color=var(--dv-lav) label` or 32×32 **`—`** when null
- **Date:** `huMonthDayDow` → „Máj 20 · Sze" (HU_DOW: `['Vas','Hét','Kedd','Sze','Csü','Pén','Szo']`)
- **Compact line** ` · `-joined: `«2980 kcal» · «7ó 25p» · «84.3 kg» · «4× check-in»` — `—` per missing field, check-in count always printed (even `0×`)
- Chevron only when `canExpand`

**Expanded body** — 4 label/value rows:

| Label | Value |
|---|---|
| „Makrók" | `P {proteinG}/{proteinTargetG} g · C {carbsG} g · F {fatG} g` — **kcal / kcalTarget NOT shown** |
| „Alvás" | `{7ó 25p} · minőség {q}/10` or `—` |
| „Edzés" | `{workoutCount}×` |
| „XP" | `xp ?? '—'` |

**Subscore chip strip** — one span on `--warm` wash: **„Alvás 82 · Táplálkozás 75 · Check-in 74 · Aktivitás 88"** (fixed order sleep/fuel/checkin/activity, `—` for null). No heading, no bars/rings.

**Mezo day note** — bare `<p>` when `dayNote != null`. **No eyebrow, no attribution, indistinguishable from a data row.**

**Chat chip** — „Beszélgess a napról" + chevron; pending: spinner + „Indítás…".

**Guards:** `future` = current week && date > today ⇒ dimmed, not expandable, no chat chip. Single-open accordion. `chatPending` is **shared** — one handoff in flight disables all 8 chips.

### 3.5 `WeekReviewCard` (87 lines)

Eyebrow **„Mezo · heti elemzés"** (`--lav-deep`).

**State A — `review == null`:** ghost string
> **„Hétfő reggel érkezik — a Mezo a lezárt hét adataiból írja meg."**

One string covers three different situations: current week pre-Monday; past week the job skipped (no data); LLM failure. No retry affordance (regenerate chip requires `review.stale`).

**State B — review present:** `summary` as plain single `<p>` (no markdown, no truncation) · **stale chip** „Frissítsd az elemzést" / pending „Frissítés…" (only when `stale`) · **FeedbackChips** kind `weekly_review`, label `a heti elemzésről`, down-reasons „pontatlan / túl sok / rossz időzítés / nem rólam szól".

**Chat chip in both states**: „Beszélgess a hétről" / „Indítás…".

**NOT rendered:** `highlights`, `generatedAt`, any score, any error toast on failed regenerate (rejection swallowed by `void regenerate()`).

### 3.6 `WeekDiscoveries` (87 lines)

**A "discovery" is deterministic** — the digest endpoint, same window reads the generator uses. Whole card returns `null` when digest empty (no shell, no copy).

Eyebrow **„Mezo · amit a héten felfedezett"**.

| Section | Item | Link |
|---|---|---|
| „Minták" | `p.title` | `/insights/patterns/{pairKey}` ✅ |
| „Új tudás" | `f.text` | `/insights/knowledge` (list, not the fact) ✅ |
| „Életesemények" | `e.title` | none ❌ |
| „Emlékkönyv" | „Új bejegyzés készült a hétről" | `/insights/memoir` ✅ |
| „Előrejelzések" | `p.title` | none ❌ |

**Not shown:** pattern `event` kind, `lifeEvents[].occurredOn`, `predictions[].status`.

### 3.7 `WeekNextCard` (37 lines)

Eyebrow **„Mezo · a következő heted"**. Suggestion present: `prose` + FeedbackChips (`weekly_suggestion`, label `a heti tervjavaslatról`). Null: **„A társ heti tervjavaslata hamarosan."**

**Gating:** rendered only on the current week; the query is disabled otherwise (endpoint is always "about today", showing it on a past week would misattribute). Mock: static `mockWeeklySuggestion`.

### 3.8 Chat handoff — `useChatHandoff` (82 lines)

`{kind: 'week'|'day', date}` → real mode: `POST /api/companion/conversation` with `{context}` only (server re-derives all data) → `navigate('/insights/chat?c=' + id)`.

**Anchored conversation** = the conversation row carries `context_kind`+`context_date`; every turn gets a fresh `[Heti adatok]` block; the backend generates the first assistant message before the user types.

**Re-entrancy guard inside the hook** (`if (pending) return`) + `pending` threaded to every call site (spinner + disabled). Real-mode POST includes a synchronous SMART-tier LLM turn — multi-second wait. Failure: toast **„Nem sikerült elindítani a beszélgetést"**, no navigation. POST success + opening-turn failure ⇒ navigates into an empty conversation (by design).

**Mock copy:** week opening **„Átnéztem a heted — mi foglalkoztat belőle a legjobban?"**; day opening **„Átnéztem ezt a napot ({date}) — mesélj, mi járt a fejedben?"** (raw ISO interpolated); titles „Heti beszélgetés" / „Napi beszélgetés".

---

## 4. Data & generation pipeline

### 4.1 `DayScoreService` — the deterministic score (177 lines)

**Inputs:** 9 `MetricSeriesService` series fetched once per window (`SLEEP_DURATION_H`, `SLEEP_QUALITY`, `DAILY_KCAL`, `DAILY_PROTEIN_G`, `GYM_VOLUME_KG`, `SPORT_LOAD_MIN`, `TRAINING_RPE`, `DAILY_XP`, `CHECKIN_ENERGY`) + `CheckInRepository` slot counts + per-day `FuelDayService` targets.

**Formulas** (each subscore → `round(clamp01(v) × 100)`):
- **sleep** — null if no duration. `d = min(1, durationH/8.0)`; `= q==null ? d : 0.7d + 0.3·(q−1)/9`
- **fuel** — null if no kcal or target ≤ 0. `kcalCloseness = max(0, 1 − |kcal/target − 1| / 0.25)`; protein target > 0 ⇒ `0.5·closeness + 0.5·min(1, protein/target)` (**null protein counts as 0.0**, halving the subscore)
- **checkin** — null if count 0. `c = min(1, count/4)`; `= e==null ? c : 0.6c + 0.4·(e−1)/9`
- **activity** — null if no workout signal and no XP. `= max(workoutLogged ? 1.0 : 0, min(1, xp/150))` — a logged workout alone maxes it.

**The 1–10 correction:** FE dials are 1–10 (not the spec draft's 1–5) ⇒ `(v−1)/9`, pinned in `DayScoreServiceIT`.

**Honesty gate:** overall = rounded mean of present subscores, **null when <2 present** — applied per-day AND per-week (`MeWeekService.roundedMeanOrNull`).

**Constants** (`MeWeekProperties`, `mezo.companion.me-week`, `application.yml:1068-1072`): `sleep-target-h = 8.0`, `kcal-band = 0.25`, `xp-baseline = 150`.

### 4.2 `MeWeekService` (313 lines)

10 read collaborators. Notable rules: fuel presence = meals non-empty (targets always emitted); multi-row sleep keeps the **largest** duration; weight keeps most recent `createdAt`; `prevWeekScore` runs a **second full scores pass** (9 more queries); `latestWeightKg` excludes future dates; `weightWeeklyRateKg` is global EWMA.

**`renderDayLine(MeWeekDay)`** — public static single shared formatter used by BOTH the generator payload and the chat `[Heti adatok]` block (can never drift):
```
- 2026-05-20 (Sze): score 85 [alvás 90 · fuel 82 · checkin 80 · aktivitás 90], 3120 kcal / cél 3100, fehérje 225g, súly 84.1, alvás 7ó50p (8), 4 check-in, 1 edzés, 155 XP
```
`HU_DOW = {"H","K","Sze","Cs","P","Szo","V"}`. Missing = `–` (en dash).

### 4.3 `WeeklyReviewJob` — when generation happens

- **Cron `"0 50 6 * * MON"`** — Monday 06:50, **backward**: `weekStart = previousOrSame(MONDAY) − 1 week` (the just-finished week). After predictions 06:30 + experiments 06:45 so inputs exist. Separate from `WeeklySuggestionJob` (Mon 06:00, forward).
- Per-user fan-out, failures isolated. Triple switch: COMPANION + PROACTIVE + `mezo.techcore.cron.weekly-review-job.enabled`.
- **Idempotent** (existing row returned, no second LLM call). **No backfill.** On-demand only via regenerate; the GET is deliberately not lazy (avoids racing the cron off an in-progress week).

### 4.4 `WeeklyReviewGenerator` — the LLM prompt (273 lines)

Marker `HETI-ELEMZES-FELADAT`. **System prompt (verbatim):**
```
HETI-ELEMZES-FELADAT
Elemezd Daniel hetét KIZÁRÓLAG a megadott adatokból: mi ment jól, mi tört meg, milyen
összefüggés látszik a napok között. Társ-hangnem, nem jelentés; számot kitalálni tilos;
gyógyszer-adagolást érintő javaslat tilos. Minden adatot tartalmazó naphoz írj 1-2 mondatos
megjegyzést. Válaszolj KIZÁRÓLAG szigorú JSON-nal: {"summary": "...",
"dayNotes": [{"date": "YYYY-MM-DD", "note": "..."}],
"anchorIndexes": [a felhasznált HORGONY-JELÖLTEK sorszámai]}
```
One `completeSmart` call, `LlmCallContext("proactive_weekly_review", "generate")`.

**Payload (code-built):** `A HÉT NAPJAI` (7 renderDayLine) · `MINTA-ESEMÉNYEK A HÉTEN` (→ Pattern candidates) · `ÚJ TÉNYEK` (80-char truncated → Fact candidates) · `ÉLETESEMÉNYEK` (→ LifeEvent candidates) · `HETI MEMOÁR` (→ Memory candidate) · `PREDIKCIÓK` (title + status, NOT candidates) · `HORGONY-JELÖLTEK` indexed list. Empty blocks omitted.

**Empty-week gate:** `hasLoggedData` = kcal/sleep/checkin/workout on any day; else no LLM call, no row.

**Answer handling:** first-`{`…last-`}` Jackson parse; unusable ⇒ warn, **no row**. `dayNotes` filtered to the week; `anchorIndexes` bounds-checked + distinct → **the model can never invent a reference**.

**Notification on save:** `WEEKLY_REVIEW_READY`, title **„Elkészült a heti elemzés"**, body = first sentence of summary, deeplink `/me/week?start={weekStart}`, dedup `weekly_review_ready:{weekStart}`.

**FakeCompanionLlm:** mirror literal, greedy sentinel `[fake-review:{…}]` planted via memoir title; default `{"summary":"FAKE-HETI-ELEMZES","dayNotes":[],"anchorIndexes":[]}`.

### 4.5 `WeeklyReviewService` — read / stale / regenerate (113 lines)

`isStale`: true if any of **four** probes (weight / sleep / check-in / meal `findFirstBy…Between…OrderByCreatedAtDesc`) finds a row created after `generatedAt`. **Workouts deliberately not probed** (template rows have null date). Any exception ⇒ `false` + warn. **Probes `createdAt` only — an edited log does not mark stale.** Regenerate: 409 gate → soft-delete → generate → null ⇒ 404 → `stale` forced false.

### 4.6 Digest — `WeeklyReviewDigestService` + `WeeklyReviewWeekWindow`

Window utility (package-private): `since = weekStart UTC midnight − 1s`, `until = weekEnd+1 UTC midnight`. Pattern events union confirmed/reinforced/promoted; facts by createdAt window; life events ACTIVE + occurredOn in week; memoir presence; predictions by weekStart. Orphaned pattern refs silently dropped.

⚠️ **All windows use `ZoneOffset.UTC`** — a Sunday-late CET event can land in the wrong week's digest.

### 4.7 Anchored conversations + opening turn

`AiConversationEntity`: `contextKind ('week'|'day')`, `contextDate`. Create → set columns → `openingTurn` synchronously inside the POST (via ObjectProvider, cycle break). The **kickoff prompt is never persisted as a user message** — the transcript reads as Mezo speaking first. Opening failure ⇒ warn, conversation stays empty, create still succeeds.

**KICKOFF_PROMPT (verbatim):**
```
Nyisd meg a beszélgetést te: rövid, 3-5 mondatos reflexió a [Heti adatok] blokk kiemelt
napjáról (ha van kijelölt nap) vagy a hétről — mi tűnt fel, mi az egy dolog, amiről érdemes
beszélni. Kérdéssel zárj.
```

**`WeekContextRenderer`** (`[Heti adatok]`, companion): rendered **fresh every turn**. Contents: 7 renderDayLine · aggregates one-liner (`Heti összesítés: score 78 (előző hét 74), átlag kcal 3004, …`) · review summary + dayNotes when a row exists · for `kind='day'`: `A KIJELÖLT NAP: {date} — erről beszélgetünk.` + that day's line repeated. Never throws (warn ⇒ `""`).

**`WeekReviewSource`** (companion port, 1 read method) ← `WeekReviewSourceAdapter` (proactive impl, plain repo read). Absent bean ⇒ block renders without the review section. Keeps slices cycle-free.

### 4.8 The digest notification (push)

- `AppNotificationKind.WEEKLY_REVIEW_READY("weekly_review_ready", null, "/me/week")` — familyKey deliberately null (memoir precedent; the push category reads the row itself).
- `NotificationCategory.WEEKLY_REVIEW("weekly_review", defaultEnabled=true, lead=0, feWritten=false)`.
- **AnchorResolver: Monday 10:00 fixed** (`WEEKLY_REVIEW_MINUTE = 600`), `weekStart = date.minusWeeks(1)`, **no row ⇒ no push**. Title „Mezo · heti elemzés", body = word-boundary excerpt of the persisted summary (**never a new LLM call**), deeplink `/me/week?start={weekStart}`.
- **The old `WEEKLY` push is retired** (`@Deprecated`, kept only for persisted pref rows; no anchor emitted). Monday has exactly one push. `WeeklySuggestionGenerator` survives (feeds WeekNextCard).
- FE settings row: `weekly_review: { label: 'Heti elemzés', emoji: '📖', section: 'prose', description: 'Hétfő reggel 10:00', showLeadChip: false, iconBg: '--wash-sport' }` (`types.ts:1410-1413`), default ON. The `weekly` key is absent from the FE union; unknown rows filtered from GET.

---

## 5. Mock seeds

### 5.1 `data/me/meWeek.ts` — the demo week

`mockMeWeekStart = '2026-05-18'`, `KCAL_TARGET = 3100`, `PROTEIN_TARGET_G = 220`. The seed is **re-dated to any requested Monday** (same shape every week).

| Day | score | sleep/fuel/checkin/activity | kcal | P/C/F | weight | sleep | check-ins (energy) | workouts | XP |
|---|---|---|---|---|---|---|---|---|---|
| Hét | **78** | 82/75/74/88 | 2980 | 212/335/92 | 84.3 | 445m q7 | 4 (7) | 1 | 140 |
| Kedd | **72** | 68/80/70/78 | 3050 | 218/360/88 | 84.2 | 398m q6 | 4 (6) | 1 | 110 |
| Sze | **85** | 90/82/80/90 | 3120 | 225/355/95 | 84.1 | 470m q8 | 4 (8) | 1 | 155 |
| Csü | **null** | null/null/**65**/null | null | null | null | null | 2 (6) | 0 | 20 |
| Pén | **74** | 76/70/72/80 | 2870 | 198/320/84 | 84.0 | 420m q7 | 3 (7) | 1 | 100 |
| Szo | **null** | all null | null | null | null | null | 0 | 0 | null |
| Vas | **80** | 85/78/76/82 | 3000 | 205/340/90 | 83.9 | 460m q8 | 4 (7) | 0 | 60 |

Targets present on all 7 days. Csü = check-ins only (single subscore ⇒ null score via the <2 gate); Szo = nothing logged.

**`weekly`** (hardcoded): `score 78, prevWeekScore 74, avgKcal 3004, avgProteinG 212, avgSleepMin 439, avgCheckinEnergy 7, checkinRatio 0.75, latestWeightKg 83.9, weightWeeklyRateKg -0.3, totalXp 585` → hero **78/100 +4**, strip `3004 kcal · 212 g · 7ó 19p · 75 % · −0.30 kg/hét · 585`.

### 5.2 `data/me/weeklyReviewMock.ts`

`mockWeeklyReviewId = '9c2f6a3e-…'`. **Returns `null` for the CURRENT week** (ghost state demoable); otherwise re-dated:

`summary`:
> „Erős hét volt: a fehérjecélt öt napon tartottad, és a legjobb alvásod pont az edzésnappal esett egybe. A csütörtöki adathiány nem tört meg semmit — a hétvégi pihenőnap logolása visszahozta a ritmust."

`dayNotes` — 5 of 7 (offsets 0,1,2,4,6; Csü/Szo none):
| offset | note |
|---|---|
| 0 | „Hétfőn erős edzésnap volt — a fehérjecélt is hoztad, ez látszott az energiaszinteden." |
| 1 | „A röplabda estéd rövidebb alvást hozott, de a hangulatod tartotta magát." |
| 2 | „Szerdán volt a heted legjobb alvása — ez a nap vitte a legtöbb pontot." |
| 4 | „Pénteken könnyebb edzés, de a makrók továbbra is célban." |
| 6 | „Vasárnap pihenőnap volt, mégis logoltál mindent — ez tartja a heti ritmust." |

`highlights` — 2 entries (**never rendered by any component**): `Pattern` „Edzésnapokon jobban alszol" · `Fact` „A fehérjecél tartása javítja a check-in energiát". `generatedAt = start+7 T06:15Z`, `stale: false`.

**`mockWeeklyReviewDigest`** — re-dated for every week (digest independent of review row): 1 pattern (`sleep_workout`, confirmed) · 1 fact · 1 life event („Nyaralás kezdete", start+5) · `memoir: true` · 1 prediction („A súly csökkenő trendje folytatódik fehérjecél mellett", pending). Mock always renders all 5 discovery sections.

### 5.3 MSW handlers (`handlers.ts:1326-1385`)

Deliberately distinct from the mock seed: day 0 logged (score 65, 2800 kcal, 82.5 kg, 410m q6, 3 check-ins, 1 workout, 90 XP), days 1–6 empty; weekly score 65 prev 60. Weekly-review GET **404 by default**; regenerate always 200 („Frissített elemzés: …"); digest 200 with 'Real-mode …' rows; weekly-suggestion 404 by default. Backend populator: `WeeklyReviewPopulator.java`.

---

## 6. Honest-state rules

| Situation | Backend | UI + copy |
|---|---|---|
| Domain has no data on a day | subscore/value null (never 0) | `—` everywhere |
| Day <2 subscores | `score = null` | ring → 32×32 `—`; bar → 2px stub @ 0.35 |
| Week <2 day scores | aggregate `score = null` | „tanulom" + „még gyűjtöm az adatokat a heti értékeléshez" |
| `prevWeekScore` null | null | delta chip absent |
| Aggregate null | null | `—`, unit dropped |
| Future day (current week) | null | 0.45 dim, not expandable, no chat chip |
| Review not generated (current week) | 404 | „Hétfő reggel érkezik — a Mezo a lezárt hét adataiból írja meg." |
| Past empty week ⇒ no row | 404 (indistinguishable) | **same ghost string — misleading** |
| LLM failure | warn, no row, 404 | **same ghost string; no retry surface** |
| Opening-turn failure | swallow + warn | navigates into empty chat (by design) |
| Handoff POST failure | — | toast „Nem sikerült elindítani a beszélgetést" |
| Regenerate on in-progress week | 409 | unreachable via UI; rejection swallowed |
| Regenerate yields nothing | 404 | silently swallowed |
| Stale probe throws | `stale = false` | no chip (fail-quiet) |
| Digest all-empty | 200 empty | WeekDiscoveries renders `null` — card disappears |
| Weekly suggestion 404 | 404 | „A társ heti tervjavaslata hamarosan." |
| `/api/me/week` pending or FAILED | — | ❌ **nothing renders** — no skeleton, no error, no retry |
| Bad/non-Monday `?start=` | — | silently substituted with current week |
| First week / no history | 7 all-null days | „tanulom" hero, dash rows; **no dedicated first-week copy** |

**Invariants:** missing = null, never zero-filled; „számot kitalálni tilos"; highlights model-selected from code-collected candidates by index; unusable answer ⇒ no row, never a placeholder.

---

## 7. Ties to memory / knowledge

### 7.1 Does the weekly review write back? **No. Nothing.**

The pipeline is strictly read-only wrt knowledge stores. Only writes: the review row, the notification, the opening chat message, feedback upserts. No `KnowledgeFactRepository.save`, no `GraphNodeRepository.save`, no `PatternEventRepository.save`, no memory-note write, no `period_summary` write anywhere in the slice.

### 7.2 Read-only hooks that exist

`KnowledgeFactRepository` / `GraphNodeRepository` / `PatternEventRepository`+`PatternRepository` / `MemoirRepository` / `PredictionRepository` — all read by both generator (anchor candidates) and digest via `WeeklyReviewWeekWindow`. `MeWeekService` touches zero knowledge repos.

### 7.3 `WeekReviewSource` — the only cross-slice port

Read-only, one method, one direction (proactive → companion prompt). The one place review content re-enters the system: the `[Heti adatok]` chat block — fact extraction on chat turns *could* pick things up incidentally, but there is no designed weekly-review → knowledge path.

### 7.4 Data sources the generator reads

**Per-day:** meals/fuel + targets, sleep logs, weight logs + global EWMA trend, check-ins, workouts (gym done + sport + run + 3 series), XP.
**Week-window artifacts:** pattern events (confirmed/reinforced/promoted), new facts, ACTIVE life-event nodes, memoir title, predictions (title+status).

**Explicitly NOT read (despite existing):** journal entries / decisions, experiments (N=1), challenges, medication cycle, mentions/people, rituals, mesocycle/volume state, `period_summary(week)` narratives (**spec §3 listed it as input — cut**), `daily_summary` narratives, memory notes/embeddings, pragmatic profile, hydration, needs rings.

---

## 8. Gaps & latent opportunities

### 8.1 Backend returns it, the UI never shows it

| Data | Status |
|---|---|
| **`review.highlights[]`** | ❌ **never rendered — the single largest dead payload** (the whole index-selection machinery exists to produce them; spec's RefTag anchor row never built) |
| `review.generatedAt` | ❌ not shown |
| `digest.patterns[].event` (confirmed/reinforced/promoted) | ❌ all rows identical |
| `digest.lifeEvents[].occurredOn` | ❌ not shown, row unlinked |
| `digest.predictions[].status` | ❌ not shown, row unlinked |
| `digest.newFacts[].id` | ❌ links to the knowledge list, not the fact |
| `day.kcal` vs `day.kcalTarget` | ❌ expanded card shows protein-vs-target but not kcal-vs-target |
| `day.subscores` | ⚠️ flat text string — no bars/rings/colors/heading (spec asked for a breakdown) |
| `weekly.avgCheckinEnergy`, `weekly.latestWeightKg` | ❌ not in the StatStrip |
| `isPending`/`isError` | ❌ dropped — no skeleton, no error state, no retry |

### 8.2 Designed in the spec but cut/changed

ScoreRing hero → flat number · `period_summary(week)` input cut · pattern r/n/p deltas cut · prediction `actual` never read · life-event/prediction links cut · highlights-as-anchors cut · 1–5 → 1–10 corrected (deliberate) · backfill non-goal · chat week-tool non-goal · per-day LLM score non-goal · snapshot table non-goal · **Growth-week card deleted outright** (`GET /api/progression/growth-week/{date}` survives with zero FE consumers).

### 8.3 Behavioral rough edges

1. **One ghost string covers three states**; no user-reachable retry — **a „Készítsd el most" chip for a completed review-less week is a one-line UI addition** (the regenerate endpoint already does exactly that; 409 only if in-progress).
2. No loading/error surface on the primary read.
3. Unbounded backward navigation, no first-week affordance.
4. Bars axis hardcoded (Sze/Szo collide), not date-derived, `aria-hidden`, no today marker.
5. Single-color bars, no score banding.
6. Expanded-day state not in URL — a notification deeplink can't pre-expand a day.
7. Shared `chatPending` disables all 8 chips.
8. `stale` probes `createdAt` only; workouts not probed.
9. UTC week windows vs local-date day data — boundary events can land in the neighbouring week's digest.
10. `prevWeekScore` costs a second full scores pass on every read.
11. Delta 0 renders as green `"0"`.
12. Day note has no attribution chrome.

### 8.4 Enrichment points for "the week should teach the app about the user"

- **`WeeklyReviewGenerator.generate` is the natural write point** — it already has the knowledge repos injected (read-only today), a strict-JSON contract, and the bounds-checked index pattern. Extending the JSON to `{…, candidateFacts[], candidateEdges[]}` and routing through the **existing** candidate-fact review flow keeps the "code-collected, model-selected" discipline (never a raw model-invented fact straight to the store).
- **`review.highlights` is a ready-made bridge the other way** — the model already says which pattern/fact/life-event mattered; nothing consumes the signal (could reinforce pattern confidence, bump fact salience, seed graph edges). Persisted and free.
- A symmetric **`WeekReviewSink`** port (or reusing proactive-side knowledge-write services — the allowed direction) avoids slice cycles.
- **`weekly_review` feedback** (typed reasons) doesn't feed the pragmatic profile / tone loop.
- **Anchored conversations** are prime fact-extraction material (the *why* behind the week) — nothing marks them as high-value extraction targets.
- **Untapped inputs sitting right there:** journal/decisions, experiments, challenges, mentions/people, medication cycle, needs rings, `period_summary(week)` / `daily_summary`, memory notes.
- **`prevWeekScore` is the only longitudinal signal** — no multi-week series, no trend, no best/worst-week memory, no streak; the weekly score is computed on read and never persisted.

### 8.5 Key file map

**Design:** `docs/superpowers/specs/2026-08-27-weekly-review-design.md` · `docs/superpowers/plans/2026-08-27-weekly-review.md`
**Docs:** `docs/features/me.md` (primary) · `proactive.md` · `companion.md` · `insights.md` · `growth.md`
**Contracts:** `api/feature/me-week/me-week.yml` · `api/feature/proactive/proactive.yml:269-371,561-646` · `api/feature/companion/companion.yml:598-611` · `companion-feedback.yml`
**FE:** `features/me/pages/WeekPage.tsx` · `components/{WeekDayCard,WeekScoreBars,WeekReviewCard,WeekDiscoveries,WeekNextCard}.tsx` · `logic/{weekNav,useChatHandoff}.ts` · `data/me/{meWeek,meWeekApi,meWeekHooks,weeklyReviewApi,weeklyReviewHooks,weeklyReviewMock}.ts` · `test/msw/handlers.ts:1326-1385`
**BE companion:** `service/{DayScoreService,MeWeekService,WeekContextRenderer,ChatService,ConversationService}.java` · `controller/MeWeekController.java` · `config/MeWeekProperties.java` · `WeekReviewSource.java`
**BE proactive:** `entity/WeeklyReviewEntity.java` (+envelopes) · `service/{WeeklyReviewGenerator,WeeklyReviewJob,WeeklyReviewService,WeeklyReviewDigestService,WeeklyReviewWeekWindow,WeekReviewSourceAdapter}.java` · `repository/WeeklyReviewRepository.java`
**BE notification:** `AppNotificationKind.java:28-30` · `NotificationCategory.java:37-53` · `AnchorResolver.java:489-506`
**Config:** `application.yml:328-331,1068-1072,1077-1080`
