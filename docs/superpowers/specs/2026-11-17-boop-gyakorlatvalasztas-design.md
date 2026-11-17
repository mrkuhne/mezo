# Boop — személyre szabott gyakorlatválasztás (reasoned exercise selection)

**Date:** 2026-11-17 · **Status:** draft, awaiting owner OK · **Epic:** `mezo-r36n9` (Boop) · **Surface:** the
native iPhone app only (owner decision 2026-11-17). The web app is not touched.

## 1. Intent and why

The owner read the research digest
[`personalized-exercise-selection`](../../research/concepts/personalized-exercise-selection.md) (Nippard's
*Muscle Ladder* exercise guide) and wants its transferable lesson in Boop: **there is no best exercise for
everyone — a movement is right when it fits the person's goal and equipment, is comfortable, covers the intended
muscle, and stays in the plan long enough to progress on.**

Today Boop's exercise swap lists every catalogue exercise of the same muscle in catalogue order, then thirty
others, with no ranking and no explanation. It ignores the block's goal, ignores the joint-pain answers the
player already collects after every exercise, and knows nothing about equipment.

**Success in the owner's terms:** when he taps *csere* mid-workout, the first few suggestions are ones he could
actually do, in his gym, without the thing that hurt, doing the same job in the plan — and each says in one
sentence why it is there. The decision stays his.

## 2. Goals, non-goals, anti-goals

**Goals (the programme — five slices, §6):**

1. **G1 Indokolt csere** — the swap ranks by goal, equipment, discomfort and plan role, with a one-sentence reason.
2. **G2 „Miért ezt?”** — every catalogue exercise can explain what it is good for, when to pick it, what replaces it.
3. **G3 Hiányok a tervben** — the block review points out a missing complementary movement, as a hint.
4. **G4 Tudatos váltás** — Boop says when an exercise is worth keeping and when changing it is reasonable.
5. **G5 Indokolt katalógusbővítés** — the catalogue grows only on evidence of the owner's own demand.

**Non-goals:** the web app; a new plan generator; changing set/volume/progression rules (they stay as in
[`program-design-rules`](../../research/concepts/program-design-rules.md) and
[`set-volume-landmarks`](../../research/concepts/set-volume-landmarks.md)); an LLM in the ranking path.

**Anti-goals — these make the feature a failure even if it works:**

- Treating Nippard's favourites as a ranking. No exercise is "the best"; no list of his picks is encoded.
- Promising a result. No study percentage and no predicted growth appears anywhere in the app.
- Copying the PDF's text or images into the app, the catalogue or the repo. All wording is our own.
- Deciding for him. Boop orders and explains; the full catalogue stays one tap away, and nothing is hidden for good.
- Pushing through pain. A reported discomfort is a reason to offer another movement, never a challenge.

## 3. Prior art

- **The digest** (above) and its source notes: fit → coverage → trackability → lengthened-position tie-breaker.
  The three study comparisons it cites (triceps, hamstrings, calves) used 14–21 participants on fixed protocols;
  they justify a *tie-breaker*, not a promise.
- **RP Hypertrophy / similar apps:** swap offers same-muscle exercises filtered by the equipment set chosen at
  onboarding; a per-exercise "joint pain" answer lowers that exercise's priority next block. No reason text.
- **Fitbod:** an explicit "gym profile" (equipment checklist, several gyms) and an "exclude this exercise"
  action in the swap menu; the swap sheet states "same muscle group". The profile is asked up front, which the
  owner declined in favour of *default everything + correct in the moment*.
- **In this repo:** the web swap spec `2026-09-28-workout-exercise-swap-add-design.md` (`mezo-mobji`) — two-step
  sheet, *Csak ma / Mezociklusra is* scope; Boop shipped the *today* scope only (handbook
  `07-edzes/03-edzeslejatszo.md`). Deterministic Hungarian reason sentences already exist in the readiness
  lightening (`WorkoutService`). Boop's rule that **every proposal has a "miért?"** (boop skill §2).

## 4. Codebase terrain

