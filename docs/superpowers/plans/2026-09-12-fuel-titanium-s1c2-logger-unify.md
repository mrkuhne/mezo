# Fuel Titanium S1c.2 — one logger, not two Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the log surface read as ONE flow. Today the camera-first mode shell sits on top of the full pre-existing composer, so the page shows two ways to start the same job — including two AI entry points — and the "lightning fast" promise is lost in the stack.

**Architecture:** No new capability and no removed capability. The mode shell already owns the four ways in (photo, voice, typing, usuals); the composer's own source row duplicates two of them and exposes the other two before they are relevant. The fix is a visibility contract: the shell owns "how do I start", the composer body owns "confirm what I captured", and the manual pantry/recipe pickers belong to the typing route, where adding a line by hand actually makes sense.

**Tech Stack:** React 19 + TypeScript, Vitest + Testing Library.

## Global Constraints

- Driving issue: `mezo-33k6` (S1). This is a correction to S1c, found by looking at the running page: `/fuel/log/uj` renders the shell's camera and, directly beneath it, the composer's `MIKOR` segments, its `HONNAN ADOD HOZZÁ?` row with a second `✨ AI` card, and an empty `TÉTELEK 0` list.
- **Nothing may become unreachable.** Manifest **A3** requires manual logging with pantry, recipe and estimate lines. Those pickers move to the typing route; they do not disappear. Verify by test, not by eye.
- **The `✨ AI` source card is the one true duplicate** — the shell's Fotó and Gépelés modes are the same capability with a better entry. Remove the card when the shell is present; keep it when the composer renders WITHOUT the shell (the `LogFlowPage` overlay used by the recipe, pantry, Életjel and Rutin entry points has no shell, and must keep working exactly as it does today).
- **Do not weaken any existing guarantee**: `fixedSlot` still hides `MIKOR`; `provenance.origin` still reflects what actually fed the draft; `reportDraftOutcome` still fires; `?d=`, `?w=`, `?ai=1` and the recipe prefill all still work. Their tests must pass untouched.
- Both frontend modes must stay green, run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`, `CI=true VITE_USE_MOCK=false pnpm test`, `pnpm build`. Filters after `--` are ignored — run the whole suite. Cheap gate from the worktree root: `bash .github/scripts/cheap-gates.sh`.
- Hungarian copy; clay icons, never emoji; reduced motion disables any animation.
- Conventional commits carrying `(mezo-33k6)`, each ending with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

### Task 1: The composer learns where it is

**Files:**
- Modify: `frontend/src/features/fuel/components/MealComposer.tsx`
- Modify: `frontend/src/features/fuel/pages/FuelLogNewPage.tsx`
- Test: `frontend/src/features/fuel/components/MealComposer.shell.test.tsx` (create)

**Interfaces:**
- Consumes: the existing `FuelLogModes` shell.
- Produces: `MealComposerProps` gains `shellOwnsEntry?: boolean` and `manualSources?: boolean`. `shellOwnsEntry` says a mode shell is mounted above (so the composer drops its own `✨ AI` card); `manualSources` says the pantry and recipe pickers should be offered right now. `FuelLogNewPage` passes `shellOwnsEntry` whenever the shell renders, and `manualSources={mode === 'text'}`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/fuel/components/MealComposer.shell.test.tsx`, reusing the render harness from the neighbouring `MealComposer.*.test.tsx` files. Cases:

```tsx
// S1c.2 (mezo-33k6): héjjal a fejlécben a szerkesztő NEM kínál második AI-bejáratot.
test('héj alatt nincs második AI kártya', () => {
  renderComposer({ shellOwnsEntry: true })
  expect(screen.queryByRole('button', { name: /AI · fotó vagy szöveg/ })).not.toBeInTheDocument()
})

// A régi overlay-bejáratok (recept, kamra, Életjel, Rutin) héj NÉLKÜL futnak — ott marad minden.
test('héj nélkül a szerkesztő megtartja a saját AI kártyáját', () => {
  renderComposer()
  expect(screen.getByRole('button', { name: /AI · fotó vagy szöveg/ })).toBeInTheDocument()
})

// A3: a kézi források nem tűnnek el — a gépelés úthoz tartoznak.
test('a gépelés úton a Kamra és a Recept elérhető', () => {
  renderComposer({ shellOwnsEntry: true, manualSources: true })
  expect(screen.getByRole('button', { name: /Kamra/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Recept/ })).toBeInTheDocument()
})

test('a fotó úton a kézi források nem tolakodnak elő', () => {
  renderComposer({ shellOwnsEntry: true, manualSources: false })
  expect(screen.queryByRole('button', { name: /Kamra/ })).not.toBeInTheDocument()
})

// A megerősítő rész csak akkor jelenik meg, ha VAN mit megerősíteni.
test('tétel nélkül nincs üres tétel-lista és nincs mentés gomb', () => {
  renderComposer({ shellOwnsEntry: true })
  expect(screen.queryByText(/TÉTELEK/i)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Rögzítem|Mentem/ })).not.toBeInTheDocument()
})

test('az első tétel megjelenésével jön a megerősítő rész', () => {
  renderComposer({ shellOwnsEntry: true, seedLines: [line()] })
  expect(screen.getByText(/TÉTELEK/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Rögzítem/ })).toBeInTheDocument()
})

// A rögzített ablak szabálya változatlan.
test('rögzített ablaknál a MIKOR továbbra sem jelenik meg', () => {
  renderComposer({ shellOwnsEntry: true, fixedSlot: 'snack', seedLines: [line()] })
  expect(screen.queryByText('MIKOR')).not.toBeInTheDocument()
})
```

