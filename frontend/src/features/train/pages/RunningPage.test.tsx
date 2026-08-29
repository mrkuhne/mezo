import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { RunningPage } from '@/features/train/pages/RunningPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'

// Real-mode tests mock the api module (mirrors trainHooks.test's mocking style):
// blocks/runSessions both resolve to [] so the view exercises its ghost states.
vi.mock('@/data/train/runningApi', () => ({
  runningApi: {
    blocks: vi.fn().mockResolvedValue([]),
    runSessions: vi.fn().mockResolvedValue([]),
  },
}))

// RunningPage now calls useNavigate (opens the /train/futas/:id builder), so a
// Router context is required around it.
const renderView = () =>
  render(
    <QueryWrapper>
      <MemoryRouter>
        <LevelUpProvider>
          <RunningPage />
        </LevelUpProvider>
      </MemoryRouter>
    </QueryWrapper>,
  )

// ---- MOCK mode: static Phase-1 running data served synchronously ----
describe('RunningPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  // Mozaik 2.0 re-face (mezo-d20.11): the prototype's #page-futas head is a
  // `‹ Edzés` back chip; the page name + `Hét cur/weeks` live in the hero.
  test('page head + Mozaik hero: ‹ Edzés chip, page name, week big number', () => {
    const { container } = renderView()
    expect(screen.getByRole('button', { name: 'Vissza' })).toHaveTextContent('‹ Edzés')
    expect(container.querySelector('.mz-hero-nm')).toHaveTextContent('Futás')
    // active block rb-active-01: currentWeek 3 / 8 weeks — stated ONCE, in the hero
    expect(container.querySelector('.mz-bignum')).toHaveTextContent('3/8')
    expect(screen.queryByRole('heading', { name: 'Intervallum' })).not.toBeInTheDocument()
  })

  test('the stat strip carries the prototype cells', () => {
    renderView()
    expect(screen.getByText('e heti edzés')).toBeInTheDocument()
    expect(screen.getByText('/ hét')).toBeInTheDocument()
    expect(screen.getByText('blokk')).toBeInTheDocument()
  })

  // Motion (mezo-d20.11): the page had NO entrance choreography at all.
  test('the page arms the entrance choreography and staggers its children', () => {
    const { container } = renderView()
    const play = container.querySelector('.mz-play')
    expect(play).not.toBeNull()
    expect(play!.querySelector('.mz-statstrip.rise')).not.toBeNull()
    expect(play!.querySelector('.segtabs.rise')).not.toBeNull()
    expect(play!.querySelectorAll('.rise').length).toBeGreaterThan(3)
  })

  test('default (E heti edzés) renders the active block card + this week sessions', () => {
    renderView()
    // week 3 prescribes both sessions
    expect(screen.getByText('Sprint-intervallum')).toBeInTheDocument()
    expect(screen.getByText('Piramis-intervallum')).toBeInTheDocument()
    // R4: derived cross-load → gym leg volume note renders under the sessions
    expect(screen.getByText(/Cross-load/i)).toBeInTheDocument()
  })

  test('the pyramid session pills join its work segments and honestly note the derived rest', () => {
    renderView()
    // Week 3 fri-pyramid: [15, 30, 45, 45, 30, 15] seconds.
    expect(screen.getByText('15／30／45／45／30／15 mp')).toBeInTheDocument()
    expect(screen.getByText('pihenő = szakasz × 2')).toBeInTheDocument()
  })

  test('each prescribed session row carries the stag-run FUTÁS tag', () => {
    renderView()
    const tags = screen.getAllByText('FUTÁS')
    expect(tags.length).toBeGreaterThan(0)
    expect(tags[0]).toHaveClass('stag', 'stag-run')
  })

  test('Napló switcher shows the logged run sessions', async () => {
    renderView()
    await userEvent.click(screen.getByRole('button', { name: 'Napló' }))
    // rs-01: rpeActual 9 -> "RPE 9" chip; sessionKey tue-sprint -> "Sprint" label
    expect(screen.getByText('RPE 9')).toBeInTheDocument()
    expect(screen.getByText('Sprint')).toBeInTheDocument()
    // Napló rows also carry the stag-run FUTÁS type tag (mirrors the week view cards).
    expect(screen.getAllByText('FUTÁS')[0]).toHaveClass('stag', 'stag-run')
  })

  test('Napló shows the pulzus-megnyugvás (HR-recovery) trend — hrRecoverySec already exists on both fixtures', async () => {
    renderView()
    await userEvent.click(screen.getByRole('button', { name: 'Napló' }))
    expect(screen.getByText(/Pulzus-megnyugvás/)).toBeInTheDocument()
    // rs-02 (jún 26, hr 50) -> rs-01 (jún 30, hr 42): improvement, so a non-positive
    // delta, rendered without a leading "+" (never punished, never red).
    expect(screen.getByText('-8 mp')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
  })

  test('Tervek switcher renders the full block library (all three titles)', async () => {
    renderView()
    await userEvent.click(screen.getByRole('button', { name: 'Tervek' }))
    expect(screen.getByText('Robbanékonyság 01')).toBeInTheDocument()
    expect(screen.getByText('5K-alapozó')).toBeInTheDocument()
    expect(screen.getByText('Téli base 02')).toBeInTheDocument()
  })

  test('restores the last segment after a remount (breadcrumb-back → Tervek, not the default)', async () => {
    const first = renderView()
    await userEvent.click(screen.getByRole('button', { name: 'Tervek' }))
    expect(screen.getByText('Robbanékonyság 01')).toBeInTheDocument() // on Tervek
    first.unmount() // simulate navigating into the /train/futas/:id builder

    renderView() // simulate breadcrumb-back to /train/futas (a fresh mount)
    // Restored on Tervek, NOT snapped back to the default "E heti edzés" segment.
    expect(screen.getByRole('button', { name: 'Tervek' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Robbanékonyság 01')).toBeInTheDocument()
  })

  // The three-way CTA (MA→Naplózd / múlt→Pótold / jövő→disabled Naplózás / KÉSZ)
  // is keyed on the real weekday vs. each prescribed session's dayOfWeek, so
  // these tests pin the clock. Week 3's tue-sprint already has a log (rs-01)
  // → always KÉSZ; fri-pyramid has none, so its CTA is date-driven.
  describe('three-way CTA (pinned clock)', () => {
    beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }))
    afterEach(() => vi.useRealTimers())

    test('MA: today is the pyramid session\'s weekday (Friday) → "Naplózd ›"', async () => {
      vi.setSystemTime(new Date('2026-07-17T12:00:00')) // Friday
      renderView()
      expect(screen.getByText('MA')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Naplózd/ })).toBeInTheDocument()
      // The already-logged sprint session shows the done badge, not a button.
      expect(screen.getByText('KÉSZ ✓')).toBeInTheDocument()
    })

    test('múlt: today is after the pyramid\'s weekday → "Pótold ›" opens the RunLogSheet', async () => {
      vi.setSystemTime(new Date('2026-07-18T12:00:00')) // Saturday — Friday's session is in the past
      renderView()
      const potold = screen.getByRole('button', { name: /Pótold/ })
      await userEvent.click(potold)
      expect(await screen.findByText('Hogy ment?')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
    })

    test('jövő: today is before the pyramid\'s weekday → disabled grey "Naplózás ▸", not a button', () => {
      vi.setSystemTime(new Date('2026-07-15T12:00:00')) // Wednesday — Friday's session hasn't happened yet
      renderView()
      expect(screen.queryByRole('button', { name: /Naplózás/ })).not.toBeInTheDocument()
      expect(screen.getByText('Naplózás ▸')).toBeInTheDocument()
    })

    test('pyramid log sheet ALSO shows the completed-rounds stepper (the honest capture for the F6.3 scoring fix)', async () => {
      vi.setSystemTime(new Date('2026-07-17T12:00:00')) // Friday → the pyramid session is "MA"
      renderView()
      await userEvent.click(screen.getByRole('button', { name: /Naplózd/ }))
      expect(await screen.findByText('Hogy ment?')).toBeInTheDocument()
      // Week 3's fri-pyramid has 6 prescribed work segments — the default honestly
      // mirrors the ladder length (pyramid has no explicit `rounds` field).
      expect(screen.getByText('Teljesített körök')).toBeInTheDocument()
      expect(screen.getByText('piramis-szakaszok · a haladás ebből számol')).toBeInTheDocument()
      expect(screen.getByLabelText('Teljesített körök')).toHaveValue('6')
    })

    test('logging a run presents the level-up overlay (mock fixture)', async () => {
      vi.setSystemTime(new Date('2026-07-18T12:00:00')) // Saturday → the pyramid session is loggable ("Pótold")
      renderView()
      await userEvent.click(screen.getByRole('button', { name: /Pótold/ }))
      await userEvent.click(await screen.findByRole('button', { name: /Mentés/ }))
      // The mock logRunSession returns a seeded LevelUpResult → the overlay shows.
      expect(await screen.findByRole('dialog', { name: 'Szintlépés' })).toBeInTheDocument()
    })
  })
})

// ---- REAL mode, empty backend: ghost states, no crash ----
describe('RunningPage (real mode, empty)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('week segment shows the GhostState when no active block exists', async () => {
    renderView()
    expect(
      await screen.findByText(/Nincs aktív futóterved/),
    ).toBeInTheDocument()
  })
})
