# W1.3b — Gratitude rows in the ritual `ReflectionStep` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** render the up-to-3 gratitude rows + life-area chip inside Napzárás act 3 (`ReflectionStep`), completing spec §5.2's "combined writing act" — one act, both halves optional — on top of the W1.3 backend seam, unchanged.

**Architecture:** frontend-only. The gratitude row/chip UI is extracted out of `JournalSheet` into a presentational `GratitudeRows` component (no `@/data/*` import) that both callers drive from their own state; `ReflectionStep` mounts it below the prose textarea and, on „Tovább", fire-and-forget-`POST`s each non-empty row through the existing `useGratitudeActions().addEntry`. The act reads today's already-saved entries (`useGratitudeEntries(date, date)`) so a re-entered ritual shows them and offers only the remaining slots — the same seed-discipline the prose half already uses to avoid a redundant write.

**Tech Stack:** React 19 + TypeScript, TanStack Query v5 (`useDualQuery` dual-mode), Vitest + Testing Library + MSW, Vite. No backend, no API contract, no migration.

## Global Constraints

- **bd id on every commit subject:** `(mezo-b3pp.25)`. Conventional-commit subjects.
- **Spec §5.2 / §5.3 (design of record `docs/superpowers/specs/2026-08-18-phase5-deep-memory-personalization-design.md`):** the gratitude rows are the second half of the SAME act — never a seventh act. `ACT_COUNT` stays **6**. Both halves optional. Up to **3** rows a day, optional life-area chip drawn from the 8 LIFE skills. Text ≤ **280** chars (enforced at contract AND column already; the textarea keeps its `maxLength={280}`).
- **IDENT-3 (never silent-broken):** nothing in this act may block or trap the flow. Writes are fire-and-forget with a swallowed rejection; „Ma nem írok" writes **nothing at all**, prose or gratitude.
- **No autosave** anywhere in act 3 — writes happen **on advance only** (`ritual.md` §9: an autosave racing the close can leave a stale reflection vector).
- **`docs/references/frontend_conventions.md` binds:** deep absolute `@/*` imports, no `index.ts` barrels, data hooks only through `@/data/hooks`, `shared/ui` primitives must not import `@/data/*` (which is why `GratitudeRows` lives under `features/me/components/`, next to the sheet it came from, and is imported cross-feature — the `JournalSheet`/`ActivityLogSheet` precedent).
- **Both FE test modes must be green:** `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.
- **Docs in the same change:** `docs/features/journal.md` + `docs/features/ritual.md`, then `node scripts/lint-docs.mjs` with no new staleness.
- **No API change** → no `npm run generate:api` / `pnpm generate:api`. **No backend change** → no `./mvnw` gate.

---

## File Structure

| File | Responsibility |
|---|---|
| **Create** `frontend/src/features/me/components/GratitudeRows.tsx` | Presentational, state-free gratitude capture block: N textareas (capped by `max`), per-row mic, „+ Még egy", the 8 life-area chips, an optional hint. Owns no data hook. |
| **Create** `frontend/src/features/me/components/GratitudeRows.test.tsx` | Unit tests for the extracted block, including the per-row voice target. |
| **Modify** `frontend/src/features/me/sheets/JournalSheet.tsx` | Gratitude mode delegates its rows to `GratitudeRows`; the note/decision branch is untouched. |
| **Modify** `frontend/src/features/ritual/components/ReflectionStep.tsx` | Mounts the gratitude half under the prose; writes the rows on advance. |
| **Modify** `frontend/src/features/ritual/components/ReflectionStep.test.tsx` | New gratitude cases alongside the existing prose truth table. |
| **Modify** `frontend/src/styles/prototype.css` | `.rz-reflect-gratitude` block + `.rz-gratitude-saved` list (act-3 spacing only). |
| **Modify** `docs/features/journal.md`, `docs/features/ritual.md` | Ship-state: W1.3b done, the new component, the seed/slot decision, the new tests. |

---

### Task 1: Extract `GratitudeRows` from `JournalSheet` (and fix the per-row mic)

**Why the mic is part of this task:** in today's `JournalSheet` gratitude mode the row mic is wired to `setText` — the *note* textarea's state, which gratitude mode does not render. A transcription taken while capturing gratitude is written into an invisible box and lost. Extraction forces the callback to have a real target, so the fix lands here rather than being carried forward.

**Files:**
- Create: `frontend/src/features/me/components/GratitudeRows.tsx`
- Create: `frontend/src/features/me/components/GratitudeRows.test.tsx`
- Modify: `frontend/src/features/me/sheets/JournalSheet.tsx`

**Interfaces:**
- Consumes: `LIFE_SKILLS` from `@/features/progression/logic/levelUpMeta`, `useVoiceInput` from `@/features/insights/logic/useVoiceInput`, `Icon`/`cn` from shared.
- Produces (Task 2 relies on exactly this):
  ```ts
  interface GratitudeRowsProps {
    rows: string[]
    onRowsChange: (rows: string[]) => void
    lifeArea: string | null
    onLifeAreaChange: (area: string | null) => void
    /** Hard cap on the number of rows the user may add. Default 3 (spec §5.3, "1–3 lines a day"). */
    max?: number
    /** Focus the first row on mount — the sheet wants it, the ritual act must not steal focus from the prose. */
    autoFocusFirst?: boolean
    /** Small tertiary line under the chips. Omitted → not rendered. */
    hint?: string
  }
  export function GratitudeRows(props: GratitudeRowsProps): JSX.Element
  ```
  Row `aria-label`s stay **`${i + 1}. hálás gondolat`** and the placeholder stays **`${i + 1}. dolog, amiért hálás vagy…`** — the three existing `JournalSheet.test.tsx` gratitude cases query by those strings and must keep passing untouched.

- [ ] **Step 1: Write the failing test** — `frontend/src/features/me/components/GratitudeRows.test.tsx`

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { GratitudeRows } from '@/features/me/components/GratitudeRows'

// `useVoiceInput` talks to getUserMedia/MediaRecorder, neither of which exists under jsdom.
// The stub exposes the transcript callback so the per-row target can be asserted directly —
// which is the point of the extraction (the sheet used to append it to the wrong textarea).
const voice = vi.hoisted(() => ({ onTranscript: null as null | ((t: string) => void) }))
vi.mock('@/features/insights/logic/useVoiceInput', () => ({
  useVoiceInput: (onTranscript: (t: string) => void) => {
    voice.onTranscript = onTranscript
    return { state: 'idle' as const, error: null, toggle: vi.fn() }
  },
}))

/** Drives the component the way both real callers do: the parent owns rows + lifeArea. */
function Harness({ max, onRows }: { max?: number; onRows?: (r: string[]) => void }) {
  const [rows, setRows] = useState<string[]>([''])
  const [lifeArea, setLifeArea] = useState<string | null>(null)
  return (
    <GratitudeRows
      rows={rows}
      onRowsChange={(r) => { setRows(r); onRows?.(r) }}
      lifeArea={lifeArea}
      onLifeAreaChange={setLifeArea}
      max={max}
      hint="1–3 dolog, amiért ma hálás vagy (max. 280 karakter soronként)."
    />
  )
}

describe('GratitudeRows', () => {
  test('renders one row, the hint and the life-area chips', () => {
    render(<Harness />)

    expect(screen.getByLabelText('1. hálás gondolat')).toBeInTheDocument()
    expect(screen.queryByLabelText('2. hálás gondolat')).not.toBeInTheDocument()
    expect(screen.getByText(/1–3 dolog, amiért ma hálás vagy/)).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Life area' })).toBeInTheDocument()
  })

  test('„+ Még egy" adds rows and disappears at the cap', async () => {
    const user = userEvent.setup()
    render(<Harness max={3} />)

    await user.click(screen.getByRole('button', { name: '+ Még egy' }))
    await user.click(screen.getByRole('button', { name: '+ Még egy' }))

    expect(screen.getByLabelText('3. hálás gondolat')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Még egy' })).not.toBeInTheDocument()
  })

  test('honours a max below 3 — the ritual act passes the remaining slots', async () => {
    const user = userEvent.setup()
    render(<Harness max={1} />)

    expect(screen.getByLabelText('1. hálás gondolat')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Még egy' })).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('1. hálás gondolat'), 'x')
    expect(screen.queryByLabelText('2. hálás gondolat')).not.toBeInTheDocument()
  })

  test('a life-area chip toggles on and off', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const chip = screen.getAllByRole('button', { pressed: false })
      .find((b) => /Kapcsolat|Regeneráció|Tudatosság/.test(b.textContent ?? ''))!

    await user.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    await user.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'false')
  })

  test('the transcript lands in the row whose mic was tapped — not in some other box', async () => {
    const user = userEvent.setup()
    const onRows = vi.fn()
    render(<Harness max={3} onRows={onRows} />)

    await user.click(screen.getByRole('button', { name: '+ Még egy' }))
    await user.click(screen.getAllByRole('button', { name: 'Hangbevitel' })[1])
    voice.onTranscript!('Hívott anya')

    expect(onRows).toHaveBeenLastCalledWith(['', 'Hívott anya'])
  })

  test('the transcript APPENDS to what is already typed in that row', async () => {
    const user = userEvent.setup()
    const onRows = vi.fn()
    render(<Harness onRows={onRows} />)

    await user.type(screen.getByLabelText('1. hálás gondolat'), 'Reggeli kávé')
    await user.click(screen.getByRole('button', { name: 'Hangbevitel' }))
    voice.onTranscript!('a teraszon')

    expect(onRows).toHaveBeenLastCalledWith(['Reggeli kávé a teraszon'])
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
cd frontend && pnpm vitest run src/features/me/components/GratitudeRows.test.tsx
```
Expected: FAIL — `Failed to resolve import "@/features/me/components/GratitudeRows"`.

