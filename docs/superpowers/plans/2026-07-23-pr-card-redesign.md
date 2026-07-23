# PR Card Redesign Implementation Plan (mezo-kaui)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the ExercisesPage record/ghost cards as variant-A three-zone cards (muscle-color rail, pill row, stat strip) with the video/edit actions integrated into the card and delete relocated into `CatalogExerciseSheet`.

**Architecture:** Frontend-only. A new pure-logic muscle→color-token map feeds the card visuals; `RecordRow`/`GhostRow` are rewritten in place; the detached `RowActions` component is deleted. No data-layer, API, or backend change — every displayed value already ships in `ExerciseRecordResponse`.

**Tech Stack:** React 19 + Vite + Vitest/RTL + MSW (real-mode fixtures), CSS custom-property tokens from `prototype.css`.

**Spec:** `docs/superpowers/specs/2026-07-23-pr-card-redesign-design.md`

## Global Constraints

- Branch `feat/pr-card-redesign`, bd issue `mezo-kaui`; conventional commit subjects end with `(mezo-kaui)`.
- Follow `docs/references/frontend_conventions.md`: deep `@/*` imports, no barrels, tests colocated, pure logic in `features/train/logic/`.
- Colors via existing CSS tokens only. One deliberate exception: the filled plyo pill's text is literal `#2B2118` (warm ink) because `--ink` flips light in dark mode while `--amber` stays bright in both themes.
- Aria-labels preserved verbatim: `Videó szerkesztése` / `Videó hozzáadása` / `Gyakorlat szerkesztése` / `Gyakorlat törlése` (the last one moves into the sheet).
- Gate for every task: the commands listed in the task; final gate `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` (both modes green).
- All frontend commands run under `frontend/` with `pnpm`.

---

### Task 1: `muscleColors.ts` — muscle→color-family map

**Files:**
- Create: `frontend/src/features/train/logic/muscleColors.ts`
- Test: `frontend/src/features/train/logic/muscleColors.test.ts`

**Interfaces:**
- Consumes: nothing (pure module).
- Produces: `export interface MuscleColorFamily { rail: string; wash: string; deep: string }` and `export function muscleColor(muscle: string): MuscleColorFamily` — used by Task 2's `RecordRow`/`GhostRow`. All three values are `var(--…)` CSS custom-property references.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/features/train/logic/muscleColors.test.ts
import { describe, expect, it } from 'vitest'
import { muscleColor } from '@/features/train/logic/muscleColors'

