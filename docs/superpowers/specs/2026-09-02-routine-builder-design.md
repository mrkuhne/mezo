# Rutin-építő — own Én tile, `/me/rutin` page, and a two-framework habit-recipe wizard

**Date:** 2026-09-02 · **Epic:** `mezo-3zue` · **Status:** approved design, prototype published
· **Design round:** [`docs/design_2.0/2026-09-02-rutin-epito-design-iterations.md`](../../design_2.0/2026-09-02-rutin-epito-design-iterations.md)
· **Prototype:** `docs/design_2.0/prototypes/rutin-epito.html` —
https://claude.ai/code/artifact/78c8f0f9-925f-44a9-93b4-3e9cc077e162

## 1. Goal

Move the routine surface out from under the Growth tab into its own place under Én, and give
people a wizard that builds a habit on one of two explicit frameworks:

- **BJ Fogg — Habit Stacking / Tiny Habits:** "After I [anchor], I will [tiny behavior] — and
  log it. To celebrate, I will [shine]."
- **James Clear — Four Laws of Behavior Change:** cue → craving → response → reward; make it
  obvious / attractive / easy / satisfying, with the tracking itself as the satisfying reward.

The existing `habit` domain (`habit_chain` / `habit_def` / `habit_day`) is **extended, not
replaced**: chains stay the stack, defs become recipes, daily ticking on `/nap/rutin` is untouched.

## 2. Decisions (from the brainstorm)

| Question | Decision |
|---|---|
| Model | Extend `habit_def` with nullable framework columns (option A); no new table, no JSONB. |
| Én hub tile | Full-width Rutin tile under the six small tiles (Mezo-hub Diagnózis/Karakter precedent); no 7th small cell. |
| Wizard output | One run = one habit recipe (one `habit_def`) placed into a chain. |
| Frameworks | Chosen on step 1 (two cards); stored on the def as `framework ∈ {FOGG, CLEAR}`; nullable for legacy defs. |
| Scope of `/me/rutin` | Replaces both the Growth "Rutin" segment (`RoutinesTab`) and `/me/routines/edit` (`RoutineEditorPage`); `/nap/rutin` stays. |
| This session's deliverable | Spec + design-iteration doc + prototype + bd slices. Code lands in S2–S4. |

## 3. Information architecture & routes

| Route | Page | Notes |
|---|---|---|
| `/me` | `EnHubPage` | + full-width **Rutin** tile (`wash` gold, `icon="i-rend"`), `delayMs=370`, line from hooks (see §6). |
| `/me/rutin` | `RutinHubPage` (new, `features/me/pages`) | Mozaik page, `tone="gold"`. Hero + statstrip + chain cards + CTAs. Back chip `‹ Én`. |
| `/me/rutin/uj` | `RoutineWizardPage` (new) | Full-screen wizard, 4 steps, `me/goals/new` idiom. `?prefill=<defId>` re-frames a legacy def (§7.6). |
| `/me/rutin/szokas/:id` | `HabitPage` (new) | One habit: framework band, sentence, 28-day strip, fields, pause. |
| `/me/routines/edit` | redirect → `/me/rutin` | Keeps old deep links alive. |
| `/me/growth?tab=routines` | redirect → `/me/rutin` | The `?tab=` union drops `routines`; Growth becomes a 3-segment control (Skillek / Napló / Kitüntetések). |
| `/nap/rutin` | unchanged | The only tick surface. |

Static children are registered before any `:param` sibling (`router.tsx` `/me/*` block idiom).

## 4. Én hub tile

- Markup: seventh `<Tile>` inside the existing `<Mosaic>` with a new `wide` prop (grid-column
  `1 / -1`, row layout: spot left, eyebrow + datum, chevron right) — added to
  `shared/ui/mozaik/index.tsx` as the FE counterpart of the prototype's `.tile.wide`.
- Line: `"{done} / {total} ma · reggel {morningPct}% · este {eveningPct}%"` where `done/total`
  come from `useHabitDay(today)` and the chain percentages are the mean `strengthPct` of the
  `MORNING` / `EVENING` chains' defs from `useHabitSummary` + `useHabitCatalog`. Any missing part
  is omitted; zero defs ⇒ `line={undefined}` (no fabricated number).
