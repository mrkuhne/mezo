# Logged-meal Name — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give logged meals a name — capture an editable (smart-defaulted) name at log time, and de-blank existing title-less meals at render — so the Fuel timeline never shows a nameless meal card.

**Architecture:** One pure helper `deriveMealName(names)` (join line names, cap + "…") is used in two places: the `LogMealSheet` name-field default (capture) and the `buildDayPlan` display fallback (render). `SlotCard` gets a defensive `||` so an empty name always falls back to the slot label. Frontend only — `MealInput.title` is already plumbed to the backend, so no backend/API/DB change.

**Tech Stack:** React 19 + Vite + TypeScript, Vitest + Testing Library. Hungarian UI.

**Design spec:** `docs/superpowers/specs/2026-07-27-logged-meal-name-design.md` (mezo-u68c).

## Global Constraints

- **Frontend conventions are MANDATORY:** read `docs/references/frontend_conventions.md` BEFORE writing any `frontend/src` code and follow it exactly (four layers, `*Sheet`/`components`/`logic` placement, deep absolute `@/*` imports — no relative `../`, no barrels except `data/hooks.ts`, colocated tests).
- **Both modes must stay green:** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.
- Pure logic lives in `features/fuel/logic/`; presentational stays in `components/`; the capture surface is the `*Sheet`.
- No backend/API/DB change. `MealInput.title` already exists (`data/types.ts:116`) and is sent by the data layer (`data/fuel/mealApi.ts:123`).
- Git WORKTREE: mezo's bd pre-commit hook auto-stages `.beads/issues.jsonl`. Commit with hooks disabled and append the trailer:
  `git -c core.hooksPath=/dev/null commit -m "<subject>" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`. Stage only the files each task names (never `.beads/` or the stray `fuel-mai-verify-top.png`).

---

## File Structure

- **Create:** `frontend/src/features/fuel/logic/deriveMealName.ts` (+ `deriveMealName.test.ts`) — the pure shared helper.
- **Modify:** `frontend/src/features/fuel/sheets/LogMealSheet.tsx` — editable name field + non-null title on save (+ its test).
- **Modify:** `frontend/src/features/fuel/logic/buildDayPlan.ts` — display-name fallback at the logged-meal sites (+ its test).
- **Modify:** `frontend/src/features/fuel/components/SlotCard.tsx` — `??` → `||` on the title fallback (+ its test).
- **Modify:** `docs/features/fuel.md` — meal-logging behavior note.

---

### Task 1: `deriveMealName` shared helper

**Files:**
- Create: `frontend/src/features/fuel/logic/deriveMealName.ts`
- Test: `frontend/src/features/fuel/logic/deriveMealName.test.ts`

**Interfaces:**
- Produces: `MAX_DERIVED_NAME_LEN: number` and `deriveMealName(names: string[]): string`.

- [ ] **Step 1: Write the failing tests.**

`frontend/src/features/fuel/logic/deriveMealName.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { deriveMealName, MAX_DERIVED_NAME_LEN } from '@/features/fuel/logic/deriveMealName'

describe('deriveMealName', () => {
  it('returns empty string for no names', () => {
    expect(deriveMealName([])).toBe('')
  })

  it('returns a single name unchanged', () => {
    expect(deriveMealName(['Zabpehely'])).toBe('Zabpehely')
  })

  it('returns a single recipe name unchanged (recipe log case)', () => {
    expect(deriveMealName(['PB Banana Toast Pre-workout'])).toBe('PB Banana Toast Pre-workout')
  })

  it('joins several short names with a comma', () => {
    expect(deriveMealName(['Alma', 'Banán'])).toBe('Alma, Banán')
  })

  it('filters out empty/whitespace names', () => {
    expect(deriveMealName(['', '  ', 'Alma'])).toBe('Alma')
  })

  it('truncates with an ellipsis when names overflow the cap', () => {
    const out = deriveMealName([
      'Mili Laktózmentes natúr joghurt',
      'Cocoa Granola Hesters Life',
      'Pudding High Protein Chocolate',
      'Őszibarack',
    ])
    expect(out.startsWith('Mili Laktózmentes natúr joghurt')).toBe(true)
    expect(out.endsWith('…')).toBe(true)
    expect(out.length).toBeLessThanOrEqual(MAX_DERIVED_NAME_LEN + 1)
  })
})
```

- [ ] **Step 2: Run to verify it fails.**

