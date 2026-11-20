# Boop — napi gyakorlatszerkesztő a futó blokkban (block day editor)

**Date:** 2026-11-20 · **Status:** draft, short design approved by the owner („Igen, mehet”), awaiting spec OK ·
**Issue:** `mezo-r36n9.116` (blocks `mezo-r36n9.114`) · **Epic:** `mezo-r36n9` · **Surface:** the iPhone app (Boop) + one small server read. Slice 1 of "the whole block
builder" (owner, 2026-11-20); the coverage hints (`mezo-r36n9.114`) are slice 2 and build on this slice's *add*.

## 1. Intent and why

The owner wants the block builder built out completely on the phone ("az egész blokképítő részt meg kéne
építeni"). Today *Edzés → Blokk → Blokk szerkesztése* can change set counts, tiers, style and techniques of the
running block, but cannot add, remove, swap or reorder an exercise, nor change a rep range, reserve or starting
weight — those lived in the retired web app. His running block is in week 1 of 6, so changing the running block is
the near need; creating a new block is weeks away and is being worked on by another session (generator /
styles, `mezo-r36n9.115`; plan recommender `mezo-r36n9.113`). He chose: the editor first.

**Success in his terms:** on the Napok page he can make a day his own — add the exercise he wants (Boop suggests
ones that fit the day, his gym and what hurt), drop one, swap one for the rest of the block with the same reasoned
suggestions he knows from the workout, drag them into his order, set rep range / reserve / starting weight —
see the weekly volume follow immediately, and save once.

## 2. Goals, non-goals, anti-goals

**Goals:** add · remove (undoable) · swap for the rest of the block · reorder · edit rep range, target reserve,
starting weight, warm-up sets · an empty day becomes a training day when it gets exercises · one save · the
evaluator's numbers follow every edit as today.

**Non-goals (later slices):** new block from scratch, templates library, closing a block, custom workouts, weekly
schedule; adding / renaming / moving **days** (needs a new server operation, `mezo-5qes`); supersets; per-set
targets; the coverage hints themselves (slice 2).

**Anti-goals:** a second save path or a second evaluator on the phone (the server measures, the phone draws) ·
style silently overwriting what he set by hand · an edit that breaks a workout in progress · a suggestion that
ignores his gym or a strong-pain report · losing a pending weekly-review decision without telling him.

## 3. Prior art (researcher, 2026-11-20)

- **Hevy** (https://www.hevyapp.com/features/workout-plan-generator/) — day editor with drag-to-reorder, a quiet
  "+ Add Exercise", delete, replace showing ~4 suggestions above search, "this session or permanent?". **Adopted:**
  the editor shape, suggestions above search, the drag handle. **Rejected:** per-set targets (not in our model).
- **RP Hypertrophy** (help centre, snippet only — 403) — days hold muscle slots, a slot holds an exercise.
  **Adopted** in spirit: *add* starts from a muscle, not a blank search.
- **Fitbod** (https://fitbod.me/blog/your-gym-profile/) — equipment is a hard filter; admits muscles with no good
  option. **Adopted:** the gym profile filters suggestions; an empty suggestion list says so and shows the full list.
- **JuggernautAI** (https://garagegymreviews.com/juggernautai-review) — swap for a day or the block; thin library
  complaints. **Adopted:** in the builder a swap is for the rest of the block (the player keeps "only today").
- **Jefit Movement Balance** (https://www.jefit.com/blog/the-movement-balance-engine) — pattern ratios with a
  one-line message; relevant to slice 2, not here.

## 4. Codebase terrain (investigator, 2026-11-20)

| Area | Today | Anchor |
|---|---|---|
| Day save | `PUT /api/train/mesocycles/{id}/days/{dayId}/exercises` (`replaceDayExercises`), full list, order = array order; rows carry **no id** — the server matches by identity (catalogue id, else exact name). Same identities in the same order → rows updated in place; any add / remove / reorder / swap → old rows soft-deleted, new ids; history resolves by exercise identity; the volume ledger re-syncs. | `TrainService.java:466-485`, `train.yml:384` |
| Style | On a styled block the server re-stamps sets, rep range, reserve and rest unless the row's `overrides` names the key: `workingSets`, `repRange` (min and max together), `targetRir`, `restSec`. Omitted style fields carry over from the first stored row with the same identity; a swapped-in exercise matches nothing. The evaluator never applies the style — only a save does. A set step already marks `workingSets`. | `StyleStamper.java:20-36`, `ExerciseStyler.java:201-227`, `train.yml:4250`, `BlockDraft.swift:326-330` |
| Workout instances | Created only when a workout starts; logged sets point at the template exercise row. An open workout = instance `active` with `templateSessionId` = the day; `replaceDayExercises` has no guard for it today. The phone knows the open workout from `todayWorkout`. | `WorkoutService.java:713-721`, `TrainService.java:466-495`, `TrainClient.swift:38,171` |
| Swap ranking | `ExerciseSubstituteRanker` (pure; role → discomfort → fit → goal → trackability, #58) behind `getExerciseSubstitutes`, which is keyed by a **running workout instance**. | `ExerciseSubstituteService.java:70-112` |
| Builder (phone) | `BlockBuilderPage` (Izmok · Napok · Blokk), `BuilderDayCard` rows = body mark, name, subtitle, technique chip, set stepper. Draft `BlockDraft`: `DraftExercise.id/.wire` non-optional, init drops id-less rows, `changes()` compares count + per-index, `carryEdits` by id, proposals apply by request index (never sort). Save: settings → tiers → changed days via `PlanClient.saveDay`. Hand-written lenient JSON (`RawJSONClient`), not the generated client. | `ios/Boop/EdzesTerv/BlockBuilderPage.swift:460-600`, `BoopCore/Train/BlockDraft.swift:104-410`, `BlockBuilderModel.swift:157-200`, `PlanClient.swift:36` |
| Preview | `-previewBlokk YES -previewBlokkOpen epito -previewBlokkTab napok`; stub data in Swift dictionaries. | `ios/Boop/EdzesTerv/PlanPreview.swift` |
| His data (counts) | one active block, week 1 of 6, manual weekly review, style set, techniques on; 7 day rows: 6/6/5/6/4/0/0 exercises. | production read 2026-11-20 |

**Traps:** builder ops are not in the iOS generator filter, so the contract gate does not protect them · id
re-minting → always re-read after a save · a pending manual-review line on a re-minted row ends "kept" · the empty
day rows are real template days · builder tests need a per-test timeout (the recursion incident) · `BoopCore/Train/**`
is still listed in the B5 issue's *Owns* (`mezo-r36n9.15`, idle) — written into this issue's build-phase *Owns* after
the plan OK.

## 5. Approaches

| | What | Trade-off |
|---|---|---|
| **A — edit inside the existing Napok page (chosen)** | The day card gains add / remove / swap / reorder / tap-to-edit; the builder's one *Mentés* saves it with everything else; the evaluator follows live. | One place, one save, the numbers he already reads. The draft model needs identity-aware change detection. |
| B — a separate day-editor screen | Its own page and save per day. | Two saves for one plan, and the volume gauge lives elsewhere. Rejected. |
| C — the player's mid-workout swap with "Minden hétre" only | Already exists for swaps. | No add / remove / reorder / fields. Not the ask. |

Suggestions for *add* and *swap* come from the server (the ranker), as in the workout — one rule set, not a phone copy.

## 6. The design

### 6.1 What he sees (the Napok day card)

```
  HÉTFŐ · ~62 perc
  ≡  Chest Supported Row          8–10 · 1 tartalék      [– 3 +]   ⋯
  ≡  Lat Pulldown · Neutral      10–12 · 1 tartalék      [– 3 +]   ⋯
  ≡  Cable Fly                   12–15 · 1 tartalék      [– 2 +]   ⋯
  ＋ Gyakorlat hozzáadása
```

- **≡ drag handle** reorders within the day.
- **⋯ menu:** *Csere* · *Beállítások* (the same as tapping the row) · *Törlés*.
- **Tap a row → its settings sheet:** rep range (two steppers, min ≤ max, 1–30), target reserve (0–4), starting
  weight (optional, kg, 0.5 steps), warm-up sets (0–4). A field he changes is marked as his with the server's own
  key — rep range → `repRange`, reserve → `targetRir` (sets already → `workingSets`); starting weight and warm-ups
  are never style-stamped. The sheet says so in one line — *„Ezt te állítottad; az edzésmód nem írja felül.”* —
  and *Visszaállítom az edzésmódra* clears **all** of the row's keys at once (one button, not one per field).
- **Delete** removes the row at once with an undo line (*„Cable Fly törölve · visszavonom”*).
- **＋ Gyakorlat hozzáadása** opens the add sheet (§6.2); a new row lands at the end of the day with the style's
  prescription for it **as returned by the server with the suggestion** (§6.3; 3 × 8–12 · 2 tartalék on an unstyled
  block or for a row picked from the full list without one), so the weekly numbers are right before saving.
- **An empty day** shows *„Pihenőnap — ha gyakorlatot teszel rá, edzésnap lesz.”* above the add row.
- The set stepper, technique chip, per-muscle chips and warnings stay exactly as today.
- **Mentés** (the builder's one main button) is on whenever anything changed, as today.

### 6.2 Add and swap sheets

Both are the Napkelte sheet the player's swap uses (two-step: suggestions, then the full searchable list with the
quiet *nincs hozzá eszközöd* / *legutóbb fájt* labels), with these differences:

- **Swap** (from ⋯): title *„Mire cseréljük a blokk végéig?”*; suggestions = the ranker with the row as outgoing
  exercise. The chips *ehhez nincs eszközöm* / *nem esik jól* are **not** shown here (they belong to the
  workout); the gym profile and discomfort history still filter and order. The replacement keeps the row's
  technique and its overridden values (the phone re-sends `overrides`, per-exercise style and rest explicitly —
  the server would not carry them to a new identity); every other prescription field comes from the suggestion.
- **Add** (from ＋): first a row of muscle chips — the evaluator's coarse groups (the ones with bands) — muscles **under their band this week** first (from the evaluator,
  labelled *kevés*), then the muscles this day already trains, then *Más izom* opening all; picking a muscle shows
  up to five suggestions for it with a reason each, then the full list filtered to that muscle.
- Both exclude exercises already on this day of the draft. Offline: no suggestions, a one-line note, the full
  cached list still works (saving needs a connection anyway).

### 6.3 Server — one read for the builder's suggestions

`POST /api/train/mesocycles/{id}/exercise-suggestions` (name the builder's; contract-first in `train.yml`):

```
request:  { mode: "replace" | "add",
            outgoing?: { catalogId?, name, muscle, type },     // replace
            muscle?: string,                                    // add
            dayCatalogIds: uuid[] }                             // the draft day's current exercises
response: the substitutes response shape (suggestions with exercise, reasonText, signals, lastTopSet; labels)
```

- A new service entry point (the workout one is wired to a running instance): the block's goal preset, his gym
  availability, discomfort history; **today's check-in pain only when the edited day is today's weekday**, otherwise
  none. Request gains `dayIndex`.
- Each suggestion also carries the **style prescription** for this block (`workingSets`, `repMin`, `repMax`,
  `targetRIR`, `restSec`, computed read-only with the existing stamper; null on an unstyled block).
- `replace` = exactly the ranker the workout uses; `inWorkout` = `dayCatalogIds`.
- `add` = the same ranker fed a synthetic outgoing exercise `{muscle, type: compound if the day has no compound
  for that muscle else isolation, pattern: null, joints: []}`, so role / discomfort / goal / trackability apply
  unchanged; candidates are **strictly** the catalogue rows whose coarse group is the chosen one (no region
  widening); a new signal **`UNDER_BAND`** (phrase *„ezen a héten kevés jut erre az izomra”*) is chosen as the
  second signal when the muscle is below its band. The reason guard (no digits, no „legjobb”, no names) applies.
- Read-only, no persistence. 404 for a foreign block, 409 for an archived one.

### 6.4 Saving

- The draft becomes identity-aware on the phone: every row has a stable local key (the server id for loaded rows,
  a placeholder for new ones); the wire carries no id — the server matches by catalogue id / name. `changes()`
  detects add / remove / reorder / swap / field edits per day by that key; each changed day is sent once with
  `replaceDayExercises` in the existing save order; then the block is re-read and the editor shows the fresh rows.
- **A workout of that day in progress** (started, not finished — known from today's workout): that day's card is
  read-only with *„Ezen a napon most fut az edzésed — utána szerkesztheted.”* **And the server refuses** a
  structural `replaceDayExercises` (identities or order changed) with 409 while an `active` instance points at
  that day — a stale phone or a queued offline start must not soft-delete rows that logged sets point at. A
  same-order save stays allowed.
- **A weekly proposal waiting for his approval** whose lines touch a day he changed structurally (known from the
  week review the builder already loaded — the check never triggers generating a proposal; if none is loaded,
  no prompt): before saving,
  one confirmation — *„A heti javaslatban ennél a napnál függő döntés van; a módosított gyakorlatoknál a régi
  szám marad. Mentsem így?”* — *Mentem* / *Előbb átnézem*.
- Edits apply from the next workout on; nothing already logged changes.

### 6.5 States

Loading / failed / offline exactly as the builder today (last numbers kept, „frissül…”); suggestion fetch failure
→ the full list with *„Most nem érem el az ajánlásokat — a teljes listából választhatsz.”*; save failure → the
existing quiet error row, draft kept. Smallest iPhone width: the row's fields wrap under the name; reduced motion:
no drag lift animation, rows still move.

## 7. Order and gates

Spec OK → **simulator spike** of the day card (handle, ⋯ menu, settings sheet, add sheet with muscle chips,
undo line, empty day, in-progress lock, pending-review confirm) on a throwaway branch, owner OK → plan with
*Kész, ha…* → build (server read first, then BoopCore draft, then screens) → gates → review → merge → deploy →
install on the phone → live check → handbook (`07-edzes/16-blokk-epito.md` flips its *Mi marad ki*, `02` is
corrected) → Notion.

## 8. Left to the builder

Endpoint and field names; the placeholder-id scheme; drag implementation; exact layout within the Napkelte kit;
whether the settings sheet uses steppers or wheels (spike decides); the weight step on the phone for kettlebells.

## 9. Constraints and coordination

- `mezo-r36n9.115` owns `MesoPlanGeneratorService`, `StyleTable`, `WeeklySignalReader`, the style block of
  `application.yml`, `train.md` §4/§9 — not touched. `StyleStamper` is only read.
- Shared hot spots, one writer at a time: `train.yml` / `api/openapi.yml`, the iOS contract gate config.
- Privacy: no real values in tests, docs, handbook or Notion; examples invented and marked „például”.
