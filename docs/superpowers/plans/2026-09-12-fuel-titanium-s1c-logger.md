# Fuel Titanium S1c — the camera-first logger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn meal logging into the approved lightning flow — the surface opens on the camera, with voice, typing and a time-ranked "szokásosak" row each one tap away, an honest failure state that offers the other routes, and edit and delete finally reachable from a logged meal.

**Architecture:** The existing `MealComposer` already owns the correct save semantics (slot locking, provenance origin, AI draft outcome reporting, past-day timestamps) and must not be rewritten — this slice wraps it in a mode-switching shell, adds the three input arms that feed it, and connects two backend operations that have had no UI caller. Voice is new wiring only: `useVoiceInput` (transcription, already used by chat and journal) hands its text to the SAME `draftMealFromAi` text arm the typing mode uses, so no new backend work exists in this slice.

**Tech Stack:** React 19 + TypeScript, Vitest + Testing Library, `useVoiceInput` + `useTranscribe`, `useMealActions`, `resizeImage`, the `mozaik`/`clay` kits, plain CSS in `frontend/src/styles/prototype.css`.

## Global Constraints

- Driving issue: `mezo-33k6` (S1). Manifest rows implemented here: **A3** (manual log), **A4** (photo AI — promoted to the default view), **A5** (text AI), **A6** (voice — new wiring over existing endpoints), **A7** (szokásosak, new), **A8** (edit — new UI over an existing backend op), **A9** (delete — new UI, two-step). Manifest: `docs/design_2.0/2026-09-11-fuel-coverage.md`.
- **Depends on S1a and S1b** being merged on this branch (the `fuel-mai titanium` CSS block and the `fmx-` prefix exist; Mai's blocks already navigate into the logger with `?w=`).
- **The approved visual reference is the prototype**, `docs/design_2.0/prototypes/companion-titanium/`. Read before writing markup:
  - `food.js` — `render` (`:21`), `modeTabs`/`inputView` (`:22`), `photoView` (`:23`), `voiceView` (`:24`), `textView` (`:25`), `usualView` (`:26`), `failedView` (`:27`), `portion` (`:28`), `review` (`:31`), `fixedReview` (`:32`), `updatePreview` (`:34`), `saved` (`:35`), `deleteBlock` (used by both reviews).
  - `food-state.js` — `usualMeals` (`:49`) is the ranking contract.
  - `fuel-pages.css` — `/* Logger mode tabs */` (`:2`), `/* Camera demo */` (`:7`), `/* Voice demo */` (`:25`), `/* Usuals */` (`:33`), `/* Failure state */` (`:41`), `/* Delete inside review */` (`:48`); plus `food.css` in the same directory.
- **The prototype is a demo; production is not.** The prototype fakes the camera, the recognition and the AI. Here the photo arm uses the REAL flow that already exists in `MealComposer.tsx:310-340`: `resizeImage(file)` → `draftMealFromAi({ date, photo })` → user confirms. Never ship a fake recogniser, a hardcoded sample meal, or copy the prototype's demo notices into production copy.
- Owner decisions this slice must honour:
  - Mode priority is **photo → voice → typing → szokásosak**, and the surface opens on photo.
  - Nothing is ever saved without explicit user confirmation; AI uncertainty is stated honestly (`tanulom`), never hidden behind a confident number.
  - Photo recognition failure is a first-class state that offers the other three routes — not an error toast.
  - Delete is **two-step** (arm, then confirm).
- Never weaken `MealComposer`'s existing guarantees. In particular: `fixedSlot` locks the slot and hides the MIKOR control; `provenance.origin` must be `ai-photo` when a photo contributed and `ai-text` when only text did; `reportDraftOutcome` must still fire on a successful save of an AI-contributed draft. These are covered by existing tests (`LogFlowPage.test.tsx` and its `.ai` / `.outcome` / `.overrides` / `.prefill` / `.timestamp` siblings) — all of them must stay green untouched.
- Both frontend modes must stay green, run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`, `CI=true VITE_USE_MOCK=false pnpm test`, `pnpm build`. Filters after `--` are ignored — always run the whole suite. Cheap gate from the worktree root: `bash .github/scripts/cheap-gates.sh`.
- Reduced motion disables every animation. Hungarian copy; clay icons, never emoji.
- Conventional commits carrying `(mezo-33k6)`, each ending with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

### Task 1: The "szokásosak" ranking

**Files:**
- Create: `frontend/src/features/fuel/logic/usualMeals.ts`
- Create: `frontend/src/features/fuel/logic/usualMeals.test.ts`

**Interfaces:**
- Consumes: `FuelMeal[]` (`@/data/types`) — the user's recent meals.
- Produces:
  ```ts
  export interface UsualMeal { key: string; title: string; slot: MealSlot; kcal: number | null; lastLoggedIso: string; count: number }
  export function rankUsualMeals(meals: FuelMeal[], nowHHmm: string, limit?: number): UsualMeal[]
  ```
  Task 3 renders it.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/fuel/logic/usualMeals.test.ts`, following the pure-logic style of `frontend/src/features/fuel/logic/fuelSwimlane.test.ts` (plain `.ts`, no router, no QueryClient, small local `meal()` factory). Cases:

```ts
// A7 (mezo-33k6): FoodNoms-minta — napszak ELŐSZÖR, azon belül gyakoriság, végül frissesség.
test('a napszakhoz illő étkezések állnak elöl', () => {
  const rows = rankUsualMeals(MEALS, '08:00')
  expect(rows[0].slot).toBe('breakfast')
})

test('azonos napszakon belül a gyakoribb előzi meg a ritkábbat', () => {
  const rows = rankUsualMeals(MEALS, '08:00').filter(r => r.slot === 'breakfast')
  expect(rows.map(r => r.count)).toEqual([...rows.map(r => r.count)].sort((a, b) => b - a))
})

test('azonos gyakoriságnál a frissebb nyer', () => { ... })

// Az azonos étkezés nem szerepel kétszer.
test('az ismételt étkezés egy sorrá vonódik össze, a darabszámával', () => {
  const rows = rankUsualMeals(MEALS, '08:00')
  expect(new Set(rows.map(r => r.key)).size).toBe(rows.length)
})

// Őszinte-null: kcal nélküli előzményből nem találunk ki számot.
test('ismeretlen kalóriájú előzmény kcal nélkül jön vissza', () => {
  expect(rankUsualMeals([mealWithoutKcal()], '08:00')[0].kcal).toBeNull()
})

test('előzmény nélkül üres lista, nem kitalált javaslat', () => {
  expect(rankUsualMeals([], '08:00')).toEqual([])
})
```

Derive `slot` from the meal's own slot field and the time-of-day bucket the production code already uses — read `frontend/src/features/fuel/logic/fuelSwimlane.ts` and `frontend/src/data/fuel/fuelConfig.ts` for the canonical slot keys and boundaries, and reuse them instead of inventing new thresholds.

- [ ] **Step 2: Run the tests to verify they fail**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: FAIL — `rankUsualMeals` does not exist.

- [ ] **Step 3: Implement**

Write the pure function: group the meals by a normalised title key, count occurrences, keep the most recent timestamp and a representative kcal (null when unknown), then sort by (slot matches the current time-of-day bucket) → count → recency. Default `limit` to 6.

- [ ] **Step 4: Run the tests to verify they pass**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel/logic/usualMeals.ts frontend/src/features/fuel/logic/usualMeals.test.ts
git commit -m "feat(fuel): time-of-day ranked usual meals (mezo-33k6)"
```

---

### Task 2: Voice input feeds the AI text draft

**Files:**
- Modify: `frontend/src/features/fuel/components/MealComposer.tsx`
- Test: `frontend/src/features/fuel/components/MealComposer.voice.test.tsx` (create)

**Interfaces:**
- Consumes: `useVoiceInput(onTranscript)` from `@/features/insights/logic/useVoiceInput` — read it first (`:5` for `VoiceState`, `:24` for the signature, `:85` for the returned `{ state, error, toggle }`), and copy the consumer idiom from `frontend/src/features/insights/pages/ChatPage.tsx:75-76`.
- Produces: `MealComposer` gains a microphone control in its AI panel that appends the transcript to the existing AI text field. No new prop, no new endpoint.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/fuel/components/MealComposer.voice.test.tsx`, mocking `useVoiceInput` so the test drives state deterministically (find how an existing test mocks it — `grep -rn "useVoiceInput" frontend/src --include=*.test.tsx` — and follow that pattern). Cases:

```tsx
// A6 (mezo-33k6): a hang NEM új backend — a leiratozott mondat ugyanabba a szövegmezőbe
// kerül, amiből az AI-piszkozat készül.
test('a bemondott mondat a szövegmezőbe kerül', async () => {
  renderComposer()
  act(() => transcript('Egy joghurt és egy banán volt.'))
  expect(screen.getByLabelText('Mit ettél?')).toHaveValue('Egy joghurt és egy banán volt.')
})

test('felvétel közben a gomb ezt mondja, és leiratozás közben tiltott', () => { ... })

// Nem támogatott böngészőn a gomb nem hazudik: nem jelenik meg működőként.
test('hangfelismerés nélkül a mikrofon tiltott', () => {
  renderComposer({ voiceState: 'unsupported' })
  expect(screen.getByRole('button', { name: /hang/i })).toBeDisabled()
})

test('a hangfelismerés hibája a felhasználónak is látszik', () => {
  renderComposer({ voiceError: 'Nem sikerült a leiratozás.' })
  expect(screen.getByText('Nem sikerült a leiratozás.')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: FAIL — there is no microphone control in the composer.

- [ ] **Step 3: Implement**

In `MealComposer.tsx`'s AI panel (`:443-479`), add the microphone button next to the existing photo label, wired as `const voice = useVoiceInput(text => setAiText(d => (d ? `${d} ${text}` : text)))`. Disable it while `state === 'unsupported' || state === 'transcribing'`, label it by state, and render `voice.error` where the panel already renders its error. Change nothing about `runAi`, the save path or `provenance` — a spoken meal reaches the backend as `ai-text`, which is correct: no audio is sent to the draft endpoint.

- [ ] **Step 4: Run the tests to verify they pass**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: PASS, including every pre-existing `LogFlowPage.*` test.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel/components/MealComposer.tsx frontend/src/features/fuel/components/MealComposer.voice.test.tsx
git commit -m "feat(fuel): speak a meal — voice transcription feeds the AI draft (mezo-33k6)"
```

---

### Task 3: The mode-switching logger shell

**Files:**
- Create: `frontend/src/features/fuel/components/FuelLogModes.tsx`
- Create: `frontend/src/features/fuel/components/FuelLogModes.test.tsx`
- Modify: `frontend/src/features/fuel/pages/FuelLogNewPage.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: `rankUsualMeals` (Task 1), `MealComposer` (Task 2), `useFuelDay` for the history the ranking reads.
- Produces:
  ```tsx
  export type LogMode = 'photo' | 'voice' | 'text' | 'usual'
  export function FuelLogModes(props: {
    mode: LogMode
    onMode: (m: LogMode) => void
    onPhoto: (file: File) => void
    onUsual: (u: UsualMeal) => void
    failed: boolean
    usuals: UsualMeal[]
  }): JSX.Element
  ```

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/fuel/components/FuelLogModes.test.tsx`. Cases:

```tsx
// A4 (mezo-33k6): a kamera a DEFAULT — ez az owner első számú módja.
test('a felület a kamerán nyit', () => {
  const { container } = render(<FuelLogModes {...props()} />)
  expect(container.querySelector('.fmx-mode.is-active')!.textContent).toMatch(/Fotó/)
})

// A módok sorrendje rögzített: fotó → hang → gépelés → szokásosak.
test('a módok a jóváhagyott sorrendben állnak', () => {
  const { container } = render(<FuelLogModes {...props()} />)
  expect(Array.from(container.querySelectorAll('.fmx-mode')).map(b => b.textContent!.trim()))
    .toEqual(['Fotó', 'Hang', 'Gépelés', 'Szokásosak'])
})

test('a fotó kiválasztása a hívóhoz jut, nem közvetlenül ment', async () => {
  const onPhoto = vi.fn()
  render(<FuelLogModes {...props({ onPhoto })} />)
  await userEvent.upload(screen.getByLabelText(/Étel fotó/i), new File(['x'], 'a.jpg', { type: 'image/jpeg' }))
  expect(onPhoto).toHaveBeenCalledTimes(1)
})

// A4: a felismerés kudarca teljes értékű állapot, ami a másik három utat kínálja.
test('a felismerés kudarca a másik három utat kínálja, nem hibaüzenetet', async () => {
  render(<FuelLogModes {...props({ failed: true })} />)
  expect(screen.getByText(/nem ismertem fel/i)).toBeInTheDocument()
  for (const name of [/Leírom szöveggel/, /szokásosakból/, /Új fotót/]) {
    expect(screen.getByRole('button', { name })).toBeInTheDocument()
  }
})

// A7: előzmény nélkül nem találunk ki szokásokat.
test('előzmény nélkül a szokásosak fül őszintén üres', () => {
  render(<FuelLogModes {...props({ mode: 'usual', usuals: [] })} />)
  expect(screen.getByText(/Még tanulom, mit szoktál enni/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: FAIL — cannot resolve `@/features/fuel/components/FuelLogModes`.

- [ ] **Step 3: Implement the shell**

Port `modeTabs` + `photoView`/`voiceView`/`textView`/`usualView` + `failedView` from `food.js`, **dropping every demo affordance**: no sample-shot buttons, no "DEMÓ KERESŐ" overlay, no "nincs valódi AI-hívás" notices, no canned sentences. The photo view is a real `<input type="file" accept="image/*" capture="environment">` styled as the camera action — the same input `MealComposer` already uses, moved to the front of the flow. The voice view surfaces the microphone from Task 2. The text view focuses the AI text field. The usual view renders `usuals` as one-tap rows.

- [ ] **Step 4: Wire it into the page**

In `FuelLogNewPage.tsx`, render `FuelLogModes` above the `MealComposer`, keeping every existing URL contract exactly as it is: `?d=` (7-day clamp), `?w=` (`tileKey` lookup → `fixedSlot`), `?ai=1`, the recipe prefill, and the `back()` behaviour. `?ai=1` now means "open on typing with the AI panel already open" — the deep link's promise is unchanged. A photo chosen in the shell calls the composer's existing photo path; do not add a second AI call site.

Add the CSS to the `fuel-mai titanium` block under the `fmx-` prefix, porting `/* Logger mode tabs */`, `/* Camera demo */` (the framing only, not the demo overlay), `/* Voice demo */`, `/* Usuals */` and `/* Failure state */`.

- [ ] **Step 5: Run the tests to verify they pass**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: PASS, including every pre-existing `FuelLogNewPage.test.tsx` case (the URL contracts).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/fuel/components/FuelLogModes.tsx frontend/src/features/fuel/components/FuelLogModes.test.tsx frontend/src/features/fuel/pages/FuelLogNewPage.tsx frontend/src/styles/prototype.css
git commit -m "feat(fuel): camera-first logger with voice, typing and usuals (mezo-33k6)"
```

---

### Task 4: Edit and delete a logged meal

**Files:**
- Modify: `frontend/src/features/fuel/components/MealComposer.tsx`
- Modify: `frontend/src/features/fuel/pages/FuelLogNewPage.tsx`
- Modify: `frontend/src/features/fuel/pages/FuelMealDetailPage.tsx` (from S1b)
- Test: `frontend/src/features/fuel/components/MealComposer.edit.test.tsx` (create)

**Interfaces:**
- Consumes: `useMealActions(date).updateMeal(id, input)` (`fuelHooks.ts:110`) and `.deleteMeal(id)` (`:111`) — both already exist and have had **no UI caller**.
- Produces: `MealComposer` accepts `editMealId?: string`; when present it seeds from that meal, saves with `updateMeal` instead of `logMeal`, and offers the two-step delete. `FuelLogNewPage` accepts `?edit=<mealId>`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/fuel/components/MealComposer.edit.test.tsx`. Cases:

```tsx
// A8 (mezo-33k6): a szerkesztés a MEGLÉVŐ backend-műveletet hívja — eddig nem volt UI-ja.
test('szerkesztésnél a mentés frissít, nem új étkezést hoz létre', async () => {
  renderComposer({ editMealId: 'meal-1' })
  await userEvent.click(screen.getByRole('button', { name: /Mentem a javítást/ }))
  expect(updateMeal).toHaveBeenCalledWith('meal-1', expect.objectContaining({ slot: 'snack' }))
  expect(logMeal).not.toHaveBeenCalled()
})

test('a szerkesztő a meglévő étkezés soraival és idejével nyit', () => { ... })

// A9: a törlés KÉT lépés — egy félrekoppintás nem töröl.
test('a törlés két lépéses', async () => {
  renderComposer({ editMealId: 'meal-1' })
  await userEvent.click(screen.getByRole('button', { name: 'Törlöm' }))
  expect(deleteMeal).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: /Biztosan törlöm/ }))
  expect(deleteMeal).toHaveBeenCalledWith('meal-1')
})

