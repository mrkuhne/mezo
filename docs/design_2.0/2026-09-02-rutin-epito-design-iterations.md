# Rutin-építő design iteration — round 1 (2026-09-02)

Daniel asked for the routine page to leave the Growth tab, get its own tile under Én, its own
page, and a wizard that helps people build a routine on two named frameworks: James Clear's
**Four Laws of Behavior Change** (cue → craving → response → reward; make it obvious /
attractive / easy / satisfying, with tracking itself as the satisfying reward) and BJ Fogg's
**Habit Stacking** ("After I [current habit], I will [new habit] and log it"). This file records
**what was decided, why, and what it means for implementation** —
`prototypes/src/rutin-epito-head.html` + `prototypes/src/rutin-epito-body.html` (assembled into
`prototypes/rutin-epito.html`, published at
https://claude.ai/code/artifact/78c8f0f9-925f-44a9-93b4-3e9cc077e162) are the visual truth, this
is the rationale. Read together with
[`docs/superpowers/specs/2026-09-02-routine-builder-design.md`](../superpowers/specs/2026-09-02-routine-builder-design.md)
(backend + frontend spec) and [`docs/features/habit.md`](../features/habit.md) (today's ground
truth). Driving epic: `mezo-3zue`.

## 1. Where the tile goes — a full-width Rutin tile, not a 7th small cell

Daniel: *"az Én alatt legyen egy külön csempe."* The Én hub is a fixed 3×2 mosaic
(`EnHubPage.tsx`), and the hub-tile-reorg spec (2026-09-01) explicitly rejected a 7th small cell
because it breaks the two-column pairing.

**Decision: a full-width Rutin tile under the six small tiles**, the Mezo-hub Diagnózis/Karakter
precedent (`.tile.wide`). Gold wash (`t-hab` family), `i-rend` icon, one live datum per the
tile-anatomy rule: `3 / 6 ma · reggel 82% · este 64%` — today's done/total from `useHabitDay`
and the two seed chains' 28-day strength from `useHabitSummary`. Zero habits ⇒ the line is
`undefined` and the tile shows only its eyebrow + spot (no fabricated number — `EnHubPage.test`
"no fabricated line" contract).

Considered and rejected: replacing the Growth tile (Growth carries the XP/skill lines and the
title shop; it would orphan them) and merging Súly + Alvás into a "Test" tile (a separate IA round).

## 2. One home for routines — `/me/rutin` replaces the Growth segment *and* the editor

Today the routine lives in three places: `GrowthPage` 2nd segment (`RoutinesTab`, read-only
overview), `/me/routines/edit` (`RoutineEditorPage`, chain/def CRUD) and `/nap/rutin` (daily tick).

**Decision: `/me/rutin` becomes the single build-and-edit surface; the Growth segment and
`/me/routines/edit` are removed (redirects kept). `/nap/rutin` does not move.** The hub page
carries the 30-day perfect counters (from `RoutinesTab`) in its statstrip and the chain cards +
reorder + toggles + sheets (from `RoutineEditorPage`). It deliberately has **no tick control**:
habit.md §5 documents that a second checkable control double-awards XP in mock mode, and the
product rule is "build here, log there".

## 3. Tracking as the reward — strength bars, no streak resets

Daniel's brief quotes Clear: *"make the tracking itself a satisfying reward."* The researcher's
recon (Loop Habit Tracker FAQ; Atoms critique) says red-X / broken-chain mechanics increase
dropout and that Atoms hides its "repetitions" so the reward never lands.

**Decision: every habit row shows a 28-day strength bar** (`HabitStrength.strengthPct`, which
the backend already computes) that visibly rises on each tick and dips softly on a miss; done
rows tint sage, undone rows gold. A streak counter is not added. This is ADR 0010 ("XP feedback,
not payment; no red") applied to habits. The hub's principle line says it in one sentence:
*"Egyszerre egy szokás. A logolás maga a jutalom."*

The first-tick celebration on `/nap/rutin` (replaying the user's own "Ünneplésül: …" text +
a bar-rise animation) is **deferred to a follow-up slice (S5)** — it touches the Today surface,
which is out of this round's scope.

## 4. The wizard — one recipe per run, framework chosen first, one sentence assembling live

Three ways were on the table: whole-chain wizard, single-habit recipe, or both. Fogg and the
Loop FAQ both say starting more than ~1–3 new habits predicts abandonment; Fabulous' critique
warns against front-loading questions.

**Decision: one run = one habit recipe (one `habit_def`), 4 steps, framework chosen on step 1.**
Both branches converge on the pattern Atoms and the official Tiny Habits recipe card share: the
user fills blanks and watches one Hungarian sentence assemble on a **sentence card** above the
form from step 2 onward (large on step 4). No framework vocabulary is required to fill it.

| Step | Fogg branch (⚓ Szokás-láncolás) | Clear branch (◈ Négy törvény) |
|---|---|---|
| 1 Keret | two framework cards with a 2-line explanation and the loop (Horgony → Pici tett → Ünneplés / Jelzés → Vágy → Válasz → Jutalom); tip: when in doubt start with Fogg | same |
| 2 | **Horgony** — chips from existing habits (`SZOKÁS`), mezo events (`MEZO`: weigh-in, breakfast logged, workout done) and the user's own past anchors (`SAJÁT`), or free text; tip: the anchor's *trailing edge* | **Jelzés** — time + place chips or free text; tip: 1st law, make it obvious |
| 3 | **Pici tett** = title + chain + LIFE area + XP; soft "Ez nagynak hangzik" warning when the title is > 6 words or contains a number > 5 (does not block) | **Válasz** = title + chain + LIFE + XP, plus **Vágy** ("mert …", required) and **Identitás** ("hogy olyan ember legyek, aki …", optional); tip: 2nd + 3rd law, two-minute rule |
| 4 | **Ünneplés** chips (ökölrázás, „Igen!", mosoly, mély levegő) or free text | **Jutalom** chips with "a pipa maga" preselected (4th law: logging is the reward) |
| 4 | **Vállalom** commitment tick (Fabulous: the tick is a promise, not customisation) gates `✓ Mentés` | same |

Sentence templates (the FE pure function `routineSentence(def)` renders exactly these):

- Fogg: *„Miután [horgony], [cím] — és logolom. Ünneplésül: [ünneplés]."*
- Clear: *„[Jelzés] [cím], mert [vágy]. Jutalmam: [jutalom]. Hogy olyan ember legyek, aki [identitás]."* (last sentence only when identity is set)

Save = the existing `createDef` with the new framework fields; the hub re-enters with the new row
highlighted (`.hrow.new` wash). The wizard is the first real consumer of `shared/ui/Stepper.tsx`
(dot mode), instead of GoalPlanner's hand-drawn progress bar.

## 5. Anchors are data, not just prose

Habitify implements stacking as an event-triggered reminder ("remind [target] when [base] is
completed"); Fogg's anchors are mostly real-world moments. Both are needed.

**Decision: `anchor_habit_key` (a reference to one of the user's own active defs) + `anchor_copy`
(free text) on the def; the wizard writes one or the other.** Choosing an existing habit makes
the stack machine-readable (a later slice can fire the stacked habit's prompt when the anchor is
ticked — **S6, deferred**); free text keeps Fogg's "after I brush my teeth" possible. When the
anchor def is deleted, the backend copies its title into `anchor_copy` and nulls the key so the
sentence never breaks. The `MEZO` chips (weigh-in, meal logged, workout done) are free-text
anchors in this round — event binding is S6.

## 6. Legacy habits keep working; the framework is nullable

All six seed habits and any user-created def predate the frameworks. **Decision: `framework`
is nullable; rows without one show a `– RÉGI` badge and a "Keret nélkül" band on their page,
whose "Keret váltása" opens the wizard prefilled with the def** (step 1 then re-runs the branch).
Nothing is migrated or asked of the user.

## 7. The habit page — recipe first, history second

`/me/rutin/szokas/:id` replaces `HabitEditSheet` for framework-era defs: framework band, the
sentence large, a 28-day history strip (green tick / grey miss / empty), the framework fields as
inputs, chain + XP, and **"Szüneteltetés — a haladás megmarad"** (Atoms' pause-without-loss;
maps to `isActive=false`). Delete stays behind ⋯ with two taps, as today.

## Döntési kérdések Danielnek

1. A széles Rutin csempe a hat kis csempe **alatt** (ahogy a prototípusban) vagy a cél-kártya
   után, **fölöttük**? (A hub-tile-reorg spec a széles cellát alulra tette a Mezón.)
2. Az **AI javaslat** a wizard 3. lépésébe töltsön elő (a javaslat így receptté válik), vagy
   maradjon a mai „elfogadom → kész sor" sheet?
3. A Clear-ág **identitás** mezője maradjon opcionális, vagy legyen kötelező, mint az Atoms appban?
4. Kell-e a Fogg-ágban a **„pici?" figyelmeztetés** (6 szó / 5-nél nagyobb szám), vagy csak zavar?
