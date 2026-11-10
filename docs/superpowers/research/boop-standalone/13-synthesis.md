# Boop standalone — synthesis of the current-state research

Issue `mezo-r36n9.9`, 2026-11-10. Inputs: reports `01`–`12` in this folder (all read from code + read-only
prod shape). This page is the bridge from "what exists" to the owner decisions and the new spec.

## TL;DR

- **The backend brains are worth keeping.** Goal engine (weight trend, kcal/macro targets, learned
  expenditure), deterministic gym progression (per-exercise targets, MEV→MRV volume, deloads, overlays),
  deterministic meal scoring + AI meal draft (photo/text, 57% of meals), check-in model, journal, sleep log.
- **The connective tissue is missing.** There is no *plan* object (diet + training + weight goal as one
  thing), no calendar scoring / energy units, no live day re-plan, no check-in↔biomarker link, no allergen model,
  no food→biomarker effect tracking. These are exactly the owner's new ideas (items 3, 5, 7, 11, 12).
- **The AI layer is rich on paper and broken in practice.** Memory embeddings have failed since 2026-10-21
  (no alert), full-text retrieval times out, chat skips RAG and stuffs facts; the nightly konzílium failed
  48/55 days; wearable + calendar data are invisible to every AI except the Boop brief.
- **Much of the web app is clutter by usage:** quests (194/238 expired), titles (0), life goals (1), medication (0),
  habits (793 auto-missed vs 205 done), needs rings, activity (1), running (built, 0 uses), tutorial.
- **The daily reflection loop is dormant** since mid-October (check-ins end 10-11, journal 09-29, ritual 09-17)
  — the web app lost the owner's habit. Boop must make logging cheaper, not add surfaces.
- **Much logic lives only in the web frontend** (sleep analytics, needs engine, day planner, usual meals,
  glucose forecast, workout session model, rest timer, goal ETA/status copy, napzárás recap). A native app
  needs it moved server-side or rewritten in Swift — the cost driver of the rebuild.
- **Two accounts split the history**: the web account holds 2.5 months of meals, workouts, check-ins, memory;
  the Boop account holds Health nights + wearable days. A decision is needed.
- **Platform limits bite:** free Apple ID = no background HealthKit delivery (confirm), no APNs push, weekly
  reinstall, no shipping watch app comfortably. Items 1, 11, 12 and the Watch want the paid programme.
- **UX research (12) converges on one spine:** a time-based daily loop (morning plan → live adjust with
  "why?" cards that never apply without asking → evening close <60 s), one home "Ma", plans as context,
  domains as identical drill-downs, AI as cards + "ask about this" + chat fallback, one voice with the domain
  agents visible only inside "why", the same loop on Live Activity / widgets / Watch / Siri.

## Per core item — verdict

