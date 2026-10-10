import { fireEvent, render, screen } from '@testing-library/react'
import rawCss from '@/styles/folyadek-nap-epites.css?raw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { HabitPage } from '@/features/me/pages/HabitPage'
import { FrameProvider, useFrame } from '@/shared/ui/folyadek'
import type { HabitChainInfo, HabitFormation } from '@/data/types'

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

function def(
  habitKey: string, title: string, framework: 'FOGG' | 'CLEAR' | null,
  overrides: Partial<HabitChainInfo['defs'][number]> = {},
): HabitChainInfo['defs'][number] {
  return {
    id: `d-${habitKey}`, habitKey, chainKey: 'MORNING', position: 1, title, why: null, anchorCopy: null,
    mode: 'MANUAL', metric: 'manual', skillKey: 'mindset', xp: 5, linkUrl: null, isActive: true,
    framework, anchorHabitKey: null, cue: null, craving: null, reward: null, celebration: null, identity: null,
    ...overrides,
  }
}

const MORNING: HabitChainInfo = {
  id: 'chain-morning', chainKey: 'MORNING', title: 'Reggeli rutin', daypart: 'MORNING', position: 1, isActive: true,
  defs: [
    def('sun', 'Reggeli fény', 'FOGG', { position: 1, anchorCopy: 'kitöltöttem a kávét', celebration: 'ökölrázás' }),
    def('intent', 'leírom a napi szándékot', 'CLEAR', {
      position: 2,
      cue: '7:10-kor a konyhában', craving: 'tisztább a fejem', reward: 'a pipa maga',
      identity: 'figyel a saját gondolataira',
    }),
    def('water', 'Hidratálás', null, { position: 3, why: 'mert száraz a torkom' }),
    def('stretch', 'Nyújtás', 'FOGG', { position: 4, anchorHabitKey: 'sun', celebration: 'mosoly' }),
  ],
}
const EVENING: HabitChainInfo = {
  id: 'chain-evening', chainKey: 'EVENING', title: 'Esti rutin', daypart: 'EVENING', position: 2, isActive: true,
  defs: [def('bed', 'Időben ágyban', null, { chainKey: 'EVENING', position: 1 })],
}


/**
 * A formation payload the page can actually draw. `days` is the lifetime, so the calendar has
 * something to lay out; the estimate fields are internally consistent with `curveK`/`reps` —
 * a fixture that disagreed with itself would let a real inconsistency pass unnoticed.
 */
function formation(over: Partial<HabitFormation> = {}): HabitFormation {
  const days: HabitFormation['days'] = []
  for (let i = 0; i < 40; i += 1) {
    const d = new Date(2026, 6, 1 + i)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    days.push({ date: iso, status: i % 5 === 4 ? 'missed' : 'done' })
  }
  return {
    key: 'intent', firstDate: days[0].date, reps: 32, missed: 8,
    automaticityPct: 62, curveK: 0.03, thresholdPct: 90, minReps: 5,
    repsToThresholdLo: 30, repsToThresholdHi: 80,
    weeksToThresholdLo: 5, weeksToThresholdHi: 11,
    repsPerWeek: 6, consistencyPct: 71, timeConstancyPct: 84, anchorConstancyPct: null,
    days, ...over,
  }
}

const mockHabitSummary = {
  perfectMorningDays30: 6,
  perfectEveningDays30: 4,
  habits: [{ key: 'intent', strengthPct: 82, done28: 23, missed28: 5 }],
}

const {
  useHabitSummary, useHabitCatalog, useHabitFormation,
} = vi.hoisted(() => ({
  useHabitSummary: vi.fn(),
  useHabitFormation: vi.fn(),
  useHabitCatalog: vi.fn(),
}))
vi.mock('@/data/hooks', () => ({
  useHabitSummary: () => useHabitSummary(),
  useHabitFormation: (k: string) => useHabitFormation(k),
  useHabitCatalog: () => useHabitCatalog(),
}))

