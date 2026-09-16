// libraryStory.test.ts
import { describe, expect, test } from 'vitest'
import { runStars, templateRuns, templateStory, templateUseLine, templateWeekSets } from '@/features/train/logic/libraryStory'
import { starsFor } from '@/features/train/logic/cerScore'
import type { GymExercise, MesoDay, MesoTemplate, Mesocycle } from '@/data/types'

const meso = (over: Partial<Mesocycle> & Pick<Mesocycle, 'id' | 'status'>): Mesocycle => ({
  title: 'T',
  shortTitle: 'T',
  goal: '',
  startDate: '2026-01-01',
  endDate: '2026-02-01',
  weeks: 6,
  currentWeek: 1,
  split: 'Pull / Push / Legs · 5×/hét',
  style: 'RP · 6 hét',
  phaseCurve: [],
  ...over,
})

describe('runStars', () => {
  test('null completion -> null', () => {
    expect(runStars(null)).toBeNull()
  })

  test('0% -> 0 stars, "Ez a futam nem indult el."', () => {
    const r = runStars(0)
    expect(r).not.toBeNull()
    expect(r!.share).toBe(0)
    expect(r!.stars).toBe(starsFor(0))
    expect(r!.say).toBe('Ez a futam nem indult el.')
  })

  test('49% -> below-half say, halves stars from starsFor', () => {
    const r = runStars(49)!
    expect(r.share).toBeCloseTo(0.49)
    expect(r.stars).toBe(starsFor(0.49))
    expect(r.say).toBe('Elindult, aztán másfelé vitt az élet.')
  })

  test('50% -> "A nagyobb fele megvan."', () => {
    const r = runStars(50)!
    expect(r.say).toBe('A nagyobb fele megvan.')
  })

  test('75% -> "Erős futam volt."', () => {
    const r = runStars(75)!
    expect(r.say).toBe('Erős futam volt.')
  })

  test('95% -> "Végigvitted."', () => {
    const r = runStars(95)!
    expect(r.share).toBeCloseTo(0.95)
    expect(r.stars).toBe(starsFor(0.95))
    expect(r.say).toBe('Végigvitted.')
  })

  test('100% -> "Végigvitted.", full stars', () => {
    const r = runStars(100)!
    expect(r.share).toBe(1)
    expect(r.stars).toBe(5)
    expect(r.say).toBe('Végigvitted.')
  })
})

describe('templateStory', () => {
  test('empty mesocycle list -> all zero/false', () => {
    const s = templateStory('tpl-1', 'Erő blokk', [])
    expect(s).toEqual({ activeNow: false, plannedCount: 0, closedCount: 0 })
  })

  test('matches by templateId when the run carries one, even if the name differs', () => {
    const mesocycles: Mesocycle[] = [
      meso({ id: 'r1', status: 'active', templateId: 'tpl-1', title: 'Renamed run' }),
      meso({ id: 'r2', status: 'planned', templateId: 'tpl-2', title: 'Erő blokk' }), // different template, same name — must NOT count
    ]
    const s = templateStory('tpl-1', 'Erő blokk', mesocycles)
    expect(s).toEqual({ activeNow: true, plannedCount: 0, closedCount: 0 })
  })

  test('falls back to name matching only for runs with no templateId', () => {
    const mesocycles: Mesocycle[] = [
      meso({ id: 'r1', status: 'planned', templateId: null, title: 'Erő blokk' }),
      meso({ id: 'r2', status: 'planned', templateId: null, shortTitle: 'Erő blokk', title: 'Full name differs' }),
      meso({ id: 'r3', status: 'planned', templateId: null, title: 'Something else entirely' }),
    ]
    const s = templateStory('tpl-1', 'Erő blokk', mesocycles)
    expect(s.plannedCount).toBe(2)
    expect(s.activeNow).toBe(false)
  })

  test('counts activeNow / plannedCount / closedCount independently', () => {
    const mesocycles: Mesocycle[] = [
      meso({ id: 'r1', status: 'active', templateId: 'tpl-1' }),
      meso({ id: 'r2', status: 'planned', templateId: 'tpl-1' }),
      meso({ id: 'r3', status: 'planned', templateId: 'tpl-1' }),
      meso({ id: 'r4', status: 'archived', templateId: 'tpl-1', closedAt: '2026-03-01' }),
      meso({ id: 'r5', status: 'archived', templateId: 'tpl-1', closedAt: '2026-04-01' }),
      meso({ id: 'r6', status: 'active', templateId: 'other-tpl' }),
    ]
    const s = templateStory('tpl-1', 'Erő blokk', mesocycles)
    expect(s).toEqual({ activeNow: true, plannedCount: 2, closedCount: 2 })
  })

  test('no active run from this template -> activeNow false', () => {
    const mesocycles: Mesocycle[] = [
      meso({ id: 'r1', status: 'planned', templateId: 'tpl-1' }),
      meso({ id: 'r2', status: 'archived', templateId: 'tpl-1', closedAt: '2026-03-01' }),
    ]
    const s = templateStory('tpl-1', 'Erő blokk', mesocycles)
    expect(s.activeNow).toBe(false)
  })
})

// --- templateRuns / templateUseLine / templateWeekSets (T10 Task 3) ---------------

const gx = (over: Partial<GymExercise> & Pick<GymExercise, 'muscle' | 'workingSets'>): GymExercise => ({
  id: `x-${over.muscle}-${over.workingSets}`,
  name: 'Gyakorlat',
  warmupSets: 2,
  repMin: 8,
  repMax: 10,
  targetRIR: 1,
  type: 'compound',
  ...over,
})