describe('muscleColor', () => {
  it('maps chest to the coral family', () => {
    expect(muscleColor('chest')).toEqual({
      rail: 'var(--coral)', wash: 'var(--wash-gym)', deep: 'var(--tag-gym)',
    })
  })
  it('maps every back muscle (incl. legacy "back") to the sky family', () => {
    for (const m of ['back-mid', 'lats', 'traps', 'back']) {
      expect(muscleColor(m).rail).toBe('var(--sky)')
    }
  })
  it('maps shoulders to lav, arms to rose, legs to sage, core to amber', () => {
    expect(muscleColor('shoulder').rail).toBe('var(--lav)')
    expect(muscleColor('rear-delt').rail).toBe('var(--lav)')
    expect(muscleColor('biceps').rail).toBe('var(--rose)')
    expect(muscleColor('triceps').rail).toBe('var(--rose)')
    for (const m of ['quad', 'ham', 'glute', 'calf']) {
      expect(muscleColor(m).rail).toBe('var(--sage)')
    }
    expect(muscleColor('core').rail).toBe('var(--amber)')
  })
  it('falls back to neutral tokens for unknown keys', () => {
    expect(muscleColor('unknown-muscle')).toEqual({
      rail: 'var(--text-tertiary)', wash: 'var(--surface-2)', deep: 'var(--text-secondary)',
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm vitest run src/features/train/logic/muscleColors.test.ts`
Expected: FAIL — cannot resolve `@/features/train/logic/muscleColors`.

- [ ] **Step 3: Write the implementation**

```ts
// frontend/src/features/train/logic/muscleColors.ts
// ============================================================
// Mezo · muscleColors — muscle key → color-family tokens for the Train
// exercise cards (mezo-kaui PR-card redesign). 13 live catalog muscles
// (ck_exercise_catalog_muscle) + legacy 'back' → 6 existing token families;
// unknown keys get a neutral fallback. Values are CSS custom-property
// references so both themes work with zero new tokens.
// ============================================================

export interface MuscleColorFamily {
  rail: string // 5px card rail + STIM ticks
  wash: string // pill / rank-plaque / play-roundel background
  deep: string // pill / rank-plaque / play-roundel text
}

const FAMILIES = {
  coral: { rail: 'var(--coral)', wash: 'var(--wash-gym)', deep: 'var(--tag-gym)' },
  sky: { rail: 'var(--sky)', wash: 'var(--wash-run)', deep: 'var(--tag-run)' },
  lav: { rail: 'var(--lav)', wash: 'var(--wash-lav)', deep: 'var(--lav-deep)' },
  rose: { rail: 'var(--rose)', wash: 'var(--wash-sport)', deep: 'var(--tag-sport)' },
  sage: { rail: 'var(--sage)', wash: 'var(--wash-sage)', deep: 'var(--sage-deep)' },
  amber: { rail: 'var(--amber)', wash: 'var(--wash-amber)', deep: 'var(--amber-deep)' },
  neutral: { rail: 'var(--text-tertiary)', wash: 'var(--surface-2)', deep: 'var(--text-secondary)' },
} as const satisfies Record<string, MuscleColorFamily>

const MUSCLE_FAMILY: Record<string, keyof typeof FAMILIES> = {
  chest: 'coral',
  'back-mid': 'sky', lats: 'sky', traps: 'sky', back: 'sky',
  shoulder: 'lav', 'rear-delt': 'lav',
  biceps: 'rose', triceps: 'rose',
  quad: 'sage', ham: 'sage', glute: 'sage', calf: 'sage',
  core: 'amber',
}

export function muscleColor(muscle: string): MuscleColorFamily {
  return FAMILIES[MUSCLE_FAMILY[muscle] ?? 'neutral']
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm vitest run src/features/train/logic/muscleColors.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/logic/muscleColors.ts frontend/src/features/train/logic/muscleColors.test.ts
git commit -m "feat(train): muscle→color-family token map for exercise cards (mezo-kaui)"
```

---

### Task 2: ExercisesPage card rewrite (RecordRow, GhostRow, RowActions removal)

**Files:**
- Modify: `frontend/src/features/train/pages/ExercisesPage.tsx` (full rewrite of `RowActions`→deleted, `RecordRow`, `GhostRow`, and their call sites; header comment updated)
- Test: `frontend/src/features/train/pages/ExercisesPage.test.tsx`

**Interfaces:**
- Consumes: `muscleColor(muscle: string): MuscleColorFamily` from Task 1; existing `useTrain()`, `MUSCLE_LABELS`, `ExerciseRecordSheet`, `CatalogExerciseSheet`, `VideoUrlSheet`.
- Produces: page-local components only. `RecordRow` props: `{ record, rank, lib, onOpen, onVideo, onEdit }`; `GhostRow` props: `{ item, onVideo, onEdit }` (`onVideo`/`onEdit` optional — roundel rendered only when present). The page no longer calls `deleteCatalogExercise` (Task 3 moves it into the sheet), but keeps `setCatalog({ edit })` wiring for the ⋯ roundel.

- [ ] **Step 1: Update the test file to the new card contract (failing first)**

Replace the affected tests in `frontend/src/features/train/pages/ExercisesPage.test.tsx`. Tests to REPLACE (same names unless noted):

```tsx
test('default state ranks top exercises with best set and e1RM chip', async () => {
  renderView()
  expect(await screen.findByText('Top gyakorlatok · rekordjaid')).toBeInTheDocument()
  const row = await screen.findByRole('button', { name: /Chest Supported Row/ })
  expect(within(row).getByText('1')).toBeInTheDocument()          // rank plaque (was '01')
  expect(within(row).getByText('102.5×9')).toBeInTheDocument()    // Legjobb szett cell
  expect(within(row).getByText('133.3 kg')).toBeInTheDocument()   // e1RM cell
  expect(within(row).getByText('182.5 t')).toBeInTheDocument()    // Összvolumen cell
  expect(within(row).getByText('Hát (közép)')).toBeInTheDocument()// muscle pill
  expect(within(row).getByText('21 alkalom')).toBeInTheDocument() // sessions pill
  expect(within(row).getByText('Saját')).toBeInTheDocument()      // editable badge
  // bodyweight (plyo) record: rep-based stat cells + filled plyo pill
  const plyoRow = screen.getByRole('button', { name: /Box Jump/ })
  expect(within(plyoRow).getByText('Max rep')).toBeInTheDocument()
  expect(within(plyoRow).getByText('12')).toBeInTheDocument()     // max reps from recentTopSets
  expect(within(plyoRow).getByText('186')).toBeInTheDocument()    // Összes rep
  expect(within(plyoRow).getByText(/Plyo/)).toBeInTheDocument()   // ⚡ Plyo pill
})
```

```tsx
test('an editable record row exposes the ⋯ edit roundel but no page-level delete', async () => {
  renderView()
  await screen.findByRole('button', { name: /Chest Supported Row/ })
  expect(screen.getByRole('button', { name: 'Gyakorlat szerkesztése' })).toBeInTheDocument()
  // delete moved into CatalogExerciseSheet (Task 3) — no longer on the page
  expect(screen.queryByRole('button', { name: 'Gyakorlat törlése' })).not.toBeInTheDocument()
})
```

DELETE the old test `'deleting an owned row issues the delete request'` (Task 3 re-adds the flow through the sheet). Keep every other existing test untouched — `search merges…`, `plyo chip filters…`, `tapping a record row…`, `empty records…`, header/create-sheet, video affordance tests (aria-labels unchanged), skeleton and mock-mode describe blocks all stay as they are.

- [ ] **Step 2: Run the file to verify the new assertions fail**

Run: `cd frontend && pnpm vitest run src/features/train/pages/ExercisesPage.test.tsx`
Expected: FAIL — `'1'` plaque / `'133.3 kg'` / `'Max rep'` not found (old card renders `01`, `e1RM 133.3` chip).

- [ ] **Step 3: Rewrite the card components in `ExercisesPage.tsx`**

Replace the header comment block (lines 1–9) with:

```tsx
// ============================================================
// Mezo · ExercisesPage (Gyakorlatok) — searchable exercise explorer + records.
// Default state: "Top gyakorlatok" ranked by sessionCount (backend order).
// Active search/filter switches to full-catalog results: record rows first,
// then dashed ghost rows for catalog items without history (STIM meter).
// Cards are variant-A three-zone cards (mezo-kaui): muscle-color rail +
// rank plaque + name + integrated ▶/⋯ roundels · colored pill row (filled
// amber plyo pill) · 3-cell stat strip (weighted vs bodyweight branch).
// Tapping a record row opens ExerciseRecordSheet; ⋯ opens CatalogExerciseSheet
// (edit + delete live there); ▶ opens VideoUrlSheet. Mock mode has no set
// history -> records are empty, the catalog search still works.
// ============================================================
```

Add the import and replace `RowActions`/`RecordRow`/`GhostRow` with:

```tsx
import { useState, type ReactNode } from 'react'   // extend the existing react import
import { muscleColor } from '@/features/train/logic/muscleColors'

const num = (n: number) => (Math.round(n * 10) / 10).toString().replace(/\.0$/, '')
// Σ volume, whole kg from the API → "4.2 t" above a tonne, "860 kg" below.
// num() (Math.round-based) avoids toFixed's float-drift on values like 182.45.
const fmtVolume = (kg: number) => (kg >= 1000 ? `${num(kg / 1000)} t` : `${kg} kg`)
// Best single-set rep count for the bodyweight stat branch: repRecords first
// (all-time records), recentTopSets as fallback (bodyweight rows can ship
// empty repRecords — see the Box Jump fixture), else null → em dash.
const maxRep = (r: ExerciseRecordResponse): number | null => {
  const src = r.repRecords.length ? r.repRecords : r.recentTopSets
  return src.length ? Math.max(...src.map((s) => s.reps)) : null
}

// Mono uppercase pill — the card's secondary-info unit (muscle/type/sessions/Saját).
function Pill({ bg, color, children }: { bg: string; color: string; children: ReactNode }) {
  return (
    <span
      className="label-mono"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 999,
        padding: '4px 9px', fontSize: 8.5, fontWeight: 700, letterSpacing: '0.05em',
        textTransform: 'uppercase', whiteSpace: 'nowrap', background: bg, color,
      }}
    >
      {children}
    </span>
  )
}

// One cell of the hairline-topped stat strip (label over value).
function StatCell({ label, value, color, first }: {
  label: string; value: string; color?: string; first?: boolean
}) {
  return (
    <div style={{ flex: 1, ...(first ? {} : { borderLeft: '1px solid var(--border-subtle)', paddingLeft: 12 }) }}>
      <div className="label-mono text-tertiary" style={{ fontSize: 7.5 }}>{label}</div>
      <div className="label-mono" style={{ fontSize: 15, fontWeight: 700, marginTop: 2, color: color ?? 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  )
}

// Round icon button (▶ video / ⋯ edit) — sits over the card, outside the open-button
// so we never nest <button> in <button>.
function Roundel({ label, onClick, bg, color, size = 30, children }: {
  label: string; onClick: () => void; bg: string; color: string; size?: number; children: ReactNode
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      style={{
        width: size, height: size, borderRadius: 999, border: 'none', flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: bg, color, fontSize: 10, fontWeight: 700,
      }}
    >
      {children}
    </button>
  )
}

function RecordRow({ record, rank, lib, onOpen, onVideo, onEdit }: {
  record: ExerciseRecordResponse
  rank: number | null
  lib?: ExerciseLibraryItem
  onOpen: () => void
  onVideo?: () => void
  onEdit?: () => void
}) {
  const r = record
  const mc = muscleColor(r.muscle)
  const weighted = r.bestSet?.weightKg != null
  const best = maxRep(r)
  // reserve header space for the absolutely-positioned roundels
  const actionPad = onEdit && onVideo ? 66 : onVideo || onEdit ? 34 : 0
  return (
    <div className="card" style={{ display: 'flex', overflow: 'hidden' }}>
      <div style={{ width: 5, background: mc.rail, flexShrink: 0 }} aria-hidden="true" />
      <div style={{ flex: 1, position: 'relative', padding: '14px 14px 12px' }}>
        <button onClick={onOpen} style={{ display: 'block', width: '100%', textAlign: 'left' }}>
          <div className="row" style={{ alignItems: 'center', gap: 10, paddingRight: actionPad }}>
            {rank != null && (
              <span
                className="label-mono"
                style={{
                  width: 26, height: 26, borderRadius: 8, background: mc.wash, color: mc.deep,
                  fontSize: 11, fontWeight: 800, display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                {rank}
              </span>
            )}
            <span style={{ fontFamily: 'var(--ff-display)', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
              {r.name}
            </span>
          </div>
          <div className="row" style={{ gap: 6, margin: '10px 0 12px', flexWrap: 'wrap' }}>
            <Pill bg={mc.wash} color={mc.deep}>{MUSCLE_LABELS[r.muscle] ?? r.muscle}</Pill>
            {r.type === 'plyo' ? (
              // --amber is bright in BOTH themes; --ink flips → deliberate literal warm ink.
              <Pill bg="var(--amber)" color="#2B2118">⚡ Plyo</Pill>
            ) : (
              <Pill bg="var(--surface-2)" color="var(--text-secondary)">{r.type}</Pill>
            )}
            <Pill bg="var(--surface-2)" color="var(--text-secondary)">{r.sessionCount} alkalom</Pill>
            {lib?.editable && <Pill bg="var(--wash-amber)" color="var(--coral-deep)">Saját</Pill>}
          </div>
          <div className="row" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
            {weighted ? (
              <>
                <StatCell first label="Legjobb szett" value={`${num(r.bestSet!.weightKg!)}×${r.bestSet!.reps}`} />
                <StatCell
                  label="e1RM"
                  value={r.bestE1rm ? `${num(r.bestE1rm.value)} kg` : '—'}
                  color={r.bestE1rm ? 'var(--coral-deep)' : undefined}
                />
                <StatCell label="Összvolumen" value={fmtVolume(r.totalVolume)} />
              </>
            ) : (
              <>
                <StatCell first label="Max rep" value={best != null ? String(best) : '—'} />
                <StatCell label="Összes rep" value={String(r.totalReps)} />
                <StatCell label="Szettek" value={String(r.totalSets)} />
              </>
            )}
          </div>
        </button>
        <div className="row gap-xs" style={{ position: 'absolute', top: 12, right: 12 }}>
          {onEdit && (
            <Roundel label="Gyakorlat szerkesztése" onClick={onEdit} bg="var(--surface-2)" color="var(--text-secondary)" size={26}>
              ⋯
            </Roundel>
          )}
          {onVideo && (
            <Roundel
              label={lib?.videoUrl ? 'Videó szerkesztése' : 'Videó hozzáadása'}
              onClick={onVideo}
              bg={lib?.videoUrl ? mc.wash : 'var(--surface-2)'}
              color={lib?.videoUrl ? mc.deep : 'var(--text-quaternary)'}
            >
              ▶
            </Roundel>
          )}
        </div>
      </div>
    </div>
  )
}

function GhostRow({ item, onVideo, onEdit }: {
  item: ExerciseLibraryItem
  onVideo?: () => void
  onEdit?: () => void
}) {
  const mc = muscleColor(item.muscle)
  return (
    <div
      style={{
        display: 'flex', overflow: 'hidden', borderRadius: 20,
        border: '1px dashed var(--border-strong)', opacity: 0.85,
      }}
    >
      <div style={{ width: 5, background: mc.rail, opacity: 0.45, flexShrink: 0 }} aria-hidden="true" />
      <div style={{ flex: 1, padding: '13px 14px' }}>
        <div className="row" style={{ alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--ff-display)', fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)', flex: 1 }}>
            {item.name}
          </span>
          <div style={{ textAlign: 'right' }}>
            <div className="label-mono" style={{ fontSize: 7.5, color: mc.deep }}>Stim</div>
            <div className="row gap-xs" style={{ marginTop: 3 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} style={{ width: 5, height: 9, background: n / 5 <= item.stim ? mc.rail : 'var(--surface-3)' }} />
              ))}
            </div>
          </div>
          {onEdit && (
            <Roundel label="Gyakorlat szerkesztése" onClick={onEdit} bg="var(--surface-2)" color="var(--text-secondary)" size={26}>
              ⋯
            </Roundel>
          )}
          {onVideo && (
            <Roundel
              label={item.videoUrl ? 'Videó szerkesztése' : 'Videó hozzáadása'}
              onClick={onVideo}
              bg={item.videoUrl ? mc.wash : 'var(--surface-2)'}
              color={item.videoUrl ? mc.deep : 'var(--text-quaternary)'}
              size={26}
            >
              ▶
            </Roundel>
          )}
        </div>
        <div className="row" style={{ gap: 6, marginTop: 8 }}>
          <Pill bg={mc.wash} color={mc.deep}>{MUSCLE_LABELS[item.muscle] ?? item.muscle}</Pill>
          <Pill bg="var(--surface-2)" color="var(--text-tertiary)">Még nincs rekord</Pill>
        </div>
      </div>
    </div>
  )
}
```

Replace the two call sites in the page body (the `records.map` / `ghosts.map` blocks) with:

```tsx
{records.map((r, i) => {
  const lib = r.catalogId ? exerciseLibrary.find((e) => e.catalogId === r.catalogId) : undefined
  return (
    <RecordRow
      key={r.catalogId ?? r.name}
      record={r}
      rank={searching ? null : i + 1}
      lib={lib}
      onOpen={() => setOpenRecord(r)}
      onVideo={lib ? () => setVideoFor({ id: lib.catalogId ?? lib.id, name: lib.name, videoUrl: lib.videoUrl ?? null }) : undefined}
      onEdit={lib?.editable ? () => setCatalog({ edit: lib }) : undefined}
    />
  )
})}
{ghosts.map((g) => (
  <GhostRow
    key={g.id}
    item={g}
    onVideo={g.catalogId ? () => setVideoFor({ id: g.catalogId ?? g.id, name: g.name, videoUrl: g.videoUrl ?? null }) : undefined}
    onEdit={g.editable ? () => setCatalog({ edit: g }) : undefined}
  />
))}
```

Also in `ExercisesPage()`: remove `deleteCatalogExercise` from the `useTrain()` destructure (the page no longer deletes), delete the whole `RowActions` function, and drop the now-unused `Icon` import **only if** nothing else in the file uses it (the search bar and header still use `Icon` — keep it).

- [ ] **Step 4: Run the page tests**

Run: `cd frontend && pnpm vitest run src/features/train/pages/ExercisesPage.test.tsx`
Expected: PASS (all tests, both describe blocks).

- [ ] **Step 5: Run both full modes for regressions**

Run: `cd frontend && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: PASS. If another suite asserts on removed markup (e.g. `▶ Videó` chip text), update that assertion to the new roundel aria-labels.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/train/pages/ExercisesPage.tsx frontend/src/features/train/pages/ExercisesPage.test.tsx
git commit -m "feat(train): variant-A three-zone PR cards — muscle rail, pills, stat strip, integrated actions (mezo-kaui)"
```

---

### Task 3: Delete moves into `CatalogExerciseSheet` (edit mode, confirm step)

**Files:**
- Modify: `frontend/src/features/train/sheets/CatalogExerciseSheet.tsx`
- Test: `frontend/src/features/train/pages/ExercisesPage.test.tsx` (flow test), `frontend/src/features/train/sheets/CatalogExerciseSheet.test.tsx` (create-mode guard)

**Interfaces:**
- Consumes: `deleteCatalogExercise(id: string, opts?: MutateOpts)` from `useTrain()` (already exists — `frontend/src/data/train/trainHooks.ts:254`); the sheet's existing `edit?: ExerciseLibraryItem` prop and `close` render-prop callback.
- Produces: a `Gyakorlat törlése` button inside the sheet (edit mode only) with a two-tap confirm.

- [ ] **Step 1: Write the failing flow test (ExercisesPage.test.tsx)**

```tsx
test('deleting an owned row goes through the edit sheet with a confirm step', async () => {
  let deleted = ''
  server.use(
    http.delete(`${API_BASE}/api/train/exercises/:id`, ({ params }) => {
      deleted = String(params.id)
      return new HttpResponse(null, { status: 204 })
    }),
  )
  renderView()
  await screen.findByRole('button', { name: /Chest Supported Row/ })
  await userEvent.click(screen.getByRole('button', { name: 'Gyakorlat szerkesztése' }))
  const del = await screen.findByRole('button', { name: 'Gyakorlat törlése' })
  await userEvent.click(del)                      // first tap: arm
  expect(deleted).toBe('')                        // not deleted yet
  await userEvent.click(screen.getByRole('button', { name: 'Gyakorlat törlése' })) // confirm
  await waitFor(() => expect(deleted).toBe('f1e3a0e2-0000-4000-8000-000000000070'))
})
```

And the create-mode guard in `CatalogExerciseSheet.test.tsx` (match the file's existing render helper/idiom):

```tsx
test('create mode shows no delete button', async () => {
  renderSheet() // the file's existing create-mode render helper
  expect(screen.queryByRole('button', { name: 'Gyakorlat törlése' })).toBeNull()
})
```

- [ ] **Step 2: Run to verify both fail**

Run: `cd frontend && pnpm vitest run src/features/train/pages/ExercisesPage.test.tsx src/features/train/sheets/CatalogExerciseSheet.test.tsx`
Expected: the new flow test FAILS (`Gyakorlat törlése` not found in the sheet); the create-mode guard passes vacuously — that's fine, it pins the behavior.

- [ ] **Step 3: Implement the delete action in the sheet**

In `CatalogExerciseSheet.tsx`: add `deleteCatalogExercise` to the `useTrain()` destructure, add `const [confirmDelete, setConfirmDelete] = useState(false)` next to the other state, and insert between the Video URL block and the Footer:

```tsx
{/* Delete — edit mode only; two-tap confirm, then the mutation closes the sheet */}
{isEdit && (
  <button
    type="button"
    className="chip"
    aria-label="Gyakorlat törlése"
    onClick={() => {
      if (!confirmDelete) { setConfirmDelete(true); return }
      deleteCatalogExercise(edit.catalogId ?? edit.id, { onSuccess: close })
    }}
    style={{
      alignSelf: 'center', marginTop: 14, background: 'transparent',
      borderColor: 'transparent', color: 'var(--warning)',
    }}
  >
    <Icon name="trash" size={12} color="var(--warning)" />
    {confirmDelete ? 'Biztos? Koppints a törléshez' : 'Gyakorlat törlése'}
  </button>
)}
```

(The block sits inside the `(close) => (…)` render prop, so `close` is in scope. Update the sheet's header comment to mention delete.)

- [ ] **Step 4: Run to verify both pass**

Run: `cd frontend && pnpm vitest run src/features/train/pages/ExercisesPage.test.tsx src/features/train/sheets/CatalogExerciseSheet.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/sheets/CatalogExerciseSheet.tsx frontend/src/features/train/sheets/CatalogExerciseSheet.test.tsx frontend/src/features/train/pages/ExercisesPage.test.tsx
git commit -m "feat(train): move catalog delete into CatalogExerciseSheet with confirm step (mezo-kaui)"
```

---

### Task 4: `ExercisesSkeleton` shape sync

**Files:**
- Modify: `frontend/src/features/train/pages/ExercisesSkeleton.tsx` (card placeholder block only)

**Interfaces:**
- Consumes: `Skeleton`, `SkeletonCard` from `@/shared/ui/Skeleton` (props: `width`, `height`, `radius`, `variant`).
- Produces: nothing new — same `role="status"` contract (the pending test keeps passing).

- [ ] **Step 1: Replace the RecordRow placeholder block**

Replace the `{Array.from({ length: 4 }, …)}` card block with the new three-zone shape:

```tsx
{Array.from({ length: 4 }, (_, i) => (
  <SkeletonCard key={i} style={{ padding: 0, overflow: 'hidden' }}>
    <div className="row" style={{ alignItems: 'stretch' }}>
      <Skeleton width={5} height={104} radius={0} />
      <div className="col gap-sm flex-1" style={{ padding: '14px 14px 12px' }}>
        <div className="row gap-sm" style={{ alignItems: 'center' }}>
          <Skeleton width={26} height={26} radius={8} />
          <Skeleton width="55%" height={15} />
          <div className="flex-1" />
          <Skeleton variant="circle" width={30} height={30} />
        </div>
        <div className="row gap-xs">
          <Skeleton width={54} height={18} radius={999} />
          <Skeleton width={72} height={18} radius={999} />
          <Skeleton width={64} height={18} radius={999} />
        </div>
        <div className="row gap-md">
          <Skeleton width="24%" height={22} />
          <Skeleton width="24%" height={22} />
          <Skeleton width="24%" height={22} />
        </div>
      </div>
    </div>
  </SkeletonCard>
))}
```

Update the file's header comment: the placeholder now mirrors the variant-A card (rail + plaque + name + play roundel · pill row · stat strip).

- [ ] **Step 2: Run the page suite (covers the skeleton pending test)**

Run: `cd frontend && pnpm vitest run src/features/train/pages/ExercisesPage.test.tsx`
Expected: PASS (`shows the skeleton while…` still finds `role="status"`).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/train/pages/ExercisesSkeleton.tsx
git commit -m "feat(train): sync ExercisesSkeleton to the three-zone card shape (mezo-kaui)"
```

---

### Task 5: Gates, runtime smoke, feature doc, push

**Files:**
- Modify: `docs/features/train.md` (Gyakorlatok/ExercisesPage section + key_files staleness)

- [ ] **Step 1: Full local gate**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: build OK, both modes green.

- [ ] **Step 2: Mock-mode runtime smoke (visual)**

Use the project `verify` skill recipe (mock-mode PWA): `VITE_USE_MOCK=true pnpm dev`, navigate to Edzés → Gyakorlatok, type `bench` in the search — ghost cards must show the muscle rail + colored pill + STIM ticks; check one plyo ghost (`jump`) for the filled amber pill. Dark mode toggle: rail/pill/plaque colors stay legible.

- [ ] **Step 3: Update `docs/features/train.md`**

In the Gyakorlatok (ExercisesPage) section, describe: variant-A three-zone card anatomy (muscle-color rail via `features/train/logic/muscleColors.ts`, rank plaque, integrated ▶/⋯ roundels, colored pill row with filled amber plyo pill, weighted vs bodyweight stat strip), delete relocated into `CatalogExerciseSheet` (two-tap confirm), `RowActions` removed. Update `file:line` pointers that moved. Then:

Run: `node scripts/lint-docs.mjs`
Expected: no staleness flag for `train.md`.

- [ ] **Step 4: Commit docs + close out**

```bash
git add docs/features/train.md
git commit -m "docs(train): PR-card redesign — three-zone cards, muscleColors, sheet-level delete (mezo-kaui)"
```

Then the repo flow: push the branch, open the self-PR (CI gate), wait for green, `git pull --rebase` on main, merge `--no-ff`, push, delete branch, `bd close mezo-kaui`, `bd dolt push`.
```bash
git push -u origin feat/pr-card-redesign
gh pr create --fill
# after CI green:
git checkout main && git pull --rebase && git merge --no-ff feat/pr-card-redesign && git push
git branch -d feat/pr-card-redesign && git push origin --delete feat/pr-card-redesign
bd close mezo-kaui && bd dolt push && git push
```
