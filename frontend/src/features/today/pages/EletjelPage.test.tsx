import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { EletjelPage } from '@/features/today/pages/EletjelPage'
import { NapHubPage } from '@/features/today/pages/NapHubPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { ToastProvider } from '@/shared/ui/ToastProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { bandOf, type NeedKey, type NeedState } from '@/features/today/logic/needs'

// Életjel detail page (mezo-d20.2.6; Folyadék mezo-n4wf5.2, prototype vilagos/nap.js `eletjel()`):
// hero with SIX vials + the client mean in its label and a verdict read from the bands, then the
// six needs as rows with a level. Action per vial / row = the same dispatch TodayPage's onNeedCta does.

// Mode-agnostic stubs: useNeeds composes ~14 reads whose mock seeds and real-mode MSW
// fixtures differ, so the page's ONE state source is stubbed at the logic-hook seam
// (the QuickInputSheet.test idiom, one seam up). Pcts mirror the prototype demo values
// so the asserted average is the prototype's 58%.
const PCTS = vi.hoisted(() => ({
  energia: 72, hidratacio: 43, pihenes: 88, mozgas: 30, lelek: 60, rend: 55,
} as Record<string, number>))
const needsCtl = vi.hoisted(() => ({ isPending: false, bands: {} as Record<string, string> }))
vi.mock('@/features/today/logic/useNeeds', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/today/logic/useNeeds')>()
  const { NEED_META, bandOf: band } = await import('@/features/today/logic/needs')
  // built per call, so a test can move a need into another band (`needsCtl.bands`)
  const states = () => (Object.keys(PCTS) as NeedKey[]).map((key): NeedState => ({
    key,
    label: NEED_META[key].label,
    color: NEED_META[key].color,
    pct: PCTS[key],
    ratePerHour: 5,
    zeroAt: null,
    band: (needsCtl.bands[key] ?? band(PCTS[key])) as NeedState['band'],
    lastFill: null,
    todayFills: [],
  }))
  return { ...actual, useNeeds: () => ({ states: states(), isPending: needsCtl.isPending }) }
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
  needsCtl.bands = {}
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

test('the hero carries the ‹ Ma back control, the six vials and the average in its label', async () => {
  renderPage()
  expect(await screen.findByRole('button', { name: 'Vissza' })).toHaveTextContent('‹ Ma')
  const hero = document.querySelector('.fo-hero[data-kalauz-anchor="eletjel-gyuru"]') as HTMLElement
  expect(hero).not.toBeNull()
  // the six-need client mean, as a plain number in the label
  expect(within(hero).getByText('A hat jel · átlag 58')).toBeInTheDocument()
  expect(within(hero).getByText('Mind a hat jel rendben van.')).toHaveClass('fo-hero-verdict')
  expect(hero.querySelectorAll('.fo-vial')).toHaveLength(6)
  // nothing asks for attention → no nudge sentence, no hero button, no mark
  expect(screen.queryByText('Egy rövid lépés már megmozdítja.')).toBeNull()
  expect(hero.querySelector('.fo-hero-acts')).toBeNull()
  expect(screen.queryByText('figyelj')).toBeNull()
})

test('six need rows render with the prototype-verbatim labels, their hint and their pct', async () => {
  renderPage()
  expect(await screen.findByRole('button', { name: 'Étel logolása' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Víz +2,5 dl' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Alvás logolása' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Mozgás — edzéshez' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Kapcsolat logolása' })).toBeInTheDocument()
  // Rend has no Today log surface (NeedRingSheet doctrine) — it renders, but not as a button
  expect(screen.getAllByText('Rend')).toHaveLength(2) // its vial and its row
  expect(screen.queryByRole('button', { name: 'Rend' })).toBeNull()
  expect(screen.queryByRole('button', { name: /Rend/ })).toBeNull()
  const rows = document.querySelectorAll('.fo-card:not(.fo-hero) .fo-row')
  expect(rows).toHaveLength(6)
  expect([...rows].map((r) => r.querySelector('.v')?.textContent)).toEqual(['72%', '43%', '88%', '30%', '60%', '55%'])
  expect([...rows].map((r) => r.querySelector('small')?.textContent)).toEqual([
    'koppintás: étkezés logolása', 'koppintás: +250 ml', 'koppintás: alvás rögzítése', 'koppintás: Edzés',
    'koppintás: a következő check-in', 'magától töltődik a rutinból',
  ])
  expect(document.querySelectorAll('.fo-row .fo-level')).toHaveLength(6)
})

test('Folyadék (mezo-n4wf5.2): six vials and six rows, each on its need glyph; no ring, no glass, no tile', async () => {
  renderPage()
  await screen.findByRole('button', { name: 'Étel logolása' })
  const glyphs = ['#t-bowl', '#t-water', '#t-sleep', '#t-dumbbell', '#t-people', '#t-chain']
  const vials = document.querySelectorAll('.fo-hero .fo-vial')
  expect([...vials].map((t) => t.querySelector('use')?.getAttribute('href'))).toEqual(glyphs)
  expect([...vials].map((t) => t.querySelector('b')?.textContent)).toEqual(['72', '43', '88', '30', '60', '55'])
  const rows = document.querySelectorAll('.fo-card:not(.fo-hero) .fo-row')
  expect([...rows].map((t) => t.querySelector('.si use')?.getAttribute('href'))).toEqual(glyphs)
  // the static Rend vial and row are plain containers, the other five are buttons
  expect(vials[5].tagName).toBe('DIV')
  expect(rows[5].tagName).toBe('DIV')
  expect(vials[0].tagName).toBe('BUTTON')
  expect(document.querySelector('.glass')).toBeNull()
  expect(document.querySelector('svg circle')).toBeNull()
  expect(document.querySelector('.mz-page')).toBeNull()
})

test('a need in the red band: verdict names it, its vial and level turn warn, the hero offers its action', async () => {
  needsCtl.bands = { mozgas: 'red' }
  renderPage()
  expect(await screen.findByText('Egy jel kér figyelmet: a mozgás.')).toBeInTheDocument()
  expect(screen.getByText('Egy rövid lépés már megmozdítja.')).toBeInTheDocument()
  const vial = screen.getByText('figyelj').closest('.fo-vial') as HTMLElement
  expect(vial).toHaveTextContent('Mozgás')
  expect(vial.style.getPropertyValue('--c')).toBe('var(--fo-warn)')
  const row = screen.getByRole('button', { name: 'Mozgás — edzéshez' })
  expect((row.querySelector('.fo-level') as HTMLElement).style.getPropertyValue('--c')).toBe('var(--fo-warn)')
  await userEvent.click(screen.getByRole('button', { name: 'Edzés megnyitása' }))
  expect(await screen.findByText('train-page')).toBeInTheDocument()
})

test('several needs in red / critical: the verdict counts them, and the hero acts on the lowest', async () => {
  needsCtl.bands = { mozgas: 'red', hidratacio: 'critical', energia: 'red' }
  renderPage()
  expect(await screen.findByText('3 jel kér figyelmet.')).toBeInTheDocument()
  expect(screen.getAllByText('figyelj')).toHaveLength(3)
  // mozgas 30 is the lowest of the three (energia 72, hidratacio 43)
  expect(screen.getByRole('button', { name: 'Edzés megnyitása' })).toBeInTheDocument()
})

test('an attention need that starts with a vowel takes „az": az étel', async () => {
  needsCtl.bands = { energia: 'critical' }
  renderPage()
  expect(await screen.findByText('Egy jel kér figyelmet: az étel.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Étkezés rögzítése' }))
  expect(await screen.findByText('meal-sheet-stub')).toBeInTheDocument()
})

