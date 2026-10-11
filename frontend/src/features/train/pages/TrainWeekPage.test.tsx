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
// The hero — the tank: done sets of the planned ones (Folyadék F3)
// ============================================================================

// The Terhelés hero is the kit tank; the load tiles, the day rows and the old `.ld-` group
// tiles are gone — the groups are rows of one card, the days live on Mai's DayStrip.
test('renders the Terhelés hero and one row per muscle group — no load tiles, no day rows', () => {
  const { container } = renderPage()
  expect(screen.getByText(/Terhelés · \d+\. hét/)).toBeInTheDocument()
  expect(container.querySelectorAll('.loadtile')).toHaveLength(0)
  expect(container.querySelectorAll('.dayrow')).toHaveLength(0)
  expect(container.querySelectorAll('.et-grp').length).toBeGreaterThan(0)
})

test('the hero is the tank: the numeral is the done sets, the caption carries the plan and the share', () => {
  const { container } = renderPage()
  const tank = container.querySelector('.fo-tank') as HTMLElement
  const numeral = tank.querySelector('.fo-tank-n b') as HTMLElement
  const done = Number(numeral.textContent)
  expect(Number.isInteger(done)).toBe(true)
  // „szett a {planned}-ből · {share}%" — the sets behind the share, never only the share.
  const cap = tank.querySelector('.fo-tank-n small')!.textContent ?? ''
  const m = /^szett a (\d+)-ből · (\d+)%$/.exec(cap)
  expect(m).not.toBeNull()
  const planned = Number(m![1])
  expect(Number(m![2])).toBe(planned > 0 ? Math.round(Math.min(1, done / planned) * 100) : 0)
  // the scale marks are the plan's quarters, top down
  const marks = [...tank.querySelectorAll('.fo-tank-marks span')].map((s) => Number(s.textContent))
  expect(marks).toEqual([1, 0.75, 0.5, 0.25].map((x) => Math.round(planned * x)))
  // a level is set on the vessel (the kit bands it so the sentence keeps its air)
  expect(tank.style.getPropertyValue('--fo-tank-lv')).toMatch(/^\d+%$/)
})

// Mock-empty honesty: the mock week carries NO completed workout instances, so nothing is
// done yet. The page must say so in words and draw nothing — never a fabricated level.
test('mock-empty honesty: zero done renders the honest words and empty vessels, never fake fill', () => {
  const { container } = renderPage()
  expect((container.querySelector('.fo-tank-n b') as HTMLElement).textContent).toBe('0')
  expect(container.querySelector('.fo-tank-n small')!.textContent).toMatch(/· 0%$/)
  expect(screen.getByText('A hét még előtted van: eddig egyetlen szett sem ment le.')).toBeInTheDocument()
  // Every group row: 0 done ⇒ the word ladder's "the second half of the week builds on this"
  // and an empty vessel. („Mell" is untouched by today's Pull plan too, so its remaining never zeroes.)
  const chest = screen.getByRole('button', { name: 'Mell — ezen a héten' })
  expect(within(chest).getByText('erre a hét második fele épül')).toBeInTheDocument()
  const rows = [...container.querySelectorAll('.et-grp')] as HTMLElement[]
  expect(rows.length).toBeGreaterThan(0)
  for (const row of rows) {
    const zeroDone = within(row).queryByText(/^0 \/ \d+$/) !== null
    const level = row.querySelector('.fo-wlv i') as HTMLElement
    if (zeroDone) expect(level.style.width).toBe('0%')
  }
})

test('the group rows carry the live done/planned sets per group, biggest contribution first', () => {
  const { container } = renderPage()
  const rows = [...container.querySelectorAll('.et-grp')] as HTMLElement[]
  expect(within(rows.find((c) => c.textContent?.includes('Hát'))!).getByText(/^0 \/ \d+$/)).toBeInTheDocument()
  // loadGroups sorts by done desc, then by the heavier plan — with nothing done, the
  // heaviest-planned group leads.
  const planned = rows.map((c) => Number(/0 \/ (\d+)/.exec(c.textContent ?? '')?.[1] ?? 0))
  expect(planned).toEqual([...planned].sort((a, b) => b - a))
  // each row draws its level in the group's own (deepened) colour, in the kit's vessel
  for (const row of rows) expect((row.querySelector('.fo-wlv') as HTMLElement).style.getPropertyValue('--c')).toContain('color-mix')
})

