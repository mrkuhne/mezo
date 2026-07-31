# Recept-hozzávalók mennyiségének felülírása logoláskor (`meal_item.recipe_overrides`)

- **Date:** 2026-07-30
- **Driving issue:** mezo-ormb
- **Status:** design approved (implementation pending)
- **Related:** mezo-lns (recipe + recipe_ingredient), mezo-arb (meal + meal_item), mezo-78rn (estimate arm — the precedent for a third `meal_item` shape), mezo-8xy (the single-round rule this design must not break), mezo-xv3l (dead `RecipeIngredientList`/`Row` — surfaced here, deliberately NOT part of this change)
- **New ADR:** no. This extends an existing arm rather than setting a new direction; the freeze-the-macros / keep-a-live-link philosophy is unchanged.

## 1. Context & problem

Logging a recipe today produces **one flat `meal_item`**: `source='recipe'`, `recipeId`, `amount` in `adag`, `snapshotPer=1`, `snapshotBasisUnit='adag'`, and `snapshot{Kcal,ProteinG,CarbsG,FatG}` = the whole-recipe rollup ÷ `servings` (`MealService.buildItem()`:308-321). The ingredient list is never copied into the meal.

That is a good design for provenance, but it assumes **the recipe was executed exactly as written**. Reality does not cooperate:

- *"a banán fele akkora, mint amivel a receptet készítettem"* — the same nominal ingredient, materially different mass;
- *"ma kimaradt a mandulavaj"* — a line that simply did not go in.

Today the only lever is the `adag` stepper, which scales **everything** uniformly and is integer-only in the UI (`LogMealSheet.tsx:94,127`). There is no way to say "this one ingredient was different". The consequence is not cosmetic: the logged kcal/macros are wrong, and because `MealService.recipeFacts()` (`:236`) walks the **live recipe lines** to derive fiber/sugar/salt/saturated-fat, the frozen **mezo score** is wrong too — it scores the recipe as written, not the meal as eaten.

## 2. Decision summary

Agreed with the owner during brainstorming:

1. **Editing happens in the recipe's own unit, with decimals** — banán `1 db` → `0,5 db`, zab `60 g` → `47 g`. No gram-equivalence field is added to `pantry_item`; converting `db` → `g` would require backfilling every piece-based item and is not worth it. (~90% of pantry rows are already `g`-based.)
2. **Inline expansion, collapsed by default** (mockup option A). The recipe card in `LogMealSheet` grows a `HOZZÁVALÓK · N` bar that expands in place. The one-tap fast path is untouched. Rejected: a nested sub-sheet (sheet-in-a-sheet on mobile) and exploding the recipe into standalone pantry lines (destroys the recipe as a unit in the log).
3. **The numbers mean "the whole recipe, as I made it"** — not "my portion". For a `servings=2` recipe the list shows whole-recipe amounts, and the `adag` stepper stays beside it. The two controls stay orthogonal: *how I made it* × *how much of it I ate*. For `servings=1` (the common case) the two readings coincide.
4. **Storage: one nullable `jsonb` column on `meal_item`**, holding only the changed lines. One `meal_item` per recipe is preserved.
5. **The frozen snapshot is computed from the overridden set** — macros, `Facts`, and `snapshotNova` alike. A later recipe edit never rewrites history, exactly as today.
6. **`0` is a legal override** (= "this line was left out"). The recipe's own `ck_recipe_ingredient_amount check (amount > 0)` is untouched — this is a different column.

## 3. Data model

### 3.1 The override key — why `lineOrder` + `pantryItemId`, not either alone

`recipe_ingredient` has **no unique constraint on `(recipe_id, pantry_item_id)`** (`202606231400_mezo-lns_create_recipe.sql:35-58`), and that is legitimate: a recipe may list the same pantry item twice ("olívaolaj a serpenyőbe", "olívaolaj a tetejére"). So **`pantryItemId` alone is an ambiguous key**.

`lineOrder` alone disambiguates but is *positional*: if the recipe is reordered between the moment the frontend loaded it and the moment the meal is saved, both indices stay valid and the override would silently land on the **wrong ingredient** — a data-corruption failure mode with no error.

Therefore the request carries **both**, and the server treats `pantryItemId` as a **consistency check**: it resolves `lines.get(lineOrder)` and rejects the request if that line's `pantryItemId` differs. Reordering, deletion, and substitution are all detected and 400'd instead of silently mis-applied. No new id is introduced anywhere — neither in the contract nor in the frontend `RecipeIngredientLine` type nor in the mock seed.

### 3.2 The column

New nullable `jsonb` column on `meal_item`, mapped with `@JdbcTypeCode(SqlTypes.JSON)` onto a typed record list (house rule: jsonb is first-class, never `String`):

