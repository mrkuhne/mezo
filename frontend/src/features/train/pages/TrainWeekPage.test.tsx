import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { TrainWeekPage } from '@/features/train/pages/TrainWeekPage'
import TrainWeekSkeleton from '@/features/train/pages/TrainWeekSkeleton'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { DAY_ORDER } from '@/data/train/train'
import { localDateString } from '@/shared/lib/dates'
import type { WorkoutDetailResponse } from '@/data/train/trainApi'
import type { RunningBlockResponse } from '@/data/train/runningApi'
import type { MesoDay, SportSchedule, WorkoutPlan } from '@/data/types'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// The over-planned-group test needs a group the stock mock meso never produces — wrap the
// real useTrain and swap in a custom `days` array on top of the otherwise-real activeMeso.
let daysOverride: MesoDay[] | null = null
// The 'entering' test needs a week where SOME work is already logged and today's plan is
// what crosses the MEV floor — a state mock mode has no fixture for (it persists no
// instances at all). Overriding these two reads is the cheapest honest way to stage it.
let workoutOverride: WorkoutPlan | null = null
let weekLogOverride: { details: WorkoutDetailResponse[]; pending?: boolean } | null = null
// The runner-only sport-minutes test needs an empty sport schedule alongside an active
// running block — mock mode's own fixture always carries a volleyball slot.
let sportScheduleOverride: SportSchedule | null | undefined = undefined
let runningBlockOverride: RunningBlockResponse | null = null
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useTrain: (...args: Parameters<typeof actual.useTrain>) => {
      const real = actual.useTrain(...args)
      if (!daysOverride && !workoutOverride && sportScheduleOverride === undefined) return real
      return {
        ...real,
        workout: workoutOverride ?? real.workout,
        activeMeso: daysOverride && real.activeMeso ? { ...real.activeMeso, days: daysOverride } : real.activeMeso,
        sport: sportScheduleOverride !== undefined ? { ...real.sport, schedule: sportScheduleOverride } : real.sport,
      }
    },
    useRunning: (...args: Parameters<typeof actual.useRunning>) => {
      const real = actual.useRunning(...args)
      return runningBlockOverride ? { ...real, activeRunningBlock: runningBlockOverride } : real
    },
    useWeekMuscleLog: (...args: Parameters<typeof actual.useWeekMuscleLog>) => {
      const real = actual.useWeekMuscleLog(...args)
      return weekLogOverride
        ? { ...real, details: weekLogOverride.details, pending: weekLogOverride.pending ?? real.pending }
        : real
    },
  }
})

// The page reads the REAL clock for the Mon–Sun medal window and for the week's own logged
// workouts, so freeze it on the Thursday the fixtures were written against ("Mock today = Csü").
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-05-21T09:00:00'))
  vi.stubEnv('VITE_USE_MOCK', 'true')
  mockNavigate.mockReset()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  daysOverride = null
  workoutOverride = null
  weekLogOverride = null
  sportScheduleOverride = undefined
  runningBlockOverride = null
})

const renderPage = () => render(<QueryWrapper><MemoryRouter><LevelUpProvider><TrainWeekPage /></LevelUpProvider></MemoryRouter></QueryWrapper>)

// ============================================================================
// The hero — the DRAWN percent (T12 Task 3)
// ============================================================================

// Adapted from 'renders the Heti hero, the load tiles and one card per weekday': the hero
// survives with a new face, while the three `.loadtile`s and the seven `.dayrow`s are gone —
// their functions live in the group cards (load) and on Mai's DayStrip (the days; see the
// page header's function inventory).
test('renders the Terhelés hero and one card per muscle group — no load tiles, no day rows', () => {
  const { container } = renderPage()
  expect(screen.getByText(/Terhelés · \d+\. hét/)).toBeInTheDocument()
  expect(container.querySelectorAll('.loadtile')).toHaveLength(0)
  expect(container.querySelectorAll('.dayrow')).toHaveLength(0)
  expect(container.querySelectorAll('.ld-group').length).toBeGreaterThan(0)
})