test('tapping a group row opens the sheet with THAT group’s per-muscle rows and its XP line', async () => {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'Hát — ezen a héten' }))
  const sheet = await screen.findByRole('dialog', { name: 'Hát · ezen a héten' })
  expect(sheet.classList.contains('fo-sheet')).toBe(true)
  // the head says the group's numbers and its word
  expect(within(sheet).getByRole('heading', { name: /^0 \/ \d+ szett$/ })).toBeInTheDocument()
  expect(within(sheet).getByText('erre a hét második fele épül')).toBeInTheDocument()
  // this group's heads, with sets/reps/frequency.
  expect(within(sheet).getAllByText(/ismétlés · \d+×\/hét/).length).toBeGreaterThan(0)
  // the XP forecast line always speaks — with an estimate, or with the honest "not yet"
  // (the mock plan carries no weight anchors, so growthForecast has nothing to forecast)
  expect(within(sheet).getByText(/XP-előrejelzés ehhez a csoporthoz még nincs/)).toBeInTheDocument()
  // and a leg group's muscles must NOT be in the back group's sheet
  expect(within(sheet).queryByText('Vádli')).toBeNull()
})

// The sport/run stimulus of a muscle is drawn as drops (1–3) with its source — an estimate,
// and the sheet says so.
test('a group the sport reaches shows the stimulus as drops, with the estimate note', async () => {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'Váll — ezen a héten' }))
  const sheet = await screen.findByRole('dialog', { name: 'Váll · ezen a héten' })
  const sources = [...sheet.querySelectorAll('.fo-evc em')] as HTMLElement[]
  expect(sources.length).toBeGreaterThan(0)
  expect(sources[0].querySelectorAll('.fo-dm i')).toHaveLength(3)
  expect(sources[0].querySelectorAll('.fo-dm i.f').length).toBeGreaterThan(0)
  expect(within(sheet).getByText(/A cseppek a sport és a futás plusz-terhelését jelzik/)).toBeInTheDocument()
})

test('the sheet closes again with Escape', async () => {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'Mell — ezen a héten' }))
  await screen.findByRole('dialog', { name: 'Mell · ezen a héten' })
  fireEvent.keyDown(document, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

// The retired ⚠'s exact meaning — the PLAN is over its budget — flags itself on the group row.
test('an over-planned group flags itself on its row (mezo-oyhy.7 → T12)', () => {
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
  const over = [...container.querySelectorAll('.et-grp[data-plan="over"]')]
  expect(over.length).toBeGreaterThan(0)
  expect(within(over[0] as HTMLElement).getByText(/sok/)).toHaveClass('et-much')
  expect(over[0].textContent).toContain('Mell')
})

// ============================================================================
// Today's plan feeds the body so 'entering' can fire
// ============================================================================

// The body is poured from rows that INCLUDE today's plan. Without `todayPlan` the 'entering'
// status — "today's session crosses the floor" — is arithmetically unreachable. Staged state:
// 2 chest sets already logged this week (below chest's MEV of 4) and a today plan carrying 3
// more chest sets — so done alone is 'below', but done+today crosses the floor.
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
  const map = container.querySelector('.et-mapc .et-map') as HTMLElement
  await waitFor(() => expect(map.querySelectorAll('[data-shape]').length).toBeGreaterThan(0))
  // the levels the live logic handed out: with only 2 sets logged, chest is 'entering' and
  // nothing may reach 'in' or 'over'.
  const levels = (map.dataset.heat ?? '').split(' ').map((x) => x.split(':')[1])
  expect(levels).toContain('entering')
  expect(levels.some((l) => l === 'in' || l === 'over')).toBe(false)
  // logged work stands deep in the vessel, over the pale plan
  expect(map.querySelectorAll('.ex-body .dn').length).toBeGreaterThan(0)
  expect(map.querySelectorAll('.ex-body .pl').length).toBeGreaterThan(0)
})