/** What the page hands to the app frame's title bar (no title bar is mounted in these tests). */
function FrameProbe() {
  const frame = useFrame()
  return <output data-testid="frame">{frame.title} | {frame.eyebrow}</output>
}

function renderPage(habitKey: string) {
  return render(
    <FrameProvider>
      <MemoryRouter initialEntries={[`/nap/rutin/szokas/${habitKey}`]}>
        <FrameProbe />
        <Routes>
          <Route path="/nap/rutin/szokas/:habitKey" element={<HabitPage />} />
          <Route path="/nap/rutin/epites" element={<div>RUTIN HUB</div>} />
        </Routes>
      </MemoryRouter>
    </FrameProvider>,
  )
}

beforeEach(() => {
  navigate.mockClear()
  useHabitSummary.mockReset()
  useHabitSummary.mockReturnValue({ data: mockHabitSummary })
  useHabitFormation.mockReset()
  useHabitFormation.mockReturnValue({ data: formation() })
  useHabitCatalog.mockReset()
  useHabitCatalog.mockReturnValue({
    catalog: { chains: [MORNING, EVENING] }, isPending: false, isError: false, refetch: vi.fn(),
  })
})

describe('HabitPage — a részletek oldala (mezo-bk26 után)', () => {
  test('shows the finished recipe sentence and the framework label', () => {
    renderPage('intent')
    expect(screen.getByTestId('recipe-sentence'))
      .toHaveTextContent('7:10-kor a konyhában leírom a napi szándékot, mert tisztább a fejem. Jutalmam: a pipa maga.')
    expect(screen.getByText(/Négy törvény/)).toBeInTheDocument()
  })

  test('the recipe is READ-ONLY here — no field, no save, no destructive action', () => {
    renderPage('intent')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mentés' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Szüneteltetés/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /törlése/ })).not.toBeInTheDocument()
  })

  test('the recipe is drawn as vessels, one per part of the framework, filled when that part is set', () => {
    const { container } = renderPage('intent')
    const parts = [...container.querySelectorAll('.rb-rec span')]
    expect(parts.map((p) => p.textContent)).toEqual(['Jelzés', 'Vágy', 'Válasz', 'Jutalom'])
    expect(parts.every((p) => p.classList.contains('f'))).toBe(true)
  })

  test('the hero button opens the editor page', () => {
    renderPage('intent')
    fireEvent.click(screen.getByRole('button', { name: 'Szerkesztés' }))
    expect(navigate).toHaveBeenCalledWith('/nap/rutin/szokas/intent/szerkesztes')
  })

  test('the recipe row itself opens the editor too', () => {
    renderPage('intent')
    fireEvent.click(screen.getByRole('button', { name: 'Szerkesztem' }))
    expect(navigate).toHaveBeenCalledWith('/nap/rutin/szokas/intent/szerkesztes')
  })

  test('a chip-linked FOGG recipe resolves the anchor title into the sentence', () => {
    renderPage('stretch')
    expect(screen.getByTestId('recipe-sentence')).toHaveTextContent('Miután kész a Reggeli fény')
  })

  test('the hero carries the 28-day strength and its pipa/kihagyás split', () => {
    renderPage('intent')
    const hero = document.querySelector('.fo-hero') as HTMLElement
    expect(hero.querySelector('.fo-hero-lbl')).toHaveTextContent('Út az automatizmus felé · 28 napos erő 82%')
    expect(hero.querySelector('.fo-hero-sub')).toHaveTextContent(/^23 pipa · 5 kihagyás\./)
  })

  test('omits the 28-day standing entirely when the def has no summary row', () => {
    renderPage('sun')
    expect(screen.queryByText(/28 napos erő/)).not.toBeInTheDocument()
    expect(screen.queryByText(/pipa ·/)).not.toBeInTheDocument()
  })

  test('the title bar names the habit and its OWN chain — an evening habit is not filed under the morning', () => {
    renderPage('bed')
    expect(screen.getByTestId('frame')).toHaveTextContent('Időben ágyban | Szokás · Esti rutin')
  })

  test('a morning habit is named with the morning chain', () => {
    renderPage('intent')
    expect(screen.getByTestId('frame')).toHaveTextContent('leírom a napi szándékot | Szokás · Reggeli rutin')
  })

  test('an unknown habit key bounces back to the rutin hub', () => {
    renderPage('nincs-ilyen')
    expect(screen.getByText('RUTIN HUB')).toBeInTheDocument()
  })

  test('an unresolved catalog shows the loading ghost instead of bouncing', () => {
    useHabitCatalog.mockReturnValue({ catalog: { chains: [] }, isPending: true, isError: false, refetch: vi.fn() })
    renderPage('intent')
    expect(screen.queryByText('RUTIN HUB')).not.toBeInTheDocument()
    expect(screen.getByText(/Szokás betöltése/)).toBeInTheDocument()
  })

  test('a failed catalog fetch shows the retry ghost instead of silently redirecting', () => {
    const refetch = vi.fn()
    useHabitCatalog.mockReturnValue({ catalog: { chains: [] }, isPending: false, isError: true, refetch })
    renderPage('intent')
    expect(screen.queryByText('RUTIN HUB')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Újra' }))
    expect(refetch).toHaveBeenCalled()
  })

  // ---- a paused habit must SAY so; resuming lives on the editor page ----

  test('a paused habit shows a paused note pointing at the editor', () => {
    useHabitCatalog.mockReturnValue({
      catalog: { chains: [{ ...MORNING, defs: [{ ...MORNING.defs[1], isActive: false }] }, EVENING] },
      isPending: false, isError: false, refetch: vi.fn(),
    })
    renderPage('intent')
    expect(screen.getByTestId('paused-note')).toBeInTheDocument()
  })

  test('an active habit shows no paused note', () => {
    renderPage('intent')
    expect(screen.queryByTestId('paused-note')).not.toBeInTheDocument()
  })

  test('never renders a tick control', () => {
    renderPage('intent')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  // ---- formálódás-nézet (mezo-08zl) ----

  test('the lifetime calendar keeps the three states visually distinct (a miss is not an empty day)', () => {
    const { container } = renderPage('intent')
    const cells = [...container.querySelectorAll('.rb-g28 i')]
    // 40 lifetime days, padded to whole weeks — so at least the lifetime, and a multiple of 7
    expect(cells.length).toBeGreaterThanOrEqual(40)
    expect(cells.length % 7).toBe(0)
    expect(container.querySelectorAll('.rb-g28 i.p').length).toBe(32)
    expect(container.querySelectorAll('.rb-g28 i.m').length).toBe(8)
    expect(container.querySelectorAll('.rb-g28 i.s').length).toBe(cells.length - 40)
    // A day with NO row is not a miss: rows only exist for days the app was opened, so the two
    // must not share a fill — otherwise absence reads as failure, which ADR 0010 forbids.
    // Folyadék (F2): a day is a small vessel — full = pipa, outlined = kimaradt, faint = nem volt sor.
    const fillOf = (state: string) =>
      rawCss.match(new RegExp(`\\.rb-g28 i\\.${state} \\{[^}]*background:\\s*([^;]+);`))?.[1]?.trim()
    const [doneFill, missFill, emptyFill] = [fillOf('p'), fillOf('m'), fillOf('s')]
    expect(doneFill).toBeTruthy()
    expect(emptyFill).toBeTruthy()
    expect(missFill).toBeTruthy()
    expect(missFill).not.toEqual(emptyFill)
    expect(doneFill).not.toEqual(missFill)
    // …and the legend carries the lifetime counts
    expect(screen.getByTestId('formation-history')).toHaveTextContent('pipa 32')
    expect(screen.getByTestId('formation-history')).toHaveTextContent('kimaradt 8')
  })

  test('the estimate is shown as a RANGE, never as a single date', () => {
    renderPage('intent')
    expect(screen.getByTestId('formation-eta')).toHaveTextContent('5–11 hét')
    expect(screen.getByTestId('formation-eta')).toHaveTextContent(/van hátra/)
  })

  test('under minReps it shows no percentage and no deadline, only what is missing', () => {
    useHabitFormation.mockReturnValue({
      data: formation({
        reps: 2, missed: 1, automaticityPct: null, curveK: null,
        repsToThresholdLo: null, repsToThresholdHi: null,
        weeksToThresholdLo: null, weeksToThresholdHi: null, consistencyPct: null,
      }),
    })
    const { container } = renderPage('intent')
    expect(screen.getByTestId('formation-card')).toHaveTextContent('még gyűlik az adat')
    expect(screen.getByTestId('formation-eta')).toHaveTextContent('Még gyűlik az adat: 3 ismétlés a becslésig.')
    // no fabricated curve, no fabricated percentage, an empty vessel
    expect(container.querySelector('.rb-curve')).toBeNull()
    expect(screen.queryByText('Így épült')).toBeNull()
    expect(screen.getByTestId('formation-card').textContent).not.toMatch(/\d+%/)
    expect(screen.getByTestId('formation-card').querySelector('.t i')).toBeNull()
  })

  test('the ripening vessel stands at the estimated automaticity, with the current stage lit on the rail', () => {
    renderPage('intent')
    const card = screen.getByTestId('formation-card')
    expect(card.querySelector('.t i')).toHaveStyle({ height: '62%' })
    expect(card.querySelector('.t b')).toHaveTextContent('62%')
    const now = card.querySelector('li[aria-current="step"]') as HTMLElement
    expect(now).toHaveTextContent('kezd magától menni')
    expect(now).toHaveTextContent('itt tartasz · még ~30–80 ismétlés')
    expect(card.querySelectorAll('li.done')).toHaveLength(2)
    // a level, never a progress ring
    expect(card.querySelector('svg')).toBeNull()
  })

  test('the formation surface is drawn only from a fitted curve, with the threshold as its waterline', () => {
    const { container } = renderPage('intent')
    expect(screen.getByRole('heading', { name: /Így épült/ })).toBeInTheDocument()
    expect(container.querySelector('.rb-curve .fo-area')).not.toBeNull()
    expect(screen.getByTestId('formation-curve')).toHaveAccessibleName(/32 ismétlésnél tartasz/)
  })

  test('the weekday breakdown shows each day as a small level', () => {
    renderPage('intent')
    const days = [...screen.getByTestId('formation-history').querySelectorAll('.rb-wd .fo-mini small')]
    expect(days.map((d) => d.textContent)).toEqual(['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'])
    expect(screen.getByText(/A legerősebb napod:/)).toBeInTheDocument()
  })

  test('a context signal we cannot measure renders as a dash, not as 0%', () => {
    renderPage('intent')
    // anchorConstancyPct is null in the fixture (no anchor on `intent`)
    expect(screen.getByTestId('formation-context')).toHaveTextContent('—')
    expect(screen.getByTestId('formation-context')).toHaveTextContent('nincs horgony')
  })

  test('nothing is drawn from the unresolved empty payload (thresholdPct 0)', () => {
    useHabitFormation.mockReturnValue({
      data: formation({ reps: 0, missed: 0, thresholdPct: 0, minReps: 0, automaticityPct: null, curveK: null, days: [] }),
    })
    renderPage('intent')
    expect(screen.queryByTestId('formation-card')).toBeNull()
  })
})

// Én IA final review (mezo-lhqw7): the chip names where it LANDS — the builder is „Rutinok"
// (/nap/rutin/epites, „Rutinok szerkesztése"); only the builder's own chip says „Rutin" (/nap/rutin).
test('the back chip says „Rutinok" and lands on the routine builder', () => {
  renderPage('intent')
  const back = screen.getByRole('button', { name: 'Vissza' })
  expect(back).toHaveTextContent(/^‹Rutinok$/)
  fireEvent.click(back)
  expect(navigate).toHaveBeenCalledWith('/nap/rutin/epites')
})
