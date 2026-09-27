# Minta részletei újramesélve — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the pattern detail page (`/mezo/patterns/:pairKey`) as the owner-approved story "válasz → mit mutat az adat → a szabály", driven by one pure reading function, with a lean meter instead of the day ring and a two-zone chart instead of the trend-line scatter.

**Architecture:** Frontend-only. A new pure module `logic/patternReading.ts` turns `{pair, pattern, days, events}` into a `Reading` (state + current lean + lean-at-confirmation + minN). Four new presentational components render it (`PatternAnswerHero`, `PatternLeanMeter`, `PatternZoneChart`, `PatternRuleCard`); `PatternDetailPage` composes them for BOTH the catalog and the reflection layout (one layout now). The superseded components are deleted. No backend or API contract change: revocation = the existing `decide(reject)` on a confirmed row; the live r for a frozen (confirmed statistical) row is recomputed from the live `days` the endpoint already returns.

**Tech Stack:** React 18 + TypeScript, Vitest + Testing Library + MSW (mock mode), plain SVG, `prototype.css`.

**Visual truth:** `docs/design_2.0/prototypes/uveg-minta.html` (source `src/uveg-minta-body.html`), chart variant **A** (owner OK 2026-09-27). Open it in a browser next to your work; class names there (`.mh`, `.meter`, `.cc`, `.rule`, `.fold`) map to the `pmx-*` classes below.

## Global Constraints

- Owner-facing copy is Hungarian, plain words; never show raw `r`/`p` outside the "Számok, ha érdekel" fold.
- Üveg canon (`docs/design_2.0/2026-09-23-uveg-style-bible.md`): dark only, ONE accent per surface via `--c`, hero is frameless (radial halo, no card), the chart card is the page's one `.glass`, everything else flat; never glass inside glass; Titanium 3D sprite icons via `Icon3D` (never emoji); motion only inside `prefers-reduced-motion: no-preference`.
- "Elvetem"/"Visszavonom" never red: use the mute/slate tone (`--mz-no-ink` family), never `--error-*`.
- The lean band is a 90 % Fisher-z interval: `z = atanh(r)`, `se = 1/sqrt(n-3)`, `k = 1.645`.
- State thresholds: `lo > 0` → erős; `hi < 0` → fordított; `|support| < 0.15` → nincs; else halvány / inkább fordítva by sign.
- Revoking a confirmed pattern = `onDecide('reject')`. Copy must NOT claim the Tudástár entry is deleted (the backend leaves the promoted fact alone — `PatternService.applyConfirm` javadoc).
- Tests: `cd frontend && CI=true VITE_USE_MOCK=true pnpm exec vitest run <file>` for focused runs (a `pnpm test -- <file>` filter is IGNORED and runs all 675 files). Final gate: `pnpm build && CI=true VITE_USE_MOCK=true pnpm test && CI=true VITE_USE_MOCK=false pnpm test`.
- Commit subjects: `feat(insights): … (mezo-rstt7)` + the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Structure

| File | Responsibility |
|---|---|
| Create `frontend/src/features/insights/logic/patternReading.ts` | pure: `pearson`, `lean`, `readPattern`, `answerLook`, `decisionPlan`, `patternZones`, `niceTicks`, `saySentence`, `ruleSentence`, `az` |
| Create `frontend/src/features/insights/logic/patternReading.test.ts` | unit tests for all of the above |
| Create `frontend/src/features/insights/components/PatternLeanMeter.tsx` (+ `.test.tsx`) | the "merre húz" meter + the day pips |
| Create `frontend/src/features/insights/components/PatternZoneChart.tsx` (+ `.test.tsx`) | two zones, zone averages on top, faint ruler, x ticks, tappable dots with tooltip, "Napok listája" fold |
| Create `frontend/src/features/insights/components/PatternAnswerHero.tsx` (+ `.test.tsx`) | pair chips, question, answer word, sentence, quote, meter/pips, decision row |
| Create `frontend/src/features/insights/components/PatternRuleCard.tsx` | the rule sentence + fact chips |
| Modify `frontend/src/features/insights/pages/PatternDetailPage.tsx` | one composition for every row kind |
| Modify `frontend/src/features/insights/components/PatternArtifactDetail.tsx` | re-dress in the `pmx` hero ("Csak megérzés") |
| Modify `frontend/src/features/insights/pages/PatternDetailPage.test.tsx` | rewritten assertions |
| Modify `frontend/src/data/insights/insights.ts` | two extra mock details (few-days reflection, rejected) |
| Delete `HypothesisStateCard(.test).tsx`, `PatternDetailHero(.test).tsx`, `TestPlanTiles(.test).tsx`, `PatternEvidenceChart(.test).tsx`, `PatternStrengthChart.tsx` | superseded |
| Modify `frontend/src/styles/prototype.css` | new block `── uveg minta ujramesele (mezo-rstt7) ──` at the end; dead `pdt-plan*`, `pdt-compare*`, `pdt-story*`, `pdt-core`, `pdt-answer*`, `pdt-belief*`, `pdt-chart*` rules removed only if grep shows no other user |
| Modify `docs/features/insights.md`, regenerate `docs/CODEMAP.md` | docs mandate |

---

### Task 1: The reading logic (`patternReading.ts`)

**Files:**
- Create: `frontend/src/features/insights/logic/patternReading.ts`
- Test: `frontend/src/features/insights/logic/patternReading.test.ts`

