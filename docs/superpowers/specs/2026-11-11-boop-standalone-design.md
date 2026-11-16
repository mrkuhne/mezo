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

**Domains are rooms, not bottom tabs:** Alvás, Étel, Edzés, Energia (and Forma) open full-screen from the orb
lens, a timeline item, the `+` sheet or a "miért?". Every room opens on the **same skeleton** — verdict sentence →
the level/graph → the days behind it → actions — and a room with depth carries its own **inner top tabs** in one
shared pattern. **Étel and Edzés are complete apps inside the spine** (owner, 2026-11-11: "a full food app and a
full training app"), not stripped-down pages — see §3.1.

### 3.1 The two full rooms — feature lists (owner-approved 2026-11-11)

Evidence: research `02-fuel-food.md`, `03-training-sport.md`. "Native" = rebuilt in SwiftUI on the existing
backend endpoints; FE-only logic named in §4 moves server-side or to Swift.

**Étel room — inner tabs `Ma · Receptek · Kamra · Hét`** (built in B4; plan parts in B6)

| | Features |
|---|---|
| **Keep, native** | Capture by photo / free text / recipe / ingredient / usuals (AI draft matched to pantry + recipes, confirm before save); water; meal skip with reason + kímélő fuel mode; per-meal score (8 dimensions vs the goal-derived day target) + AI coach prose + glucose tip; day and week views vs targets; recipes + AI recipe workshop; pantry + import from product URL and label photo; diet settings (macro split, protein tier, water, fibre); **supplement stack, simplified** (list + taking them; owner uses it: 53 items) — the placement engine stays server-side, its editor UI is not ported. |
| **New** | Barcode scan (OpenFoodFacts backend exists, no caller yet); allergen & intolerance model on ingredients, recipes and the profile; recipe import from a URL; server-side "next meal" tip from the remaining budget. |
| **In B6 (the Plan)** | Diet plan ("only these recipes/ingredients for N weeks"), shopping list. |
| **Not ported** | Medication cycle, pantry prices/stock, meal-slot template editor, the "Hogy tanultam?" page (the learned-expenditure engine stays). |

**Edzés room — inner tabs `Ma · Terv · Gyakorlatok · Előzmények`** (built in B5)

| | Features |
|---|---|
| **Keep, native** | Mesocycle plan + generator (wizard), templates, custom workouts, weekly schedule; exercise catalog with video/images, records; Eligazítás (briefing); set-by-set logging with prescribed weight/reps/RIR and the engine's rationale; swap/add exercise mid-workout (this session / whole meso); rest timer; per-exercise debrief (pump, joint pain, workload); closing note; mesocycle close report + AI evaluation; compare two runs; muscle-load map; readiness lighten; skip with reason, kímélő period, comeback ramp; sport sessions, schedule and one-off events; running blocks. |
| **New** | Watch workout with live HR and wrist set logging; per-set HR; Live Activity (lock screen / island); reconciliation of Watch/Huawei workouts with logged ones; running gets distance + pace from the Watch (today it is time-segmented only, never used). |
| **Not ported** | XP / level-up ceremony, medals, the `activity` life-skill log. |

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
| Meal CRUD, `POST /api/meal/ai-draft` (photo/text), meal scoring, meal coach, recipes, pantry, product-URL + label import, OpenFoodFacts lookup | Day food budget / "next meal" planner, usual meals, glucose forecast (web-only today) | Medication cycle, supplement placement editor (stack itself is kept, §3.1), pantry price/stock, slot-template editor |
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
| **B4** | **Étel** (food, native) | The full **Étel room** of §3.1 (inner tabs Ma · Receptek · Kamra · Hét, every "keep" feature native): meal capture in `+` and the room by photo / text / barcode (OpenFoodFacts) / recipe / ingredient / usuals on the existing AI draft; simplified supplement stack; **allergen & intolerance model** on ingredients, recipes and the profile (coach policy reversed deliberately); server-side day budget + "next meal" tip; recipe URL import. | B3 |
| **B5** | **Edzés + Watch** | The full **Edzés room** of §3.1 (inner tabs Ma · Terv · Gyakorlatok · Előzmények, every "keep" feature native, incl. meso planning, catalog, reports); native workout player (session model, rest timer, per-exercise debrief, notes); Live Activity; **watchOS app** with HKWorkoutSession (live HR, set logging from the wrist); per-set HR stored; sport + running kept, running with Watch distance/pace. | B1, B3 |
> **Revised 2026-11-16 against the shipped shell** (the ring `mezo-r36n9.47`, the area-page kit `mezo-r36n9.37`,
> the living wall `mezo-r36n9.45`). The slice *contents* the owner approved are unchanged; what follows says what
> each slice no longer has to build, what the shell now expects of it, and where it would otherwise be built
> twice. **Order unchanged: B6 → B7 → B8 → L1…L6.**
>
> **Three things every remaining slice inherits.** (1) A page is built from `NKAreaPage` + the blocks, and a page
> *inside* an area from `NKAreaSubPage` — no slice invents a frame again. (2) Anything worth saying to him goes on
> the wall by registering a **`WallSource`**; no slice builds a second card surface. (3) Anything worth *ringing*
> him for is a `.expires` candidate and obeys the two-a-day cap (#35); no slice adds its own notification policy.

| **B6** | **A Terv** (the Plan) | Plan entity: N weeks, weight goal, **allowed recipes/ingredients**, linked mesocycle / run block, rules; several plans, one active; Terv tab editor; plan rules in every AI context (chat, brief, meal eval, proposals); adherence; shopping list; **effect tracking** (a new item or recipe → biomarker window before/after). Moves plan setup out of the web app. | B4, B5 |
| **B7** | **Napi kapacitás** (day capacity + live adjust) | Calendar events scored by AI (mental load, social drain, physical) — titles sent only with owner OK; **units model** (day demand vs capacity from Forma + HRV + sleep debt), calibrated on B3 check-ins and day ratings; doable-day prediction in the morning; energy curve uses demand; **live re-plan loop** on events (check-in saved, meal logged, workout finished, Health sync, calendar change) → proposal cards (food ±, workout shorter/longer, different movement, time move) with push. | B3 data (weeks), B6 |
| **B8** | **Az egy AI** (one AI, deep) | Memory corpus gets structured daily data; a small **day-scoped council** feeding "miért?"; short/mid/long conclusions in Napló · Minták; konzílium slimmed to what Boop surfaces; chat sees everything incl. the Plan. | B0, B6, B7 |

### 5.1 The remaining slices against the shipped shell (revised 2026-11-16, widened the same day)

> **Second pass, after the shell was finished** (`mezo-r36n9.58`). The first pass measured B6–B8 against the ring
> and the wall. By the evening of 2026-11-16 three more things had shipped: **the day's page** (the Élet spike's
> Ma, `.56`), **every area as its own app with its own bottom bar** (`.57`), and the kit those needed. That moves
> more work out of the remaining slices than the first pass could see, so every slice is re-read below —
> **B5 and the L-slices included**.
>
> The rule for all of them: **a slice fills a tab that already exists; it does not invent a page, a card surface,
> a notification policy or a second place where Boop explains itself.** Where it needs something the kit lacks,
> it grows the kit.

**B5 · Edzés + Watch.** *Most affected of all, because its home is already standing.*
- **No longer B5's to build:** the Edzés page itself. It exists, with the spike's own menu — **Ma · Blokk ·
  Gyakorlatok · Előzmények** — and today's session, the steps, the minutes and the exercises already on *Ma*.
  B5 fills **Blokk** (the mesocycle), **Gyakorlatok** (the library with his own weights and records) and
  **Előzmények** (every past session), each of which currently says it is not built. Also not B5's: the row,
  stat, curve, stepped-bar and menu blocks; the sub-page frame for one exercise or one block (`NKAreaSubPage`);
  per-block loading and failure; the area's search and settings corner.
- **Newly expected of B5:** register a **`WallSource`** (today's session as `.improves`, a session that is about
  to be missed as `.expires`, a finished session as `.happened`) — the brief's `edzes-keszulj` candidate is a
  placeholder for it; and feed the day page's curve its own moment (`dayMoments` already pins the session).
- **Build-twice risk:** *the workout player*. It is a **full-screen cover**, not an area page — the area-page
  system explicitly does not host one (it must survive the phone locking). B5 keeps its own player and puts only
  its entrance on the Edzés page's *Indítás* menu tile, which already exists and says "hamarosan".

**B6 · A Terv.**

**B6 · A Terv.** *The collision is gone:* the life-dashboard plan had made Terv the home of the areas, which would
have left B6's plan editor homeless. The navigation map (#32–#33) gave Terv back to the plan, so B6 has a clean
page to build on.
- **No longer B6's to build:** the page frame (it is `NKAreaPage` with **its own bottom bar** — a plan, the
  rules, the shopping list, adherence — `NKAreaBar`, shipped `.57`), the sub-page frame for one plan or one
  mesocycle (`NKAreaSubPage`), the stat / curve / composition / row-list / list / note / actions blocks, and
  per-block loading and failure (`NKBlockState`). Also **not** the per-area cards the life-dashboard plan once
  put on Terv: the ring has them.