```
meal_item.recipe_overrides  jsonb  null
```

```json
[
  { "lineOrder": 1, "pantryItemId": "…", "name": "Banán",
    "unit": "db", "originalAmount": 1, "amount": 0.5 }
]
```

Only genuinely changed lines are stored (a delta, not the full list). `null` — not `[]` — is the canonical "nothing was overridden" value, so **every existing row and every existing test is untouched**.

`name`, `unit` and `originalAmount` are denormalised into the envelope on purpose: they make the row **self-describing**, so the log can render *"Banán ~~1 db~~ → 0,5 db"* without resolving the live recipe — which may since have dropped that line entirely. This mirrors the existing `snapshot*` philosophy and costs a few dozen bytes.

**Liquibase:** `202607301200_mezo-ormb_meal_item_recipe_overrides.sql`, additive `alter table meal_item add column`. No constraint beyond the column itself — the shape is validated in Java, and an empty/absent array is indistinguishable from "no overrides" by design.

## 4. API contract (contract-first — edit `api/feature/meal/meal.yml` first)

`MealItemRequest` gains one optional array; nothing existing changes:

```yaml
ingredientOverrides:
  type: array
  nullable: true
  items:
    type: object
    required: [lineOrder, pantryItemId, amount]
    properties:
      lineOrder:    { type: integer, minimum: 0 }
      pantryItemId: { type: string, format: uuid }
      amount:       { type: number, minimum: 0 }   # 0 == "left it out"
```

Note `minimum: 0` (inclusive) — deliberately unlike the sibling `amount` fields, which are `exclusiveMinimum: 0`.

`MealItemResponse` gains the resolved, self-describing form (`lineOrder`, `pantryItemId`, `name`, `unit`, `originalAmount`, `amount`) so the meal detail can explain what was adjusted, and so the payload round-trips through `updateMeal`.

Regenerate in the usual order: `cd api/generate && npm run generate:api`, then `cd frontend && pnpm generate:api`; backend Java models regenerate under `generate-sources`.

## 5. Backend computation

All three derived values must consume the same override map, or they disagree with each other.

**Override resolution** (new, in `MealService`): build `Map<Integer, BigDecimal>` from `lineOrder` → `amount`, after validating each entry against the resolved recipe. Any of these is a `400` — `SystemMessage.field("VALIDATION_INVALID_VALUE", "items")`, reusing the existing invalid-items path, never a silent skip:
- `lineOrder` out of range for the recipe's line list;
- `pantryItemId` not matching the line at that `lineOrder`;
- duplicate `lineOrder` entries;
- `amount < 0`;
- `ingredientOverrides` present on a non-`recipe` arm.

**1. Macro rollup.** `buildItem()`'s recipe arm currently takes the mapper's whole-recipe rollup wholesale. It must instead sum the same per-line rule with overridden amounts:

```
lineContribution = round(snapshot_macro × effectiveAmount / snapshotPer)   // HALF_UP, per line
wholeRollup      = Σ lineContribution
snapshot_macro   = perServing(wholeRollup, servings)                       // scale 6, UNROUNDED
```

The **round-per-line-then-sum** order is `RecipeMapper.contribution()` + `rollup()` verbatim, and the deliberately-unrounded `perServing` is the mezo-8xy single-round rule. Both must be preserved exactly — the safe implementation is to *reuse* the mapper's per-line helper with a substituted amount rather than to re-derive the arithmetic.

**2. `recipeFacts()`** (`:236`) gains the same map and applies `effectiveAmount` where it reads `line.getAmount()`. Everything downstream (the `× servingsLogged / servings` multiplier, the honest-coverage `any` flag) is unchanged.

