import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, RouterProvider, createMemoryRouter, useLocation } from 'react-router-dom'
import { NapKuldetesekPage } from '@/features/today/pages/NapKuldetesekPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { ToastProvider } from '@/shared/ui/ToastProvider'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { routes } from '@/app/router'
import { seedAllKalauzSeen } from '@/test/kalauz'

// Napi küldetések detail page (mezo-d20.2.4) — the hub's quest tile → own full page
// (prototype nap-body.html #page-quest, p-gold tone). ADR 0010: quests are OFFERS —
// no failure state, no countdowns, nothing self-completes from the UI.

// Mode-agnostic data stubs (QuickInputSheet.test pattern): mock seeds and real-mode
// MSW fixtures differ, so the quest/checkin/water hooks are stubbed with a mutable
// hoisted store the tests reset per case.
const store = vi.hoisted(() => {
  const base = { questDate: '2026-08-28', skillKey: 'sk', targetLabel: 't', completionMode: 'DERIVED' as const }
  const seed = () => [
    { ...base, id: 'q-gym', slot: 'BODY' as const, title: 'Mai tervezett edzés — csináld végig', why: 'A megjelenés a legerősebb identitás-szavazat.', metric: 'gym_session_done', xp: 25, status: 'offered' as const },
    { ...base, id: 'q-water', slot: 'FUELBIO' as const, title: 'Idd meg a 4 liter vizet', why: 'A hidratáltság a nap alapja.', metric: 'water_target', xp: 20, status: 'offered' as const },
    { ...base, id: 'q-check', slot: 'FUELBIO' as const, title: 'Teljes napi check-in', why: 'Négy pillanatkép adja a nap görbéjét.', metric: 'checkin_full', xp: 15, status: 'offered' as const },
    { ...base, id: 'q-done', slot: 'GROWTH' as const, title: 'Írj egy sort a naplóba', why: 'A memóriád ma is éhes — egy mondat elég.', metric: 'journal_entry', xp: 15, status: 'completed' as const, completedAt: '2026-08-28T06:41:00Z' },
  ]
  return {
    quests: seed(),
    rerollsLeft: 1,
    reroll: vi.fn(),
    logWater: vi.fn(),
    reset() { this.quests = seed(); this.rerollsLeft = 1; this.reroll.mockClear(); this.logWater.mockClear() },
  }
})
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useDailyQuests: () => ({ quests: store.quests, levelUps: [], rerollsLeft: store.rerollsLeft, mode: 'mock' }),
    useQuestActions: () => ({ reroll: store.reroll, pending: false, consumeLevelUps: vi.fn() }),
    useWaterActions: () => ({ logWater: store.logWater }),
    useCheckins: () => ({
      checkins: [{ time: '09:00', state: 'now', values: null, note: null }],
      saveCheckIn: vi.fn(),
    }),
  }
})

beforeEach(() => {
  store.reset()
  // A teljes-router eset a /nap-ot rendeli az AppLayouttal — seed nélkül a T0 welcome
  // (és a /nap kalauza) az assertek elé ugrana.
  seedAllKalauzSeen()
})

function LocationProbe() {
  return <div data-testid="loc">{useLocation().pathname}</div>
}

function renderPage() {
  return render(
    <QueryWrapper>
      <ToastProvider>
        <LevelUpProvider>
          <MemoryRouter initialEntries={['/nap', '/nap/kuldetesek']} initialIndex={1}>
            <Routes>
              <Route path="/nap" element={<div>hub-page</div>} />
              <Route path="/nap/kuldetesek" element={<><NapKuldetesekPage /><LocationProbe /></>} />
              <Route path="/train" element={<div>train-page</div>} />
            </Routes>
          </MemoryRouter>
        </LevelUpProvider>
      </ToastProvider>
    </QueryWrapper>,
  )
}

test('gold-tone scaffold: ‹ Ma back chip navigates back, hajtás spot + 1/4 hero + subline', async () => {
  const { container } = renderPage()
  expect(container.querySelector('.mz-page.mz-p-gold')).not.toBeNull()
  expect(container.querySelector('use[href="#s-hajtas"]')).not.toBeNull()
  expect(screen.getByText('1/4')).toBeInTheDocument()
  expect(screen.getByText('Napi küldetések')).toBeInTheDocument()
  expect(screen.getByText('ajánlatok a mai napra')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
  expect(await screen.findByText('hub-page')).toBeInTheDocument()
})

test('each quest renders as a card: title, why, XP pill; the completed card closes green with the XP credit line', () => {
  const { container } = renderPage()
  expect(container.querySelectorAll('.mz-qcard')).toHaveLength(4)
  expect(screen.getByText('Mai tervezett edzés — csináld végig')).toBeInTheDocument()
  expect(screen.getByText('A memóriád ma is éhes — egy mondat elég.')).toBeInTheDocument()
  expect(screen.getByText('+25 XP')).toBeInTheDocument()
  const doneCard = container.querySelector('.mz-qcard.done')!
  expect(doneCard).toHaveTextContent('✓ kész · +15 XP jóváírva')
  expect(doneCard.querySelector('button')).toBeNull() // a closed offer carries no affordance
})

test('offered quests state honestly: derived closes itself, never from the UI (ADR 0010)', () => {
  renderPage()
  expect(screen.getByText('folyamatban · az edzésből záródik magától')).toBeInTheDocument()
  expect(screen.getAllByText('folyamatban · a logjaidból záródik magától').length).toBeGreaterThan(0)
})

test('the smart log-CTA dispatches: +250 ml logs water in place, Edzés navigates to /train', async () => {
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: '+250 ml' }))
  expect(store.logWater).toHaveBeenCalledWith(250)
  await userEvent.click(screen.getByRole('button', { name: 'Edzés' }))
  expect(await screen.findByText('train-page')).toBeInTheDocument()
})

test('the Check-in CTA opens the check-in sheet in place', async () => {
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: 'Check-in' }))
  expect(await screen.findByText('Hogy vagyunk?')).toBeInTheDocument()
})

test('the reroll affordance carries the remaining count and rerolls THAT quest; spent = no affordance', async () => {
  const { unmount } = renderPage()
  const swaps = screen.getAllByRole('button', { name: 'Csere · 1 maradt' })
  await userEvent.click(swaps[0])
  expect(store.reroll).toHaveBeenCalledWith('q-gym')
  unmount()
  store.rerollsLeft = 0
  renderPage()
  expect(screen.queryByRole('button', { name: /Csere/ })).toBeNull()
})

test('the quiet principle line spells out the offer contract', () => {
  renderPage()
  expect(screen.getByText('A küldetés ajánlat: ha kimarad, csendben lejár — bukás nincs. A Csere naponta egyszer ingyenes.')).toBeInTheDocument()
})

test('honest empty state: no quests drawn → the empty line, no fabricated 0/0 hero number', () => {
  store.quests = []
  const { container } = renderPage()
  expect(screen.getByText('Ma nincs kisorsolt küldetés.')).toBeInTheDocument()
  expect(container.querySelector('.mz-bignum')).toBeNull()
})

test('the hub quest tile navigates to /nap/kuldetesek and the route renders the page (router registration)', async () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/nap?dp=nap'] })
  render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
  await userEvent.click(await screen.findByRole('button', { name: 'Napi küldetések' }))
  expect(router.state.location.pathname).toBe('/nap/kuldetesek')
  expect(await screen.findByText('ajánlatok a mai napra')).toBeInTheDocument()
})
