# Exercise demo stills — remaining four surfaces · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the already-shipped `ExerciseImage` component onto the four Train surfaces where it is missing — catalog cards, exercise picker, prep card, active workout — so the 124 vendored image pairs become visible.

**Architecture:** No new component and no new CSS. `ExerciseImage` (`variant="thumb" | "hero"`) and the `.exdemo*` classes already cover every case, including the muscle-wash fallback tile for the 37 imageless rows. Three surfaces read the catalog (`ExerciseLibraryItem`, which already carries the fields); the two workout surfaces need two fields threaded through one mapping.

**Tech Stack:** React 19 + TypeScript + Vite, Vitest + Testing Library (+ MSW in real mode), Tailwind v4 tokens in `frontend/src/styles/prototype.css`.

## Global Constraints

- Spec: [`2026-08-08-exercise-image-surfaces-design.md`](../specs/2026-08-08-exercise-image-surfaces-design.md). Mockup: [`2026-08-08-exercise-image-surfaces-mockup.html`](../specs/2026-08-08-exercise-image-surfaces-mockup.html).
- **All UI copy is Hungarian.** Never introduce an English user-facing string.
- **Do not touch `frontend/src/data/**` hook signatures, REST clients, or the API contract** beyond the two additive fields in Task 1. Never edit `src/data/_client/api.gen.ts` by hand.
- Frontend conventions are mandatory: `docs/references/frontend_conventions.md`. Features import hooks from `@/data/hooks` only; deep absolute `@/*` imports; tests colocated.
- **Every task's gate is both modes:** `cd frontend && pnpm vitest run <file>` for the task's own tests, and the full `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` before the final commit (Task 6).
- **No new CSS class and no new component.** If a surface seems to need one, stop and report instead.
- Commit messages: conventional subject carrying the bd id, e.g. `feat(train): ... (mezo-8xdl.4)`.

---

### Task 1: Data layer — thread the two image fields onto workout exercises + seed the mock catalog

The catalog side already carries `imageStartUrl`/`imageEndUrl` (shipped in `mezo-8xdl.3`). The workout side does not, so the prep card and the active workout have nothing to render. Mock mode carries no image paths at all, which is why nothing is verifiable there.

**Files:**
- Modify: `frontend/src/data/types.ts` (the `videoUrl` line inside the workout-exercise interface, ~line 842)
- Modify: `frontend/src/data/train/trainHooks.ts` (the `videoUrl: e.videoUrl ?? null,` mapping line, ~line 80)
- Modify: `frontend/src/data/train/train.ts` (the `exerciseLibrary` mock seed, ~line 609)
- Test: `frontend/src/data/train/trainHooks.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `LoggedWorkoutExercise.imageStartUrl?: string | null` and `.imageEndUrl?: string | null` (read by Tasks 4 and 5); mock `exerciseLibrary` entries `exl-2` (Lat Pulldown · Pronated) and `exl-4` (T-Bar Row) carrying `imageStartUrl`/`imageEndUrl`, with `exl-1`/`exl-5` left imageless on purpose (read by Tasks 2 and 3 in mock mode).

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/data/train/trainHooks.test.tsx`:

```tsx
test('useTrain (real mode) maps the catalog-resolved demo stills onto workout exercises', async () => {
  const { result } = renderHook(() => useTrain(), { wrapper })
  await waitFor(() => expect(result.current.workout?.exercises.length).toBeGreaterThan(0))
  // The MSW /workouts/today fixture carries imageStartUrl/imageEndUrl on its first exercise;
  // the mapping must pass both through untouched (null when absent, never undefined).
  const first = result.current.workout!.exercises[0]
  expect(first).toHaveProperty('imageStartUrl')
  expect(first).toHaveProperty('imageEndUrl')
})
```

Then add the two fields to the FIRST exercise of the `/api/train/workouts/today` fixture in `frontend/src/test/msw/handlers.ts` so the assertion has something to read:

```ts
imageStartUrl: '/exercises/lat-pulldown-pronated-a.jpg',
imageEndUrl: '/exercises/lat-pulldown-pronated-b.jpg',
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && pnpm vitest run src/data/train/trainHooks.test.tsx -t "demo stills"`
Expected: FAIL — the mapped object has no `imageStartUrl` property.

