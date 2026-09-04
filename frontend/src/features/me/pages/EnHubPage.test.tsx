import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { EnHubPage } from '@/features/me/pages/EnHubPage'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { setToken } from '@/data/_client/api'

// Én hub (mezo-d20.6.1) — the /me index's Mozaik face: identity hero + coral-ringed goal
// card + 6-tile mosaic (Beállítások csempével). The behavioral contracts it inherits from the
// retired ProfilePage/MeSection are the spec: the bio line renders only filled bits, the
// theme sheet still flips data-theme, biometrics stay editable, a maintain goal reads
// „tartás" with no track, and a null statistic is `—`, never 0.
//
// Data is stubbed at the hook boundary (the NapHubPage.test exemplar): the mock seeds and
// the real-mode MSW fixtures differ, and these assertions are about the FACE, not about
// which fixture a mode happens to serve. Only the hooks each assertion reads are stubbed;
// everything else falls through to the real dual-mode hooks.
const bioStore = vi.hoisted(() => ({
  profile: { birthDate: '1991-03-04', heightCm: 180, bodyFatPct: 15, sex: 'male', activityLevel: 'mixed' } as Record<string, unknown> | null,
}))
const weightStore = vi.hoisted(() => ({ log: [{ date: '2026-05-22', value: 78.6 }], rate: -0.5 }))
const useHabitDay = vi.hoisted(() => vi.fn())
const useHabitSummary = vi.hoisted(() => vi.fn())

vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useGamification: () => ({
      profile: {
        level: 12, totalXp: 3140, xpInLevel: 60, xpForNext: 520, coins: 240,
        streakDays: 6, streakAlive: true, streakSavers: 1,
        activeTitleKey: 'fegyelmezett', ownedShopTitleKeys: [],
        lastActiveDate: null, dayCounters: { date: '', counts: {} },
      },
    }),
    useBiometricProfile: () => ({ profile: bioStore.profile, isPending: false }),
    useWeight: () => ({
      weightLog: weightStore.log,
      weightTrends: { last7d: { avg: 78.96, weeklyRate: -0.5 }, last4w: { weeklyRate: weightStore.rate } },
      logWeight: vi.fn(),
    }),
    // A hero már nem a súlycélt mutatja (mezo-iizd.4) — a `useGoal()` hívás csak a
    // weightLog cache-t melegíti, az EnHubPage nem destrukturálja többé az eredményét.
    useGoal: () => ({ goal: null, goalResponse: null, pending: false }),
    useSleep: () => ({
      sleepLog: [],
      lastNight: { date: '2026-05-22', bedtime: '00:42', wakeup: '09:03', duration: 7.5, quality: 9, awakenings: 1, mealToSleep: 125, notes: null },
      logSleep: vi.fn(),
    }),
    useHabitDay,
    useHabitSummary,
  }
})

beforeEach(() => {
  bioStore.profile = { birthDate: '1991-03-04', heightCm: 180, bodyFatPct: 15, sex: 'male', activityLevel: 'mixed' }
  weightStore.log = [{ date: '2026-05-22', value: 78.6 }]
  weightStore.rate = -0.5
  localStorage.setItem('mezo-theme', 'light')
  useHabitDay.mockReturnValue({
    habits: [
      { key: 'morning-1', chain: 'MORNING', status: 'done' },
      { key: 'morning-2', chain: 'MORNING', status: 'pending' },
      { key: 'evening-1', chain: 'EVENING', status: 'pending' },
    ],
  })
  useHabitSummary.mockReturnValue({
    data: {
      perfectMorningDays30: 0,
      perfectEveningDays30: 0,
      habits: [
        { key: 'morning-1', strengthPct: 82, done28: 0, missed28: 0 },
        { key: 'morning-2', strengthPct: 82, done28: 0, missed28: 0 },
        { key: 'evening-1', strengthPct: 64, done28: 0, missed28: 0 },
      ],
    },
  })
})

function LocationProbe() {
  return <div data-testid="loc">{useLocation().pathname}</div>
}