- [ ] **Step 3: Write `frontend/src/features/me/components/GratitudeRows.tsx`**

```tsx
import { useRef, useState } from 'react'
import { Icon } from '@/shared/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { useVoiceInput } from '@/features/insights/logic/useVoiceInput'
import { LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'

interface GratitudeRowsProps {
  rows: string[]
  onRowsChange: (rows: string[]) => void
  lifeArea: string | null
  onLifeAreaChange: (area: string | null) => void
  /** Hard cap on the number of rows the user may add. Default 3 (spec §5.3, "1–3 lines a day"). */
  max?: number
  /** Focus the first row on mount — the sheet wants it, the ritual act must not steal focus. */
  autoFocusFirst?: boolean
  /** Small tertiary line under the chips. Omitted → not rendered. */
  hint?: string
}

/**
 * The gratitude capture block (W1.3, `mezo-b3pp.3`) — up to `max` lines plus one optional
 * life-area chip, shared by `JournalSheet`'s „Hála" mode and Napzárás act 3's `ReflectionStep`
 * (W1.3b, `mezo-b3pp.25`, spec §5.2's combined writing act).
 *
 * Deliberately **state-free and data-free**: the rows, the chosen life area and the save all
 * belong to the caller, because the two callers save at genuinely different moments (the sheet
 * on „Mentem", the ritual act on „Tovább", fire-and-forget). That also keeps this file out of
 * `@/data/*` — the `frontend_conventions.md` rule for a component reused across features.
 *
 * The mic is per row and its target is tracked in a **ref**: `useVoiceInput`'s `onstop` closure
 * captures the transcript callback when recording STARTS (useVoiceInput.ts — `rec.onstop` closes
 * over `finish`, itself memoised on `onTranscript`), so reading the active row out of React state
 * inside the callback would read it as it stood at record-start. Before the extraction the
 * callback wrote into `JournalSheet`'s *note* textarea, which gratitude mode never renders — the
 * transcription simply vanished.
 */
