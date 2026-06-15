import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { TrainTodayView } from './TrainTodayView'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { DAY_ORDER } from '@/data/train'

// Asserts Phase-1 mock meso/gym data, so pin mock mode explicitly (the swapped
// useTrain hook reads useQuery, so a QueryClientProvider is required too).
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderView = () => render(<QueryWrapper><MemoryRouter><TrainTodayView /></MemoryRouter></QueryWrapper>)

test('today gym block + weekly timeline render', () => {
  renderView()
  // "Pull Day" appears in both the gym hero (Display) and the weekly rows
  // (Sze + Csü schedule entries); the hero one is unique via "07:30 · 78p".
  expect(screen.getAllByText('Pull Day').length).toBeGreaterThan(0)
  expect(screen.getByText('07:30 · 78p')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Indítsuk/ })).toBeInTheDocument()
  expect(screen.getByText('Heti terv · gym + futás + sport')).toBeInTheDocument()
  // weekly note (verbatim, substring)
  expect(screen.getByText(/A gym a mesociklus szerint/)).toBeInTheDocument()
})

test('own page-header: eyebrow + title + day-label', () => {
  renderView()
  expect(screen.getByText('Train · Mai')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Edzés' })).toBeInTheDocument()
  // today is Csü ⇒ "Csütörtök · W3"
  expect(screen.getByText('Csütörtök · W3')).toBeInTheDocument()
})

test('no volleyball session today (Csü) ⇒ today-volleyball block is absent', () => {
  renderView()
  // The today-volleyball CTA must not be present initially (no vb today).
  expect(screen.queryByRole('button', { name: /Logold a session-t/ })).not.toBeInTheDocument()
})

// ---- real-mode block: agenda derives from the active meso, /today drives the hero ----

const todayLabel = () => DAY_ORDER[(new Date().getDay() + 6) % 7]

function realMeso(dayLabel: string) {
  return {
    id: 'm-1', title: 'T2 meso', shortTitle: 'T2', status: 'active',
    startDate: '2026-06-01', endDate: '2026-07-13', weeks: 6, currentWeek: 2,
    split: 'Pull / Push · 2×/hét', style: 'RP · 6 hét', phaseCurve: ['MEV', 'MAV'],
    days: [{
      id: 'd-1', day: dayLabel, type: 'Pull Day', muscle: 'back', exerciseCount: 1,
      exercises: [{ id: 'e-1', name: 'Row', muscle: 'back', sets: 4, targetReps: '8-10', targetRIR: 1, type: 'compound' }],
    }],
  }
}

test('real mode renders the today card and agenda from the active meso + /today', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([realMeso(todayLabel())])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    // pin the schedule empty — the default BVSC fixture would add weekday-dependent vb rows
    http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/workouts/today`, () =>
      HttpResponse.json({
        templateSessionId: 'd-1', dayLabel: todayLabel(), title: 'Pull Day', durationEst: 0,
        exercises: [{ id: 'e-1', name: 'Row', muscle: 'back', sets: 4, targetReps: '8-10', targetRIR: 1, type: 'compound' }],
        openWorkout: null,
      }),
    ),
  )
  renderView()
  expect(await screen.findByRole('button', { name: /Indítsuk/ })).toBeInTheDocument()
  expect(screen.getAllByText('Pull Day').length).toBeGreaterThan(0)
  expect(screen.getByText(/1 session/)).toBeInTheDocument() // 1 gym day, no volleyball yet (T3)
})

test('real mode shows the rest-day note when /today is empty but a meso is active', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    // the meso's only gym day is NOT today -> rest day
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([realMeso('NEMNAP')])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/workouts/today`, () => HttpResponse.json({})),
  )
  renderView()
  expect(await screen.findByText(/Ma pihenőnap/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Indítsuk/ })).not.toBeInTheDocument()
})

