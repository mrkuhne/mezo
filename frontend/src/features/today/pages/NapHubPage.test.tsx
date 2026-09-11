// ============================================================
// Mezo · NapHubPage — companion-first landing (mezo-7flr)
//
// The `/nap` default landing is now a PURE companion entry: the 3D companion, a daypart
// greeting, and a composer (text + mic) that hands what the user writes to the Mezo
// conversation. Every tile / next-step / stat-strip that used to live here moved to the
// navigation (mezo-jkh4), so this file asserts the NEW page and proves the old surfaces are
// gone — not weakened, deleted and replaced.
//
// Mode-agnostic by construction: the page's only data reads (`useTodayScenario`, `useDayFace`,
// `useNeeds`) are stubbed deterministically so neither mock- nor real-mode fixtures steer the
// assertions, and the voice + chat handoff are observed through a spied hook and a probe route.
// ============================================================
import { render, screen, act, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { NapHubPage } from '@/features/today/pages/NapHubPage'
import { QueryWrapper } from '@/test/queryWrapper'

// The scenario decides the normal vs. rough-day (anchor) render.
const scenarioStore = vi.hoisted(() => ({
  anchorMode: false,
  reset() { this.anchorMode = false },
}))

vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useTodayScenario: () => ({
      dayState: scenarioStore.anchorMode ? 'rough' : 'medium',
      medCycleDay: 0, niggle: false, vulnerable: false,
      anchorMode: scenarioStore.anchorMode, ritual: null,
    }),
    // useDayFace reads this for the "now" face; with `?dp=` on `/nap` the param wins, but the
    // hook still calls it, so a real-mode run must not reach MSW for it.
    useSleepGoal: () => ({
      goal: { wakeTime: '06:45', bedTime: '23:15', targetMinutes: 480, targetHours: 8 },
      isPending: false,
    }),
  }
})

// The six needs rings compose ~14 data reads — none of which this page shows. Stub the hook
// itself so the companion renders without dragging the whole data layer into the test.
vi.mock('@/features/today/logic/useNeeds', () => ({
  useNeeds: () => ({ states: [], isPending: false }),
}))

// Pin the wall clock so `useDayFace`'s nowFace is deterministic when no `?dp=` is given.
const clock = vi.hoisted(() => ({ now: new Date('2026-05-22T13:42:00') }))
vi.mock('@/features/today/logic/useMinuteTick', () => ({
  useMinuteTick: () => clock.now,
}))

// The voice hook is spied so we can prove the mic wires to it AND drive a transcript into the
// composer without a real MediaRecorder (jsdom has none — the real hook would report
// 'unsupported' and the button would be inert).
const voiceStore = vi.hoisted(() => ({
  state: 'idle' as 'unsupported' | 'idle' | 'recording' | 'transcribing',
  error: null as string | null,
  toggle: vi.fn(),
  onTranscript: (_: string) => {},
  reset() { this.state = 'idle'; this.error = null; this.toggle = vi.fn(); this.onTranscript = () => {} },
}))
vi.mock('@/features/insights/logic/useVoiceInput', () => ({
  useVoiceInput: (onTranscript: (t: string) => void) => {
    voiceStore.onTranscript = onTranscript
    return { state: voiceStore.state, error: voiceStore.error, toggle: voiceStore.toggle }
  },
}))

beforeEach(() => {
  scenarioStore.reset()
  voiceStore.reset()
  clock.now = new Date('2026-05-22T13:42:00')
})
afterEach(() => vi.unstubAllGlobals())

/** The chat surface the composer hands off to — echoes the message carried in router state so a
 *  test can prove BOTH the navigation target and the payload (i.e. the send is wired), without
 *  mounting the real chat engine and its network. */
function ChatProbe() {
  const loc = useLocation()
  const compose = (loc.state as { compose?: string } | null)?.compose ?? ''
  return <div>chat-surface:{compose}</div>
}

function renderHub(path = '/nap?dp=nap', extraRoutes?: ReactNode) {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/nap" element={<NapHubPage />} />
          <Route path="/mezo/chat" element={<ChatProbe />} />
          {extraRoutes}
        </Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )
}

// ── the companion + greeting ─────────────────────────────────────────────────

test('a társ a nyitóoldal középpontja, a napszak csak a köszönést váltja', async () => {
  const nap = renderHub('/nap?dp=nap')
  expect(await screen.findByText('Jó itt folytatni.')).toBeInTheDocument()
  // The companion IS the Életjelek door (a tap opens the detail surface).
  expect(screen.getByRole('button', { name: 'Életjelek' })).toBeInTheDocument()
  nap.unmount()

  const reggel = renderHub('/nap?dp=reggel')
  expect(await screen.findByText('Jó reggelt.')).toBeInTheDocument()
  reggel.unmount()

  renderHub('/nap?dp=este')
  expect(await screen.findByText('Megérkeztél.')).toBeInTheDocument()
})

test('a kalauz horgonya a társ blokkján marad', async () => {
  renderHub()
  await screen.findByText('Jó itt folytatni.')
  expect(document.querySelector('[data-kalauz-anchor="nap-hero"]')).not.toBeNull()
})

test('reduced-motion mellett a statikus társ (SVG) jelenik meg, nem az élő jelenet', async () => {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
    matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }))
  renderHub()
  await screen.findByText('Jó itt folytatni.')
  expect(document.querySelector('.titan-svg')).not.toBeNull()
  expect(document.querySelector('.titan-scene')).toBeNull()
})

