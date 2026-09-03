// Day evaluation (mezo-jcpt.4) — the day page's `GET /api/me/day/{date}/evaluation` read.
// Re-exports Task 7's generated types (api.gen.ts) and narrows their `string`-typed
// state/status/kind fields to the literal unions the backend actually sends (the generated
// TS types describe the wire shape, not the enum — see the OpenAPI doc comments in
// api.gen.ts's `DayEvaluationResponse`/`DayDimension`). Also carries the deterministic mock
// builder (four named scenarios, one per honest day state minus `empty`) for
// `dayEvaluationHooks.ts`'s mock branch.
import type { components } from '@/data/_client/api.gen'
import type { DayDimensionKey } from '@/features/me/logic/weekDay'

/** The generated wire shape — optional arrays/fields, `string`-typed enums. Use
 *  `normalizeDayEvaluation` to get a fully-populated, narrowly-typed shape instead. */
export type DayEvaluationResponse = components['schemas']['DayEvaluationResponse']
export type DayDimension = components['schemas']['DayDimension']

/** `state`'s five honest values (constraints.md/task-9 brief) — narrower than the generated
 *  `string`. */
export type DayEvalState = 'scored' | 'in_progress' | 'thin' | 'empty' | 'future'
/** `DayDimension.status`'s three values. */
export type DimensionStatus = 'DONE' | 'IN_PROGRESS' | 'NO_DATA'
/** `highlights[].kind`'s three values. */
export type HighlightKind = 'key' | 'pattern' | 'win'

export interface NormalizedDayDimension {
  id: DayDimensionKey
  label: string
  weight: number
  score: number | null
  status: DimensionStatus
  facts: { label: string; value: string }[]
  note: string | null
}

export interface NormalizedDayEvaluation {
  date: string
  state: DayEvalState
  score: number | null
  base: number | null
  adjustment: { delta: number; reason: string } | null
  narrative: string[]
  highlights: { kind: HighlightKind; label: string }[]
  context: { label: string; value: string }[]
  dimensions: NormalizedDayDimension[]
}

/** Fills in the generated type's optional arrays/fields (`narrative`, `highlights`, `context`,
 *  per-dimension `facts`/`note`) so a consumer never has to `?? []`/`?? null` itself, and
 *  narrows the `string`-typed enum fields to their literal unions.
 *
 *  No production caller yet — `useDayEvaluation` returns the raw `DayEvaluationResponse` per
 *  its own brief-specified signature; this is here for Task 10 (the day page) to call when it
 *  wants the fully-populated/narrowed shape instead of handling the generated type's optional
 *  fields itself. Covered by `dayEvaluation.test.ts` in the meantime. */
export function normalizeDayEvaluation(raw: DayEvaluationResponse): NormalizedDayEvaluation {
  return {
    date: raw.date,
    state: raw.state as DayEvalState,
    score: raw.score ?? null,
    base: raw.base ?? null,
    adjustment: raw.adjustment ?? null,
    narrative: raw.narrative ?? [],
    highlights: (raw.highlights ?? []).map((h) => ({ kind: h.kind as HighlightKind, label: h.label })),
    context: raw.context ?? [],
    dimensions: raw.dimensions.map((d) => ({
      id: d.id as DayDimensionKey,
      label: d.label,
      weight: d.weight,
      score: d.score ?? null,
      status: d.status as DimensionStatus,
      facts: d.facts ?? [],
      note: d.note ?? null,
    })),
  }
}

// ── Mock builder — four named scenarios ────────────────────────────────────────
// Same demo week as `meWeek.ts`'s seed (Monday 2026-05-18) so a browsed mock week's days line
// up with these dates. `empty` is deliberately not one of the four — the brief asks for
// scored/in_progress/thin/future only.

export const mockDayEvaluationDates = {
  scored: '2026-05-18',
  inProgress: '2026-05-21',
  thin: '2026-05-22',
  future: '2026-05-25',
} as const

const SCORED_DIMENSIONS: DayDimension[] = [
  {
    id: 'nutrition', label: 'Táplálkozás', weight: 0.30, score: 82, status: 'DONE',
    facts: [{ label: 'fehérje', value: '205g / 220g cél' }, { label: 'kalória', value: '2 980 kcal' }],
    note: 'A fehérjecélt majdnem hoztad, a kalória is célban volt.',
  },
  {
    id: 'quality', label: 'Minőség', weight: 0.15, score: 75, status: 'DONE',
    facts: [{ label: 'zöldség', value: '4 adag' }, { label: 'feldolgozott étel', value: 'alacsony' }],
    note: 'A tányérod minősége stabil volt egész nap.',
  },
  {
    id: 'training', label: 'Edzés', weight: 0.20, score: 88, status: 'DONE',
    facts: [{ label: 'edzés', value: '1× erő, 62 perc' }, { label: 'lépés', value: '9 400' }],
    note: 'Erős edzésnap, jó intenzitással.',
  },
  {
    id: 'sleep', label: 'Alvás', weight: 0.15, score: 80, status: 'DONE',
    facts: [{ label: 'alvásidő', value: '7ó 25p' }, { label: 'minőség', value: '7/10' }],
    note: 'Jó alvás, a szokásosnál kicsit hosszabb.',
  },
  {
    id: 'logging', label: 'Logolás', weight: 0.10, score: 90, status: 'DONE',
    facts: [{ label: 'bejegyzések', value: '4 check-in' }, { label: 'lefedettség', value: 'teljes nap' }],
    note: 'Mindent logoltál, semmi nem maradt ki.',
  },
  {
    id: 'rhythm', label: 'Ritmus', weight: 0.10, score: 70, status: 'DONE',
    facts: [{ label: 'étkezési ablak', value: '11 óra' }, { label: 'lefekvés', value: 'stabil' }],
    note: 'A napi ritmusod a hét átlagához közeli volt.',
  },
]

