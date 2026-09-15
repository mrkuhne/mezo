# Edzés (Train) Titanium — page-specific coverage record (2026-09-12)

Seeded from [TITANIUM_FEATURE_COVERAGE_REGISTER.md](TITANIUM_FEATURE_COVERAGE_REGISTER.md) row
`train` (which stood at `UNKNOWN`), expanded from the 2026-09-12 recon: a CODEMAP-first
investigator sweep of `train` + its 16 neighbour blocks, and a prior-art researcher sweep
(Hevy, Boostcamp, RP Hypertrophy, Strava, NN/g).

Follows the workflow in
[2026-09-10-titanium-production-rebuild-handoff.md](2026-09-10-titanium-production-rebuild-handoff.md)
and the Fuel precedent in [2026-09-11-fuel-coverage.md](2026-09-11-fuel-coverage.md).

## Owner decisions so far

**2026-09-12 — the four tabs.** New destination set: **Mai · Terv · Terhelés · Gyakorlatok**
(replacing the old `Mai · Terhelés · Napló · Tervek`). Options put to the owner were
(A) `… · Gyakorlatok` — the library of exercises, records and medals gets the fourth slot; and
(B) `… · Sport` — sport and running get their own world. **The owner chose A.**

Consequences, all owner-approved by that choice:

- Sport and running are **not** a tab. They appear where they matter: logging on **Mai**,
  scheduling on **Terv**, and shown next to gym volume on **Terhelés**. This matches the only
  well-documented mixed-modality pattern (Strava: unify at capture with a sport picker, keep one
  history, specialise the *screen* and not the *IA slot*) and preserves the existing product rule
  that volleyball is never converted into gym sets.
- Weekly muscle volume lives on **Terhelés**, as a forward-looking control rather than a
  retrospective chart — the field is genuinely split here (log-first apps bury it under a profile;
  autoregulating hypertrophy apps put it next to the plan), and our volume ramp actually drives
  next week's set counts, so it belongs with the decision it changes.
- History (week agenda, finished-workout review, mesocycle reports and comparison) merges into
  **Terhelés**, mirroring how Fuel's *Trendek* carries both the week and the per-day detail.
- No 3D companion on Train pages, matching the Fuel decision of 2026-09-11.

## Owner decisions, continued (2026-09-13 … 2026-09-15)

All binding for implementation:

- **Active workout** — Hevy-style card list; every per-exercise tool behind the card's ⋮ menu;
  a journal mark beside the name opens the records glass (last session as a live-row table,
  1RM / best set / max volume with progress bars, gold "MA MEGDÖNTVE", "Hosszabb táv" fold).
  No MÚLT column. Checkbox saves the set; verdict icons after save (record/up/down/hold — down
  is gold, never red). Rest countdown in a fixed-height dock. Finish CTA has three states
  (grey skip / gold partial / green complete), centred icon+label. The unticked-set warning
  fires at the finish moment only.
- **Close** — two-step star ceremony (fiery bar + per-fifth stars + three target-free counters;
  then muscle-group stars vs the weekly plan + earned kcal). Close returns straight to Mai;
  reopening a finished session shows a merged, animation-free recap.
- **Sport logging** — own full-screen flow, 11 sports with per-sport fields; kcal is hardcoded
  MET math personalised by sex/age/body-fat (never AI), shown as an overridable estimate; ends
  in the same ceremony; sport never converts to gym sets.
- **Terv** — the active mesocycle IS the landing. Library landing keeps only Most fut /
  Következik / Új terv + two doorway tiles; Sablonjaid and Lezárt futamaid are embedded list
  pages with detail pages (template week spelled out day by day; closed-run report with stars,
  honest delivery share, per-muscle journey bars and a then-vs-now comparison).
- **Plan wizard** — five steps (source / basics / days / per-day editor / muscle focus /
  review+start): full pages never drawers, arrows never drag, notes never blockers; the days
  set week one, the focus step sets the ceiling per muscle GROUP (chest heads climb together);
  the exercise picker has accent-blind search + region chips; stamping queues the run on the
  library shelf.
- **Terhelés** — hero percent + two-view body-map card + muscle groups (descending by work
  done) + sport card + combined-movement doorway. The day-by-day strip was removed (that story
  belongs to Terv). Group details and every clay ⓘ open the workout-style 3D glass, never a
  drawer. Subscreens: the body map (Eddig megvolt / A heti terv modes, legend in words, the
  untouched-muscles list, sport reach labelled as estimate) and Minden mozgásod (gym minutes
  estimated from sets, sport logged — never mixed).
- **Gyakorlatok** — the library joined with earned records (search + region filter, honest
  "még nincs naplózva"), and a per-exercise story page: records with next-target line, the
  e1RM curve (solid past, dashed plan expectation), medals, and working links to where the
  move appears.
