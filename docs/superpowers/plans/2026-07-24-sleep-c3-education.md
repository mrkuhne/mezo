# Sleep Slice C3 (Walker Stat Deck + Escalation Card + Research Ingest) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved C3 spec ([`2026-07-24-sleep-c3-education-design.md`](../specs/2026-07-24-sleep-c3-education-design.md), bd `mezo-hd8k`): the daily-rotating Walker stat card + full-deck sheet on the Sleep page, the gentle data-driven escalation card, and the research-wiki ingestion of both source videos.

**Architecture:** FE-only app work — two pure logic modules (`sleepEducation` content+rotation, `sleepEscalation` trigger+snooze) feed three presentational units (stat card, escalation card, one shared sheet) mounted on `SleepPage` with an either/or priority. The docs pillar ingests two video sources into `docs/research/` per the wiki SCHEMA (raw extraction-notes + entity/concept pages).

**Tech Stack:** React 19 + TS, vitest + @testing-library/react, plain CSS in `prototype.css`; markdown wiki per `docs/research/SCHEMA.md`.

## Global Constraints

- **Worktree commits MUST bypass the bd hook:** `git -c core.hooksPath=/dev/null commit …` (never plain `git commit`).
- **All pnpm commands run from `frontend/`**; repo root: `/Users/daniel.kuhne/MrKuhne/mezo/.claude/worktrees/parallel-session-2`.
- **UI copy Hungarian, code/comments English.** Commit subjects end with `(mezo-hd8k)`.
- **FE conventions:** data hooks ONLY from `@/data/hooks`; deep absolute `@/*` imports; tests colocated; no new barrels.
- **NO backend / `api/` / migration changes anywhere.**
- **Exact trigger values (spec D4):** `ESCALATION_WINDOW_DAYS = 14`, `MIN_SAMPLES = 5`, `SHORT_AVG_H = 6.0`, `POOR_AVG_QUALITY = 4`, `SNOOZE_DAYS = 14`, localStorage key `mezo-sleep-escal-snooze`. Semantics: trigger `short` iff `avg(duration) < 6.0` (avg exactly 6.0 does NOT trigger short); else trigger `quality` iff `avg(quality) <= 4` (avg exactly 4.0 DOES trigger). Under 5 samples in the trailing-14-day window: never triggers.
- **Rotation (spec D3):** daily index = `Number(dateIso.replaceAll('-', '')) % STAT_DECK.length` — deterministic, no ticks. `'2026-07-24'` → `20260724 % 7 = 1`; `'2026-07-25'` → `2`.
- **Heavy stats (suicidality, nightmares) appear ONLY in the sheet's escalation section (spec D2)** — never in the rotating deck.
- **CSS appended to the END of `frontend/src/styles/prototype.css`**, Napív aliases (`--ink`/`--sub`/`--faint`/`--warm`/`--line`/`--surface`/`--wash-lav`/`--lav-deep`/`--wash-amber`/`--amber-deep`/`--wash-sage`/`--sage-deep`).
- **Research wiki:** obey `docs/research/SCHEMA.md` — frontmatter §4 (title/type/updated/tags/related/sources/confidence/contradictions), raw provenance headers (`source_url`/`ingested`/`sha256`), `index.md` + `log.md` updates, pages <200 lines, ≥1 outbound link per page. New tag `sleep` must be added to SCHEMA §3 AND logged (≥2 pages use it).
- **Test idiom:** `QueryWrapper` from `@/test/queryWrapper`; `vi.stubEnv('VITE_USE_MOCK', 'true')`; `fireEvent` for clicks in fake-timer tests.

---

### Task 1: `sleepEducation.ts` — the stat deck + daily rotation

**Files:**
- Create: `frontend/src/features/me/logic/sleepEducation.ts`
- Test: `frontend/src/features/me/logic/sleepEducation.test.ts`

**Interfaces:**
- Consumes: nothing (pure).
- Produces (used by Tasks 3, 4): `interface SleepStat { key: string; title: string; text: string; source: string }`, `STAT_DECK: SleepStat[]` (exactly 7), `dailyStatIndex(dateIso: string, deckLength?: number): number`, and the escalation-sheet copy consts `ESCALATION_HEAVY_STATS: string`, `ESCALATION_CBT: string`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/features/me/logic/sleepEducation.test.ts
import { describe, expect, test } from 'vitest'
import { STAT_DECK, dailyStatIndex } from '@/features/me/logic/sleepEducation'

describe('STAT_DECK', () => {
  test('has exactly 7 cards with unique keys and full copy', () => {
    expect(STAT_DECK).toHaveLength(7)
    expect(new Set(STAT_DECK.map((s) => s.key)).size).toBe(7)
    for (const s of STAT_DECK) {
      expect(s.title.length).toBeGreaterThan(0)
      expect(s.text.length).toBeGreaterThan(0)
      expect(s.source.length).toBeGreaterThan(0)
    }
  })
  test('the heavy clinical stats are NOT in the rotating deck', () => {
    const all = STAT_DECK.map((s) => s.title + s.text).join(' ')
    expect(all).not.toMatch(/öngyilkos/i)
    expect(all).not.toMatch(/rémálm/i)
  })
})