Run: `cd frontend && pnpm test -- deriveMealName`
Expected: FAIL — module `@/features/fuel/logic/deriveMealName` not found.

- [ ] **Step 3: Implement the helper.**

`frontend/src/features/fuel/logic/deriveMealName.ts`:

```ts
// Max chars of the auto-derived meal name before it is truncated with an ellipsis (mezo-u68c).
export const MAX_DERIVED_NAME_LEN = 64

/**
 * A display name derived from a meal's line names: the names joined with ", ", accumulating whole
 * names up to MAX_DERIVED_NAME_LEN, then "…" if more remain. A single recipe line yields the recipe
 * name; pantry items yield the joined item names. Empty input → "". Pure/deterministic — shared by
 * the LogMealSheet default and the buildDayPlan display fallback so one rule holds everywhere.
 */
export function deriveMealName(names: string[]): string {
  const clean = names.map(n => (n ?? '').trim()).filter(n => n.length > 0)
  if (clean.length === 0) return ''
  const parts: string[] = []
  let len = 0
  for (const name of clean) {
    const add = parts.length === 0 ? name.length : 2 + name.length // ", " + name
    if (parts.length > 0 && len + add > MAX_DERIVED_NAME_LEN) {
      return parts.join(', ') + '…'
    }
    parts.push(name)
    len += add
  }
  return parts.join(', ')
}
```

- [ ] **Step 4: Run to verify it passes.**

Run: `cd frontend && pnpm test -- deriveMealName`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit.**

```bash
git add frontend/src/features/fuel/logic/deriveMealName.ts frontend/src/features/fuel/logic/deriveMealName.test.ts
git -c core.hooksPath=/dev/null commit -m "feat(fuel): deriveMealName helper — join meal line names into a display name (mezo-u68c)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `LogMealSheet` — editable name field + non-null title

**Files:**
- Modify: `frontend/src/features/fuel/sheets/LogMealSheet.tsx`
- Test: `frontend/src/features/fuel/sheets/LogMealSheet.test.tsx`

**Interfaces:**
- Consumes: `deriveMealName` (Task 1).
- The `save()` payload's `title` changes from hard `null` to `shownName.trim() || null`.

**Context:** `resolved` (`LogMealSheet.tsx:107`) already carries `{ l, meta }` where `meta.name` is each line's display name (recipe name for recipe lines, ingredient name for pantry lines). The name field default derives from those; it is "derived-until-touched" (re-derives as lines change until the user types, then their value sticks).

- [ ] **Step 1: Write the failing test additions.**

Add to `frontend/src/features/fuel/sheets/LogMealSheet.test.tsx` (follow the file's existing render/prefill setup and `useMealActions` mock; the assertions below name the contract):

```ts
  it('defaults the name from the prefilled lines and sends it as the meal title', async () => {
    // Render prefilled from a recipe (reuse the file's existing prefill helper/setup).
    // The name input should show the recipe's derived name, and saving must send a non-null title.
    const input = screen.getByLabelText('Étkezés neve') as HTMLInputElement
    expect(input.value.length).toBeGreaterThan(0)

    await userEvent.click(screen.getByRole('button', { name: /Logolás a mai naphoz/ }))

    expect(logMealMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: input.value }),
    )
  })

  it('lets the user override the name, and sends the override as the title', async () => {
    const input = screen.getByLabelText('Étkezés neve')
    await userEvent.clear(input)
    await userEvent.type(input, 'Edzés előtti reggeli')
    await userEvent.click(screen.getByRole('button', { name: /Logolás a mai naphoz/ }))

    expect(logMealMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Edzés előtti reggeli' }),
    )
  })
```

Wire the assertions to the file's existing `useMealActions` mock (capture its `logMeal` as `logMealMock`) and prefill setup — mirror how the current tests render the sheet. If the file has no reusable prefill helper, render `<LogMealSheet prefill={{ source: 'recipe', recipeId: <seeded id> }} onClose={vi.fn()} />` with the mock recipe catalog the other tests use.

- [ ] **Step 2: Run to verify it fails.**

Run: `cd frontend && pnpm test -- LogMealSheet`
Expected: FAIL — no `Étkezés neve` input / `title` sent as `null`.

- [ ] **Step 3: Add the name state, the derived default, the input, and the save wiring.**

In `LogMealSheet.tsx`:

(a) Import the helper (top of file, with the other `@/` imports):

```ts
import { deriveMealName } from '@/features/fuel/logic/deriveMealName'
```

(b) Add the override state next to the other `useState`s (after `slot`, ~line 67):

```ts
  const [nameOverride, setNameOverride] = useState<string | null>(null)
