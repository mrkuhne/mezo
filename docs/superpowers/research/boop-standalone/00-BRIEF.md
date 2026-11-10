# Boop standalone re-plan — research brief (shared by every mapper)

Issue: `mezo-r36n9.9` (epic `mezo-r36n9`). Date: 2026-11-10. **Research only — no product code.**

> Location note: these are internal code audits, not source-ingested wiki pages, so they live under
> `docs/superpowers/research/` (outside `docs/research/`, whose linter enforces the wiki schema).

## Why

Boop is the native SwiftUI iPhone app in `ios/` (shipped S1 alap, S2 adatok = Apple Health + EventKit
calendar → backend `wearable`, S2.5 Napkelte look, S3 reggel = backend `boop` morning brief).
The owner paused S4 and wants Boop re-planned as a **standalone, clean, purpose-built iOS app**
(Apple Watch fully now, a smart ring later) — not a port of the cluttered Mezo web app. Before we
decide, we need an exhaustive, honest map of what the current Mezo (backend + web frontend + ios/)
already does, per area.

## The owner's core (numbered; refer to items by number in your report)

1. Collect every metric from Apple Health (+ Huawei Health / Apple Watch, watch-dependent) and sleep from Sleep Cycle.
2. Meal logging + AI evaluation. Recipes and ingredients carry allergen/intolerance flags (lactose, gluten…).
3. Weight goal, meal evaluation against it. Pre-calibrated diet plans ("only these X recipes and Y ingredients
   for 4 weeks" → full plan with weight goal + training); several plans; training/running plans + AI support
   ("personal trainer + dietitian"). The active plan's rules are in the AI chat's context. Measure long-term
   effects of recipes/ingredients and of a new item on biomarkers.
4. Sport plans set in advance: running, sports, gym with mesocycles, exercises, full in-workout guided
   logging and journaling.
5. All sport plans context-coordinated with the meal plan and weight goal.
6. Full sleep tracking from Sleep Cycle data, with calculations and day recommendations (like today's Nap page).
7. Calendar events get AI scoring (mental energy, social-battery drain, activity score…) → day "units" needed
   vs. biomarker capacity → doable-day prediction + what/when/how to change suggestions.
8. One AI that sees ALL data, draws short/mid/long-term conclusions, chat with full context about him.
9. Several domain agents examining specific domains and cross-checking each other (today's "konzílium").
10. Free-text journaling, a goal for the day; end-of-day close-out and rating vs. planned goals.
11. Daily check-ins on how he feels — snapshot watch biomarkers at check-in time and link them.
12. The AI re-examines each day live with everything and dynamically adjusts (extra food, shorter/longer
    workout, different movement, less food…).
Manual input that stays: food (AI photo, free text, recipes/ingredients, web ingredient import), workout
logging, check-ins.

## How to research (every mapper)

- Enter via `docs/CODEMAP.md` and the relevant `docs/features/*.md`, then **read the code** (backend
  `backend/src/main/java/io/mrkuhne/mezo/feature/<x>/`, Liquibase under `backend/src/main/resources/db/`,
  frontend `frontend/src/features/<x>/`, `api/openapi.yml` / `api/` specs, and `ios/` where relevant).
  Docs can be stale — the code wins; note doc/code drift.
- You may run read-only production DB queries for **shape and volume only** (row counts, which
  columns are actually filled, date ranges) — never copy personal values into the report:
  `export KUBECONFIG=~/.kube/mezo-k3s.yaml; kubectl exec -n mezo postgres-0 -- psql -U mezo -d mezo -c "SELECT ..."`.
  No writes. Skip it if it fails.
- Do not edit any file except your own report. Do not commit.

## Report format (write to your assigned file, Markdown, English, as long as it needs to be)

1. **Scope** — what you covered, entry points.
2. **What exists** — every capability, entity/table, endpoint, screen, job, AI prompt in your area, with
   `path:line` anchors. Be exhaustive: list features the owner may have forgotten exist.
3. **How it works** — the main flows end to end (data in → processing/AI → what the user sees).
4. **Quality assessment** — what is solid, what is half-built, dead, duplicated, or buggy; test coverage;
   real production usage (from DB shape) if you checked.
5. **Reuse for native iOS** — which backend endpoints/services Boop can call as-is, which need a
   Boop-shaped API, which logic lives only in the web frontend (and would have to move to backend or Swift).
6. **Gaps vs. the owner's core** — per relevant core item number: exists & good / exists, needs fixing /
   missing / candidate to drop — with one-line reasons.
7. **Open questions / risks** for the re-plan.

End with a 10-line **TL;DR** at the very top of the file (under the title).