test('Rend asking for attention offers no hero button — it has no log surface', async () => {
  needsCtl.bands = { rend: 'red' }
  renderPage()
  expect(await screen.findByText('Egy jel kér figyelmet: a rend.')).toBeInTheDocument()
  expect(document.querySelector('.fo-hero .fo-hero-acts')).toBeNull()
})

test('a vial performs the same action as its row: the Víz vial logs +2,5 dl in place', async () => {
  renderPage()
  await screen.findByRole('button', { name: 'Víz +2,5 dl' })
  const vial = [...document.querySelectorAll<HTMLElement>('.fo-hero button.fo-vial')].find((v) => v.textContent?.includes('Víz'))!
  await userEvent.click(vial)
  expect(logWaterSpy).toHaveBeenCalledWith(250)
  expect(screen.getByTestId('loc')).toHaveTextContent('/nap/eletjel')
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
  expect(screen.queryByText(/58/)).toBeNull()
  expect(screen.queryByText(/%/)).toBeNull()
  expect(screen.getByText('A hat jel')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Étel logolása' })).toBeNull()
  // empty vessels and dim rows keep the page's shape: six of each, no number, nothing to tap
  const vials = document.querySelectorAll('.fo-hero .fo-vial')
  expect(vials).toHaveLength(6)
  expect([...vials].map((v) => v.querySelector('b')?.textContent)).toEqual(['–', '–', '–', '–', '–', '–'])
  expect(document.querySelectorAll('.fo-row.dim')).toHaveLength(6)
  expect(document.querySelector('.fo-row .fo-level')).toBeNull()
  expect(document.querySelector('.fo-page button.fo-vial, .fo-page button.fo-row')).toBeNull()
})

test('the quiet principle note closes the card', async () => {
  renderPage()
  expect(await screen.findByText(/A szintek nem büntetnek, csak jelzik, mi kér figyelmet\./)).toHaveClass('fo-note')
  expect(document.body.textContent).not.toMatch(/gyűrű/i)
})

// Titánium Nap/Mai (mezo-mhum, manifest C4): az Életjel-CSEMPE beolvadt a társba — a
// szükségletek színe a társ auráját festi, és MAGA a társ az ajtó ide. A hub-oldali belépő
// tehát nem tűnt el, csak gazdát cserélt; a teszt ugyanazt az utat járja a mai gombbal.
test('the hub companion navigates to /nap/eletjel', async () => {
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
  await userEvent.click(await screen.findByRole('button', { name: 'Életjelek' }))
  expect(await screen.findByText('eletjel-page')).toBeInTheDocument()
})
