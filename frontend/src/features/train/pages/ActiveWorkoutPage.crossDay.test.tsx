// ============================================================
// Mezo · Másik nap edzése, lezárás VALÓS módban (mezo-z9kft).
//
// A tulajdonos jelentése (2026-09-22): a tegnapi tervezett edzést ma indította el, kilépett,
// majd a „Folytassuk”-kal (lebegő gomb / mai poszter — mind `?day=` NÉLKÜL nyitja a lapot)
// visszajött. A lezárásnál a ceremónia a MAI terv izomcsoportjait mutatta.
//
// Ok: a nap nélküli `/workouts/today` a nyitott edzés sablonját adja, AMÍG van nyitott edzés.
// A lezárás után nincs nyitott edzés, így ugyanaz a lekérés a hét napja szerinti MAI sablonra
// esik vissza — a még nyitva lévő lap `W`-je (és a `mergePlan`) a mai tervre cserélődik; ha ma
// pihenőnap van, a lap egyenesen elnavigál a ceremóniáról. A javítás: a lap belépéskor rögzíti
// a nyitott edzés sablonját, és onnantól azt kéri le.
// ============================================================
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { ActiveWorkoutPage } from '@/features/train/pages/ActiveWorkoutPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { TutorialProvider } from '@/features/tutorial/TutorialProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { setToken } from '@/data/_client/api'
import { seedAllKalauzSeen } from '@/test/kalauz'

const WORKOUT_ID = 'e1f3a0e2-0000-4000-8000-000000000030'
const YESTERDAY_TEMPLATE = 'a1f3a0e2-0000-4000-8000-000000000031'
const TODAY_TEMPLATE = 'a1f3a0e2-0000-4000-8000-000000000032'

let finished = false
/** What the param-less /today resolves to once nothing is open: today's plan, or a rest day. */
let todayPlan: 'leg-day' | 'rest' = 'leg-day'

const exercise = (id: string, name: string, muscle: string) => ({
  id, name, muscle, type: 'compound',
  warmupSets: 0, workingSets: 1, repMin: 8, repMax: 10, targetRIR: 1, anchorWeightKg: null,
  rationale: '', prescribedSets: [{ kind: 'working', targetWeightKg: 100, targetReps: 10, targetRIR: 0 }],
  lastWeek: null, imageStartUrl: null, imageEndUrl: null,
})

function yesterdayPayload() {
  const instance = {
    id: WORKOUT_ID, templateSessionId: YESTERDAY_TEMPLATE, date: '2026-06-12',
    status: finished ? 'completed' : 'active', sets: [],
    ...(finished ? { startedAt: '2026-06-12T17:00:00Z', finishedAt: '2026-06-12T18:05:00Z', activeSeconds: 3900 } : {}),
  }
  return {
    templateSessionId: YESTERDAY_TEMPLATE, dayLabel: 'Sze', title: 'Pull Day', durationEst: 60,
    exercises: [exercise('c1f3a0e2-0000-4000-8000-000000000033', 'Chest Supported Row', 'back-mid')],
    openWorkout: finished ? null : instance,
    ...(finished ? { completedWorkout: instance } : {}),
  }
}

function todayTemplatePayload() {
  if (todayPlan === 'rest') return {}
  return {
    templateSessionId: TODAY_TEMPLATE, dayLabel: 'Csü', title: 'Leg Day', durationEst: 60,
    exercises: [exercise('c1f3a0e2-0000-4000-8000-000000000034', 'Hack Squat', 'quad')],
    openWorkout: null,
  }
}

beforeEach(() => {
  finished = false
  todayPlan = 'leg-day'
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('test-token')
  seedAllKalauzSeen()
  server.use(
    http.get(`${API_BASE}/api/train/workouts/today`, ({ request }) => {
      const param = new URL(request.url).searchParams.get('templateSessionId')
      // server-side day resolution: open instance > param > today's weekday template
      if (!finished || param === YESTERDAY_TEMPLATE) return HttpResponse.json(yesterdayPayload())
      return HttpResponse.json(todayTemplatePayload())
    }),
    http.post(`${API_BASE}/api/train/workouts/:id/finish`, () => {
      finished = true
      return HttpResponse.json({
        id: WORKOUT_ID, templateSessionId: YESTERDAY_TEMPLATE, date: '2026-06-12', status: 'completed', sets: [],
        startedAt: '2026-06-12T17:00:00Z', finishedAt: '2026-06-12T18:05:00Z', activeSeconds: 3900,
      })
    }),
  )
})
afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

function setup() {
  return render(
    <QueryWrapper>
      {/* the resume paths (floating button, today poster) open the page WITHOUT ?day= */}
      <MemoryRouter initialEntries={['/train/session']}>
        <TutorialProvider>
          <LevelUpProvider>
            <Routes>
              <Route path="/train/session" element={<ActiveWorkoutPage />} />
              <Route path="/train/review/:id" element={<p>RÉGI ÖSSZESÍTŐ</p>} />
              <Route path="/train" element={<p>TRAIN HOME</p>} />
            </Routes>
          </LevelUpProvider>
        </TutorialProvider>
      </MemoryRouter>
    </QueryWrapper>,
  )
}

async function logAndFinish() {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: /szett mentése$/ }, { timeout: 5000 }))
  await user.click(await screen.findByRole('button', { name: 'Edzés befejezése' }, { timeout: 5000 }))
  expect(await screen.findByText('EDZÉS LEZÁRVA')).toBeInTheDocument()
}

test('a resumed off-day workout closes on ITS OWN muscles, not today’s plan', async () => {
  const { container } = setup()
  await logAndFinish()
  // let the post-finish /today refetch land before judging the ceremony
  await new Promise((r) => setTimeout(r, 300))
  expect(screen.getByText('EDZÉS LEZÁRVA')).toBeInTheDocument()
  // the muscle rows live on the ceremony's second step („Részletek”)
  await userEvent.setup().click(screen.getByRole('button', { name: /Részletek/ }))
  const rows = [...container.querySelectorAll('.cer-mstar strong')].map((el) => el.textContent)
  expect(rows).toEqual(['Hát (közép)'])
})

test('a resumed off-day workout finished on a rest day keeps the ceremony (no bounce to /train)', async () => {
  todayPlan = 'rest'
  setup()
  await logAndFinish()
  await new Promise((r) => setTimeout(r, 300))
  await waitFor(() => expect(screen.queryByText('TRAIN HOME')).toBeNull())
  expect(screen.getByText('EDZÉS LEZÁRVA')).toBeInTheDocument()
})