| Area | Today | Anchor |
|---|---|---|
| Catalogue | 166 master rows: `slug, name, muscle, type (compound/isolation/plyo), stim, fatigue` + media. **No** equipment, movement pattern, secondary muscles, joints, or text. Upserted by slug at every startup. User-authored rows exist. | `backend/src/main/resources/content/exercise-catalog.json`, `train/entity/ExerciseCatalogEntity.java`, `ExerciseCatalogLoader`, contract `api/feature/train/train.yml` (`ExerciseCatalogItem`) |
| Boop swap | Same muscle first, then 30 others; today-scope only; the one online-only write in the player. | `ios/Boop/Edzes/WorkoutPlayer.swift` (`swapSheet`), `ios/Boop/Edzes/EdzesStore.swift`, `BoopCore/Train/TrainClient.swift` |
| Swap write | `POST /api/train/workouts/{id}/exercises` — instance row always; MESO scope rewrites the template day. | `train/service/WorkoutExerciseChangeService.java` |
| Goal | `MesocycleEntity.goalPreset` (hypertrophy / strength / cut-prep / recovery / sport / erohipertrofia, nullable). | `train/entity/MesocycleEntity.java` |
| Discomfort, per exercise | `exercise_feedback.joint_pain` (1–3 on the wire), asked once per exercise by the Boop player (*Nincs / Enyhe / Erős*). Read by nothing in training. **Boop sends the three answers 0-based — bug `mezo-r36n9.67`, a prerequisite of slice 1.** | `train/entity/ExerciseFeedbackEntity.java`, `BoopCore/Train/WorkoutSession.swift` |
| Discomfort, per body region | The daily check-in's pain regions, mapped to muscles, already used to lighten a workout. | `train/service/PainRegionMap.java`, `ReadinessAssessor.java`, `DayCheckInPort` |
| Equipment / gym profile | Nothing, anywhere. | — |
| Boop surfaces that do **not** exist yet | Edzés settings (a "soon" toast), the Gyakorlatok tab (placeholder), catalogue search, custom-exercise creation (web only). The player's technique sheet exists. | `ios/Boop/Edzes/EdzesRoom.swift`, `WorkoutPlayer.swift` |
| Exercise names | English in the catalogue and everywhere in Boop today. | `exercise-catalog.json` |
| Generator | Compound first, then `stim` descending; hypertrophy only. Being redesigned by a parallel session (`mezo-r36n9.65`, block builder + weekly review). | `train/service/MesoPlanFiller.java`, `MesoPlanGeneratorService.java` |

**Patterns to follow:** contract-first (`train.yml` → generate → implement, then the BoopAPI generator filter);
pure table-tested rankers with no Spring (`MesoPlanFiller`, `SessionExerciseAssembler`); cross-feature reads
through ports; Liquibase in `1.1.0/`; ArchUnit layer subpackages; `node scripts/gen-codemap.mjs` after new classes.

**Traps:** `ExerciseCatalogLoaderIT` / `ExerciseCatalogContractIT` assert catalogue shape; the loader overwrites
master rows at startup (new attributes must live in the JSON, not be hand-edited in the DB); the simulator app
cannot make live calls on this Mac (stubbed transports); `ios/Boop/Edzes/**` and `BoopCore/Train/**` are still
listed under the B5 issue's *Owns* (§9).

## 5. Approaches

**Where the ranking lives**

| | What | Trade-off |
|---|---|---|
| **A — server ranks, phone shows (chosen)** | A pure ranker in the backend behind one endpoint; the phone renders suggestions and reasons. | Needs a connection — but the swap already does. One place for the rules; G2–G4 reuse the same attributes and reasons. |
| B — rank on the phone | Ship the attributes in the catalogue payload, rank in Swift. | Works offline, but pain history, goal and equipment all have to be synced to the phone first, and the rules exist in Swift only. Rejected: the swap cannot complete offline anyway. |
| C — let the AI pick | Send the context to a model, get suggestions with prose. | Slow mid-set, unpredictable, and it can invent a claim ("builds 30% more"). Rejected by the anti-goals. |

**How Boop learns the equipment** — owner decision 2026-11-17: **list + signal at the swap.** Everything counts
as available until he says otherwise; an Edzés setting *Mi van a termemben* lists the equipment kinds; the swap
sheet has *ehhez nincs eszközöm*, which updates the same list. Rejected: a list only (he would have to leave the
workout to fix it) and learning only at the swap (slow, and nowhere to see what Boop believes).

## 6. The design

### 6.1 The shared foundation — what every slice stands on

**New catalogue attributes** on master rows (authored in `exercise-catalog.json`, our own classification):