- **Anatomy** — all muscle imagery is the MIT-licensed MuscleMap geometry (generator +
  NOTICE.md committed; openGym consulted for behaviour only, never copied). Icons are
  browser-measured zoom crops; the load map is a two-view heat body. The hand-generated
  i-m-* sprite family is retired.
- **Headers** — option A of the 2026-09-15 round: no page heading anywhere on Train; every
  page opens on its poster, subpages dock the back pill inside the hero.
- **Language** — every page answers one question in one plain Hungarian sentence; jargon ban
  (plafon/optimum/rámpa/tier/blokk → felső érték/szett/pihenőhét/terv); explanations behind
  clay ⓘ; percent always drawn, never text-only; missing data is an em dash, never a zero;
  estimates always say so ("Becslés, nem mérés").

## Prototype status — COMPLETE, awaiting owner approval (2026-09-15)

Built in `prototypes/companion-titanium`, served from this worktree. 133 node tests green
across seven pure state modules (session, sport, plan, wizard, load, exercises, body-map).

| Tab | State |
| --- | --- |
| Mai | Day-level poster + start CTA + quick chips (Egyedi edzés / Sport naplózása) + kcal contribution + muscle impact in words; active-workout overlay, records glass, two-step ceremony, sport flow. |
| Terv | Mesocycle landing (poster, full-name day cards with MA chip, doorways) · day page · week review · one-muscle page (gauge with merged labels, versus bars) · library (Most fut / Következik / Új terv + Sablonjaid / Lezárt futamaid pages + detail pages) · five-step plan wizard. |
| Terhelés | Week hero + real-anatomy body-map card and screen (two modes) + muscle groups with 3D-glass details + sport card + Minden mozgásod screen + 21-symbol gallery one level deep. |
| Gyakorlatok | Catalog joined with records (search/filter) + per-exercise story pages (records, e1RM curve, medals, where-used links). |

## Capability rows

Resolution of the eight recon areas against the prototype:

| Area | Verdict |
| --- | --- |
| Today's workout & live logging | **KEEP, rebuilt** — Mai + the active-workout overlay + ceremony (owner-iterated ~15 rounds). |
| Sport & running | **KEEP, merged into Mai/Terhelés** — own logging flow, MET-based kcal; never a tab, never converted to sets. |
| Load & muscle volume | **KEEP, rebuilt as Terhelés** — forward-looking week control + real-anatomy map; day-only muscles now count (a recon-found truth bug). |
| Prescription & progression engine | **KEEP behind the pages** — the wizard's ramp preview and the focus groups model MEV/MAV/MRV in plain words; engine itself is backend scope. |
| History, reviews & reports | **PARTIAL: closed-run reports live under Terv/library** (owner moved them from Terhelés); finished-session recap on Mai past days. Mesocycle comparison = the then-vs-now block. |
| Mesocycles, templates, plans, custom workouts | **KEEP, rebuilt** — template ≠ run ≠ instance preserved; one active run; planned runs with honest empty states; wizard replaces both legacy editor generations (2026-09-07 editor decisions honored). |
| Exercise catalogue, records & medals | **KEEP, rebuilt as Gyakorlatok** — includes the e1RM curve from the openGym-audit handoff (workstream C, prototyped). |
| Cross-feature surfaces | **KEEP** — kcal contribution to Fuel on Mai; sport feeds recovery not sets; XP in ceremony. |

## Still open — for implementation, never silently dropped

- Backend no-UI items: exercise image upload · in-cycle muscle-focus change (owner question,
  revisitable) · learned timing profile · sport-slot skips · collected-but-unshown data.
- openGym-audit handoff (2026-09-15) production workstreams: A1–A3 correctness fixes, B stall
  detection, C e1RM series endpoint, D1–D3 muscle map in the app (MIT geometry + NOTICE at
  repo root). The prototype models C and D's surfaces.
- Female body view for the muscle map (MuscleMap ships the geometry; prototype is male-only).
- RIR picker 0–5 (A3) must land in the rebuilt active workout.

## Capability rows

The full per-capability table (KEEP / MERGE / MOVE / DEFER / DROP with evidence and preservation
tests) is filled in tab by tab as the owner walks through each page. The recon inventory that
feeds it is in this session's investigator report; the eight capability areas are: today's
workout and live logging · sport and running · load and muscle volume · prescription and
progression engine · history, reviews and reports · mesocycles, templates, plans and custom
workouts · exercise catalogue, records and medals · cross-feature surfaces.

Backend capabilities with no UI today, to be decided individually and never silently dropped:
exercise image upload · in-cycle muscle-focus change · the learned timing profile · sport-slot
skips (today only creatable from the Nap advice card) · collected-but-unshown data (sleep quality
and water in the block report, jump count for volleyball).
