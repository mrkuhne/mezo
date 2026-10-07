# Saját edzés composer — Üveg port (mezo-7ugb5)

**Date:** 2026-10-01 · **Driver:** `mezo-7ugb5` · **Domain:** Edzés (Mai tab owns `/train/custom`)
**Living prototype:** `docs/design_2.0/prototypes/elo/edzes.html` → `#sajat`, `#sajat/uj`, `#sajat/betolt`, `#sajat/nincs`, sheets `custom` + `sjpick`

## Goal

The custom-workout composer (`/train/custom/new`, `/train/custom/:id`) is the last Edzés surface still on the pre-Üveg markup. U5 only recoloured it with CSS (`prototype.css` block "uveg edzes2 sablonok"). Port it to the Üveg kit.

**Owner decisions (2026-10-01):**
1. **Re-skin only.** There are no new features and the data flow stays as it is.
2. **One sanctioned interaction change.** The six always-open recipe steppers per exercise become a **compact summary row that expands in place**:
   - Only one row is open at a time.
   - A freshly added exercise opens automatically.
   - Chosen over a per-exercise bottom sheet.

## Design

- **Page shell**
  - `MozaikPage tone="coral"` + `PageHead glass onBack`.
  - A coral `PageHero` with the `t-dumbbell` art. The eyebrow is "Saját edzés". The title stays "Új saját edzés" / "Saját edzés", plus one lead line.
- **Name**
  - One glass form card holding a flat input.
  - Label "Edzés neve", placeholder "pl. Pihenőnapi felső", `maxLength=120`, the value trimmed on save. Everything is unchanged except the markup.
- **List header**
  - The eyebrow "Gyakorlatok".
  - `{n} gyakorlat · {Σ workingSets} szett`.
- **Collapsed exercise row** (a flat hairline cell, not glass, because forms are not posters)
  - The muscle chip.
  - The name.
  - The summary `{izom} · {w} szett · {lo}–{hi} ism. · RIR {rir} · {kg|auto} kg`.
  - A disclosure chevron, with `aria-expanded`.
  - `ex.warning` shows under the head with `t-bandage` instead of the flat warning glyph.
- **Expanded panel.** The steppers are grouped in pairs:
  - **Szettek:** Bemelegítő 0–10 · Munka 1–10.
  - **Ismétlés:** Tól 1..hi · Ig lo..100.
  - **Nehézség és súly:** Tartalék (RIR) 0–5 · Kiinduló kg. Kiinduló kg is nullable and reads "auto". "+" from auto goes to 20. The step is 2.5. Going below 2.5 returns to auto. The maximum is 999.
  - The volume switch "Számít a heti volumenbe" is a `role="switch"` and replaces the native checkbox.
  - The foot row holds Feljebb (`t-up`), Lejjebb (`t-down`) and Kivesz (`t-trash`). Kivesz is flat and warn-toned, not lit (rule 29).
  - Reorder keeps the drag handle, because `SortableList` is unchanged and shared.
- **Add button**
  - A dashed "Gyakorlat hozzáadása" with `t-addex`.
  - It opens the existing `ExercisePickerSheet`, which is already glass and unchanged.
  - The newly added exercise becomes the open row.
- **CTAs**
  - A ghost "Mentés" (`t-tick`) and a lit coral "Indítás ma" (`t-play`).
  - Their behaviour is unchanged: disabled while the name is empty, there are 0 exercises, or a save is pending. They stay in flow at the end of the page (not sticky), like today.
  - A one-line hint says what is missing: "Adj nevet az edzésnek." or "Adj hozzá legalább egy gyakorlatot.".
- **States**
  - An empty list shows the lead "Még nincs gyakorlat…".
  - **New: a loading ghost and a not-found ghost for `/train/custom/:id`.** Today an unknown id silently shows an empty "new" form, and saving it creates a duplicate. This fixes that trap; the owner hears about it in the hand-off.
- **Entry sheet `CustomWorkoutSheet`** is already glass (U10), and production does not change. The prototype stub is replaced with the real content.

## Parity (reverse list — must survive)

- Back through history, falling back to `/train/gym`.
- The title variants.
- The name field and its limits.
- The counter line.
- Per exercise:
  - name, muscle, warning
  - remove
  - all six steppers with the same ranges and clamps
  - the volume flag (default `countsForVolume`)
  - drag and up/down reorder
- The picker multi-add, including the PLYO scheme for plyo picks.
- The Mentés → `goBack` flow.
- Indítás → save → `/train/session?day={id}`, and plain `/train/session` in mock mode, with `replace`.
- Disabled rules.
- Aria labels that tests use:
  - `{name} törlése`
  - `{name} · <field> csökkentése/növelése`
  - `{name} · számít a volumenbe`

  Hidden steppers must still be reachable, so each row's toggle is labelled.

## Out of scope

- Delete of a whole custom workout: the hook exists but no UI calls it; that belongs to `mezo-z461`.
- The back-fallback target.
- `MesoTemplateEditorPage`.
- Backend and contract changes.

## Prior art

- **Adopted**
  - Hevy's per-exercise single menu and uncluttered cards, applied here as the expand-in-place panel (https://www.hevyapp.com/features/exercise-library/).
  - Apple Watch's validity gate: CTAs stay disabled with a hint until the workout is valid (https://support.apple.com/guide/watch/apd66fcd5c5c).
- **Rejected for this slice (re-skin only)**
  - Strong's "Previous" column and its save-as-template-after-workout flow (https://screensdesign.com/showcase/strong-workout-tracker-gym-log).
  - Fitbod's history-sorted picker and its swipe actions (https://help.fitbod.me/hc/en-us/articles/360006335593-Editing-Workouts-in-Fitbod).
  - Set types.

## Codebase terrain

- **Composer:** `frontend/src/features/train/pages/CustomWorkoutBuilderPage.tsx`. Routes are at `app/router.tsx:363-364`.
- **Row:** `features/train/components/ExerciseRecipeRow.tsx`, used only here, so it is rewritten.
- **Shared, do not restyle globally:** `shared/ui/SortableList.tsx` (MesoEditor and ActiveWorkoutPage use it too) and `.card`.
- **Pattern to copy:** `pages/RunningBlockBuilderPage.tsx`. It has `MozaikPage`, `PageHead glass`, a single `.glass` form card with flat fields, lit primary, and loading and not-found ghosts.
- **CSS:** a new `── uveg saját edzés (mezo-7ugb5)` block in `styles/prototype.css`. The old U5 `.tv-custom` rules (~:20861–20941) and U11's `.tv-custom .eyebrow` (~:30067) are retired.
  - **Traps:**
    - no glass in glass (the regex guards are in `prototypeCssStructure.test.ts`)
    - `overflow-x: clip`
    - chips `min-width: 0`
    - no `--faint` / `--text-disabled` on live copy
    - kit field rules via `:where`
    - never quote a block marker in a comment
- **Tests:**
  - `CustomWorkoutBuilderPage.test.tsx` (5 tests; its step expectations must open the row first).
  - `CustomWorkoutSheet.test.tsx`.
  - Add a `frontend/tests/layout` entry for `/train/custom/new`; none exists today.
- **Docs:** `docs/features/train.md` §Saját edzés (:325, which also fixes the stale entry-point list) and the U10 note (:71).