- [ ] **Step 3: Implement**

In `frontend/src/data/types.ts`, directly under the `videoUrl` line of the workout-exercise interface:

```ts
  videoUrl?: string | null // demo video (catalog-resolved); absent in Phase-1 statics
  // Demo stills (catalog-resolved, mezo-8xdl). imageStartUrl is the presence flag.
  imageStartUrl?: string | null
  imageEndUrl?: string | null
```

In `frontend/src/data/train/trainHooks.ts`, directly under `videoUrl: e.videoUrl ?? null,`:

```ts
      imageStartUrl: e.imageStartUrl ?? null,
      imageEndUrl: e.imageEndUrl ?? null,
```

In `frontend/src/data/train/train.ts`, give `exl-2` (Lat Pulldown · Pronated) and `exl-4` (T-Bar Row) the vendored paths. **Verified: `lat-pulldown-pronated-*.jpg` and `t-bar-row-*.jpg` exist; `chest-supported-row` and `cable-pull-around` are among the 37 unmapped slugs and have NO files — leave `exl-1`/`exl-5` imageless on purpose, so mock mode shows both states side by side.**

```ts
  { id: 'exl-2', name: 'Lat Pulldown · Pronated', muscle: 'back-wide', type: 'compound', stim: 0.84, fatigue: 0.4, imageStartUrl: '/exercises/lat-pulldown-pronated-a.jpg', imageEndUrl: '/exercises/lat-pulldown-pronated-b.jpg' },
```

```ts
  { id: 'exl-4', name: 'T-Bar Row', muscle: 'back-mid', type: 'compound', stim: 0.88, fatigue: 0.65, imageStartUrl: '/exercises/t-bar-row-a.jpg', imageEndUrl: '/exercises/t-bar-row-b.jpg' },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && pnpm vitest run src/data/train/trainHooks.test.tsx`
Expected: PASS, all tests in the file (the mock-mode `exerciseLibrary.length === 21` assertion must be untouched).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data/types.ts frontend/src/data/train/trainHooks.ts frontend/src/data/train/train.ts frontend/src/data/train/trainHooks.test.tsx frontend/src/test/msw/handlers.ts
git commit -m "feat(train): thread the demo stills onto workout exercises + seed the mock catalog (mezo-8xdl.4)"
```

---

### Task 2: Catalog cards — thumbnail in the rank slot

Mockup variant A: the thumbnail takes the rank plaque's place and the rank becomes a `#n` prefix on the name. Applies to both `RecordRow` and `GhostRow`.

**Files:**
- Modify: `frontend/src/features/train/pages/ExercisesPage.tsx` (the `RecordRow` head row and the `GhostRow` head row)
- Test: `frontend/src/features/train/pages/ExercisesPage.test.tsx`

**Interfaces:**
- Consumes: `ExerciseImage` from `@/features/train/components/ExerciseImage` — `({ start, end, name, muscle, variant })`, where `variant="thumb"` renders a 44px `img.exdemo-thumb` when `start` is set and a `div.exdemo-thumb` fallback tile with the name's initial when it is not. `ExerciseLibraryItem.imageStartUrl` / `.imageEndUrl` (already present, shipped in `.3`).
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/features/train/pages/ExercisesPage.test.tsx`:

```tsx
test('a record card leads with the catalog thumbnail and keeps the rank as a #n prefix', async () => {
  renderView()
  const row = await screen.findByRole('button', { name: /Chest Supported Row/ })
  // Chest Supported Row is one of the 37 unmapped slugs — the slot is still
  // reserved, by the fallback TILE (a div), so the list's left edge stays straight.
  const tile = row.querySelector('.exdemo-thumb')
  expect(tile).not.toBeNull()
  expect(tile!.tagName).toBe('DIV')
  expect(within(row).getByText('#1')).toBeInTheDocument()
  // Hip Thrust carries stills in the MSW catalog fixture (mezo-8xdl.3) → a real <img>.
  const hip = await screen.findByRole('button', { name: /Hip Thrust/ })
  expect(hip.querySelector('img.exdemo-thumb')).not.toBeNull()
})
```

Note: the existing test at the top of the file asserts `within(row).getByText('1')` for the rank plaque — update that assertion to `'#1'` in the same step, since the rank's rendering changes.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && pnpm vitest run src/features/train/pages/ExercisesPage.test.tsx -t "thumbnail"`
Expected: FAIL — no `.exdemo-thumb` in the card.

