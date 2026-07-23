# PR Card Redesign — ExercisesPage record cards (design)

- **Date:** 2026-07-23
- **Status:** validated with visual-companion mockups (variant A chosen out of A–D)
- **Scope:** frontend-only; `frontend/src/features/train/pages/ExercisesPage.tsx` and satellites
- **Driving feedback:** current PR cards are flat and cramped; the detached "▶ Videó" action bar under each card is awkward. Wanted: color, pills, more info, varied type scale, better sectioning.

## Decision summary

Adopt mockup **variant A — muscle-color rail + three-zone card**. The detached
`RowActions` bar is removed entirely; its actions move into the card (video, ⋯)
and into `CatalogExerciseSheet` (delete). No API or backend change — every value
shown already ships in `ExerciseRecordResponse`.

## Card anatomy (RecordRow)

Three vertical zones inside the existing `card` surface, with a 5px muscle-colored
rail on the left edge:

1. **Header row** — rank plaque (26px rounded square, muscle wash bg + deep text,
   mono; only in default top-list state, hidden while searching, same as today's
   `rank=null`), exercise name (display font `--ff-display`, ~17px, weight 700),
   then right-aligned round icon buttons:
   - **▶ play roundel** (30px): muscle-wash colored when the catalog row has a
     `videoUrl`, neutral (`--surface-2` bg, `--text-quaternary` icon) when not.
     Tap → opens `VideoUrlSheet` (attach/replace), `stopPropagation` so the card's
     own tap (record sheet) is not triggered. Rendered for every catalog-linked row
     (ownership-free video endpoint, unchanged).
   - **⋯ roundel** (26px, neutral) — only for `editable` (user-authored) rows;
     opens `CatalogExerciseSheet` in edit mode.
2. **Pill row** — pills use the app's mono-label style (`~8.5px`, uppercase):
   - muscle pill: muscle wash bg + deep text (see color map),
   - type pill: neutral (`--surface-2`) for compound/isolation; **plyo gets the
     filled accent pill: `--amber` bg, ink text, "⚡ Plyo"** (the only filled pill
     on the card — plyo is a type, not a muscle; live DB has plyo rows under
     quad/glute/calf/lats),
   - `N alkalom` pill: neutral,
   - `Saját` pill (amber wash `--wash-amber` + `--coral-deep` text): only on
     `editable` rows.
3. **Stat row** — hairline-separated 3-cell strip; 7.5px mono uppercase labels over
   15px mono bold values:
   - **weighted** (`bestSet?.weightKg != null`): `Legjobb szett` (`60×10`) ·
     `e1RM` (`80 kg`, `--coral-deep`) · `Összvolumen` (`4.2 t`),
   - **bodyweight / no weight** : `Max rep` · `Összes rep` · `Szettek`.
     `Max rep` = max reps across `repRecords` (fallback `recentTopSets`, else `—`).
   - e1RM missing on a weighted row → `—` in the e1RM cell.
   - Volume format: `totalVolume >= 1000` → one-decimal tonnes (`4.2 t`), else
     whole kg (`860 kg`); `0` never happens on the weighted branch.

## Muscle color map

New pure-logic module `frontend/src/features/train/logic/muscleColors.ts`
mapping muscle key → `{ rail, wash, deep }` CSS custom-property references
(existing tokens only, both themes already defined):

| Family | Tokens (rail / wash / text) | Muscles |
|---|---|---|
| Korall | `--coral` / `--wash-gym` / `--tag-gym` | `chest` |
| Kék | `--sky` / `--wash-run` / `--tag-run` | `back-mid`, `lats`, `traps`, legacy `back` |
| Levendula | `--lav` / `--wash-lav` / `--lav-deep` | `shoulder`, `rear-delt` |
| Rózsa | `--rose` / `--wash-sport` / `--tag-sport` | `biceps`, `triceps` |
| Zsálya | `--sage` / `--wash-sage` / `--sage-deep` | `quad`, `ham`, `glute`, `calf` |
| Borostyán | `--amber` / `--wash-amber` / `--amber-deep` | `core` |
| (fallback) | `--text-tertiary` / `--surface-2` / `--text-secondary` | unknown keys |

Live-DB check (2026-07-23, prod `exercise_catalog`): exactly 13 muscle values
exist (`ck_exercise_catalog_muscle`); plain `back` is legacy-only in
`MUSCLE_LABELS`, kept as a mapped fallback.

## Ghost rows (catalog hits without a record)

Same anatomy, ghost treatment: transparent bg + dashed `--border-strong` frame at
~0.85 opacity, muscle rail at reduced opacity, no rank plaque, name at 15px in
`--text-secondary`. Pills: muscle pill (colored) + `Még nincs rekord` (neutral).
The STIM meter moves next to the header's right edge (label + 5 ticks, sage).
Play roundel and ⋯ behave exactly as on record rows.

## Removed / relocated

- **`RowActions` component is deleted** (both usages: record + ghost).
- **Delete** moves into `CatalogExerciseSheet` edit mode as a secondary
  destructive action (`Törlés`, `--warning` text button + confirm step), calling
  the existing `deleteCatalogExercise`.
- Edit pencil → the ⋯ roundel (opens the same sheet).

## Non-goals

- No backend/API/contract change.
- `ExerciseRecordSheet`, `VideoUrlSheet` internals unchanged.
- Search, muscle filter chips, ranking order, skeleton *logic* unchanged —
  `ExercisesSkeleton` only gets its block shapes re-measured to the new card.

## Touched files (expected)

- `features/train/pages/ExercisesPage.tsx` — RecordRow/GhostRow rewrite, RowActions removal
- `features/train/logic/muscleColors.ts` (+ colocated test) — new
- `features/train/sheets/CatalogExerciseSheet.tsx` — add Törlés (edit mode only)
- `features/train/pages/ExercisesSkeleton.tsx` — shape sync
- `features/train/pages/ExercisesPage.test.tsx`, `sheets/CatalogExerciseSheet.test.tsx` — updated
- `docs/features/train.md` — Gyakorlatok section update (same change)

## Testing

Existing integration-style component tests updated for: play roundel per-row (colored
vs neutral), ⋯ only on editable rows, delete via sheet, plyo filled pill, stat-row
weighted vs bodyweight branch, ghost row pills. Gate: `pnpm build && pnpm test`
in both modes (real + `VITE_USE_MOCK=true`).