// ============================================================================
// The doorways and the kept rows
// ============================================================================

test('the map card opens the Izomtérkép subscreen', () => {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: /Elöl és hátul, ami már dolgozott/ }))
  expect(mockNavigate).toHaveBeenCalledWith('/train/week/terkep')
})

test('the tank’s own button opens the Izomtérkép subscreen too', () => {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: /^A tested térképe/ }))
  expect(mockNavigate).toHaveBeenCalledWith('/train/week/terkep')
})

test('the Minden mozgásod row opens the Mozgás subscreen', () => {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: /Minden mozgásod a héten/ }))
  expect(mockNavigate).toHaveBeenCalledWith('/train/week/mozgas')
})

test('the sport card names the week’s sport minutes, the reach as drops, and says it is an estimate', () => {
  const { container } = renderPage()
  const card = container.querySelector('.et-sport') as HTMLElement
  expect(card.querySelector('.fo-big')!.textContent).toMatch(/^\d+perc sport és futás a heti rendben$/)
  expect(within(card).getByText(/^Ezeket is dolgoztatja: /)).toBeInTheDocument()
  const reach = [...card.querySelectorAll('.et-reach .fo-row')]
  expect(reach.length).toBeGreaterThan(0)
  for (const row of reach) expect(row.querySelectorAll('.fo-dm i')).toHaveLength(3)
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
  const { container } = renderPage()
  // 1800s of work = 30 minutes, and no sport slots at all — the number must be run-only,
  // and the headline must not claim "sport" alone when it is really futás doing the work.
  expect(container.querySelector('.et-sport .fo-big')!.textContent).toBe('30perc sport és futás a heti rendben')
})

test('the Mezociklus áttekintő row navigates to the overview (mezo-hi9m)', () => {
  renderPage()
  const row = screen.getByRole('button', { name: /Mezociklus áttekintő/ })
  expect(row.textContent).toMatch(/· \d+\. hét \/ \d+/)
  fireEvent.click(row)
  expect(mockNavigate).toHaveBeenCalledWith('/train/mesocycles/meso-hyp-04/overview')
})

test('the medál count of the week is a row of the last card (mezo-88iwa.13)', () => {
  const { container } = renderPage()
  const row = within(container.querySelector('.fo-page') as HTMLElement).getByText(/^\d+ medál e héten$/)
  expect(row.closest('.fo-row')!.querySelector('use')?.getAttribute('href')).toBe('#t-record')
})

test('weekly load has no duplicate schedule editor after central settings migration', () => {
  renderPage()
  expect(screen.queryByRole('button', { name: /Időpontok/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Heti gym-időpontok' })).not.toBeInTheDocument()
})

test('keeps the provenance note and the Saját edzés link', () => {
  renderPage()
  expect(screen.getByText(/A terem a mesociklus szerint megy, a sport a saját heti rendjén/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Saját edzés/ })).toBeInTheDocument()
})

test('the Saját edzés link opens the sheet (mezo-ws2x)', () => {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: /Saját edzés/ }))
  expect(screen.getByText('Pihenőnapi felső')).toBeInTheDocument()
})

test('the kalauz anchor sits on the hero (heti-terheles)', () => {
  const { container } = renderPage()
  expect(container.querySelector('.fo-tank[data-kalauz-anchor="heti-terheles"]')).not.toBeNull()
})

// ============================================================================
// Real mode
// ============================================================================

