// Mid-workout exercise swap / add (mezo-mobji): ⋮ → „Gyakorlat cseréje” → picker → „Csak ma /
// Mezociklusra is”, and the „Gyakorlat hozzáadása” button under the list. Mock mode drives the
// flows; one real-mode test pins the wire (POST body + the card rendered from the returned plan).
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { ActiveWorkoutPage } from '@/features/train/pages/ActiveWorkoutPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { resetMockMedalHistory } from '@/data/train/medalEvaluator'
import { TutorialProvider } from '@/features/tutorial/TutorialProvider'
import { seedAllKalauzSeen } from '@/test/kalauz'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())
beforeEach(() => resetMockMedalHistory())
beforeEach(() => seedAllKalauzSeen())

const EX1 = 'Chest Supported Row'

function setup() {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/train/session']}>
        <TutorialProvider>
          <LevelUpProvider>
            <ActiveWorkoutPage />
          </LevelUpProvider>
        </TutorialProvider>
      </MemoryRouter>
    </QueryWrapper>,
  )
}
async function enterList() {
  await screen.findByRole('button', { name: 'Vissza' })
  const start = screen.queryByRole('button', { name: /^Indulás/ })
  if (start) fireEvent.click(start)
  await waitFor(() => expect(document.querySelector('.wo-list')).not.toBeNull())
}
const card = (name: string) => document.querySelector(`.wo-card[aria-label="${name}"]`) as HTMLElement | null

async function openSwap(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(within(card(name)!).getByRole('button', { name: `${name} · további műveletek` }))
  await user.click(await screen.findByText('Gyakorlat cseréje'))
}

test('swap before any set: the picker suggests the same muscle, Csak ma puts the new card in the slot', async () => {
  const user = userEvent.setup()
  setup()
  await enterList()
  await openSwap(user, EX1)

  const similar = await screen.findByRole('group', { name: 'Hasonló gyakorlatok' })
  expect(within(similar).getByText('T-Bar Row')).toBeInTheDocument()
  // what the session already holds is not on offer
  expect(within(similar).queryByText(EX1)).toBeNull()
  await user.click(within(similar).getByText('T-Bar Row'))

  await screen.findByText(`${EX1} → T-Bar Row`)
  expect(screen.getByText('Mezociklusra is')).toBeInTheDocument()
  await user.click(screen.getByText('Csak ma'))

  await waitFor(() => expect(card('T-Bar Row')).not.toBeNull())
  expect(card(EX1)).toBeNull()
  expect(within(card('T-Bar Row')!).getByText(`Csak ma · a ${EX1} helyett`)).toBeInTheDocument()
  expect(within(card('T-Bar Row')!).getByText(/Első alkalom/)).toBeInTheDocument()
  // it took the first slot
  expect(document.querySelectorAll('.wo-card')[0].getAttribute('aria-label')).toBe('T-Bar Row')
})

test('swap mid-exercise: the logged set stays on the old card, the new card follows it', async () => {
  const user = userEvent.setup()
  setup()
  await enterList()
  await user.click(within(card(EX1)!).getByRole('button', { name: /szett mentése$/ }))
  await openSwap(user, EX1)
  await user.click(within(await screen.findByRole('group', { name: 'Hasonló gyakorlatok' })).getByText('T-Bar Row'))
  expect(await screen.findByText(/A 1 kész szett a Chest Supported Row-nál marad/)).toBeInTheDocument()
  await user.click(screen.getByText('Mezociklusra is'))

  await waitFor(() => expect(card('T-Bar Row')).not.toBeNull())
  const old = card(EX1)!
  expect(within(old).getByText('Lecserélve → T-Bar Row · 1 szett kész')).toBeInTheDocument()
  expect(within(old).queryByRole('button', { name: `${EX1} · további műveletek` })).toBeNull()
  expect(within(card('T-Bar Row')!).getByText(`Mezociklusban · a ${EX1} helyett`)).toBeInTheDocument()
  const order = [...document.querySelectorAll('.wo-card')].map((c) => c.getAttribute('aria-label'))
  expect(order.slice(0, 2)).toEqual([EX1, 'T-Bar Row'])
})