```

(c) After `resolved`/`total` are computed (~line 108), derive the shown name:

```ts
  const derivedName = deriveMealName(resolved.map(({ meta }) => meta.name))
  const shownName = nameOverride ?? derivedName
```

(d) Change `save()` (line 121-132) to send the name:

```ts
  const save = (close: () => void) => {
    if (!canSave) return
    const input: MealInput = {
      slot,
      loggedAt: new Date().toISOString(),
      title: shownName.trim() || null,
      items: lines.map(l => ({ source: l.source, refId: l.refId, amount: l.amount, unit: l.unit })),
    }
    logMeal(input)
    close()
    onClose()
  }
```

(e) Add the name input to the JSX — insert it right AFTER the time row `</div>` (the block ending at line 162) and BEFORE the `{/* Tételek */}` comment (line 164):

```tsx
            {/* Név — szerkeszthető, okos default a tételekből (mezo-u68c) */}
            <span className="label-mono" style={{ fontSize: 8.5, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>NÉV</span>
            <input
              type="text"
              value={shownName}
              onChange={(e) => setNameOverride(e.target.value)}
              placeholder="Étkezés neve"
              aria-label="Étkezés neve"
              style={{ width: '100%', margin: '7px 0 8px', padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}
            />
```

- [ ] **Step 4: Run to verify it passes.**

Run: `cd frontend && pnpm test -- LogMealSheet`
Expected: PASS (existing + the 2 new tests).

- [ ] **Step 5: Commit.**

```bash
git add frontend/src/features/fuel/sheets/LogMealSheet.tsx frontend/src/features/fuel/sheets/LogMealSheet.test.tsx
git -c core.hooksPath=/dev/null commit -m "feat(fuel): editable name field with a smart default in LogMealSheet (mezo-u68c)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Display fallback — `buildDayPlan` + `SlotCard`

**Files:**
- Modify: `frontend/src/features/fuel/logic/buildDayPlan.ts`
- Modify: `frontend/src/features/fuel/components/SlotCard.tsx`
- Test: `frontend/src/features/fuel/logic/buildDayPlan.test.ts`, `frontend/src/features/fuel/components/SlotCard.test.tsx`

**Interfaces:**
- Consumes: `deriveMealName` (Task 1); `FuelMeal.mealItems[].name` (`data/types.ts:71-84`).

- [ ] **Step 1: Write the failing tests.**

Add to `frontend/src/features/fuel/logic/buildDayPlan.test.ts` (reuse the file's existing `buildDayPlan` input builder; the key is a logged meal whose `title` is `''` but whose `mealItems` have names):

```ts
  it('derives a slot name from meal items when the logged meal has no title', () => {
    // Build a day plan with one logged breakfast whose title is '' and mealItems = [{name:'Zabpehely',...}]
    // (reuse the file's fixture builder; set title:'' on that meal).
    const plan = buildDayPlan(/* …fixture with the title-less logged breakfast… */)
    const breakfast = plan.slots.find(s => s.mealId /* the logged one */)
    expect(breakfast?.mealName).toBe('Zabpehely')
  })

  it('keeps the explicit title when the logged meal has one', () => {
    const plan = buildDayPlan(/* …fixture, same but title:'Reggelim' … */)
    const breakfast = plan.slots.find(s => s.mealId)
    expect(breakfast?.mealName).toBe('Reggelim')
  })
```

Add to `frontend/src/features/fuel/components/SlotCard.test.tsx`:

```ts
  it('falls back to the slot label when mealName is empty', () => {
    render(<SlotCard slot={{ /* …minimal slot with mealName:'' , label:'Reggeli'… */ } as any} meta={/*…*/} scoredMeal={null} onOpenScore={vi.fn()} />)
    expect(screen.getByText('Reggeli')).toBeInTheDocument()
  })
```

Match each new test to the existing fixtures/builders in these files (they already construct `buildDayPlan` inputs and `SlotCard` props — copy those shapes; only set `title`/`mealName`/`label` as above).

- [ ] **Step 2: Run to verify they fail.**

Run: `cd frontend && pnpm test -- buildDayPlan SlotCard`
Expected: FAIL — title-less meal yields blank `mealName`; empty `mealName` renders empty instead of the label.

- [ ] **Step 3: Add the display-name fallback in `buildDayPlan.ts`.**

(a) Import the helper (top, with the other `@/` imports):

```ts
import { deriveMealName } from '@/features/fuel/logic/deriveMealName'
```

(b) Add a local helper near the top of the module body (after the imports / with the other module-scope helpers):

```ts
/** Display name for a logged meal: its title, else derived from its item names, else undefined
 *  (so the slot falls back to its label). (mezo-u68c) */
const displayName = (m: FuelMeal): string | undefined =>
  m.title || deriveMealName(m.mealItems.map(l => l.name)) || undefined
```

(c) Replace `mealName: logged.title` (~line 324) with:

```ts
        mealName: displayName(logged),
```

(d) Replace the surplus-logged `label` (~line 364) `labelByKey[k] ?? m.title` with:

```ts
        label: labelByKey[k] ?? displayName(m) ?? m.title,
```

(e) Replace the surplus-logged `mealName: m.title` (~line 368) with:

```ts
        mealName: displayName(m),
```

(`FuelMeal` is already referenced in this file — confirm it's imported; if not, add it to the existing `@/data/types` import.)

- [ ] **Step 4: Fix the `SlotCard` fallback operator.**

In `SlotCard.tsx:62`, change:

```ts
  const title = slot.mealName ?? slot.label
```

to:

```ts
  const title = slot.mealName || slot.label
```

- [ ] **Step 5: Run to verify they pass.**

Run: `cd frontend && pnpm test -- buildDayPlan SlotCard`
Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add frontend/src/features/fuel/logic/buildDayPlan.ts frontend/src/features/fuel/logic/buildDayPlan.test.ts frontend/src/features/fuel/components/SlotCard.tsx frontend/src/features/fuel/components/SlotCard.test.tsx
git -c core.hooksPath=/dev/null commit -m "fix(fuel): de-blank logged-meal cards via item-derived name + label fallback (mezo-u68c)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Feature doc + both-mode gate

**Files:**
- Modify: `docs/features/fuel.md`

- [ ] **Step 1: Update the meal-logging note in `docs/features/fuel.md`.**

Find the meal-logging sentence (the `useFuelDay`/`useMealActions`/`meal-logging` region). Add, in place (overwrite — no changelog): logged meals now carry a name — `LogMealSheet` captures an editable name defaulted via `deriveMealName` (`features/fuel/logic/deriveMealName.ts`), and the timeline de-blanks any title-less meal by deriving a name from its `mealItems` in `buildDayPlan` (with a `SlotCard` label fallback). Add `features/fuel/logic/deriveMealName.ts` to the doc's `key_files` if the section lists frontend files (skip if `key_files` is backend-only — say which in your report).

- [ ] **Step 2: Lint the docs.**

Run: `node scripts/lint-docs.mjs`
Expected: the touched doc's staleness flag cleared; no new errors introduced by this change.

- [ ] **Step 3: Both-mode frontend gate.**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: build succeeds; both test runs green.

- [ ] **Step 4: Commit.**

```bash
git add docs/features/fuel.md
git -c core.hooksPath=/dev/null commit -m "docs(fuel): logged meals carry a name (capture + derived display fallback) (mezo-u68c)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- §2 editable name field with smart default → Task 2. ✓
- §2 display fallback (title → derived → slot label), de-blanks existing meals → Task 3. ✓
- §3 shared `deriveMealName` (join + cap + "…"), used by both sites → Task 1, consumed in 2 & 3. ✓
- §4 touch points (LogMealSheet, buildDayPlan ×3 sites, SlotCard `??`→`||`) → Tasks 2, 3. ✓
- §5 testing (helper units, sheet default+override+payload, buildDayPlan derive, SlotCard fallback, both modes) → Tasks 1-4. ✓
- Frontend-only, no backend change → no backend task. ✓

**Placeholder scan:** Tasks 1 & the code steps carry complete code. Tasks 2-3 test steps intentionally defer to each file's existing fixtures/mocks (named explicitly) rather than duplicating unknown setup — the implementer must read the current test file first; the assertion contracts (input label `Étkezés neve`, `title` payload, `mealName` value, label fallback) are exact.

**Type consistency:** `deriveMealName(names: string[]): string` and `MAX_DERIVED_NAME_LEN` defined in Task 1, consumed identically in Tasks 2-3. `displayName(m: FuelMeal): string | undefined` local to buildDayPlan. `MealInput.title` is `string | null` (`data/types.ts:116`) — `shownName.trim() || null` matches.
