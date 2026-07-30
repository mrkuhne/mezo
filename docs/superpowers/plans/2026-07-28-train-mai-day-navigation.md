# Train „Mai nap” day navigation + K3 session cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Train's `Mai` page into a one-day view with a horizontal day strip (≈1.15 viewports instead of 2.51), give every session card its modality colour and a loud logged state, and move the detailed weekly list to a new `/train/week` („Heti”) page.

**Architecture:** Frontend-only. The weekly agenda is already fully derived client-side from `useTrain()`/`useRunning()`/`useWeekWorkouts()`, so day switching is pure state — no new fetch, no backend change. The agenda build is extracted from `TrainTodayPage` into a pure `logic/weekAgenda.ts` that both pages consume. `TodaySessionCard` is restyled (not rewritten) onto a modality-tinted card with a 44px icon shield; a new `DoneBar` unifies the logged state across sport/run cards and the gym hero. Retroactive logging works because both log endpoints already accept an explicit `date`.

**Tech Stack:** React 19 + Vite + TypeScript, Tailwind v4 + `frontend/src/styles/prototype.css` (Napiv design tokens), Vitest + @testing-library/react, Playwright visual goldens, react-router-dom v7.

**Spec:** [`docs/superpowers/specs/2026-07-28-train-mai-day-navigation-design.md`](../specs/2026-07-28-train-mai-day-navigation-design.md) · **bd:** `mezo-9bbc` · **branch:** `feat/train-mai-day-nav` (already exists, spec committed)

## Global Constraints

- **Read `docs/references/frontend_conventions.md` before writing any `frontend/src` code.** Four layers, `*Page`/`*Section` naming, hooks only from `@/data/hooks`, deep absolute `@/*` imports, no barrels, tests colocated.
- **Run every command from `frontend/`** (`cd /Users/daniel.kuhne/MrKuhne/mezo/.claude/worktrees/parallel-session-3/frontend`).
- **Both test modes must stay green:** `pnpm test` (real mode) and `VITE_USE_MOCK=true pnpm test`. Per-task runs may target single files; the full gate runs in the final task.
- **Colors only via `var(--token)`** — no raw hex or `rgba()` in new CSS except inside a token definition; new CSS goes into `frontend/src/styles/prototype.css` next to the existing Napiv Train block (~lines 1300–1400).
- **Hungarian UI copy, English code/comments/commits.** Conventional commit subjects carrying the bd id: `feat(train): … (mezo-9bbc)`.
- **Commit with `git add <explicit paths>` + `git commit --no-verify`** — the beads pre-commit hook force-stages a stray root `issues.jsonl`; never `git add -A`.
- **Day keys** are the `DAY_ORDER` strings from `@/data/train/train`: `['Hét','Kedd','Sze','Csü','Pén','Szo','Vas']`. The `?day=` URL param carries the **index 0–6**, not the accented label.
- **State-chip vocabulary is exactly four values:** `MOST`, `MA`, `ELMARADT`, `TERVEZETT`. No other time-of-day words.
- Existing behaviour that must not regress: gym three-state gating (`Indítsuk` / `Folyamatban` / `Kész → review`), gym direct-start from a non-today day, the morning-training nudge and its snooze, the open-custom-instance resume card, the `Saját edzés` flows.

---

### Task 1: Modality tone tokens + `SPORT_TONE` map

Cross and TRX currently share `--tag-sport` with volleyball. Give them their own accent/wash pairs and a single source of truth mapping a `SportKind` to a tone.

**Files:**
- Modify: `frontend/src/features/train/logic/sportKinds.ts`
- Create: `frontend/src/features/train/logic/sportKinds.test.ts`
- Modify: `frontend/src/styles/prototype.css` (Napiv accent-token block, ~line 1282, and the `.stag-*`/`.typetag-*` variant lists)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `export type SessionTone = 'gym' | 'sport' | 'cross' | 'trx' | 'run'` and `export const SPORT_TONE: Record<SportKind, SessionTone>` from `@/features/train/logic/sportKinds`. CSS classes `.typetag-cross`, `.typetag-trx`, `.stag-cross`, `.stag-trx`; tokens `--tag-cross`/`--wash-cross`/`--tag-trx`/`--wash-trx`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/train/logic/sportKinds.test.ts`:

```tsx
import { expect, test } from 'vitest'
import { SPORT_KINDS, SPORT_TONE, sportOf } from '@/features/train/logic/sportKinds'

test('every sport kind maps to its own tone', () => {
  expect(SPORT_TONE).toEqual({ volleyball: 'sport', cross: 'cross', trx: 'trx' })
})

test('the tone map covers every kind in SPORT_KINDS', () => {
  for (const k of SPORT_KINDS) expect(SPORT_TONE[k]).toBeTruthy()
})

