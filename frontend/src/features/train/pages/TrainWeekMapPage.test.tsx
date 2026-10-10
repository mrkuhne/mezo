import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { TrainWeekMapPage } from '@/features/train/pages/TrainWeekMapPage'
import { QueryWrapper } from '@/test/queryWrapper'
import type { MesoDay } from '@/data/types'
import type { WorkoutDetailResponse } from '@/data/train/trainApi'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// Mirrors TrainWeekPage.test.tsx's override rig — the mock-empty-plan test needs a week
// with NO plan at all, and the all-touched test needs a completed log the stock mock meso
// never produces on its own.
let daysOverride: MesoDay[] | null = null
let weekLogOverride: WorkoutDetailResponse[] | null = null
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useTrain: (...args: Parameters<typeof actual.useTrain>) => {
      const real = actual.useTrain(...args)
      if (!daysOverride) return real
      return { ...real, activeMeso: real.activeMeso ? { ...real.activeMeso, days: daysOverride } : real.activeMeso }
    },
    useWeekMuscleLog: (...args: Parameters<typeof actual.useWeekMuscleLog>) => {
      const real = actual.useWeekMuscleLog(...args)
      return weekLogOverride ? { ...real, details: weekLogOverride } : real
    },
  }
})

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-05-21T09:00:00'))
  vi.stubEnv('VITE_USE_MOCK', 'true')
  mockNavigate.mockReset()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  daysOverride = null
  weekLogOverride = null
})

const renderPage = () => render(<QueryWrapper><MemoryRouter><TrainWeekMapPage /></MemoryRouter></QueryWrapper>)

test('renders the Izomtérkép hero with its verdict and the page’s own back pill', async () => {
  const { container } = renderPage()
  await screen.findByText('Izomtérkép · eddig megvolt')
  const hero = container.querySelector('.fo-hero') as HTMLElement
  expect(within(hero).getByText(/^\d+ izomcsoport még munkára vár ezen a héten\.$/)).toHaveClass('fo-hero-verdict')
  expect(within(hero).getByText('Amit már megmozgattál, sötétebben telik — ami még vár, az halvány marad.')).toBeInTheDocument()
  // rendered alone (no title bar) the page keeps its own back control: history, else Terhelés
  const back = screen.getByRole('button', { name: /Terhelés/ })
  expect(back).toHaveClass('et-back')
  fireEvent.click(back)
  expect(mockNavigate).toHaveBeenCalledWith('/train/week')
})

