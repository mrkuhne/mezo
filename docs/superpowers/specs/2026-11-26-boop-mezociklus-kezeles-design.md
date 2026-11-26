# Boop — Mezociklus fül és mezociklus-kezelés (design)

- **Issue:** `mezo-r36n9.177` (epic `mezo-r36n9`)
- **Date:** 2026-11-26 · **Status:** draft → owner OK pending · owner choices: B layout, A clean-slate restart, A atomic server restart keeping edits, + save-to-template
- **Type:** server feature into the app (playbook §6) + new screens (§4). Owner gates: spec ① → simulator spike ② → plan ③.

## 1. Intent — why

The owner can edit the running training block on the iPhone, but cannot see every mesocycle he has made, start one,
close the running one, or restart it. His concrete case: *a week passed, three workouts were missed, I want to start
over.* The server (and the retired web app) has done all of this for months; only the phone lacks the screens.

At the same time the word **„blokk” becomes „Mezociklus” everywhere in the app** — including the year plan's pieces
(owner: „az éves terv is legyen Mezociklus”). The Edzés room's **Blokk** tab becomes the **Mezociklus** tab, the home of
the whole lifecycle, with its own new icon.

## 2. Goals · non-goals · anti-goals

**Goals**
1. Edzés room tab „Blokk” → **„Mezociklus”**, with a **new glyph** (a cycle / circular arrow, drawn in the Napkelte glyph
   style — final look decided in the spike).
2. On the tab, a **current-mezociklus card** at the top: title, „N. hét a M-ból”, progress, and three actions:
   **Szerkesztés** (opens the existing builder), **Újraindítás**, **Lezárás**.
3. A row **„Összes mezociklusom ›”** on the tab, opening a new page with three groups: **Most fut**, **Következik**
   (planned runs), **Lezártak** (archived runs, newest first).
4. **Újraindítás** = clean slate (owner choice A): the **current state of the running mezociklus, with every edit he
   made on the phone**, starts again **today, from week 1**, as a new run; the old run is closed (with its frozen
   report) and stays among *Lezártak* with its logged workouts. **One atomic server step** (owner, 2026-11-26): either
   all of it happens or nothing changes. The confirmation shows „N. hét a M-ból, eddig K edzés kész” (missed count only
   if reliably computable) and offers a toggle **„A sablont is frissítem a módosításokkal”** (default off).
4b. **Mentés a sablonba** (owner, 2026-11-26): from the current-mezociklus card (secondary action, e.g. in a „Továbbiak”
   menu next to the three buttons) he can overwrite the run's template with the run's current state, so future starts
   from that template carry his edits. Confirmation: „A „X” sablon felülíródik a mostani állapottal.” A legacy run
   without a template gets one created.
5. **Lezárás**: a sheet with an optional own evaluation („Hogy sikerült? (nem kötelező)”), a red *Lezárás* button,
   then the **zárójelentés** (frozen report: adherence, strength, records, volume) with the AI evaluation arriving
   later (pending state while it is generated; hidden when the feature is off).
6. **Indítás** of a planned run or **Újrafuttatás** of a closed one: if another run is active, the confirmation says
   that one will be closed first. Start date = today (planned runs: their own date, or today).
7. A closed mezociklus opens its **zárójelentés**; from there **Újrafuttatás**.
8. Every visible „blokk” string (all inflections) reads naturally as „mezociklus” (mezociklusod, mezociklusban, …),
   incl. the year plan, Évad, the player, swap sheet, error texts.

**Non-goals (this issue)**
- „Continue with a shifted calendar” restart (owner choice B) — needs a new server endpoint; later if missed.
- Comparing two runs, deleting or renaming templates, editing a template directly.
- Backend changes beyond the two endpoints in §5.5.

**Anti-goals** (failure even if it works)
- A running mezociklus silently ending because another was started or restarted without a clear warning.
- The Mezociklus tab growing so long that the week (A heted, heti átnézés) drops out of reach.
- „Blokk” surviving in any visible string, or awkward Hungarian from a mechanical replace.
- „Mezo” on its own as a visible word (only the compound „Mezociklus” is allowed).

## 3. Constraints