- **Newly expected of B6:** register a **`WallSource`** — a plan waiting for his acceptance and a shopping list
  before a shop run are `.expires`; an effect-tracking result worth knowing is `.happened`. Without this the Plan
  is invisible between visits, which is exactly what the wall exists to fix.
- **Build-twice risk:** *adherence*. The Étel room already shows "how am I doing against today's budget" and B6
  plans a plan-level adherence view. One of them must be the source of truth — the plan's — and the room should
  read it rather than compute a second number that disagrees.

**B7 · Napi kapacitás.** *The biggest double-build risk of the three, and the reason this pass exists.*
- **No longer B7's to build:** the **proposal cards and their push**. B7's plan says "proposal cards (food ±,
  workout shorter/longer, different movement, time move) with push" — that is now the wall's `.improves` and
  `.expires` roles plus `wallNotifications`. B7 produces *candidates*; it must not build a second card surface or
  a second notification policy, and the two-a-day cap applies to it like everything else. Also not B7's: the
  **energy curve's placement** (it already sits on Ma above the folded timeline) — B7 feeds it demand.
- **Newly expected of B7:** a `WallSource` for the live re-plan loop, and a "doable day" line that lands in the
  **morning briefing row** (already folded) plus one wall candidate — not a new section on Ma.
- **What `.56` took off B7's plate:** the day's page is built (date head · *Mai nap* curve with the day's own
  moments pinned on it · the wall · the folds · the observations · Este), and the calendar's density is already
  drawn twice — as pins on that curve and as the heat strip on the Energia page. B7 feeds those two with its
  demand model and its units; it does not add a third drawing of the day.