const tplDay = (day: string, muscle: string, exercises: GymExercise[]): MesoDay => ({
  day, type: muscle === '' ? 'Rest' : 'Edzés', muscle, exerciseCount: exercises.length, exercises,
})

const tpl = (over: Partial<MesoTemplate> = {}): MesoTemplate => ({
  id: 'tpl-1',
  title: 'Erő blokk',
  shortTitle: null,
  goal: null,
  weeks: 5,
  split: 'Upper / Lower · 4×/hét',
  style: null,
  phaseCurve: [],
  notes: null,
  volumePerMuscle: null,
  days: [],
  runCount: 0,
  ...over,
})

describe('templateRuns', () => {
  test('splits the matched runs into active / planned / closed, and ignores other templates', () => {
    const mesocycles: Mesocycle[] = [
      meso({ id: 'r1', status: 'active', templateId: 'tpl-1' }),
      meso({ id: 'r2', status: 'planned', templateId: 'tpl-1' }),
      meso({ id: 'r3', status: 'archived', templateId: 'tpl-1' }),
      meso({ id: 'r4', status: 'archived', templateId: 'tpl-1' }),
      meso({ id: 'r5', status: 'active', templateId: 'other' }),
    ]
    const runs = templateRuns('tpl-1', 'Erő blokk', mesocycles)
    expect(runs.active?.id).toBe('r1')
    expect(runs.planned.map((m) => m.id)).toEqual(['r2'])
    expect(runs.closed.map((m) => m.id)).toEqual(['r3', 'r4'])
  })

  test('no match at all -> null active and two empty lists', () => {
    expect(templateRuns('tpl-1', 'Erő blokk', [])).toEqual({ active: null, planned: [], closed: [] })
  })

  test('templateStory is the count of exactly these runs', () => {
    const mesocycles: Mesocycle[] = [
      meso({ id: 'r1', status: 'active', templateId: 'tpl-1' }),
      meso({ id: 'r2', status: 'planned', templateId: 'tpl-1' }),
      meso({ id: 'r3', status: 'archived', templateId: 'tpl-1' }),
    ]
    const runs = templateRuns('tpl-1', 'Erő blokk', mesocycles)
    const story = templateStory('tpl-1', 'Erő blokk', mesocycles)
    expect(story).toEqual({
      activeNow: runs.active !== null,
      plannedCount: runs.planned.length,
      closedCount: runs.closed.length,
    })
  })
})

describe('templateUseLine', () => {
  test.each([
    [{ activeNow: true, plannedCount: 0, closedCount: 3 }, 0, 'Ebből fut a mostani terved'],
    [{ activeNow: true, plannedCount: 2, closedCount: 0 }, 0, 'Ebből fut a mostani terved'],
    [{ activeNow: false, plannedCount: 0, closedCount: 1 }, 1, '1 lezárt futam jött ki belőle'],
    [{ activeNow: false, plannedCount: 1, closedCount: 4 }, 5, '4 lezárt futam jött ki belőle'],
    // a queued run has not happened yet — it must never read as a run that did
    [{ activeNow: false, plannedCount: 2, closedCount: 0 }, 0, 'Még nem indítottál belőle'],
    [{ activeNow: false, plannedCount: 0, closedCount: 0 }, 0, 'Még nem indítottál belőle'],
  ] as const)('%j runCount=%s -> %s', (story, runCount, line) => {
    expect(templateUseLine(story, runCount)).toBe(line)
  })

  // fix round (mezo-88iwa.11): the name-match `story` can miss a run the template's own
  // runCount already counts (a legacy/renamed run, a race with the mesocycle list) — the
  // "none yet" branch must never fire when the template's own count says otherwise.
  test('the negative claim is guarded by the template\'s own runCount, not just the name-match story', () => {
    const story = { activeNow: false, plannedCount: 0, closedCount: 0 }
    expect(templateUseLine(story, 2)).toBe('2 futam indult belőle')
    expect(templateUseLine(story, 0)).toBe('Még nem indítottál belőle')
  })
})

describe('templateWeekSets', () => {
  test('sums working sets per coarse group across the whole week, sorted by sets desc', () => {
    const t = tpl({
      days: [
        tplDay('Hét', 'chest', [gx({ muscle: 'chest-mid', workingSets: 4 }), gx({ muscle: 'back-mid', workingSets: 3 })]),
        tplDay('Kedd', 'quad', [gx({ muscle: 'quad', workingSets: 4 })]),
        tplDay('Sze', '', []),
        tplDay('Csü', 'back', [gx({ muscle: 'back-wide', workingSets: 3 }), gx({ muscle: 'chest-upper', workingSets: 2 })]),
      ],
    })
    expect(templateWeekSets(t)).toEqual([
      { group: 'back', label: 'Hát', colorMuscle: 'back-mid', sets: 6 },
      { group: 'chest', label: 'Mell', colorMuscle: 'chest-mid', sets: 6 },
      { group: 'quad', label: 'Comb', colorMuscle: 'quad', sets: 4 },
    ])
  })

  test('a template with no days (or only rest days) yields no bars', () => {
    expect(templateWeekSets(tpl({ days: [] }))).toEqual([])
    expect(templateWeekSets(tpl({ days: [tplDay('Sze', '', []), tplDay('Vas', '', [])] }))).toEqual([])
  })

  test('work outside the hypertrophy budget does not draw a bar', () => {
    const t = tpl({
      days: [
        tplDay('Hét', 'core', [
          gx({ muscle: 'core', workingSets: 3, countsTowardVolume: false }),
          gx({ muscle: 'chest-mid', workingSets: 2 }),
        ]),
      ],
    })
    expect(templateWeekSets(t)).toEqual([{ group: 'chest', label: 'Mell', colorMuscle: 'chest-mid', sets: 2 }])
  })
})
