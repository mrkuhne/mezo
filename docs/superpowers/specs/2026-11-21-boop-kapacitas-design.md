# Boop B7 — Napi kapacitás + Átrendezés (how much the day can carry, and what to move)

- **Status:** **approved by the owner 2026-11-21** (spike "Mehet a terv", spec "Jóváhagyom") · **Date:** 2026-11-21
- **Issue:** `mezo-r36n9.17` · **Epic:** `mezo-r36n9` · **Session:** `b6-b7-epites-5d50e3`
- **Spike:** `ios/Boop/KapacitasDemo/KapacitasDemo.swift` on branch `feat/b7-kapacitas-spike` (throwaway, not for main),
  `-previewKapacitas YES [-kapOpen ma|atrendezes|hatas|nap|evad]`; screenshots `docs/superpowers/specs/assets/kapacitas/01–08`.
- **Builds on:** standalone spec `2026-11-11-boop-standalone-design.md` §5 (B7 row) and §5.1 (B7 revision: no second
  card surface, no second notification policy, no second "miért?", no invented number); B6 Évad spec
  `2026-11-20-boop-evad-design.md` ("the season is the frame B7 adjusts within"); research
  `docs/superpowers/research/boop-standalone/05-calendar-energy.md` (partly superseded, see §9).
- **Dependency:** B6 S2 (adherence, insights, the Évad wall card) is **merged** (`a718f0d63`, 2026-11-21), so K2 can
  build on the overview and the wall registry. B6 S3/S4 (menu, experiments) are still to come — §7.5.

## 1. Intent — in the owner's words

> *„csináljunk egy új oldalt ahol megmutatja mit kéne áttenni szerinte, bármilyen módosítás lehet ott edzés, alvás,
> kaja, program lemondás, program csúsztatás, később alvás és másnap reggeli edzés csúsztatás, üres napra átrakni
> edzést … ezt egy szép új oldalon kell megmutatnia és kifejteni minden kereszthatását. és nekünk kell jóváhagyni, ha
> pedig jóváhagytuk akkor az appban mindenhol át kell mozgatni az adott esetet, de ugye a tervben nem szabad
> módosítani, tehát ez mindig az adott hétre és napra vonatkozik.”*
>
> *„tárolni kell folyamatosan azt hogy mit mozgatunk és miért és elkezdeni építeni belőle egy adatbázist ahonnan majd
> előre fogjuk látni … hogy mi okoz gondot és hogy ne vállaljuk túl magunkat és erről előre fog szólni.”*
>
> *„a napirendünket, energia szintet stb vizsgálni kell az Évad szintjén”* · *„a logolt étkezések és edzések is
> számítsanak bele … számítsuk bele a checkint is és a zárást is emellett.”*

**What B7 is:** every morning Boop says in one sentence whether the day fits (demand from the calendar, training and
food against capacity from sleep, pulse, Forma, recent load and how he says he feels). When a day or a week is too
much — ahead of time on Sunday, or live when something changes — Boop proposes concrete moves on a new **Átrendezés**
page, each with every cross-effect spelled out. Nothing moves without his tap. An accepted move changes **that day /
that week everywhere in the app**, never the season plan. Every move, its reason and how the day then went is kept,
and that log becomes the learning base from which Boop warns him before he over-commits — per week and at the
season level.

**Success, as he agreed it a month later (owner: "tökéletes"):**
1. Packed days don't take him by surprise — Sunday evening Boop has already proposed what to move.
2. One sentence in the morning tells him what to expect; mid-day Boop only speaks when something really changed.
3. He sees how he carries the season: weekly load against recovery on Évad, with a warning when load outruns rest.
4. It works without typing anything: Boop learns from what collects by itself; the check-in and the evening close,
   when he does them, make it sharper.

## 2. Owner decisions taken in this brainstorm

