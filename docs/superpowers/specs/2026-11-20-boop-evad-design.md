# Boop B6 — Évad (the season: one plan that drives training, food, sleep and weight)

- **Status:** **approved by the owner 2026-11-20** (with the spike and the plan) · **Date:** 2026-11-20 · **Issue:** `mezo-r36n9.16` · **Epic:** `mezo-r36n9`
- **Session:** `quizzical-williams-c8b052` · **Spike:** `ios/Boop/EvadDemo/EvadDemo.swift` (`-previewEvad YES`, throwaway,
  branch `feat/b6-evad`), screenshots `docs/superpowers/specs/assets/evad/01–13`.
- **Builds on:** standalone spec `2026-11-11-boop-standalone-design.md` §5 / §5.1 (B6 row and its revision), decisions
  #33 (Terv is his plan), #40 (Edzés inner tab = Blokk), #43 (the block builder already shipped in B5), #34/#35 (the
  wall), #52 (web retired: goal setting has no surface today).

## 1. Intent — in the owner's words

> *„ezek mind összefüggnek egymással és szinkronban kell lenniük. az edzéshez jó kaja kell, a kajával jót lehet
> edzeni, súly együtt mozog a célokkal stb. holisztikusan nézem az egészet … alvással együtt.”*
> *„dinamikusan számolja és mutassa nekem hogy ez mivel jár, milyen következményei vannak, miket kell nekem
> változtatni … ne lehessen mezot indítani terv nélkül, a terv legyen a core kiindulója mindennek.”*

The Terv place becomes **Évad** (renamed, owner 2026-11-20): one plan of N weeks with a goal, that **owns** the
training block and the weekly gym + sport rhythm, and from those **derives** the food targets, the sleep need and the
weight course. Changing any part shows, live, what it does to every other part and what he would have to change —
and nothing takes effect until he accepts. It must be a "menő oldal": the connections visible, settings,
customisation, feedback.