test('the hero DRAWS the percent: a big numeral plus a bar carrying its own width', () => {
  const { container } = renderPage()
  const hero = container.querySelector('.ld-hero') as HTMLElement
  const numeral = hero.querySelector('.ld-hero-pct b') as HTMLElement
  const percent = Number(numeral.textContent)
  expect(Number.isInteger(percent)).toBe(true)
  expect(hero.querySelector('.ld-hero-pct em')!.textContent).toBe('%')
  const bar = hero.querySelector('.ld-hero-bar i') as HTMLElement
  expect(bar.style.getPropertyValue('--w')).toBe(`${percent}%`)
  // „{done} szett a {planned}-ből" — the sets behind the share, never only the share.
  expect(within(hero).getByText(/szett a \d+-ből/)).toBeInTheDocument()
})

// Mock-empty honesty: the mock week carries NO completed workout instances, so nothing is
// done yet. The page must say so in words and draw nothing — never a fabricated bar.
test('mock-empty honesty: zero done renders the honest words and 0% bars, never fake fill', () => {
  const { container } = renderPage()
  expect((container.querySelector('.ld-hero-pct b') as HTMLElement).textContent).toBe('0')
  expect((container.querySelector('.ld-hero-bar i') as HTMLElement).style.getPropertyValue('--w')).toBe('0%')
  expect(screen.getByText('A hét még előtted van: eddig egyetlen szett sem ment le.')).toBeInTheDocument()
  // Every group card: 0 done ⇒ the word ladder's "the second half of the week builds on this"
  // and a 0% bar. („Mell" is untouched by today's Pull plan too, so its remaining never zeroes.)
  const chest = screen.getByRole('button', { name: 'Mell — ezen a héten' })
  expect(within(chest).getByText('erre a hét második fele épül')).toBeInTheDocument()
  for (const card of container.querySelectorAll('.ld-group')) {
    const zeroDone = within(card as HTMLElement).queryByText(/^0 \/ \d+$/) !== null
    const bar = card.querySelector('.ld-group-bar i') as HTMLElement
    if (zeroDone) expect(bar.style.getPropertyValue('--w')).toBe('0%')
  }
})

// Adapted from 'the izom-zóna panel shows the live zone mini grid': the same live per-group
// done/planned numbers, now on the group cards instead of the retired ZoneMiniGrid.
test('the group cards carry the live done/planned sets per group, biggest contribution first', () => {
  const { container } = renderPage()
  const cards = [...container.querySelectorAll('.ld-group')] as HTMLElement[]
  expect(within(cards.find((c) => c.textContent?.includes('Hát'))!).getByText(/^0 \/ \d+$/)).toBeInTheDocument()
  // loadGroups sorts by done desc, then by the heavier plan — with nothing done, the
  // heaviest-planned group leads.
  const planned = cards.map((c) => Number(/0 \/ (\d+)/.exec(c.textContent ?? '')?.[1] ?? 0))
  expect(planned).toEqual([...planned].sort((a, b) => b - a))
})

// Adapted from 'tapping the izom-zóna panel opens the MuscleWeekSheet': the sheet's content
// migrated into the group GlassBox, per group.
test('tapping a group card opens the glass with THAT group’s per-muscle rows and its XP line', async () => {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'Hát — ezen a héten' }))
  const glass = await screen.findByRole('dialog', { name: 'Hát · ezen a héten' })
  // The migrated MuscleWeekSheet rows: this group's heads, with sets/reps/frequency.
  expect(within(glass).getAllByText(/ismétlés · \d+×\/hét/).length).toBeGreaterThan(0)
  // the XP forecast line always speaks — with an estimate, or with the honest "not yet"
  // (the mock plan carries no weight anchors, so growthForecast has nothing to forecast)
  expect(within(glass).getByText(/XP-előrejelzés ehhez a csoporthoz még nincs/)).toBeInTheDocument()
  // and a leg group's muscles must NOT be in the back group's glass
  expect(within(glass).queryByText('Vádli')).toBeNull()
})