export function GratitudeRows({
  rows,
  onRowsChange,
  lifeArea,
  onLifeAreaChange,
  max = 3,
  autoFocusFirst = false,
  hint,
}: GratitudeRowsProps) {
  // Mirrors for the frozen voice callback (see the doc comment).
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const targetRef = useRef(0)
  const [activeRow, setActiveRow] = useState(0)

  const voice = useVoiceInput((t) => {
    const i = targetRef.current
    const next = [...rowsRef.current]
    next[i] = next[i] ? `${next[i]} ${t}` : t
    onRowsChange(next)
  })
  const recording = voice.state === 'recording'

  const setRow = (i: number, value: string) => {
    const next = [...rows]
    next[i] = value
    onRowsChange(next)
  }

  return (
    <>
      {rows.slice(0, max).map((r, i) => (
        <div key={i} className="card" style={{ padding: 10, position: 'relative' }}>
          <textarea
            value={r}
            onChange={(e) => setRow(i, e.target.value)}
            aria-label={`${i + 1}. hálás gondolat`}
            placeholder={`${i + 1}. dolog, amiért hálás vagy…`}
            maxLength={280}
            autoFocus={autoFocusFirst && i === 0 && rows.length === 1}
            style={{ width: '100%', minHeight: 60, resize: 'none', fontSize: 16, lineHeight: 1.45, paddingRight: 36 }}
          />
          <button
            type="button"
            className={cn('chip', recording && activeRow === i && 'chat-mic-live')}
            style={{
              position: 'absolute', top: 8, right: 8, padding: 8,
              ...(recording && activeRow === i
                ? { background: 'var(--wash-amber)', borderColor: 'var(--coral-deep)', color: 'var(--coral-deep)' }
                : {}),
            }}
            onClick={() => { targetRef.current = i; setActiveRow(i); voice.toggle() }}
            disabled={voice.state === 'unsupported' || voice.state === 'transcribing'}
            aria-label={recording && activeRow === i ? 'Felvétel leállítása' : 'Hangbevitel'}
            aria-pressed={recording && activeRow === i}
          >
            <Icon name={recording && activeRow === i ? 'voice-wave' : 'mic'} size={14} />
          </button>
        </div>
      ))}

      {voice.error && <p className="text-tertiary" style={{ fontSize: 11 }}>{voice.error}</p>}

      {rows.length < max && (
        <button
          type="button"
          className="cta-ghost"
          onClick={() => onRowsChange([...rows, ''])}
          style={{ fontSize: 13 }}
        >
          + Még egy
        </button>
      )}

      <div className="row gap-sm" style={{ flexWrap: 'wrap' }} role="group" aria-label="Life area">
        {LIFE_SKILLS.map((s) => (
          <button
            key={s.key}
            type="button"
            className={cn('chip', lifeArea === s.key && 'chip-active')}
            aria-pressed={lifeArea === s.key}
            onClick={() => onLifeAreaChange(lifeArea === s.key ? null : s.key)}
            style={{ fontSize: 12 }}
          >
            {s.icon} {s.name}
          </button>
        ))}
      </div>

      {hint && <p className="text-tertiary" style={{ fontSize: 11 }}>{hint}</p>}
    </>
  )
}
```

- [ ] **Step 4: Run the new test file — expect PASS**

```bash
cd frontend && pnpm vitest run src/features/me/components/GratitudeRows.test.tsx
```
Expected: 6 passed.

- [ ] **Step 5: Rewire `JournalSheet` to the extracted component**

In `frontend/src/features/me/sheets/JournalSheet.tsx`:

Add the import next to the other feature imports:
```tsx
import { GratitudeRows } from '@/features/me/components/GratitudeRows'
```

Replace the whole `mode === 'gratitude' ? ( … )` JSX branch — everything from the `<>` after the `? (` down to the `</>` before `)` — with:
```tsx
                // Gratitude mode: 1–3 rows with an optional life-area chip (GratitudeRows,
                // shared with the ritual's act-3 writing act — W1.3b, mezo-b3pp.25).
                <GratitudeRows
                  rows={rows}
                  onRowsChange={setRows}
                  lifeArea={lifeArea}
                  onLifeAreaChange={setLifeArea}
                  autoFocusFirst
                  hint="1–3 dolog, amiért ma hálás vagy (max. 280 karakter soronként)."
                />