test('új étkezésnél nincs törlés gomb', () => {
  renderComposer()
  expect(screen.queryByRole('button', { name: 'Törlöm' })).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: FAIL — `MealComposer` has no `editMealId` prop.

- [ ] **Step 3: Implement**

Add `editMealId?: string` to `MealComposerProps` (`:146-163`). When set: seed the draft lines, title, slot and time from that meal in the already-loaded `useFuelDay(logDate)` day; label the primary action `✓ Mentem a javítást`; call `updateMeal(editMealId, input)` on save; and render the two-step delete (arm → confirm, matching the prototype's `deleteBlock`). Do NOT report a draft outcome for an edit — that signal describes AI draft quality, not corrections.

In `FuelLogNewPage.tsx`, read `?edit=` and pass it through. In `FuelMealDetailPage.tsx` (S1b), add the entry point: a quiet action that navigates to `/fuel/log/uj?edit=<id>` — plus `&d=` when the meal belongs to a past day, so the composer keeps that day's timestamp contract.

- [ ] **Step 4: Run the full gates**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test && CI=true VITE_USE_MOCK=false pnpm test && pnpm build`
Then from the worktree root: `bash .github/scripts/cheap-gates.sh`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel/components/MealComposer.tsx frontend/src/features/fuel/components/MealComposer.edit.test.tsx frontend/src/features/fuel/pages/FuelLogNewPage.tsx frontend/src/features/fuel/pages/FuelMealDetailPage.tsx
git commit -m "feat(fuel): edit and two-step delete for a logged meal (mezo-33k6)"
```

---

## Self-review notes

- **Manifest coverage:** A3 (untouched composer save path, still exercised by its own tests), A4 (Task 3 — photo is the default view, real flow not a demo), A5 (Task 3 — typing arm), A6 (Task 2 — new wiring, no new backend), A7 (Tasks 1+3), A8 (Task 4 — first UI caller of `updateMeal`), A9 (Task 4 — first UI caller of `deleteMeal`, two-step).
- **Prototype-vs-production trap named explicitly:** the Global Constraints forbid porting the demo recogniser, sample shots and demo notices, which is the single most likely way this slice could go wrong.
- **Preserved contracts:** `?d=`, `?w=`, `?ai=1`, recipe prefill, slot locking, `provenance.origin`, draft-outcome reporting — each named, and the existing tests covering them must pass untouched.
- **Type consistency:** `LogMode`, `UsualMeal`, `rankUsualMeals`, `FuelLogModes` and `editMealId` are spelled identically wherever they appear across the four tasks.