| Attribute | Values | Used for |
|---|---|---|
| `equipment` | one or more of: `barbell`, `dumbbell`, `kettlebell`, `cable`, `machine` (selectorised / plate-loaded, incl. leg press, hack squat, pec deck), `smith`, `bench` , `pullup-bar` (incl. dip station), `bodyweight`, `specialty` (EZ bar, trap bar, landmine, ab wheel, box, GHD/Nordic anchor) | filtering, the list |
| `pattern` | one of: `horizontal-push`, `vertical-push`, `horizontal-pull`, `vertical-pull`, `squat`, `lunge`, `hinge`, `knee-flexion`, `knee-extension`, `hip-extension`, `hip-abduction`, `elbow-flexion`, `elbow-extension`, `raise`, `fly`, `calf-raise`, `shrug`, `trunk-flexion`, `trunk-stability`, `carry`, `jump` | plan role, coverage rules |
| `secondaryMuscles` | 0–3 muscle tokens from the existing 21 | plan role |
| `joints` | the joints it loads noticeably: `shoulder`, `elbow`, `wrist`, `lower-back`, `hip`, `knee`, `ankle` | discomfort |
| `lengthened` | boolean — the muscle is loaded hard in its stretched position | tie-breaker only |
| `demand` | `low` / `medium` / `high` — how much technique and stability it asks | goal fit, discomfort |

`bench` alone never makes an exercise unavailable unless the owner unticks it; an exercise needs **all** its listed
equipment. A row's exact attribute values are the builder's to author, reviewed in one sitting against the 166
names; the lists above may gain a value if a row genuinely does not fit (say so in the plan).

**User-authored exercises** have none of these. They are never filtered out, rank as neutral, and their reason
reads *„saját gyakorlat — erről még keveset tudok”*. Editing attributes on a custom exercise is out of scope.

**Kinds the owner sees in *Mi van a termemben*** (Hungarian labels, one row each, all on by default):
Rúd és tárcsák · Kézisúlyzók · Kettlebell · Csiga (kábel) · Gépek · Smith-keret · Pad · Húzódzkodó és tolódzkodó
állvány · Különleges eszközök. `bodyweight` is always available and not shown.

**One missing machine is not "no machines".** The profile therefore holds two things: switched-off **kinds**, and
individually **missing exercises** ("this machine is not in my gym"). For an exercise whose equipment is
`machine`, `smith` or `specialty`, the swap's *ehhez nincs eszközöm* marks **that exercise** as missing; for the
portable kinds (barbell, dumbbell, kettlebell, cable, bench, pull-up bar) it switches the kind off. The list page
shows the kinds as switches and, under them, *Ami konkrétan hiányzik* — the individually marked exercises, each
removable.

**Storage:** the user's *unavailable* equipment kinds and individually missing exercises (both sets; empty =
everything available), one profile per user. Several gyms is a possible later extension — keep the table shape able to grow a profile key, build one.

### 6.2 Slice 1 — Indokolt csere (the swap)