- Tests: `EnHubPage.test.tsx` "six tiles" → "six small tiles + one wide tile, each opens its own
  page"; the "no fabricated line" case covers the empty catalog.

## 5. `/me/rutin` hub page

Anatomy (copy prototype values ×1.18):

1. **PageHead** — `‹ Én` back chip; right action `✨ AI javaslat` (opens the existing
   `AiSuggestSheet`; accepting a suggestion navigates to `/me/rutin/uj` with the wizard prefilled
   at step 3 instead of calling `createDef` directly — see §7.5).
2. **PageHero** — clay spot `s-reggel`, big number `done / total` (today), name `Rutin`, sub
   `ma · 28 napos átlagerő {mean strengthPct}%`.
3. **StatStrip** — `perfectMorningDays30` · `perfectEveningDays30` · active def count (all from
   `useHabitSummary` / `useHabitCatalog`; these are the counters `RoutinesTab` shows today).
4. **Chain cards** (one per chain, seed + custom, inactive ones dimmed): head = daypart clay icon
   (`i-hajnal` / `i-nap` / `i-alvas`, never emoji), title, chain strength %, active toggle, `✎`
   (opens `ChainEditSheet`). Rows = `SortableList` of defs: grip · title · framework badge
   (`⚓ FOGG` sage / `◈ CLEAR` lavender / `– RÉGI` neutral) · tick indicator (read-only, from
   `useHabitDay`) · strength bar (`strengthPct`, gold; sage when ticked today) · `%`. Row tap →
   `/me/rutin/szokas/:id`. **No checkable control on this page.**
5. **CTA row** — `＋ Új szokás-recept` → `/me/rutin/uj`; `＋ Új lánc` → `ChainEditSheet` (create).
6. Principle line — *„Egyszerre egy szokás. A logolás maga a jutalom. A pipa a Nap tabon él, itt
   a sor a szerkesztőt nyitja."*

Returning from a successful wizard save highlights the new row (`?new=<defId>` query, cleared
on first render; `.hrow.new` wash from the prototype).

## 6. Wizard `/me/rutin/uj`

Linear 4-step flow (`GoalPlannerPage` idiom: `useState(step)`, per-step `canProceed`,
`EntranceGroup replayKey={step}`, Vissza/Tovább row). Progress = `shared/ui/Stepper.tsx` in dot
mode (its first real consumer); title `Új szokás-recept`, counter `N / 4`. `PageHead onBack`
steps back or exits to `/me/rutin`; a `Mégse` action always exits.

A **sentence card** sits above the form from step 2 on (large on step 4), rendered by the pure
function `routineSentence(draft)` (`features/me/logic/routineSentence.ts`, unit-tested):

- FOGG: `Miután {anchor}, {title} — és logolom. Ünneplésül: {celebration}.`
- CLEAR: `{cue} {title}, mert {craving}. Jutalmam: {reward}.` + ` Hogy olyan ember legyek, aki {identity}.` when identity is set.

Unfilled blanks render as dashed placeholders (`horgony`, `pici tett`, `shine` / `jelzés`,
`tett`, `vágy`, `jutalom`).

| Step | Title (FOGG / CLEAR) | Fields | `canProceed` |
|---|---|---|---|
| 1 | Milyen keretre építsük? | two framework cards (name, 2-line explanation, loop chips, author); tip: start with Fogg when in doubt | `framework != null` |
| 2 | Mihez horgonyzod? / Mi a jelzés? | FOGG: anchor chips (own active defs → `anchorHabitKey`; mezo-event and own-past-anchor chips → `anchorCopy`) or free text → `anchorCopy`. CLEAR: cue chips or free text → `cue`. One tip line per branch. | FOGG: `anchorHabitKey || anchorCopy`; CLEAR: `cue` |
| 3 | Mi a pici tett? / Mi a válasz, és miért vágysz rá? | `title` (80), chain chips (daypart), LIFE skill grid (8 keys from `levelUpMeta.ts`), XP stepper 5–15 (default 10). FOGG: soft warning when title > 6 words or contains a number > 5 (never blocks). CLEAR: `craving` (required), `identity` (optional). | `title` and (FOGG or `craving`) |
| 4 | Hogyan ünnepled? / Mi teszi kielégítővé? | FOGG: celebration chips or free text → `celebration`. CLEAR: reward chips with `a pipa maga` preselected → `reward`. Both: **Vállalom** commitment tick. | branch field set and `committed` |

