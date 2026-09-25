// ============================================================
// Mezo · Folytatás friss adatból — a munkamenet nem indulhat régi gyorsítótárból.
//
// A tulajdonos jelentése (2026-09-25): „ha kilépek és a folytatás gombbal visszajövök, mintha
// hozzáadna egy új szettet". A munkamenet EGYSZER, a mount pillanatában épül fel a nyitott
// edzés szettjeiből — ha a gyorsítótárban a nap-lekérés egy korábbi pillanatképe ül (a
// lelogolás utáni újratöltés még nem ért vissza, amikor a felhasználó kilépett), a kártya egy
// szettel a szerver mögött indul: a már kész szett újra kitöltendőnek látszik, és a
// pipálása egy MÁSODIK sort ír a szerverre. A lapnak meg kell várnia a mount-kori friss lekérést.
// ============================================================
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { ActiveWorkoutPage } from '@/features/train/pages/ActiveWorkoutPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { TutorialProvider } from '@/features/tutorial/TutorialProvider'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { setToken } from '@/data/_client/api'
import { seedAllKalauzSeen } from '@/test/kalauz'

const WORKOUT_ID = 'e1f3a0e2-0000-4000-8000-000000000030'
const TEMPLATE_ID = 'a1f3a0e2-0000-4000-8000-000000000031'
const EX_ID = 'c1f3a0e2-0000-4000-8000-000000000032'

function todayPayload(sets: unknown[]) {
  return {
    templateSessionId: TEMPLATE_ID,
    dayLabel: 'Csü',
    title: 'Upper Special',
    durationEst: 60,
    exercises: [
      {
        id: EX_ID, name: 'Machine Chest Press', muscle: 'chest-mid', type: 'compound',
        warmupSets: 0, workingSets: 3, repMin: 6, repMax: 10, targetRIR: 1, anchorWeightKg: null,
        rationale: '',
        prescribedSets: [1, 2, 3].map(() => ({ kind: 'working', targetWeightKg: 60, targetReps: 9, targetRIR: 1 })),
        lastWeek: null, imageStartUrl: null, imageEndUrl: null,
      },
    ],
    openWorkout: { id: WORKOUT_ID, templateSessionId: TEMPLATE_ID, date: '2026-09-25', status: 'active', sets },
  }
}

const loggedSet = (i: number) => ({
  id: `f1f3a0e2-0000-4000-8000-00000000004${i}`, exerciseId: EX_ID, setIndex: i,
  weightKg: 60, reps: 9, rir: 1, kind: 'working',
})

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('test-token')
  seedAllKalauzSeen()
  // The SERVER already holds two logged sets …
  server.use(
    http.get(`${API_BASE}/api/train/workouts/today`, () => HttpResponse.json(todayPayload([loggedSet(0), loggedSet(1)]))),
  )
})
afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

test('a folytatás a szerver friss szettjeiből épül, nem a gyorsítótár régi pillanatképéből', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  // … while the cache still holds the snapshot from before the second one landed.
  client.setQueryData(['train', 'workoutToday', null], todayPayload([loggedSet(0)]))
  await client.invalidateQueries({ queryKey: ['train', 'workoutToday'] })
  // In the real app the meso list is warm by the time the user taps Folytatás — a cold one
  // would hold the skeleton long enough to mask the race.
  client.setQueryData(['train', 'mesocycles'], [])

  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/train/session']}>
        <TutorialProvider>
          <LevelUpProvider>
            <Routes>
              <Route path="/train/session" element={<ActiveWorkoutPage />} />
              <Route path="/train" element={<p>TRAIN HOME</p>} />
            </Routes>
          </LevelUpProvider>
        </TutorialProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )

  // The cursor sits on the THIRD set — both server sets read as done.
  expect(await screen.findByRole('button', { name: /^3\. szett mentése$/ }, { timeout: 5000 })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /^2\. szett mentése$/ })).toBeNull()
  expect(screen.getAllByRole('button', { name: /szett szerkesztése/ })).toHaveLength(2)
})