// The fixture of the old 'a weekly gym row completed this week on ANOTHER date routes to its
// review' test (that routing moved to Mai with the day strip); what the page owes that state
// is the map and the group rows off the real-mode week, not a blank page.
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
  expect(container.querySelector('.et-mapc .et-map')).not.toBeNull()
  expect(container.querySelector('.fo-tank')).not.toBeNull()
  // the mesocycle row reads the real plan's own short name
  expect(screen.getByRole('button', { name: /Mezociklus áttekintő/ }).textContent).toContain('T2 · 2. hét / 6')
})

// ============================================================================
// The page skeleton + the loading face
// ============================================================================

// Replaces 'the page body staggers inside the armed entrance group' (mezo-d20.11): the
// Mozaik entrance stage left with the old face. What the page owes now is the Folyadék
// skeleton (bible §2.1): the hero first, then the numbered sections, each followed by its card.
test('the page follows the Folyadék skeleton: tank, then four numbered sections with their cards', async () => {
  const { container } = renderPage()
  await screen.findByText(/szett a \d+-ből/)
  const page = container.querySelector('.fo-page') as HTMLElement
  expect(page.firstElementChild!.classList.contains('fo-tank')).toBe(true)
  const heads = [...page.querySelectorAll(':scope > .fo-sec')] as HTMLElement[]
  expect(heads.map((h) => h.textContent)).toEqual([
    '1A tested térképe', '2Izomcsoportok ezen a héten', '3Sport a héten', '4Mozgás és terv',
  ])
  for (const h of heads) expect(h.nextElementSibling!.classList.contains('fo-card')).toBe(true)
  // the old Mozaik stage is gone
  expect(container.querySelector('.mz-play')).toBeNull()
})

// The skeleton must promise the shape the page actually draws: the tank, the map card, the
// group card — one block each, in the page's own heights.
test('the skeleton mirrors the page: one block for the tank, the map card and the group card', () => {
  const { container } = render(<TrainWeekSkeleton />)
  expect(screen.getByRole('status', { name: 'Betöltés…' })).toBeInTheDocument()
  const blocks = [...container.querySelectorAll('.fo-sk i')] as HTMLElement[]
  expect(blocks.map((b) => b.style.height)).toEqual(['356px', '110px', '340px'])
  // nothing of the retired skeleton (cards, bars) survives
  expect(container.querySelectorAll('.card, .sk')).toHaveLength(0)
})

// weekLog.pending must gate too (ActiveWorkoutPage.tsx :778 precedent) — without it, real
// mode draws an empty tank and speaks "a hét még előtted van" while the week's own detail
// fetches are still in flight, then jumps once they land: a loading week rendering as an
// EMPTY week, then silently becoming a different week under the reader's eyes.
test('the week log still loading renders the skeleton, not a fabricated empty tank', () => {
  weekLogOverride = { details: [], pending: true }
  const { container } = renderPage()
  expect(screen.getByRole('status', { name: 'Betöltés…' })).toBeInTheDocument()
  expect(container.querySelector('.fo-tank')).toBeNull()
  expect(screen.queryByText('A hét még előtted van: eddig egyetlen szett sem ment le.')).toBeNull()
})

test('the week log resolving renders the real hero, not the skeleton', async () => {
  weekLogOverride = { details: [], pending: false }
  renderPage()
  await screen.findByText(/szett a \d+-ből/)
  expect(screen.queryByRole('status', { name: 'Betöltés…' })).toBeNull()
})

// ── the explain layer (mezo-b516k, Task 2) ─────────────────────────────────────────────
// On the Folyadék face the three explanations are text links under their card (the
// prototype's `info` sheet); the accessible name stays `"<title> — mit jelent?"`.