Save = `useHabitCatalogActions().createDef` with `mode: 'MANUAL'` and the framework fields;
on success navigate to `/me/rutin?new=<id>`. Errors surface inline under the CTA (existing
mutation error idiom). Anchor chips list only the user's **active** defs other than the draft.

## 7. Backend

### 7.1 Migration

`backend/src/main/resources/db/changelog/1.0.0/script/202609021100_mezo-3zue.2_habit_def_framework.sql`
+ changeSet `1.0.0:202609021100_mezo-3zue.2_habit_def_framework` in `1.0.0_master.yml`
(sorts after `202609021000_mezo-06o0.8_...`):

```sql
alter table habit_def
    add column framework        varchar(5),
    add column anchor_habit_key varchar(40),
    add column cue              varchar(160),
    add column craving          varchar(200),
    add column reward           varchar(160),
    add column celebration      varchar(120),
    add column identity         varchar(120),
    add constraint ck_habit_def_framework check (framework is null or framework in ('FOGG', 'CLEAR'));
```

`anchor_copy` (existing, 120) stays and doubles as the Fogg free-text anchor. No backfill: all
existing rows keep `framework = null`.

### 7.2 Entity

`HabitDefEntity` gains the seven fields (constants `FRAMEWORK_FOGG`, `FRAMEWORK_CLEAR`).
`HabitMapper` maps them 1:1. `ResetDatabase` needs no change (same table).

### 7.3 Contract (`api/feature/habit/habit.yml`, `api/base.yml` 0.5.0 → 0.6.0)

- `HabitDefAdmin`: + `framework` (enum `[FOGG, CLEAR]`, nullable), `anchorHabitKey`, `cue`,
  `craving`, `reward`, `celebration`, `identity` (all `nullable: true` strings with the column
  max lengths).
- `HabitDefCreateRequest` and `HabitDefUpdateRequest`: the same seven optional properties
  (update semantics unchanged: omit = keep, explicit `null` = clear where nullable).
- `HabitSuggestion`: + optional `framework`, `celebration`, `craving`, `reward`, `cue` so the AI
  can propose a full recipe; the adapter prompt is updated in the same slice
  (`HabitSuggestLlmAdapter` lives in `feature.companion` — habit must not import it, ADR 0019).
- Regenerate `api/openapi.yml` and `frontend/src/data/_client/api.gen.ts` in the same commit
  (CI contract-drift gate).

### 7.4 Validation (`HabitAdminService`, write-time, alongside the MANUAL ⇔ metric rule)

| Rule | Error (400 via `SystemMessage`) |
|---|---|
| `framework = FOGG` ⇒ (`anchorHabitKey` or `anchorCopy`) present and `celebration` present | `habit.framework.fogg.incomplete` |
| `framework = CLEAR` ⇒ `cue`, `craving`, `reward` present (`identity` optional) | `habit.framework.clear.incomplete` |
| `framework = null` ⇒ all seven framework fields null | `habit.framework.fields-without-framework` |
| `anchorHabitKey` must reference one of the caller's own active, non-deleted defs, and not the def itself | `habit.anchor.invalid` |

Applied on create and on update (the merged state is validated). Framework-agnostic fields
that are not part of the chosen branch are cleared on save (a FOGG def never carries `cue`).

### 7.5 Anchor lifecycle

On `deleteDef(id)` and on `updateDef(id, isActive=false)`, every def of the same user whose
`anchor_habit_key` equals the target's `habit_key` gets `anchor_copy = "kész a " + target.title`
(only when `anchor_copy` is empty) and `anchor_habit_key = null`, in the same transaction. The
recipe sentence therefore never dangles. `HabitAdminApiIT` covers both paths.

### 7.6 Everything else stays

Feature switch `mezo.feature.habit.enabled` gates all of it (no new beans). `HabitService`,
`HabitEvaluator`, `HabitJob`, `habit_day`, XP (`ProgressionService.applyHabit`) untouched.
Seed catalog (`content/habit-catalog.json`) unchanged; seed defs stay `framework = null`.

## 8. Frontend data layer

- `data/types.ts`: `HabitDefInfo` + the seven optional fields; `HabitFramework = 'FOGG' | 'CLEAR'`.
- `data/habit/habitAdminApi.ts`: create/update bodies carry the fields (`satisfies` the generated
  request types). `habitAdminHooks.ts` unchanged in shape.
