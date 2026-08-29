import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { EnHubPage } from '@/features/me/pages/EnHubPage'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'

// Én hub (mezo-d20.6.1) — the /me index's Mozaik face: identity hero + coral-ringed goal
// card + 9-tile mosaic + Beállítások band. The behavioral contracts it inherits from the
// retired ProfilePage/MeSection are the spec: the bio line renders only filled bits, the
// theme sheet still flips data-theme, biometrics stay editable, a maintain goal reads
// „tartás" with no track, and a null statistic is `—`, never 0.
//
// Data is stubbed at the hook boundary (the NapHubPage.test exemplar): the mock seeds and
// the real-mode MSW fixtures differ, and these assertions are about the FACE, not about
// which fixture a mode happens to serve. Only the hooks each assertion reads are stubbed;
// everything else falls through to the real dual-mode hooks.
const goalStore = vi.hoisted(() => ({
  goal: {
    startWeight: 81.4, currentWeight: 78.6, targetWeight: 73,
    identityFrame: 'Erős és könnyű.',
  } as { startWeight: number; currentWeight: number; targetWeight: number; identityFrame: string } | null,
  trajectory: 'cut' as 'cut' | 'bulk' | 'maintain',
  pending: false,
}))
const bioStore = vi.hoisted(() => ({
  profile: { birthDate: '1991-03-04', heightCm: 180, bodyFatPct: 15, sex: 'male', activityLevel: 'mixed' } as Record<string, unknown> | null,
}))
const weightStore = vi.hoisted(() => ({ log: [{ date: '2026-05-22', value: 78.6 }], rate: -0.5 }))

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
    useGoal: () => ({
      goal: goalStore.goal,
      goalResponse: goalStore.goal == null ? null : { trajectory: goalStore.trajectory, title: 'Nyári forma' },
      pending: goalStore.pending,
    }),
    useSleep: () => ({
      sleepLog: [],
      lastNight: { date: '2026-05-22', bedtime: '00:42', wakeup: '09:03', duration: 7.5, quality: 9, awakenings: 1, mealToSleep: 125, notes: null },
      logSleep: vi.fn(),
    }),
  }
})

beforeEach(() => {
  goalStore.goal = { startWeight: 81.4, currentWeight: 78.6, targetWeight: 73, identityFrame: 'Erős és könnyű.' }
  goalStore.trajectory = 'cut'
  goalStore.pending = false
  bioStore.profile = { birthDate: '1991-03-04', heightCm: 180, bodyFatPct: 15, sex: 'male', activityLevel: 'mixed' }
  weightStore.log = [{ date: '2026-05-22', value: 78.6 }]
  weightStore.rate = -0.5
  localStorage.setItem('mezo-theme', 'light')
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
              <Route path="*" element={null} />
            </Routes>
            <LocationProbe />
          </>
        </MemoryRouter>
      </ThemeProvider>
    </QueryWrapper>,
  )
}

test('the identity hero carries the XP ring, the name, the title chip and the Lv · XP · 🔥 · 🪙 row', async () => {
  renderHub()
  const ring = await screen.findByRole('img', { name: /Szint 12/ })
  // in-level XP, not total: 60 / 520 ≈ 12%
  expect(ring).toHaveStyle({ '--xp': '12' })
  expect(screen.getByText('Lv 12')).toBeInTheDocument()
  expect(screen.getByText('3 140 XP')).toBeInTheDocument()
  expect(screen.getByText('🔥 6 nap')).toBeInTheDocument()
  expect(screen.getByText('🪙 240')).toBeInTheDocument()
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

test('the goal card shows the coral track, the indulás/most/cél labels and the Hátra · Tempó · ETA cells', async () => {
  renderHub()
  const card = await screen.findByRole('button', { name: 'Hosszú cél' })
  expect(card).toHaveTextContent('🎯 Fogyás · Nyári forma')
  // a seeded title that already opens with its trajectory is not prefixed twice
  expect(card).not.toHaveTextContent('Fogyás · Fogyás')
  expect(card).toHaveTextContent('33% a célig')
  expect(card.querySelector('.enh-gtrack')).not.toBeNull()
  expect(card).toHaveTextContent('81,4')
  expect(card).toHaveTextContent('78,6 most')
  expect(card).toHaveTextContent('73 cél')
  // 78.6 → 73 = 5,6 kg hátra; the real 4-week EWMA rate; ETA = round(5.6 / 0.5) = 11 hét
  expect(card).toHaveTextContent('5,6 kg')
  expect(card).toHaveTextContent('−0,5')
  expect(card).toHaveTextContent('11 hét')
  await userEvent.click(card)
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/goals')
})

test('a maintain goal drops the track and reads „tartás" (the real contract)', async () => {
  goalStore.goal = { startWeight: 78.6, currentWeight: 78.6, targetWeight: 78.6, identityFrame: 'Tartom.' }
  goalStore.trajectory = 'maintain'
  renderHub()
  const card = await screen.findByRole('button', { name: 'Hosszú cél' })
  expect(card).toHaveTextContent('tartás')
  expect(card.querySelector('.enh-gtrack')).toBeNull()
  expect(card).not.toHaveTextContent('a célig')
})

test('a null tempo renders `—` in the mini-cell, never 0', async () => {
  weightStore.rate = 0
  renderHub()
  const card = await screen.findByRole('button', { name: 'Hosszú cél' })
  const tempo = [...card.querySelectorAll('.mz-mcells span')].find((s) => s.textContent?.includes('kg / hét'))
  expect(tempo).toBeDefined()
  expect(tempo!.querySelector('b')).toHaveTextContent('—')
  // …and with no rate there is no ETA to fabricate either
  const eta = [...card.querySelectorAll('.mz-mcells span')].find((s) => s.textContent?.includes('eta'))
  expect(eta!.querySelector('b')).toHaveTextContent('—')
})

test('with no active goal the card becomes the honest ＋ Új cél door', async () => {
  goalStore.goal = null
  renderHub()
  const opener = await screen.findByRole('button', { name: /Új cél/ })
  expect(screen.queryByRole('button', { name: 'Hosszú cél' })).not.toBeInTheDocument()
  await userEvent.click(opener)
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/goals')
})

test('the mosaic carries the nine tiles and each opens its own page', async () => {
  renderHub()
  const TILES: [string, string][] = [
    ['Heti áttekintés', '/me/week'],
    ['Súly', '/me/weight'],
    ['Alvás', '/me/sleep'],
    ['Growth', '/me/growth'],
    ['Napló', '/me/naplo'],
    ['Emberek', '/me/people'],
    ['Tudás', '/me/knowledge'],
    ['Értesítések beállításai', '/me/ertesitesek'],
    ['AI-napló', '/me/ai-usage'],
  ]
  for (const [label] of TILES) expect(await screen.findByRole('button', { name: label })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Súly' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/weight')
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

test('the Beállítások band opens the theme sheet and the selector flips data-theme', async () => {
  renderHub()
  const band = await screen.findByRole('button', { name: 'Beállítások' })
  expect(band).toHaveTextContent('téma: világos')
  await userEvent.click(band)
  expect(screen.getByText('Megjelenés')).toBeInTheDocument()
  // Manual light => no attribute (light is the CSS base); choosing Sötét flips to dark.
  expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: /Sötét/ }))
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
})