**Why now:** the web app is retired (#52), so today there is no surface at all to set a weight goal or a plan; the
engines exist server-side but are invisible. B6 is also the first slice that gives the wall a real `.improves`
source (spec §5.1).

**Success, as he would judge it a month later:** his training, food and sleep move together — a 5th session shows up
in his menu and his bedtime without him doing the arithmetic; he sees *why* the scale moves the way it does; and he
never has to leave the phone to change his plan.

## 2. Owner decisions taken in this brainstorm

| # | Question | Answer |
|---|---|---|
| a | What is the page for? | The holistic system: training ↔ food ↔ sleep ↔ weight, in sync, with live consequences. |
| b | What is the core? | **The season is the starting point of everything.** A mesocycle cannot be started without one. |
| c | Name | **Évad** (over Irány, Program). |
| d | Which server engines? | **All ten** found by the feature scan (§6), plus build the missing pieces. |
| e | How concrete is the diet? | **A weekly menu** Boop proposes from the allowed recipes and each day's budget; he swaps and approves; the shopping list comes from it. |
| f | Effect tracking start | **Boop also proposes** (a wall card when something new appears); he starts it with a tap. |
| g | Spike round 2 | The menu is a **carousel of days** (too much scrolling); all copy rewritten in **natural Hungarian**. |

These go to `_dontesek.json` and `14-decisions.md` as #61–#64 (rows 59–60 were taken by a parallel session) (a+b+c as one row "Évad is the
core", d, e, f).

## 3. Goals, non-goals, anti-goals

**Goals**
1. One active season (several kept: past, planned) with: goal (trajectory, target, pace), N weeks, the linked
   mesocycle(s), the weekly gym days and sport slots, diet rules (allowed recipes, processed-food rule, sensitivities
   as already stored), sleep need, Boop settings.
2. **Live consequence preview** for any change, before → after, plus "what you have to do" and warnings; accept writes
   everything in one go.
3. The **system map** ("Mi mire hat") — the four pillars and what flows between them, with today's numbers.
4. **Adherence as facts** (no score, no streak, no red), with excused days left out.
5. **Feedback**: learned expenditure vs plan, guards, sleep ↔ intake pattern, upcoming deload / season end.
6. **Weekly menu** → **shopping list** (grouped, "for which recipe", staples on tap, shareable, past lists kept).
7. **Experiments** (effect tracking) — one at a time, proposed by Boop or started by him, honest results.
8. Season rules in **every AI context** (chat, morning brief, meal evaluation) from one renderer.
9. Wall: the season's things to say go through `WallSource` only.

**Non-goals (this slice)**
- Day-level live re-planning ("you slept badly, lighter session today") — **B7**; the season is the frame B7 adjusts within.
- Running blocks (decision #44: out). Watch (#42).
- Pantry stock / prices (§3.1 "not ported"). Grocery delivery integration.
- Per-season life goals (PERMAH) — out as a product (research 10).

**Anti-goals (failure even if it "works")**
- A number that is not computed from his data or the engine (the four §5.1 rules — **no invented number**; a pillar
  with no data says so).
- Anything applied without his tap; anything that nags (streaks, "you owe 300 kcal", red adherence).
- A second card surface, a second notification policy, a second "miért?" (§5.1).
- Two disagreeing kcal targets: the season's numbers **are** the goal engine's prescription, never a parallel calc.
- Two adherence numbers: the Étel room reads the season's adherence, it does not compute its own (§5.1 build-twice risk).
- Experiment "results" from too little data or with a single confident percentage (prior art: WHOOP distrust).

## 4. Approaches (data model) — considered, and the pick

| Approach | What | Trade-off |
|---|---|---|
| **A. New `season` aggregate that owns the goal 1:1** *(picked)* | New backend feature `season`: the season row references its `goal` row (created/edited through the existing goal engine), reuses `goal_plan_link` for mesocycles, and adds what is new (rules, menu weeks, shopping lists, experiments, revisions). | One more feature package and a few tables; every existing goal consumer (Fuel target, meal coach, guards, learned expenditure) keeps working untouched. |
| B. Grow the `goal` entity into the season | Add rules / menus / experiments columns to `goal`. | No new aggregate, but `goal` has ~30 consumers and is engine-centric; menus, lists and experiments are not goal concepts. Rejected. |
| C. iOS-only composition | The phone stitches goal + mesocycle + day plan together. | Cannot enforce "no mesocycle without a season", cannot put rules in AI contexts, no server what-if. Rejected. |

The pick is my call (the owner talks outcomes, not mechanics).

## 5. The design

### 5.1 Where it lives and how it looks (spike-approved)

- **The spine bar keeps four places; the second one is Évad** (was Terv). The bar is icon-only; the accessibility
  label becomes „Évad". Every user-visible „Terv" meaning *his plan* becomes „Évad"; the Edzés inner tab stays
  **Blokk** (#40).
- The page is an `NKAreaPage` **without** its own `NKAreaBar` (Évad is a spine place, not a ring-opened room — two
  bottom bars would stack). Inner tabs are `NKAreaTabs` at the top of the content: **Évad · Menü · Lista · Hatás**,
  with badges (menu waiting = dot, list = items left, Hatás = proposals). Settings sit in the head's corner action.
  Sub-pages use `NKAreaSubPage`. Hue: the spike used `.forma`; final hue is a builder call (§10).
- Head: orb filled to *week / N*, eyebrow „Őszi fogyás · 12 hétből a 7.", serif verdict („Jó úton vagy"), one hue
  sentence. The verdict is chosen from the overview's status (on course / slower than planned / no data yet), never
  free text.

**Évad tab** (screens 01–04): (1) **Mi mire hat** — the four orbs (Edzés, Étel, Alvás, Súly), dotted links with a
light running cause → effect (still under reduced motion), each orb's headline number; a tap lights one pillar and
lists its links ("Edzés → Étel · edzésnapon +290 kcal") with one serif sentence. (2) **Súly** — the trend curve with
the target line, the plan after "now" dashed; trend, target, weekly pace + feasibility word. (3) **Az évad terve** —
four rows (block + sport days; training/rest-day kcal + protein + rule; sleep need + bedtime; target + date).
(4) **Hogy megy** — last 7 days as facts (days inside the budget, sessions done, nights ≥ the need), with the
excused-days line. (5) **Amit Boop észrevett** — up to three lines from computed signals (§5.6). (6) **Következik** —
deload week (with its proposal), season end. (7) Actions: Módosítás · Új évad · Korábbi évadok.

**Menü tab** (screen 05): the highlight to approve next week's menu (Jóváhagyom / Átnézem), then a **carousel of
seven day cards** (`NKCarousel`, dots): day, kcal, kind (edzésnap / röplabda / pihenőnap), meals with slot + kcal;
tapping a meal offers swaps. Actions: Kérek másikat · Kiválasztott receptek.

**Lista tab** (screen 06): grouped by shelf, each item with quantity and „mihez kell"; check-off; **Szokásos
tételek** chips added only on his tap; Megosztás (plain text via the share sheet); Korábbi listák.

**Hatás tab** (screens 07, 10): Boop's proposal (Indulhat / Most nem), the one running experiment (progress, signals
watched, marked days vs the minimum, overlap warnings), past experiments with their honest outcome; a result page
with before | after columns, "what really changed / what stayed within normal variation / caveats", and
*Megtartom szokásnak* (becomes a season rule) / *Újra kipróbálom*.

**Módosítás** (screens 08–09): steppers / day chips / slider for sessions per week, sport days, weekly pace (later:
target, length, sleep anchor); **Ennyi változna** Most | Utána columns (training/rest-day kcal, carbs on training
days, sleep need, bedtime, target date, pace verdict; "nincs pihenőnap" when every day is active), a red guard line
when the engine warns, **Ehhez ezt kell tenned** (menu snack, earlier bedtime, block re-arranged in Edzés → Blokk,
season longer/shorter, sport-morning carbs), then Elfogadom / Mégsem.

**Szabályok** (screen 11), **Új évad** (screen 12, five steps prefilled from the current goal + block), **no
season yet** (screen 13). Copy in the spike is the reference tone; the builder keeps it natural Hungarian.

### 5.2 The season (backend `feature/season`)

`season`: `id`, owner, `title` (his name for it, e.g. „Őszi fogyás"), `status` planned | active | closed (one active
per owner, partial unique index), `start_date`, `weeks` (4–24), `goal_id` → `goal` (1:1; the goal's own window is
kept equal to the season's), `sleep_need_min` (derived, stored on accept), rule columns
(`processed_food_max_nova` default 2, `deload_maintain` bool, `use_learned_expenditure` bool, `propose_experiments`
bool, `menu_day` + `menu_time` for the weekly menu), timestamps. `season_allowed_recipe (season_id, recipe_id)`.
`season_revision` (who/when/what changed — the before/after snapshot of each accepted preview; feeds the season
summary). Mesocycles attach through the **existing `goal_plan_link`** (no second link table). The weekly rhythm
stays where it lives — `gym_schedule_slot` and `sport_schedule_slot` (train) — the season **writes** them on accept;
they remain the single source `WeeklyScheduledActivityService` reads. **This is the key modelling rule from the
scan:** a mesocycle alone has zero kcal effect; only the weekly slots move the kcal, so the season must own the slots.

Lifecycle: `POST /api/seasons` (planned, from a draft) → `POST …/{id}/activate` (activates its goal too; archives the
previous active season's goal) → `POST …/{id}/close` (summary computed). `GET /api/seasons` (list), `GET
/api/seasons/active/overview` (the one read model the Évad tab renders).

**No mesocycle without a season.** Train's mesocycle create/activate refuses with a typed `409 SEASON_REQUIRED`
when the owner has no active (or planned-and-starting) season; the iOS Blokk builder routes to Évad → Új évad. A
mesocycle started inside a season gets its `goal_plan_link` automatically, and its length defaults to fit the
season. Single workouts and sport sessions are not gated. **The running mesocycle (started 2026-11-16) is
grandfathered**: it keeps running; the first season adopts it.

**First season (migration, no prod write without his tap):** a draft season is assembled server-side on first open
from the live goal (today: one `maintain` goal 2026-10-06 → 2026-12-18), the active mesocycle, the gym/sport slots
and the current sleep goal. He sees screen 13 → 12 and nothing becomes active until „Indulhat az évad". Prod check
on 2026-11-20: three goal rows say `active` but two are soft-deleted — the draft reads only live rows.

### 5.3 The live consequence preview

`POST /api/seasons/{id}/preview` with a draft (sessions per week + which days, sport slots, pace / target / weeks,
sleep anchor) → returns `{before, after, changes[], todo[], warnings[], fingerprint}`, **persisting nothing**:

- kcal / macros: the goal engine's `GoalPrescriptionCalculator` (already persistence-free — the diet-settings preview
  pattern, goal-engine.md §2) run on the draft TDEE: BMR × NEAT + **draft** weekly EAT from
  `WeeklyScheduledActivityService`'s model over the draft slots; learned base when `basis = learned` and the season
  setting is on. Training-day vs rest-day split from the existing day-target projection.
- feasibility + target date: `GoalFeasibilityService` (bands 0.5–1.0 %BW/week).
- warnings: `GuardEvaluationService` (strength e1RM trend, per-muscle weekly sets vs band low, rate cap) on the draft.
- sleep need: the season's sleep rule (§5.5) on the draft load; bedtime from the sleep anchor.
- `todo[]`: deterministic rules from the diff (menu snack ± kcal, bedtime shift, block re-plan needed when the
  session count changes — the Blokk builder opens with the proposal, he approves there, season end shift, sport-day
  carbs).
- `PUT /api/seasons/{id}` with the draft + fingerprint applies it in one transaction (goal update + re-evaluate,
  slots replace, sleep goal write, revision row); a stale fingerprint → 409, the phone re-previews.

### 5.4 The overview read model

`GET /api/seasons/active/overview` composes, all server-side: head (week / N, status → verdict key), the system map
(per pillar: headline value; per link: the computed delta, e.g. training-day kcal over rest-day kcal, sleep need over
the base), weight course (EWMA trend series + the engine's projection + target), pillars, adherence (§5.6), insights
(§5.6), upcoming (deload weeks from the block's plan with the engine's maintenance-week suggestion, season end).
Cached on the phone in `ServerCache` like Pénz (offline shows the last copy with its age).

### 5.5 Sleep need from training load

Today the engine emits `sleepTargetH` and nothing reads it (goal-engine.md:378). B6 makes the season own the sleep
need: a documented rule over the weekly load (base from his sleep goal, plus a small increment per weekly gym and
sport session, capped), labelled in "miért?" as Boop's rule, written to `sleep_goal.target_minutes` on accept so the
bedtime reminder (B3) follows. The exact constants are a builder call with a research note (§10) — the spike's
7 h 30 + 6 min/session is a placeholder, not a decision.

### 5.6 Adherence, feedback

- **Adherence (the single source):** per day — food inside the day's budget band (the Étel room's band, computed
  once here), planned session done / excused, night ≥ the need. Excused days (kímélő, reasoned skips —
  `PlannedSkipPolicy`, fuel guidance mode) are left out. Served as counts over the last 7 days and per season week.
  The Étel room's "how am I doing" reads this; it stops computing its own.
- **Insights** (each shown only when its data gate passes, otherwise absent — never a placeholder):
  learned vs planned expenditure (`ExpenditureExplainer`, ≥ the engine's learning threshold); short night → next-day
  intake (paired nights/days, minimum pairs and an effect beyond day-to-day variation, same statistics as §5.9);
  guards (engine WARNs); the Monday adaptive correction as a proposal (accept = a revision).

### 5.7 Weekly menu

- Generated server-side for next week (Mon–Sun) at the season's `menu_day/menu_time` (default Sunday 18:00) or on
  „Kérek másikat": per day the budget from the prescription (training vs rest day by the slots), meal windows from
  `DayPlanService` (wake/bed/workouts; rhythm 3 + 2, decision #28), recipes only from `season_allowed_recipe`
  filtered by the sensitivity profile and the NOVA rule (`SuggestionPicker` gets the allowed-set filter at its one
  candidate choke point, `DayPlanService.java:238-254`), portion-scaled to the window budget, variety rules (no
  same dinner within 3 days), sport-day pre-session snack.
- States: proposed → approved. Swap one meal = alternatives fitting the same window. Approval makes those meals the
  day plan's suggestions in the Étel room (single source) and produces the shopping list.
- Fewer allowed recipes than the week needs → the menu repeats and says so; with 0 allowed recipes the Menü tab
  shows the seeding prompt (decision #23) instead of a menu.

### 5.8 Shopping list

From an approved menu week: aggregate `recipe_ingredient` by catalog item × portions, normalise units, group by
shelf, keep the „mihez kell" recipe list per item. Check-off state stored server-side per list (so it survives a
reinstall). **Staples** (`season_staple`: his list of always-at-home items) appear as chips and join the list only on
his tap (Plan to Eat pattern). Share = plain text through the iOS share sheet. Past lists readable. No stock, no
prices.

### 5.9 Experiments (effect tracking)

- `season_experiment`: subject kind (supplement | recipe | food | habit | free text), subject ref, title, start, length
  (default 14 days; 7–28), status proposed | running | done | dismissed, marked days, result snapshot.
- **One running at a time.** Baseline = the equally long window before the start (`MetricWindowEvaluator`'s shape,
  proactive.md:512-531), extended with wearable keys it lacks today: sleep duration, deep sleep, HRV, resting HR (from
  `daily_metric` / `sleep_log`), plus check-in energy / mood and the morning feel.
- **Gates:** ≥ 70 % of days marked (10 of 14) else „nem lehet megítélni"; per signal a clear change only when the
  difference exceeds his normal day-to-day variation (effect-size threshold as in `EffectLinkCalculator`, Cliff's
  delta); otherwise „nem hozott érezhető változást". No single percentage, always day counts.
- **Overlaps flagged** on the result: a new mesocycle or deload, kímélő / illness, season change, another change he
  logged. Copy says „pattern from your days, not proof".
- **Boop proposes** (setting on by default): a new supplement in the stack, a recipe or food eaten for the first time
  and again within a week, a free-text "started X" in the journal → a wall card „Indítsunk róla kísérletet?" (one tap
  starts it). Never more than one open proposal.
- *Megtartom szokásnak* turns the subject into a season rule line (it enters the AI context).

### 5.10 Season rules in every AI context

One renderer `SeasonContextRenderer` (backend) producing a short Hungarian block — goal and pace, this week's
training/rest days, kcal/protein targets, allowed-recipe rule, NOVA rule, sensitivities, sleep need, kept habits,
the running experiment — used by **(1)** `ContextSnapshotAssembler` (chat + its ~30 consumers), **(2)** the morning
brief (`BoopPrompts` / `BoopDayAssembler`, which do not use the snapshot), **(3)** `MealCoachContextReader`. A chat
tool `get_season` (scopes: overview, rules, menu, experiment) next to `get_goal`.

### 5.11 The wall (no second card surface, no second notification policy)

A `WallSource` with area key `evad`: next week's menu waiting for approval → `.expires` (may ring, within the
two-a-day cap #35, Sunday evening); a weekly correction proposal (learned expenditure / deload week) → `.improves`
with accept; an experiment proposal → `.improves`; an experiment result or the season end → `.happened`. Each card's
„miért?" is the wall's own (`WallCandidate.why`).

### 5.12 Details settled after the builder check (my calls — owner, check these)

1. **One accept moves the block and the slots together.** When a change alters the session count or the gym days,
   the Módosítás page includes the block's re-arranged week (from the Blokk builder's server evaluator) inside the
   same preview, and *Elfogadom* applies goal, slots, sleep need **and** the block change in one step. There is never
   a moment where the kcal says 5 sessions and the block still has 4. (`train` exposes a write port the season calls;
   the fingerprint covers the block state too.)
2. **The old proactive experiments stop proposing** when S4 ships (decision #52's "web-only areas out, data kept"):
   the AI proposal job is switched off, its table stays readable; the season's experiments are the only ones, so the
   one-at-a-time rule holds.
3. **The season owns the sleep need; he owns the wake time.** While a season is active, `sleep_goal.target_minutes`
   is the season's derived value (written on accept, shown in Szabályok with "az edzésből számolva"); the anchor
   (wake or bed time) stays his setting and moves the bedtime. Without an active season the sleep goal behaves as today.
4. **A mid-week change re-fits the rest of the approved week.** Accepting a change on Wednesday re-scales Thursday–
   Sunday's portions (recipes kept where they still fit, swapped where not); the preview's *Ehhez ezt kell tenned*
   says so, and the shopping list shows the difference as a short "változott" section instead of a new list. Past days
   are never touched.
5. **The block gate:** a block can be created when a season is active, or planned to start within 7 days; the gate
   covers every create path (builder, template, generator). The first season **adopts the running block only on his
   tap** (the "Indulhat az évad" of the first-season draft); the draft's length is set so the season covers the block's
   end, and `goal_plan_link` keeps clamping a later block to the season's end.
6. **Adherence moves to the server; Étel keeps its views.** The day judgement the Étel Hét tab does in Swift today
   (kímélő and unfinished days excluded, the band against the target) moves server-side into the season's adherence
   service and is served for every day **whether or not a season exists** (the budget then comes from the goal as
   today). The Hét tab reads it; nothing in Étel goes blank; parity is a *Kész, ha…* item.
7. **A maintain season is first-class.** For `maintain` the Súly block shows a band (±1 kg around the start weight,
   engine's maintenance logic) instead of a target line, the head says „Tartod a súlyod" / „Kicsit kijjebb mentél a
   sávból", and feasibility / target date are not shown. His live goal today is a maintain goal, so the first-season
   draft opens on it and the wizard's first step lets him switch to fogyás or izomépítés.
8. **The plan covers all four build slices** in one document, each with its own *Kész, ha…*, built and shipped in
   order S1 → S4 after one plan OK.

## 6. Server engines wired in (the scan's ten — owner: "mind a 10")

| # | Engine (anchor) | Used for |
|---|---|---|
| 1 | Diet-settings no-persist preview (goal-engine.md:90, fuel.md:135) | Pattern of §5.3's draft preview |
| 2 | Goal engine evaluate → prescription (goal-engine.md:43-75) | The kcal/macros of every pillar |
| 3 | EAT from the weekly schedule (goal-engine.md:66-68; train.md:1039-1052) | Sessions / sport days → kcal (the key rule) |
| 4 | Feasibility preview (goal-engine.md:71, :237) | Pace verdict + target date |
| 5 | Soft guards (goal-engine.md:69; train.md:701) | Red warnings in the preview, „Erre figyelek" |
| 6 | Learned expenditure + adaptive weekly (goal-engine.md:107-200) | „Kevesebbet égetsz…", Monday proposal |
| 7 | Phase suggestions + deload overrides (goal-engine.md:300, :144) | „Következik: könnyebb edzéshét" |
| 8 | Sleep target + sleep debt (goal-engine.md:59, :286, :378) | Sleep need, bedtime, insight |
| 9 | Readiness / kímélő / skips (train.md:706-716, :239-306) | Excused days out of adherence |
| 10 | Experiment + `MetricWindowEvaluator` (proactive.md:488-531) | The experiments' window maths |

Plus: sensitivity + NOVA rule (pantry.md:180) as the diet rules, `DayPlanService` for the menu windows, day close /
check-ins as experiment outcomes.

**Built new:** the season aggregate + revisions; the full draft preview; the mesocycle gate; sleep need from load;
the weekly menu; the shopping list; experiments for food/supplement/habit subjects with wearable signals; the season
context renderer + tool; the wall source; the Évad iOS page.

## 7. Constraints

- Contract first (`api/feature/season/season.yml`), Liquibase in `1.1.0/`, ArchUnit layer subpackages, consumer-owned
  ports between features (ADR 0012) — `season` reads goal/train/meal/wearable through ports, `train` asks a
  `SeasonGatePort` for the 409.
- Shared hot spots (boop skill §3): `api/openapi.yml`, `merge.yml`, `ResetDatabase`, the Liquibase master, the iOS
  project file — one writer at a time; check the in-progress issues' **Owns:** before touching them.
- iOS: hand-written lenient client over `RawJSONClient` (the Pénz / PlanClient pattern) or the generator — builder's
  call; `ServerCache` for offline.
- Napkelte + Képek rules, no emoji, never „Mezo" in a visible string, no SF Symbols except chevrons/arrows (the
  spike's +/− steppers must become kit glyphs), reduced motion still branch for the system map.
- Privacy: no personal health values in Notion or docs; examples marked „például".

## 8. Prior art (researcher, filtered)

- **Adopted — MacroFactor's adherence-neutral plan** (https://macrofactor.com/dashboard-revamp/,
  https://macrofactor.com/mm-october-2023/): plan changes only in a step he starts (preview → accept), adherence as
  plain facts, the coach plans from what happened, never makeup targets.
- **Adopted — Oura Experiments** (https://ouraring.com/blog/oura-experiments/): user-started, one change, length by
  kind, a minimum of logged days, warn about overlapping changes. *Gap:* Oura does not publish how it words an
  inconclusive result — ours is designed here („nem hozott érezhető változást", „nem lehet megítélni").
- **Adopted in part — WHOOP Journal impacts**
  (https://www.whoop.com/us/en/thelocker/a-new-way-to-see-insights-on-which-behaviors-affect-your-recovery/): the
  visible unlock threshold and „pattern, not proof". **Rejected:** a single opaque percentage
  (https://community.whoop.com/t/issues-with-insights-impacts-accuracy/929) — breaks "no invented number".
- **Adopted — Mealime** (https://support.mealime.com/article/151-getting-started-guide): list from the plan, merged and
  grouped, "for recipe X" on each item; avoiding its gaps (past lists kept, shareable).
- **Adopted — Plan to Eat staples** (https://learn.plantoeat.com/doc/how-to-use-the-shopping-list): staples separate,
  added only on tap. **Rejected:** pantry inventory tracking (upkeep).

## 9. Codebase terrain (investigator + scan, filtered)

- **Today's Terv:** `ios/Boop/Terv/TervView.swift:14-34` on `PlacePage` (weight, today's session, the Pénz card);
  shell route `ios/Boop/Shell/ShellView.swift:227`. The read-only Pénz card leaves Évad — Pénz is a ring area
  with its own page (builder: update the L5 handbook page that mentions it).
- **Kit:** `BoopDesign/Napkelte/Area.swift` (`NKAreaPage` :204, `NKAreaTabs` :154, `NKAreaSubPage` :437),
  `AreaBlocks.swift`, `Carousel.swift` (`NKCarousel`). Trap: `NKAreaPage` + `NKAreaBar` inside the spine would stack
  two bars — use tabs-in-content.
- **Goal engine** complete server-side (`feature/goal`, `api/feature/goal/goal.yml`); **no goal ops in the iOS
  generator filter**. `goal_plan_link` already models goal ↔ mesocycle (reuse). Fuel's served target comes from
  `DayTargetProjector` — the season must not compute a parallel target.
- **Menu choke point:** `DayPlanService.java:238-254` candidates → `SuggestionPicker.java:43-62` (category, kcal ±20 %,
  sensitivity); hard-coded staples at `:34-35`.
- **Shopping list:** nothing exists anywhere (fuel.md:248, :347).
- **AI contexts:** `ContextSnapshotAssembler` (goal block :245-280, ~30 consumers), `BoopPrompts`/`BoopDayAssembler`
  (separate), `MealCoachContextReader:100-123` (separate); tools in `companion/tools/`.
- **Effect maths:** `proactive/service/MetricWindowEvaluator.java:47`, `ExperimentOutcomeService`;
  `EffectLinkCalculator` (Cliff's delta, ≥5 with / ≥10 without); `MetricKey` lacks wearable keys; `daily_metric` has
  `resting_hr`, `hrv_ms`.
- **Wall:** `BoopCore/Morning/Wall.swift:208-231` (`WallSource`, `WallRegistry`), registration
  `ios/Boop/Nap/MaWall.swift:40-53`, hue map :188-195 (an unknown area falls back to `.forma`).
- **Traps:** ArchUnit + frozen feature-cycle baseline (`DayPlanService` sits in `meal` to avoid a cycle); regenerate
  `docs/CODEMAP.md` after merges; Liquibase jsonb `?` → `jsonb_exists()`; full suite with
  `-Dmezo.test.use-testcontainers=true`; the wall's 3 cards / two-a-day ring cap; the ring is full at eight (Évad is
  not an orb). Stale docs: `fuel.md:458`, `goal-engine.md:294-304` (retired FE consumers).

## 10. Left to the builder (calls I made, marked)

- **Slicing** (my call): S1 season + preview + overview + the Évad page (Évad tab, Módosítás, Szabályok, Új évad,
  empty) + the mesocycle gate + first-season draft; S2 adherence single source + insights + AI context + wall source;
  S3 weekly menu + shopping list (Menü, Lista); S4 experiments (Hatás). Each ships on its own; the tabs of a later
  slice show `NKNotLiveYet` until then.
- The sleep-need constants (§5.5), with a short research note; the variety rules of the menu; unit normalisation of
  the list; the exact effect-size threshold (start from `EffectLinkCalculator`'s).
- The final hue of Évad (spike: `.forma`), the head photo per Képek, the spine icon.
- Whether the iOS client is generated or hand-written.
- Where the Pénz card goes (it leaves Évad).