**What he sees** (Napkelte sheet, replaces today's *Mire cseréljük?* list):

```
  FEKVENYOMÁS RÚDDAL
  Mire cseréljük?

  [ ehhez nincs eszközöm ]  [ nem esik jól ]        ← optional, one tap each

  AJÁNLOM
  ┌──────────────────────────────────────────────┐
  │ Mellgép (nyomás)                    mell · összetett │
  │ Ugyanazt a mellizmot terheli, gépen stabilabb —      │
  │ izomépítéshez jó, és a válladat kíméli.              │
  │ Legutóbb: 60 kg × 10                                 │
  └──────────────────────────────────────────────┘
  │ Kézisúlyzós fekvenyomás …  (up to 5 cards)

  MINDEN GYAKORLAT  ›                                 ← the full searchable catalogue
```

- **Suggestions:** up to five, ranked, each with name, muscle · type, **one reason sentence**, and the last top
  set when he has history with it. Below them one row opens the full catalogue (a new search field over the
  list Boop already has, same muscle first),
  where a filtered-out exercise carries a quiet label (*nincs hozzá eszközöd* / *legutóbb fájt*) and stays
  pickable.
- **The two chips** are optional context for *this* swap:
  - *ehhez nincs eszközöm* → if the outgoing exercise needs one kind, that kind is switched off in his list at
    once (with an undo line: *„Csiga kikapcsolva a termedben · visszavonom”*); if it needs several, a short pick
    asks which one is missing. The suggestions re-rank.
  - *nem esik jól* → recorded as a discomfort on the outgoing exercise in **its own small record** (user,
    catalogue exercise, day, source = swap) — not in the after-exercise feedback row, whose pump and workload
    answers are mandatory and would have to be invented. The ranker reads both sources and treats a swap-time
    discomfort like an *Enyhe* answer. The suggestions then prefer movements that spare the joints it loads. No
    body-part question in the sheet.
- **Scope:** as today — the swap applies to today's workout. *Az egész blokkra* arrives with slice 4, where it
  belongs to the keep-or-change conversation.
- **Offline / failure:** if suggestions cannot be fetched, the sheet says so in one line and shows today's plain
  same-muscle list from the cached catalogue; the swap itself still needs a connection, as now.

**How suggestions are chosen** (deterministic, pure, table-tested):

1. **Candidates:** catalogue exercises with the same primary muscle as the outgoing one and not already in
   today's workout. If fewer than three survive step 2, widen to the same `pattern` within the same body region.
2. **Left out of the suggestions** (never out of the full list): needs an equipment kind he switched off · he
   reported *Erős* joint pain on it in any of its last three feedbacks · plyometric when the outgoing is not.
3. **Order**, strongest signal first:
   1. **Role** — same type (compound stays compound, isolation stays isolation), then same `pattern`, then
      overlap in `secondaryMuscles`.
   2. **Discomfort** — exercises with *Enyhe* in their recent feedback, or loading a joint that maps to a pain
      region in today's check-in, or (after *nem esik jól*) sharing the outgoing exercise's `joints`, move down;
      lower `demand` and guided equipment (machine, cable) move up in those cases.
   3. **Goal** (from the running block; no block or no goal = hypertrophy):
      hypertrophy / erohipertrofia → higher stimulus for the fatigue it costs, stable and easy to load, and
      `lengthened` as the tie-breaker · strength → free-weight compounds of the same pattern, closest to the
      outgoing movement · cut-prep / recovery → lower fatigue first · sport → as hypertrophy.
   4. **Trackability** — he has logged it before (a previous top set exists) ranks above a never-done exercise
      of equal fit.
4. **The reason sentence** is assembled from the one or two signals that put the exercise where it is, from a
   fixed set of Hungarian phrases — e.g. *„Ugyanazt a mozgást adja kézisúlyzóval, ehhez van eszközöd.”* ·
   *„Gépen stabilabb, a válladat kíméli — legutóbb a rudas változat nem esett jól.”* · *„Erőcélhoz a szabadsúlyos
   változat áll a legközelebb.”* · *„Ezt már csináltad, így látod, hol tartasz.”* Phrase rules: never "legjobb",
   never a number about expected results, never a coach's name; a discomfort phrase names the joint only when it
   comes from his own report. **Phrases never embed an exercise name** — names stay as they are today (English,
   as everywhere in Boop); translating the catalogue is not part of this programme, and the sketch's Hungarian
   names are illustration only. The exact phrase table is the builder's, reviewed with the spike.

**Server contract (shape, not final names):** a read on the running workout's exercise that returns ordered
suggestions `{exercise, reasonText, signals[], lastTopSet?}` plus per-exercise labels for the full list; a
read/write pair for the equipment profile; the *nem esik jól* write reuses the feedback record. Reason text is
rendered by the server in Hungarian (Boop is Hungarian-only); `signals` are stable codes so the phone and tests
do not parse prose.

**Settings:** Edzés has no settings screen today. Slice 1 builds a minimal one behind the room's existing
*Beállítások* entry, holding only *Mi van a termemben* (the nine switches of §6.1 + *Ami konkrétan hiányzik*);
other Edzés settings are not this programme's.

**Prerequisite:** bug `mezo-r36n9.67` (the 0-based feedback answers) is fixed first — as the first task of
slice 1 or before it — otherwise *Erős* is stored as *Enyhe* and the discomfort rules read wrong data.

### 6.3 Slice 2 — „Miért ezt?”

On the player's technique sheet — the one exercise sheet Boop has today — a short block; when the Gyakorlatok
tab is built (B5's remaining work, not this programme) its exercise sheet shows the same block. The block is built from the same
attributes: **Mire jó** (muscle + role in plain words) · **Mikor válaszd** (which goal it suits, what it asks:
equipment, technique) · **Mivel helyettesíthető** (the top two of the slice-1 ranking, tappable) · **Hogyan
fejlődj benne** (the progression the engine already applies to it). Where a claim rests on a study rather than on
coaching practice it is labelled so (*„vizsgálat is alátámasztja”* vs *„edzői tapasztalat”*), with no figures.
An optional hand-written one-line note per master row is allowed, in our own words. Deterministic; no AI.

### 6.4 Slice 3 — Hiányok a tervben

A small table of complementary pairs evaluated per muscle over the block's week, e.g. hamstring: `hinge` without
`knee-flexion` (and the reverse) · quad: `squat`/`lunge` without `knee-extension` · lats/mid-back: `vertical-pull`
without `horizontal-pull` (and the reverse) · triceps: pressing only, no `elbow-extension` · chest: pressing
only, no `fly` (lowest priority). Each finding is a **hint with a "miért?"** and one proposed addition from the
slice-1 ranker, never a rule, never a compound/isolation percentage, and silent for muscles whose role in the
block is *Tartás*. **It appears inside the block builder's weekly review** being designed in `mezo-r36n9.65` —
this slice does not build a second review surface, and cannot start before that one ships.

### 6.5 Slice 4 — Tudatos váltás

- **At the swap:** the scope choice *Csak ma / Az egész blokkra* arrives in Boop. Choosing *az egész blokkra* for
  an exercise with fewer than four logged sessions in this block shows one line — *„Ebből még csak 2 alkalmad
  van; a fejlődés 4–6 alkalom után látszik. Így is cserélheted.”* — and nothing blocks.
- **At the block's end / when the next block is built:** per exercise a keep-or-change line from his own log:
  *keep* while reps or load still move; *worth changing* when it has stalled for three sessions, or drew repeated
  discomfort, or was swapped away or skipped most weeks — each with its reason and a slice-1 suggestion.
- Thresholds (4 sessions, 3 stalled) are starting values in configuration, tuned on his data.

### 6.6 Slice 5 — Indokolt katalógusbővítés

No screen. A rule and a quiet record: searches in slice 1's new catalogue search that return nothing, and custom
exercises he creates (on the web today — Boop has no creation), are counted; an exercise is added to the master catalogue (with full §6.1 attributes) only
when that record shows he looked for it. The digest's named gaps (direct forearm and neck work, a Bayesian cable
curl) are **not** added on the strength of the name alone.

## 7. Order and gates

| # | Slice | Depends on | Owner sees before build |
|---|---|---|---|
| 1 | Indokolt csere + *Mi van a termemben* + the catalogue attributes | B5 session released (§9) | simulator spike of the swap sheet and the list |
| 2 | „Miért ezt?” | 1 | simulator spike of the block on the exercise sheet |
| 3 | Hiányok a tervben | 1, and the block builder's weekly review (`mezo-r36n9.65`) shipped | inside that review's spike |
| 4 | Tudatos váltás | 1 | simulator spike of the two lines |
| 5 | Katalógusbővítés | 1 | nothing to see; a short Hungarian note when a row is proposed |

Each slice follows the Boop loop: spike in the simulator → owner OK → plan with *Kész, ha…* → build → gates →
merge → deploy → install → live check → Hungarian report, with the handbook pages (`docs/boop-handbook/07-edzes/`)
and the Notion space updated in the same slice. Slices 2 and 4 are independent of each other and of 3.

## 8. Left to the builder

The attribute values for the 166 rows; table/column names and the endpoint names; the exact phrase table and
signal codes; the numeric weights inside each ordering tier (the tier order of §6.2 is fixed); how the phone
caches suggestions during one open sheet; where the nine-row list is placed (settled on the spike).

## 9. Constraints and open coordination

- `ios/Boop/Edzes/**` and `BoopCore/Train/**` are in the B5 issue's *Owns* list (`mezo-r36n9.15`, merged to main
  2026-11-17 but still open). **No build starts until the owner confirms that session is finished.** Spec, spike
  (throwaway, own folder) and plan do not touch those paths.
- The catalogue JSON, `train.yml`, the BoopAPI generator filter and the Liquibase master file are shared hot
  spots — one writer at a time.
- Privacy: discomfort and equipment are personal data; nothing of it goes into docs, the handbook or Notion
  beyond invented examples marked „például”.
- A discomfort answer changes **which exercise is suggested**; it still does not change load or volume (the
  handbook's open question on that stays open and is not answered here).
