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

  // Folyadék (mezo-n4wf5.3, prototype `futas()`): rendered alone the page keeps its `‹ Edzés` pill;
  // the hero says where the block stands and draws its weeks as tubes.
  test('page head + hero: ‹ Edzés pill, the verdict, one tube per week', () => {
    const { container } = renderView()
    expect(screen.getByRole('button', { name: 'Vissza' })).toHaveTextContent(/‹\s*Edzés/)
    // active block rb-active-01: currentWeek 3 / 8 weeks — stated ONCE, in the hero
    expect(container.querySelector('.fo-hero-verdict')).toHaveTextContent('A 8 hetes blokk 3. hetében jársz.')
    expect(container.querySelector('.fo-hero-sub')).toHaveTextContent(/^Robbanékonyság 01 · e héten \d \/ 2 edzés kész\.$/)
    const tubes = container.querySelectorAll('.fo-hero .fo-hero-g .fo-vial')
    expect(tubes).toHaveLength(8)
    expect(tubes[2]).toHaveClass('now')
    // the weeks still ahead are dry ghost tubes under the „full week" waterline
    expect(container.querySelectorAll('.fo-hero .fo-hero-g .fo-vial.ghost')).toHaveLength(5)
    expect(tubes[7].querySelector('.wl')).not.toBeNull()
    expect(screen.queryByRole('heading', { name: 'Intervallum' })).not.toBeInTheDocument()
    // the old skin is gone from the page
    expect(container.querySelector('.glass, [class*="uvs-"], [class*="mz-"], .stag, .segtabs')).toBeNull()
  })

  test('the stat strip carries the prototype cells', () => {
    renderView()
    expect(screen.getByText('e heti edzés')).toBeInTheDocument()
    expect(screen.getByText('/ hét')).toBeInTheDocument()
    expect(screen.getByText('blokk')).toBeInTheDocument()
  })

  // Structure (prototype `futas()`): hero → the segmented control → numbered sections in white cards.
  test('the page is hero → segmented control → numbered sections', () => {
    const { container } = renderView()
    const page = container.querySelector('.fo-page.es-futas')!
    const kids = [...page.children].map((c) => c.className)
    expect(kids.findIndex((c) => c.includes('fo-hero'))).toBeLessThan(kids.findIndex((c) => c.includes('fo-seg')))
    expect(kids.findIndex((c) => c.includes('fo-seg'))).toBeLessThan(kids.findIndex((c) => c.includes('fo-sec')))
    expect(page.querySelector('.fo-seg')).toHaveAttribute('data-kalauz-anchor', 'futas-tabs')
    expect([...page.querySelectorAll('.fo-sec')].map((h) => h.textContent)).toEqual(
      ['1E hét · 2 edzés', '2Keresztterhelés · futás és láb'])
  })

  test('default (E heti edzés) renders this week\'s sessions, each with its interval tube, and the cross-load note', () => {
    const { container } = renderView()
    // week 3 prescribes both sessions
    expect(screen.getByText('Sprint-intervallum')).toBeInTheDocument()
    expect(screen.getByText('Piramis-intervallum')).toBeInTheDocument()
    // every session draws its interval tube: the sprint's work + rest pair repeats per round
    const tubes = container.querySelectorAll('.es-logs .es-log .es-ivl')
    expect(tubes).toHaveLength(2)
    expect(tubes[0].querySelectorAll('i.s')).toHaveLength(6) // week 3: 6 sprint rounds
    expect(tubes[1].querySelectorAll('i.s')).toHaveLength(6) // the pyramid's six work segments
    // R4: derived cross-load → gym leg volume note renders under the sessions, in plain words
    expect(screen.getByText('Comb / Lábhajlító · −2 szett')).toBeInTheDocument()
    expect(screen.queryByText(/Phase 3|eccentric|MAV/)).not.toBeInTheDocument()
  })

  test('the pyramid session pills join its work segments and honestly note the derived rest', () => {
    renderView()
    // Week 3 fri-pyramid: [15, 30, 45, 45, 30, 15] seconds.
    expect(screen.getByText('15／30／45／45／30／15 mp')).toBeInTheDocument()
    expect(screen.getByText('pihenő = szakasz × 2')).toBeInTheDocument()
  })

  test('each prescribed session row leads with the run glyph and says day · time · RPE target', () => {
    const { container } = renderView()
    const rows = container.querySelectorAll('.es-logs .es-log .fo-row')
    expect(rows).toHaveLength(2)
    rows.forEach((row) => expect(row.querySelector('use')?.getAttribute('href')).toBe('#t-run'))
    expect(rows[0].querySelector('small')).toHaveTextContent('Kedd · 18:00 · RPE 9–10')
  })

  test('Napló switcher shows the logged run sessions', async () => {
    const { container } = renderView()
    await userEvent.click(screen.getByRole('button', { name: 'Napló' }))
    // rs-01: rpeActual 9, 6 rounds; sessionKey tue-sprint -> "Sprint" + the „Futás" pill
    const rows = container.querySelectorAll('.es-runs .fo-row')
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0].querySelector('strong')).toHaveTextContent(/^Sprint\s*Futás$/)
    expect(rows[0].querySelector('small')).toHaveTextContent(/RPE 9 · 6 kör/)
    expect(rows[0].querySelector('.v')).toHaveTextContent(/^42\s*mp pulzus$/)
  })

  test('Napló shows the pulzus-megnyugvás (HR-recovery) trend — hrRecoverySec already exists on both fixtures', async () => {
    renderView()
    await userEvent.click(screen.getByRole('button', { name: 'Napló' }))
    const { container } = { container: document.body }
    expect(screen.getByRole('heading', { name: /Pulzus-megnyugvás · utolsó 2 futás/ })).toBeInTheDocument()
    // rs-02 (jún 26, hr 50) -> rs-01 (jún 30, hr 42): improvement, so a non-positive
    // delta, rendered without a leading "+" (never punished, never red).
    const card = container.querySelector('.es-hr.is-better')!
    expect(card.querySelector('.fo-big')).toHaveTextContent(/^−8\s*mp az első óta$/)
    // the trend is a liquid surface; the ink point names the latest value
    expect(card.querySelector('svg.fo-area .fo-area-now text')).toHaveTextContent('42 mp')
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
      expect(screen.getByText('Ma')).toHaveClass('fo-st', 'plan')
      expect(screen.getByRole('button', { name: 'Naplózd ›' })).toBeInTheDocument()
      // Folyadék: the hero's one button is the same session, spelled out.
      expect(screen.getByRole('button', { name: 'Naplózd · Piramis-intervallum' }).closest('.fo-hero-acts')).not.toBeNull()
      // The already-logged sprint session shows the done pill, not a button.
      expect(screen.getByText('Kész')).toHaveClass('fo-st', 'ok')
    })

    test('múlt: today is after the pyramid\'s weekday → "Pótold ›" opens the RunLogSheet', async () => {
      vi.setSystemTime(new Date('2026-07-18T12:00:00')) // Saturday — Friday's session is in the past
      renderView()
      const potold = screen.getByRole('button', { name: 'Pótold ›' })
      await userEvent.click(potold)
      expect(await screen.findByText('Hogy ment?')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
    })

    test('jövő: today is before the pyramid\'s weekday → disabled grey "Naplózás ›", not a button', () => {
      vi.setSystemTime(new Date('2026-07-15T12:00:00')) // Wednesday — Friday's session hasn't happened yet
      renderView()
      expect(screen.queryByRole('button', { name: /Naplózás/ })).not.toBeInTheDocument()
      expect(screen.getByText('Naplózás ›')).toBeInTheDocument() // üveg: ▸ → the typographic ›
    })

    test('pyramid log sheet ALSO shows the completed-rounds stepper (the honest capture for the F6.3 scoring fix)', async () => {
      vi.setSystemTime(new Date('2026-07-17T12:00:00')) // Friday → the pyramid session is "MA"
      renderView()
      // opened from the hero's button — the same sheet as the row's link
      await userEvent.click(screen.getByRole('button', { name: 'Naplózd · Piramis-intervallum' }))
      expect(await screen.findByText('Hogy ment?')).toBeInTheDocument()
      expect(screen.getByText('Futás log · Piramis-intervallum')).toBeInTheDocument()
      // the sheet redraws the session's interval tube under its head
      expect(document.querySelector('.fo-sheet .es-ivl')?.querySelectorAll('i.s')).toHaveLength(6)
      // Week 3's fri-pyramid has 6 prescribed work segments — the default honestly
      // mirrors the ladder length (pyramid has no explicit `rounds` field).
      expect(screen.getByText('Teljesített körök')).toBeInTheDocument()
      expect(screen.getByText('piramis-szakaszok · a haladás ebből számol')).toBeInTheDocument()
      expect(screen.getByLabelText('Teljesített körök')).toHaveValue('6')
    })

    test('logging a run presents the level-up overlay (mock fixture)', async () => {
      vi.setSystemTime(new Date('2026-07-18T12:00:00')) // Saturday → the pyramid session is loggable ("Pótold")
      renderView()
      await userEvent.click(screen.getByRole('button', { name: 'Pótold ›' }))
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
    // while the query is pending the page shows its loading face, then the honest empty states
    expect((await screen.findAllByText(/Nincs aktív futóterved/)).length).toBe(2) // the hero's verdict + the week card
    expect(document.querySelector('.fo-hero-verdict')).toHaveTextContent('Nincs aktív futóterved.')
    expect(document.querySelector('.fo-ev')).toHaveTextContent('Nincs aktív futóterved — a Tervek fülön aktiválj egyet.')
  })
})