- `data/habit/habitMock.ts`: `CATALOG_META` / `mockHabitCatalog` get one FOGG def (e.g.
  `morning_light` anchored on `hydrate`) and one CLEAR def (`daily_intention`, which also closes
  the `mezo-2yqm` parity drift); mock `createDef` mirrors the 400 codes of §7.4.
- `features/me/logic/routineSentence.ts` — pure, unit-tested (both branches, blanks, identity
  optional).
- `features/me/logic/habitAnchors.ts` — pure: builds the step-2 chip list from the catalog
  (own active defs) + the static mezo-event copy list + distinct past `anchorCopy` values.

## 9. Removal from Growth & migrations of existing surfaces

- `GrowthPage.tsx`: drop the `routines` segment and `RoutinesTab` import; `?tab=routines` →
  `<Navigate to="/me/rutin" replace />`. `GrowthPage.test.tsx` and `RoutinesTab.test.tsx`
  updated/removed accordingly.
- `RoutineEditorPage.tsx` → renamed/rebuilt as `RutinHubPage.tsx` (keeps `ChainEditSheet`,
  `SortableList`, reorder + toggle behaviour and their tests); `/me/routines/edit` becomes a
  redirect route.
- `HabitEditSheet` stays for chain-level quick edits only until S4 lands `HabitPage`; S4 removes
  it if nothing else consumes it.
- Visual baselines: `/me`, `/me/rutin` (new), `/me/growth` snapshots regenerate
  (`update-visual-baselines.yml`).
- Docs in the same change: `docs/features/habit.md` (§2, §4, §9, §10), `me.md`, `growth.md` §2,
  `today.md` cross-reference; `node scripts/gen-codemap.mjs`.

## 10. Testing

**Backend (S2)** — `HabitAdminApiIT`: FOGG create ok / missing celebration 400 / CLEAR missing
craving 400 / fields without framework 400 / self-anchor 400 / anchor to another user's def 400 /
delete anchor def → dependent def's `anchorCopy` filled, key nulled / deactivate anchor def →
same. `HabitChainDefEntityIT`: new columns round-trip. `HabitAiSuggestApiIT`: suggestion with
framework fields deserialises. ArchUnit + full IT suite on CI (Testcontainers). Local gate:
`-Dtest='Habit*IT,ProgressionHabitIT'`.

**Frontend (S3/S4, both mock modes)** — `routineSentence.test.ts`; `habitAnchors.test.ts`;
`RutinHubPage.test.tsx` (hero/statstrip numbers from stubbed hooks, badge per framework, row →
habit route, no checkbox rendered, `?new=` highlight); `RoutineWizardPage.test.tsx` (step guards
per branch, sentence updates, tiny warning, commit gate, `createDef` payload per branch, prefill
from `?prefill=`); `HabitPage.test.tsx`; `EnHubPage.test.tsx` (wide tile + line + empty state);
`GrowthPage.test.tsx` (three segments, `?tab=routines` redirect); router redirect test for
`/me/routines/edit`. `dualMode.guard.test.ts` keeps enforcing `realEmpty`.

## 11. Slices (bd, all children of `mezo-3zue`)

| Id | Slice | Depends on |
|---|---|---|
| `mezo-3zue.1` | S1 design — this spec, iteration doc, prototype (done in this session) | — |
| `mezo-3zue.2` | S2 backend — migration, contract 0.6.0, entity/mapper, validation, anchor lifecycle, ITs | S1 |
| `mezo-3zue.3` | S3 FE — `RutinHubPage`, wide Én tile, Growth segment + `/me/routines/edit` removal, docs, codemap | S2 (contract types) |
| `mezo-3zue.4` | S4 FE — wizard + `HabitPage`, `routineSentence`, anchors, AI-suggest prefill | S3 |
| `mezo-3zue.5` | S5 tracking-as-reward on `/nap/rutin` — first-tick celebration replay + bar-rise animation | S4 |
| `mezo-3zue.6` | S6 event-bound anchors — ticking the anchor def (or a mezo event) prompts the stacked habit | S4 |

Each slice: own `feat/` branch, self-PR, CI green, `--no-ff` merge (CLAUDE.md flow).

## 12. Out of scope