| # | Question | Answer |
|---|---|---|
| a | What does B7 learn from? | **Everything:** calendar, sleep, pulse, steps, workouts done/skipped and how hard, logged meals vs the budget, **plus the check-in and the evening close** when he does them. None is mandatory; the check-in and the close are the strongest signal of "how the day really felt". |
| b | Can Boop rearrange the week? | **Yes, by proposal on a new page ("Átrendezés")** — any kind of move (training, sleep, food, a meeting cancelled or shifted, later bedtime + the next morning's session shifted, a session onto an empty day…), every cross-effect explained, his approval per move. |
| c | What does an accepted move change? | **That day / that week, everywhere in the app; never the season plan.** |
| d | Calendar changes ("cancel / shift the meeting") | **Stay a to-do.** Boop never writes the calendar (2026-11-11 read-only decision stands); after acceptance it shows "tedd át", watches the calendar and adjusts everything once the event really moved. |
| e | How much of the calendar goes to the AI? | **Everything** — title, times, attendees, location, recurrence ("menjenek címek egész nyugodtan … minden info"). **Overturns** the "titles never go to the LLM" rule (research 05, `BoopPrompts`). |
| f | The move log | **Kept forever and learned from:** what moved, why, what he decided, how the day then went → patterns → warnings ahead (Sunday week preview, new season planning). |
| h | Where can a moved session go? | **Only onto an empty day of the same week** (no swaps, no crossing weeks) — cheaper and safer; swaps can come later. |
| g | The season | Load and recovery are examined **at the season level too** (Évad section, season-level proposals such as bringing the deload week forward). |

Context fact, not a decision: he has done no check-in / close since 2026-11-15 because he is building the app (prod:
4 check-ins and 1 close since Boop launched). The "learning" period starts when he uses it again.

These go to `_dontesek.json` and `14-decisions.md` as #66–#71 (a; b+c as one; d; e; f+g as one; h).

## 3. Goals, non-goals, anti-goals

**Goals**
1. **Event demand** for every calendar event: mental, social, physical cost (and "feeds me" for restoring events),
   scored by the cheap model from all event fields, cached per event version, owner-correctable.
2. **Day demand vs day capacity** in one internal unit, with a three-way breakdown, sequence-aware (back-to-back
   blocks cost extra, gaps give credit), capacity from his own rolling baselines.
3. **Morning verdict** (one word + reason) in the briefing row; the **energy curve bent by demand** (height only,
   timing stays circadian); a **day page section** "Mennyit bírsz ma · Mi visz el energiát · Amiből gazdálkodsz".
4. **Átrendezés page** with typed proposals (§5.5), each with its full cross-effect set computed by the real engines.
5. **One day-adjustment ledger** that every reader consults, so an accepted move shows on Ma, the day page, Edzés,
   Étel, bedtime reminder, the brief and the AI context; undo per move.
6. **Move log + learning:** every proposal, decision and outcome stored; deterministic pattern detection; patterns
   shown and used to warn ahead.
7. **Season level:** weekly load vs recovery chart and season proposals on Évad; capacity patterns offered when a new
   season is planned.
8. **Live re-plan loop:** on a trigger (check-in saved, meal logged, workout finished, Health sync, calendar change)
   recompute the day; if it crosses a threshold, a proposal for today appears.

**Non-goals**
- Writing the calendar (decision d). Declining meetings for him.
- Changing the season plan from a proposal (decision c). Season-level proposals that *would* change the plan open
  Évad's own Módosítás preview instead — B6 owns that write.
- A new card surface, a new notification policy, a new "miért?" surface (§5.1 rules).
- On-device scoring with Apple Foundation Models (decision e makes the server path acceptable).
- HRV-dependent logic: HRV exists on 5 of 132 days; capacity uses it when present, never needs it.

**Anti-goals (failure even if it "works")**
- A harsh morning number or red verdict that sets his mood (prior art: orthosomnia). The verdict is a word plus a
  reason, worded gently; "túl sok" is reserved for real overload.
- A cross-effect number not computed by the engines (kcal from the goal engine, sleep from `SleepNeedRule`, weight
  date from the season preview). The LLM never produces a number.
- Proposals that nag: max one wall card at a time, the two-a-day ring cap, "Most nem" respected for the day, a
  declined move type not re-proposed for the same day.
- Two places that disagree about what happens on a day — the ledger is the only truth for "this week's changes".
- Pretending to know: until calibrated, every verdict carries "még tanulom".

## 4. Approaches — considered, and the pick

| Approach | What | Trade-off |
|---|---|---|
| **A. Server computes, phone shows; one adjustment ledger** *(picked)* | New backend feature computes event scores, day load, proposals and cross-effects through existing engines (goal prescription draft, `SleepNeedRule`, season preview); accepted moves land in one `day_adjustment` ledger that readers consult through ports; move log + patterns on the server. | Cross-cutting: every reader of "what is planned today" must learn the ledger. Worth it — it is the only way "everywhere in the app" stays consistent and the AI sees it. |
| B. Phone computes | Swift does scoring, the model and the proposals. | The goal engine, season and AI live on the server; two calculators would disagree (the Évad anti-goal). Rejected. |
| C. LLM proposes | The model invents moves and writes their effects. | Invented numbers. Rejected; the LLM only scores events and words lines. |

Approach is my call (the owner talks outcomes); presented to him 2026-11-21 without objection.

## 5. The design

### 5.1 Signals (what Boop reads)

| Signal | Source today | Use |
|---|---|---|
| Calendar events (all fields) | `calendar_event` (history since 2026-09-12, upsert by `external_id`, soft-delete) | demand |
| Sleep (duration, timing, vs need) | `sleep_log`, `SleepNeedRule` | capacity, sleep debt |
| Resting HR, HRV, steps, active kcal | `daily_metric` (HRV sparse) | capacity vs baseline |
| Forma | `BoopScores` | capacity anchor |
| Workouts done / skipped, volume, RPE | train sessions, `planned_skip`, `sport_slot_skip` | physical demand + yesterday's load |
| Meals logged vs budget | fuel day plan / meal logs | fuel term (under-eating lowers capacity), adherence |
| Check-in (energy, stress, mental, mood, body) | `check_in` + `check_in_snapshot` | live capacity correction + label |
| Evening close (day rating 1–5, evening energy 1–10) | `day_close` | the ground-truth label for calibration |
| Kímélő / recovery period | `recovery_period` | capacity floor, no proposals that add load |
| Season (week rhythm, deload, sleep need) | `feature/season` overview | frame + season-level view |

**iOS calendar change (K1):** `CalendarReader` today reads attendees but never sends them (`CalendarReader.swift:15`).
The sync must now send attendee count + names, organizer-is-me, location, recurrence flag, availability (busy/free)
and the notes field (capped, builder sets the cap). Contract change in `api/feature/wearable/wearable.yml`, new nullable
columns on `calendar_event`. **The sync window widens to yesterday … +8 days** so the Sunday 18:00 preview sees
the whole next week (the server cap of 31 days already allows it). *(builder-check answer, my call)*

### 5.2 Event demand scoring

- One cheap-tier `CompanionLlm` call per **new or changed** event (hash of title + times + attendees + location +
  notes), batched per sync, all fields included (decision e). Output schema per event: `mental 0–3`, `social 0–3`,
  `physical 0–3`, `restores bool`, `kind` (meeting, focus, call, errand, social, sport, travel, medical, other),
  `confidence`. Stored in a new `calendar_event_score` table keyed by event id + hash.
- Fallback without the model (quota, timeout): rule score from duration + attendee count + time of day; marked
  `source = rule`.
- **Owner correction:** on the day page a tap on an event row lets him set "merít / semleges / feltölt"; stored as an
  override that wins and is fed as a few-shot example to later scoring (per-person calibration).
- LLM log: use `LlmCallContext` with payload kept like other features (the owner accepted sending everything; no
  special redaction). Budget: per-user cap via `LlmCallQuota`; the expected volume is ~10–30 events/day.

### 5.3 The load model (pure, deterministic)

- **Demand units** per event = duration-weighted sum of the three components (weights tunable, start equal), plus
  a **sequence cost**: each minute inside an unbroken block of ≥ 90 minutes of meetings costs ×1.3; a gap ≥ 15 min
  gives a small credit (Microsoft back-to-back finding, §8). Training demand from the planned session (type,
  duration, planned volume) — after it is done, from the logged volume/RPE. Commute/travel events count as physical
  low + mental low.
- **Capacity units** = a personal base (rolling 28-day median of his day demand on days rated ≥ 4 or, until there
  are labels, his median day demand) **× 1.25 headroom, so an ordinary day reads `rendben` (≈ 0.8), not `szoros`**
  *(my call, config)*, scaled by today's state: sleep vs need, resting HR vs 28-day baseline, HRV vs
  baseline when present, yesterday's load, under-eating yesterday, kímélő floor, and the morning check-in when given.
  Each factor's contribution is kept for the "Amiből gazdálkodsz" rows.
- **Verdict words** from the ratio demand/capacity: `laza` < 0.6 ≤ `rendben` < 0.9 ≤ `szoros` ≤ 1.0 < `túl sok`.
  Thresholds are config, not code.
- **Learning state:** fewer than 14 days with a full signal set or fewer than 5 labelled days (close or check-in) →
  `tanulo = true`; the verdict still shows, with "Még tanulom, mennyit bírsz" and the count. Calibration: when labels
  exist, a simple per-person linear fit of capacity scale against (day rating, evening energy), refitted weekly, with
  bounds; never a black box. No labels → stays heuristic, honest about it.
- All of it is pure functions with unit tests, like `BoopScores` / `EnergyCurveModel`.

### 5.4 Morning verdict, energy curve, day page

- **Brief payload** (`GET /api/boop/brief`) gains a `capacity` block: verdict word, one reason line (rule-built
  from the top two drivers, LLM may only rephrase), ratio, `tanulo`, demand items (event, time, kind, level word,
  `restores`), capacity factors (label, value text, effect word), and **demand-bent hourly energy**.
- `EnergyCurveModel.hourly(...)` gains a demand series: demand lowers the curve's **height** in and after loaded
  hours, never moves peak/dip timing (Rise model, §8). Sleep debt keeps muting peaks as today.
- **Briefing row on Ma** shows the verdict + reason (spike screen 01). The **day page** (`DaySheet`, reached from the
  ring's top orb and the "A napod" fold) gains three blocks below the curve: *Mennyit bírsz ma* (level bar),
  *Mi visz el ma energiát* (demand rows, tap = correct the score), *Amiből gazdálkodsz* (capacity rows), then the
  learning note (spike screen 06). The Energia area's heat strip keeps its place and reads the same demand.

### 5.5 Proposals (the generator)

Typed, each built by a deterministic generator from the week's load picture and the season frame; the LLM only
words the title and "miért?" lines from the generator's facts.

| Kind | Example | Writes on accept |
|---|---|---|
| `MOVE_SESSION_DAY` | lábnap csütörtök → szombat (empty or light day) | ledger: session date override |
| `SHIFT_SESSION_TIME` | reggeli edzés 6:45 → 7:45 | ledger (reuses `workout_time_override` semantics) |
| `SHORTEN_SESSION` / `LIGHTEN_SESSION` | 60 → 40 perc, kevesebb sorozat | ledger: session adjustment (`workout_day_adjustment` semantics) |
| `SWAP_SESSION_KIND` | edzés helyett séta / mobilitás | ledger |
| `SKIP_SESSION` | kihagyás okkal | existing planned-skip path (reason `KAPACITAS`) |
| `SHIFT_BEDTIME` (+ linked next-morning shift) | szerda 22:30 → 23:15, csütörtök séta +1 óra | ledger: bedtime override for that night (+ linked session shift as one bundle) |
| `MOVE_MEAL_ENERGY` | nagyobb ebéd, kisebb vacsora (same day total) | ledger: meal-slot split for that day |
| `CALENDAR_TODO` | a sprint review 16:00 → 15:00 / lemondás | ledger: to-do, state `waiting` until the calendar shows it |

- **Bundles:** a proposal may contain several linked moves that are accepted or declined together (later bedtime +
  next-morning shift).
- **Food follows the session by itself — no nutrition-engine change.** The day's kcal target rises only when a
  session is *logged* (`FuelDayService`, mezo-tb3s2: "the plan alone never raises it"); a planned session is the
  display-only expected extra (`pendingMovementKcal`). So a moved session's expected extra simply shows on its new
  day, and the card says so ("az edzésnapi többlet szombaton jár, amikor megcsinálod"). *(builder-check answer, my call)*
- **Cross-effects** are computed by running the draft week through the real engines: the fuel day service's expected
  movement figure for each touched day, `SleepNeedRule` + bedtime, the load model for every touched day
  (verdict before → after), rest days before sport slots, weekly totals (sessions, kcal, sleep hours) and the season's
  target date (unchanged unless a season-level proposal). Every line on the card and on *Minden hatása* (spike screen
  05) comes from these results.
- **Where a session may go (owner, 2026-11-21: „Csak üres napra”):** `MOVE_SESSION_DAY` only onto a day **of the same
  Mon–Sun week** that has **no gym session**; no swaps, no crossing into the next week. The template's weekday stays
  the plan; the ledger only re-dates this week's occurrence, so "done this week", block progression and the season's
  adherence count it once, on its new day. Swaps / week-crossing are a later extension if he misses them.
- **Constraints** the generator respects: the season's weekly session count, no two heavy sessions of the same
  muscle region on consecutive days, ≥ 1 rest day before a sport slot when possible, kímélő blocks added load, a
  running session (409 `TRAIN_DAY_WORKOUT_RUNNING`) is never moved, the past is never touched.
- **Limits:** at most 5 open proposals per week page; the generator ranks by expected relief.

### 5.6 The Átrendezés page (spike screens 02–05)

`NKAreaSubPage` (hue: Energia's `.pulzus`), reached from the Ma wall card, the day page ("Mit tennél át?") and Évad's
"A jövő heted" row. Blocks: *A heted* (seven columns: demand bar vs capacity line, word per day, the overloaded day
lit), *Boop javaslatai* (proposal cards: kind label, serif title, from → to line in the hue, 3–4 short cross-effect
lines, *Jóváhagyom* / *Most nem* — a calendar to-do says *Felírom teendőnek* — and *minden hatása*), *Ha mindet
jóváhagyod* (week totals before/after), *Korábban áttettük* (accepted/declined moves with outcome), *Ebből tanulok*
(patterns), actions *Kérek más javaslatot* · *Megbeszélem Boop-pal*. *Minden hatása* is a second `NKAreaSubPage`:
*Mi változik* (compare columns), *Mire hat* (per pillar), *Miért javaslom* (today's facts + the log's evidence),
*Ha jóváhagyod, itt látod*. Settled cards fold to one row with *vissza* (undo).
Empty state: "Ezen a héten nincs mit átrendezni." Offline: cached week, accept queued through the Outbox
(`OutboxKind.dayAdjustment`, `clientRef`).

### 5.7 The day-adjustment ledger ("everywhere, never the plan")

- New table `day_adjustment` (owner, date, kind, payload jsonb, bundle id, proposal id, state
  `active|undone|waiting|done|expired`, reason, `client_ref`). It never edits `gym_schedule_slot`, the mesocycle, the
  goal or the season.
- **Readers adopt it through ports** (each feature reads the ledger, the ledger feature imports none of them):
  the day's planned session (train), session time (existing `workout_time_override` folded in or read alongside —
  builder's call, §10), the fuel day plan (budget follows the session; meal split), bedtime reminder + sleep target
  for that night, `BoopDayAssembler` (brief, Ma), the season adherence (a moved session counts on its new day, not as
  missed), AI context (`ContextSnapshotAssembler`: "Ezen a héten áttettük: …").
- **Calendar to-dos:** state `waiting`; each calendar sync compares; when the event moved/disappeared as agreed →
  `done` and the day is recomputed; if the day passes → `expired` (logged as "not done").
- **Undo:** any `active` move can be undone until its day starts; undo restores and is logged.

### 5.8 Move log and learning

- Every proposal is stored (`capacity_proposal`: week, kind, facts snapshot, cross-effects snapshot, generator
  version) with its decision (`accepted | declined | ignored | undone`) and the **outcome** filled the evening after:
  session done/short/skipped, day verdict vs his close rating, sleep that night.
- **Patterns** (deterministic, `CapacityPatterns`): recurring weekday overload, meeting-hours threshold → skipped
  session rate, late call → sleep loss, back-to-back blocks → evening energy, which move kinds work for him. A pattern
  needs a minimum count (start: 3 occurrences, 2 of them consistent) before it is shown; each pattern carries its
  evidence count. The LLM may phrase a pattern, never create one.
- Patterns feed: *Ebből tanulok* on Átrendezés, *Amit a mozgatásokból tanultam* on Évad, the generator's ranking,
  "Miért javaslom" evidence, the Sunday preview, and new-season planning hints. B8's memory corpus later ingests the
  log through the day-scoped path (§5.1 of the standalone spec).

### 5.9 Ahead-of-time: the Sunday preview and the live loop

- **Sunday 18:00 (his zone)** a job builds next week's load picture from the calendar + season week and generates
  proposals; if any day is `túl sok` or there are proposals, the wall shows the Átrendezés card on Sunday evening /
  Monday morning. (Time is my call, config.)
- **Live loop:** triggers = check-in saved, meal logged, workout finished/skipped, Health sync, calendar change.
  The day is recomputed (cheap, no LLM unless new events need scoring); a proposal for *today* is generated only
  when the verdict worsens by a step or a constraint breaks (e.g. the session now collides). Rate: at most one new
  today-proposal per 3 hours.

### 5.10 Season level (Évad, spike screens 07–08)

- New Évad block *Teher és pihenés*: weekly load (training + calendar demand units) as bars against weekly recovery
  (sleep vs need, RHR trend) as a line, past weeks solid, the season's planned weeks faint; weeks where load > recovery
  marked; planned weeks beyond the synced calendar show training load only and say so. Model: 7-day vs 28-day exponentially weighted load (acute vs chronic, TrainingPeaks analogue) with a ramp
  check; the season's planned ramp from the block's weekly volume.
- **Season proposals:** e.g. "Hozzuk előre a könnyebb hetet a 10.-ről a 8.-ra?" — opens Évad's Módosítás preview
  (B6 writes), never writes the plan from here.
- *A jövő heted* row (week strip + "N javaslatom van rá · Átrendezés"), *Mennyit bírsz az évadban* stats, *Amit a
  mozgatásokból tanultam*. The overview read model gains a `capacity` section (B7 adds it after S2 merged).
- **New season:** the Új évad flow shows relevant patterns ("a csütörtök a gyenge pontod") next to the weekday
  picker — read-only hints.

### 5.11 Wall, notifications, AI

- One `WallSource` id `kapacitas`: Átrendezés card as `.improves` (rank 0.85, above Évad's 0.8, below a session
  within 2 h at 0.9) when open proposals exist; a today-proposal from the live loop that has a deadline (session in
  < 3 h) may be `.expires` and ring, under the two-a-day cap. `why` from the proposal's facts.
- AI context: the capacity block (verdict, top demand, adjustments this week, active patterns) through one renderer,
  like `SeasonContextRenderer`; a chat tool `get_capacity(week)`.

### 5.12 Slices

| Slice | Contents | Owner sees |
|---|---|---|
| **K1 Alap** | calendar fields sync, event scoring + table + rule fallback, load model + capacity factors, learning state, brief `capacity` block (server), move-log tables | nothing new yet (server) except the morning verdict text if K1 ships the brief field |
| **K2 Reggel és az Évad** | briefing-row verdict, demand-bent curve, day page blocks + event correction, Évad *Teher és pihenés* + stats, AI context renderer | the morning sentence, the day page, the Évad chart |
| **K3 Átrendezés** | proposal generator + cross-effects, `day_adjustment` ledger + readers, Átrendezés + Minden hatása pages, calendar to-dos, undo, wall source, live loop | the new page; accepted moves everywhere |
| **K4 Előrejelzés** | outcomes, patterns, Sunday job, *Ebből tanulok*, Évad patterns, season proposals, new-season hints | warnings ahead |

**One plan covers all four slices** (as B6 did), each slice with its own *Kész, ha…*; before K3 and K4 start the
builder re-reads the plan against what K1/K2 learned and only goes back to the owner if what he sees would change.
K1 includes the phone's calendar-sync change, so it needs an iOS build, install and live check too (the verdict is
shown from K2). Each slice ships alone (merge → deploy → install → live check). K2 waits for B6 S2's merge; K3 is the largest and
the riskiest (cross-cutting readers) and should take the optional pre-merge cloud check.

## 6. Constraints

- Contract-first (`api/feature/<x>/<x>.yml` → `api/openapi.yml`), Liquibase in `1.1.0/`, `ResetDatabase` for every
  new table, ArchUnit layers, `boop` stays a leaf (the new feature must not import `boop`; `boop` reads it via a port).
- Shared hot spots: `api/openapi.yml`, `merge.yml`, `ResetDatabase`, `1.1.0_master.yml`, `MaWall.swift`,
  `WallSources.swift` — one writer at a time; B6 S2 owns several now.
- iOS client: hand-written lenient client over `RawJSONClient` + `ServerCache` (the Évad/Pénz pattern) for the
  capacity endpoints; the brief keeps the generated client (its new block needs the generator filter regenerated).
- Free Apple team still: no background push beyond local notifications; the Sunday card relies on the wall + the
  existing local-notification planner.
- Privacy: owner accepted all calendar fields to the model (decision e). No personal health values in Notion or docs.

## 7. Risks

1. **Cross-cutting ledger (K3):** missing one reader makes the app disagree with itself. Mitigation: an explicit
   reader list with an IT per reader ("moved session appears on the new day, not on the old"), and the AI context
   reads the same ledger.
2. **No labels:** without check-ins/closes the model stays heuristic. Honest `tanulo` state; the close is one tap.
3. **LLM cost/latency** of scoring: per-event cache by hash; batch per sync; rule fallback.
4. **Over-proposing:** limits in §5.5/§5.9; declined kinds suppressed for the day; patterns raise the bar.
5. **Season coupling:** B6 S3/S4 (menu, experiments) will also read the day; the ledger must be read by the menu
   (a moved session moves its day's menu budget) — coordinate with whoever builds S3.

## 8. Prior art (researcher, filtered)

- **Visible (PacePoints, Morning Stability Score):** one daily budget unit, personal 90-day baselines, a short
  learning period, subjective "how did it feel" recalibration; a "pacing day" line across the day. → our unit with
  breakdown, `tanulo`, close-based calibration. https://help.makevisible.com/en/articles/9562114-pacepoints-and-pacesetter
- **WHOOP Strain Coach:** target as a range that updates during the day; user-picked intent. → verdict as a band +
  live loop. https://www.whoop.com/thelocker/strain-coach
- **Rise Science energy schedule:** circadian timing fixed; sleep debt changes height, not timing; says what it does
  not model. → §5.4 curve rule. https://help.risescience.com/hc/en-us/articles/40672503374871
- **Microsoft Human Factors Lab:** stress accumulates across back-to-back meetings; breaks reset it. → sequence cost.
  https://www.microsoft.com/en-us/worklab/work-trend-index/brain-research
- **TrainingPeaks CTL/ATL/TSB + ramp rate:** acute vs chronic load for the season view.
  https://www.trainingpeaks.com/learn/articles/why-ramp-rate-is-an-important-training-metric/
- **Avoid:** score anxiety (Oura orthosomnia), wrong baselines silently skewing everything (Visible's high-HRV bug),
  one opaque number.

## 9. Codebase terrain (investigator, filtered)

- **Calendar now keeps history:** upsert by `external_id`, soft-delete (`CalendarSnapshotService.java:16-50`), 60-day
  backfill then yesterday..tomorrow (`HealthSync.swift:33,299-319`), cap 31 days (`application.yml:652`); prod 636 rows
  / 72 dates. Attendees read but not sent (`CalendarKitReader.swift:31`, `CalendarReader.swift:15`). Research 05's "no
  history" and `boop-ios.md:916,962,966,1200` are stale.
- **Capacity inputs:** `BoopScores.java:52-58` (Forma, no HRV); `daily_metric.hrv_ms` (5/132 days); check-ins five
  scales (`CheckInQuestions.swift:55-60`) + snapshot (`WearableCheckInBiomarkerSource.java:29,67`); `day_close`
  rating/energy (`DayClosedEvent` has no listener); sleep debt in goal/biometrics ports.
- **Curve:** `EnergyCurveModel.java:20-35` (no calendar), caller `BoopBriefService.java:142`, cache hash includes the
  calendar (`:235-246`); iOS `EnergyCurveCard(events:)` `Ritmus.swift:77`, `DayMoments.swift:68`, day page
  `DaySheet.swift:127-170`, Energia heat strip `AreaRoom.swift:247-272,316`.
- **Wall:** `Wall.swift:19,45,181-184,198,208-235`; registry `MaWall.swift:40-52`; Évad source on S2 branch at rank 0.8.
- **Existing movers:** `SessionTimeService` (`workout_time_override`), `LightenTomorrowAdapter`
  (`workout_day_adjustment`), `PlannedSkipService`, `SportSlotSkipService`, `recovery_period`; `SleepAnchorShiftAdapter`
  changes the **permanent** sleep goal (not usable for a one-night move). **No mechanism moves a session to another
  date** — new in the ledger.
- **LLM:** `BoopVerdictWriter.java:64-114` pattern (`ObjectProvider<CompanionLlm>` + `LlmCallContext` + rule
  fallback), `LlmCallQuota`, `LlmBudgetGate`. No FoundationModels on iOS.
- **Traps:** ArchUnit (`ArchitectureTest.java:48-66,75,131`), `ResetDatabase` by hand, Testcontainers flag, CODEMAP
  regen after merges, midnight-fragile fixtures (the phone sends the day), `check-ios-contract.mjs` covers raw clients.

## 10. Left to the builder (calls I made, marked)

- *(my call)* Feature name and package: `feature/capacity` (tables `calendar_event_score`, `day_adjustment`,
  `capacity_proposal`, `capacity_pattern`, `capacity_day` cache).
- *(my call)* Whether `workout_time_override` / `workout_day_adjustment` are migrated into the ledger or read
  alongside it — pick the one with fewer reader changes; the ledger must be the single list the UI shows.
- *(my call)* Sunday preview at 18:00, live-loop rate 1 / 3 h, max 5 proposals, wall rank 0.85, verdict thresholds,
  sequence factor 1.3, notes cap — all config.
- *(my call)* Hue `.pulzus` for Átrendezés and the day-page blocks; Évad blocks keep the Évad hue.
- The demand-unit weights and the calibration fit's bounds — start simple, document in `docs/features/capacity.md`.
