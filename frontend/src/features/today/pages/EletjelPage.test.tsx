import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { EletjelPage } from '@/features/today/pages/EletjelPage'
import { NapHubPage } from '@/features/today/pages/NapHubPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { ToastProvider } from '@/shared/ui/ToastProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { bandOf, type NeedKey, type NeedState } from '@/features/today/logic/needs'

// Életjel detail page (mezo-d20.2.6) — prototype nap-body.html #page-vital: p-rose tone,
// hero with the SEGMENTED six-arc ring + big average %, then SIX need tiles (eyebrow +
// clay icon + mini ring + %). CTA per tile = the same dispatch TodayPage's onNeedCta does.

// Mode-agnostic stubs: useNeeds composes ~14 reads whose mock seeds and real-mode MSW
// fixtures differ, so the page's ONE state source is stubbed at the logic-hook seam
// (the QuickInputSheet.test idiom, one seam up). Pcts mirror the prototype demo values
// so the asserted average is the prototype's 58%.
const PCTS = vi.hoisted(() => ({
  energia: 72, hidratacio: 43, pihenes: 88, mozgas: 30, lelek: 60, rend: 55,
} as Record<string, number>))
const needsCtl = vi.hoisted(() => ({ isPending: false }))
vi.mock('@/features/today/logic/useNeeds', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/today/logic/useNeeds')>()
  const { NEED_META, bandOf: band } = await import('@/features/today/logic/needs')
  const states = (Object.keys(PCTS) as NeedKey[]).map((key): NeedState => ({
    key,
    emoji: NEED_META[key].emoji,
    label: NEED_META[key].label,
    color: NEED_META[key].color,
    pct: PCTS[key],
    ratePerHour: 5,
    zeroAt: null,
    band: band(PCTS[key]),
    lastFill: null,
    todayFills: [],
  }))
  return { ...actual, useNeeds: () => ({ states, isPending: needsCtl.isPending }) }
})

const logWaterSpy = vi.hoisted(() => vi.fn())
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useWaterActions: () => ({ logWater: logWaterSpy }),
    useSleep: () => ({ sleepLog: [], lastNight: null, logSleep: vi.fn() }),
    useCheckins: () => ({
      checkins: [{ time: '09:00', state: 'due', values: null, note: null }],
      saveCheckIn: vi.fn(),
    }),
  }
})

// The absorbed log surfaces stay the existing sheets — stubbed to markers here so the
// dispatch assertions don't drag the whole fuel/me data layer into this page's test.
vi.mock('@/features/fuel/pages/LogFlowPage', () => ({ LogFlowPage: () => <div>meal-sheet-stub</div> }))
vi.mock('@/features/me/sheets/SleepLogSheet', () => ({ SleepLogSheet: () => <div>sleep-sheet-stub</div> }))
vi.mock('@/features/today/sheets/CheckInSheet', () => ({ CheckInSheet: () => <div>checkin-sheet-stub</div> }))

beforeEach(() => {
  needsCtl.isPending = false
  logWaterSpy.mockClear()
})

function LocationProbe() {
  return <div data-testid="loc">{useLocation().pathname}</div>
}

function renderPage() {
  return render(
    <QueryWrapper>
      <ToastProvider>
        <LevelUpProvider>
          <MemoryRouter initialEntries={['/nap/eletjel']}>
            <Routes>
              <Route path="/nap/eletjel" element={<><EletjelPage /><LocationProbe /></>} />
              <Route path="/train" element={<div>train-page</div>} />
            </Routes>
          </MemoryRouter>
        </LevelUpProvider>
      </ToastProvider>
    </QueryWrapper>,
  )
}

test('sanity: the demo pcts really average to the prototype hero 58%', () => {
  const vals = Object.values(PCTS)
  expect(Math.round(vals.reduce((s, v) => s + v, 0) / vals.length)).toBe(58)
  expect(bandOf(30)).toBe('yellow') // guards the attention-styling threshold reading below
})

test('the hero carries the ‹ Ma back chip, the segmented ring and the average %', async () => {
  renderPage()
  expect(await screen.findByRole('button', { name: 'Vissza' })).toHaveTextContent('‹ Ma')
  expect(document.querySelector('.ej-bigring')).not.toBeNull()
  // count-up settles on the six-ring average
  expect(await screen.findByText('58%')).toBeInTheDocument()
})

test('six need tiles render with the prototype-verbatim labels and their pct', async () => {
  renderPage()
  expect(await screen.findByRole('button', { name: 'Étel logolása' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Víz +2,5 dl' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Alvás logolása' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Mozgás — edzéshez' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Kapcsolat logolása' })).toBeInTheDocument()
  // Rend has no Today log surface (NeedRingSheet doctrine) — it renders, but not as a button
  expect(screen.getByText('Rend')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Rend' })).toBeNull()
  for (const pct of [72, 43, 88, 30, 60, 55]) {
    expect(screen.getByText(`${pct}%`)).toBeInTheDocument()
  }
})

test('the Víz tile logs +2,5 dl IN PLACE — no navigation, no sheet', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Víz +2,5 dl' }))
  expect(logWaterSpy).toHaveBeenCalledWith(250)
  expect(screen.getByTestId('loc')).toHaveTextContent('/nap/eletjel')
})

test('the Mozgás tile navigates to /train (TodayPage onNeedCta parity)', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Mozgás — edzéshez' }))
  expect(await screen.findByText('train-page')).toBeInTheDocument()
})

test('Étel / Alvás / Kapcsolat open the existing log sheets in place', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Étel logolása' }))
  expect(await screen.findByText('meal-sheet-stub')).toBeInTheDocument()
})

test('Alvás opens the sleep log sheet', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Alvás logolása' }))
  expect(await screen.findByText('sleep-sheet-stub')).toBeInTheDocument()
})

test('Kapcsolat opens the check-in sheet at the first fillable slot', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Kapcsolat logolása' }))
  expect(await screen.findByText('checkin-sheet-stub')).toBeInTheDocument()
})

test('honest pending: while the needs sim is loading NOTHING numeric renders', async () => {
  needsCtl.isPending = true
  renderPage()
  expect(await screen.findByRole('button', { name: 'Vissza' })).toBeInTheDocument()
  expect(screen.queryByText('58%')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Étel logolása' })).toBeNull()
  expect(document.querySelector('.ej-bigring')).toBeNull()
})

test('the quiet principle line closes the page', async () => {
  renderPage()
  expect(await screen.findByText(/A gyűrűk nem büntetnek — csak jelzik, mi kér figyelmet\./)).toBeInTheDocument()
})

test('the hub Életjel tile navigates to /nap/eletjel', async () => {
  render(
    <QueryWrapper>
      <ToastProvider>
        <LevelUpProvider>
          <MemoryRouter initialEntries={['/nap?dp=nap']}>
            <Routes>
              <Route path="/nap" element={<NapHubPage />} />
              <Route path="/nap/eletjel" element={<div>eletjel-page</div>} />
            </Routes>
          </MemoryRouter>
        </LevelUpProvider>
      </ToastProvider>
    </QueryWrapper>,
  )
  await userEvent.click(await screen.findByRole('button', { name: 'Életjel' }))
  expect(await screen.findByText('eletjel-page')).toBeInTheDocument()
})