test('real mode orders the morning run hero above the evening gym hero', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const todayIdx = (new Date().getDay() + 6) % 7
  const runBlock = {
    id: 'rb-1', title: 'Robbanékonyság', goal: 'sprint', kind: 'interval', status: 'active',
    startDate: '2026-06-01', endDate: '2026-08-01', weeks: 4, currentWeek: 1, summary: null,
    structure: {
      weeks: [{
        weekNumber: 1, phaseLabel: 'Alapozás',
        sessions: [{
          key: 'today-sprint', dayOfWeek: todayIdx, timeOfDay: '08:00', label: 'Reggeli sprint',
          kind: 'sprint', rpeTarget: { min: 9, max: 10 }, rounds: 6, segments: [],
        }],
      }],
    },
  }
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([realMeso(todayLabel())])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([])),
    // gym slot today at 18:30 -> deriveGymSchedule fills the today gym day's time
    http.get(`${API_BASE}/api/train/gym-schedule`, () => HttpResponse.json([{ id: 'g-1', dayOfWeek: todayIdx, time: '18:30' }])),
    http.get(`${API_BASE}/api/train/running-blocks`, () => HttpResponse.json([runBlock])),
    http.get(`${API_BASE}/api/train/run-sessions`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/workouts/today`, () =>
      HttpResponse.json({
        templateSessionId: 'd-1', dayLabel: todayLabel(), title: 'Pull Day', durationEst: 0,
        exercises: [{ id: 'e-1', name: 'Row', muscle: 'back', sets: 4, targetReps: '8-10', targetRIR: 1, type: 'compound' }],
        openWorkout: null,
      }),
    ),
  )
  renderView()
  // both heroes present
  const runEyebrow = await screen.findByText('Futás · ma')
  const startBtn = await screen.findByRole('button', { name: /Indítsuk/ }) // gym hero CTA
  // run hero (08:00) must precede gym hero (18:30) in the DOM
  expect(runEyebrow.compareDocumentPosition(startBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('real mode renders the run hero (no rest-day note) when only a run is prescribed today', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  // Running blocks are mesocycle-independent: the agenda's flag-based isToday is
  // never set by running, so a run-only-today (no gym day, no volleyball) must
  // still surface its hero and must NOT trigger the "Ma pihenőnap" rest card.
  const todayIdx = (new Date().getDay() + 6) % 7
  const runBlock = {
    id: 'rb-1', title: 'Robbanékonyság', goal: 'sprint', kind: 'interval', status: 'active',
    startDate: '2026-06-01', endDate: '2026-08-01', weeks: 4, currentWeek: 1, summary: null,
    structure: {
      weeks: [{
        weekNumber: 1, phaseLabel: 'Alapozás',
        sessions: [{
          key: 'today-sprint', dayOfWeek: todayIdx, timeOfDay: '08:00', label: 'Reggeli sprint',
          kind: 'sprint', rpeTarget: { min: 9, max: 10 }, rounds: 6, segments: [],
        }],
      }],
    },
  }
  server.use(
    // meso's only gym day is NOT today + no volleyball -> gym rest day
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([realMeso('NEMNAP')])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/gym-schedule`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/running-blocks`, () => HttpResponse.json([runBlock])),
    http.get(`${API_BASE}/api/train/run-sessions`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/workouts/today`, () => HttpResponse.json({})),
  )
  renderView()
  // the "Futás · ma" run hero IS rendered (eyebrow + log CTA are hero-unique;
  // "Reggeli sprint" itself also appears in the weekly row, hence not asserted alone) ...
  expect(await screen.findByText('Futás · ma')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Naplózd a futást/ })).toBeInTheDocument()
  expect(screen.getAllByText('Reggeli sprint').length).toBeGreaterThan(0)
  // ... and the rest-day note is NOT (a prescribed run is not a rest day)
  expect(screen.queryByText(/Ma pihenőnap/)).not.toBeInTheDocument()
})

test('real mode shows the volleyball today-card when a slot falls on today', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const todayIdx = (new Date().getDay() + 6) % 7
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([realMeso('NEMNAP')])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/workouts/today`, () => HttpResponse.json({})),
    http.get(`${API_BASE}/api/train/sport-schedule`, () =>
      HttpResponse.json([
        { id: 'e1f3a0e2-0000-4000-8000-0000000000aa', dayOfWeek: todayIdx, time: '18:15', durationMin: 90, kind: 'training', location: 'BVSC csarnok', intensityLabel: 'közepes' },
      ]),
    ),
  )
  renderView()
  expect(await screen.findByText(/Volleyball · 18:15/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Logold a session-t/ })).toBeInTheDocument()
  // gym rest day + vb today -> no rest-day card
  expect(screen.queryByText(/Ma pihenőnap/)).not.toBeInTheDocument()
})