```

`useVoiceInput`/`voice`/`recording` stay in the file — the note/decision textarea still uses them. `LIFE_SKILLS` and `cn` may become unused in this file; `tsc -b` (`pnpm build`) reports unused imports, so drop whichever the build flags.

- [ ] **Step 6: The sheet's existing gratitude tests must still pass unchanged**

```bash
cd frontend && pnpm vitest run src/features/me/sheets/JournalSheet.test.tsx
```
Expected: PASS, all cases (including `gratitude mode saves every non-empty row with the chosen life area`, `caps at 3 rows`, `Mentem stays disabled when all rows are empty`). If a query broke, the extraction changed a label — fix the component, not the test.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/me/components/GratitudeRows.tsx frontend/src/features/me/components/GratitudeRows.test.tsx frontend/src/features/me/sheets/JournalSheet.tsx
git commit -m "refactor(journal): extract GratitudeRows from JournalSheet; per-row voice target (mezo-b3pp.25)"
```

---

### Task 2: The gratitude half of `ReflectionStep`

**Files:**
- Modify: `frontend/src/features/ritual/components/ReflectionStep.tsx`
- Modify: `frontend/src/features/ritual/components/ReflectionStep.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (after the `.rz-reflect-hint` rule, ~line 2951)

**Interfaces:**
- Consumes: `GratitudeRows` (Task 1), plus `useGratitudeEntries(from, to)` and `useGratitudeActions()` from `@/data/hooks` (already exported at `data/hooks.ts:65`).
- Produces: nothing further downstream; `RitualPage` is untouched and `ACT_COUNT` stays 6.

**The slot rule (the decision this task encodes):** the act reads today's already-saved gratitude entries. They render as a short read-only "már mentve" list, and the input block is capped at `3 − existing.length` remaining slots (none offered at 3). The ritual flow is forward-only, but leaving via ✕ and re-entering replays act 3 from the start — without the read, a second pass would silently duplicate the evening's lines and blow past the spec's "1–3 a day". There is no gratitude `PUT`, so the saved lines are shown, never offered for edit.

- [ ] **Step 1: Write the failing tests** — append to `ReflectionStep.test.tsx`

First extend the existing `vi.mock('@/data/hooks', …)` factory (it currently wraps `useRitualActions` only) so `addEntry` is recorded the same way `saveReflection` is:

```tsx
const spies = vi.hoisted(() => ({ saveReflection: vi.fn(), addEntry: vi.fn() }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useRitualActions: (date: string) => {
      const real = actual.useRitualActions(date)
      return {
        ...real,
        saveReflection: (text: string) => {
          spies.saveReflection(text)
          return real.saveReflection(text)
        },
      }
    },
    useGratitudeActions: () => {
      const real = actual.useGratitudeActions()
      return {
        ...real,
        addEntry: (text: string, lifeArea?: string | null, occurredOn?: string) => {
          spies.addEntry(text, lifeArea, occurredOn)
          return real.addEntry(text, lifeArea, occurredOn)
        },
      }
    },
  }
})
```

Add the MSW/type imports the new block needs, next to the existing ones:

```tsx
import type { GratitudeEntry } from '@/data/journal/journalTypes'
```

And this helper next to `seedPriorProse()` — it must cover BOTH modes, exactly like the prose helper does (mock mode reads the cache, real mode refetches through MSW):

```tsx
/** Give the act N gratitude entries already saved for today, in both modes. */
function seedGratitude(entries: GratitudeEntry[]) {
  qc.setQueryData<GratitudeEntry[]>(['gratitude', today, today], entries)
  server.use(http.get(`${API_BASE}/api/journal/gratitude`, () => HttpResponse.json(entries)))
}