function renderHub() {
  return render(
    <QueryWrapper>
      <ThemeProvider>
        <MemoryRouter initialEntries={['/me']}>
          <>
            <Routes>
              <Route path="/me" element={<EnHubPage />} />
              <Route path="/me/goals" element={<div>CELOK HUB</div>} />
              <Route path="*" element={null} />
            </Routes>
            <LocationProbe />
          </>
        </MemoryRouter>
      </ThemeProvider>
    </QueryWrapper>,
  )
}

test('the identity hero carries the XP ring, the name, the title chip and the Lv · XP · streak · coin row', async () => {
  renderHub()
  const ring = await screen.findByRole('img', { name: /Szint 12/ })
  // in-level XP, not total: 60 / 520 ≈ 12%
  expect(ring).toHaveStyle({ '--xp': '12' })
  expect(screen.getByText('Lv 12')).toBeInTheDocument()
  expect(screen.getByText('3 140 XP')).toBeInTheDocument()
  // F7.4: the 🔥/🪙 emojis handed over to the clay flame/coin symbols
  const streak = screen.getByRole('button', { name: 'Sorozat részletei' })
  expect(streak).toHaveTextContent('6 nap')
  expect(streak.querySelector('use')?.getAttribute('href')).toBe('#i-lang')
  const coins = screen.getByRole('button', { name: 'Érme — címek' })
  expect(coins).toHaveTextContent('240')
  expect(coins.querySelector('use')?.getAttribute('href')).toBe('#i-erme')
  expect(document.querySelector('.enh-titlech')).not.toBeNull()
})

test('the bio line renders only the filled bits and opens the BiometricSheet', async () => {
  renderHub()
  const bio = await screen.findByRole('button', { name: 'Biometria szerkesztése' })
  expect(bio).toHaveTextContent('180 cm · 78,6 kg · 15% testzsír')
  await userEvent.click(bio)
  expect(screen.getByText('A motor ebből számol')).toBeInTheDocument()
})