**3. `snapshotNova`.** Today the recipe's precomputed `novaDominant` (max source NOVA over all lines, `RecipeService.deriveNovaDominant()`:233) is copied in. With overrides that is wrong in a specific, plausible case: **zero out the single highest-NOVA ingredient and the frozen NOVA still claims it.** But recomputing on *any* override is itself wrong — a non-zero amount change leaves the ingredient set intact, so recomputing there would swap the recipe's frozen `novaDominant` for a live pantry read on an unrelated edit (and a since-deleted pantry row would silently lower the meal's NOVA). So the recipe arm must recompute the dominant NOVA only when a line was dropped to `0`, over the remaining lines whose *effective* amount is `> 0`, reading `PantryItemEntity.nova` via a dedicated `findAllById` — a separate query from `recipeFacts()`/`applyScore`, not a free read. Absent a dropped line, keep using `recipe.novaDominant` so the existing path stays bit-identical.

**Not affected:** `RecipeBreakdownService` and `recipe.breakdown` — that cache scores the recipe *as a template*, not this meal. No invalidation.

## 6. Frontend

**`LogMealSheet` recipe line** (`frontend/src/features/fuel/sheets/LogMealSheet.tsx`) — the `DraftLine` type grows `overrides?: Record<number, number>` (`lineOrder` → amount), populated only for `source: 'recipe'`.

- Collapsed by default: a `HOZZÁVALÓK · N` bar with a `finomhangolás ▾` affordance under the macro cells. When `servings > 1`, a quiet clarifier: *"a teljes recepthez (N adag)"*.
- Expanded: one row per ingredient — name, amount control, live per-line kcal.
- **Precision.** The `±` stepper alone cannot express "47 g", which is the literal ask. The number is therefore **tap-to-edit** (numeric keyboard, decimal comma); `±` remains for quick nudges with `g`/`ml` → ±10 (matching the existing pantry stepper) and every other unit → ±0.5. Floor `0`, no ceiling.
- Changed rows: highlighted, `MÓD` chip, original struck through, per-row revert; an `Alaphelyzet` control resets the whole list. The card header shows the live macros with the untouched original beside them.
- The `adag` stepper is **not** touched by this change.

**Macro parity.** The live numbers in the sheet must be computed with the *same* rule the backend freezes with, or the sheet shows one number and the log stores another. `frontend/src/data/fuel/recipeMacros.ts` already encodes round-per-line-then-sum (`lineContribution`, `computeRecipeMacros`); the sheet's `lineMeta()` recipe arm must be re-expressed on top of it with overridden amounts instead of keeping its own inlined formula.

**Mock mode** mutates its own cache and must apply overrides identically, so both modes agree.

## 7. Out of scope (explicitly)

- The `AiLogSheet` AI-estimate arm.
- Offering *"save this back into the recipe?"*.
- Editing an already-logged meal — there is no UI for it today (`updateMeal` exists in `fuelHooks.ts:106` but nothing calls it). The contract is nonetheless designed to round-trip so this is a UI-only follow-up.
- Reviving `RecipeIngredientList`/`RecipeIngredientRow` — dead code carrying a retired formula; tracked separately as **mezo-xv3l**.

## 8. Testing

**Backend** (integration-first, `ApiIntegrationTest`, AssertJ, `*Populator` data):

| Case | Assertion |
|---|---|
| Log with **no** overrides | Every persisted value **bit-identical** to today — the regression guard for the whole change |
| Override one line | `snapshot*` reflect the overridden set; `recipe_overrides` holds exactly one entry, self-describing |
| Override to `0` | Line drops out of the rollup **and** `Facts` **and** the NOVA max |
| Zeroing the top-NOVA line | `snapshotNova` falls back to the next-highest, not the recipe's stored `novaDominant` |
| `lineOrder` out of range | 400 `VALIDATION_INVALID_VALUE` on `items` |
| `pantryItemId` mismatched at that `lineOrder` | 400 — the reorder/substitution guard |
| Duplicate `lineOrder` | 400 |
| Overrides on a `pantry`/`estimate` item | 400 |
| Recipe listing the same pantry item twice | Only the addressed `lineOrder` changes |
| `servings > 1` | Override applies to the whole recipe, then `÷ servings × adag` |
| Recipe edited afterwards | The old meal's macros and score are unchanged |
| Round-trip via `updateMeal` | Overrides survive |

Populators need a recipe fixture with a piece-based (`db`) line and a duplicated pantry item. New aggregate/table? No new table — `meal_item` is already in the `ResetDatabase` TRUNCATE list.

**Frontend** (both modes — `pnpm test` and `VITE_USE_MOCK=true pnpm test`): expand/collapse; stepper and typed entry incl. decimal and `0`; `Alaphelyzet`; live macros equal the documented backend rule; and — the contract-shape guard — **with no overrides the request body is byte-identical to today's**.

## 9. Risks

- **Rounding divergence.** Round-per-line-then-sum, and `perServing` left unrounded, are load-bearing (mezo-8xy). Re-deriving the arithmetic instead of reusing the existing helpers is the likeliest way to introduce a 1–3 kcal drift between the sheet and the stored meal. Reuse, don't rewrite.
- **Silent mis-application.** Mitigated by the `pantryItemId` consistency check (§3.1); the failure mode is a rejected request, never a wrong number.
- **Sheet length.** A 10-ingredient recipe makes a long modal. Accepted for v1 — collapsed-by-default keeps it out of the common path, and the mockup's option B (separate fine-tuning sheet) remains an easy migration if it proves annoying, since the row component would be reused as-is.
