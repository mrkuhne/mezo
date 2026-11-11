# Boop standalone — product architecture and build order (design)

- **Status:** **approved by the owner 2026-11-11** · **Date:** 2026-11-11 · **Issue:** `mezo-r36n9.9` · **Epic:** `mezo-r36n9`
- **Supersedes:** the slice map of `2026-11-09-boop-ios-v1-design.md` §8 (S4 lépések is cancelled as a slice;
  its parts move into B3/B4) and, in `2026-11-10-boop-napkelte-design.md`, only the five-domain bottom bar and the
  page skeleton. The Napkelte **look** (dark glass, painted sky, colour only in sky + orbs, the rising orb,
  serif/Outfit/mono type, no emoji) stays canon.
- **Evidence:** research reports `docs/superpowers/research/boop-standalone/01–12`, synthesis `13-synthesis.md`,
  owner decisions `14-decisions.md`.

## 1. Intent

Boop becomes a **standalone, purpose-built iPhone (+ Apple Watch) app** — one personal coach for sleep, food,
training, energy and reflection — not a port of the Mezo web app. Later a smart ring joins via HealthKit.
It reuses the Mezo backend's proven engines and hides the rest. It must never feel like 4–5 separate apps.

## 2. Owner decisions (2026-11-11) — do not re-litigate

1. **One home screen + a daily loop** is the spine (not five domain tabs).
2. **The original (web) account** is Boop's only account; the Boop account's data is migrated into it.
3. **Paid Apple Developer Program** — subscribe when B1 starts.
4. **After repair + data foundation, the daily loop comes first**, then the Plan, then day capacity.
5. **One voice: Boop.** Domain experts work behind "miért?" only.

## 3. The spine (information architecture)

**Bottom bar (icon-only, Napkelte glass): `Ma` · `Terv` · `Napló` · `Boop`, plus a global `+`.**