describe('dailyStatIndex', () => {
  test('is deterministic per date and changes across days', () => {
    expect(dailyStatIndex('2026-07-24')).toBe(1) // 20260724 % 7
    expect(dailyStatIndex('2026-07-25')).toBe(2)
    expect(dailyStatIndex('2026-07-24')).toBe(dailyStatIndex('2026-07-24'))
  })
  test('wraps with the modulus', () => {
    expect(dailyStatIndex('2026-07-24', 3)).toBe(20260724 % 3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/me/logic/sleepEducation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// frontend/src/features/me/logic/sleepEducation.ts
/** The Walker education deck (slice C3, spec D2/D3 + §3 exact copy). The heavy clinical
 *  stats deliberately live in the escalation-sheet consts below, NEVER in the rotating deck.
 *  Provenance: docs/research/raw/transcripts/ (Walker DOAC interview + Ethier morning routine). */

export interface SleepStat {
  key: string
  title: string
  text: string
  source: string
}

export const STAT_DECK: SleepStat[] = [
  {
    key: 'regularity',
    title: 'A rendszeresség a király',
    text: 'A legrendszeresebben alvóknál −49% össz-halálozás, −57% kardiometabolikus betegség és −39% rák-halálozás — és a rendszeresség a mennyiségnél is erősebb előrejelző.',
    source: 'UK Biobank ~60 000 fő · M. Walker',
  },
  {
    key: 'muscle',
    title: 'Az izmod az alvásodon múlik',
    text: 'Alváshiány mellett fogyókúrázva a leadott súly ~70%-a izom, nem zsír.',
    source: 'Alvásmegvonásos diéta-vizsgálat · M. Walker',
  },
  {
    key: 'hunger',
    title: 'Az éhség a fáradtsággal nő',
    text: 'Kevés alvás mellett ~30–40%-kal éhesebb vagy: a jóllakottság-hormon (leptin) csökken, az éhséghormon (ghrelin) nő.',
    source: 'Leptin/ghrelin vizsgálatok · M. Walker',
  },
  {
    key: 'genes',
    title: 'Egy hét, 711 gén',
    text: 'Egyetlen rövid-alvásos hét 711 gén működését torzítja — a gyulladásosak fel, az immunvédelem le.',
    source: 'Möller-Levet 2013 · M. Walker',
  },
  {
    key: 'glymphatic',
    title: 'Éjszakai nagytakarítás',
    text: 'A mély alvás alatt az agy glymphatikus rendszere kimossa a béta-amiloidot és a taut — ez a napi karbantartás.',
    source: 'M. Walker',
  },
  {
    key: 'remlight',
    title: '+18% REM a tompított estétől',
    text: 'Meleg, 30 lux alatti esti fény mellett +18% REM-alvást mértek — ezt segíti az esti tompítás.',
    source: 'M. Walker',
  },
  {
    key: 'band',
    title: '7–9 óra: sáv, nem szabály',
    text: 'Nem mindenkinek jár 8 óra — az igény 7–9 óra között szór. A sávodon belül a rendszeresség számít igazán.',
    source: 'M. Walker',
  },
]

/** Deterministic daily pick — YYYYMMDD as a number, mod deck length. No ticks, no flicker. */
export function dailyStatIndex(dateIso: string, deckLength: number = STAT_DECK.length): number {
  return Number(dateIso.replaceAll('-', '')) % deckLength
}

/** Escalation-sheet copy (spec §3 tail) — shown ONLY in the sheet's escalation section. */
export const ESCALATION_HEAVY_STATS =
  'Tartósan 6 óra alatti alvás mellett a kutatások 100–150%-kal magasabb öngyilkossági rizikót mértek; a gyakori, nyomasztó rémálmok önálló figyelmeztető jelek — a szervezet vészjelzései, nem jellemhibák.'
export const ESCALATION_CBT =
  'Van bizonyítottan működő, gyógyszermentes segítség: a CBT-I (kognitív viselkedésterápia inszomniára) az elsővonalbeli terápia. Beszélj háziorvossal vagy alvás-szakemberrel.'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/me/logic/sleepEducation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/me/logic/sleepEducation.ts src/features/me/logic/sleepEducation.test.ts
git -c core.hooksPath=/dev/null commit -m "feat(me): sleepEducation - Walker stat deck + daily rotation (mezo-hd8k)"
```

---

### Task 2: `sleepEscalation.ts` — trigger + snooze

**Files:**
- Create: `frontend/src/features/me/logic/sleepEscalation.ts`
- Test: `frontend/src/features/me/logic/sleepEscalation.test.ts`

**Interfaces:**
- Consumes: `SleepEntry` from `@/data/types` (fields used: `date: string`, `duration: number`, `quality: number`); `localDateString` from `@/shared/lib/dates`.
- Produces (used by Task 4): the consts from Global Constraints, `type EscalationReason = 'short' | 'quality'`, `interface EscalationResult { triggered: boolean; reason: EscalationReason | null }`, `evaluateEscalation(log: SleepEntry[], todayIso: string): EscalationResult`, `isSnoozed(todayIso: string): boolean`, `snooze(todayIso: string): void`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/features/me/logic/sleepEscalation.test.ts
import { beforeEach, describe, expect, test } from 'vitest'
import type { SleepEntry } from '@/data/types'
import {
  evaluateEscalation, isSnoozed, snooze, MIN_SAMPLES, SNOOZE_KEY,
} from '@/features/me/logic/sleepEscalation'

const TODAY = '2026-07-24'
const entry = (date: string, duration: number, quality = 7): SleepEntry => ({
  date, bedtime: '23:00', wakeup: '06:30', duration, quality,
  awakenings: 1, mealToSleep: 0, notes: null,
})
/** n recent nights ending yesterday, all inside the 14-day window. */
const recent = (n: number, duration: number, quality = 7): SleepEntry[] =>
  Array.from({ length: n }, (_, i) => entry(`2026-07-${String(23 - i).padStart(2, '0')}`, duration, quality))

describe('evaluateEscalation', () => {
  test('never triggers under MIN_SAMPLES', () => {
    expect(evaluateEscalation(recent(MIN_SAMPLES - 1, 4.0, 2), TODAY)).toEqual({ triggered: false, reason: null })
  })
  test('short: avg below 6.0 triggers, exactly 6.0 does not', () => {
    expect(evaluateEscalation(recent(5, 5.9), TODAY)).toEqual({ triggered: true, reason: 'short' })
    expect(evaluateEscalation(recent(5, 6.0), TODAY).reason).not.toBe('short')
  })
  test('quality: avg exactly 4 triggers, 4.2 does not', () => {
    expect(evaluateEscalation(recent(5, 7.5, 4), TODAY)).toEqual({ triggered: true, reason: 'quality' })
    expect(evaluateEscalation(recent(5, 7.5, 4.2), TODAY)).toEqual({ triggered: false, reason: null })
  })
  test('short takes precedence over quality', () => {
    expect(evaluateEscalation(recent(5, 5.0, 3), TODAY).reason).toBe('short')
  })
  test('entries outside the trailing 14 days are ignored', () => {
    const old = Array.from({ length: 5 }, (_, i) => entry(`2026-06-${String(20 - i).padStart(2, '0')}`, 4.0, 2))
    expect(evaluateEscalation(old, TODAY)).toEqual({ triggered: false, reason: null })
  })
  test('empty log: no trigger', () => {
    expect(evaluateEscalation([], TODAY)).toEqual({ triggered: false, reason: null })
  })
})

describe('snooze', () => {
  beforeEach(() => localStorage.clear())

  test('round-trip: snooze mutes for 14 days, expires after', () => {
    expect(isSnoozed(TODAY)).toBe(false)
    snooze(TODAY)
    expect(isSnoozed(TODAY)).toBe(true)
    expect(isSnoozed('2026-08-06')).toBe(true)  // day 13
    expect(isSnoozed('2026-08-07')).toBe(false) // day 14 — expired
  })
  test('corrupt stored value reads as not snoozed', () => {
    localStorage.setItem(SNOOZE_KEY, 'garbage')
    expect(isSnoozed(TODAY)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/me/logic/sleepEscalation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// frontend/src/features/me/logic/sleepEscalation.ts
import type { SleepEntry } from '@/data/types'
import { localDateString } from '@/shared/lib/dates'

/** Escalation trigger (slice C3, spec D4): trailing-14-day averages over the sleep log,
 *  never under 5 samples. 'short' (avg duration < 6.0h) outranks 'quality' (avg <= 4/10).
 *  The snooze is a localStorage ISO date (muted until, exclusive) — the nightTrace idiom. */

export const ESCALATION_WINDOW_DAYS = 14
export const MIN_SAMPLES = 5
export const SHORT_AVG_H = 6.0
export const POOR_AVG_QUALITY = 4
export const SNOOZE_DAYS = 14
export const SNOOZE_KEY = 'mezo-sleep-escal-snooze'

export type EscalationReason = 'short' | 'quality'
export interface EscalationResult { triggered: boolean; reason: EscalationReason | null }

const addDaysIso = (iso: string, delta: number): string => {
  const d = new Date(`${iso}T12:00:00`) // noon avoids DST edge shifting the date
  d.setDate(d.getDate() + delta)
  return localDateString(d)
}

export function evaluateEscalation(log: SleepEntry[], todayIso: string): EscalationResult {
  const windowStart = addDaysIso(todayIso, -ESCALATION_WINDOW_DAYS)
  const inWindow = log.filter((e) => e.date > windowStart && e.date <= todayIso)
  if (inWindow.length < MIN_SAMPLES) return { triggered: false, reason: null }
  const avg = (f: (e: SleepEntry) => number) =>
    inWindow.reduce((s, e) => s + f(e), 0) / inWindow.length
  if (avg((e) => e.duration) < SHORT_AVG_H) return { triggered: true, reason: 'short' }
  if (avg((e) => e.quality) <= POOR_AVG_QUALITY) return { triggered: true, reason: 'quality' }
  return { triggered: false, reason: null }
}

export function isSnoozed(todayIso: string): boolean {
  try {
    const until = localStorage.getItem(SNOOZE_KEY)
    if (!until || !/^\d{4}-\d{2}-\d{2}$/.test(until)) return false
    return todayIso < until
  } catch {
    return false
  }
}

export function snooze(todayIso: string): void {
  try {
    localStorage.setItem(SNOOZE_KEY, addDaysIso(todayIso, SNOOZE_DAYS))
  } catch { /* storage unavailable — best effort */ }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/me/logic/sleepEscalation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/me/logic/sleepEscalation.ts src/features/me/logic/sleepEscalation.test.ts
git -c core.hooksPath=/dev/null commit -m "feat(me): sleepEscalation - trailing-14d trigger + 14-day snooze (mezo-hd8k)"
```

---

### Task 3: `SleepStatCard` + `SleepStatsSheet` + CSS

**Files:**
- Create: `frontend/src/features/me/components/SleepStatCard.tsx`
- Create: `frontend/src/features/me/sheets/SleepStatsSheet.tsx`
- Test: `frontend/src/features/me/components/SleepStatCard.test.tsx`
- Test: `frontend/src/features/me/sheets/SleepStatsSheet.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (append the `.sstat*` family)

**Interfaces:**
- Consumes: Task 1 (`STAT_DECK`, `dailyStatIndex`, `ESCALATION_HEAVY_STATS`, `ESCALATION_CBT`); `Sheet` from `@/shared/ui/Sheet` (children-as-function, `onClose`, `labelledBy`); `localDateString` from `@/shared/lib/dates`.
- Produces (used by Task 4): `SleepStatCard({ onOpen }: { onOpen: () => void })`, `SleepStatsSheet({ escalation, onClose }: { escalation: 'short' | 'quality' | null; onClose: () => void })`.

- [ ] **Step 1: Write the failing tests**

```tsx
// frontend/src/features/me/components/SleepStatCard.test.tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { SleepStatCard } from '@/features/me/components/SleepStatCard'
import { STAT_DECK, dailyStatIndex } from '@/features/me/logic/sleepEducation'

describe('SleepStatCard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-07-24T10:00:00'))
  })
  afterEach(() => vi.useRealTimers())

  test("renders today's deterministic stat with source label", () => {
    render(<SleepStatCard onOpen={() => {}} />)
    const stat = STAT_DECK[dailyStatIndex('2026-07-24')]
    expect(screen.getByText(stat.title)).toBeInTheDocument()
    expect(screen.getByText(stat.text)).toBeInTheDocument()
    expect(screen.getByText(stat.source)).toBeInTheDocument()
    expect(screen.getByText('Miért számít?')).toBeInTheDocument()
  })
  test('tapping the card calls onOpen', () => {
    const onOpen = vi.fn()
    render(<SleepStatCard onOpen={onOpen} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalled()
  })
})
```

```tsx
// frontend/src/features/me/sheets/SleepStatsSheet.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { SleepStatsSheet } from '@/features/me/sheets/SleepStatsSheet'
import { STAT_DECK } from '@/features/me/logic/sleepEducation'

describe('SleepStatsSheet', () => {
  test('renders every deck card with title and source', () => {
    render(<SleepStatsSheet escalation={null} onClose={() => {}} />)
    for (const s of STAT_DECK) {
      expect(screen.getByText(s.title)).toBeInTheDocument()
      expect(screen.getByText(s.source)).toBeInTheDocument()
    }
    expect(screen.queryByText(/öngyilkossági/)).toBeNull() // heavy stats only with escalation
  })
  test('escalation section renders the heavy stats + CBT-I copy when triggered', () => {
    render(<SleepStatsSheet escalation="short" onClose={() => {}} />)
    expect(screen.getByText(/öngyilkossági rizikót/)).toBeInTheDocument()
    expect(screen.getByText(/CBT-I/)).toBeInTheDocument()
    expect(screen.getByText(/tartósan kevés az alvásod/i)).toBeInTheDocument()
  })
  test('quality reason gets the quality lead-in', () => {
    render(<SleepStatsSheet escalation="quality" onClose={() => {}} />)
    expect(screen.getByText(/tartósan rossz minőségű az alvásod/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/features/me/components/SleepStatCard.test.tsx src/features/me/sheets/SleepStatsSheet.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the components**

```tsx
// frontend/src/features/me/components/SleepStatCard.tsx
import { STAT_DECK, dailyStatIndex } from '@/features/me/logic/sleepEducation'
import { localDateString } from '@/shared/lib/dates'

/** The daily-rotating Walker education card (slice C3, spec D3) — one stat per day,
 *  deterministic by date. The whole card taps through to the full deck sheet. */
export function SleepStatCard({ onOpen }: { onOpen: () => void }) {
  const stat = STAT_DECK[dailyStatIndex(localDateString())]
  return (
    <button className="sstat" onClick={onOpen}>
      <span className="sstat-eye">Miért számít?</span>
      <span className="sstat-title">{stat.title}</span>
      <span className="sstat-text">{stat.text}</span>
      <span className="sstat-src">{stat.source}</span>
    </button>
  )
}
```

```tsx
// frontend/src/features/me/sheets/SleepStatsSheet.tsx
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import {
  ESCALATION_CBT, ESCALATION_HEAVY_STATS, STAT_DECK,
} from '@/features/me/logic/sleepEducation'

/** The full Walker deck (slice C3, spec D3) + the escalation section (spec D4) when the
 *  trigger fired — the ONLY place the heavy clinical stats render. */
export function SleepStatsSheet({
  escalation,
  onClose,
}: {
  escalation: 'short' | 'quality' | null
  onClose: () => void
}) {
  return (
    <Sheet onClose={onClose} labelledBy="sleep-stats-title">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div className="col">
              <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>Miért számít az alvás?</span>
              <div id="sleep-stats-title" className="h-display size-md" style={{ marginTop: 4 }}>A kutatás számai</div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}><Icon name="x" size={12} /></button>
          </div>

          {escalation && (
            <section className="sesc-sheet" aria-label="Az alvásod jelez">
              <span className="sstat-eye" style={{ color: 'var(--amber-deep)' }}>Az alvásod jelez</span>
              <p className="sesc-lead">
                {escalation === 'short'
                  ? 'Az elmúlt két hétben tartósan kevés az alvásod.'
                  : 'Az elmúlt két hétben tartósan rossz minőségű az alvásod.'}
                {' '}Ez nem akaraterő kérdése.
              </p>
              <p className="sesc-body">{ESCALATION_HEAVY_STATS}</p>
              <p className="sesc-body"><b>{ESCALATION_CBT}</b></p>
            </section>
          )}

          <div className="col gap-sm">
            {STAT_DECK.map((s) => (
              <div key={s.key} className="sstat-row">
                <span className="sstat-title">{s.title}</span>
                <span className="sstat-text">{s.text}</span>
                <span className="sstat-src">{s.source}</span>
              </div>
            ))}
          </div>

          <p className="sstat-foot">
            Források: Matthew Walker (Diary of a CEO interjú) és Jeremy Ethier — feldolgozva a
            projekt research-wikijében (docs/research).
          </p>
        </div>
      )}
    </Sheet>
  )
}
```

- [ ] **Step 4: Append the `.sstat*` / `.sesc-sheet` CSS to `frontend/src/styles/prototype.css`**

```css
/* ===== Sleep education (slice C3, mezo-hd8k): daily stat card + deck sheet ===== */
.sstat { display: flex; flex-direction: column; gap: 6px; width: 100%; text-align: left;
         margin-top: 8px; padding: 16px; border-radius: 20px;
         background: linear-gradient(150deg, var(--wash-lav) 0%, var(--surface) 72%);
         box-shadow: 0 1px 3px rgba(43,33,24,.06); }
.sstat-eye { font: 700 10px/1 var(--ff-body); letter-spacing: .1em; color: var(--lav-deep); text-transform: uppercase; }
.sstat-title { font: 600 15.5px/1.3 var(--ff-display); color: var(--ink); }
.sstat-text { font: 500 12.5px/1.6 var(--ff-body); color: var(--sub); }
.sstat-src { font: 600 10px/1.4 var(--ff-body); color: var(--faint); }
.sstat-row { display: flex; flex-direction: column; gap: 5px; padding: 13px 14px;
             background: var(--surface); border: 1px solid var(--line); border-radius: 16px; }
.sstat-foot { font: 500 10.5px/1.6 var(--ff-body); color: var(--faint); margin-top: 12px; }
.sesc-sheet { display: flex; flex-direction: column; gap: 8px; padding: 14px;
              border-radius: 16px; background: var(--wash-amber); margin-bottom: 14px; }
.sesc-lead { font: 600 13.5px/1.5 var(--ff-body); color: var(--ink); }
.sesc-body { font: 500 12px/1.65 var(--ff-body); color: var(--sub); }
.sesc-body b { color: var(--ink); }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/features/me/components/SleepStatCard.test.tsx src/features/me/sheets/SleepStatsSheet.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/me/components/SleepStatCard.tsx src/features/me/components/SleepStatCard.test.tsx src/features/me/sheets/SleepStatsSheet.tsx src/features/me/sheets/SleepStatsSheet.test.tsx src/styles/prototype.css
git -c core.hooksPath=/dev/null commit -m "feat(me): SleepStatCard + SleepStatsSheet - daily Walker stat + full deck (mezo-hd8k)"
```

---

### Task 4: `SleepEscalationCard` + SleepPage integration

**Files:**
- Create: `frontend/src/features/me/components/SleepEscalationCard.tsx`
- Test: `frontend/src/features/me/components/SleepEscalationCard.test.tsx`
- Modify: `frontend/src/features/me/pages/SleepPage.tsx` (mount after the rings row, inside the same `padding: '0 24px 16px'` wrapper)
- Modify: `frontend/src/features/me/pages/SleepPage.test.tsx` (add integration tests)
- Modify: `frontend/src/styles/prototype.css` (append the `.sesc*` card family)

**Interfaces:**
- Consumes: Tasks 1–3 (`SleepStatCard`, `SleepStatsSheet`, `evaluateEscalation`, `isSnoozed`, `snooze`, `EscalationReason`); `useSleep` from `@/data/hooks`; `localDateString`.
- Produces: `SleepEscalationCard({ reason, onDetails, onSnooze }: { reason: 'short' | 'quality' | null; onDetails: () => void; onSnooze: () => void })`.

- [ ] **Step 1: Write the failing tests**

```tsx
// frontend/src/features/me/components/SleepEscalationCard.test.tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { SleepEscalationCard } from '@/features/me/components/SleepEscalationCard'

describe('SleepEscalationCard', () => {
  test('short reason renders the short lead and both actions', () => {
    const onDetails = vi.fn(); const onSnooze = vi.fn()
    render(<SleepEscalationCard reason="short" onDetails={onDetails} onSnooze={onSnooze} />)
    expect(screen.getByText(/tartósan kevés az alvásod/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Részletek' }))
    expect(onDetails).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Most nem' }))
    expect(onSnooze).toHaveBeenCalled()
  })
  test('quality reason renders the quality lead', () => {
    render(<SleepEscalationCard reason="quality" onDetails={() => {}} onSnooze={() => {}} />)
    expect(screen.getByText(/tartósan rossz minőségű az alvásod/i)).toBeInTheDocument()
  })
  test('no heavy stats on the card itself (sheet-only)', () => {
    render(<SleepEscalationCard reason="short" onDetails={() => {}} onSnooze={() => {}} />)
    expect(screen.queryByText(/öngyilkos/)).toBeNull()
  })
})
```

Add to `frontend/src/features/me/pages/SleepPage.test.tsx` (keep the file's existing render helper — it already wraps `QueryWrapper` + `MemoryRouter`; mock the escalation module at the top of the file, after the existing imports):

```tsx
vi.mock('@/features/me/logic/sleepEscalation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/me/logic/sleepEscalation')>()),
  evaluateEscalation: vi.fn(() => ({ triggered: false, reason: null })),
}))
import { evaluateEscalation, SNOOZE_KEY } from '@/features/me/logic/sleepEscalation'
```

and the tests (inside the existing describe; `beforeEach` must also `localStorage.clear()`):

```tsx
  test('renders the daily stat card when no escalation', () => {
    renderPage()
    expect(screen.getByText('Miért számít?')).toBeInTheDocument()
  })

  test('escalation replaces the stat card and Most nem snoozes it away', () => {
    vi.mocked(evaluateEscalation).mockReturnValue({ triggered: true, reason: 'short' })
    renderPage()
    expect(screen.getByText(/tartósan kevés/i)).toBeInTheDocument()
    expect(screen.queryByText('Miért számít?')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Most nem' }))
    expect(screen.getByText('Miért számít?')).toBeInTheDocument()
    expect(localStorage.getItem(SNOOZE_KEY)).not.toBeNull()
    vi.mocked(evaluateEscalation).mockReturnValue({ triggered: false, reason: null })
  })

  test('stat card opens the deck sheet', () => {
    renderPage()
    fireEvent.click(screen.getByText('Miért számít?'))
    expect(screen.getByText('A kutatás számai')).toBeInTheDocument()
  })
```

(Reset the `evaluateEscalation` mock to the not-triggered default in the file's `beforeEach` so test order can't leak.)

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `pnpm vitest run src/features/me/components/SleepEscalationCard.test.tsx src/features/me/pages/SleepPage.test.tsx`
Expected: new tests FAIL; the file's pre-existing tests stay green.

- [ ] **Step 3: Write the card + integrate**

```tsx
// frontend/src/features/me/components/SleepEscalationCard.tsx
/** The gentle escalation card (slice C3, spec D4) — renders INSTEAD of SleepStatCard while
 *  the trigger holds and isn't snoozed. No red, no guilt framing (ADR 0010); the heavy
 *  clinical stats live in the sheet's escalation section, never here. */
export function SleepEscalationCard({
  reason,
  onDetails,
  onSnooze,
}: {
  reason: 'short' | 'quality' | null
  onDetails: () => void
  onSnooze: () => void
}) {
  return (
    <section className="sesc" aria-label="Az alvásod jelez">
      <span className="sstat-eye" style={{ color: 'var(--amber-deep)' }}>Az alvásod jelez</span>
      <p className="sesc-lead">
        {reason === 'quality'
          ? 'Az elmúlt két hétben tartósan rossz minőségű az alvásod.'
          : 'Az elmúlt két hétben tartósan kevés az alvásod.'}
      </p>
      <p className="sesc-body">
        Ez nem akaraterő kérdése — és van rá bizonyított, gyógyszermentes segítség.
      </p>
      <div className="sesc-actions">
        <button className="sesc-cta" onClick={onDetails}>Részletek</button>
        <button className="sesc-quiet" onClick={onSnooze}>Most nem</button>
      </div>
    </section>
  )
}
```

`SleepPage.tsx` changes — add imports:

```tsx
import { SleepStatCard } from '@/features/me/components/SleepStatCard'
import { SleepEscalationCard } from '@/features/me/components/SleepEscalationCard'
import { SleepStatsSheet } from '@/features/me/sheets/SleepStatsSheet'
import { evaluateEscalation, isSnoozed, snooze } from '@/features/me/logic/sleepEscalation'
import { localDateString } from '@/shared/lib/dates'
```

add state + derivation next to the existing `useState`s:

```tsx
  const [statsOpen, setStatsOpen] = useState(false)
  const [snoozed, setSnoozed] = useState(() => isSnoozed(localDateString()))
  const escalation = evaluateEscalation(sleepLog, localDateString())
  const showEscalation = escalation.triggered && !snoozed
```

insert directly AFTER the rings row's closing `</div>` (the `row gap-sm` holding the two ScoreRing sections), still inside the `padding: '0 24px 16px'` wrapper:

```tsx
        {showEscalation ? (
          <SleepEscalationCard
            reason={escalation.reason}
            onDetails={() => setStatsOpen(true)}
            onSnooze={() => { snooze(localDateString()); setSnoozed(true) }}
          />
        ) : (
          <SleepStatCard onOpen={() => setStatsOpen(true)} />
        )}
```

and mount the sheet next to the existing sheet mounts at the bottom of the JSX:

```tsx
      {statsOpen && (
        <SleepStatsSheet
          escalation={showEscalation ? escalation.reason : null}
          onClose={() => setStatsOpen(false)}
        />
      )}
```

Append the `.sesc*` card CSS to `frontend/src/styles/prototype.css`:

```css
.sesc { display: flex; flex-direction: column; gap: 7px; margin-top: 8px; padding: 16px;
        border-radius: 20px; background: linear-gradient(150deg, var(--wash-amber) 0%, var(--surface) 75%);
        box-shadow: 0 1px 3px rgba(43,33,24,.06); }
.sesc-actions { display: flex; gap: 10px; align-items: center; margin-top: 4px; }
.sesc-cta { background: var(--amber-deep); color: var(--text-inverse); font: 700 12px/1 var(--ff-body);
            padding: 10px 16px; border-radius: 999px; }
.sesc-quiet { font: 600 11.5px/1 var(--ff-body); color: var(--faint); padding: 10px 8px; }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/features/me/components/SleepEscalationCard.test.tsx src/features/me/pages/SleepPage.test.tsx && VITE_USE_MOCK=true pnpm vitest run src/features/me`
Expected: PASS (new + pre-existing, mock-mode domain sweep green).

- [ ] **Step 5: Commit**

```bash
git add src/features/me/components/SleepEscalationCard.tsx src/features/me/components/SleepEscalationCard.test.tsx src/features/me/pages/SleepPage.tsx src/features/me/pages/SleepPage.test.tsx src/styles/prototype.css
git -c core.hooksPath=/dev/null commit -m "feat(me): SleepEscalationCard + SleepPage education mount with priority + snooze (mezo-hd8k)"
```

---

### Task 5: Research ingest — Walker + Ethier into `docs/research/`

**Files (all under the repo root, NOT `frontend/`):**
- Create: `docs/research/raw/transcripts/2026-07-23-walker-doac-sleep-interview.md`
- Create: `docs/research/raw/transcripts/2026-07-23-ethier-morning-routine.md`
- Create: `docs/research/entities/matthew-walker.md`, `docs/research/entities/jeremy-ethier.md`
- Create: `docs/research/concepts/sleep-regularity.md`, `docs/research/concepts/qqrt.md`, `docs/research/concepts/sleep-debunks.md`, `docs/research/concepts/morning-routine.md`
- Modify: `docs/research/SCHEMA.md` (§3: add `sleep` to the taxonomy list), `docs/research/index.md` (add the 6 pages), `docs/research/log.md` (append the INGEST entry)

**Interfaces:** none for code; the FE cards' provenance (Task 3's sheet footer) references this wiki.

**Read FIRST:** `docs/research/SCHEMA.md` (all of it) and `docs/superpowers/specs/2026-07-23-sleep-routine-cluster-notes.md` §1 + §4 — the §4 extraction IS the source material for the raw notes.

- [ ] **Step 1: Write the two raw extraction-notes files**

Content basis: cluster-notes §4 (Walker) and §1's Ethier line + the habit-engine catalog (the 6 recs). Each raw file structure:
1. A provenance YAML block at the very top: `source_url` (Walker: `https://www.youtube.com/watch?v=qxxnRMT9C-8`; Ethier: `https://www.youtube.com/watch?v=eifEiCYH2yc`), `ingested: 2026-07-24`, `sha256: <computed in Step 2>` (write `sha256: PENDING` first).
2. An **honesty preamble**: "Extraction notes captured from viewing (2026-07-23), NOT a verbatim transcript. The raw layer for the sleep/routine cluster pages."
3. The full extraction, restructured with headings — for Walker: QQRT framework; regularity stats (UK Biobank −49/−57/−39, regularity beats quantity); practical protocol (T-90 dim <30 lux +18% REM, 18 °C, 20-minute rule, don't-check-the-clock, calm toolkit incl. Alison Harvey 4K walk, sleep banking ~40% Walter Reed/Balkin); motivation stats (muscle 70%, 711 genes, hunger 30-40% leptin/ghrelin, glymphatic, <6h suicidality 100–150%, nightmares 800% biomarker); DEBUNKS (90-min smart wake, 8-hours-for-everyone, blue light, magnesium, melatonin dosing 0.1–3 mg jet-lag-only, counting sheep, Ambien/Z-drugs glymphatic −30–40%); endorsed narrow (ashwagandha+PS tired-but-wired, DORAs + CBT-I as clinical); what he does NOT cover (no caffeine numbers, no morning light, no naps). For Ethier: the six recommendations (circadian-aligned wake, morning sunlight, morning weigh-in, caffeine timing/cutoff, morning training, protein-rich breakfast) with one line each on the claimed rationale.
4. NEVER edit these files after Step 2's hash is recorded.

- [ ] **Step 2: Compute and record the SHA256 of each raw body**

From the repo root, for each raw file: `sed '1,/^---$/d' <file> | shasum -a 256` — take the hex, replace `sha256: PENDING` with it. (The hash covers the body below the provenance block, so recording the hash doesn't change what it hashes.)

- [ ] **Step 3: Write the six wiki pages**

Every page: frontmatter per SCHEMA §4 (`title`, `type`, `updated: 2026-07-24`, `tags`, `related` ≥1, `sources` pointing at the raw file(s), `confidence`, `contradictions: []`), <200 lines, ≥1 outbound markdown link, overwrite-in-place discipline (no changelogs). Exact assignments:

| Page | type | tags | sources | confidence | must contain |
|---|---|---|---|---|---|
| `entities/matthew-walker.md` | entity | `[sleep]` | walker raw | medium | who he is (*Why We Sleep*, UC Berkeley), the DOAC interview as our captured source, links to the three concept pages + the two feature docs (`../../features/me.md`, `../../features/habit.md`) |
| `entities/jeremy-ethier.md` | entity | `[sleep, technique]` | ethier raw | medium | who he is (kinesiology-based fitness educator), the morning-routine video, link to `concepts/morning-routine.md` + `../../features/habit.md` |
| `concepts/sleep-regularity.md` | concept | `[sleep]` | walker raw | medium | the UK Biobank numbers (−49/−57/−39, ~60k), "regularity beats quantity", the ±15 min band our app uses, how mezo consumes it (sleep goal regularity score — link `../../features/me.md`) |
| `concepts/qqrt.md` | concept | `[sleep]` | walker raw | medium | the four legs (Quantity 7–9h band · Quality efficiency ≥85% · Regularity · Timing), the "3 things to start tonight" (detox, regularity, light), mapping to mezo surfaces (goal card, rings, WindDownBanner) |
| `concepts/sleep-debunks.md` | concept | `[sleep]` | walker raw | medium | the full DEBUNK list with the *why* per item (90-min smart-wake cycle-range 70–120; 8h-for-everyone; blue-light engagement-not-wavelength; magnesium blood-brain barrier; melatonin 0.1–3 mg signal-not-generator jet-lag-only; counting sheep; Z-drugs glymphatic cut) + the note that mezo deliberately builds NO features on these (spec links) |
| `concepts/morning-routine.md` | concept | `[sleep, technique]` | ethier raw | medium | the six recs and which mezo habit each became (`morning_sunlight`, weigh-in, caffeine cutoff, training, protein breakfast — link `../../features/habit.md`), plus what Walker does NOT cover (caffeine numbers, morning light) so the two sources' division of labor is explicit |

- [ ] **Step 4: Register the pages**

- `SCHEMA.md` §3: add `sleep` to the seed-set line (it now has ≥2 pages).
- `index.md`: add the two entities and four concepts under their sections with one-line hooks.
- `log.md`: append `- 2026-07-24 · INGEST · Walker DOAC interview + Ethier morning-routine video (extraction notes → raw/transcripts) distilled into 2 entities + 4 concepts; tag 'sleep' added to taxonomy. Consumed by slice C3 stat deck (mezo-hd8k).`

- [ ] **Step 5: Lint**

Run (repo root): `node scripts/lint-docs.mjs`
Expected: the 8 new/modified research files clean (no orphans/broken links/taxonomy violations); pre-existing stale feature docs are out of scope.

- [ ] **Step 6: Commit**

```bash
git add docs/research
git -c core.hooksPath=/dev/null commit -m "docs(research): ingest Walker DOAC + Ethier morning-routine sources - 2 raw + 6 wiki pages, sleep tag (mezo-hd8k)"
```

---

### Task 6: Living docs + full FE gate

**Files:**
- Modify: `docs/features/me.md` (§2 `Alvás`: the stat/escalation card + sheet; §10 new files)
- Modify: `docs/superpowers/specs/2026-07-23-sleep-routine-cluster-notes.md` (§0: C3 implemented; §4: mark the stat-card + escalation items consumed, DEBUNK cards still reserved; §7: research-ingest DONE)
- Run: `node scripts/lint-docs.mjs` + the full FE gate

**Interfaces:** none — documentation + verification.

- [ ] **Step 1: Update the docs**

- `me.md` §2 `Alvás`: after the NightPage/entry-row prose, add the education layer — daily-rotating `SleepStatCard` (deterministic `dailyStatIndex`, 7-card Walker deck in `logic/sleepEducation.ts`), tap → `SleepStatsSheet` (full deck + sources footer); the escalation card (`logic/sleepEscalation.ts` — trailing-14d, min 5 samples, avg <6.0h / avg ≤4 quality, 14-day snooze `mezo-sleep-escal-snooze`) renders INSTEAD of the stat card and carries the heavy stats ONLY in its sheet section; §10: the five new FE files. Cross-link `docs/research/concepts/sleep-regularity.md`.
- Cluster-notes: §0 flip the C3 entry to "implemented on `feat/sleep-c3` (PR pending)"; §4 note which buildables are now consumed (stat cards ✅ C3, escalation ✅ C3; banking/A-B still reserved; DEBUNK list = content shipped as `sleep-debunks.md` concept page, still NO app features); §7 replace the TODO text with "DONE (mezo-hd8k): both videos ingested — see docs/research/log.md".

- [ ] **Step 2: Lint + full gate**

Run (repo root): `node scripts/lint-docs.mjs` — touched docs clean.
Run (in `frontend/`): `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — ALL green, both modes.

- [ ] **Step 3: Commit**

```bash
git add docs/features/me.md docs/superpowers/specs/2026-07-23-sleep-routine-cluster-notes.md
git -c core.hooksPath=/dev/null commit -m "docs(sleep): living docs for slice C3 - education layer + research-ingest closure (mezo-hd8k)"
```

---

## After the tasks (session-level)

1. Final whole-branch review (fable) → fix wave if needed.
2. Runtime-verify on the mock FE (`verify` skill): daily stat rotation (Date-patch two days), sheet content, escalation via synthetic trigger (temporarily seed a short-sleep log through the sheet or mock the module in-page — simplest: verify the escalation card via the unit/integration tests + verify visually only the stat card + sheet; drive the escalation path by pre-setting `mezo-sleep-escal-snooze` absence + a patched `evaluateEscalation` is NOT possible in-browser, so visual check of the escalation card may use a temporary local edit reverted before push, or be accepted as test-covered).
3. `git push -u origin feat/sleep-c3` → self-PR → CI green → `gh pr merge --merge` → bd close `mezo-hd8k` + notes + `bd dolt push` (main checkoutból).
