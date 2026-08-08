# Exercise demo stills — the remaining four surfaces (design spec)

- **Date:** 2026-08-08 · **bd:** `mezo-8xdl.4` (epic `mezo-8xdl`) · **Domain:** Train
- **Depends on:** `mezo-8xdl.1` (columns + contract + media resolver), `.2` (248 vendored frames), `.3` (`ExerciseImage` + the record-sheet hero)
- **Mockup:** [`2026-08-08-exercise-image-surfaces-mockup.html`](2026-08-08-exercise-image-surfaces-mockup.html) — real tokens, real classes, real vendored images
- **Living docs to update on ship:** [`train.md`](../../features/train.md) §2/§10
- **Design references (mandatory):** `frontend_conventions.md` · the DS doc + `2026-08-04-ds-migration-handover.md` §5

## 1. Goal

`ExerciseImage` ships and works, but it is wired in **exactly one place** — the record sheet.
124 of 161 catalog rows carry frames nobody sees. This slice puts them on the four surfaces
where "what is this movement?" is actually asked.

**Why now, rather than inside each page's DS bead (the original plan).** The deferral assumed the
UI would have to be written twice. Measured, it does not: two surfaces need ~5 lines each, and the
other two need two fields threaded through one mapping. The *wiring* survives a DS re-skin; only the
chrome around the thumbnail gets re-tuned when `6.14`/`6.17` rewrite those files. Against that, the
images stay invisible for another twelve beads. **`6.7` already shipped without its thumbnails** —
the plan's first assignment silently missed, which is the evidence that "we'll pick it up in the
page bead" is not a reliable carrier.

## 2. Decisions

| # | Decision | Choice + rationale |
|---|---|---|
| D1 | Catalog card placement | **The thumbnail takes the rank plaque's slot; the rank moves into the name line as `#1`** (mockup variant A). The rank and the image both want the same leading column; as a `#1` prefix the rank loses nothing, whereas keeping both indents every name by 44 px. |
| D2 | Picker row | Thumbnail leads the row, **the STIM meter stays**. This is where the image earns the most — 20+ rows of scrolling during meso building, where a picture beats a name. |
| D3 | Prep card | Thumbnail before the name, same 44 px rhythm as the catalog. Prep is the one surface read *before* training, at rest. |
| D4 | Active workout | **No image by default.** A `⛶ Kép` chip beside the existing `▶ Demo`, tap-to-reveal, same idiom as the video. Mid-set the screen belongs to logging. |
| D5 | Imageless rows | The existing muscle-wash fallback tile (initial letter). Already in `ExerciseImage`; 37 rows need it, and a ragged left edge is worse than a plain tile. |
| D6 | Mock seeds | **Seed image paths onto a few mock catalog entries.** Without them mock mode — and the visual goldens — show only fallback tiles, so the thing being shipped cannot be verified. The paths point at the same vendored files real mode uses. |

## 3. What changes

**Data (2 edits).** `TodayExercise`-side FE type ([`types.ts:842`](../../../frontend/src/data/types.ts)) gains
`imageStartUrl`/`imageEndUrl` beside its existing `videoUrl`; the workout-exercise mapping
([`trainHooks.ts:80`](../../../frontend/src/data/train/trainHooks.ts)) passes them through. The catalog
side (`ExerciseLibraryItem` + `toLibraryItem`) already carries them from `.3`.

**Surfaces (4).**

| File | Change |
|---|---|
| `pages/ExercisesPage.tsx` | `RecordRow`/`GhostRow` head: `<ExerciseImage variant="thumb">` in the rank slot, rank as a `#n` prefix |
| `sheets/ExercisePickerSheet.tsx` | thumbnail leads the row button |
| `components/PrepExerciseCard.tsx` | thumbnail before the name block |
| `pages/ActiveWorkoutPage.tsx` | `⛶ Kép` toggle beside `▶ Demo`, revealing the `hero` variant |

**No new component, no new CSS class** — `ExerciseImage` and `.exdemo*` cover all four.

## 4. Testing

Per surface: the image renders when the row has one, and the fallback tile (never a broken box)
when it does not. The active workout additionally asserts the image is **absent until the chip is
tapped**. Both modes green; `train-session` is a visual-golden screen, so its goldens are
re-baselined on both platforms — which also clears the pre-existing darwin drift on that screen,
legitimately, since this change is the first to touch it.

## 5. Out of scope

No new image sources, no upload, no backfill for the 37 unmapped rows, and no restyling of the four
surfaces beyond what inserting the thumbnail requires — `6.14`/`6.17` own their DS migration.