test('the glass closes again with Escape', async () => {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'Mell — ezen a héten' }))
  await screen.findByRole('dialog', { name: 'Mell · ezen a héten' })
  fireEvent.keyDown(document, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

// Adapted from 'an over-budget group cell shows ⚠ in error color': the ⚠ glyph retired with
// ZoneMiniGrid; the same over state now flags itself on the group card in the house amber.
test('an over-planned group flags itself on its card (mezo-oyhy.7 → T12)', () => {
  daysOverride = [{
    day: 'Hét', type: 'Push', muscle: 'chest', exerciseCount: 2,
    exercises: [
      { id: 'ob1', name: 'Bench Press', muscle: 'chest', warmupSets: 1, workingSets: 8, repMin: 4, repMax: 6, targetRIR: 1, type: 'compound', anchorWeightKg: 100 },
      { id: 'ob2', name: 'Cable Fly', muscle: 'chest', warmupSets: 1, workingSets: 8, repMin: 12, repMax: 15, targetRIR: 3, type: 'isolation', anchorWeightKg: 15 },
    ],
  }]
  const { container } = renderPage()
  const chest = screen.getByRole('button', { name: 'Mell — ezen a héten' })
  expect(within(chest).getByText('0 / 16')).toBeInTheDocument()
  // The flag carries the retired ⚠'s exact meaning — the PLAN is over its budget.
  const over = [...container.querySelectorAll('.ld-group[data-plan="over"]')]
  expect(over.length).toBeGreaterThan(0)
  expect(within(over[0] as HTMLElement).getByText('sok')).toBeInTheDocument()
  expect(over[0].textContent).toContain('Mell')
})

// ============================================================================
// Step 2: today's plan feeds the body map so 'entering' can fire
// ============================================================================

// The map heat is drawn from rows that INCLUDE today's plan (the prep-screen precedent,
// ActiveWorkoutPage.tsx :779). Without `todayPlan` the 'entering' status — "today's session
// crosses the floor" — is arithmetically unreachable, and the map could never say it.
// Staged state: 2 chest sets already logged this week (below chest's MEV of 4) and a today
// plan carrying 3 more chest sets — so done alone is 'below', but done+today crosses the
// floor. That is the ONLY arithmetic that produces 'entering', and it is unreachable if
// `todayPlan` is not threaded into weekZoneRows.
test("today's plan feeds the map heat, so 'entering' can actually fire", async () => {
  weekLogOverride = {
    details: [{
      id: 'w-done', templateSessionId: 'ts-1', date: localDateString(), status: 'completed',
      title: 'Push', dayLabel: 'Hét',
      exercises: [{
        exerciseId: 'e-chest', name: 'Bench', muscle: 'chest-mid', type: 'compound',
        warmupSets: 0, workingSets: 2, repMin: 8, repMax: 10, targetRIR: 2, skipped: false,
        sets: [
          { id: 's1', exerciseId: 'e-chest', setIndex: 0, reps: 9, rir: 2, skipped: false, kind: 'working' },
          { id: 's2', exerciseId: 'e-chest', setIndex: 1, reps: 9, rir: 2, skipped: false, kind: 'working' },
        ],
      }],
    }],
  }
  workoutOverride = {
    title: 'Push', tag: '', durationEst: 40, challenges: [],
    exercises: [{
      id: 'p-chest', name: 'Incline', muscle: 'chest-upper', type: 'compound',
      warmupSets: 1, workingSets: 3, repMin: 8, repMax: 10, targetRIR: 2,
      anchorWeightKg: null, sets: 4, prescribedSets: null,
    }],
  } as unknown as WorkoutPlan
  const { container } = renderPage()
  await waitFor(() => expect(container.querySelectorAll('.ld-map-mini .body-map-shape').length).toBeGreaterThan(0))
  // 'entering' renders at the interpolated 0.58 opacity (BodyMap's OPACITY scale); with only
  // 2 sets logged, nothing may reach 'in' (0.72) or 'over' (1).
  const opacities = [...container.querySelectorAll('.ld-map-mini .body-map-shape')]
    .map((g) => Number((g as SVGElement).getAttribute('opacity')))
  expect(opacities).toContain(0.58)
  expect(opacities.some((o) => o >= 0.72)).toBe(false)
})

// ============================================================================
// The doorways, the kept chips and the kept footer
// ============================================================================

test('the map card opens the Izomtérkép subscreen', () => {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: /Elöl és hátul, ami már dolgozott/ }))
  expect(mockNavigate).toHaveBeenCalledWith('/train/week/terkep')
})