const entry = (id: string, text: string): GratitudeEntry => ({
  id, occurredOn: today, text, lifeArea: null, createdAt: `${today}T20:00:00Z`,
})
```

Then the new `describe` block:

```tsx
describe('ReflectionStep — the gratitude half (W1.3b, mezo-b3pp.25)', () => {
  test('renders one empty gratitude row under the prose', async () => {
    seedGratitude([])
    render(<ReflectionStep onNext={vi.fn()} />, { wrapper })
    await readySettled()

    expect(await screen.findByLabelText('1. hálás gondolat')).toBeInTheDocument()
    expect(screen.getByText('Amiért hálás vagy')).toBeInTheDocument()
    // still the same single act — the prose is right there above it
    expect(screen.getByRole('textbox', { name: /napod/i })).toBeInTheDocument()
  })

  test('„Tovább" saves every non-empty row with the chosen life area, for today', async () => {
    seedGratitude([])
    const user = userEvent.setup()
    const onNext = vi.fn()
    render(<ReflectionStep onNext={onNext} />, { wrapper })
    await readySettled()

    await user.type(await screen.findByLabelText('1. hálás gondolat'), 'Reggeli kávé')
    await user.click(screen.getByRole('button', { name: '+ Még egy' }))
    await user.type(screen.getByLabelText('2. hálás gondolat'), '   ')
    await user.click(screen.getByRole('button', { name: /Kapcsolat/ }))
    await user.click(screen.getByRole('button', { name: 'Tovább' }))

    expect(onNext).toHaveBeenCalledTimes(1)
    expect(spies.addEntry).toHaveBeenCalledTimes(1)
    expect(spies.addEntry).toHaveBeenCalledWith('Reggeli kávé', 'connection', today)
  })

  test('the prose and the rows are independent — either half alone is enough', async () => {
    seedGratitude([])
    const user = userEvent.setup()
    render(<ReflectionStep onNext={vi.fn()} />, { wrapper })
    await readySettled()

    await user.type(await screen.findByLabelText('1. hálás gondolat'), 'Hívott anya')
    await user.click(screen.getByRole('button', { name: 'Tovább' }))

    expect(spies.addEntry).toHaveBeenCalledWith('Hívott anya', null, today)
    expect(spies.saveReflection).not.toHaveBeenCalled()
  })

  test('„Ma nem írok" writes NOTHING — not the prose, not the rows', async () => {
    seedGratitude([])
    const user = userEvent.setup()
    render(<ReflectionStep onNext={vi.fn()} />, { wrapper })
    await readySettled()

    await user.type(screen.getByRole('textbox', { name: /napod/i }), 'Mégsem.')
    await user.type(await screen.findByLabelText('1. hálás gondolat'), 'Mégsem ez.')
    await user.click(screen.getByRole('button', { name: 'Ma nem írok' }))

    expect(spies.saveReflection).not.toHaveBeenCalled()
    expect(spies.addEntry).not.toHaveBeenCalled()
  })

  test('advancing with only whitespace in the rows writes no entry', async () => {
    seedGratitude([])
    const user = userEvent.setup()
    render(<ReflectionStep onNext={vi.fn()} />, { wrapper })
    await readySettled()

    await user.type(await screen.findByLabelText('1. hálás gondolat'), '   ')
    await user.click(screen.getByRole('button', { name: 'Tovább' }))

    expect(spies.addEntry).not.toHaveBeenCalled()
  })

  test('today already-saved entries are shown, and only the remaining slots are offered', async () => {
    seedGratitude([entry('g-a', 'Sütött a nap'), entry('g-b', 'Jó edzés')])
    const user = userEvent.setup()
    render(<ReflectionStep onNext={vi.fn()} />, { wrapper })
    await readySettled()

    expect(await screen.findByText('Sütött a nap')).toBeInTheDocument()
    expect(screen.getByText('Jó edzés')).toBeInTheDocument()
    // 3 − 2 = one slot left, so no „+ Még egy"
    expect(screen.getByLabelText('1. hálás gondolat')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Még egy' })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('1. hálás gondolat'), 'A harmadik')
    await user.click(screen.getByRole('button', { name: 'Tovább' }))
    expect(spies.addEntry).toHaveBeenCalledTimes(1)
  })

  test('with three already saved, the act offers no row at all — a re-entered ritual cannot duplicate the evening', async () => {
    seedGratitude([entry('g-a', 'Egy'), entry('g-b', 'Kettő'), entry('g-c', 'Három')])
    const user = userEvent.setup()
    render(<ReflectionStep onNext={vi.fn()} />, { wrapper })
    await readySettled()

    expect(await screen.findByText('Ma már mind a három hálabejegyzésed megvan.')).toBeInTheDocument()
    expect(screen.queryByLabelText('1. hálás gondolat')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tovább' }))
    expect(spies.addEntry).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run them and confirm they fail**

```bash
cd frontend && pnpm vitest run src/features/ritual/components/ReflectionStep.test.tsx
```
Expected: the 7 new cases FAIL (`Unable to find a label with the text of: 1. hálás gondolat`); the 10 existing prose cases still PASS.

- [ ] **Step 3: Implement the gratitude half in `ReflectionStep.tsx`**

Imports — extend the existing `@/data/hooks` import and add the component:
```tsx
import { useGratitudeActions, useGratitudeEntries, useRitualActions, useRitualDay } from '@/data/hooks'
import { GratitudeRows } from '@/features/me/components/GratitudeRows'
```

State — after the existing `voice`/`recording` lines:
```tsx
  // Today's already-saved gratitude lines. The read is what keeps a RE-ENTERED ritual (✕ then
  // back in — the flow always replays act 3 from act 1) from silently duplicating the evening's
  // lines and blowing past the spec's "1–3 a day": they render as a saved list and only the
  // remaining slots are offered. There is no gratitude PUT, so a saved line is shown, not edited.
  const { data: saved, isPending: savedPending } = useGratitudeEntries(date, date)
  const { addEntry } = useGratitudeActions()
  const [rows, setRows] = useState<string[]>([''])
  const [lifeArea, setLifeArea] = useState<string | null>(null)
  const slots = Math.max(0, 3 - saved.length)
```

`advance()` — add the gratitude writes before `onNext()`:
```tsx
  const advance = () => {
    const next = text.trim()
    // `next !== seed` — NOT `next` — so an emptied box actually clears the stored prose ('' is
    // the CLEAR payload the backend maps to null), and an untouched one writes nothing at all.
    if (next !== seed) {
      // fire-and-forget: a failed save must never trap the user inside the ritual
      void saveReflection(next).catch(() => {})
    }
    // Same fire-and-forget rule for the gratitude rows, and `slice(0, slots)` re-checks the cap
    // against the freshest read — a refetch may have landed an entry while the act was open.
    for (const line of rows.map((r) => r.trim()).filter(Boolean).slice(0, slots)) {
      void addEntry(line, lifeArea, date).catch(() => {})
    }
    onNext()
  }
```

JSX — insert between `{voice.error && …}` and the „Tovább" button:
```tsx
      {!savedPending && (
        <div className="rz-reflect-gratitude">
          <div className="rz-story-eyebrow">Amiért hálás vagy</div>
          {saved.length > 0 && (
            <ul className="rz-gratitude-saved">
              {saved.map((g) => <li key={g.id}>{g.text}</li>)}
            </ul>
          )}
          {slots > 0 ? (
            <div className="col gap-sm">
              <GratitudeRows
                rows={rows}
                onRowsChange={setRows}
                lifeArea={lifeArea}
                onLifeAreaChange={setLifeArea}
                max={slots}
                hint={`Legfeljebb ${slots} sor — teljesen opcionális.`}
              />
            </div>
          ) : (
            <p className="rz-reflect-hint">Ma már mind a három hálabejegyzésed megvan.</p>
          )}
        </div>
      )}
```

Note `autoFocusFirst` is **not** passed: the act must not yank focus out of the prose textarea the user is looking at.

Finally, replace the doc comment's last paragraph (the „until that slice lands the gratitude half simply isn't rendered" one) with:
```
 * The W1.3 gratitude rows join this act below the textarea (W1.3b, `mezo-b3pp.25`, spec §5.2's
 * "combined writing act" — ONE act, both parts optional). They obey the same two rules as the
 * prose: written on advance only, never on a keystroke, and fire-and-forget so a failed POST
 * cannot trap the user; „Ma nem írok" writes neither half. What differs is the cap: today's
 * already-saved entries are read back, rendered as a saved list, and only `3 − saved.length`
 * input slots are offered, because a ✕-and-re-entered ritual replays this act from the start and
 * would otherwise duplicate the evening's lines.
```

- [ ] **Step 4: Add the act-3 styles** — `frontend/src/styles/prototype.css`, immediately after the `.rz-reflect-hint` rule

```css
.rz-reflect-gratitude { margin-top: 22px; display: flex; flex-direction: column; gap: 10px; }
.rz-gratitude-saved { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.rz-gratitude-saved li { font-family: var(--ff-body); font-size: 13px; line-height: 1.4;
  color: color-mix(in srgb, var(--text-primary) 65%, transparent);
  padding: 8px 10px; background: var(--surface-2); border-radius: 10px; }
```

- [ ] **Step 5: Run the act's tests — expect PASS**

```bash
cd frontend && pnpm vitest run src/features/ritual/components/ReflectionStep.test.tsx
```
Expected: all 17 cases pass (10 prose + 7 gratitude).

- [ ] **Step 6: Run the ritual page + journal suites too — nothing else may move**

```bash
cd frontend && pnpm vitest run src/features/ritual src/features/me/sheets/JournalSheet.test.tsx src/features/me/components/GratitudeRows.test.tsx src/data/journal
```
Expected: all pass. `RitualPage.test.tsx` in particular must still see a 6-act flow.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/ritual/components/ReflectionStep.tsx frontend/src/features/ritual/components/ReflectionStep.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(ritual): gratitude rows in the act-3 writing act (mezo-b3pp.25)"
```

---

### Task 3: Docs + full gates

**Files:**
- Modify: `docs/features/journal.md` — §1 status block (:32-35), §2 (`GratitudeRows` + the ritual half), §7/§9 (the slot decision + the mic fix), §8 (new tests by name), §10 (new files); bump `updated:`.
- Modify: `docs/features/ritual.md` — act 3's §2 bullet (:52), §8 FE tests (:184), §9 decisions, and the §"Extend the act-3 writing act (the W1.3 seam)" bullet (:168) which must stop describing this as future work.

- [ ] **Step 1: Edit both feature docs**

`journal.md` — in the §1 status block replace „Ritual `ReflectionStep` gratitude rows 🟣 deferred to W1.3b (W1.2 unmerged)." with:
```
> Ritual `ReflectionStep` gratitude rows ✅ shipped as **W1.3b** (`mezo-b3pp.25`) — the same rows,
> capped at the day's remaining slots, inside Napzárás act 3 ([ritual.md](ritual.md) §2).
```
Also update the §9 line that still calls `mezo-b3pp.25` "the one follow-on still open" (:562-563) and the §"Still open" list (:879-880) — `mezo-b3pp.26` remains, `mezo-b3pp.25` does not.

Add to §2, after the `JournalSheet` sub-section:
```
### `GratitudeRows` (`features/me/components/GratitudeRows.tsx`) — the shared capture block (W1.3b, `mezo-b3pp.25`)

Up to `max` textareas (default 3, `maxLength={280}`), a per-row push-to-talk mic, „+ Még egy" up to
the cap, the 8 LIFE life-area chips (single-select, tap again to clear) and an optional hint line.
**State-free and data-free by design** — rows, life area and the save all belong to the caller,
because the two callers save at different moments: `JournalSheet`'s „Hála" mode on „Mentem"
(batch `Promise.all` then close), the ritual's `ReflectionStep` on „Tovább" (fire-and-forget). That
is also what keeps the file out of `@/data/*`, the `frontend_conventions.md` rule for a component
shared across features.

The mic's target row is held in a **ref**, not state: `useVoiceInput`'s `rec.onstop` closes over the
transcript callback as it stood when recording STARTED, so a state read inside it would be stale.
Before the extraction the gratitude mic was wired to `JournalSheet`'s *note* textarea — a box
gratitude mode never renders — so a transcription taken while capturing gratitude was silently
lost; the extraction fixed it.
```

`ritual.md` — extend the act-3 bullet (:52) with the gratitude half, replace the closing sentence („The W1.3 gratitude rows join this same act below the textarea when that slice lands…") with:
```
The W1.3 gratitude rows sit in this same act below the textarea (**W1.3b**, `mezo-b3pp.25` — spec §5.2's combined writing act: one act, both halves optional). They follow the prose's two rules exactly — written on advance only, never per keystroke, and fire-and-forget so a failed `POST /api/journal/gratitude` cannot trap the user — and „Ma nem írok" writes **neither** half. Their one extra rule is the day cap: the act reads today's entries back (`useGratitudeEntries(date, date)`), renders them as a read-only „már mentve" list, and offers only `3 − saved.length` input slots (at 3, none at all). The ritual is forward-only, but a ✕-and-re-enter replays act 3 from act 1, and without the read-back a second pass would duplicate the evening's lines. There is no gratitude `PUT`, so a saved line is shown, never offered for edit.
```
Rewrite the §"Extend the act-3 writing act" bullet (:168) into past tense — the seam is taken; the next writing-act addition still owes the same two rules. Add a §9 decision paragraph mirroring the cap rationale above, and list the new tests in §8's FE block:
```
  - `features/me/components/GratitudeRows.test.tsx` (`mezo-b3pp.25`) — the extracted block: one row by default, „+ Még egy" up to the cap and gone at it, a `max` below 3 honoured (the ritual's remaining slots), the life-area chip toggling both ways, and the two voice cases that pin the fix — the transcript lands in the row whose mic was tapped, and appends to what that row already holds.
  - `features/ritual/components/ReflectionStep.test.tsx` gratitude block (`mezo-b3pp.25`) — a row rendered under the prose; „Tovább" saving every non-empty row with the chosen life area for today (whitespace-only rows dropped); either half alone sufficing; „Ma nem írok" writing neither half; and the cap pair — two saved entries leave exactly one slot and no „+ Még egy", three leave no input at all and an advance that writes nothing.
```

- [ ] **Step 2: Lint the docs**

```bash
node scripts/lint-docs.mjs 2>&1 | tail -5
```
Expected: no NEW errors and no new staleness for `journal.md` / `ritual.md` (both get an `updated:` bump in the same commit as the code).

- [ ] **Step 3: Full frontend gates — both modes**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: build clean (`tsc -b` also catches any import left unused by the extraction), both runs green.

- [ ] **Step 4: Commit and push**

```bash
git add docs/features/journal.md docs/features/ritual.md
git commit -m "docs(features): journal + ritual — gratitude rows in the act-3 writing act (mezo-b3pp.25)"
git push -u origin feat/gratitude-reflection-step
```

- [ ] **Step 5: Self-PR (the CI gate) and merge per the house flow**

```bash
gh pr create --fill
```
Then `gh pr checks <PR#> --watch` → green → `git -C /Users/mrkuhne/Applications/Personal/Mezo/mezo pull --rebase`, `--no-ff` merge, push, `bd close mezo-b3pp.25 && bd dolt push`, delete the branch locally and on the remote.

---

## Self-Review

- **Spec coverage.** §5.2's combined writing act: rows below the textarea, one act, both halves optional, `ACT_COUNT` unchanged → Task 2. §5.3's "up to 3 rows + life-area chip from the 8 LIFE skills, ≤280 chars" → Task 1 (`max=3`, `maxLength={280}`, `LIFE_SKILLS`) and Task 2's slot arithmetic. bd's "reuse `useGratitudeActions` and the JournalSheet row UI (extract a `GratitudeRows` component if reuse is awkward)" → Task 1 extraction, Task 2 reuse. "skip writes nothing" → Task 2's „Ma nem írok" test. §11: no LLM/embed call site is added (the embedding rides the existing `POST` seam), no new table, no contract change — so the `LlmCallContextHolder`, `ResetDatabase`/populator and contract-first clauses have nothing to bind here; the docs clause does, and is Task 3.
- **Placeholders.** None: every step carries the literal code, the literal command and the expected result.
- **Type consistency.** `GratitudeRowsProps` as declared in Task 1 is exactly what Task 2 passes (`rows`/`onRowsChange`/`lifeArea`/`onLifeAreaChange`/`max`/`hint`, `autoFocusFirst` omitted). `addEntry(text, lifeArea, occurredOn)` matches `gratitudeHooks.ts`'s signature. `GratitudeEntry` fields used by the test helper (`id`/`occurredOn`/`text`/`lifeArea`/`createdAt`) match `data/journal/journalTypes.ts`.