// ── the composer (text + mic) ────────────────────────────────────────────────

test('a társ alatt működő composer áll: mező, mikrofon és küldés', async () => {
  renderHub()
  expect(await screen.findByPlaceholderText('Írj vagy mondj valamit Mezónak…')).toBeInTheDocument()
  const input = screen.getByPlaceholderText('Írj vagy mondj valamit Mezónak…')
  expect(input.tagName).toBe('TEXTAREA')
  expect(screen.getByRole('button', { name: 'Hangbevitel' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Küldés' })).toBeInTheDocument()
})

test('gépelés + küldés a Mezo-beszélgetésbe visz, az üzenettel', async () => {
  renderHub()
  const input = await screen.findByPlaceholderText('Írj vagy mondj valamit Mezónak…')
  await userEvent.type(input, 'Szia Mezo')
  await userEvent.click(screen.getByRole('button', { name: 'Küldés' }))
  // Navigated to the single chat surface, carrying the composed message (the send is wired).
  expect(await screen.findByText('chat-surface:Szia Mezo')).toBeInTheDocument()
})

test('Enter is elküldi az üzenetet a beszélgetésbe', async () => {
  renderHub()
  const input = await screen.findByPlaceholderText('Írj vagy mondj valamit Mezónak…')
  await userEvent.type(input, 'Jó reggelt{Enter}')
  expect(await screen.findByText('chat-surface:Jó reggelt')).toBeInTheDocument()
})

test('üres mezővel a küldés nem navigál', async () => {
  renderHub()
  await screen.findByPlaceholderText('Írj vagy mondj valamit Mezónak…')
  await userEvent.click(screen.getByRole('button', { name: 'Küldés' }))
  expect(screen.queryByText(/chat-surface:/)).toBeNull()
  expect(screen.getByText('Jó itt folytatni.')).toBeInTheDocument()
})

test('a mikrofon a hang-hookot indítja', async () => {
  renderHub()
  await userEvent.click(await screen.findByRole('button', { name: 'Hangbevitel' }))
  expect(voiceStore.toggle).toHaveBeenCalledTimes(1)
})

test('a leiratozott szöveg a mezőbe kerül ellenőrzésre — nem megy el azonnal', async () => {
  renderHub()
  const input = await screen.findByPlaceholderText('Írj vagy mondj valamit Mezónak…')
  act(() => voiceStore.onTranscript('reggel fáradt vagyok'))
  expect(input).toHaveValue('reggel fáradt vagyok')
  // Landed in the field for the user to check — it did NOT auto-send/navigate.
  expect(screen.queryByText(/chat-surface:/)).toBeNull()
})

// ── what LEFT the landing ────────────────────────────────────────────────────

test('nincs többé csempe / mozaik / következő lépés / statisztika-sor a nyitóoldalon', async () => {
  renderHub('/nap?dp=este') // este volt az egyetlen napszak, ami extra csempéket/stripet hozott
  await screen.findByText('Megérkeztél.')
  expect(document.querySelector('.mz-mosaic')).toBeNull()
  expect(document.querySelector('.nap-nextstep')).toBeNull()
  expect(document.querySelector('.mz-statcell')).toBeNull()
  // A régi hat csempe egyike sem: se víz, se alvás, se étkezés, se edzés, se rutin, se napló.
  for (const name of ['Hidratáció · részletek', 'Alvás', 'Étkezés', 'Edzés', 'Reggeli rutin', 'Esti rutin', 'Napló']) {
    expect(screen.queryByRole('button', { name })).toBeNull()
  }
  expect(screen.queryByText('Most egy kis lépés')).toBeNull()
})

// ── the rough / anchor day ───────────────────────────────────────────────────

test('horgony mód: ugyanaz a társ + composer, csendesebb köszönéssel, csempék nélkül', async () => {
  scenarioStore.anchorMode = true
  renderHub('/nap?day=rough')
  expect(await screen.findByText('Nehéz nap — ma elég a minimum.')).toBeInTheDocument()
  // The companion and the composer are still here — the entry is the same, only calmer.
  expect(screen.getByRole('button', { name: 'Életjelek' })).toBeInTheDocument()
  expect(screen.getByPlaceholderText('Írj vagy mondj valamit Mezónak…')).toBeInTheDocument()
  expect(document.querySelector('[data-kalauz-anchor="nap-hero"]')).not.toBeNull()
  // A quiet aura, and NO anchor tiles / exit (those tiles are gone with the rest).
  expect(document.querySelector('.nap-titan-quiet')).not.toBeNull()
  expect(document.querySelector('.mz-mosaic')).toBeNull()
  expect(screen.queryByRole('button', { name: /Megvolt —/ })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Kilépés a horgony módból' })).toBeNull()
})

test('horgony módban is a beszélgetésbe küld a composer', async () => {
  scenarioStore.anchorMode = true
  renderHub('/nap?day=rough')
  const input = await screen.findByPlaceholderText('Írj vagy mondj valamit Mezónak…')
  await userEvent.type(input, 'nehéz napom van')
  await userEvent.click(within(document.querySelector('.nap-composer')!).getByRole('button', { name: 'Küldés' }))
  expect(await screen.findByText('chat-surface:nehéz napom van')).toBeInTheDocument()
})