- **The contradiction this pass found is settled, the other way** (decision #41, 2026-11-16): the owner gave the
  day **its own orb**, so the ring is **eight** and #14 stands. The day's page is reached from the ring's top orb
  **and** from the "A napod" folded row on Ma, and is built from `NKAreaSubPage`. B7 builds that page; it does
  not have to find it a home.

**B8 · Az egy AI.** Least affected, because B8 was already written to expect an open set of contributors.
- **No longer B8's to build:** the explanation surface. Every wall card already carries a **"miért?"**; B8 fills
  `WallCandidate.why` with the day council's lines instead of adding a second place where Boop explains itself.
  The open-set assumption it was told to preserve is now real: `WallSource` keys areas by string.
- **Newly expected of B8:** a `WallSource` of its own for conclusions worth saying today (`.happened`), rather
  than a separate "Amit ma észrevettem" surface competing with the wall.
- **Build-twice risk:** *the day council and the wall's ranking*. They answer different questions — the council
  says *why*, the wall decides *what gets said*. B8 must not re-rank what the wall already chose, or the owner
  gets two different ideas of what matters today.

**The L-slices (Levél, Pénz) against what shipped.**
- **L1/L2 Levél and L4/L5 Pénz no longer build a room.** Both pages exist, with the spike's own menus —
  **Levél: Ma · Figyelt · Szabályok · Fiókok** and **Pénz: Ma · Pénzem · Költés · Gyakorlás** — in their own
  colour worlds (`Hue.level`, `Hue.penz`), and every tab says what will be in it. The slices fill tabs.
  *Two spec lines are now stale and this pass corrects them:* the life-dashboard spec's §3.4 said Pénz would be
  *Ma · Keretek · Előzmények · Tervezett* and L2 said the Levél room was three tabs — the **spike's sets above
  are the ones**, because they are what the owner approved on 2026-11-16 in the running build.
- **Nor do they build:** the mail/news card shapes as page furniture (the wall's hero already is that shape), the
  price verdict's colours (`NKBadge` + the hue), the search field (`NKSearchableRowList`), or the "what never
  reaches a machine" page (a `NKNote` + `NKInfoRow` on the Szabályok tab).
- **Newly expected of each:** a `WallSource` (a digest worth a minute, a watched price that really dropped, a
  budget about to break) — and **nothing of theirs may ring the phone outside the wall's two-a-day cap** (#35).
- **Build-twice risk:** *the Pénz "Ma" tab vs the wall*. Both want to say "ma nincs dolgod a pénzeddel". The wall
  is the one that speaks unprompted; the page says it only when he opens the page.
- **L6** is unaffected by the look: it is the thread list and the memory corpus, and the "kérdezd meg Boopot"
  door it needs is already on every area page and under the day's observations.

**What none of them may do, now that the look is finished.** Four rules came out of the three shipped slices and
they bind every slice after them: no second card surface, no second notification policy, no second place where
Boop explains itself ("miért?" is the wall's), and **no invented number** — a tab with no data says so
(`NKNotLiveYet`) rather than showing a placeholder figure.

**Order: unchanged, B6 → B7 → B8 → L1…L6.** B7's units model is calibrated on weeks of B3 check-ins that are
still accruing, so bringing it forward buys nothing; and B6 gives the wall its first `.improves` source worth
having. Nothing in the shell makes a later slice urgent enough to move.

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