const SCORED_SEED: DayEvaluationResponse = {
  date: mockDayEvaluationDates.scored,
  state: 'scored',
  score: 78,
  base: 75,
  adjustment: { delta: 3, reason: 'Következetes napi ritmus és jó regeneráció miatt +3 korrekció.' },
  narrative: [
    'Hétfőn erős napot zártál: a fehérjecélt majdnem elérted, és az edzésed is jó intenzitással ment.',
    'A tányérod minősége és a napi ritmusod egyaránt stabil volt — ez tartja a heti lendületet.',
    'A logolásod teljes volt, így a Mezo minden területről tudott adatot venni ehhez a naphoz.',
  ],
  highlights: [
    { kind: 'win', label: 'Teljes napi logolás' },
    { kind: 'pattern', label: 'Edzésnapon jobb az alvásod' },
    { kind: 'key', label: 'A fehérjecél tartása húzza fel a tápanyag-pontszámot' },
  ],
  context: [{ label: 'nap típusa', value: 'edzésnap' }, { label: 'előző nap pontszáma', value: '74' }],
  dimensions: SCORED_DIMENSIONS,
}

const IN_PROGRESS_SEED: DayEvaluationResponse = {
  date: mockDayEvaluationDates.inProgress,
  state: 'in_progress',
  score: null,
  base: null,
  adjustment: null,
  narrative: [],
  highlights: [],
  context: [],
  dimensions: [
    { id: 'nutrition', label: 'Táplálkozás', weight: 0, score: null, status: 'NO_DATA', facts: [], note: null },
    { id: 'quality', label: 'Minőség', weight: 0, score: null, status: 'NO_DATA', facts: [], note: null },
    {
      id: 'training', label: 'Edzés', weight: 0.20 / 0.35, score: 85, status: 'DONE',
      facts: [{ label: 'edzés', value: '1× kardió, 40 perc' }], note: null,
    },
    {
      id: 'sleep', label: 'Alvás', weight: 0.15 / 0.35, score: 72, status: 'DONE',
      facts: [{ label: 'alvásidő', value: '6ó 38p' }], note: null,
    },
    { id: 'logging', label: 'Logolás', weight: 0, score: null, status: 'IN_PROGRESS', facts: [], note: null },
    { id: 'rhythm', label: 'Ritmus', weight: 0, score: null, status: 'NO_DATA', facts: [], note: null },
  ],
}

const THIN_SEED: DayEvaluationResponse = {
  date: mockDayEvaluationDates.thin,
  state: 'thin',
  score: null,
  base: null,
  adjustment: null,
  narrative: [],
  highlights: [],
  context: [],
  dimensions: [
    { id: 'nutrition', label: 'Táplálkozás', weight: 0, score: null, status: 'NO_DATA', facts: [], note: null },
    { id: 'quality', label: 'Minőség', weight: 0, score: null, status: 'NO_DATA', facts: [], note: null },
    { id: 'training', label: 'Edzés', weight: 0, score: null, status: 'NO_DATA', facts: [], note: null },
    { id: 'sleep', label: 'Alvás', weight: 0, score: null, status: 'NO_DATA', facts: [], note: null },
    {
      id: 'logging', label: 'Logolás', weight: 1, score: 60, status: 'DONE',
      facts: [{ label: 'bejegyzések', value: '1 check-in' }], note: null,
    },
    { id: 'rhythm', label: 'Ritmus', weight: 0, score: null, status: 'NO_DATA', facts: [], note: null },
  ],
}

const FUTURE_SEED: DayEvaluationResponse = {
  date: mockDayEvaluationDates.future,
  state: 'future',
  score: null,
  base: null,
  adjustment: null,
  narrative: [],
  highlights: [],
  context: [],
  dimensions: [
    { id: 'nutrition', label: 'Táplálkozás', weight: 0, score: null, status: 'NO_DATA', facts: [], note: null },
    { id: 'quality', label: 'Minőség', weight: 0, score: null, status: 'NO_DATA', facts: [], note: null },
    { id: 'training', label: 'Edzés', weight: 0, score: null, status: 'NO_DATA', facts: [], note: null },
    { id: 'sleep', label: 'Alvás', weight: 0, score: null, status: 'NO_DATA', facts: [], note: null },
    { id: 'logging', label: 'Logolás', weight: 0, score: null, status: 'NO_DATA', facts: [], note: null },
    { id: 'rhythm', label: 'Ritmus', weight: 0, score: null, status: 'NO_DATA', facts: [], note: null },
  ],
}

/** `dateIso` → one of the four named fixtures re-dated, or (any other date) the SCORED fixture
 *  re-dated — the same "any requested date gets a plausible re-dated seed" idiom `mockMeWeek`
 *  uses, so the mock day page stays functional when browsing dates outside the four named ones. */
export function mockDayEvaluation(dateIso: string): DayEvaluationResponse {
  if (dateIso === mockDayEvaluationDates.inProgress) return { ...IN_PROGRESS_SEED, date: dateIso }
  if (dateIso === mockDayEvaluationDates.thin) return { ...THIN_SEED, date: dateIso }
  if (dateIso === mockDayEvaluationDates.future) return { ...FUTURE_SEED, date: dateIso }
  return { ...SCORED_SEED, date: dateIso }
}