- Napkelte canon (dark glass, colour only in sky and orbs), shared kit components; no emoji.
- Playbook §9 bar: cached content instantly, fresh behind it; offline shows the last known list; Dynamic Type at the
  largest sizes; VoiceOver labels on every control; smallest iPhone width; reduced motion.
- Season gate: start / activate / rerun-start can 409 `SEASON_REQUIRED` — needs a human message (exists in
  `PlanKit.swift:219`, to be reworded with „mezociklus”).
- Single-active invariant on the server: activating one archives the others.

## 4. Approaches (owner picked B)

| | What | Trade-off |
|---|---|---|
| A) Everything on the tab | current card with actions + all runs listed under it on the tab | one place, but the tab gets long and the week slides down |
| **B) Tab + „Összes mezociklusom” page** ✔ | current card with actions on the tab; full history one tap in, grouped | list is one tap away; tab stays short and week-focused |

Restart semantics: **A) clean slate** ✔ (server-ready: rerun → start) vs B) shift the calendar (needs new endpoint).

## 5. Design

### 5.1 Mezociklus tab (was Blokk)
Order: heti átnézés entrance (unchanged) → **current-mezociklus card** (new) → terhelés card (renamed „A
MEZOCIKLUS TERHELÉSE”) → A heted → **„Összes mezociklusom ›”** row (new) → Az éves terv row → ask-Boop row.

- No running mezociklus: the empty state (renamed) keeps *Új mezociklus*; if a planned run exists, the card shows it
  with **Indítás**; the „Összes mezociklusom” row is always present.
- Unreachable server, no cache: existing „nem érem el” state, the list row still opens (the page has its own states).

### 5.2 Összes mezociklusom page
Full-screen sub-page (same pattern as the year plan / builder covers). Groups: *Most fut* (0–1), *Következik*,
*Lezártak*, and *Sablonjaim* (my call — he thinks in „templates → start”; each template row shows how many times it
ran and has **Indítás**, which starts it today as active, with the „X lezárul” warning if one runs). Row: title, date range, „N hét · split”, report chip if `hasReport`. Tap: running → back to the tab /
its card; planned → a detail with **Indítás**; closed → **zárójelentés** with **Újrafuttatás**. States: loading
(cached first), empty („Még nincs mezociklusod — indíts egyet”), error, offline (cached + age).

### 5.3 Confirmations (all `confirmationDialog`-style, attached to the screen, not to a list row)
- **Újraindítás:** „Újrakezded ma az 1. héttől? A mostani futam (N. hét a M-ból) lezárul és megmarad a lezártak között.”
- **Lezárás:** sheet (optional own evaluation) → red *Lezárás* → report.
- **Indítás / Újrafuttatás while one runs:** „A most futó „X” lezárul.”

### 5.4 Zárójelentés view
Read-only frozen report from the server: adherence, strength changes, records, volume; own evaluation; AI evaluation
with pending / ready / off states (poll while pending, modest interval, stop on leave).

### 5.5 Server calls
Existing: `listMesocycles`, `listMesoTemplates`, `activateMesocycle` (planned → Indítás, keeps its plan),
`closeMesocycle {selfEval?}`, `rerunMesocycle` → `startMesoTemplate {startDate: today, status: active}` (closed run →
Újrafuttatás from its template), `getMesocycleReport`.

**New (owner choice A, 2026-11-26)** — contract first in `api/feature/train/train.yml`, ITs, ArchitectureTest:
1. `POST /api/train/mesocycles/{id}/restart` body `{updateTemplate?: boolean}` → `MesocycleResponse` (the new run).
   One transaction: the run must be the owner's active run (else 409); close it exactly like `closeMesocycle`
   (closedAt, frozen report, `MesocycleClosed` event → AI eval); stamp a new **active** run starting today from the
   **old run's own current state** (title, settings, style, phase curve, priorities, sport groups, days + exercises —
   reuse the run→plan materialization `MesoTemplateService.daysOf` already does for legacy runs); the new run keeps
   the old run's `templateId` (materialize one for a legacy run). Season gate applies; any failure rolls everything
   back. `updateTemplate=true` additionally overwrites the template like (2).