// ---- Folyadék: the library rows and the loading face (mezo-n4wf5.3, prototype `futas('tervek')` / `futas('tolt')`) ----
describe('RunningPage · Tervek + loading (Folyadék)', () => {
  afterEach(() => vi.unstubAllEnvs())

  test('Tervek: three numbered sections; a row opens the editor; the hero button becomes ＋ Új terv', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const { container } = renderView()
    await userEvent.click(screen.getByRole('button', { name: 'Tervek' }))
    expect([...container.querySelectorAll('.fo-sec')].map((h) => h.textContent)).toEqual(['1Aktív · 1', '2Tervezett · 1', '3Archív · 1'])
    expect(container.querySelector('.fo-hero-acts')).toHaveTextContent('＋ Új terv')
    const active = container.querySelector('.es-plans .fo-row') as HTMLElement
    expect(active.tagName).toBe('BUTTON')
    expect(active.querySelector('.fo-st.ok')).toHaveTextContent('aktív')
    // the block's weeks as capsules: two done, the third half
    expect(active.querySelectorAll('.fo-caps.wide i')).toHaveLength(8)
    expect(active.querySelectorAll('.fo-caps.wide i.f')).toHaveLength(2)
    expect(active.querySelectorAll('.fo-caps.wide i.h')).toHaveLength(1)
    expect(screen.queryByText(/Builder/)).not.toBeInTheDocument()
  })

  test('real mode: while the blocks load the page shows its skeleton, not an empty state', () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    renderView()
    expect(screen.getByRole('status', { name: 'Betöltés…' })).toHaveClass('fo-sk')
    expect(screen.queryByText(/Nincs aktív futóterved/)).not.toBeInTheDocument()
  })
})