Read `MealComposer.tsx:549-590` first for the real accessible names of the `MIKOR` block and the three source cards, and assert on what the component genuinely renders.

- [ ] **Step 2: Run the tests to verify they fail**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: FAIL — the AI card renders regardless, and the empty item list and save button are always present.

- [ ] **Step 3: Implement**

Add the two props with safe defaults (`shellOwnsEntry = false`, `manualSources = true`) so every existing caller — above all the `LogFlowPage` overlay — behaves exactly as before. Then:
- hide the `✨ AI` source card when `shellOwnsEntry`;
- render the `HONNAN ADOD HOZZÁ?` row only when `manualSources` (or when there is no shell at all);
- render the confirmation part — `MIKOR`, the item list and the save action — only once the draft has at least one line, or when `editMealId` is set.

Keep `fixedSlot`'s existing rule intact: it still hides `MIKOR` outright.

In `FuelLogNewPage.tsx`, pass `shellOwnsEntry={!editing}` and `manualSources={mode === 'text'}`.

- [ ] **Step 4: Run the tests to verify they pass**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: PASS, with every existing `MealComposer.*`, `LogFlowPage.*` and `FuelLogNewPage.*` case green and untouched.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel/components/MealComposer.tsx frontend/src/features/fuel/components/MealComposer.shell.test.tsx frontend/src/features/fuel/pages/FuelLogNewPage.tsx
git commit -m "fix(fuel): one logger — the shell owns the way in, the composer the confirmation (mezo-33k6)"
```

---

### Task 2: Prove it on the page

**Files:**
- Test: `frontend/src/features/fuel/pages/FuelLogNewPage.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// S1c.2 (mezo-33k6): a naplózó EGY felület — a kamera alatt nem áll ott a régi szerkesztő.
test('a kamerás nézet nem mutat második AI bejáratot és üres tétel-listát', () => {
  renderAt('/fuel/log/uj')
  expect(screen.queryByRole('button', { name: /AI · fotó vagy szöveg/ })).not.toBeInTheDocument()
  expect(screen.queryByText(/TÉTELEK/i)).not.toBeInTheDocument()
})

// A3: a kézi út a gépelés fülön él, és onnan minden elérhető.
test('a gépelés fülön előjönnek a kézi források', async () => {
  renderAt('/fuel/log/uj')
  await userEvent.click(screen.getByRole('button', { name: 'Gépelés' }))
  expect(screen.getByRole('button', { name: /Kamra/ })).toBeInTheDocument()
})

// A mélylink ígérete változatlan.
test('az ai=1 mélylink továbbra is a gépelés úton, nyitott AI mezővel érkezik', () => {
  renderAt('/fuel/log/uj?ai=1')
  expect(screen.getByLabelText('Mit ettél?')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run, implement if needed, re-run**

If Task 1 was done correctly these pass immediately; if they do not, fix the page wiring rather than the assertions.

- [ ] **Step 3: Full gates and commit**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test && CI=true VITE_USE_MOCK=false pnpm test && pnpm build`
Then from the worktree root: `bash .github/scripts/cheap-gates.sh`

```bash
git add frontend/src/features/fuel/pages/FuelLogNewPage.test.tsx
git commit -m "test(fuel): pin the single-surface logger contract (mezo-33k6)"
```

---

## Self-review notes

- **Nothing is lost:** the pantry and recipe pickers move rather than disappear, and a test asserts they are reachable on the typing route. The overlay entry points keep the old layout because the new props default to today's behaviour.
- **The duplicate is named precisely:** only the `✨ AI` card goes, and only when a shell is present.
- **The existing guarantees are listed as must-not-break with their tests as the evidence**, so a green run means they actually still hold.