test('the mode switch re-pours the SAME body with different heat, never re-derives from scratch', async () => {
  const { container } = renderPage()
  const map = () => container.querySelector('.et-maphero .et-map') as HTMLElement
  await waitFor(() => expect(map().querySelectorAll('[data-shape]').length).toBeGreaterThan(0))
  expect(map().dataset.mode).toBe('done')
  const before = map().dataset.heat
  // nothing is logged in the mock week: the plan stands pale, no deep liquid anywhere
  expect(map().querySelectorAll('.pl').length).toBeGreaterThan(0)
  expect(map().querySelectorAll('.dn')).toHaveLength(0)

  fireEvent.click(screen.getByRole('button', { name: 'A heti terv' }))
  await waitFor(() => expect(map().dataset.heat).not.toEqual(before))
  expect(map().dataset.mode).toBe('planned')
  expect(screen.getByRole('button', { name: 'A heti terv' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText('Izomtérkép · a heti terv')).toBeInTheDocument()
  expect(screen.getByText(/^\d+ szettet kér tőled ez a hét\.$/)).toBeInTheDocument()
  // switching mode never touches the figure itself — still one body pair, both views.
  expect(container.querySelectorAll('.et-maphero .ex-duo.xl')).toHaveLength(1)
  expect(container.querySelectorAll('.et-maphero .ex-body')).toHaveLength(2)
})

// The key under the body is drawn from the REAL levels: every group with its done/planned
// sets and the word of the level the live logic gave it; the note names the four words.
test('the key names every group with its sets and the word of its real level in "Eddig megvolt" mode', () => {
  const { container } = renderPage()
  const key = container.querySelector('.et-key') as HTMLElement
  const items = [...key.querySelectorAll(':scope > span')]
  expect(items.length).toBeGreaterThan(0)
  // the mock week has nothing logged: every group is still waiting
  for (const it of items) expect(it.textContent).toMatch(/^.+ 0\/\d+ még vár$/)
  expect(screen.getByText('Négy állapot: még vár · elkezdted · jó úton · megvan. A szín az izomcsoporté, nem ítélet.')).toBeInTheDocument()
})

test('a logged group reads its real level in the key, and its muscle stands deep on the body', async () => {
  weekLogOverride = [{
    id: 'w-1', templateSessionId: 'ts-1', date: '2026-05-20', status: 'completed',
    title: 'Push', dayLabel: 'Hét',
    exercises: [{
      exerciseId: 'e-1', name: 'Bench', muscle: 'chest-mid', type: 'compound',
      warmupSets: 0, workingSets: 1, repMin: 8, repMax: 10, targetRIR: 2, skipped: false,
      sets: [{ id: 's1', exerciseId: 'e-1', setIndex: 0, reps: 8, rir: 2, skipped: false, kind: 'working' }],
    }],
  }] as unknown as WorkoutDetailResponse[]
  const { container } = renderPage()
  const key = container.querySelector('.et-key') as HTMLElement
  // one set of chest is below the floor: „elkezdted", never „jó úton"
  expect([...key.querySelectorAll(':scope > span')].find((x) => x.textContent?.startsWith('Mell'))!.textContent).toMatch(/^Mell 1\/\d+ elkezdted$/)
  const map = container.querySelector('.et-maphero .et-map') as HTMLElement
  expect(map.dataset.heat).toMatch(/:below/)
  await waitFor(() => expect(map.querySelectorAll('.dn').length).toBeGreaterThan(0))
})

test('"A heti terv" mode swaps in its own key and line, not the level words', () => {
  const { container } = renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'A heti terv' }))
  expect(screen.getByText('Minél többet kér a hét, annál teltebb az izom.')).toBeInTheDocument()
  expect(screen.queryByText(/még vár/)).toBeNull()
  for (const it of container.querySelectorAll('.et-key > span')) expect(it.textContent).toMatch(/^.+ \d+$/)
})

test('mock-empty honesty: the untouched list names the planned-but-untouched groups', () => {
  const { container } = renderPage()
  expect(screen.getByRole('heading', { name: /Még munkára vár/ })).toBeInTheDocument()
  const rows = [...container.querySelectorAll('.et-wait .fo-row')]
  expect(rows.length).toBeGreaterThan(0)
  for (const row of rows) {
    expect(row.textContent).toMatch(/\d+ szett vár a héten$/)
    expect(row.querySelector('.ex-mchp')).not.toBeNull()
  }
})

// A week with NO plan at all must not fabricate either the "minden sorra került" claim
// (nothing has been "reached" when nothing was ever asked) or an empty untouched list.
test('mock-empty honesty: a week with no plan at all shows neither the wait list nor a false "all reached" claim', () => {
  daysOverride = []
  renderPage()
  expect(screen.queryByText('Még munkára vár')).toBeNull()
  expect(screen.queryByText('Minden izomcsoportod sorra került ezen a héten.')).toBeNull()
  expect(screen.getByText('Ezen a héten még nincs betervezett szett.')).toHaveClass('fo-hero-verdict')
})