test('an undiscriminated slot resolves to volleyball, hence the sport tone', () => {
  expect(SPORT_TONE[sportOf({})]).toBe('sport')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/features/train/logic/sportKinds.test.ts`
Expected: FAIL — `SPORT_TONE` is not exported.

- [ ] **Step 3: Add the tone type + map**

Append to `frontend/src/features/train/logic/sportKinds.ts`:

```ts
/** The five modality tones a session card / type tag can carry (mezo-9bbc). */
export type SessionTone = 'gym' | 'sport' | 'cross' | 'trx' | 'run'
/** One home for "which tone does this sport wear" — consumed by cards, tags and rows. */
export const SPORT_TONE: Record<SportKind, SessionTone> = { volleyball: 'sport', cross: 'cross', trx: 'trx' }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/features/train/logic/sportKinds.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Add the CSS tokens**

In `frontend/src/styles/prototype.css`, extend the existing Napiv accent block (the `:root` that defines `--wash-gym`) and its dark counterpart:

```css
/* ===== Napív S4 — train-type accent tokens (mockup stag/lic palette) ===== */
:root {
  --wash-gym: #FFEDE6;
  --wash-sport: #FBE9EC;
  --wash-run: #E7F0F8;
  --wash-cross: #FBF0DD;          /* cross gets its own amber family (mezo-9bbc) */
  --wash-trx: #F0EDF8;            /* TRX rides the lavender family (mezo-9bbc) */
  --tag-gym: #C4622F;
  --tag-sport: #B14B5E;
  --tag-run: #3E6E9E;
  --tag-cross: #B07A2E;
  --tag-trx: #7A6DA8;
}
:root[data-theme="dark"] {
  --wash-gym: rgba(255,107,74,.16);
  --wash-sport: rgba(226,122,139,.16);
  --wash-run: rgba(111,167,216,.16);
  --wash-cross: rgba(224,164,88,.16);
  --wash-trx: rgba(171,159,210,.16);
  --tag-gym: #F0966B; --tag-sport: #E9A3AE; --tag-run: #9CC0E4;
  --tag-cross: #E0A458; --tag-trx: #B9ACD9;
}
```

Then add the variant classes next to the existing ones (`.typetag-*` ~line 1237, `.stag-*` ~line 1305):

```css
.typetag-cross { background: var(--wash-cross); color: var(--tag-cross); }
.typetag-trx { background: var(--wash-trx); color: var(--tag-trx); }
```

```css
.stag-cross { background: var(--wash-cross); color: var(--tag-cross); }
.stag-trx { background: var(--wash-trx); color: var(--tag-trx); }
```

- [ ] **Step 6: Verify the build still compiles**

Run: `pnpm build`
Expected: success (CSS-only + a type export; nothing consumes them yet).

- [ ] **Step 7: Commit**

```bash
git add src/features/train/logic/sportKinds.ts src/features/train/logic/sportKinds.test.ts src/styles/prototype.css
git commit --no-verify -m "feat(train): cross/TRX modality tone tokens + SPORT_TONE map (mezo-9bbc)"
```

---

### Task 2: `DoneBar` — the shared logged-state bar

One presentational piece for "this session is done": a sage bar with a check circle, a bold summary and an optional quiet second line. Used by the sport/run cards and (Task 5) by the gym hero.

**Files:**
- Create: `frontend/src/features/train/components/DoneBar.tsx`
- Create: `frontend/src/features/train/components/DoneBar.test.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: nothing.
- Produces:
```ts
function DoneBar(props: {
  summary: string          // bold first line, e.g. "RPE 8 · 60 perc"
  detail?: string | null   // quiet second line, e.g. "07:12-kor logolva"; omitted when falsy
  onClick?: () => void     // when present the whole bar is a button
  ariaLabel?: string       // accessible name when onClick is set
}): JSX.Element
```
CSS: `.donebar`, `.donebar-check`, `.donebar-txt`, `.donebar-detail`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/train/components/DoneBar.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { DoneBar } from '@/features/train/components/DoneBar'

test('renders the summary and the quiet detail line', () => {
  const { container } = render(<DoneBar summary="RPE 8 · 60 perc" detail="07:12-kor logolva" />)
  expect(screen.getByText('RPE 8 · 60 perc')).toBeInTheDocument()
  expect(screen.getByText('07:12-kor logolva')).toBeInTheDocument()
  expect(container.querySelector('.donebar')).toBeInTheDocument()
  // no handler -> not a button
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

test('omits the detail line entirely when absent', () => {
  const { container } = render(<DoneBar summary="RPE 8" />)
  expect(container.querySelector('.donebar-detail')).not.toBeInTheDocument()
})

test('is a labelled button when onClick is given', () => {
  const onClick = vi.fn()
  render(<DoneBar summary="RPE 8 · 60 perc" onClick={onClick} ariaLabel="Logolt session megnyitása" />)
  fireEvent.click(screen.getByRole('button', { name: 'Logolt session megnyitása' }))
  expect(onClick).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/features/train/components/DoneBar.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

Create `frontend/src/features/train/components/DoneBar.tsx`:

```tsx
// ============================================================
// Mezo · DoneBar — the shared "this session is done" bar (mezo-9bbc).
// A sage check circle + bold summary + optional quiet detail line.
// Worn by TodaySessionCard's logged state and by the gym hero's Kész
// state, so every modality reports completion the same way.
// ============================================================
import { Icon } from '@/shared/ui/Icon'

export function DoneBar({
  summary,
  detail,
  onClick,
  ariaLabel,
}: {
  /** Bold first line — the logged effort, e.g. `RPE 8 · 60 perc`. */
  summary: string
  /** Quiet second line (when known), e.g. `07:12-kor logolva`. */
  detail?: string | null
  /** When present the whole bar becomes the tap target. */
  onClick?: () => void
  /** Accessible name for the tappable variant. */
  ariaLabel?: string
}) {
  const inner = (
    <>
      <span className="donebar-check" aria-hidden="true"><Icon name="check" size={15} /></span>
      <span className="donebar-txt">
        {summary}
        {detail ? <small className="donebar-detail">{detail}</small> : null}
      </span>
    </>
  )
  if (!onClick) return <div className="donebar">{inner}</div>
  return (
    <button type="button" className="donebar np-press" onClick={onClick} aria-label={ariaLabel}>
      {inner}
    </button>
  )
}
```

- [ ] **Step 4: Add the CSS**

Append to `frontend/src/styles/prototype.css` after the `.todaycard*` block:

```css
/* ===== Napív done bar — shared logged-state bar (mezo-9bbc) ===== */
.donebar { display: flex; align-items: center; gap: 9px; width: 100%; margin-top: 12px; padding: 11px 13px; border-radius: 16px; background: var(--wash-sage); border: 0; font-family: inherit; text-align: left; cursor: inherit; }
.donebar-check { flex: none; width: 30px; height: 30px; border-radius: 50%; background: var(--sage-deep); color: var(--surface); display: inline-flex; align-items: center; justify-content: center; }
.donebar-txt { font-size: 12px; font-weight: 800; color: var(--sage-deep); }
.donebar-detail { display: block; margin-top: 1px; font-size: 10.5px; font-weight: 700; color: var(--sub); letter-spacing: 0; text-transform: none; }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run src/features/train/components/DoneBar.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/features/train/components/DoneBar.tsx src/features/train/components/DoneBar.test.tsx src/styles/prototype.css
git commit --no-verify -m "feat(train): DoneBar — shared logged-state bar (mezo-9bbc)"
```

---

### Task 3: `sessionState` — the four-value state helper

Derives which state chip a session card shows, from the selected day's date and the session's time.

**Files:**
- Create: `frontend/src/features/train/logic/sessionState.ts`
- Create: `frontend/src/features/train/logic/sessionState.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
```ts
type SessionState = 'now' | 'today' | 'missed' | 'planned'
function sessionState(args: { dayIso: string; todayIso: string; timeOfDay?: string | null; now?: Date }): SessionState
const SESSION_STATE_LABEL: Record<SessionState, string>  // { now: 'MOST', today: 'MA', missed: 'ELMARADT', planned: 'TERVEZETT' }
```
Callers render `SESSION_STATE_LABEL[sessionState(...)]`. A logged session never calls this (its eyebrow says `MEGVAN`).

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/train/logic/sessionState.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { SESSION_STATE_LABEL, sessionState } from '@/features/train/logic/sessionState'

const now = new Date('2026-05-19T12:30:00')

describe('sessionState', () => {
  test('today within ±1h of now is "now"', () => {
    expect(sessionState({ dayIso: '2026-05-19', todayIso: '2026-05-19', timeOfDay: '12:00', now })).toBe('now')
    expect(sessionState({ dayIso: '2026-05-19', todayIso: '2026-05-19', timeOfDay: '13:25', now })).toBe('now')
  })

  test('today outside the window is "today"', () => {
    expect(sessionState({ dayIso: '2026-05-19', todayIso: '2026-05-19', timeOfDay: '18:00', now })).toBe('today')
    expect(sessionState({ dayIso: '2026-05-19', todayIso: '2026-05-19', timeOfDay: '07:00', now })).toBe('today')
  })

  test('an untimed session today is "today", never "now"', () => {
    expect(sessionState({ dayIso: '2026-05-19', todayIso: '2026-05-19', timeOfDay: null, now })).toBe('today')
  })

  test('a past day is "missed" and a future day is "planned"', () => {
    expect(sessionState({ dayIso: '2026-05-18', todayIso: '2026-05-19', timeOfDay: '18:00', now })).toBe('missed')
    expect(sessionState({ dayIso: '2026-05-21', todayIso: '2026-05-19', timeOfDay: '07:00', now })).toBe('planned')
  })

  test('labels are the agreed four Hungarian words', () => {
    expect(SESSION_STATE_LABEL).toEqual({ now: 'MOST', today: 'MA', missed: 'ELMARADT', planned: 'TERVEZETT' })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/features/train/logic/sessionState.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the helper**

Create `frontend/src/features/train/logic/sessionState.ts`:

```ts
// ============================================================
// Mezo · sessionState — which state chip a session card wears (mezo-9bbc).
// Exactly four values; a logged session shows none (its eyebrow reads MEGVAN).
// `now` is injectable so tests stay deterministic.
// ============================================================
export type SessionState = 'now' | 'today' | 'missed' | 'planned'

export const SESSION_STATE_LABEL: Record<SessionState, string> = {
  now: 'MOST',
  today: 'MA',
  missed: 'ELMARADT',
  planned: 'TERVEZETT',
}

/** Minutes-since-midnight of a `HH:MM` string; null for missing/malformed input. */
const minutes = (t?: string | null): number | null => {
  if (!t) return null
  const m = /^(\d{2}):(\d{2})$/.exec(t)
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

export function sessionState({
  dayIso,
  todayIso,
  timeOfDay,
  now = new Date(),
}: {
  /** ISO date of the day the card belongs to. */
  dayIso: string
  /** ISO date of today (from `localDateString()`). */
  todayIso: string
  timeOfDay?: string | null
  now?: Date
}): SessionState {
  if (dayIso < todayIso) return 'missed'
  if (dayIso > todayIso) return 'planned'
  const start = minutes(timeOfDay)
  if (start === null) return 'today'
  const nowMin = now.getHours() * 60 + now.getMinutes()
  return Math.abs(start - nowMin) <= 60 ? 'now' : 'today'
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/features/train/logic/sessionState.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/train/logic/sessionState.ts src/features/train/logic/sessionState.test.ts
git commit --no-verify -m "feat(train): sessionState helper — MOST/MA/ELMARADT/TERVEZETT (mezo-9bbc)"
```

---

### Task 4: `TodaySessionCard` → K3 (icon shield, five tones, DoneBar)

Restyle the card introduced in `mezo-lruy`: modality-gradient background, 44px icon shield, state chip from Task 3, logged state via `DoneBar`, and a read-only variant with no CTA.

**Files:**
- Modify: `frontend/src/features/train/components/TodaySessionCard.tsx`
- Create: `frontend/src/features/train/components/TodaySessionCard.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (`.todaycard*` block)
- Modify: `frontend/src/features/train/pages/TrainTodayPage.tsx` (call sites — new props)

**Interfaces:**
- Consumes: `SessionTone`, `SPORT_TONE` (Task 1); `DoneBar` (Task 2); `SESSION_STATE_LABEL`, `sessionState` (Task 3).
- Produces: the new `TodaySessionCard` props contract:
```ts
function TodaySessionCard(props: {
  tone: SessionTone           // drives --tc-accent/--tc-wash + the typetag variant
  emoji: string               // icon-shield glyph, e.g. '🏃'
  tag: string                 // uppercase type word, e.g. 'FUTÁS'
  time?: string | null        // eyebrow time; omitted when absent
  title: string
  facts: (string | null | undefined | false)[]
  logged: boolean
  loggedSummary?: string      // DoneBar summary, e.g. 'RPE 9 · 5/5 kör'
  loggedDetail?: string | null// DoneBar detail, e.g. '12:04-kor logolva'
  stateLabel?: string | null  // 'MOST' | 'MA' | 'ELMARADT' | 'TERVEZETT'; hidden when logged
  ctaLabel?: string           // absent ⇒ read-only card (no CTA, no DoneBar tap)
  onLog?: () => void
}): JSX.Element
```

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/train/components/TodaySessionCard.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { TodaySessionCard } from '@/features/train/components/TodaySessionCard'

const base = {
  emoji: '🏃', tag: 'FUTÁS', time: '12:00', title: 'Sprint-intervallum',
  facts: ['RPE 9–10', '5 kör'], logged: false, stateLabel: 'MOST',
  ctaLabel: 'Naplózd a futást',
} as const

test('renders tone class, icon shield, eyebrow, title, fact pills and the CTA', () => {
  const onLog = vi.fn()
  const { container } = render(<TodaySessionCard {...base} tone="run" onLog={onLog} />)
  expect(container.querySelector('.todaycard-run')).toBeInTheDocument()
  expect(container.querySelector('.todaycard-icon')).toHaveTextContent('🏃')
  expect(screen.getByText(/FUTÁS/)).toBeInTheDocument()
  expect(screen.getByText('12:00')).toBeInTheDocument()
  expect(screen.getByText('Sprint-intervallum')).toBeInTheDocument()
  expect(container.querySelectorAll('.metapill')).toHaveLength(2)
  expect(screen.getByText('MOST')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Naplózd a futást/ }))
  expect(onLog).toHaveBeenCalledTimes(1)
})

test('each of the five tones gets its own tone class and typetag variant', () => {
  for (const tone of ['gym', 'sport', 'cross', 'trx', 'run'] as const) {
    const { container, unmount } = render(<TodaySessionCard {...base} tone={tone} />)
    expect(container.querySelector(`.todaycard-${tone}`)).toBeInTheDocument()
    expect(container.querySelector(`.typetag-${tone}`)).toBeInTheDocument()
    unmount()
  }
})

test('logged state: check icon, MEGVAN eyebrow, DoneBar instead of the CTA, no state chip', () => {
  const onLog = vi.fn()
  const { container } = render(
    <TodaySessionCard
      {...base}
      tone="run"
      logged
      loggedSummary="RPE 9 · 5/5 kör"
      loggedDetail="12:04-kor logolva"
      onLog={onLog}
    />,
  )
  expect(container.querySelector('.todaycard.logged')).toBeInTheDocument()
  expect(screen.getByText(/MEGVAN/)).toBeInTheDocument()
  expect(screen.getByText('RPE 9 · 5/5 kör')).toBeInTheDocument()
  expect(screen.getByText('12:04-kor logolva')).toBeInTheDocument()
  expect(screen.queryByText('MOST')).not.toBeInTheDocument()
  expect(screen.queryByText(/Naplózd a futást/)).not.toBeInTheDocument()
  // the DoneBar is the tap target -> re-opens the sheet
  fireEvent.click(screen.getByRole('button'))
  expect(onLog).toHaveBeenCalledTimes(1)
})

test('a read-only card (no ctaLabel) renders neither CTA nor tappable bar', () => {
  render(<TodaySessionCard {...base} tone="sport" ctaLabel={undefined} stateLabel="TERVEZETT" />)
  expect(screen.getByText('TERVEZETT')).toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/features/train/components/TodaySessionCard.test.tsx`
Expected: FAIL — the current component has no `emoji`/`stateLabel`/`loggedSummary` props and renders no `.todaycard-icon`.

- [ ] **Step 3: Rewrite the component**

Replace `frontend/src/features/train/components/TodaySessionCard.tsx` with:

```tsx
// ============================================================
// Mezo · TodaySessionCard — one scheduled session of the selected day on
// Mai (sport: röpi/cross/TRX · prescribed run). Napiv `.todaycard` in the
// K3 language (mezo-9bbc): modality-gradient surface + 44px icon shield,
// eyebrow (tag · time), display title, `.metapill` facts, then a
// full-width CTA — or, once logged, a `DoneBar` and a check-swapped
// shield. Without `ctaLabel` the card is read-only (a future day).
// ============================================================
import { cn } from '@/shared/lib/cn'
import { Icon } from '@/shared/ui/Icon'
import { DoneBar } from '@/features/train/components/DoneBar'
import type { SessionTone } from '@/features/train/logic/sportKinds'

interface TodaySessionCardProps {
  /** Modality tone — drives `--tc-accent`/`--tc-wash` and the type-tag variant. */
  tone: SessionTone
  /** Icon-shield glyph (from `SPORT_EMOJI`, or 🏃/🏋️). */
  emoji: string
  /** Uppercase type word shown in the eyebrow tag (`FUTÁS`, `RÖPI`…). */
  tag: string
  /** Session time; omitted from the eyebrow when absent. */
  time?: string | null
  title: string
  /** One `.metapill` per fact; falsy entries drop out. */
  facts: (string | null | undefined | false)[]
  logged: boolean
  /** `DoneBar` summary of the logged effort. */
  loggedSummary?: string
  /** `DoneBar` detail line (logged-at); omitted when unknown. */
  loggedDetail?: string | null
  /** `MOST`/`MA`/`ELMARADT`/`TERVEZETT`; suppressed while logged. */
  stateLabel?: string | null
  /** Not-yet-logged CTA copy. Absent ⇒ read-only card. */
  ctaLabel?: string
  /** Opens the log sheet (from the CTA, or from the DoneBar once logged). */
  onLog?: () => void
}

export function TodaySessionCard({
  tone, emoji, tag, time, title, facts,
  logged, loggedSummary, loggedDetail, stateLabel, ctaLabel, onLog,
}: TodaySessionCardProps) {
  const pills = facts.filter(Boolean) as string[]
  const interactive = Boolean(ctaLabel && onLog)
  return (
    <section className={cn('todaycard', `todaycard-${tone}`, logged && 'logged')}>
      <div className="todaycard-top">
        <span className="todaycard-icon" aria-hidden="true">
          {logged ? <Icon name="check" size={20} /> : emoji}
        </span>
        <div className="todaycard-head">
          <span className={cn('typetag', `typetag-${tone}`)}>
            {tag}{logged ? ' · MEGVAN' : null}
          </span>
          {!logged && time ? <span className="todaycard-time">{time}</span> : null}
          <h3 className="todaycard-title">{title}</h3>
        </div>
        {!logged && stateLabel ? <span className="todaycard-state">{stateLabel}</span> : null}
      </div>

      {logged ? (
        <DoneBar
          summary={loggedSummary ?? ''}
          detail={loggedDetail}
          onClick={interactive ? onLog : undefined}
          ariaLabel={interactive ? `${title} — logolt session megnyitása` : undefined}
        />
      ) : (
        <>
          {pills.length > 0 && (
            <div className="todaycard-pills">
              {pills.map((p) => <span key={p} className="metapill">{p}</span>)}
            </div>
          )}
          {interactive && (
            <button type="button" className="todaycard-cta np-press" onClick={onLog}>
              <Icon name="plus" size={12} /><span>{ctaLabel}</span>
            </button>
          )}
        </>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Update the CSS**

Replace the `.todaycard*` block in `frontend/src/styles/prototype.css` (added by `mezo-lruy`) with:

```css
/* ===== Napív today session card (Mai — sport/run, mezo-lruy; K3 language mezo-9bbc) =====
   The gym hero's lighter sibling: icon shield + eyebrow → title → fact pills →
   full-width CTA, tinted per modality via --tc-accent/--tc-wash. */
.todaycard { --tc-accent: var(--tag-sport); --tc-wash: var(--wash-sport); background: linear-gradient(150deg, var(--tc-wash), var(--surface) 78%); border-radius: 24px; padding: 15px 16px 16px; margin: 0 24px 12px; box-shadow: var(--np-shadow-row); }
.todaycard-gym { --tc-accent: var(--tag-gym); --tc-wash: var(--wash-gym); }
.todaycard-sport { --tc-accent: var(--tag-sport); --tc-wash: var(--wash-sport); }
.todaycard-cross { --tc-accent: var(--tag-cross); --tc-wash: var(--wash-cross); }
.todaycard-trx { --tc-accent: var(--tag-trx); --tc-wash: var(--wash-trx); }
.todaycard-run { --tc-accent: var(--tag-run); --tc-wash: var(--wash-run); }
.todaycard.logged { --tc-accent: var(--sage-deep); --tc-wash: var(--wash-sage); }
.todaycard-top { display: flex; align-items: flex-start; gap: 11px; }
.todaycard-icon { flex: none; width: 44px; height: 44px; border-radius: 15px; background: var(--surface); box-shadow: var(--np-shadow-row); display: inline-flex; align-items: center; justify-content: center; font-size: 21px; }
.todaycard.logged .todaycard-icon { background: var(--sage-deep); color: var(--surface); }
.todaycard-head { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 7px; }
.todaycard-time { font-size: 12.5px; font-weight: 800; color: var(--tc-accent); font-variant-numeric: tabular-nums; }
.todaycard-title { flex-basis: 100%; font-family: var(--ff-display); font-size: 20px; font-weight: 800; letter-spacing: -.3px; line-height: 1.15; color: var(--ink); }
.todaycard-state { flex: none; display: inline-flex; align-items: center; border-radius: 999px; padding: 4px 10px; font-size: 9.5px; font-weight: 800; letter-spacing: .5px; text-transform: uppercase; color: var(--tc-accent); background: var(--surface); }
.todaycard-pills { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 11px; }
.todaycard-cta { width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 7px; margin-top: 13px; padding: 13px 14px; border-radius: 16px; font-family: inherit; font-size: 12.5px; font-weight: 800; cursor: pointer; color: var(--tc-accent); background: var(--surface); border: 1px solid color-mix(in srgb, var(--tc-accent) 24%, transparent); }
```

- [ ] **Step 5: Update the two call sites in `TrainTodayPage`**

In `frontend/src/features/train/pages/TrainTodayPage.tsx`, the sport branch becomes (keep the surrounding `orderedToday.map` untouched for now — day selection lands in Task 8):

```tsx
        if (item.kind === 'sport') {
          const vb = item.sport
          const k = sportOf(vb)
          const logged = loggedSportToday(k)
          return (
            <TodaySessionCard
              key={`hero-sport-${k}-${vb.time}-${i}`}
              tone={SPORT_TONE[k]}
              emoji={SPORT_EMOJI[k]}
              tag={SPORT_TAGS[k]}
              time={vb.time}
              title={SPORT_TITLES[k]}
              facts={[`${vb.duration} perc`, vb.role, vb.court]}
              logged={Boolean(logged)}
              loggedSummary={
                logged
                  ? k === 'volleyball'
                    ? `RPE ${logged.rpe} · ${logged.duration}p · váll ${logged.shoulderStrain ?? '–'}`
                    : `RPE ${logged.rpe} · ${logged.duration}p`
                  : undefined
              }
              loggedDetail={logged?.time ? `${logged.time}-kor logolva` : null}
              stateLabel={SESSION_STATE_LABEL[sessionState({ dayIso: todayIso, todayIso, timeOfDay: vb.time })]}
              ctaLabel="Logold a session-t"
              onLog={() => setSportLogSport(k)}
            />
          )
        }
```

and the running branch:

```tsx
        return (
          <TodaySessionCard
            key={s.key}
            tone="run"
            emoji="🏃"
            tag="FUTÁS"
            time={s.timeOfDay}
            title={s.label}
            facts={[`RPE ${s.rpeTarget.min}–${s.rpeTarget.max}`, s.rounds ? `${s.rounds} kör` : null]}
            logged={Boolean(rl)}
            loggedSummary={rl ? `RPE ${rl.rpeActual ?? '–'}${rl.completedRounds != null ? ` · ${rl.completedRounds} kör` : ''}` : undefined}
            loggedDetail={null}
            stateLabel={SESSION_STATE_LABEL[sessionState({ dayIso: todayIso, todayIso, timeOfDay: s.timeOfDay })]}
            ctaLabel="Naplózd a futást"
            onLog={openRunLog}
          />
        )
```

Add the imports and the `todayIso` const near the existing `todayHu`:

```tsx
import { SPORT_TONE, sportOf, SPORT_EMOJI, SPORT_TAGS, SPORT_TITLES, type SportKind } from '@/features/train/logic/sportKinds'
import { SESSION_STATE_LABEL, sessionState } from '@/features/train/logic/sessionState'
```

```tsx
  const todayIso = localDateString()
  const todayHu = huMonthDayDow(todayIso)
```

Also swap the gym hero's completed-state button for the shared bar (same block, `completedTodayWorkout` branch):

```tsx
              {completedTodayWorkout ? (
                <DoneBar
                  summary={`Kész · ${completedTodayWorkout.sets.filter((s) => !s.skipped).length} szett`}
                  detail="Megnézem a összegzést"
                  onClick={() => navigate(`/train/review/${completedTodayWorkout.id}`)}
                  ariaLabel="Befejezett edzés áttekintése"
                />
              ) : todaySession?.openWorkout ? (
```

with `import { DoneBar } from '@/features/train/components/DoneBar'`.

**Copy fix:** use `detail="Megnézem az összegzést"` (correct Hungarian article) — write it exactly that way.

- [ ] **Step 6: Run the card + page tests**

Run: `pnpm vitest run src/features/train/components/TodaySessionCard.test.tsx src/features/train/pages/TrainTodayPage.test.tsx`
Expected: the card's 4 tests PASS. `TrainTodayPage.test.tsx` may fail on the two done-state assertions that search for `Logolva · RPE 7 · 90p` / `Logolva · RPE 7 · 60p` (the `Logolva · ` prefix moved into `DoneBar`'s summary format). Update those assertions to the new copy (`RPE 7 · 90p`, `RPE 7 · 60p`) — including the `getByRole('button', { name: … })` lookups — then re-run until green.

- [ ] **Step 7: Verify both modes for the touched files**

Run: `pnpm vitest run src/features/train && VITE_USE_MOCK=true pnpm vitest run src/features/train`
Expected: PASS in both.

- [ ] **Step 8: Commit**

```bash
git add src/features/train/components/TodaySessionCard.tsx src/features/train/components/TodaySessionCard.test.tsx src/features/train/pages/TrainTodayPage.tsx src/features/train/pages/TrainTodayPage.test.tsx src/styles/prototype.css
git commit --no-verify -m "feat(train): K3 session cards — icon shield, five tones, DoneBar (mezo-9bbc)"
```

---

### Task 5: Extract `buildWeekAgenda` (pure)

The weekly agenda build currently lives inline in `TrainTodayPage`. Both pages need it, so it moves into a pure helper — no behaviour change.

**Files:**
- Create: `frontend/src/features/train/logic/weekAgenda.ts`
- Create: `frontend/src/features/train/logic/weekAgenda.test.ts`
- Modify: `frontend/src/features/train/pages/TrainTodayPage.tsx`

**Interfaces:**
- Consumes: `WeeklyAgendaDay` (`@/features/train/components/WeeklyDayRow`), `runSessionsForDay`/`todayIdx` (`@/data/train/runningAgenda`), `DAY_ORDER` (`@/data/train/train`), `localDateString` (`@/shared/lib/dates`).
- Produces:
```ts
function buildWeekAgenda(args: {
  gymTimes: GymScheduleDay[]
  sportSlots: VolleyballSession[]
  runningBlock: RunningBlockResponse | null
  weekWorkouts: { id: string; date: string; origin: string; status: string; title: string }[]
  today?: Date
}): WeeklyAgendaDay[]
function weekDateIso(index: number, today?: Date): string
```

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/train/logic/weekAgenda.test.ts`:

```ts
import { expect, test } from 'vitest'
import { buildWeekAgenda } from '@/features/train/logic/weekAgenda'
import { DAY_ORDER } from '@/data/train/train'

const gym = (day: string, time: string) => ({ day, active: true, time, duration: 75, type: `${day} nap` }) as never
const sport = (day: string, time: string) => ({ day, time, duration: 90, court: 'BVSC', intensity: 'közepes', role: 'edzés' }) as never

test('returns one entry per weekday in DAY_ORDER order, with ISO dates', () => {
  const agenda = buildWeekAgenda({ gymTimes: [], sportSlots: [], runningBlock: null, weekWorkouts: [] })
  expect(agenda).toHaveLength(7)
  expect(agenda.map((a) => a.day)).toEqual([...DAY_ORDER])
  for (const a of agenda) expect(a.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
})

test('places gym slots and sport slots on their own day, dropping inactive gym slots', () => {
  const agenda = buildWeekAgenda({
    gymTimes: [gym('Kedd', '07:30'), { ...(gym('Sze', '07:30') as object), active: false } as never],
    sportSlots: [sport('Kedd', '18:00'), sport('Kedd', '20:00')],
    runningBlock: null,
    weekWorkouts: [],
  })
  const tue = agenda.find((a) => a.day === 'Kedd')!
  expect(tue.gym?.time).toBe('07:30')
  expect(tue.sport).toHaveLength(2)
  expect(agenda.find((a) => a.day === 'Sze')!.gym).toBeNull()
})

test('attaches completed custom instances by ISO date and flags today from the slot flags', () => {
  const agenda = buildWeekAgenda({
    gymTimes: [{ ...(gym('Csü', '07:30') as object), today: true } as never],
    sportSlots: [],
    runningBlock: null,
    weekWorkouts: [],
  })
  expect(agenda.find((a) => a.day === 'Csü')!.isToday).toBe(true)
  expect(agenda.filter((a) => a.isToday)).toHaveLength(1)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/features/train/logic/weekAgenda.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the helper**

Create `frontend/src/features/train/logic/weekAgenda.ts` by lifting the existing block from `TrainTodayPage.tsx` (the `gymTimes`/`vbSessions`/`weekDateIso`/`customByDate`/`agenda` sequence) verbatim into:

```ts
// ============================================================
// Mezo · weekAgenda — pure Mon–Sun agenda build shared by Mai and Heti
// (mezo-9bbc; lifted out of TrainTodayPage unchanged). Merges the gym
// schedule, the recurring sport slots, the prescribed runs and this
// week's completed custom instances into one WeeklyAgendaDay per weekday.
// ============================================================
import type { WeeklyAgendaDay } from '@/features/train/components/WeeklyDayRow'
import type { GymScheduleDay, VolleyballSession } from '@/data/types'
import type { RunningBlockResponse } from '@/data/train/runningApi'
import { DAY_ORDER } from '@/data/train/train'
import { runSessionsForDay, todayIdx } from '@/data/train/runningAgenda'
import { localDateString } from '@/shared/lib/dates'

/** ISO date of this week's weekday `index` (0 = Monday), relative to `today`. */
export function weekDateIso(index: number, today = new Date()): string {
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate() - todayIdx(today) + index)
  return localDateString(base)
}

export function buildWeekAgenda({
  gymTimes,
  sportSlots,
  runningBlock,
  weekWorkouts,
  today = new Date(),
}: {
  gymTimes: GymScheduleDay[]
  sportSlots: VolleyballSession[]
  runningBlock: RunningBlockResponse | null
  weekWorkouts: { id: string; date: string; origin: string; status: string; title: string }[]
  today?: Date
}): WeeklyAgendaDay[] {
  // Completed custom (saját) instances of this week, grouped by ISO date — extra
  // rows on the date they were actually trained (mezo-ws2x).
  const customByDate = new Map<string, { id: string; title: string }[]>()
  for (const w of weekWorkouts) {
    if (w.origin === 'custom' && w.status === 'completed') {
      const list = customByDate.get(w.date) ?? []
      list.push({ id: w.id, title: w.title })
      customByDate.set(w.date, list)
    }
  }

  return DAY_ORDER.map((d, i) => {
    const g = gymTimes.find((x) => x.day === d)
    const v = sportSlots.filter((x) => x.day === d)
    const date = weekDateIso(i, today)
    return {
      day: d,
      date,
      gym: g && g.active ? g : null,
      sport: v,
      running: runSessionsForDay(runningBlock, DAY_ORDER.indexOf(d)),
      isToday: Boolean(g?.today || v.some((x) => x.today)),
      custom: customByDate.get(date) ?? [],
    }
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/features/train/logic/weekAgenda.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Make `TrainTodayPage` consume it**

In `frontend/src/features/train/pages/TrainTodayPage.tsx`, delete the inline `gymTimes`/`vbSessions`/`weekDateIso`/`customByDate`/`agenda` block and replace it with:

```tsx
  const agenda = buildWeekAgenda({
    gymTimes: gymSchedule?.weeklyTimes ?? [],
    sportSlots: sport.schedule?.volleyball.sessions ?? [],
    runningBlock: activeRunningBlock,
    weekWorkouts,
  })
```

Add `import { buildWeekAgenda } from '@/features/train/logic/weekAgenda'` and drop now-unused imports (`localDateString` stays — `todayIso` uses it; remove `todayIdx` only if nothing else in the file uses it — `todayRuns` does, so keep it).

- [ ] **Step 6: Run the page tests in both modes**

Run: `pnpm vitest run src/features/train && VITE_USE_MOCK=true pnpm vitest run src/features/train`
Expected: PASS — this is a pure refactor, every existing assertion must still hold.

- [ ] **Step 7: Commit**

```bash
git add src/features/train/logic/weekAgenda.ts src/features/train/logic/weekAgenda.test.ts src/features/train/pages/TrainTodayPage.tsx
git commit --no-verify -m "refactor(train): extract pure buildWeekAgenda for Mai + Heti (mezo-9bbc)"
```

---

### Task 6: `dayStripItems` + `DayStrip`

The compact week navigator: one chip per weekday carrying modality dots and a done marker.

**Files:**
- Create: `frontend/src/features/train/logic/dayStripItems.ts`
- Create: `frontend/src/features/train/logic/dayStripItems.test.ts`
- Create: `frontend/src/features/train/components/DayStrip.tsx`
- Create: `frontend/src/features/train/components/DayStrip.test.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: `WeeklyAgendaDay`, `daySessions` (`@/features/train/logic/agenda`), `SPORT_TONE`/`SessionTone`/`sportOf` (Task 1).
- Produces:
```ts
interface DayStripItem { day: string; dayNumber: number; isToday: boolean; dots: SessionTone[]; doneCount: number; sessionCount: number }
function dayStripItems(agenda: WeeklyAgendaDay[], isDone: (day: WeeklyAgendaDay, item: AgendaItem) => boolean): DayStripItem[]
function DayStrip(props: { items: DayStripItem[]; selected: string; onSelect: (day: string) => void }): JSX.Element
```

- [ ] **Step 1: Write the failing logic test**

Create `frontend/src/features/train/logic/dayStripItems.test.ts`:

```ts
import { expect, test } from 'vitest'
import { dayStripItems } from '@/features/train/logic/dayStripItems'
import type { WeeklyAgendaDay } from '@/features/train/components/WeeklyDayRow'

const day = (over: Partial<WeeklyAgendaDay>): WeeklyAgendaDay => ({
  day: 'Kedd', date: '2026-05-19', gym: null, sport: [], running: [], isToday: false, ...over,
})

const gymSlot = { day: 'Kedd', active: true, time: '07:30', duration: 75, type: 'Legs' } as never
const trxSlot = { day: 'Kedd', time: '12:00', duration: 60, court: '', intensity: '', role: 'edzés', sport: 'trx' } as never
const run = { key: 'tue-sprint', timeOfDay: '18:00', label: 'Sprint', kind: 'sprint', rpeTarget: { min: 9, max: 10 } } as never

test('dots follow each session tone in time order', () => {
  const items = dayStripItems([day({ gym: gymSlot, sport: [trxSlot], running: [run] })], () => false)
  expect(items[0].dots).toEqual(['gym', 'trx', 'run'])
  expect(items[0].sessionCount).toBe(3)
  expect(items[0].doneCount).toBe(0)
})

test('doneCount counts the sessions the predicate marks done', () => {
  const items = dayStripItems([day({ gym: gymSlot, running: [run] })], (_d, item) => item.kind === 'gym')
  expect(items[0].doneCount).toBe(1)
  expect(items[0].sessionCount).toBe(2)
})

test('an empty day yields no dots and keeps its day number', () => {
  const items = dayStripItems([day({ day: 'Vas', date: '2026-05-24' })], () => false)
  expect(items[0]).toMatchObject({ day: 'Vas', dayNumber: 24, dots: [], sessionCount: 0 })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/features/train/logic/dayStripItems.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the helper**

Create `frontend/src/features/train/logic/dayStripItems.ts`:

```ts
// ============================================================
// Mezo · dayStripItems — pre-derives the DayStrip's chips from the week
// agenda (mezo-9bbc). Keeps DayStrip presentational: it receives dots and
// counts, never predicates or domain types.
// ============================================================
import type { WeeklyAgendaDay } from '@/features/train/components/WeeklyDayRow'
import { daySessions, type AgendaItem } from '@/features/train/logic/agenda'
import { SPORT_TONE, sportOf, type SessionTone } from '@/features/train/logic/sportKinds'

export interface DayStripItem {
  /** Day key from DAY_ORDER (`Hét`…`Vas`). */
  day: string
  /** Day-of-month of this weekday in the current week. */
  dayNumber: number
  isToday: boolean
  /** One tone per session, in time order — rendered as coloured dots. */
  dots: SessionTone[]
  doneCount: number
  sessionCount: number
}

const toneOf = (item: AgendaItem): SessionTone =>
  item.kind === 'gym' ? 'gym' : item.kind === 'running' ? 'run' : SPORT_TONE[sportOf(item.sport)]

export function dayStripItems(
  agenda: WeeklyAgendaDay[],
  isDone: (day: WeeklyAgendaDay, item: AgendaItem) => boolean,
): DayStripItem[] {
  return agenda.map((d) => {
    const sessions = daySessions(d)
    return {
      day: d.day,
      dayNumber: d.date ? Number(d.date.slice(8, 10)) : 0,
      isToday: d.isToday,
      dots: sessions.map(toneOf),
      doneCount: sessions.filter((s) => isDone(d, s)).length,
      sessionCount: sessions.length,
    }
  })
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm vitest run src/features/train/logic/dayStripItems.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing component test**

Create `frontend/src/features/train/components/DayStrip.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { DayStrip } from '@/features/train/components/DayStrip'
import type { DayStripItem } from '@/features/train/logic/dayStripItems'

const items: DayStripItem[] = [
  { day: 'Hét', dayNumber: 18, isToday: false, dots: ['gym', 'sport'], doneCount: 2, sessionCount: 2 },
  { day: 'Kedd', dayNumber: 19, isToday: true, dots: ['cross', 'run', 'sport'], doneCount: 1, sessionCount: 3 },
  { day: 'Vas', dayNumber: 24, isToday: false, dots: [], doneCount: 0, sessionCount: 0 },
]

test('renders one chip per day with tone-coloured dots', () => {
  const { container } = render(<DayStrip items={items} selected="Kedd" onSelect={() => {}} />)
  expect(container.querySelectorAll('.daychip')).toHaveLength(3)
  expect(container.querySelectorAll('.daychip')[1].querySelectorAll('.dot-cross, .dot-run, .dot-sport')).toHaveLength(3)
})

test('marks today, the selection and an empty rest day distinctly', () => {
  const { container } = render(<DayStrip items={items} selected="Kedd" onSelect={() => {}} />)
  const chips = container.querySelectorAll('.daychip')
  expect(chips[1].className).toContain('today')
  expect(chips[1].className).toContain('sel')
  expect(chips[2].className).toContain('rest')
  // today's chip is labelled MA, the others by their day key
  expect(screen.getByText('MA')).toBeInTheDocument()
  expect(screen.getByText('Hét')).toBeInTheDocument()
})

test('shows a done marker per logged session and a dash when nothing is logged', () => {
  render(<DayStrip items={items} selected="Kedd" onSelect={() => {}} />)
  expect(screen.getByText('✓✓')).toBeInTheDocument()   // Hét: 2 of 2
  expect(screen.getByText('✓')).toBeInTheDocument()     // Kedd: 1 of 3
  expect(screen.getByText('pihenő')).toBeInTheDocument()// Vas: no sessions
})

test('selecting a day calls onSelect with its day key', () => {
  const onSelect = vi.fn()
  render(<DayStrip items={items} selected="Kedd" onSelect={onSelect} />)
  fireEvent.click(screen.getByRole('button', { name: /Hét/ }))
  expect(onSelect).toHaveBeenCalledWith('Hét')
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `pnpm vitest run src/features/train/components/DayStrip.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 7: Write the component**

Create `frontend/src/features/train/components/DayStrip.tsx`:

```tsx
// ============================================================
// Mezo · DayStrip — Mai's horizontal week navigator (mezo-9bbc).
// One `.daychip` per weekday: label (MA on today) + day number, a dot per
// scheduled session coloured by modality, and a done marker line. Purely
// presentational — it receives pre-derived DayStripItems (dayStripItems.ts).
// ============================================================
import { cn } from '@/shared/lib/cn'
import { DAY_LABELS } from '@/data/train/train'
import type { DayStripItem } from '@/features/train/logic/dayStripItems'

export function DayStrip({
  items,
  selected,
  onSelect,
}: {
  items: DayStripItem[]
  /** Day key of the currently shown day. */
  selected: string
  onSelect: (day: string) => void
}) {
  return (
    <div className="daystrip" role="tablist" aria-label="Hét napjai">
      {items.map((it) => {
        const empty = it.sessionCount === 0
        return (
          <button
            key={it.day}
            type="button"
            role="tab"
            aria-selected={it.day === selected}
            className={cn('daychip', it.isToday && 'today', it.day === selected && 'sel', empty && 'rest')}
            onClick={() => onSelect(it.day)}
            aria-label={`${DAY_LABELS[it.day] ?? it.day}${it.isToday ? ' · ma' : ''}`}
          >
            <span className="dl">{it.isToday ? 'MA' : it.day}</span>
            <span className="dn">{it.dayNumber}</span>
            <span className="dots" aria-hidden="true">
              {it.dots.map((tone, i) => (
                <span key={`${tone}-${i}`} className={cn('dot', `dot-${tone}`)} />
              ))}
            </span>
            <span className="ck">
              {empty ? 'pihenő' : it.doneCount > 0 ? '✓'.repeat(it.doneCount) : '—'}
            </span>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 8: Add the CSS**

Append to `frontend/src/styles/prototype.css` before the `.dayrow` block:

```css
/* ===== Napív day strip — Mai's week navigator (mezo-9bbc) ===== */
.daystrip { display: flex; gap: 9px; overflow-x: auto; scroll-snap-type: x proximity; padding: 2px 24px 6px; }
.daystrip::-webkit-scrollbar { height: 0; }
.daychip { flex: none; width: 62px; scroll-snap-align: center; border-radius: 20px; background: var(--surface); box-shadow: var(--np-shadow-row); padding: 9px 0 8px; text-align: center; border: 1.5px solid transparent; font-family: inherit; cursor: pointer; }
.daychip .dl { display: block; font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--faint); }
.daychip .dn { display: block; font-family: var(--ff-display); font-size: 17px; font-weight: 800; color: var(--ink); margin-top: 1px; }
.daychip .dots { display: flex; gap: 3px; justify-content: center; margin-top: 6px; min-height: 6px; }
.daychip .dot { width: 6px; height: 6px; border-radius: 50%; }
.dot-gym { background: var(--tag-gym); }
.dot-sport { background: var(--tag-sport); }
.dot-cross { background: var(--tag-cross); }
.dot-trx { background: var(--tag-trx); }
.dot-run { background: var(--tag-run); }
.daychip .ck { display: block; font-size: 9px; font-weight: 800; color: var(--sage-deep); margin-top: 5px; letter-spacing: .04em; }
.daychip.rest { background: transparent; box-shadow: none; border-style: dashed; border-color: var(--line); }
.daychip.rest .ck { color: var(--faint); }
.daychip.today { border-color: var(--coral); }
.daychip.today .dl { color: var(--coral-deep); }
.daychip.sel { background: var(--ink); border-color: var(--ink); }
.daychip.sel .dl { color: color-mix(in srgb, var(--surface) 70%, transparent); }
.daychip.sel .dn { color: var(--surface); }
.daychip.sel.today { box-shadow: 0 0 0 2px var(--coral); }
```

- [ ] **Step 9: Run the component test**

Run: `pnpm vitest run src/features/train/components/DayStrip.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 10: Commit**

```bash
git add src/features/train/logic/dayStripItems.ts src/features/train/logic/dayStripItems.test.ts src/features/train/components/DayStrip.tsx src/features/train/components/DayStrip.test.tsx src/styles/prototype.css
git commit --no-verify -m "feat(train): DayStrip week navigator + pre-derived chip items (mezo-9bbc)"
```

---

### Task 7: `TrainWeekPage` — the new „Heti” page

Give the detailed weekly list its own route **before** removing it from Mai, so no functionality is ever missing.

**Files:**
- Create: `frontend/src/features/train/pages/TrainWeekPage.tsx`
- Create: `frontend/src/features/train/pages/TrainWeekPage.test.tsx`
- Create: `frontend/src/features/train/pages/TrainWeekSkeleton.tsx`
- Modify: `frontend/src/features/train/pages/tabs.ts`
- Modify: `frontend/src/app/router.tsx`

**Interfaces:**
- Consumes: `buildWeekAgenda` (Task 5), `WeeklyDayRow`, `LoadTiles`, `weeklyLoad`, `gymDayTarget`, `useTrain`/`useRunning`/`useWeekWorkouts` from `@/data/hooks`.
- Produces: route `/train/week`, tab `{ id: 'week', to: '/train/week', label: 'Heti' }`, component `TrainWeekPage`.
- **Naming note:** `WeeklyPage` is already taken by `@/features/insights/pages/WeeklyPage` (imported in the router) — this one is `TrainWeekPage`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/train/pages/TrainWeekPage.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { TrainWeekPage } from '@/features/train/pages/TrainWeekPage'
import { QueryWrapper } from '@/test/queryWrapper'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  mockNavigate.mockReset()
})
afterEach(() => vi.unstubAllEnvs())

const renderPage = () => render(<QueryWrapper><MemoryRouter><TrainWeekPage /></MemoryRouter></QueryWrapper>)

test('renders the week head, the load tiles and one card per weekday', () => {
  const { container } = renderPage()
  expect(screen.getByRole('heading', { name: 'Heti terv' })).toBeInTheDocument()
  expect(container.querySelectorAll('.loadtile')).toHaveLength(3)
  expect(container.querySelectorAll('.dayrow')).toHaveLength(7)
})

test('tapping a non-gym session drills into Mai with that day selected', () => {
  const { container } = renderPage()
  // the mock week has volleyball on Monday (index 0) — its session block navigates to Mai
  const monday = container.querySelectorAll('.dayrow')[0]
  const sportBlock = monday.querySelectorAll('.s')
  fireEvent.click(sportBlock[sportBlock.length - 1])
  expect(mockNavigate).toHaveBeenCalledWith('/train?day=0')
})

test('keeps the provenance note and the Saját edzés footer', () => {
  renderPage()
  expect(screen.getByText(/A gym a mesociklus szerint/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Saját edzés/ })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `VITE_USE_MOCK=true pnpm vitest run src/features/train/pages/TrainWeekPage.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the skeleton**

Create `frontend/src/features/train/pages/TrainWeekSkeleton.tsx`:

```tsx
// Layout-aware loading skeleton for TrainWeekPage (mezo-9bbc): page head →
// three load tiles → seven day-card placeholders, so the swap does not reflow.
import { Skeleton, SkeletonCard } from '@/shared/ui/Skeleton'

export default function TrainWeekSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      <div className="pghead-np">
        <div className="col gap-xs"><Skeleton width={80} height={11} /><Skeleton width={120} height={22} /></div>
      </div>
      <div style={{ display: 'flex', gap: 9, margin: '14px 24px 0' }}>
        {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} width="100%" height={52} radius={18} />)}
      </div>
      <div style={{ padding: '16px 24px' }}>
        <div className="col gap-sm">
          {Array.from({ length: 7 }, (_, i) => <SkeletonCard key={i} style={{ height: 96 }} />)}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Write the page**

Create `frontend/src/features/train/pages/TrainWeekPage.tsx`. Move the `Heti terv` section out of `TrainTodayPage` (the `secthead-np` + `agenda.map(WeeklyDayRow)` + the dashed footer + the provenance note) and the `LoadTiles` call, wiring the same handlers:

```tsx
// ============================================================
// Mezo · TrainWeekPage („Heti”) — the detailed Mon–Sun agenda that used to
// live at the bottom of Mai (mezo-9bbc). Weekly load tiles + one WeeklyDayRow
// per day + the Saját edzés footer + the gym/sport provenance note. Gym rows
// keep their direct-start/review targets; any other session drills into Mai
// with that day selected (`/train?day={index}`).
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrain, useRunning, useWeekWorkouts } from '@/data/hooks'
import { DAY_ORDER } from '@/data/train/train'
import { huMonthDayDow, localDateString } from '@/shared/lib/dates'
import { Icon } from '@/shared/ui/Icon'
import { GhostState } from '@/shared/ui/GhostState'
import { LoadTiles } from '@/features/train/components/LoadTiles'
import { WeeklyDayRow } from '@/features/train/components/WeeklyDayRow'
import { CustomWorkoutSheet } from '@/features/train/sheets/CustomWorkoutSheet'
import { SportLogSheet } from '@/features/train/sheets/SportLogSheet'
import { buildWeekAgenda } from '@/features/train/logic/weekAgenda'
import { weeklyLoad } from '@/features/train/logic/weeklyLoad'
import { gymDayTarget } from '@/features/train/logic/gymDayTarget'
import { sportOf, type SportKind } from '@/features/train/logic/sportKinds'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import TrainWeekSkeleton from '@/features/train/pages/TrainWeekSkeleton'

export function TrainWeekPage() {
  const { gymSchedule, sport, activeMeso, logSportSession, gymDoneDates, workoutPending, todaySession } = useTrain()
  const { activeRunningBlock, runSessions, runningPending } = useRunning()
  const { workouts: weekWorkouts } = useWeekWorkouts()
  const navigate = useNavigate()
  const { showLevelUp } = useLevelUp()
  const [customOpen, setCustomOpen] = useState(false)
  const [sportLogSport, setSportLogSport] = useState<SportKind | null>(null)

  if (workoutPending || runningPending) return <TrainWeekSkeleton />

  const agenda = buildWeekAgenda({
    gymTimes: gymSchedule?.weeklyTimes ?? [],
    sportSlots: sport.schedule?.volleyball.sessions ?? [],
    runningBlock: activeRunningBlock,
    weekWorkouts,
  })
  const sessionCount = agenda.filter((a) => a.gym || a.sport.length || a.running.length).length
  const sportDoneOn = (iso: string | undefined, k: SportKind) =>
    Boolean(iso) && sport.sessions.some((s) => s.sport === k && s.date === huMonthDayDow(iso!))
  const workoutIdByDate = Object.fromEntries(
    weekWorkouts.filter((w) => w.status === 'completed' && w.origin === 'meso').map((w) => [w.date, w.id]),
  )
  const runLoggedFor = (key: string) =>
    runSessions.some(
      (r) => r.blockId === activeRunningBlock?.id && r.weekNumber === activeRunningBlock?.currentWeek && r.sessionKey === key,
    )
  const toMai = (day: string) => navigate(`/train?day=${DAY_ORDER.indexOf(day)}`)

  return (
    <>
      <div className="pghead-np">
        <div>
          <div className="over">{activeMeso ? `Edzés · W${activeMeso.currentWeek}` : 'Edzés'}</div>
          <h1>Heti terv</h1>
        </div>
      </div>

      {!activeMeso ? (
        <div style={{ padding: '0 24px 16px' }}>
          <GhostState lines={3} message="A heti rended itt jelenik majd meg — előbb tervezz egy mesociklust."
            ctaLabel="+ Tervezz mesociklust" onCta={() => navigate('/train/mesocycles/new')} />
        </div>
      ) : (
        <>
          <LoadTiles tiles={weeklyLoad(agenda)} />
          <div style={{ padding: '0 24px 16px' }}>
            <div className="secthead-np">
              <h3>A hét</h3>
              <span>{sessionCount} session</span>
            </div>
            <div className="col gap-sm">
              {agenda.map((a) => (
                <WeeklyDayRow
                  key={a.day}
                  agenda={a}
                  gymLogged={Boolean(a.date) && gymDoneDates.includes(a.date!)}
                  gymInProgress={Boolean(a.isToday && todaySession?.openWorkout)}
                  isSportLogged={(s) => sportDoneOn(a.date, sportOf(s))}
                  isRunLogged={(key) => runLoggedFor(key)}
                  onStartGym={() => navigate('/train/session')}
                  onReviewGym={workoutIdByDate[a.date!] ? () => navigate(`/train/review/${workoutIdByDate[a.date!]}`) : undefined}
                  onOpenGymDay={(() => {
                    const md = activeMeso.days?.find((d) => d.day === a.day && d.exerciseCount > 0)
                    if (!md) return undefined
                    const target = gymDayTarget(md, weekWorkouts)
                    return target ? () => navigate(target) : undefined
                  })()}
                  onLogSport={() => toMai(a.day)}
                  onLogRun={() => toMai(a.day)}
                  onReviewCustom={(wid) => navigate(`/train/review/${wid}`)}
                />
              ))}
            </div>
            <button type="button" onClick={() => setCustomOpen(true)} className="card mt-md" style={{
              padding: 12, width: '100%', background: 'transparent', borderStyle: 'dashed',
              borderColor: 'var(--line)', color: 'var(--tag-gym)', fontSize: 10,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <Icon name="plus" size={12} /> Saját edzés
            </button>
          </div>
        </>
      )}

      <div style={{ padding: '0 24px 32px' }}>
        <div className="card" style={{ padding: 12, background: 'color-mix(in srgb, var(--coral) 3%, transparent)' }}>
          <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
            <Icon name="sparkle" size={12} color="var(--coral)" />
            <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)', flex: 1 }}>
              A gym a mesociklus szerint, a sport (röpi/cross/TRX) recurring · független. A két ütemterv együtt-mozgatja a
              pacing-et, alvás-onsetet és a vacsora-időt.
            </p>
          </div>
        </div>
      </div>

      {customOpen && <CustomWorkoutSheet onClose={() => setCustomOpen(false)} />}
      {sportLogSport && (
        <SportLogSheet
          initialSport={sportLogSport}
          onClose={() => setSportLogSport(null)}
          onSave={(body, done) => logSportSession(body, { onSuccess: (r) => showLevelUp(r?.levelUp), onSettled: done })}
        />
      )}
    </>
  )
}
```

Note: `localDateString` is imported above only if you still need it — after this page's `sportDoneOn` uses `huMonthDayDow(iso)`, the `localDateString` import is unused, so **drop it** (the build's `tsc -b` fails on unused imports under this repo's config).

- [ ] **Step 5: Register the route and the tab**

`frontend/src/features/train/pages/tabs.ts` — insert after `Mai`:

```ts
  { id: 'mai', to: '/train', label: 'Mai', end: true },
  { id: 'week', to: '/train/week', label: 'Heti' },
```

`frontend/src/app/router.tsx` — add the import and the child route:

```tsx
import { TrainWeekPage } from '@/features/train/pages/TrainWeekPage'
```

```tsx
          { index: true, element: <TrainTodayPage /> },
          { path: 'week', element: <TrainWeekPage /> },
```

- [ ] **Step 6: Run the tests**

Run: `VITE_USE_MOCK=true pnpm vitest run src/features/train/pages/TrainWeekPage.test.tsx src/features/train/train.nav.test.tsx`
Expected: the page's 3 tests PASS. If `train.nav.test.tsx` asserts a tab count, update it to 7 and add `Heti` to its expected labels.

- [ ] **Step 7: Verify the build**

Run: `pnpm build`
Expected: success — no name clash with the Insights `WeeklyPage`.

- [ ] **Step 8: Commit**

```bash
git add src/features/train/pages/TrainWeekPage.tsx src/features/train/pages/TrainWeekPage.test.tsx src/features/train/pages/TrainWeekSkeleton.tsx src/features/train/pages/tabs.ts src/app/router.tsx src/features/train/train.nav.test.tsx
git commit --no-verify -m "feat(train): Heti page — the detailed weekly agenda at /train/week (mezo-9bbc)"
```

---

### Task 8: Mai becomes a one-day page (DayStrip + selected day)

Wire the strip, make everything below it render the **selected** day, and remove the weekly list + load tiles (now living on Heti).

**Files:**
- Modify: `frontend/src/features/train/pages/TrainTodayPage.tsx`
- Modify: `frontend/src/features/train/pages/TrainTodayPage.test.tsx`

**Interfaces:**
- Consumes: `DayStrip` + `dayStripItems` (Task 6), `buildWeekAgenda` (Task 5), `sessionState`/`SESSION_STATE_LABEL` (Task 3), `TodaySessionCard` (Task 4).
- Produces: `?day={0..6}` deep-link contract consumed by `TrainWeekPage` (Task 7).

- [ ] **Step 1: Write the failing tests**

Add to `frontend/src/features/train/pages/TrainTodayPage.test.tsx` (the file already mocks `useNavigate`; `renderView` exists — add a variant that accepts an initial URL):

```tsx
test('day strip: selecting another day swaps the rendered sessions, no refetch', async () => {
  renderView()
  // mock week: today is Csü (gym Pull Day). Kedd carries volleyball 17:00.
  expect(screen.getByRole('heading', { name: 'Mai nap' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('tab', { name: /Kedd/ }))
  expect(screen.getByRole('heading', { name: 'Kedd' })).toBeInTheDocument()
  expect(await screen.findByText('Volleyball', { selector: '.todaycard-title' })).toBeInTheDocument()
  // back to today
  fireEvent.click(screen.getByRole('button', { name: /Ma$/ }))
  expect(screen.getByRole('heading', { name: 'Mai nap' })).toBeInTheDocument()
})

test('the weekly list and load tiles moved to Heti — Mai renders neither', () => {
  const { container } = renderView()
  expect(container.querySelectorAll('.dayrow')).toHaveLength(0)
  expect(container.querySelectorAll('.loadtile')).toHaveLength(0)
  expect(screen.queryByText('Heti terv')).not.toBeInTheDocument()
  // the strip replaces them
  expect(container.querySelectorAll('.daychip')).toHaveLength(7)
})

test('?day= initialises the selection (drill-in from Heti)', () => {
  render(
    <QueryWrapper><MemoryRouter initialEntries={['/train?day=1']}><LevelUpProvider><TrainTodayPage /></LevelUpProvider></MemoryRouter></QueryWrapper>,
  )
  expect(screen.getByRole('heading', { name: 'Kedd' })).toBeInTheDocument()
})

test('today-only blocks hide on a non-today selection', () => {
  renderView()
  fireEvent.click(screen.getByRole('tab', { name: /Szombat|Szo/ }))
  // the morning-training nudge is a today-only nudge
  expect(screen.queryByText(/Reggeli edzés/i)).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run src/features/train/pages/TrainTodayPage.test.tsx`
Expected: FAIL — no `tab` role, `.dayrow`s still present.

- [ ] **Step 3: Add the selected-day state**

In `frontend/src/features/train/pages/TrainTodayPage.tsx`:

```tsx
import { useSearchParams } from 'react-router-dom'
import { DayStrip } from '@/features/train/components/DayStrip'
import { dayStripItems } from '@/features/train/logic/dayStripItems'
import { DAY_LABELS, DAY_ORDER } from '@/data/train/train'
```

after the existing hooks (before the early returns, so hook order stays stable):

```tsx
  const [params] = useSearchParams()
  // Mai always opens on today; `?day={0..6}` (the Heti drill-in) overrides it once.
  const dayParam = Number(params.get('day'))
  const paramDay = Number.isInteger(dayParam) && dayParam >= 0 && dayParam <= 6 ? DAY_ORDER[dayParam] : null
  const [selectedDay, setSelectedDay] = useState<string | null>(paramDay)
```

`selectedDay === null` means "today" — derive the shown day after `agenda` exists:

```tsx
  const todayRow = agenda.find((a) => a.isToday)
  const shownDay = selectedDay ? agenda.find((a) => a.day === selectedDay) ?? todayRow : todayRow
  const isTodayShown = Boolean(shownDay?.isToday)
```

- [ ] **Step 4: Render the strip and switch the day-scoped blocks**

Replace the current `today`/`orderedToday` derivation with the shown-day version (the run merge stays today-only, since `todayRuns` is date-derived):

```tsx
  const todayRuns = runSessionsForDay(activeRunningBlock, todayIdx())
  const orderedToday = daySessions({
    day: shownDay?.day ?? '',
    gym: shownDay?.gym ?? null,
    sport: shownDay?.sport ?? [],
    running: isTodayShown ? todayRuns : (shownDay?.running ?? []),
    isToday: isTodayShown,
  })
```

Insert the strip right after the page head:

```tsx
      <DayStrip
        items={dayStripItems(agenda, (d, item) => {
          if (item.kind === 'gym') return Boolean(d.date) && gymDoneDates.includes(d.date!)
          if (item.kind === 'sport') return sportDoneOn(d.date, sportOf(item.sport))
          return Boolean(runLoggedFor(item.running.key))
        })}
        selected={shownDay?.day ?? ''}
        onSelect={(day) => setSelectedDay(day)}
      />
```

Page head becomes selection-aware:

```tsx
      <div className="pghead-np">
        <div>
          <div className="over">
            {shownDay ? `Edzés · ${DAY_LABELS[shownDay.day] ?? shownDay.day} · W${activeMeso.currentWeek}` : `Edzés · W${activeMeso.currentWeek}`}
          </div>
          <h1>{isTodayShown ? 'Mai nap' : DAY_LABELS[shownDay?.day ?? ''] ?? 'Mai nap'}</h1>
        </div>
        {!isTodayShown && (
          <button type="button" className="pgact-np" onClick={() => setSelectedDay(null)}>
            <Icon name="chevron-left" size={12} /> Ma
          </button>
        )}
      </div>
```

Gate the today-only blocks on `isTodayShown`: the `showMtr && <MorningTrainingCard …>` render, the open-instance resume card (`!shownDay?.gym && todaySession?.openWorkout && workout`), and the rest-day card — whose copy branches:

```tsx
      {!shownDay?.gym && !shownDay?.sport.length && orderedToday.length === 0 && !(isTodayShown && todaySession?.openWorkout) && (
        <div style={{ padding: '0 24px 12px' }}>
          <div className="card" style={{ padding: 18 }}>
            <span className="eyebrow">{isTodayShown ? 'Ma pihenőnap' : 'Nincs tervezett edzés'}</span>
            <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {isTodayShown
                ? 'Nincs tervezett edzés mára — a heti rended a Heti fülön találod.'
                : 'Ezen a napon nincs tervezett edzés.'}
            </p>
            {isTodayShown && (
              <CtaGhost className="rad-12 mt-md" onClick={() => setCustomOpen(true)}
                style={{ borderColor: 'color-mix(in srgb, var(--tag-gym) 40%, transparent)', color: 'var(--tag-gym)' }}>
                <Icon name="plus" size={12} /> Saját edzés
              </CtaGhost>
            )}
          </div>
        </div>
      )}
```

Also: the gym-hero eyebrow and the `showMtr` computation stay as-is (they read today's data), but the **hero itself must only render for the shown day's gym slot** — it already does, since it iterates `orderedToday`. The `workout` guard (`if (!workout) return null`) stays for today; for a non-today gym slot render the card from the schedule slot + meso day instead:

```tsx
        if (item.kind === 'gym') {
          const gym = item.gym
          if (isTodayShown) { /* …existing three-state gym hero, unchanged… */ }
          // Non-today gym day: the /today endpoint only describes today, so title +
          // exercise count come from the meso template (mezo-9bbc).
          const md = activeMeso.days?.find((d) => d.day === shownDay!.day)
          const target = md ? gymDayTarget(md, weekWorkouts) : null
          const done = Boolean(shownDay?.date && gymDoneDates.includes(shownDay.date))
          return (
            <TodaySessionCard
              key="hero-gym"
              tone="gym"
              emoji="🏋️"
              tag="GYM"
              time={gym.time}
              title={gym.type ?? md?.type ?? 'Gym'}
              facts={[md ? `${md.exerciseCount} gyakorlat` : null, gym.duration ? `${gym.duration} perc` : null]}
              logged={done}
              loggedSummary={done ? 'Kész' : undefined}
              stateLabel={SESSION_STATE_LABEL[sessionState({ dayIso: shownDay!.date!, todayIso, timeOfDay: gym.time })]}
              ctaLabel={target ? 'Kezdjük el' : undefined}
              onLog={target ? () => navigate(target) : undefined}
            />
          )
        }
```

(`MesoDay` — `src/data/types.ts:719` — has **no `title`**; its human label is `type` (`'Pull Day'`), hence the `md?.type` fallback above. Do not invent `md.title`.)

**The `isTodayShown` branch keeps the existing three-state gym hero verbatim** — do not rewrite it. Wrap the current `<section className="trainhero np-anim">…</section>` block (eyebrow + `h2row` + `chips` + the completed/in-progress/fresh CTA ladder, already using `DoneBar` from Task 4) in `if (isTodayShown) { return ( … ) }` and add the non-today card below it.

Remove from this page: the `LoadTiles` render + its `weeklyLoad` import, the whole `Heti terv` section (section head, `agenda.map(WeeklyDayRow)`, dashed footer), the provenance-note block, and now-unused imports (`WeeklyDayRow`, `LoadTiles`, `weeklyLoad`, `DAY_LABELS` stays, `gymDayTarget` stays for the non-today card).

- [ ] **Step 5: Run the page tests in both modes**

Run: `pnpm vitest run src/features/train/pages/TrainTodayPage.test.tsx && VITE_USE_MOCK=true pnpm vitest run src/features/train/pages/TrainTodayPage.test.tsx`
Expected: PASS. Existing assertions that referenced the weekly rows (`.dayrow` taps, `Heti terv`, `6 session`, the weekly-row review/direct-start cases) now belong to `TrainWeekPage` — **move** them into `TrainWeekPage.test.tsx` rather than deleting, so the coverage survives.

- [ ] **Step 6: Measure the result**

Run the measurement script against the dev server to confirm the target:

```bash
VITE_USE_MOCK=true pnpm dev --port 4318 &
node -e "
const {createRequire}=require('module');const r=createRequire('$PWD/package.json');const {chromium}=r('@playwright/test');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:440,height:956}})).newPage();
await p.clock.setFixedTime(new Date('2026-05-21T13:42:00'));await p.goto('http://localhost:4318/train');
await p.waitForLoadState('networkidle');
const h=await p.evaluate(()=>{const s=document.querySelector('.screen-content')??document.scrollingElement;return +(s.scrollHeight/s.clientHeight).toFixed(2)});
console.log('viewports:',h);await b.close()})()"
```

Expected: ≤ 1.4 viewports (spec target ≈1.15; anything above 1.5 means something did not move to Heti — investigate before committing).

- [ ] **Step 7: Commit**

```bash
git add src/features/train/pages/TrainTodayPage.tsx src/features/train/pages/TrainTodayPage.test.tsx src/features/train/pages/TrainWeekPage.test.tsx
git commit --no-verify -m "feat(train): Mai is a one-day page with the DayStrip navigator (mezo-9bbc)"
```

---

### Task 9: Retroactive logging on past days

Past days become loggable; future days stay read-only. Both sheets learn an optional `date`.

**Files:**
- Modify: `frontend/src/features/train/sheets/SportLogSheet.tsx`
- Modify: `frontend/src/features/train/sheets/RunLogSheet.tsx`
- Modify: `frontend/src/features/train/pages/TrainTodayPage.tsx`
- Modify: `frontend/src/features/train/sheets/SportLogSheet.test.tsx` (exists) and/or add cases to `TrainTodayPage.test.tsx`

**Interfaces:**
- Consumes: `sessionState` (Task 3), the selected day from Task 8.
- Produces: `SportLogSheet` and `RunLogSheet` both accept `date?: string` (ISO; default today) and put it in the request body.

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/features/train/pages/TrainTodayPage.test.tsx`:

```tsx
test('a past unlogged sport slot offers Pótold and logs it on that day', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const posted: Array<Record<string, unknown>> = []
  const todayIdx = (new Date().getDay() + 6) % 7
  const pastIdx = (todayIdx + 6) % 7 // yesterday in Mon-first indexing
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([realMeso('NEMNAP')])),
    http.get(`${API_BASE}/api/train/workouts/today`, () => HttpResponse.json({})),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([
      { id: 'e1f3a0e2-0000-4000-8000-0000000000aa', dayOfWeek: pastIdx, time: '18:15', durationMin: 90, kind: 'training', location: 'BVSC csarnok', intensityLabel: 'közepes' },
    ])),
    http.post(`${API_BASE}/api/train/sport-sessions`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      posted.push(body)
      return HttpResponse.json({ id: 'ss-new', sport: 'volleyball', ...body }, { status: 201 })
    }),
  )
  render(<QueryWrapper><MemoryRouter initialEntries={[`/train?day=${pastIdx}`]}><LevelUpProvider><TrainTodayPage /></LevelUpProvider></MemoryRouter></QueryWrapper>)
  expect(await screen.findByText('ELMARADT')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Pótold/ }))
  fireEvent.click(await screen.findByRole('button', { name: /Mentés/ }))
  await waitFor(() => expect(posted).toHaveLength(1))
  // the log carries the SELECTED day's date, not today
  expect(posted[0].date).not.toBe(localDateString())
})

test('a future slot renders no log CTA', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const todayIdx = (new Date().getDay() + 6) % 7
  const futureIdx = (todayIdx + 1) % 7
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([realMeso('NEMNAP')])),
    http.get(`${API_BASE}/api/train/workouts/today`, () => HttpResponse.json({})),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([
      { id: 'e1f3a0e2-0000-4000-8000-0000000000bb', dayOfWeek: futureIdx, time: '18:15', durationMin: 90, kind: 'training', location: 'BVSC csarnok', intensityLabel: 'közepes' },
    ])),
  )
  render(<QueryWrapper><MemoryRouter initialEntries={[`/train?day=${futureIdx}`]}><LevelUpProvider><TrainTodayPage /></LevelUpProvider></MemoryRouter></QueryWrapper>)
  expect(await screen.findByText('TERVEZETT')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Logold|Pótold/ })).not.toBeInTheDocument()
})
```

Note: `futureIdx`/`pastIdx` wrap inside the current Mon–Sun week; when today is Monday the "past" index lands on Sunday, which is still *this* week but a **later** ISO date — the test would then assert the wrong branch. Guard it: skip the past-day case when `todayIdx === 0` and the future case when `todayIdx === 6`, using `test.skipIf(...)` from vitest with the computed index.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run src/features/train/pages/TrainTodayPage.test.tsx`
Expected: FAIL — no `Pótold` CTA, no `ELMARADT`/`TERVEZETT` chips on non-today selections.

- [ ] **Step 3: Thread the date through the sheets**

`frontend/src/features/train/sheets/SportLogSheet.tsx` — add the prop and put it in the body:

```tsx
export function SportLogSheet({ onClose, onSave, initialSport, date }: {
  onClose: () => void
  onSave?: (input: SportSessionCreateRequest, done: () => void) => void
  initialSport?: SportKind
  /** ISO date to log against — omit for today (the server defaults to now). */
  date?: string
}) {
```

```tsx
                const body: SportSessionCreateRequest = isVolleyball
                  ? { sport: 'volleyball', duration, setsPlayed: sets, rpe, shoulderStrain: shoulder, ...(date ? { date } : {}) }
                  : { sport: kind, duration, rpe, rounds, ...(date ? { date } : {}) }
```

`frontend/src/features/train/sheets/RunLogSheet.tsx` — the run body already carries a date; make it injectable **and fix the UTC bug** (`new Date().toISOString().slice(0,10)` shifts before 02:00 local in CET):

```tsx
import { localDateString } from '@/shared/lib/dates'
```

```tsx
export function RunLogSheet({ ctx, onClose, onSave, date }: {
  ctx: { blockId: string; weekNumber: number; sessionKey: string; label: string; isSprint: boolean; defaultRounds?: number }
  onClose: () => void
  onSave?: (input: RunSessionLogRequest, done: () => void) => void
  /** ISO date to log against — defaults to today (local, not UTC). */
  date?: string
}) {
  const logDate = date ?? localDateString()
```

and use `date: logDate` in the body (replacing `isoToday`; delete the old `isoToday` const).

- [ ] **Step 4: Wire the selected day's date into the CTAs**

In `frontend/src/features/train/pages/TrainTodayPage.tsx`, keep one derived value near `shownDay`:

```tsx
  const shownIso = shownDay?.date ?? todayIso
  const shownState = (timeOfDay?: string | null) => sessionState({ dayIso: shownIso, todayIso, timeOfDay })
```

For the sport card: CTA label `MEGVAN`-independent — `ctaLabel` is `'Logold a session-t'` on today, `'Pótold'` on a past day, and `undefined` on a future day:

```tsx
              stateLabel={SESSION_STATE_LABEL[shownState(vb.time)]}
              ctaLabel={shownState(vb.time) === 'planned' ? undefined : shownState(vb.time) === 'missed' ? 'Pótold' : 'Logold a session-t'}
```

Same for the run card (`'Naplózd a futást'` / `'Pótold'` / `undefined`). Then pass the date to the sheets:

```tsx
      {sportLogSport && (
        <SportLogSheet
          initialSport={sportLogSport}
          date={shownIso === todayIso ? undefined : shownIso}
          onClose={() => setSportLogSport(null)}
          onSave={(body, done) => logSportSession(body, { onSuccess: (r) => showLevelUp(r?.levelUp), onSettled: done })}
        />
      )}
      {runLogCtx && (
        <RunLogSheet
          ctx={runLogCtx}
          date={shownIso}
          onClose={() => setRunLogCtx(null)}
          onSave={(body, done) => logRunSession(body, { onSuccess: (r) => showLevelUp(r?.levelUp), onSettled: done })}
        />
      )}
```

- [ ] **Step 5: Run the tests in both modes**

Run: `pnpm vitest run src/features/train && VITE_USE_MOCK=true pnpm vitest run src/features/train`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/train/sheets/SportLogSheet.tsx src/features/train/sheets/RunLogSheet.tsx src/features/train/pages/TrainTodayPage.tsx src/features/train/pages/TrainTodayPage.test.tsx
git commit --no-verify -m "feat(train): retroactive logging on past days, read-only future days (mezo-9bbc)"
```

---

### Task 10: Visual goldens + documentation

**Files:**
- Modify: `frontend/tests/visual/visual.spec.ts`
- Modify/Create: `frontend/tests/visual/visual.spec.ts-snapshots/*.png`
- Modify: `docs/features/train.md`
- Modify: `docs/features/_platform-design-system.md`

- [ ] **Step 1: Add the Heti screen to the visual list**

In `frontend/tests/visual/visual.spec.ts`, add to `SCREENS` after `['train', '/train']`:

```ts
  ['train-heti', '/train/week'],
```

- [ ] **Step 2: Regenerate the darwin goldens for the moved screens only**

Run: `pnpm test:visual:update -g "train$"` then `pnpm test:visual:update -g "train-heti"`
Then: `git status --short tests/visual/` — expect exactly `train-light-darwin.png`, `train-dark-darwin.png` modified and `train-heti-{light,dark}-darwin.png` added. If any other screen moved, revert that file (`git checkout -- <path>`) and investigate.

- [ ] **Step 3: Verify the whole visual suite**

Run: `pnpm test:visual`
Expected: all screens pass (36 after the addition).

- [ ] **Step 4: Update `docs/features/train.md`**

Rewrite the `Mai` composition paragraph (§"`Mai` — the weekly cross-domain agenda") to describe: page head (selection-aware, `← Ma`), `DayStrip`, the shown day's cards in time order, the today-only blocks, the rest-day/no-training branches — and that the weekly list + load tiles now live on `Heti`. Add a `### Heti — /train/week` subsection describing `TrainWeekPage` and the `/train?day={index}` drill-in. Update the session-card anatomy paragraph for K3 (icon shield, `DoneBar`, the four state labels, five tones). Update the file map (§10-ish list) with `DayStrip`, `DoneBar`, `TodaySessionCard`, `TrainWeekPage`, `TrainWeekSkeleton`, `weekAgenda.ts`, `dayStripItems.ts`, `sessionState.ts`. Add a gotcha: **retroactive logging is client-date-only** — the sheets send the selected day's ISO date; the server still stamps ownership/XP as usual.

- [ ] **Step 5: Update `docs/features/_platform-design-system.md`**

In the Napiv Train CSS-family paragraph, add: the `--tag-cross`/`--wash-cross` and `--tag-trx`/`--wash-trx` pairs (light + dark), `.typetag-cross|-trx`, `.stag-cross|-trx`, the `.daystrip`/`.daychip` (+ `.dot-*`) family, `.todaycard-icon`/`.todaycard-head`, and `.donebar` (+ `-check`/`-txt`/`-detail`). Bump both docs' `updated:` front-matter to `2026-07-28`.

- [ ] **Step 6: Run the doc linter**

Run (from the repo root): `node scripts/lint-docs.mjs --errors-only`
Expected: PASS (0 errors).

- [ ] **Step 7: Commit**

```bash
git add tests/visual/visual.spec.ts tests/visual/visual.spec.ts-snapshots ../docs/features/train.md ../docs/features/_platform-design-system.md
git commit --no-verify -m "test(visual): Heti golden + regenerate train darwin baselines; docs (mezo-9bbc)"
```

---

### Task 11: Full gate, ship

**Files:** none (process only).

- [ ] **Step 1: Run the complete local gate**

Run, from `frontend/`:
```bash
pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test && pnpm test:visual
```
Expected: all green. (If a single unrelated test times out under load — e.g. `dualMode.guard.test.ts` at its 5 s limit — re-run that file alone to confirm it is a load artefact, not a regression.)

- [ ] **Step 2: Close the bd issue and export**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/.claude/worktrees/parallel-session-3
bd close mezo-9bbc --reason "Mai one-day page with DayStrip + K3 cards + Heti page shipped"
bd export -o .beads/issues.jsonl
git add .beads/issues.jsonl && git commit --no-verify -m "chore(bd): close mezo-9bbc"
```

- [ ] **Step 3: Push and open the self-PR (the CI gate)**

```bash
git push -u origin feat/train-mai-day-nav
gh pr create --title "Train Mai: day-strip navigation + K3 session cards + Heti page (mezo-9bbc)" --body "<summary of the change, the measured before/after viewport count, and the verification list>"
```

- [ ] **Step 4: Regenerate the linux visual baselines**

```bash
gh workflow run update-visual-baselines.yml -r feat/train-mai-day-nav
gh run watch <run-id> --exit-status
git pull --ff-only          # take the bot's baseline commit
```
The bot commit is pushed with `GITHUB_TOKEN`, so its CI run sits `action_required` — approve it:
```bash
gh api --method POST repos/mrkuhne/mezo/actions/runs/<ci-run-id>/approve
```

- [ ] **Step 5: Wait for CI green, then merge**

```bash
gh run watch <ci-run-id> --exit-status
gh run view <ci-run-id> --json jobs --jq '.jobs[] | "\(.name): \(.conclusion)"'   # all 5 success
git fetch origin
git checkout -b tmp-merge origin/main
git merge --no-ff --no-verify feat/train-mai-day-nav -m "Merge PR #<n>: Train Mai day-strip navigation + K3 cards + Heti page (mezo-9bbc)"
git push origin tmp-merge:main
git checkout feat/train-mai-day-nav && git branch -D tmp-merge
git push origin --delete feat/train-mai-day-nav
```

- [ ] **Step 6: Verify main is green**

```bash
gh run list -b main -L 2 --json workflowName,status,conclusion
```
Expected: `ci` success (and `deploy` running/success — every main push deploys, per ADR 0007).

---

## Notes for the implementer

- **The mock week's "today" is flag-based, not date-based.** `train.ts` marks `Csü` with `today: true`, while running sessions resolve by real date (`todayIdx()`). So in mock mode the strip's `MA` chip is Csü regardless of the actual weekday — expected, and why `orderedToday` merges `todayRuns` only when today is shown.
- **`WeeklyDayRow` is unchanged by this plan** apart from the cross/TRX `.stag` tone (Task 1 gives it the classes; the row already derives `SPORT_TAGS[k]` — switch its `stag-sport` to `stag-${SPORT_TONE[k]}` while you are in Task 6 or 7, whichever touches it first, and update `WeeklyDayRow.test.tsx`'s `.stag-sport` assertion accordingly).
- **Do not add an `index.ts` barrel** for the new components; import deep (`@/features/train/components/DayStrip`).
- **Emoji for cross** is 🤸 in the spec/mockup but `SPORT_EMOJI.cross` is currently `⚡`. Keep the existing `⚡` (changing it is a copy decision outside this plan) — the mockup's 🤸 was illustrative.
