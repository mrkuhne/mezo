# Fuel — Manual pantry add: fixed per-100 g macro basis — design

**Date:** 2026-07-23 · **bd:** `mezo-0gjr` · **Root cause this prevents:** `mezo-y9ga`
(recipe factor = `amount / serving_amount`; the form let the user set a portion size as the
macro BASIS, over-scaling recipes by `100/serving_amount`) ·
**Siblings:** [photo import](2026-07-23-pantry-photo-import-design.md) (AI-filled items already
hard-set per-100 g server-side — this closes the MANUAL entry hole)

## Goal

Make the macro-basis mistake structurally impossible on the manual Kamra add/edit form: macros
are entered exactly as the label prints them (per-100 g), the basis is no longer an input.

## Decisions (settled in brainstorm, 2026-07-23)

| Decision | Choice | Why |
|---|---|---|
| Basis input | **removed** — the "Adag" (per + unit) field is deleted from `AddPantryItemSheet` for every kind | the user chose hard-lock over an advanced toggle or relabeling; the label's per-100 g column is what gets typed in |
| Section titles | "Makrók **· /100 g**" and "Tápanyag **· /100 g**" | the fiber/sugar/salt/saturated-fat facts are per-100 g in the DB too |
| Create payload | always `per: 100, unit: 'g'` (explicit) | a null `serving_amount` would re-open the `per ?? 1` recipe-math trap |
| Edit payload | ~~`per`/`unit` omitted entirely~~ → **edit ECHOES the stored basis** (`per: initial?.per ?? 100, unit: initial?.unit ?? 'g'`) | **Implementation deviation (2026-07-23):** omitting would 400 — `PantryService.validatePerKind` runs on the UPDATE request too (food requires `unit`+`kcal`; a gram-based dose-less supplement requires `per` — mezo-2567). Echoing the value `inputFromItem` hands back is a no-op merge, so the intentional per-serving legacy row (`Iso Whey Nutriversum Vanilla`, per=30) still survives edits; a null-basis edge normalizes to 100/g, which is desirable |
| Legacy-basis honesty | edit mode shows a read-only hint "Bázis: /{per} {unit} · örökölt" when `initial.per` ≠ 100 | editing the Vanilla whey must not be misleading |
| Backend / contract | **unchanged** | `PantryItemRequest.per` is already optional; partial-merge semantics already correct |
| Data migration | none | prod was normalized this morning (mezo-y9ga) |
| Import/photo paths | untouched | both already pin per-100 (OFF `PER_BASIS`, photo server-side hard-set) |

## Scope

- `frontend/src/features/fuel/sheets/AddPantryItemSheet.tsx` — field removal, titles, submit
  payloads, legacy hint.
- `frontend/src/features/fuel/sheets/AddPantryItemSheet.test.tsx` — TDD: create sends
  `per: 100, unit: 'g'`; edit omits both; legacy hint renders when `initial.per` ≠ 100.
- `docs/features/fuel.md` — manual-add sentence updated.

## Out of scope

- An "advanced basis" toggle (explicitly declined).
- Any way to change a legacy item's basis from the form (DB-level correction is the escape hatch).
- Serving-size as a separate product fact (nothing consumes it today — YAGNI).