| Place | What it is |
|---|---|
| **Ma** | The day as one timeline under the rising orb. Three phases by clock: **Reggel** (verdict + the day's plan to accept or tweak — today's S3 brief grows into this), **Napközben** (the timeline: meals, training, calendar blocks, check-in prompts, and Boop's *proposal cards*), **Este** (close-out under 60 s). The orb + five mini orbs (lens) stay as the hero. |
| **Terv** | The active plans as context: weight goal, diet plan, training plan (mesocycle / run block), their rules and adherence. Read-only in B2–B5 (pointing to the goal + current mesocycle); becomes the Plan editor in B6. |
| **Napló** | History and meaning: past days (rating, goal, journal, check-ins with their biomarker snapshot), and Boop's **Minták** (short / mid / long-term conclusions, effect tracking). |
| **Boop** | Chat with full context and memory; also where the morning/evening voice lives. |
| **`+`** | One quick-capture sheet: meal (photo / text / barcode / recipe), check-in, journal line, weight, workout start. |

**Domains are drill-downs, not tabs:** Alvás, Étel, Edzés, Energia (and Forma) open from the orb lens, a
timeline item or a "miért?" — each with the **same skeleton**: verdict sentence → the level/graph → the days
behind it → actions.

**Proposal card** (the unit of live adjustment): one sentence ("Egyél ma +300 kalóriát — hosszabb lesz az
edzés"), one primary action (Elfogadom), a secondary (Most nem), and **"miért?"** which opens the reasoning:
the data behind it and short labelled expert lines (Alvás · Mozgás · Étkezés · Közérzet · Szkeptikus).
**Nothing is applied without the owner's tap.** Daily cap on proposals (start: 3) — spec of B7 tunes it.

**Outside the app, same loop:** Live Activity (workout, the day's next step), Smart Stack widgets (morning
verdict, check-in), Watch (workout logging, check-in tap), App Intents / Siri ("rögzítsd: ebéd…"), APNs push
for proposals. Each arrives in the slice that first needs it.

## 4. Reuse map — what Boop builds on (backend stays the brain)

| Keep as-is (call from Swift) | Needs a Boop-shaped API / move server-side | Hide from Boop (keep tables) |
|---|---|---|
| Auth, profile, weight log + EWMA trend, goals + feasibility preview, goal engine kcal/macro targets | Weight/goal read model (ETA, progress, status sentences now web-only) | Gamification, XP, titles, medals, quests, progression |
| Meal CRUD, `POST /api/meal/ai-draft` (photo/text), meal scoring, meal coach, recipes, pantry, product-URL + label import, OpenFoodFacts lookup | Day food budget / "next meal" planner, usual meals, glucose forecast (web-only today) | Supplements/medication placement, pantry price/stock, slot-template editor |
| `/api/train/*` (today, start, sets, feedback, finish, sport, run, skip, recovery, readiness, generate) | One "today's training" read; workout reconciliation with Health/Watch; per-set HR | `activity` life-skill log |
| Check-in model + plan (`/api/biometrics/checkin*`), journal, intention, sleep log + goal | One day-close model (rating vs goals) replacing the three evening stores; check-in biomarker snapshot | Habits, needs rings, napzárás 6-act web flow, life goals, tutorial |
| Companion chat (sync + SSE), 23 read tools, LLM router + budget + log | Chat/AI access to wearable, calendar, Plan; memory corpus with structured daily data | Team wall surfaces, Gépterem, 47-detector transparency UI, chapters |
| `wearable` ingest, `boop` brief | Wider metric schema, sources, samples, history, deletes | — |

## 5. Build order — slices

Each slice opens with a short brainstorm (recon + web where useful), a **simulator spike** when anything new is
seen, a plan with a *Kész, ha…* list → owner OK → build → gates → review → merge → deploy → install → report.

| Slice | Name | What it delivers | Depends on |
|---|---|---|---|
| **B0** | **Javítás** (repair, backend only) | Memory embeddings restored (provider/key or move to OpenAI @768d) + re-embed; alerts on embed errors and rows without vectors; retriever queries short, deadline fixed; nightly konzílium root-caused and fixed; fact merge fixed. Bugs `mezo-lb2yb`, `mezo-o8tcu`. | — (can run parallel to B1/B2) |
| **B1** | **Adatalap** (data foundation) | Paid team + bundle-id re-registration; **account switch + migration** of the Boop account's data into the original account (prod write, per-change owner OK); HealthKit read set widened to ~25 types (HRV, respiratory rate, wrist temperature, SpO2, VO2max, HR recovery, sleeping HR, body mass, body fat, lean mass, distance, basal energy, mindful minutes, state of mind…); anchored queries + HKObserverQuery background delivery; **source stored** + source-priority rules; intraday samples kept for snapshots; Health deletions synced; one night per date (dedup with priority); workout reconciliation (Watch/Huawei ↔ logged); calendar **history** kept; APNs registration. | B0 not required |
| **B2** | **Gerinc** (the new shell) | Simulator spike of Ma · Terv · Napló · Boop · `+` → owner OK; S3 Mai content re-homed into Ma's Reggel phase; the domain drill-down template; the proposal card + "miért?" component; the `+` sheet frame. | B1 account switch |
| **B3** | **Napi ritmus** (the daily loop) | Reggel: accept/tweak the day; check-in natively (short sets of the 14-item model) **with a biomarker snapshot** (HR, HRV, steps, sleep at that moment) linked to it; the goal of the day; free-text + voice journal; **Este: <60 s close** with rating vs the day's goals, unified day-close record; bedtime reminder; check-in from widget/notification. Basic Boop chat tab (existing chat API, now seeing wearable + calendar + check-ins). | B2 |
| **B4** | **Étel** (food, native) | Meal capture in `+`: photo / text / barcode (OpenFoodFacts) / recipe / ingredient on the existing AI draft; Étel drill-down; **allergen & intolerance model** on ingredients, recipes and the profile (coach policy reversed deliberately); server-side day budget + "next meal" tip; recipe URL import. | B3 |
| **B5** | **Edzés + Watch** | Native workout player (session model, rest timer, per-exercise debrief, notes); Live Activity; **watchOS app** with HKWorkoutSession (live HR, set logging from the wrist); per-set HR stored; running/sport sessions kept (plans optional). | B1, B3 |
| **B6** | **A Terv** (the Plan) | Plan entity: N weeks, weight goal, **allowed recipes/ingredients**, linked mesocycle / run block, rules; several plans, one active; Terv tab editor; plan rules in every AI context (chat, brief, meal eval, proposals); adherence; shopping list; **effect tracking** (a new item or recipe → biomarker window before/after). Moves plan setup out of the web app. | B4, B5 |
| **B7** | **Napi kapacitás** (day capacity + live adjust) | Calendar events scored by AI (mental load, social drain, physical) — titles sent only with owner OK; **units model** (day demand vs capacity from Forma + HRV + sleep debt), calibrated on B3 check-ins and day ratings; doable-day prediction in the morning; energy curve uses demand; **live re-plan loop** on events (check-in saved, meal logged, workout finished, Health sync, calendar change) → proposal cards (food ±, workout shorter/longer, different movement, time move) with push. | B3 data (weeks), B6 |
| **B8** | **Az egy AI** (one AI, deep) | Memory corpus gets structured daily data; a small **day-scoped council** feeding "miért?"; short/mid/long conclusions in Napló · Minták; konzílium slimmed to what Boop surfaces; chat sees everything incl. the Plan. | B0, B6, B7 |

**Parallel tracks:** B0 (backend) ∥ B1 (iOS + wearable backend) ∥ B2 spike. B4 and B5 can run in parallel after B3
(different files: food vs train/watch), honouring the shared hot-spot rules in the `boop` skill.

## 6. Non-goals

- No port of web-only clutter (see §4 "hide"). The web app keeps working until Boop covers plan setup (B6); it is
  not developed further for Boop's sake.
- No visible team, no expert pages, no gamification, no progress rings, no emoji.
- No automatic changes to plans, food or calendar without the owner's tap. Calendar stays read-only.
- Smart ring: only via HealthKit in this programme (no vendor API).

## 7. Risks and open points (resolved in the slice that meets them)

- **Account migration** is a production write — exact rows and a rollback plan go to the owner before B1 runs it.
- **Calendar privacy:** event titles to the LLM only after an explicit B7 OK; fallback is time/duration-only scoring.
- **Units calibration** needs weeks of B3 data; B7's prediction ships labelled as "tanuló" until calibrated.
- **Allergen policy reversal:** the coach currently refuses to name sensitivities — B4 changes it on purpose.
- **Goal engine depends on Train energy** — B5 must keep that input or switch to Health active energy.
- **LLM cost** of live re-planning — B7 budgets it against the existing per-user cap.
- **Huawei Health** writes no HRV/sleep — full value needs the Apple Watch (or the ring) as the biomarker source.