test('add: the button under the list appends the exercise, and swapping it again offers only Csak ma', async () => {
  const user = userEvent.setup()
  setup()
  await enterList()
  await user.click(screen.getByRole('button', { name: 'Gyakorlat hozzáadása' }))
  await screen.findByText('Mit adunk hozzá?')
  await user.type(screen.getByPlaceholderText(/Keresés/), 'Lat Pulldown · Neutral')
  await user.click(await screen.findByText('Lat Pulldown · Neutral'))
  await screen.findByText(/4 szett · 8–10 ismétlés/)
  await user.click(screen.getByText('Csak ma'))

  await waitFor(() => expect(card('Lat Pulldown · Neutral')).not.toBeNull())
  const cards = [...document.querySelectorAll('.wo-card')].map((c) => c.getAttribute('aria-label'))
  expect(cards[cards.length - 1]).toBe('Lat Pulldown · Neutral')
  expect(within(card('Lat Pulldown · Neutral')!).getByText('Ma hozzáadva')).toBeInTheDocument()

  await openSwap(user, 'Lat Pulldown · Neutral')
  await user.type(await screen.findByPlaceholderText(/Keresés/), 'T-Bar')
  await user.click(await screen.findByText('T-Bar Row'))
  await screen.findByText(/ma került be, nincs a mezociklus tervében/)
  expect(screen.queryByText('Mezociklusra is')).toBeNull()
})

test('real mode: the swap POSTs the change and renders the card from the returned plan', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const posts: unknown[] = []
  const ex1 = { id: 'e-1', name: EX1, muscle: 'back-mid', warmupSets: 2, workingSets: 4, repMin: 8, repMax: 10, targetRIR: 1, type: 'compound', planSlot: true }
  const swapped = {
    id: 'e-9', name: 'T-Bar Row', muscle: 'back-mid', warmupSets: 2, workingSets: 4, repMin: 8, repMax: 10,
    targetRIR: 1, type: 'compound', changeScope: 'TODAY', replacesName: EX1, planSlot: false,
    lastWeek: { weightKg: 60, reps: 10, rir: 1 },
  }
  const today = (exercises: unknown[]) => ({
    templateSessionId: 'd-1', dayLabel: 'Ma', title: 'Pull Day', durationEst: 60, exercises,
    openWorkout: { id: 'w-1', templateSessionId: 'd-1', date: '2026-09-28', status: 'active', sets: [] },
  })
  server.use(
    http.get(`${API_BASE}/api/train/workouts/today`, () => HttpResponse.json(today(posts.length ? [swapped] : [ex1]))),
    http.get(`${API_BASE}/api/train/exercises`, () => HttpResponse.json([
      { id: 'c-1', slug: 'chest-supported-row', name: EX1, muscle: 'back-mid', type: 'compound', stim: 0.9, fatigue: 0.5, editable: false, mediaEditable: false, authoredByMe: false },
      { id: 'c-2', slug: 't-bar-row', name: 'T-Bar Row', muscle: 'back-mid', type: 'compound', stim: 0.88, fatigue: 0.6, editable: false, mediaEditable: false, authoredByMe: false },
    ])),
    http.post(`${API_BASE}/api/train/workouts/w-1/exercises`, async ({ request }) => {
      posts.push(await request.json())
      return HttpResponse.json({ exerciseId: 'e-9', today: today([swapped]) })
    }),
  )
  const user = userEvent.setup()
  setup()
  await enterList()
  await openSwap(user, EX1)
  await user.type(await screen.findByPlaceholderText(/Keresés/), 'T-Bar')
  await user.click(await screen.findByText('T-Bar Row'))
  await user.click(await screen.findByText('Csak ma'))

  await waitFor(() => expect(card('T-Bar Row')).not.toBeNull())
  expect(posts[0]).toMatchObject({
    name: 'T-Bar Row', catalogId: 'c-2', scope: 'TODAY', replacesExerciseId: 'e-1', workingSets: 4, repMin: 8, repMax: 10, targetRIR: 1,
  })
  expect(card(EX1)).toBeNull()
  expect(within(card('T-Bar Row')!).getByText(`Csak ma · a ${EX1} helyett`)).toBeInTheDocument()
  // it has history, so no „first time” line
  expect(within(card('T-Bar Row')!).queryByText(/Első alkalom/)).toBeNull()
})
