import { weeklyLoad } from '@/features/train/logic/weeklyLoad'
import type { WeeklyAgendaDay } from '@/features/train/components/WeeklyDayRow'

type Day = Pick<WeeklyAgendaDay, 'gym' | 'sport' | 'running'>
const gym = (duration: number | null): Day['gym'] => ({ day: 'Hét', type: 'Push', time: '07:30', duration, active: true })
const vb = (duration: number): Day['sport'][number] => ({ day: 'Hét', time: '18:15', duration }) as unknown as Day['sport'][number]
const run = (kind: 'sprint' | 'pyramid'): Day['running'][number] => ({ key: `r-${kind}`, label: 'Futás', kind, rpeTarget: { min: 8, max: 9 } }) as unknown as Day['running'][number]
const day = (p: Partial<Day>): Day => ({ gym: null, sport: [], running: [], ...p })

test('summarizes the mockup week: 5 gym @75p, 4 röpi totaling 6,5h, 2 sprint runs', () => {
  const agenda: Day[] = [
    day({ gym: gym(75), sport: [vb(90)] }),
    day({ gym: gym(75), sport: [vb(90)], running: [run('sprint')] }),
    day({ gym: gym(75) }),
    day({ gym: gym(75), sport: [vb(90)], running: [run('sprint')] }),
    day({ gym: gym(75), sport: [vb(120)] }),
  ]
  expect(weeklyLoad(agenda)).toEqual([
    { kind: 'gym', label: 'Gym', icon: '🏋️', value: '5× · 75p' },
    { kind: 'sport', label: 'Röplabda', icon: '🏐', value: '4× · 6,5h' },
    { kind: 'run', label: 'Futás', icon: '🏃', value: '2× · sprint' },
  ])
})

test('omits absent modalities and formats whole hours without a decimal', () => {
  const tiles = weeklyLoad([day({ sport: [vb(60)] }), day({ sport: [vb(60)] })])
  expect(tiles).toEqual([{ kind: 'sport', label: 'Röplabda', icon: '🏐', value: '2× · 2h' }])
})

test('gym without durations falls back to the bare count and empty week yields no tiles', () => {
  expect(weeklyLoad([day({ gym: gym(null) })])).toEqual([
    { kind: 'gym', label: 'Gym', icon: '🏋️', value: '1×' },
  ])
  expect(weeklyLoad([day({}), day({})])).toEqual([])
})

test('mixed sports produce one tile per kind', () => {
  const tiles = weeklyLoad([
    { gym: null, running: [], sport: [{ duration: 60, sport: 'trx' } as never, { duration: 90 } as never] },
    { gym: null, running: [], sport: [{ duration: 60, sport: 'trx' } as never] },
  ])
  expect(tiles.map((t) => t.label)).toEqual(['Röplabda', 'TRX'])
  expect(tiles.find((t) => t.label === 'TRX')!.value).toBe('2× · 2h')
})