test('with nothing measured the bio line vanishes — the hero offers the biometrics CTA instead', async () => {
  bioStore.profile = null
  weightStore.log = []
  renderHub()
  expect(await screen.findByRole('button', { name: 'Állítsd be a biometriád' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Biometria szerkesztése' })).not.toBeInTheDocument()
})

test('a hero-kártya az életcélokat összegzi és a Célok hubra visz (mezo-iizd.4)', async () => {
  renderHub()
  const card = await screen.findByRole('button', { name: /Célok/ })
  expect(card).toBeInTheDocument()
  fireEvent.click(card)
  expect(screen.getByText('CELOK HUB')).toBeInTheDocument()
})

test('a súlycél-track eltűnt az Én-hubról', async () => {
  renderHub()
  await screen.findByRole('button', { name: /Célok/ })
  expect(document.querySelector('.enh-gtrack')).toBeNull()
})

test('renders the six small tiles plus the wide Rutin tile, each opening its own page', async () => {
  renderHub()
  const TILES: [string, string][] = [
    ['Súly', '/me/weight'],
    ['Alvás', '/me/sleep'],
    ['Growth', '/me/growth'],
    ['Napló', '/me/naplo'],
    ['Emberek', '/me/people'],
    ['Beállítások', '/me/beallitasok'],
    ['Rutin', '/me/rutin'],
  ]
  for (const [label] of TILES) expect(await screen.findByRole('button', { name: label })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Súly' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/weight')
})

// A fenti teszt neve ígéretet tett („each opens its own page"), amit a ciklus nem tartott be: csak a
// `[label]`-t bontotta ki, tehát a `Súly`-on kívül MINDEN útvonal holt adat volt a tuple-ökben — a
// mezo-nol0 által átirányított `/me/ertesitesek/beallitasok` bejegyzés semmit nem állított, miközben
// ez az ág épp rá támaszkodik. A hub navigálás után lecsatolódik, ezért csempénként friss render.
test('a hét csempe mindegyike a saját oldalára navigál', async () => {
  const TILES: [string, string][] = [
    ['Súly', '/me/weight'],
    ['Alvás', '/me/sleep'],
    ['Growth', '/me/growth'],
    ['Napló', '/me/naplo'],
    ['Emberek', '/me/people'],
    ['Beállítások', '/me/beallitasok'],
    ['Rutin', '/me/rutin'],
  ]
  for (const [label, path] of TILES) {
    const { unmount } = renderHub()
    await userEvent.click(await screen.findByRole('button', { name: label }))
    expect(screen.getByTestId('loc')).toHaveTextContent(path)
    unmount()
  }
})

test('shows today done/total and both chain strengths on the Rutin tile', async () => {
  renderHub()
  const rutin = await screen.findByRole('button', { name: 'Rutin' })
  expect(rutin).toHaveTextContent('1 / 3 ma')
  expect(rutin).toHaveTextContent('reggel 82%')
  expect(rutin).toHaveTextContent('este 64%')
})

test('shows no fabricated line on the Rutin tile when the user has no habits', async () => {
  useHabitDay.mockReturnValue({ habits: [] })
  useHabitSummary.mockReturnValue({ data: { perfectMorningDays30: 0, perfectEveningDays30: 0, habits: [] } })
  renderHub()
  const rutin = await screen.findByRole('button', { name: 'Rutin' })
  expect(rutin.querySelector('.mz-tile-line')).toBeNull()
})

test('tile bottom lines come from the pages own hooks — the Súly and Alvás lines are live', async () => {
  renderHub()
  const suly = await screen.findByRole('button', { name: 'Súly' })
  expect(suly).toHaveTextContent('78,6 kg · −0,5 / hét')
  expect(screen.getByRole('button', { name: 'Alvás' })).toHaveTextContent('7,5 h · Q9')
})

test('a tile whose source has nothing to say carries no fabricated line', async () => {
  weightStore.log = []
  renderHub()
  const suly = await screen.findByRole('button', { name: 'Súly' })
  expect(suly.querySelector('.mz-tile-line')).toBeNull()
})

test('a Beállítások csempe a témát mutatja és a Beállítások oldalra navigál', async () => {
  renderHub()
  const tile = await screen.findByRole('button', { name: 'Beállítások' })
  expect(tile).toHaveTextContent('téma: világos')
  await userEvent.click(tile)
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/beallitasok')
})

// ── the progression's HOME (F7.4, mezo-d20.8.4.1) ──
// The retired StreakSheet/TitleShopSheet content lives on the Growth page's
// Kitüntetések tab now — the hub's chips deep-link there instead of opening sheets.

test('the title chip deep-links to the Growth awards tab', async () => {
  renderHub()
  await screen.findByText('Lv 12')
  const chip = document.querySelector<HTMLButtonElement>('button.enh-titlech')
  expect(chip).not.toBeNull()
  await userEvent.click(chip!)
  expect(screen.getByTestId('loc').textContent).toBe('/me/growth/kituntetesek')
})

test('the coin and streak stats deep-link to the Growth awards tab too', async () => {
  renderHub()
  await userEvent.click(await screen.findByRole('button', { name: 'Érme — címek' }))
  expect(screen.getByTestId('loc').textContent).toBe('/me/growth/kituntetesek')
})

test('the entrance choreography is armed — every .rise sits inside .mz-play', async () => {
  const { container } = renderHub()
  await screen.findByRole('button', { name: /Célok/ })
  const rises = container.querySelectorAll('.rise')
  expect(rises.length).toBeGreaterThan(0)
  for (const r of rises) expect(r.closest('.mz-play')).not.toBeNull()
})

// S2 (mezo-qw37.2): the hero's identity is the SIGNED-IN account, not a seed. `useProfile` is
// deliberately not stubbed above, so this walks the real hook → useMe() → MSW /api/auth/me.
test('real mode: the identity hero shows the account name from /api/auth/me', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  renderHub()
  await waitFor(() => expect(document.querySelector('.enh-nm')).toHaveTextContent('Owner'))
  expect(document.querySelector('.enh-idring i')).toHaveTextContent('O')
  vi.unstubAllEnvs()
  setToken(null)
})