test('a week with every planned group already touched says so, honestly', () => {
  daysOverride = [{
    day: 'Hét', type: 'Push', muscle: 'chest', exerciseCount: 1,
    exercises: [{ id: 'e-1', name: 'Bench', muscle: 'chest', warmupSets: 0, workingSets: 2, repMin: 8, repMax: 10, targetRIR: 2, type: 'compound' }],
  }]
  // untouchedMuscles only cares whether ANY work landed (doneSets===0) — one logged set on
  // the plan's one group is enough to clear it off the waiting list honestly.
  weekLogOverride = [{
    id: 'w-1', templateSessionId: 'ts-1', date: '2026-05-20', status: 'completed',
    title: 'Push', dayLabel: 'Hét',
    exercises: [{
      exerciseId: 'e-1', name: 'Bench', muscle: 'chest', type: 'compound',
      warmupSets: 0, workingSets: 1, repMin: 8, repMax: 10, targetRIR: 2, skipped: false,
      sets: [{ id: 's1', exerciseId: 'e-1', setIndex: 0, reps: 8, rir: 2, skipped: false, kind: 'working' }],
    }],
  }] as unknown as WorkoutDetailResponse[]
  const { container } = renderPage()
  // the hero says it, and the section keeps its place with the same sentence instead of rows
  const said = screen.getAllByText('Minden izomcsoportod sorra került ezen a héten.')
  expect(said).toHaveLength(2)
  expect(said[0]).toHaveClass('fo-hero-verdict')
  expect(container.querySelectorAll('.et-wait .fo-row')).toHaveLength(0)
  expect(container.querySelector('.et-wait .fo-txt')).not.toBeNull()
})

test('the sport-reach row names the touched muscles and labels itself an estimate', () => {
  renderPage()
  expect(screen.getByRole('heading', { name: /A sport is dolgozott/ })).toBeInTheDocument()
  expect(screen.getByText(/A sport ezeket is dolgoztatta/)).toBeInTheDocument()
  expect(screen.getByText('Becslés, nem mérés — a szettszámokba nem számít bele.')).toBeInTheDocument()
})

// The doorway to the „Minden izomjel" screen: the last section's one row.
test('the doorway to „Minden izomjel" carries the prototype copy and routes there', () => {
  renderPage()
  expect(screen.getByRole('heading', { name: /Mélyebben/ })).toBeInTheDocument()
  const row = screen.getByRole('button', { name: /Minden izomjel/ })
  expect(row).toHaveClass('fo-row')
  expect(within(row).getByText('A 21 izom, saját jellel, régiónként')).toBeInTheDocument()
  expect(row.querySelector('use')?.getAttribute('href')).toBe('#t-pattern')
  fireEvent.click(row)
  expect(mockNavigate).toHaveBeenCalledWith('/train/week/jelek')
})

test('the sections are numbered in order, each followed by its card', () => {
  const { container } = renderPage()
  const heads = [...container.querySelectorAll('.fo-page > .fo-sec')]
  expect(heads.map((h) => h.textContent)).toEqual(['1Még munkára vár', '2A sport is dolgozott', '3Mélyebben'])
  for (const h of heads) expect(h.nextElementSibling!.classList.contains('fo-card')).toBe(true)
})

// ── the explain layer (mezo-b516k, Task 2) ─────────────────────────────────────────────
// The hero's one text link (the prototype's `info` sheet, arg `terkep`); the accessible name
// stays `"<title> — mit jelent?"`.

test('the hero link explains what the map is drawn from, word for word', async () => {
  renderPage()
  const btn = await screen.findByRole('button', { name: 'Miből rajzoljuk? — mit jelent?' })
  expect(btn.closest('.fo-hero-acts')).not.toBeNull()
  fireEvent.click(btn)
  expect(
    within(screen.getByRole('dialog', { name: 'Miből rajzoljuk?' })).getByText(
      'A futó terved e heti szettjeiből: minden izom annyira telik, amennyi a heti munkájából már megvan. A terv nézet azt festi fel, mit kér a hét — ott a teltebb izom többet kérő izmot jelent.',
    ),
  ).toBeInTheDocument()
})

test('folyadék: no old load classes, no glow map — the body is the liquid vessel', () => {
  const { container } = renderPage()
  expect(container.querySelector('[class*="ld-"], [class*="tw-"], .pl-row, .segtabs, .mz-page, .glass, .body-map')).toBeNull()
})
