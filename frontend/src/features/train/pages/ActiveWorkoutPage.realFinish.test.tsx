// ============================================================
// Mezo · Az edzés lezárása VALÓS módban — a záró ceremónia nem veszhet el (mezo-0uuy3).
//
// A tulajdonos jelentése (2026-09-18, éles app): „Lezárás"-ra EGYBŐL a régi (design 2.0)
// összesítő jött, a csillagos ceremóniát meg sem látta.
//
// Ok: a lap külső őre — „ma már kész van és nincs nyitott edzés → irány az értékelő lap" —
// MINDEN renderen újraértékelődik, nem csak belépéskor. A `finishWorkout` sikere érvényteleníti
// a ['train','workoutToday'] lekérdezést; az újratöltött nap már `completedWorkout`-ot ad és
// `openWorkout: null`-t, tehát az őr ugyanabban a pillanatban elnavigál a ceremóniáról.
//
// Mock módban a `completedTodayWorkout` MINDIG null (trainHooks.ts:1034), ezért a fájl összes
// többi tesztje — és az egész jsdom-os lefedettség — vak volt erre. Ez a teszt ezért VALÓS
// módban fut, MSW-vel: az első nap-lekérés nyitott edzést ad, a lezárás UTÁNI lekérés pedig
// lezártat, pontosan úgy, ahogy a szerver teszi.
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

const WORKOUT_ID = 'e1f3a0e2-0000-4000-8000-000000000020'
const TEMPLATE_ID = 'a1f3a0e2-0000-4000-8000-000000000010'

/** A nap-lekérés állapota: a lezárás ELŐTT nyitott edzés, UTÁNA lezárt. */
let finished = false

function todayPayload() {
  const instance = {
    id: WORKOUT_ID, templateSessionId: TEMPLATE_ID, date: '2026-06-12',
    status: finished ? 'completed' : 'active', sets: [],
    ...(finished ? { startedAt: '2026-06-12T17:00:00Z', finishedAt: '2026-06-12T18:05:00Z', activeSeconds: 3900 } : {}),
  }
  return {
    templateSessionId: TEMPLATE_ID,
    dayLabel: 'Csü',
    title: 'Pull Day',
    durationEst: 78,
    exercises: [
      {
        id: 'c1f3a0e2-0000-4000-8000-000000000002', name: 'Chest Supported Row',
        muscle: 'back-mid', type: 'compound',
        warmupSets: 0, workingSets: 1, repMin: 8, repMax: 10, targetRIR: 1, anchorWeightKg: null,
        rationale: '', prescribedSets: [{ kind: 'working', targetWeightKg: 105, targetReps: 10, targetRIR: 0 }],
        lastWeek: null, imageStartUrl: null, imageEndUrl: null,
      },
    ],
    openWorkout: finished ? null : instance,
    ...(finished ? { completedWorkout: instance } : {}),
  }
}

beforeEach(() => {
  finished = false
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('test-token')
  seedAllKalauzSeen()
  server.use(
    http.get(`${API_BASE}/api/train/workouts/today`, () => HttpResponse.json(todayPayload())),
    http.post(`${API_BASE}/api/train/workouts/:id/finish`, () => {
      finished = true
      return HttpResponse.json({
        id: WORKOUT_ID, templateSessionId: TEMPLATE_ID, date: '2026-06-12', status: 'completed', sets: [],
        startedAt: '2026-06-12T17:00:00Z', finishedAt: '2026-06-12T18:05:00Z', activeSeconds: 3900,
      })
    }),
  )
})
afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

function setup() {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/train/session']}>
        <TutorialProvider>
          <LevelUpProvider>
            <Routes>
              <Route path="/train/session" element={<ActiveWorkoutPage />} />
              {/* a régi összesítő helyőrzője: ha ide navigálunk, a ceremónia elveszett */}
              <Route path="/train/review/:id" element={<p>RÉGI ÖSSZESÍTŐ</p>} />
              <Route path="/train" element={<p>TRAIN HOME</p>} />
            </Routes>
          </LevelUpProvider>
        </TutorialProvider>
      </MemoryRouter>
    </QueryWrapper>,
  )
}

test('valós mód: a lezárás a csillagos ceremónián landol, NEM a régi összesítőn', async () => {
  const user = userEvent.setup()
  setup()
  // Az egyetlen előírt szettet lelogoljuk — innen a lap saját „Edzés befejezése" CTA-ja nyílik
  // (nyitott szett nélkül nincs megerősítő üveg, ez a legrövidebb valódi út a lezárásig).
  await user.click(await screen.findByRole('button', { name: /szett mentése$/ }, { timeout: 5000 }))
  await user.click(await screen.findByRole('button', { name: 'Edzés befejezése' }, { timeout: 5000 }))

  expect(await screen.findByText('EDZÉS LEZÁRVA')).toBeInTheDocument()
  // és OTT IS MARAD: a nap-lekérés újratöltése (completedWorkout + openWorkout: null) nem
  // navigálhat el a ceremóniáról
  await waitFor(() => expect(screen.queryByText('RÉGI ÖSSZESÍTŐ')).toBeNull())
  expect(screen.getByText('EDZÉS LEZÁRVA')).toBeInTheDocument()
})