test('the Minden mozgásod card opens the Mozgás subscreen', () => {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: /Minden mozgásod a héten/ }))
  expect(mockNavigate).toHaveBeenCalledWith('/train/week/mozgas')
})

test('the sport card names the week’s sport minutes and says it is an estimate', () => {
  renderPage()
  expect(screen.getByText(/perc sport és futás a heti rendben/)).toBeInTheDocument()
  expect(screen.getByText('Becslés — a szettszámokba nem számít bele.')).toBeInTheDocument()
})

// A runner-only user has NO sport (volleyball/cross/TRX) slots at all — only a running
// block. Before the fix, sportMinutes summed sportSlots alone, so the card said "0 perc
// sport" while `reach` (which DOES read runSessions) still listed the muscles running
// touches — a number and a sentence disagreeing on screen.
test('a runner-only week (no sport slots) still counts run minutes and covers both in the headline', () => {
  sportScheduleOverride = { volleyball: { team: '', sessions: [], season: '', weeklyHours: 0 } }
  runningBlockOverride = {
    id: 'rb-runner-only', title: 'Base', kind: 'interval', status: 'active',
    startDate: '2026-05-18', endDate: '2026-06-29', weeks: 6, currentWeek: 1,
    structure: {
      weeks: [{
        weekNumber: 1, phaseLabel: 'Base',
        sessions: [{
          key: 'run-1', dayOfWeek: 2, label: 'Steady', kind: 'steady',
          rpeTarget: { min: 5, max: 6 },
          segments: [{ type: 'work', durationSec: 1800 }],
        }],
      }],
    },
  } as unknown as RunningBlockResponse
  renderPage()
  // 1800s of work = 30 minutes, and no sport slots at all — the number must be run-only,
  // and the headline must not claim "sport" alone when it is really futás doing the work.
  expect(screen.getByText('30 perc sport és futás a heti rendben')).toBeInTheDocument()
})

test('the Mezociklus áttekintő chip navigates to the overview (mezo-hi9m)', () => {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: /Mezociklus áttekintő/ }))
  expect(mockNavigate).toHaveBeenCalledWith('/train/mesocycles/meso-hyp-04/overview')
})

test('the medál count of the week rides in the hero row (mezo-88iwa.13)', () => {
  const { container } = renderPage()
  expect(within(container.querySelector('.ld-hero') as HTMLElement).getByText(/medál e héten/)).toBeInTheDocument()
})

test('the Időpontok chip opens the schedule sheet and reflects a save via local override', async () => {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: /Időpontok/ }))
  expect(screen.getByRole('heading', { name: 'Heti gym-időpontok' })).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Hét időpont'), { target: { value: '06:30' } })
  fireEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Heti gym-időpontok' })).toBeNull())
  fireEvent.click(screen.getByRole('button', { name: /Időpontok/ }))
  expect((screen.getByLabelText('Hét időpont') as HTMLInputElement).value).toBe('06:30')
})

test('keeps the provenance note and the Saját edzés footer', () => {
  renderPage()
  expect(screen.getByText(/A gym a mesociklus szerint/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Saját edzés/ })).toBeInTheDocument()
})