test('the link under the map doorway explains what the weekly number is made of, and draws it', async () => {
  const { container } = renderPage()
  const btn = await screen.findByRole('button', { name: 'Miből áll össze a szám? — mit jelent?' })
  expect(btn.textContent).toBe('Miből áll össze a szám?')
  expect(btn.closest('.fo-card')).toBe(container.querySelector('.et-mapc')!.closest('.fo-card'))
  fireEvent.click(btn)
  const sheet = screen.getByRole('dialog', { name: 'Miből áll össze a szám?' })
  expect(
    within(sheet).getByText(
      'A futó terved e heti szettjeit számoljuk: amit már elvégeztél, osztva azzal, amit a hét kér. A sport perceit külön mutatjuk — az a pihenésed része, nem a szetteké.',
    ),
  ).toBeInTheDocument()
  // the number it explains, drawn: done sets in the week's vessel, the plan at its rim
  expect(sheet.querySelector('.fo-level')).not.toBeNull()
  expect(within(sheet).getByText('0 szett megvan')).toBeInTheDocument()
  expect(sheet.querySelector('.fo-level b')!.textContent).toMatch(/^\d+$/)
})

test('the link under the group rows explains the bar, word for word', async () => {
  renderPage()
  const btn = await screen.findByRole('button', { name: 'Mit mutat a sáv? — mit jelent?' })
  expect(btn.closest('.et-groups')).not.toBeNull()
  fireEvent.click(btn)
  expect(
    within(screen.getByRole('dialog', { name: 'Mit mutat a sáv?' })).getByText(
      'A színes rész az elvégzett szett, a halvány a hét teljes kérése. Egy csoportra koppintva látod, melyik része mennyit kapott.',
    ),
  ).toBeInTheDocument()
})

test('the link inside the sport card explains how sport relates to the sets, word for word', async () => {
  const { container } = renderPage()
  const btn = await screen.findByRole('button', { name: 'A sport és a szettek — mit jelent?' })
  expect(btn.closest('.et-sport')).toBe(container.querySelector('.et-sport'))
  fireEvent.click(btn)
  expect(
    within(screen.getByRole('dialog', { name: 'A sport és a szettek' })).getByText(
      'A sportod a heti mozgásod és a pihenésed része — a szettszámokba nem számít bele, mert ott a terved emelkedését követjük. A regenerációnál viszont figyelembe vesszük.',
    ),
  ).toBeInTheDocument()
})

// ── Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `terheles`) ─────────────────────
// The old skin is out of the markup: no glass, no `.ld-` / `.tw-` family, no dashed free
// state, no BodyMap glow — the body is the liquid vessel, the icons are Folyadék-jel ids.
test('folyadék: no glass, no old load classes, the body is the liquid vessel', async () => {
  const { container } = renderPage()
  expect(container.querySelector('.glass')).toBeNull()
  expect(container.querySelector('[class*="ld-"], [class*="tw-"], .uv-empty, .uv-eyebrow, .mz-page')).toBeNull()
  expect(container.querySelector('.body-map')).toBeNull()
  await waitFor(() => expect(container.querySelectorAll('.et-mapc .ex-duo.sm .ex-body svg')).toHaveLength(2))
  // every group row wears its muscle chip on white
  for (const row of container.querySelectorAll('.et-grp')) expect(row.querySelector('.ex-mchp')).not.toBeNull()
})

test('folyadék: the row icons are Folyadék-jel sprite ids', () => {
  const { container } = renderPage()
  const all = [...container.querySelectorAll('use')].map((u) => u.getAttribute('href') ?? '')
  expect(all.filter((h) => !h.startsWith('#t-'))).toEqual([])
  for (const id of ['#t-bolt', '#t-layers', '#t-record']) expect(all).toContain(id)
})

// No running mesocycle: one hero that says what will live here, and the way to the planner.
test('no active mesocycle: the hero says so and leads to the planner', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([])))
  const { container } = renderPage()
  expect(await screen.findByText('A heti terhelésed itt jelenik majd meg.')).toBeInTheDocument()
  expect(screen.getByText('Előbb tervezz egy mesociklust.')).toBeInTheDocument()
  expect(container.querySelector('.fo-hero-art use')?.getAttribute('href')).toBe('#t-peak')
  expect(container.querySelector('.fo-tank')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '+ Tervezz mesociklust' }))
  expect(mockNavigate).toHaveBeenCalledWith('/train/mesocycles/new')
})