Whole-chain wizard; streak counters or resets; AI "magic fill" from free text; a Nap surface for
`DAY`-daypart chains (known gap, habit.md §9); retro-logging (`mezo-x9c2`); habit icons
(`mezo-zo1c` — the wizard has no icon step; when zo1c lands it adds one field to step 3).

## 13. Prior art (researcher recon, filtered)

- **Atoms by James Clear** — https://screensdesign.com/showcase/atoms-from-atomic-habits ,
  https://www.dearbuilders.com/p/product-review-james-clears-atoms — *adopted:* one-sentence
  habit statement assembled live, identity "so that I become…" field, pause without losing
  progress; *rejected:* 10-step onboarding, hidden reward/repetition count.
- **Tiny Habits recipe card (BJ Fogg)** — https://tinyhabits.com/recipe/ ,
  https://www.shortform.com/blog/tiny-habits-examples/ — *adopted:* the three-blank card
  "After I ___, I will ___. To celebrate, I will ___", trailing-edge anchor guidance,
  tiny-behavior nudge, celebration chips; *rejected:* nothing structural.
- **Habitify stacking reminders** —
  https://intercom.help/habitify-app/en/articles/6113696-set-habit-stacking-reminders —
  *adopted:* anchor as a reference to an existing habit (`anchorHabitKey`), event binding
  deferred to S6; *rejected:* in-app-only anchors (free text stays).
- **Fabulous** — https://design.google/library/fabulous-motivating-app-engagement ,
  https://www.thebehavioralscientist.com/articles/fabulous-app-product-critique-onboarding —
  *adopted:* the commitment tick and a designed first-completion moment (S5), one habit at a
  time; *rejected:* multi-screen data collection before value, paywall-before-experience.
- **Loop Habit Tracker** — https://github.com/iSoron/uhabits/discussions/689 — *adopted:*
  exponentially-smoothed strength instead of breakable streaks (matches the existing 28-day
  `strengthPct` and ADR 0010); *rejected:* red-X streak resets.

## 14. Codebase terrain (investigator recon, filtered)

- **Affected features:** `habit` (BE + contract + FE-data), `me` (Én hub, Growth page, routine
  editor + sheets), `growth` doc, `today` (tick surface — read-only dependency), `progression`
  (HABIT XP source, unchanged).
- **Key files:** `HabitDefEntity.java`, `HabitAdminService.java` (write-time invariants),
  `HabitController`/`HabitApi`, `api/feature/habit/habit.yml`, `1.0.0_master.yml`;
  `frontend/src/data/habit/{habitAdminApi,habitAdminHooks,habitMock}.ts`, `data/types.ts`,
  `features/me/pages/{EnHubPage,GrowthPage,RoutineEditorPage,GoalPlannerPage}.tsx`,
  `features/me/components/RoutinesTab.tsx`, `features/me/sheets/{ChainEditSheet,HabitEditSheet,AiSuggestSheet}.tsx`,
  `shared/ui/{Stepper,SortableList}.tsx`, `shared/ui/mozaik/index.tsx`, `app/router.tsx` `/me/*` block.
- **Patterns to follow:** tile → full-page sibling on a stable flat route (ADR 0032); Mozaik
  page anatomy (ADR 0033) with prototype values ×1.18; `GoalPlannerPage` wizard idiom;
  contract-first slice (fragment → `npm run generate:api` → `pnpm generate:api`, both outputs
  committed); dual-mode hooks with `realEmpty` and mock 4xx parity; Liquibase
  `{ts}_{bd-id}_{desc}.sql` + named `ck_` constraint; HU copy inline in JSX.
- **Known traps:** ArchUnit slices (habit must never import `feature.companion`); contract-drift
  and codemap CI gates; `VITE_USE_MOCK` unset = mock (run both modes explicitly); Testcontainers
  for the full BE suite; `HABIT_SWITCH` gating; the Én hub's fixed 3×2 grid (`EnHubPage.test`
  pins six tiles); no second tick control (habit.md §5, mock `check()` double-awards XP);
  `HabitDefUpdateRequest` has no `mode`/`metric`/`skillKey` (immutable after create); seed chains
  undeletable; `DAY` chains have no Nap surface; `RoutinesTab` still carries an emoji daypart
  map — do not copy it (ADR 0033 retired emoji).