test('the Saját edzés footer opens the sheet (mezo-ws2x)', () => {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: /Saját edzés/ }))
  expect(screen.getByText('Mit nyomunk ma?')).toBeInTheDocument()
  expect(screen.getByText('Pihenőnapi felső')).toBeInTheDocument()
})

test('the kalauz anchor sits on the hero (heti-terheles)', () => {
  const { container } = renderPage()
  expect(container.querySelector('.ld-hero[data-kalauz-anchor="heti-terheles"]')).not.toBeNull()
})

// ============================================================================
// Real mode
// ============================================================================

// Was 'real mode: a weekly gym row completed this week on ANOTHER date routes to its review,
// not a restart'. That routing moved to Mai with the day strip (see the page's function
// inventory; TrainTodayPage.test.tsx covers the review hero), so per the T12 spec this test
// keeps the exact same fixture and asserts what the page NOW owes that state instead: the map
// and the group cards render off the real-mode week, not a blank page.
test('real mode: a week with a pulled-forward completed instance still draws the map and the groups', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const todayLabel = DAY_ORDER[(new Date().getDay() + 6) % 7]
  const otherDayLabel = DAY_ORDER[(DAY_ORDER.indexOf(todayLabel) + 1) % 7]
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () =>
      HttpResponse.json([{
        id: 'm-1', title: 'T2 meso', shortTitle: 'T2', status: 'active',
        startDate: '2026-06-01', endDate: '2026-07-13', weeks: 6, currentWeek: 2,
        split: 'Pull / Push · 2×/hét', style: 'RP · 6 hét', phaseCurve: ['MEV', 'MAV'],
        days: [{
          id: 'd-1', day: otherDayLabel, type: 'Pull Day', muscle: 'back', exerciseCount: 1,
          exercises: [{ id: 'e-1', name: 'Row', muscle: 'back', sets: 4, workingSets: 4, warmupSets: 1, repMin: 8, repMax: 10, targetReps: '8-10', targetRIR: 1, type: 'compound' }],
        }],
      }]),
    ),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/gym-schedule`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/workouts/today`, () => HttpResponse.json({})),
    http.get(`${API_BASE}/api/train/workouts`, () =>
      HttpResponse.json([
        { id: 'w-pulled', templateSessionId: 'd-1', date: localDateString(), status: 'completed', origin: 'meso' },
      ]),
    ),
  )
  const { container } = renderPage()
  await screen.findByRole('button', { name: 'Hát — ezen a héten' })
  expect(container.querySelector('.ld-map-mini')).not.toBeNull()
  expect(container.querySelector('.ld-hero-bar i')).not.toBeNull()
})

// ============================================================================
// Motion + skeleton
// ============================================================================

// Adapted from 'the week body staggers inside the armed entrance group' (mezo-d20.11): the
// stage changed (hero + group cards, no statstrip / day list) but the contract did not —
// an armed EntranceGroup with nothing marked `.rise` is the silent-static bug.
test('the page body staggers inside the armed entrance group', async () => {
  const { container } = renderPage()
  await screen.findByText(/szett a \d+-ből/)
  const play = container.querySelector('.mz-play')
  expect(play).not.toBeNull()
  const hero = play!.querySelector('.ld-hero.rise') as HTMLElement | null
  expect(hero).not.toBeNull()
  expect(hero!.style.getPropertyValue('--d')).toBe('40ms')
  // the group cards ride the prototype's 40ms step, starting at 160ms
  const first = play!.querySelector('.ld-group.rise') as HTMLElement
  expect(first.style.getPropertyValue('--d')).toBe('160ms')
  const second = [...play!.querySelectorAll('.ld-group.rise')][1] as HTMLElement
  expect(second.style.getPropertyValue('--d')).toBe('200ms')
})