| # | Owner core item | Verdict | Why (one line) | Source |
|---|---|---|---|---|
| 1 | All Health metrics (+Huawei/Watch, Sleep Cycle) | **Exists, needs fixing** | Reads 6 of ~25 relevant HealthKit types; no HRV/resp/temp/SpO2/VO2/weight; foreground-only sync; source not stored; Huawei HR patchy | 09, 01 |
| 2 | Meal logging + AI evaluation | **Exists & good** | Photo/text/recipe/ingredient, pantry-matched AI draft, deterministic 8-dimension score, async AI coach | 02 |
| 2 | Allergen / intolerance flags | **Missing** | No field anywhere; coach prompt even forbids naming sensitivities (policy to reverse) | 02 |
| 2 | Web import | **Exists (ingredients only)** | Product-URL scrape + label photo; no recipe URL import; OpenFoodFacts backend unused (barcode-ready) | 02 |
| 3 | Weight goal + meal eval against it | **Exists & good** | EWMA trend, feasibility preview, goal → daily kcal/macro → meal score | 10, 02 |
| 3 | Pre-calibrated diet plans / several plans | **Missing** | No plan entity, no recipe/ingredient whitelist, no shopping list | 02, 10 |
| 3 | Active plan rules in AI chat | **Missing** | Only today's goal segment in context | 06 |
| 3 | Long-term food/new-item → biomarker effects | **Missing** | `effect_link` = people/events → mood only, 0 live rows | 07, 02 |
| 4 | Gym mesocycles, guided in-workout logging | **Exists & good (backend), UI to rebuild** | Deterministic progression engine + set-by-set API; session model/rest timer are web-only; debrief doesn't feed load | 03 |
| 4 | Running / sports plans | **Exists, unused** | Running blocks built, 0 uses; sport sessions 19 | 03 |
| 4 | Watch-based workout logging | **Missing** | No watch target; Watch/Huawei workouts not linked to logged ones (double count risk) | 03, 09 |
| 5 | Sport ↔ meal plan ↔ weight goal coordination | **Partial** | Only kcal credit + pre/post meal windows; nothing adapts training to the goal | 03, 10 |
| 6 | Sleep tracking + day recommendations | **Exists, needs fixing** | Health nights land with stages; no Sleep Cycle quality; analytics web-only; duplicate nights; no chronotype | 01 |
| 7 | Calendar AI scoring → units → doable-day prediction | **Missing (~15%)** | EventKit plumbing + Forma exist; no scoring, no units, no history, curve ignores calendar | 05 |
| 8 | One AI seeing everything, short/mid/long conclusions | **Exists, needs fixing** | Good chat platform + 23 tools; memory outage; wearable/calendar invisible; horizons scattered | 06, 07 |
| 9 | Domain agents cross-checking (konzílium) | **Exists, failing, over-built** | 7 personas + Szkeptikus pipeline, 21k lines; nightly failing; quota hits; not wired to day decisions | 08 |
| 10 | Journal, goal of the day, day close + rating vs plan | **Exists, fragmented & dormant** | Three stores for the evening rating; napzárás logic web-only; nothing links rating to planned goals | 04 |
| 11 | Check-ins + biomarker snapshot | **Check-in good; snapshot missing** | 14-item model solid; no HR/HRV at check-in time; wearable data per-day only | 04, 09 |
| 12 | Live day re-examination + adjustment | **Missing (seeds only)** | Session-time move, readiness lighten, advice cards with "apply" — no live re-plan loop | 05, 08, 03 |

## Drop / hide candidates (keep tables, hide from Boop's API)

Gamification (XP, titles, medals, quests, progression), named character personas on the surface, habits and
needs rings, `activity` life-skill log, medication + supplement placement, life goals, tutorial, Gépterem /
47-detector transparency UI, chapters / maturity ring, pantry price/stock, slot-template editor, learned-expenditure
page (keep the engine). Backend entanglement means *hide, don't delete* (report 10 §5).

## Production bugs found on the way (independent of the re-plan)

1. Memory embeddings fail on every call since 2026-10-21 (Gemini `ClientException`, likely key/billing);
   no alert fires; admin page shows 202/202 ready (07).
2. Memory full-text retriever times out (200 ms) and gets 500–2000-char queries → 0 hits (07).
3. Nightly character/konzílium pass FAILED 48/55 days since 2026-09-23; council quota exhaustion (08).
4. `companion_fact_merge` fails 24/24 (06); `proactive_advice` LLM silent since 09-23 (06).

## Candidate key decisions for the owner (one at a time, in order)

1. **The spine:** one home "Ma" + daily loop with domains as drill-downs, vs. keep the five-domain bottom bar.
2. **One account, one history:** merge the web account's history into the Boop account (or vice versa).
3. **Paid Apple developer programme** (background Health, push, Watch app, no weekly reinstall).
4. **The Plan as the central new object** (diet + training + weight goal for N weeks, AI works inside it) — and
   the order: plan first, or day-capacity (calendar units) first.
5. **How visible the domain agents are:** one Boop voice with agents inside "why", vs. a visible team.
6. **Repair the AI memory before building on it** (bugs above) — as a separate fix session now.

## Build-order sketch (to refine into the spec after the decisions)

0. Repair: memory embeddings + alerting, konzílium nightly, retrieval queries (backend only).
1. Data foundation: wide HealthKit read set + sources + background delivery; weight from Health; workout
   reconciliation; account merge; calendar history.
2. The daily loop on today's brief: Ma home, check-in with biomarker snapshot, intention, evening close.
3. Food: native logging (photo/text/barcode/recipe), allergens, day budget server-side.
4. Training: native player (rest timer, debrief), Watch logging, Live Activity.
5. The Plan: diet + training + goal object, AI context, adherence.
6. Day capacity: calendar scoring → units → doable-day prediction → proposal cards (live adjust).
7. The one AI: chat with all data + memory, a small day-scoped council, horizons, effect tracking.