2. `POST /api/train/mesocycles/{id}/save-to-template` → `{templateId}`. Overwrites the run's template with the run's
   current state (legacy run: creates and links one). Idempotent.
Missed-workout count, if shown: derived client-side; omit rather than guess.

### 5.6 Rename
All visible strings in `ios/Boop` + `ios/BoopKit` (list in Codebase terrain), with correct suffixes; tests asserting
them updated; the tab glyph mapping updated (it matches the literal label). Internal identifiers may keep `block`
names. Server-emitted texts are out of scope (noted as follow-up if any shows „blokk”).

## 6. Left to the builder
Exact layout and glyph (spike decides, owner OK); model / store split; cache keys; polling interval; whether the
planned-run detail is a sheet or a page; whether restart tries to carry the self-eval prompt (default: no).

## 7. Prior art
- **RP Hypertrophy** (help.rpstrength.com, „sick or miss a day”): early in the cycle → restart the mesocycle; late →
  go to deload; „End” is irreversible and says so. *Adopted:* restart from week 1 as a deliberate, confirmed action;
  explicit irreversibility text. *Rejected:* RP's clumsy „recreate then start” — ours is one tap.
- **TrainerRoad** (missed-workouts blog): small gap → continue, large gap → restart; show the gap as decision input.
  *Adopted:* show week N of M (and missed count when reliable) in the restart confirmation.
- **Fitbod** (missing a workout): one miss is no big deal — continue is the calm default. *Adopted:* restart is never
  pushed, only offered.
- **Apple HIG** action sheets / alerts: `confirmationDialog` with a destructive role for intentional, irreversible
  actions; context-menu actions must also exist in the main UI. *Adopted.*
- **iOS 26 forum report** (developer.apple.com/forums/thread/802906): a `confirmationDialog` from a List swipe action
  showed as a popover. *Adopted:* dialogs attached to the screen; no swipe-only destructive actions.

## 8. Codebase terrain
- **Backend** (`api/feature/train/train.yml`, `TrainService`, `MesoTemplateService`): no restart endpoint today, and
  `rerun` returns the run's ORIGINAL template — phone edits (`replaceDayExercises`, settings, priorities) live only on
  the run and never reach the template, so rerun-based restart would silently drop them (builder check, verified);
  `stampRun` with status active archives the running run WITHOUT closedAt/report (those runs show „nincs jelentés”); close freezes the report in the same transaction and fires the
  async AI eval; activate archives other active runs; `SEASON_REQUIRED` 409 on start/activate.
- **iOS:** tab enum `EdzesTab` (`ios/Boop/Edzes/EdzesRoom.swift:27`, raw value is the visible label — check
  persisted selection before renaming); tab content `blokk` (~798); covers via `EdzesPage` `.fullScreenCover`;
  glyph switch `BoopDesign/Napkelte/Area.swift:374` matches the literal „Blokk”; glyph SVGs in
  `BoopDesign/Resources/Glyphs.xcassets/g-*.imageset`.
- **Client:** extend `PlanClient` (`BoopCore/Train/PlanClient.swift`, lenient `RawJSONClient`) — `closeBlock`
  exists but has no caller and no selfEval; add `activate`, `rerun`, `report`, list-all; extend `WireBlock`
  (`PlanWire.swift:10`) with optional `closedAt`, `templateId`, `hasReport`, `endDate`, `goal`. Preview transports
  (`PlanPreview.swift`, `Connect/PreviewTransport.swift`) need the new operation cases.
- **Cache:** `ServerCache` actor, pattern in `EdzesStore.loadBlock` (~495–525).
- **Rename list:** ~25 files across Edzes, EdzesTerv (+UjBlokk, EvesTerv), Evad, Kezdolap/KitGallery, BoopCore
  Train/Evad, BoopDesign Train/Area; tests asserting strings in BoopCoreTests and BoopTests. No `.strings` files —
  literals only; suffixes need manual care.
- **Traps:** `BlockBuilderPage.Mode.blokk` raw value parsed from preview defaults; season gate text names
  „Edzésblokk”; rerun on legacy runs materializes a template first; the year plan's „blokk” is the same word for a
  year-plan piece and is renamed too.
