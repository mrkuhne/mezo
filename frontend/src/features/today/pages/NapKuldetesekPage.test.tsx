import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, RouterProvider, createMemoryRouter, useLocation } from 'react-router-dom'
import { NapKuldetesekPage } from '@/features/today/pages/NapKuldetesekPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { ToastProvider } from '@/shared/ui/ToastProvider'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { routes } from '@/app/router'
import { seedAllKalauzSeen } from '@/test/kalauz'

// Napi küldetések detail page (mezo-d20.2.4; Folyadék mezo-n4wf5.2, prototype vilagos/nap.js
// `kuldetesek()`): one vial per quest in the hero, the offers as rows. ADR 0010: quests are OFFERS —
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

test('Folyadék scaffold: ‹ Ma back control navigates back, the hero counts the offers and holds one vial per quest', async () => {
  const { container } = renderPage()
  expect(container.querySelector('.fo-page')).not.toBeNull()
  expect(container.querySelector('.mz-page')).toBeNull()
  expect(container.querySelector('.glass')).toBeNull()
  const hero = container.querySelector('.fo-hero') as HTMLElement
  expect(within(hero).getByText('Mai ajánlatok · +75 XP')).toBeInTheDocument()
  expect(within(hero).getByText('1 kész a 4 ajánlatból.')).toHaveClass('fo-hero-verdict')
  expect(within(hero).getByText('A többi magától telik, ahogy a napod halad.')).toBeInTheDocument()
  const vials = hero.querySelectorAll('.fo-vial')
  expect(vials).toHaveLength(4)
  expect([...vials].map((v) => v.querySelector('b')?.textContent)).toEqual(['+25 XP', '+20 XP', '+15 XP', '+15 XP'])
  expect([...vials].map((v) => v.querySelector('use')?.getAttribute('href'))).toEqual(['#t-dumbbell', '#t-bowl', '#t-bowl', '#t-journal'])
  expect([...vials].map((v) => v.querySelector('small')?.textContent)).toEqual(['Testfolyamatban', 'Étkezésfolyamatban', 'Étkezésfolyamatban', 'Fejlődésjóváírva'])
  // a quest has no partial progress: the done vessel is full and marked, an open one shows a sliver
  expect(within(vials[3] as HTMLElement).getByText('kész')).toBeInTheDocument()
  expect((vials[3].querySelector('.l') as HTMLElement).style.getPropertyValue('--p')).toBe('100%')
  expect((vials[0].querySelector('.l') as HTMLElement).style.getPropertyValue('--p')).toBe('6%')
  await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
  expect(await screen.findByText('hub-page')).toBeInTheDocument()
})

test('the hero button is the first open quest\'s smart action, spelled out', async () => {
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: 'Edzés megnyitása' }))
  expect(await screen.findByText('train-page')).toBeInTheDocument()
})

test('each quest renders as a row: title, why, XP pill; the completed row closes green with the XP credit line', () => {
  const { container } = renderPage()
  const rows = container.querySelectorAll<HTMLElement>('.nb-quests .fo-row')
  expect(rows).toHaveLength(4)
  expect(screen.getByText('Mai tervezett edzés — csináld végig')).toBeInTheDocument()
  expect(screen.getByText('A memóriád ma is éhes — egy mondat elég.')).toBeInTheDocument()
  expect(within(rows[0]).getByText('+25 XP')).toHaveClass('fo-st', 'plan')
  const doneRow = container.querySelector<HTMLElement>('.nb-quest.done')!
  expect(doneRow).toHaveTextContent('kész · +15 XP jóváírva')
  expect(within(doneRow).getByText('Kész')).toHaveClass('fo-st', 'ok')
  expect((doneRow.querySelector('.fo-level i') as HTMLElement).style.width).toBe('100%')
  expect((rows[0].querySelector('.fo-level i') as HTMLElement).style.width).toBe('6%')
  expect(doneRow.querySelector('button')).toBeNull() // a closed offer carries no affordance
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
  // the sheet's own copy belongs to CheckInSheet — here only that it opened, on this page
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
  expect(screen.getByTestId('loc')).toHaveTextContent('/nap/kuldetesek')
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
  expect(screen.getByText('A küldetés ajánlat: ha kimarad, csendben lejár, bukás nincs. A Csere naponta egyszer ingyenes.')).toHaveClass('fo-note')
})

test('honest empty state: no quests drawn → the empty hero with three empty vessels, no fabricated 0/0 count', async () => {
  store.quests = []
  const { container } = renderPage()
  expect(screen.getByText('Ma nincs kisorsolt küldetés.')).toHaveClass('fo-hero-verdict')
  expect(screen.getByText('Holnap reggel új ajánlatok érkeznek. Addig a napod a szokott rendben megy.')).toBeInTheDocument()
  expect(container.querySelector('.fo-hero-lbl')).toHaveTextContent(/^Mai ajánlatok$/) // no XP sum
  expect(screen.queryByText(/kész a/)).toBeNull()
  const vials = container.querySelectorAll('.fo-hero .fo-vial')
  expect(vials).toHaveLength(3)
  expect([...vials].map((v) => v.querySelector('b')?.textContent)).toEqual(['–', '–', '–'])
  expect(container.querySelector('.fo-card .fo-empty')).toHaveTextContent('Nincs mára küldetés.')
  expect(container.querySelector('.fo-empty use[href="#t-quest"]')).not.toBeNull()
  // the offer contract still closes the page
  expect(screen.getByText(/A küldetés ajánlat: ha kimarad, csendben lejár, bukás nincs\./)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Vissza a mai napra' }))
  expect(await screen.findByText('hub-page')).toBeInTheDocument()
})

// Titánium Nap/Mai (mezo-mhum, manifest C1 — DEFER): a küldetés-csempe lekerült a
// nyitóoldalról (a végleges otthona egy későbbi szeleté), de a FELÜLET és minden mély
// hivatkozása (értesítés, kalauz) él tovább. Épp ezt a felezővonalat őrzi a teszt:
// a `/nap/kuldetesek` útvonal feloldódik és az oldalt adja — ÉS a hubon nincs küldetés-belépő.
test('/nap/kuldetesek still resolves and renders the page, while the hub carries no quest entry (manifest C1)', async () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/nap?dp=nap'] })
  render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
  // A companion-first hub loaded marker (a köszöntő szöveg eltűnt, mezo-7flr).
  await screen.findByRole('button', { name: 'Életjelek' })
  expect(screen.queryByRole('button', { name: 'Napi küldetések' })).toBeNull()

  await act(() => router.navigate('/nap/kuldetesek'))
  expect(router.state.location.pathname).toBe('/nap/kuldetesek')
  expect(await screen.findByRole('heading', { name: /Mai ajánlatok/ })).toBeInTheDocument()
})