- [ ] **Step 3: Implement**

In `RecordRow`, replace the head row:

```tsx
        <div className="row" style={{ alignItems: 'center', gap: 10 }}>
          <ExerciseImage
            start={lib?.imageStartUrl}
            end={lib?.imageEndUrl}
            name={r.name}
            muscle={r.muscle}
            variant="thumb"
          />
          <span className="excat-name" style={{ flex: 1, minWidth: 0 }}>
            {rank != null && (
              <span className="label-mono" style={{ color: 'var(--text-tertiary)', marginRight: 6 }}>#{rank}</span>
            )}
            {r.name}
          </span>
        </div>
```

In `GhostRow`, put the same `ExerciseImage` (with `item.imageStartUrl` / `item.imageEndUrl` / `item.name` / `item.muscle`) as the first child of its head row, before the name span. Leave the STIM block and the action column untouched.

Add the import at the top of the file:

```tsx
import { ExerciseImage } from '@/features/train/components/ExerciseImage'
```

Delete the now-unused `.excat-rank` usage from `RecordRow` only — leave the CSS class in `prototype.css` alone (other beads may still use it; removing dead CSS is not this task's job).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && pnpm vitest run src/features/train/pages/ExercisesPage.test.tsx`
Expected: PASS, all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/pages/ExercisesPage.tsx frontend/src/features/train/pages/ExercisesPage.test.tsx
git commit -m "feat(train): catalog cards lead with the demo thumbnail (mezo-8xdl.4)"
```

---

### Task 3: Exercise picker — thumbnail leads the row

**Files:**
- Modify: `frontend/src/features/train/sheets/ExercisePickerSheet.tsx` (the row `<button className="card row">`, first child)
- Test: `frontend/src/features/train/sheets/ExercisePickerSheet.test.tsx`

**Interfaces:**
- Consumes: `ExerciseImage` (same signature as Task 2); the picker's `e` is an `ExerciseLibraryItem`.
- Produces: nothing.

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/features/train/sheets/ExercisePickerSheet.test.tsx` (follow the file's existing render helper and fixture names — read them first):

```tsx
test('each picker row leads with the exercise thumbnail', async () => {
  renderSheet()
  const row = await screen.findByRole('button', { name: /Chest Supported Row/ })
  // Present for every row: an <img> when the catalog row has stills, the
  // muscle-wash fallback tile when it does not — the left edge never goes ragged.
  // (Chest Supported Row is deliberately imageless: one of the 37 unmapped slugs.)
  expect(row.querySelector('.exdemo-thumb')).not.toBeNull()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && pnpm vitest run src/features/train/sheets/ExercisePickerSheet.test.tsx -t "thumbnail"`
Expected: FAIL — no `.exdemo-thumb` in the row.

- [ ] **Step 3: Implement**

Insert as the first child inside the row `<button className="card row" …>`, before `<div className="col flex-1">`:

```tsx
                  <ExerciseImage
                    start={e.imageStartUrl}
                    end={e.imageEndUrl}
                    name={e.name}
                    muscle={e.muscle}
                    variant="thumb"
                  />
```

Give the button a `gap: 12` in its inline style so the thumbnail does not touch the text, and add the import:

```tsx
import { ExerciseImage } from '@/features/train/components/ExerciseImage'
```

Leave the STIM meter, the `+` icon, the `Hozzáadva ✓` flash and the sibling `<VideoDemo>` exactly as they are.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && pnpm vitest run src/features/train/sheets/ExercisePickerSheet.test.tsx`
Expected: PASS, all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/sheets/ExercisePickerSheet.tsx frontend/src/features/train/sheets/ExercisePickerSheet.test.tsx
git commit -m "feat(train): exercise picker rows lead with the demo thumbnail (mezo-8xdl.4)"
```

---

### Task 4: Prep card — thumbnail before the name block

**Files:**
- Modify: `frontend/src/features/train/components/PrepExerciseCard.tsx`
- Test: `frontend/src/features/train/components/PrepExerciseCard.test.tsx`

**Interfaces:**
- Consumes: `LoggedWorkoutExercise.imageStartUrl` / `.imageEndUrl` from Task 1; `ExerciseImage` (same signature as Task 2).
- Produces: nothing.

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/features/train/components/PrepExerciseCard.test.tsx` (reuse the file's existing exercise fixture builder — read it first):

```tsx
test('the prep card leads with the exercise thumbnail when the catalog resolved one', () => {
  const { container } = render(
    <PrepExerciseCard
      exercise={{ ...baseExercise, imageStartUrl: '/exercises/hip-thrust-a.jpg', imageEndUrl: '/exercises/hip-thrust-b.jpg' }}
      oneRmKg={null}
      accentChallenge={null}
    />,
  )
  expect(container.querySelector('img.exdemo-thumb')).not.toBeNull()
})

test('the prep card falls back to the muscle tile when there is no image', () => {
  const { container } = render(
    <PrepExerciseCard exercise={baseExercise} oneRmKg={null} accentChallenge={null} />,
  )
  const tile = container.querySelector('.exdemo-thumb')
  expect(tile).not.toBeNull()
  expect(tile!.tagName).toBe('DIV')
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && pnpm vitest run src/features/train/components/PrepExerciseCard.test.tsx -t "thumbnail"`
Expected: FAIL — no `.exdemo-thumb` in the card.

- [ ] **Step 3: Implement**

Inside the card body, make the thumbnail the first child of the head row (the `<div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>`), before the `<div className="col" …>` name block:

```tsx
          <ExerciseImage
            start={e.imageStartUrl}
            end={e.imageEndUrl}
            name={e.name}
            muscle={e.muscle}
            variant="thumb"
          />
```

Change that row's `alignItems` from `'flex-start'` to `'center'` so the 44px tile sits level with the name, and add the import:

```tsx
import { ExerciseImage } from '@/features/train/components/ExerciseImage'
```

Leave the 1RM badge, the challenge line and the pill row untouched.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && pnpm vitest run src/features/train/components/PrepExerciseCard.test.tsx`
Expected: PASS, all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/components/PrepExerciseCard.tsx frontend/src/features/train/components/PrepExerciseCard.test.tsx
git commit -m "feat(train): prep cards lead with the demo thumbnail (mezo-8xdl.4)"
```

---

### Task 5: Active workout — a `⛶ Kép` chip that reveals the hero

Mid-set the screen belongs to logging, so the image is hidden until asked for, exactly like the video.

**Files:**
- Modify: `frontend/src/features/train/pages/ActiveWorkoutPage.tsx` (around the existing `VideoDemo` block, ~line 1260)
- Test: `frontend/src/features/train/pages/ActiveWorkoutPage.test.tsx`

**Interfaces:**
- Consumes: `LoggedWorkoutExercise.imageStartUrl` / `.imageEndUrl` from Task 1; `ExerciseImage` with `variant="hero"` (renders the two-frame crossfade `figure.exdemo`, and `null` when `start` is absent).
- Produces: nothing.

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/features/train/pages/ActiveWorkoutPage.test.tsx` (reuse the file's existing render helper and its real-mode MSW setup — read them first; the current exercise must carry `imageStartUrl`):

```tsx
test('the active exercise hides its demo still behind a chip', async () => {
  renderView()
  const chip = await screen.findByRole('button', { name: 'Kép' })
  // Nothing is shown until asked for — mid-set the screen belongs to logging.
  expect(document.querySelector('.exdemo')).toBeNull()
  await userEvent.click(chip)
  expect(document.querySelector('.exdemo')).not.toBeNull()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && pnpm vitest run src/features/train/pages/ActiveWorkoutPage.test.tsx -t "demo still"`
Expected: FAIL — no button named `Kép`.

- [ ] **Step 3: Implement**

Add local state near the other `useState` calls in the component:

```tsx
  const [imageOpen, setImageOpen] = useState(false)
```

Replace the existing demo-video block with a row that carries both affordances:

```tsx
          {/* Inline demo media (catalog-resolved). The video wrapper renders only when a real
              YouTube id is extractable; the still is tap-to-reveal so it never steals the
              logging surface mid-set (mezo-8xdl.4). */}
          {current.imageStartUrl && (
            <div className="mt-sm">
              <button
                type="button"
                className="chip"
                aria-expanded={imageOpen}
                onClick={() => setImageOpen((v) => !v)}
              >
                ⛶ Kép
              </button>
              {imageOpen && (
                <div className="mt-sm">
                  <ExerciseImage
                    start={current.imageStartUrl}
                    end={current.imageEndUrl}
                    name={current.name}
                    muscle={current.muscle}
                  />
                </div>
              )}
            </div>
          )}
          {current.videoUrl && youTubeId(current.videoUrl) && (
            <div className="mt-sm">
              <VideoDemo url={current.videoUrl} />
            </div>
          )}
```

Add the import:

```tsx
import { ExerciseImage } from '@/features/train/components/ExerciseImage'
```

**Reset the toggle when the viewed exercise changes** — otherwise the image stays open across an advance. Add next to the other `viewedId` effects:

```tsx
  useEffect(() => { setImageOpen(false) }, [current.id])
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && pnpm vitest run src/features/train/pages/ActiveWorkoutPage.test.tsx`
Expected: PASS, all tests in the file (it is a large file — every existing test must still pass).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/pages/ActiveWorkoutPage.tsx frontend/src/features/train/pages/ActiveWorkoutPage.test.tsx
git commit -m "feat(train): tap-to-reveal demo still on the active exercise (mezo-8xdl.4)"
```

---

### Task 6: Full gate, visual goldens, docs

**Files:**
- Modify: `frontend/tests/visual/visual.spec.ts-snapshots/*-darwin.png` (only the screens this change moves)
- Modify: `docs/features/train.md` (§2 the four surfaces, §10 unchanged — no new files)

**Interfaces:**
- Consumes: everything from Tasks 1–5.
- Produces: a green branch ready for the self-PR.

- [ ] **Step 1: Run the full gate**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: build clean, both modes green. Fix, don't skip.

- [ ] **Step 2: Check which visual goldens moved**

Run: `cd frontend && pnpm test:visual`
Expected: FAIL on `train-session` (the active workout gained a chip) and possibly `train` / `train-gym` if a shared surface shifted. **Do not blanket-update.** For each failing screen, open `frontend/test-results/visual-*/…-diff.png` and confirm the diff is this change. `train-session` also carries a pre-existing darwin drift — absorbing it here is expected and legitimate, because this change is the first to touch that screen.

- [ ] **Step 3: Re-baseline only the screens this change moves**

```bash
cd frontend && pnpm test:visual:update -g "train-session"
```
Add other screens only if Step 2 proved they are this change's doing.

- [ ] **Step 4: Update the feature doc**

In `docs/features/train.md`, extend the `mezo-8xdl` paragraph in §4 (the "Demo stills" bullet) with a sentence naming the four wired surfaces and the tap-to-reveal rule on the active workout, and bump the frontmatter `updated:` to today. Then:

```bash
node scripts/lint-docs.mjs
```
Expected: `docs/features/train.md` shows `(no findings)`.

- [ ] **Step 5: Commit**

```bash
git add frontend/tests/visual docs/features/train.md
git commit -m "test(visual): re-baseline the darwin goldens the demo stills move + doc the four surfaces (mezo-8xdl.4)"
```

- [ ] **Step 6: Report back — do NOT push**

Report: which goldens moved and why, both test-mode counts, and anything that deviated from this plan. The orchestrator owns the linux re-baseline (`gh workflow run update-visual-baselines.yml -r <branch>`), the PR, and the merge.