**Interfaces:**
- Consumes: `AlignedDay`, `Pattern`, `PatternEvent`, `PatternMonitorPair`, `PatternTestPlan` from `@/data/types`; `binaryGroupLabels`, `formatMetricValue` from `@/features/insights/logic/metricFormat`; `bottleneckLabel`, `groupBalanceSentence` from `@/features/insights/logic/verdicts`; `DetailTone` from `@/features/insights/components/DetailHero`; `Icon3DName` from `@/shared/ui/clay`.
- Produces (exact exports, later tasks rely on them):
  - `type ReadingState = 'kerdes' | 'gyulik' | 'allo' | 'nincs' | 'halvany' | 'halvanyFordit' | 'fordit' | 'eros' | 'elvetve' | 'elengedve' | 'pihen'`
  - `interface Lean { r: number; n: number; support: number; lo: number; hi: number }` (support/lo/hi are in the hypothesis' own direction: +1 = "igaz rád")
  - `interface Reading { state: ReadingState; now: Lean | null; then: Lean | null; minN: number; dayCount: number; dir: 1 | -1 }`
  - `pearson(days: AlignedDay[]): number | null`
  - `lean(r: number, n: number, dir: 1 | -1): Lean`
  - `readPattern(input: { pair: PatternMonitorPair; pattern: Pattern | null; days: AlignedDay[]; events: PatternEvent[] }, catalogMinN: number | null): Reading`
  - `interface AnswerLook { word: string; tone: DetailTone; art: Icon3DName }` and `answerLook(reading: Reading, status: Pattern['status'] | null): AnswerLook`
  - `type DecisionVerb = 'confirm' | 'monitor' | 'reject'`, `interface DecisionPlan { buttons: { verb: DecisionVerb; label: string; recommended: boolean }[]; revokeLink: boolean; note: string | null; settled: string | null }` and `decisionPlan(reading: Reading, status: Pattern['status'] | null): DecisionPlan`
  - `patternZones(days: AlignedDay[], binary: boolean): [AlignedDay[], AlignedDay[]]`
  - `niceTicks(lo: number, hi: number, clock: boolean, count?: number): number[]`
  - `saySentence(reading: Reading, pair: PatternMonitorPair, days: AlignedDay[], status: Pattern['status'] | null): string` (bold spans marked with `**…**`)
  - `ruleSentence(pair: PatternMonitorPair, plan: PatternTestPlan | null): string` (bold spans marked with `**…**`)
  - `az(word: string): 'a' | 'az'`, `mean(days: AlignedDay[]): number`

- [ ] **Step 1: Write the failing tests**

```ts
// frontend/src/features/insights/logic/patternReading.test.ts
import {
  answerLook, decisionPlan, lean, niceTicks, patternZones, pearson, readPattern, ruleSentence, saySentence,
} from '@/features/insights/logic/patternReading'
import type { AlignedDay, Pattern, PatternEvent, PatternMonitorPair } from '@/data/types'

const pair = (over: Partial<PatternMonitorPair> = {}): PatternMonitorPair => ({
  key: 'wakeup-hour~checkin-energy', title: 'Ébredés ideje ↔ energia-szint', category: 'trigger', categoryLabel: 'Kiváltó ok',
  lagDays: 0, metricAKey: 'wakeup-hour', metricALabel: 'ébredés ideje', metricAValueKind: 'clock_hour',
  metricBKey: 'checkin-energy', metricBLabel: 'energia-szint', metricBValueKind: 'number',
  mechanismHu: '', questionHu: 'Több energiád van, ha korábban kelsz?', expectedDirection: 'negative',
  whenPositiveHu: '', whenNegativeHu: '', metricADomain: 'sleep', metricBDomain: 'mind',
  verdict: 'live', alignedDays: 9, missingDays: null, bottleneckMetricKey: null,
  groupZeroDays: null, groupOneDays: null, requiredPerGroup: null, r: -0.312, n: 9, p: 0.41, status: null,
  ...over,
})
const pattern = (over: Partial<Pattern> = {}): Pattern => ({
  id: 'p1', pairKey: 'wakeup-hour~checkin-energy', category: 'trigger', categoryLabel: 'Kiváltó ok',
  title: 't', mechanism: 'm', evidence: [], status: 'proposed', kind: 'statistical',
  evidenceHits: 0, evidenceMisses: 0,
  testPlan: { seriesA: 'wakeup-hour', seriesB: 'checkin-energy', seriesALabel: 'ébredés ideje',
    seriesBLabel: 'energia-szint', lagDays: 0, expectedDirection: 'negative', minN: 8, windowDays: 60 },
  ...over,
})
const days = (pts: [number, number][]): AlignedDay[] =>
  pts.map(([a, b], i) => ({ date: `2026-09-${String(10 + i).padStart(2, '0')}`, a, b }))
const LINE = days([[1, 2], [2, 4], [3, 6], [4, 8], [5, 10], [6, 12], [7, 14], [8, 16], [9, 18]])

describe('pearson', () => {
  test('perfect line is 1, flat side is null, fewer than 3 points is null', () => {
    expect(pearson(LINE)).toBeCloseTo(1, 6)
    expect(pearson(days([[1, 5], [2, 5], [3, 5]]))).toBeNull()
    expect(pearson(days([[1, 2], [2, 3]]))).toBeNull()
  })
})

describe('lean', () => {
  test('90% Fisher band, flipped into the hypothesis direction', () => {
    const l = lean(-0.312, 9, -1)
    expect(l.support).toBeCloseTo(0.312, 3)
    expect(l.lo).toBeCloseTo(-0.335, 2)
    expect(l.hi).toBeCloseTo(0.759, 2)
  })
  test('n <= 3 means the band spans everything', () => {
    expect(lean(0.5, 3, 1)).toMatchObject({ lo: -1, hi: 1 })
  })
})

describe('readPattern', () => {
  const read = (p: Partial<PatternMonitorPair>, pat: Partial<Pattern> | null = {}, d: AlignedDay[] = [], ev: PatternEvent[] = []) =>
    readPattern({ pair: pair(p), pattern: pat == null ? null : pattern(pat), days: d, events: ev }, 8)

  test('live states follow the band', () => {
    expect(read({ r: -0.312, n: 9 }).state).toBe('halvany')
    expect(read({ r: -0.037, n: 9 }, { testPlan: { ...pattern().testPlan!, expectedDirection: 'positive' } }).state).toBe('nincs')
    expect(read({ r: -0.582, n: 9, expectedDirection: 'positive' }, { testPlan: undefined }).state).toBe('halvanyFordit')
    expect(read({ r: -0.334, n: 32, expectedDirection: 'positive' }, { testPlan: undefined }).state).toBe('fordit')
    expect(read({ r: 0.906, n: 12, expectedDirection: 'positive' }, { testPlan: undefined }).state).toBe('eros')
  })
  test('the plan direction wins over the catalog direction', () => {
    expect(read({ r: 0.906, n: 12, expectedDirection: 'positive' }).state).toBe('fordit')
  })
  test('gate verdicts map to the gathering states', () => {
    expect(read({ verdict: 'few_days', alignedDays: 7, missingDays: 1, r: null, n: null }).state).toBe('gyulik')
    expect(read({ verdict: 'imbalanced_groups', r: null, n: null }).state).toBe('gyulik')
    expect(read({ verdict: 'no_data', alignedDays: 0, r: null, n: null }).state).toBe('kerdes')
    expect(read({ verdict: 'degenerate', r: null, n: null }).state).toBe('allo')
  })
  test('row statuses win over the numbers', () => {
    expect(read({}, { status: 'rejected' }).state).toBe('elvetve')
    expect(read({}, { status: 'refuted' }).state).toBe('elengedve')
    expect(read({}, { status: 'dormant' }).state).toBe('pihen')
  })
  test('minN: plan first, then the gate, then the catalog fallback', () => {
    expect(read({}, { testPlan: { ...pattern().testPlan!, minN: 10 } }).minN).toBe(10)
    expect(read({ verdict: 'few_days', alignedDays: 5, missingDays: 3 }, { testPlan: undefined }).minN).toBe(8)
    expect(readPattern({ pair: pair(), pattern: null, days: [], events: [] }, 12).minN).toBe(12)
  })
  test('a frozen confirmed row is re-read live from its days, and the frozen numbers become "then"', () => {
    const r = read({ verdict: 'frozen', status: 'confirmed', r: -0.545, n: 8, expectedDirection: 'positive' },
      { status: 'confirmed', testPlan: undefined }, LINE)
    expect(r.now?.r).toBeCloseTo(1, 6)
    expect(r.state).toBe('eros')
    expect(r.then?.r).toBeCloseTo(-0.545, 3)
    expect(r.dayCount).toBe(9)
  })
  test('a frozen row with too few live days is gathering', () => {
    expect(read({ verdict: 'frozen', status: 'confirmed', r: 0.5, n: 9 }, { status: 'confirmed' },
      LINE.slice(0, 5)).state).toBe('gyulik')
  })
  test('a confirmed reflection row takes "then" from the last numbered event before the confirm', () => {
    const ev: PatternEvent[] = [
      { kind: 'evidence', occurredAt: '2026-09-20T01:40:00Z', r: 0.6, n: 10, verdict: 'LIVE' },
      { kind: 'confirmed', occurredAt: '2026-09-21T09:00:00Z' },
      { kind: 'evidence', occurredAt: '2026-09-22T01:40:00Z', r: 0.2, n: 12, verdict: 'LIVE' },
    ]
    const r = read({ r: 0.2, n: 12, expectedDirection: 'positive' },
      { status: 'confirmed', kind: 'reflection', testPlan: { ...pattern().testPlan!, expectedDirection: 'positive' } }, [], ev)
    expect(r.then?.r).toBeCloseTo(0.6, 3)
    expect(r.now?.r).toBeCloseTo(0.2, 3)
  })
})

describe('answerLook + decisionPlan', () => {
  const R = (state: Parameters<typeof answerLook>[0]['state'], then = false) =>
    ({ state, now: null, then: then ? lean(0.6, 10, 1) : null, minN: 8, dayCount: 9, dir: 1 as const })
  test('open rows speak the reading, confirmed rows speak against the decision', () => {
    expect(answerLook(R('halvany'), 'proposed').word).toBe('Halvány jel')
    expect(answerLook(R('eros'), 'confirmed').word).toBe('Tartja magát')
    expect(answerLook(R('halvany', true), 'confirmed').word).toBe('Azóta gyengült')
    expect(answerLook(R('halvany'), 'confirmed').word).toBe('Halvány maradt')
    expect(answerLook(R('nincs'), 'confirmed').word).toBe('Az adat nem igazolja')
    expect(answerLook(R('fordit'), 'confirmed').word).toBe('Most ellentmond')
    expect(answerLook(R('gyulik'), 'confirmed').word).toBe('Még alig mért')
  })
  test('the recommended verb follows the reading', () => {
    const rec = (s: Parameters<typeof decisionPlan>[0]['state'], st: Pattern['status'] = 'proposed') =>
      decisionPlan(R(s), st).buttons.find((b) => b.recommended)?.verb ?? null
    expect(rec('nincs')).toBe('reject')
    expect(rec('halvany')).toBe('monitor')
    expect(rec('fordit')).toBe('reject')
    expect(rec('eros')).toBe('confirm')
    expect(rec('gyulik')).toBeNull()
    expect(rec('fordit', 'confirmed')).toBe('reject')
  })
  test('a confirmed row never offers "Megerősítem"; a holding one only a quiet revoke link', () => {
    const plan = decisionPlan(R('eros'), 'confirmed')
    expect(plan.buttons).toEqual([])
    expect(plan.revokeLink).toBe(true)
    expect(decisionPlan(R('halvany'), 'confirmed').buttons.map((b) => b.verb)).toEqual(['reject'])
  })
  test('a rejected row offers only "Mégis figyeljük"', () => {
    expect(decisionPlan(R('elvetve'), 'rejected').buttons).toEqual([{ verb: 'monitor', label: 'Mégis figyeljük', recommended: false }])
  })
})

describe('zones, ticks and sentences', () => {
  test('numeric zones split at the median of A, binary zones by group', () => {
    const [lo, hi] = patternZones(LINE, false)
    expect(lo.map((d) => d.a)).toEqual([1, 2, 3, 4, 5])
    expect(hi.map((d) => d.a)).toEqual([6, 7, 8, 9])
    const [zero, one] = patternZones(days([[0, 1], [1, 2], [0, 3]]), true)
    expect(zero).toHaveLength(2)
    expect(one).toHaveLength(1)
  })
  test('nice ticks', () => {
    expect(niceTicks(3.8, 6.4, false)).toEqual([4, 5, 6])
    expect(niceTicks(5.9, 7.4, true)).toEqual([6, 6.5, 7])
  })
  test('the answer sentence names both zone averages and the honest tail', () => {
    const d = days([[6.2, 6], [6.3, 6], [6.4, 5], [6.5, 6], [6.6, 5], [6.9, 5], [7.0, 4], [7.1, 5], [7.2, 4]])
    const reading = readPattern({ pair: pair(), pattern: pattern(), days: d, events: [] }, 8)
    const s = saySentence(reading, pair(), d, 'proposed')
    expect(s).toContain('Amikor az ébredés ideje később volt')
    expect(s).toContain('**4,5**')
    expect(s).toContain('**5,6**')
    expect(s).toContain('9 napból még a véletlen is kihozhatja')
  })
  test('the rule sentence', () => {
    expect(ruleSentence(pair(), pattern().testPlan!)).toBe('Ha **az ébredés ideje** később van, aznap **az energia-szint** alacsonyabb.')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm exec vitest run src/features/insights/logic/patternReading.test.ts`
Expected: FAIL — module `patternReading` not found.

- [ ] **Step 3: Implement**

```ts
// frontend/src/features/insights/logic/patternReading.ts
// ============================================================
// Mezo · patternReading — a minta-részlet oldal EGY olvasata (mezo-rstt7, prototypes/uveg-minta.html).
// {pair, pattern, days, events} → állapot + a „merre húz" mérő mostani és megerősítéskori
// helyzete. A mérő sávja 90%-os Fisher-z intervallum, a feltevés SAJÁT irányába fordítva:
// jobbra mindig az „igaz rád". Tiszta függvények: az oldal minden szava és színe innen jön.
// ============================================================
import type { AlignedDay, Pattern, PatternEvent, PatternMonitorPair, PatternTestPlan } from '@/data/types'
import type { DetailTone } from '@/features/insights/components/DetailHero'
import type { Icon3DName } from '@/shared/ui/clay'
import { binaryGroupLabels, formatMetricValue } from '@/features/insights/logic/metricFormat'
import { bottleneckLabel, groupBalanceSentence } from '@/features/insights/logic/verdicts'

export type ReadingState =
  | 'kerdes' | 'gyulik' | 'allo' | 'nincs' | 'halvany' | 'halvanyFordit' | 'fordit' | 'eros'
  | 'elvetve' | 'elengedve' | 'pihen'

export interface Lean { r: number; n: number; support: number; lo: number; hi: number }
export interface Reading {
  state: ReadingState
  now: Lean | null
  then: Lean | null
  minN: number
  dayCount: number
  dir: 1 | -1
}

const Z90 = 1.645
const FLAT = 0.15
/** A csoportos (bináris) párnál csoportonként ennyi nap kell, ha a kapu nem mondja meg. */
const DEFAULT_PER_GROUP = 3
const LAST_RESORT_MIN_N = 8

export function pearson(days: AlignedDay[]): number | null {
  const n = days.length
  if (n < 3) return null
  const ma = days.reduce((s, d) => s + d.a, 0) / n
  const mb = days.reduce((s, d) => s + d.b, 0) / n
  let sab = 0, saa = 0, sbb = 0
  for (const d of days) {
    sab += (d.a - ma) * (d.b - mb)
    saa += (d.a - ma) ** 2
    sbb += (d.b - mb) ** 2
  }
  if (saa === 0 || sbb === 0) return null
  return sab / Math.sqrt(saa * sbb)
}

export function lean(r: number, n: number, dir: 1 | -1): Lean {
  const support = r * dir
  if (n <= 3) return { r, n, support, lo: -1, hi: 1 }
  const z = Math.atanh(Math.max(-0.999, Math.min(0.999, support)))
  const se = 1 / Math.sqrt(n - 3)
  return { r, n, support, lo: Math.tanh(z - Z90 * se), hi: Math.tanh(z + Z90 * se) }
}

function classify(l: Lean): ReadingState {
  if (l.lo > 0) return 'eros'
  if (l.hi < 0) return 'fordit'
  if (Math.abs(l.support) < FLAT) return 'nincs'
  return l.support > 0 ? 'halvany' : 'halvanyFordit'
}

function thenLean(pair: PatternMonitorPair, pattern: Pattern | null, events: PatternEvent[], dir: 1 | -1): Lean | null {
  if (pattern?.status !== 'confirmed') return null
  if (pair.verdict === 'frozen' && pair.r != null && pair.n != null) return lean(pair.r, pair.n, dir)
  const confirmedAt = [...events].reverse().find((e) => e.kind === 'confirmed')?.occurredAt
  if (!confirmedAt) return null
  const before = events.filter((e) => e.occurredAt <= confirmedAt && e.r != null && e.n != null)
  const last = before[before.length - 1]
  return last ? lean(last.r!, last.n!, dir) : null
}

export function readPattern(
  input: { pair: PatternMonitorPair; pattern: Pattern | null; days: AlignedDay[]; events: PatternEvent[] },
  catalogMinN: number | null,
): Reading {
  const { pair, pattern, days, events } = input
  const plan = pattern?.testPlan ?? null
  const dir: 1 | -1 = (plan?.expectedDirection ?? pair.expectedDirection) === 'negative' ? -1 : 1
  const minN = plan?.minN
    ?? (pair.missingDays != null ? pair.alignedDays + pair.missingDays : null)
    ?? catalogMinN ?? LAST_RESORT_MIN_N
  const dayCount = pair.verdict === 'frozen' ? days.length : Math.max(pair.alignedDays, days.length)
  const base = { minN, dayCount, dir, then: thenLean(pair, pattern, events, dir) }
  const status = pattern?.status

  if (status === 'rejected') return { ...base, state: 'elvetve', now: null }
  if (status === 'refuted') return { ...base, state: 'elengedve', now: null }
  if (status === 'dormant') return { ...base, state: 'pihen', now: null }

  switch (pair.verdict) {
    case 'no_data': return { ...base, state: 'kerdes', now: null }
    case 'degenerate': return { ...base, state: 'allo', now: null }
    case 'few_days':
    case 'imbalanced_groups': return { ...base, state: dayCount === 0 ? 'kerdes' : 'gyulik', now: null }
    case 'live': {
      if (pair.r == null || pair.n == null) return { ...base, state: 'gyulik', now: null }
      const now = lean(pair.r, pair.n, dir)
      return { ...base, state: classify(now), now }
    }
    case 'frozen': {
      if (days.length < minN) return { ...base, state: days.length === 0 ? 'kerdes' : 'gyulik', now: null }
      if (pair.metricAValueKind === 'binary') {
        const per = pair.requiredPerGroup ?? DEFAULT_PER_GROUP
        const ones = days.filter((d) => d.a >= 0.5).length
        if (ones < per || days.length - ones < per) return { ...base, state: 'gyulik', now: null }
      }
      const r = pearson(days)
      if (r == null) return { ...base, state: 'allo', now: null }
      const now = lean(r, days.length, dir)
      return { ...base, state: classify(now), now }
    }
  }
}

export interface AnswerLook { word: string; tone: DetailTone; art: Icon3DName }

const LOOK: Record<ReadingState, AnswerLook> = {
  kerdes: { word: 'Még csak egy kérdés', tone: 'lav', art: 't-quest' },
  gyulik: { word: 'Még gyűjtöm', tone: 'lav', art: 't-clock' },
  allo: { word: 'Nincs mit összevetni', tone: 'mute', art: 't-hold' },
  nincs: { word: 'Nincs összefüggés', tone: 'mute', art: 't-hold' },
  halvany: { word: 'Halvány jel', tone: 'lav', art: 't-lens' },
  halvanyFordit: { word: 'Inkább fordítva', tone: 'sky', art: 't-compare' },
  fordit: { word: 'Épp fordítva', tone: 'sky', art: 't-compare' },
  eros: { word: 'Erős jel', tone: 'gold', art: 't-sprout' },
  elvetve: { word: 'Elvetetted', tone: 'mute', art: 't-skip' },
  elengedve: { word: 'Mezo elengedte', tone: 'mute', art: 't-skip' },
  pihen: { word: 'Pihen', tone: 'mute', art: 't-clock' },
}

export function answerLook(reading: Reading, status: Pattern['status'] | null): AnswerLook {
  if (status === 'confirmed') {
    switch (reading.state) {
      case 'eros': return { word: 'Tartja magát', tone: 'sage', art: 't-tick' }
      case 'halvany': return { word: reading.then ? 'Azóta gyengült' : 'Halvány maradt', tone: 'gold', art: 't-trend' }
      case 'nincs': return { word: 'Az adat nem igazolja', tone: 'gold', art: 't-hold' }
      case 'halvanyFordit':
      case 'fordit': return { word: 'Most ellentmond', tone: 'coral', art: 't-compare' }
      case 'gyulik':
      case 'kerdes': return { word: 'Még alig mért', tone: 'gold', art: 't-clock' }
      default: break
    }
  }
  return LOOK[reading.state]
}

export type DecisionVerb = 'confirm' | 'monitor' | 'reject'
export interface DecisionPlan {
  buttons: { verb: DecisionVerb; label: string; recommended: boolean }[]
  /** A megerősített, tartó minta csak egy halk „visszavonom" linket kap. */
  revokeLink: boolean
  /** Az ajánlás egy mondatban („**Ajánlom elvetni:** …"), `**` = félkövér. */
  note: string | null
  /** A már eldőlt állapot sora (pl. „Bekerült a Tudástárba…"). */
  settled: string | null
}

export function decisionPlan(reading: Reading, status: Pattern['status'] | null): DecisionPlan {
  const b = (verb: DecisionVerb, label: string, recommended: boolean) => ({ verb, label, recommended })
  const watching = status === 'monitoring'
  const watch = watching ? 'Figyeljük tovább' : 'Figyeljük'
  if (status === 'confirmed') {
    if (reading.state === 'eros') {
      return { buttons: [], revokeLink: true, note: null, settled: 'Bekerült a Tudástárba, Mezo számol vele.' }
    }
    const against = reading.state === 'nincs' || reading.state === 'fordit' || reading.state === 'halvanyFordit'
    return {
      buttons: [b('reject', 'Visszavonom', against)], revokeLink: false, settled: null,
      note: against
        ? `**Ajánlom a visszavonást:** Mezo ezt tényként kezeli, pedig ${reading.state === 'nincs' ? 'az adat nem igazolja' : 'az adat most az ellenkezőjét mutatja'}.`
        : reading.state === 'gyulik' || reading.state === 'kerdes'
          ? `**Maradhat:** ha ${reading.minN} napnál sem igazolódik, szólok.`
          : '**Maradhat:** még a jó irányba mutat, csak gyengébben. Szólok, ha megfordul.',
    }
  }
  if (status === 'rejected' || status === 'refuted' || status === 'dormant') {
    return { buttons: [b('monitor', 'Mégis figyeljük', false)], revokeLink: false, note: null, settled: null }
  }
  switch (reading.state) {
    case 'gyulik': return { buttons: [b('monitor', watch, false), b('reject', 'Elvetem', false)], revokeLink: false, settled: null,
      note: `**Nincs teendőd:** szólok, amikor megvan a ${reading.minN}. nap.` }
    case 'kerdes': return { buttons: [b('monitor', watch, !watching), b('reject', 'Elvetem', false)], revokeLink: false, settled: null,
      note: '**Ha érdekel, figyeljük:** a napjaidból magától gyűlik.' }
    case 'allo': return { buttons: [b('monitor', watch, false), b('reject', 'Elvetem', false)], revokeLink: false, settled: null,
      note: '**Várjunk:** amíg az egyik adat áll, nincs mit eldönteni.' }
    case 'nincs': return { buttons: [b('reject', 'Elvetem', true), b('monitor', watching ? 'Figyeljük tovább' : 'Figyeljük még', false)], revokeLink: false, settled: null,
      note: `**Ajánlom elvetni:** ${reading.dayCount} nap után sem látszik semmi.` }
    case 'halvany': return { buttons: [b('monitor', watching ? 'Figyeljük tovább' : 'Figyeljük még', true), b('reject', 'Elvetem', false)], revokeLink: false, settled: null,
      note: '**Ajánlom figyelni:** jó irányba mutat, pár nap még eldöntheti.' }
    case 'halvanyFordit': return { buttons: [b('reject', 'Elvetem', true), b('monitor', watching ? 'Figyeljük tovább' : 'Figyeljük még', false)], revokeLink: false, settled: null,
      note: '**Ajánlom elvetni:** a várt irány nem jön ki, inkább az ellenkezője.' }
    case 'fordit': return { buttons: [b('reject', 'Elvetem', true), b('monitor', watching ? 'Figyeljük tovább' : 'Figyeljük még', false)], revokeLink: false, settled: null,
      note: '**Ajánlom elvetni:** sok nap után is az ellenkezője igaz.' }
    case 'eros': return { buttons: [b('confirm', 'Megerősítem', true), b('monitor', watch, false)], revokeLink: false, settled: null,
      note: '**Ajánlom megerősíteni:** bekerül a Tudástárba, és Mezo számolhat vele.' }
    default: return { buttons: [], revokeLink: false, note: null, settled: null }
  }
}

export function patternZones(days: AlignedDay[], binary: boolean): [AlignedDay[], AlignedDay[]] {
  if (binary) return [days.filter((d) => d.a < 0.5), days.filter((d) => d.a >= 0.5)]
  const sorted = [...days].sort((x, y) => x.a - y.a)
  const k = Math.ceil(sorted.length / 2)
  return [sorted.slice(0, k), sorted.slice(k)]
}

export function niceTicks(lo: number, hi: number, clock: boolean, count = 3): number[] {
  let step: number
  if (clock) step = hi - lo > 1.6 ? 1 : 0.5
  else {
    const raw = (hi - lo) / count || 1
    const p = 10 ** Math.floor(Math.log10(raw))
    const m = raw / p
    step = (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p
  }
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(4)))
  return out
}

export const mean = (days: AlignedDay[]) => days.reduce((s, d) => s + d.b, 0) / (days.length || 1)
export const az = (word: string): 'a' | 'az' => (/^[aáeéiíoóöőuúüű]/i.test(word) ? 'az' : 'a')
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const hu1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1).replace('.', ',')

/** Zóna-átlag kiírva: óra-metrikán „20:39", egyébként egy tizedes vesszővel. */
export function zoneValue(pair: PatternMonitorPair, value: number): string {
  return pair.metricBValueKind === 'clock_hour' ? formatMetricValue(pair.metricBKey, value) : hu1(value)
}

export function saySentence(reading: Reading, pair: PatternMonitorPair, days: AlignedDay[],
  status: Pattern['status'] | null): string {
  const A = pair.metricALabel
  const B = pair.metricBLabel
  switch (reading.state) {
    case 'kerdes':
      return `Még nincs egy közös nap sem. Ahogy ${az(A)} **${A}** és ${az(B)} **${B}** napjai összegyűlnek, számolni kezdem.`
    case 'gyulik':
      if (status === 'confirmed') {
        return `Megerősítetted, de eddig csak **${reading.dayCount} közös nap** van. ${reading.minN} nap kell, hogy az adat is mondjon valamit.`
      }
      if (pair.verdict === 'imbalanced_groups') return groupBalanceSentence(pair)
      return `**${reading.dayCount} közös nap** van a ${reading.minN}-ból. Addig nem mondok irányt: ennyi napból bármi kijöhetne.`
    case 'allo': {
      const label = pair.bottleneckMetricKey ? bottleneckLabel(pair) : B
      return `${cap(az(label))} **${label}** a vizsgált napokon mindig ugyanannyi volt, így nincs mit összevetni. Ha mozdul, újra számolok.`
    }
    case 'elvetve': return 'Elvetetted, ezért ezt már nem számolom tovább.'
    case 'elengedve': return 'Az adat többször egymás után ellentmondott ennek, ezért Mezo elengedte.'
    case 'pihen': return 'Régóta nincs elég adat a teszteléséhez. Ha újra lesz, magától felébred.'
    default: break
  }
  const binary = pair.metricAValueKind === 'binary'
  const [z0, z1] = patternZones(days, binary)
  const n = reading.now?.n ?? days.length
  let base: string
  if (reading.state === 'nincs' || z0.length === 0 || z1.length === 0) {
    base = 'A kétféle nap átlaga között kicsi a különbség, és nem is következetes.'
  } else {
    const who = binary
      ? cap(binaryGroupLabels(pair.metricAKey).one.axis)
      : `Amikor ${az(A)} ${A} ${pair.metricAValueKind === 'clock_hour' ? 'később' : 'magasabb'} volt,`
    base = `${who} ${az(B)} ${B} átlagosan **${zoneValue(pair, mean(z1))}** volt, a többi napon **${zoneValue(pair, mean(z0))}**.`
  }
  const tail: Partial<Record<ReadingState, string>> = {
    nincs: ` ${n} nap alatt nem rajzolódik ki kapcsolat.`,
    halvany: ` Ez a várt irány, de ${n} napból még a véletlen is kihozhatja.`,
    halvanyFordit: ` Ez épp a várttal ellentétes, bár ${n} napból még lehet véletlen.`,
    fordit: ` Ez a várttal **ellentétes**, és ${n} nap után már nem valószínű, hogy véletlen.`,
    eros: ` ${n} nap után ez már nem valószínű, hogy véletlen.`,
  }
  return base + (tail[reading.state] ?? '')
}

function lagWord(lagDays: number): string {
  if (lagDays === 0) return 'aznap'
  if (lagDays === 1) return 'másnap'
  return `${lagDays} nappal később`
}

export function ruleSentence(pair: PatternMonitorPair, plan: PatternTestPlan | null): string {
  const A = plan?.seriesALabel ?? pair.metricALabel
  const B = plan?.seriesBLabel ?? pair.metricBLabel
  const up = (plan?.expectedDirection ?? pair.expectedDirection) === 'positive'
  const lag = lagWord(plan?.lagDays ?? pair.lagDays)
  const bWord = pair.metricBValueKind === 'clock_hour' ? (up ? 'később van' : 'korábban van') : (up ? 'magasabb' : 'alacsonyabb')
  if (pair.metricAValueKind === 'binary') {
    return `${cap(binaryGroupLabels(pair.metricAKey).one.axis)} ${lag} ${az(B)} **${B}** ${bWord}.`
  }
  const aWord = pair.metricAValueKind === 'clock_hour' ? 'később van' : 'magasabb'
  return `Ha **${az(A)} ${A}** ${aWord}, ${lag} **${az(B)} ${B}** ${bWord}.`
}
```

Note on `ruleSentence`: the article sits INSIDE the bold span for the numeric branch (`**az ébredés ideje**`), matching the test. Keep it that way.

Note on `binaryGroupLabels(...).one.axis`: read `metricFormat.ts:44-77` first; if the field is named differently use the field that yields the "one" group's in-sentence word (e.g. „hétvégén"), and adjust the test expectation only for that word.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm exec vitest run src/features/insights/logic/patternReading.test.ts`
Expected: PASS. If a numeric expectation (band bounds, zone averages) is off in the 2nd decimal, fix the IMPLEMENTATION, not the test — the numbers were computed by hand from the formulas in Global Constraints.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/insights/logic/patternReading.ts frontend/src/features/insights/logic/patternReading.test.ts
git commit -m "feat(insights): minta-olvasat — állapot, merre-húz sáv, ajánlott döntés (mezo-rstt7)"
```

---

### Task 2: The meter and the day pips (`PatternLeanMeter.tsx`)

**Files:**
- Create: `frontend/src/features/insights/components/PatternLeanMeter.tsx`
- Test: `frontend/src/features/insights/components/PatternLeanMeter.test.tsx`
- Modify: `frontend/src/styles/prototype.css` — append the block opener `/* ── uveg minta ujramesele (mezo-rstt7) ── prototypes/uveg-minta.html ── */` and the meter/pips rules; later tasks append inside the same block, before its closer `/* ── /uveg minta ujramesele ── */`.

**Interfaces:**
- Consumes: `Lean` from Task 1.
- Produces: `PatternLeanMeter({ now, then }: { now: Lean; then: Lean | null })`, `PatternDayPips({ count, of }: { count: number; of: number })`.

Markup contract (port of the prototype's `.meter` / `.pips`, classes prefixed `pmx-`):

```tsx
// PatternLeanMeter.tsx
import type { CSSProperties } from 'react'
import type { Lean } from '@/features/insights/logic/patternReading'

const pos = (s: number) => `${(50 + 50 * Math.max(-1, Math.min(1, s))).toFixed(1)}%`
const SIDE = ['Épp fordítva', 'Nincs hatás', 'Igaz rád'] as const

export function PatternLeanMeter({ now, then }: { now: Lean; then: Lean | null }) {
  const side = now.support > 0.15 ? 2 : now.support < -0.15 ? 0 : 1
  return (
    <div className={`pmx-meter${then ? ' has-ghost' : ''}`} role="img" aria-label={`Merre húz az adat: ${SIDE[side].toLowerCase()}`}>
      <div className="pmx-trk">
        <i className="pmx-mid" />
        <i className="pmx-band" style={{ '--lo': pos(now.lo), '--hi': pos(now.hi) } as CSSProperties} />
        {then && <>
          <i className="pmx-ghost" data-testid="lean-then" style={{ '--x': pos(then.support) } as CSSProperties} />
          <span className="pmx-ghost-l" style={{ '--x': pos(then.support) } as CSSProperties}>amikor megerősítetted</span>
        </>}
        <i className="pmx-dot" data-testid="lean-now" style={{ '--x': pos(now.support) } as CSSProperties} />
      </div>
      <div className="pmx-lbls">{SIDE.map((l, i) => <span key={l} className={i === side ? 'on' : undefined}>{l}</span>)}</div>
      <p className="pmx-how">A pötty: amit most látok. A sáv: ennyit billeghet még — minél több nap, annál keskenyebb.</p>
    </div>
  )
}

export function PatternDayPips({ count, of }: { count: number; of: number }) {
  return (
    <div className="pmx-pips-wrap" role="img" aria-label={`${count} nap a ${of}-ból`}>
      <div className="pmx-pips">{Array.from({ length: of }, (_, i) => <i key={i} className={i < count ? 'on' : undefined} />)}</div>
      <div className="pmx-pips-l"><span><b>{count}</b> / {of} nap</span><span>még {Math.max(0, of - count)} nap</span></div>
    </div>
  )
}
```

CSS: port `.meter*`, `.pips*` from `docs/design_2.0/prototypes/src/uveg-minta-body.html` (lines ~40-80) renaming `.meter .trk`→`.pmx-trk`, `.meter .mid`→`.pmx-mid`, etc.; replace prototype literals with tokens (`--page`→`var(--surface-page)`, `--faint`→`var(--text-muted)`, `--ink`→`var(--text-primary)`, `--sky`/`--sage`→`var(--dv-sky)`/`var(--dv-sage)`); keep the slide-in / band-in keyframes inside `@media (prefers-reduced-motion: no-preference)`.

- [ ] **Step 1: failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { PatternDayPips, PatternLeanMeter } from '@/features/insights/components/PatternLeanMeter'
import { lean } from '@/features/insights/logic/patternReading'

test('the dot sits at the support, the band spans the interval, the matching side is lit', () => {
  render(<PatternLeanMeter now={lean(-0.312, 9, -1)} then={null} />)
  expect(screen.getByTestId('lean-now').style.getPropertyValue('--x')).toBe('65.6%')
  expect(screen.getByText('Igaz rád')).toHaveClass('on')
  expect(screen.getByRole('img')).toHaveAccessibleName('Merre húz az adat: igaz rád')
  expect(screen.queryByTestId('lean-then')).toBeNull()
})
test('a confirmed row shows where it stood at the decision', () => {
  render(<PatternLeanMeter now={lean(0.27, 16, 1)} then={lean(0.545, 12, 1)} />)
  expect(screen.getByTestId('lean-then')).toBeInTheDocument()
  expect(screen.getByText('amikor megerősítetted')).toBeInTheDocument()
})
test('pips light the collected days', () => {
  const { container } = render(<PatternDayPips count={7} of={8} />)
  expect(container.querySelectorAll('.pmx-pips i.on')).toHaveLength(7)
  expect(screen.getByText('még 1 nap')).toBeInTheDocument()
})
```

- [ ] **Step 2:** run `cd frontend && CI=true VITE_USE_MOCK=true pnpm exec vitest run src/features/insights/components/PatternLeanMeter.test.tsx` → FAIL (module missing).
- [ ] **Step 3:** create the component + CSS as specified.
- [ ] **Step 4:** re-run → PASS.
- [ ] **Step 5:** commit `feat(insights): merre-húz mérő és nap-pipák (mezo-rstt7)`.

---

### Task 3: The two-zone chart (`PatternZoneChart.tsx`)

**Files:**
- Create: `frontend/src/features/insights/components/PatternZoneChart.tsx`
- Test: `frontend/src/features/insights/components/PatternZoneChart.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (inside the Task 2 block)

**Interfaces:**
- Consumes: `patternZones`, `niceTicks`, `mean`, `zoneValue` (Task 1), `formatMetricValue`, `binaryGroupLabels` (`metricFormat.ts`), `huMonthDay` from `@/shared/lib/dates` (check its signature; it formats `YYYY-MM-DD` as „szept. 22.").
- Produces: `PatternZoneChart({ days, pair, showAverages, tone }: { days: AlignedDay[]; pair: PatternMonitorPair; showAverages: boolean; tone: DetailTone })`.

Behaviour (port of the prototype's `chart()` variant A, `src/uveg-minta-body.html`):
- Root: `<section className={cn('glass pmx-chart rise', toneClass(tone))}>` — the page's only glass.
- SVG `viewBox="0 0 340 {H}"`, `L=32, R=334, T=54, Bt=184`, `H = Bt + 40` (binary `+44`). y-range = data min/max padded 15 %; `niceTicks(y0, y1, metricBValueKind==='clock_hour', 3)` drawn as `.pmx-grid` lines with `.pmx-tk` labels at `x=L-6`, `text-anchor=end` (clock → `formatMetricValue`, number → integer or one decimal).
- Zones: `patternZones(days, binary)`. Numeric x = linear over A's range padded 8 %; split x = midpoint between the last left dot and the first right dot. Binary: the two group centres at `(L+177)/2` and `(R+183)/2`, dots jittered `((i*37)%23-11)*5.4`, split at 180.
- Two zone rects `.pmx-zone` / `.pmx-zone.b`; on top of each zone, when `showAverages`: the average (`.pmx-zh`, 19px) and `átlag · {n} nap` (`.pmx-zs`); when not: only `{n} nap`. Average line `.pmx-avg` across the zone at `y(mean)`.
- x axis: numeric → `niceTicks` of A as tick marks + labels, and ONE axis title `{metricALabel} →` at the right; binary → the two group names (`binaryGroupLabels(metricAKey).zero.axis` / `.one.axis`, capitalised) under the zones.
- Dots: `<circle className="pmx-pt" role="button" tabIndex={0} aria-label="{date}: {A} {aValue}, {B} {bValue}" aria-pressed={selected}>`; click / Enter / Space toggles `selected` (component `useState`, NOT page state — the page must not re-render or re-animate). Selected → white dot, a ring, and a tooltip group (`.pmx-tip`: rect + two lines: `{huMonthDay(date)} · {binary ? group : `${A} ${aValue}`}` and bold `{B}: {bValue}`), clamped inside `[L, R]`, above the dot unless that clips.
- Footer: `<div className="pmx-foot"><span>{B cap} · koppints egy pöttyre</span>` + `<details className="pmx-days"><summary>Napok listája ›</summary><table>` date / A / B rows `</table></details>`.
- When `!showAverages`: a `<p className="pmx-cnote">Az átlagot {minN} napnál mutatom.</p>` is rendered by the PAGE (Task 5), not here.

- [ ] **Step 1: failing tests**

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { PatternZoneChart } from '@/features/insights/components/PatternZoneChart'
import type { PatternMonitorPair } from '@/data/types'

const pair = { metricAKey: 'wakeup-hour', metricALabel: 'ébredés ideje', metricAValueKind: 'clock_hour',
  metricBKey: 'checkin-energy', metricBLabel: 'energia-szint', metricBValueKind: 'number' } as PatternMonitorPair
const days = [[6.2, 6], [6.3, 6], [6.4, 5], [6.5, 6], [6.6, 5], [6.9, 5], [7.0, 4], [7.1, 5], [7.2, 4]]
  .map(([a, b], i) => ({ date: `2026-09-${10 + i}`, a, b }))

test('zone averages sit on top, the x metric is named once', () => {
  render(<PatternZoneChart days={days} pair={pair} showAverages tone="lav" />)
  expect(screen.getByText('5,6')).toBeInTheDocument()
  expect(screen.getByText('4,5')).toBeInTheDocument()
  expect(screen.getByText('ébredés ideje →')).toBeInTheDocument()
  expect(screen.queryByText(/napok$/)).toBeNull() // no per-zone x-metric captions any more
})

test('tapping a dot shows its day and value without leaving the chart', () => {
  render(<PatternZoneChart days={days} pair={pair} showAverages tone="lav" />)
  const dot = screen.getAllByRole('button', { name: /energia-szint/ })[0]
  fireEvent.click(dot)
  expect(dot).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText('energia-szint: 6')).toBeInTheDocument()
  fireEvent.click(dot)
  expect(screen.queryByText('energia-szint: 6')).toBeNull()
})

test('without averages only the day counts show', () => {
  render(<PatternZoneChart days={days.slice(0, 5)} pair={pair} showAverages={false} tone="lav" />)
  expect(screen.queryByText(/átlag/)).toBeNull()
})

test('binary pairs name the two groups under the zones', () => {
  const bin = { ...pair, metricAKey: 'weekend', metricALabel: 'hétvége', metricAValueKind: 'binary' } as PatternMonitorPair
  render(<PatternZoneChart days={days.map((d, i) => ({ ...d, a: i % 3 === 0 ? 1 : 0 }))} pair={bin} showAverages tone="sky" />)
  expect(screen.getByText(/^Hétköznap/)).toBeInTheDocument()
})
```

Adjust `Hétköznap` to whatever `binaryGroupLabels('weekend').zero.axis` capitalises to.

- [ ] **Step 2:** run the file → FAIL.
- [ ] **Step 3:** implement + CSS (`.pmx-chart`, `.pmx-grid`, `.pmx-tk`, `.pmx-zone`, `.pmx-zh`, `.pmx-zs`, `.pmx-avg`, `.pmx-pt`, `.pmx-tip`, `.pmx-foot`, `.pmx-days`) ported from the prototype with tokens.
- [ ] **Step 4:** re-run → PASS.
- [ ] **Step 5:** commit `feat(insights): kétzónás minta-grafikon koppintható pöttyel (mezo-rstt7)`.

---

### Task 4: The hero and the rule card

**Files:**
- Create: `frontend/src/features/insights/components/PatternAnswerHero.tsx` (+ `.test.tsx`)
- Create: `frontend/src/features/insights/components/PatternRuleCard.tsx`
- Modify: `frontend/src/styles/prototype.css` (same block)

**Interfaces:**
- Consumes: Task 1 (`Reading`, `answerLook`, `decisionPlan`, `saySentence`, `ruleSentence`), Task 2 (`PatternLeanMeter`, `PatternDayPips`), `PATTERN_DOMAIN_ART` (`PatternDomainMark.tsx`), `Icon3D`, `toneClass`, `patternHeadline` (`patternCopy.ts`).
- Produces:
  - `PatternAnswerHero({ pair, pattern, reading, days, events, onDecide }: { pair: PatternMonitorPair; pattern: Pattern | null; reading: Reading; days: AlignedDay[]; events: PatternEvent[]; onDecide: (verb: PatternStatus) => void })`
  - `PatternRuleCard({ pair, plan, reading, windowDays }: { pair: PatternMonitorPair; plan: PatternTestPlan | null; reading: Reading; windowDays: number | null })`
  - `Bold({ text }: { text: string })` exported from `PatternAnswerHero.tsx` — splits on `**` and wraps odd segments in `<b>`.

Hero anatomy (prototype `.mh`, frameless halo, `toneClass(look.tone)` on the root `<section className="pmx-hero rise …">`):
1. `.pmx-pairrow`: two flat chips — `Icon3D` `PATTERN_DOMAIN_ART[pair.metricADomain]` + capitalised `metricALabel`, `→`, same for B.
2. `.pmx-q` (16px, secondary ink): `pair.questionHu || patternHeadline(pair.title, pair)`.
3. `.pmx-ans`: `Icon3D name={look.art} size={54}` + `<h1 id="pmx-answer">{look.word}</h1>`; the section is `aria-labelledby="pmx-answer"`.
4. `.pmx-say`: `<Bold text={saySentence(reading, pair, days, status)} />`.
5. Quote (only for `kerdes`/`gyulik`): the latest `observation` event's `text`, first paragraph (split on `\n\n`), in `.pmx-quote` with eyebrow `AMIBŐL MEZO FELVETETTE`.
6. Meter: `reading.now` → `<PatternLeanMeter now={reading.now} then={reading.then} />`; else if `state === 'gyulik'` → `<PatternDayPips count={reading.dayCount} of={reading.minN} />`.
7. Decision (`decisionPlan(reading, status)`): `settled` → `.pmx-done` row with `t-tick`; buttons → `.pmx-dact` flat pills, the recommended one `.is-rec` (lit with the hero tone), icons `confirm→t-tick`, `monitor→t-lens`, `reject→t-skip`; `revokeLink` → a quiet `.pmx-link` button „Mégsem igaz rám — visszavonom"; `note` → `<p className="pmx-why"><Bold text={note} /></p>`. A button click calls `onDecide(verb)`. `aria-pressed` on the monitor button when `status === 'monitoring'`.
8. The status pill (`ÚJ` / `FIGYELJÜK` / `BEÉPÜLT` / `ELVETVE` / `ELENGEDVE` / `PIHEN`) is NOT in the hero — the page puts it in the back row (Task 5).

Rule card (flat `.pmx-rule`): `<p><Bold text={ruleSentence(pair, plan)} /></p>` + chips: `{enough ? `${n} nap · elég (${minN} kell)` : `${n} / ${minN} nap`}` (tick icon + `.ok` when enough, clock otherwise), `{lagWord} nézem a hatást` (`aznap`/`másnap`/`N nappal később`), and `az utolsó {windowDays} napból` when `windowDays != null`.

- [ ] **Step 1: failing tests** (`PatternAnswerHero.test.tsx`)

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { PatternAnswerHero } from '@/features/insights/components/PatternAnswerHero'
import { readPattern } from '@/features/insights/logic/patternReading'
import type { Pattern, PatternMonitorPair } from '@/data/types'

const pair = {
  key: 'k', title: 'Ébredés ideje ↔ energia-szint', lagDays: 0, questionHu: 'Több energiád van, ha korábban kelsz?',
  metricAKey: 'wakeup-hour', metricALabel: 'ébredés ideje', metricAValueKind: 'clock_hour', metricADomain: 'sleep',
  metricBKey: 'checkin-energy', metricBLabel: 'energia-szint', metricBValueKind: 'number', metricBDomain: 'mind',
  expectedDirection: 'negative', verdict: 'live', alignedDays: 9, missingDays: null, r: -0.312, n: 9, p: 0.41,
  groupZeroDays: null, groupOneDays: null, requiredPerGroup: null, bottleneckMetricKey: null, status: null,
} as unknown as PatternMonitorPair
const pattern = { id: 'p1', status: 'proposed', evidenceHits: 0, evidenceMisses: 0 } as Pattern
const days = [[6.2, 6], [6.3, 6], [6.4, 5], [6.5, 6], [6.6, 5], [6.9, 5], [7.0, 4], [7.1, 5], [7.2, 4]]
  .map(([a, b], i) => ({ date: `2026-09-${10 + i}`, a, b }))

test('the answer is the heading, the question is quiet, the recommended action is lit', () => {
  const onDecide = vi.fn()
  const reading = readPattern({ pair, pattern, days, events: [] }, 8)
  render(<PatternAnswerHero pair={pair} pattern={pattern} reading={reading} days={days} events={[]} onDecide={onDecide} />)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Halvány jel')
  expect(screen.getByText('Több energiád van, ha korábban kelsz?')).toBeInTheDocument()
  const watch = screen.getByRole('button', { name: /Figyeljük még/ })
  expect(watch).toHaveClass('is-rec')
  expect(screen.queryByRole('button', { name: /Megerősítem/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Elvetem/ }))
  expect(onDecide).toHaveBeenCalledWith('reject')
})

test('a confirmed, holding pattern only offers a quiet revoke', () => {
  const strong = { ...pair, r: -0.9, n: 20 } as PatternMonitorPair
  const confirmed = { ...pattern, status: 'confirmed' } as Pattern
  const reading = readPattern({ pair: strong, pattern: confirmed, days, events: [] }, 8)
  render(<PatternAnswerHero pair={strong} pattern={confirmed} reading={reading} days={days} events={[]} onDecide={vi.fn()} />)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tartja magát')
  expect(screen.getByText('Bekerült a Tudástárba, Mezo számol vele.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Mégsem igaz rám — visszavonom' })).toBeInTheDocument()
})
```

- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** implement both components + CSS (`.pmx-hero` halo, `.pmx-pairrow`, `.pmx-q`, `.pmx-ans`, `.pmx-say`, `.pmx-quote`, `.pmx-dec`, `.pmx-dact`, `.pmx-dact.is-rec`, `.pmx-link`, `.pmx-why`, `.pmx-done`, `.pmx-rule`, `.pmx-facts`) ported from the prototype. The hero halo uses `::before` with `radial-gradient` of `--c`; clip with `overflow-x: clip` (bible U2 rule 12).
- [ ] **Step 4:** re-run → PASS.
- [ ] **Step 5:** commit `feat(insights): válasz-hős és szabály-kártya (mezo-rstt7)`.

---

### Task 5: Compose the page, re-dress the saved-insight page, delete the superseded parts

**Files:**
- Modify: `frontend/src/features/insights/pages/PatternDetailPage.tsx`
- Modify: `frontend/src/features/insights/components/PatternArtifactDetail.tsx`
- Modify: `frontend/src/features/insights/pages/PatternDetailPage.test.tsx`
- Modify: `frontend/src/data/insights/insights.ts` (mock details)
- Delete: `HypothesisStateCard.tsx`, `HypothesisStateCard.test.tsx`, `PatternDetailHero.tsx`, `PatternDetailHero.test.tsx`, `TestPlanTiles.tsx`, `TestPlanTiles.test.tsx`, `PatternEvidenceChart.tsx`, `PatternEvidenceChart.test.tsx`, `PatternStrengthChart.tsx` (all under `frontend/src/features/insights/components/`)
- Modify: `frontend/src/features/insights/components/PatternDomainMark.tsx` (doc comment only: it no longer names TestPlanTiles/PatternDetailHero)
- Modify: `frontend/src/styles/prototype.css` (remove dead `pdt-*` rules)

**Interfaces:**
- Consumes: everything from Tasks 1–4; existing `DetailFrame`, `DetailState`, `SectionHead`, `EvidenceLog`, `PatternJournal`, `journalEntries`, `PatternImpactCard`, the in-file `Diagnostics`.

Page composition for any `detail` (both old layouts collapse into this one):

```tsx
const { pair, pattern, events, days, impact } = detail
const reading = readPattern({ pair, pattern, days, events }, monitor?.minN ?? null)
const look = answerLook(reading, pattern?.status ?? null)
const plan = pattern?.testPlan ?? null
return (
  <PatternFrame pill={<span className={cn('pmx-status', toneClass(look.tone))}>{STATUS_WORD[pattern?.status ?? 'none']}</span>}>
    <PatternAnswerHero pair={pair} pattern={pattern} reading={reading} days={days} events={events}
      onDecide={(verb) => pattern && decide(pattern.id, verb)} />
    <SectionHead title="Mit mutat az adat" meta={days.length ? `${days.length} nap` : undefined} />
    {days.length >= 2
      ? <PatternZoneChart days={days} pair={pair} tone={look.tone}
          showAverages={reading.dayCount >= reading.minN && reading.state !== 'allo'} />
      : <p className="pmx-empty uv-empty">Még egy közös nap sincs. Ahogy a napok összegyűlnek, itt jelennek meg — minden nap egy pötty.</p>}
    {days.length >= 2 && reading.dayCount < reading.minN && <p className="pmx-cnote">Az átlagot {reading.minN} napnál mutatom.</p>}
    <SectionHead title="A szabály" meta="előre rögzítve" />
    <PatternRuleCard pair={pair} plan={plan} reading={reading} windowDays={plan?.windowDays ?? monitor?.lookbackDays ?? null} />
    <details className="pdt-fold rise"> {/* „Ami eddig történt" — EvidenceLog when plan-driven events exist, else PatternJournal(journalEntries(events, pair)); the empty note when neither has rows */} </details>
    {hasImpact && <PatternImpactCard pattern={pattern} impact={impact} />}
    <Diagnostics … /> {/* summary retitled: „Számok, ha érdekel" / „ablak, források és technikai adatok" */}
  </PatternFrame>
)
```

- `STATUS_WORD`: `proposed→'ÚJ'`, `monitoring→'FIGYELJÜK'`, `confirmed→'BEÉPÜLT'`, `rejected→'ELVETVE'`, `refuted→'ELENGEDVE'`, `dormant→'PIHEN'`, `none→'FIGYELT PÁR'` (catalog pair without a row).
- `PatternFrame` gains an optional `pill` rendered in the `DetailFrame` head's right slot (instead of the „Minta részletei" eyebrow when present). If `DetailFrame` only takes `eyebrow: string`, extend it with an optional `aside?: ReactNode` prop that replaces the eyebrow — Prediction/Experiment pages keep passing `eyebrow` unchanged.
- `onDecide` when `pattern == null` (a catalog pair with no row): the hero must not render decision buttons at all — pass a `decidable` flag or let `decisionPlan` see `status === null` AND `pattern === null` → render no `.pmx-dec`. Implement as: in the page, pass `pattern`; in the hero, `if (!pattern) skip the decision block`.
- Diagnostics: keep the component as is, only the summary texts change; its `windowDays`/`lastComputedAt` stay caller-provided exactly as today (reflection: plan window + `pattern.lastDetectedAt`; catalog: `monitor.lookbackDays` + `monitor.lastRunAt`).

`PatternArtifactDetail` (plan-less saved insight, e.g. an old weekly AI hypothesis): same `pmx-hero` classes, no pair row; question = `patternHeadline(pattern.title)`; answer: `proposed` → „Mezo sejtése" (lav, `t-bulb`) with the three `patternDecisionButtons`; `confirmed` → „Csak megérzés" (lav, `t-bulb`) + sentence „Ez Mezo korábbi feltevése. Nincs mögötte mérhető adatpár, ezért nem tudom számolni: a te megerősítésed tartja életben." + quiet revoke link (`onDecide('reject')`); other statuses keep their existing `STATUS_META` copy as the sentence. The mechanism goes into a `.pmx-quote` with eyebrow `MIRE ÉPÜLT` (`patternPlainLine(pattern.mechanism)`); evidence list stays under it as today.

Mock data (`insights.ts`): add two details reachable through `mockPatternPairDetail` and referenced by a `patterns` row each (follow how `REFLECTION_KEY` is wired): (a) `ref-mock-gyulik` — reflection row `status: 'monitoring'`, plan `minN: 8`, pair `verdict: 'few_days', alignedDays: 5, missingDays: 3`, 5 days, one `observation` event with text „Az úszás napján estére lejjebb ment az energiád.\n\nA hosszú úszós napokon lejjebb megy az energiád estére?"; (b) `ref-mock-elvetve` — reflection row `status: 'rejected'`, pair `verdict: 'live', r: -0.04, n: 9`, 9 days.

Page tests (rewrite `PatternDetailPage.test.tsx`; keep the file's `renderAt` helper and the not-found / error / loading tests that still apply):
- showcase (`sleep-quality~next-day-training-rpe`, confirmed + frozen + 24 strongly negative days, catalog direction negative) → heading „Tartja magát", text „Bekerült a Tudástárba, Mezo számol vele.", no „Megerősítem"/„Elvetem" buttons, the revoke link present, `lean-then` present, sections „Mit mutat az adat", „A szabály", „Ami eddig történt", „Számok, ha érdekel".
- gathering catalog pair (`sleep-duration~next-day-training-rpe`, `few_days`, `pattern: null`) → heading „Még gyűjtöm", NO decision buttons (no row), the pips.
- weekend (`imbalanced_groups`) → heading „Még gyűjtöm", the group-balance sentence.
- reflection (`REFLECTION_KEY`, live r .52 n 16, binary, plan direction positive) → heading „Erős jel" when the row is `proposed` (or „Tartja magát" if the seeded row is confirmed — read `patterns` in `insights.ts` and assert the right one), recommended button lit.
- `ref-mock-gyulik` → „Még gyűjtöm", the observation quote's first paragraph visible, „Figyeljük tovább" button.
- `ref-mock-elvetve` → „Elvetetted", only „Mégis figyeljük".
- a click on „Elvetem" calls the decide mutation (keep the existing MSW-based decide test pattern if one exists in the file; otherwise assert the POST with `server.use(http.post(...))`).
- a dot tap inside the page shows the tooltip and the page's `.rise` hero element is the SAME DOM node before and after (no re-render of the hero): `const hero = screen.getByRole('heading', { level: 1 }); fireEvent.click(dot); expect(screen.getByRole('heading', { level: 1 })).toBe(hero)`.

CSS cleanup: for each of `.pdt-plan`, `.pdt-compare`, `.pdt-story`, `.pdt-core`, `.pdt-answer`, `.pdt-belief`, `.pdt-chart`, `.pdt-dot-`, `.pdt-median`, `.pdt-trend`, `.pdt-latest-ring`, `.pdt-group-label`, `.pdt-strength`, `.pdt-hypothesis`, `.pdt-days`: `grep -rn "<class>" frontend/src --include=*.tsx` → remove its rules from `prototype.css` only when no `.tsx` uses it any more.

- [ ] **Step 1:** rewrite `PatternDetailPage.test.tsx` + add the mock details → run `CI=true VITE_USE_MOCK=true pnpm exec vitest run src/features/insights/pages/PatternDetailPage.test.tsx` → FAIL.
- [ ] **Step 2:** implement the page, the artifact re-dress, the `DetailFrame` `aside` prop; delete the superseded files; fix every import the deletion breaks (`pnpm exec tsc -b` must be clean).
- [ ] **Step 3:** re-run the page test → PASS; run `CI=true VITE_USE_MOCK=true pnpm exec vitest run src/features/insights` → PASS.
- [ ] **Step 4:** CSS cleanup with the grep rule above; `pnpm build` clean.
- [ ] **Step 5:** commit `feat(insights): minta-részlet oldal újramesélve — egy olvasat, egy elrendezés (mezo-rstt7)`.

---

### Task 6: Gates, visual check, docs, merge

**Files:**
- Modify: `docs/features/insights.md` (the pattern-detail section: new anatomy, the reading states table, the lean band formula, revoke = decide(reject) and what it does NOT do, where the live r of a frozen row comes from)
- Regenerate: `docs/CODEMAP.md` (`node scripts/gen-codemap.mjs`)
- Modify: `docs/design_2.0/2026-09-23-uveg-style-bible.md` — append a short lesson under the appendix: "Minta részletei (mezo-rstt7): a chart answers 'how big', the meter answers 'does it count' — never a trend line; the tap tooltip lives in component state so a tap never re-runs the page's entrance."

- [ ] **Step 1:** `cd frontend && pnpm build && CI=true VITE_USE_MOCK=true pnpm test && CI=true VITE_USE_MOCK=false pnpm test` — both green (paste the summary lines).
- [ ] **Step 2:** `cd frontend && pnpm test:layout` (layout specs; 320 px width must not scroll sideways).
- [ ] **Step 3:** visual check in the in-app browser against `docs/design_2.0/prototypes/uveg-minta.html`: `VITE_USE_MOCK=true pnpm dev`, open `/mezo/patterns/sleep-quality~next-day-training-rpe`, `/mezo/patterns/sleep-duration~next-day-training-rpe`, `/mezo/patterns/weekend~late-meal-hour`, the reflection key, `ref-mock-gyulik`, `ref-mock-elvetve`; tap a dot (no re-entrance, scroll kept); 320 px width.
- [ ] **Step 4:** docs + `node scripts/gen-codemap.mjs` + `node scripts/lint-docs.mjs`.
- [ ] **Step 5:** commit `docs(insights): minta-részlet újramesélve (mezo-rstt7)`; then `git fetch origin main && git rebase origin/main` (regenerate CODEMAP again if it conflicts), re-run the FE gate if main moved, and merge per AGENTS.md: `git checkout --detach origin/main && git merge --no-ff feat/minta-reszlet-ujramesele && git push origin HEAD:main`; close `mezo-rstt7`; `node scripts/check-beads-backup.mjs --fix` and commit.