// The skeleton must promise the shape the page actually draws — a day list it no longer
// renders would reflow on the swap (the whole reason this file is layout-aware).
test('the skeleton mirrors the new order: hero, one map card, group cards, no day list', () => {
  const { container } = render(<TrainWeekSkeleton />)
  expect(screen.getByRole('status', { name: 'Betöltés…' })).toBeInTheDocument()
  expect(container.querySelectorAll('.card')).toHaveLength(4) // the four group cards
  expect(container.querySelectorAll('.sk').length).toBeGreaterThan(8)
  // the retired face promised seven day cards + three load tiles; neither may survive here
  expect(container.querySelectorAll('.card')).not.toHaveLength(7)
})

// weekLog.pending must gate too (ActiveWorkoutPage.tsx :778 precedent) — without it, real
// mode draws a 0% hero and speaks "a hét még előtted van" while the week's own detail
// fetches are still in flight, then jumps once they land: a loading week rendering as an
// EMPTY week, then silently becoming a different week under the reader's eyes.
test('the week log still loading renders the skeleton, not a fabricated 0% hero', () => {
  weekLogOverride = { details: [], pending: true }
  const { container } = renderPage()
  expect(screen.getByRole('status', { name: 'Betöltés…' })).toBeInTheDocument()
  expect(container.querySelector('.ld-hero')).toBeNull()
  expect(screen.queryByText('A hét még előtted van: eddig egyetlen szett sem ment le.')).toBeNull()
})

test('the week log resolving renders the real hero, not the skeleton', async () => {
  weekLogOverride = { details: [], pending: false }
  renderPage()
  await screen.findByText(/szett a \d+-ből/)
  expect(screen.queryByRole('status', { name: 'Betöltés…' })).toBeNull()
})

// ── the ⓘ explain layer (mezo-b516k, Task 2) ──────────────────────────────────────────
// The button beside the heading, the prototype's copy word for word. The aria-label is
// the prototype's own `"<title> — mit jelent?"`.

test('ⓘ in the hero sentence explains what the weekly number is made of, word for word', async () => {
  renderPage()
  const btn = await screen.findByRole('button', { name: 'Miből áll össze a szám? — mit jelent?' })
  expect(btn.closest('.ld-hero-say')).not.toBeNull()
  fireEvent.click(btn)
  expect(
    within(screen.getByRole('dialog', { name: 'Miből áll össze a szám?' })).getByText(
      'A futó terved e heti szettjeit számoljuk: amit már elvégeztél, osztva azzal, amit a hét kér. A sport perceit külön mutatjuk — az a pihenésed része, nem a szetteké.',
    ),
  ).toBeInTheDocument()
})

test('ⓘ beside „Izomcsoportok ezen a héten" explains the bar, word for word', async () => {
  renderPage()
  const btn = await screen.findByRole('button', { name: 'Mit mutat a sáv? — mit jelent?' })
  expect(btn.closest('h3')?.textContent).toBe('Izomcsoportok ezen a héten')
  fireEvent.click(btn)
  expect(
    within(screen.getByRole('dialog', { name: 'Mit mutat a sáv?' })).getByText(
      'A színes rész az elvégzett szett, a halvány a hét teljes kérése. Egy csoportra koppintva látod, melyik része mennyit kapott, és melyik napokon.',
    ),
  ).toBeInTheDocument()
})

// The prototype puts this one INSIDE the sport card (load-pages.js:95), not beside the
// heading above it. Its art override there is `volley`, which has no clay equivalent —
// `i-sport`, the card's own glyph, is the honest neighbour.
test('ⓘ inside the sport card explains how sport relates to the sets, word for word', async () => {
  const { container } = renderPage()
  const btn = await screen.findByRole('button', { name: 'A sport és a szettek — mit jelent?' })
  expect(btn.closest('.ld-sport')).toBe(container.querySelector('.ld-sport'))
  fireEvent.click(btn)
  expect(
    within(screen.getByRole('dialog', { name: 'A sport és a szettek' })).getByText(
      'A sportod a heti mozgásod és a pihenésed része — a szettszámokba nem számít bele, mert ott a terved emelkedését követjük. A regenerációnál viszont figyelembe vesszük.',
    ),
  ).toBeInTheDocument()
})
