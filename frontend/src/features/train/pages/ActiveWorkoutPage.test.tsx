import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { ActiveWorkoutPage } from '@/features/train/pages/ActiveWorkoutPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { LiveActivityProvider } from '@/app/providers/LiveActivityProvider'
import { DynamicIsland } from '@/app/DynamicIsland'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

// Asserts Phase-1 mock workout data, so pin mock mode explicitly (the swapped
// useTrain hook reads useQuery, so a QueryClientProvider is required too).
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

// The page itself has no LiveActivityProvider (that's AppLayout's job in the real
// app router) — mount it here alongside a bare <DynamicIsland/> so rest-wiring
// tests (mezo-8141) can observe the island without double-wrapping AppLayout.
function setup() {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/train/session']}>
        <LevelUpProvider>
          <LiveActivityProvider>
            <DynamicIsland />
            <ActiveWorkoutPage />
          </LiveActivityProvider>
        </LevelUpProvider>
      </MemoryRouter>
    </QueryWrapper>,
  )
}

// Set counts now vary per exercise (warmup + working sets), so a fixed loop is
// fragile. Click "Szett kész ✓" until the exercise's debrief CTA appears (always
// the last set); returns before re-clicking so the button behind the modal is untouched.
async function completeExerciseSets(user: ReturnType<typeof userEvent.setup>) {
  for (let i = 0; i < 12; i++) {
    await user.click(screen.getByText('Szett kész ✓'))
    if (screen.queryByText(/Mentés · tovább|Edzés vége →/)) return
  }
}

test('prep screen shows the workout title, challenges carousel and the start CTA', () => {
  setup()
  expect(screen.getAllByText('Pull Day').length).toBeGreaterThan(0)
  expect(screen.getByText('Mai kihívások · proposál')).toBeInTheDocument()
  expect(screen.getByText(/Kezdjük el/)).toBeInTheDocument()
})

// Byte-parity guard: the Phase-1 mock seed still renders its fabricated confidence
// (0.72 → "conf 72%") + the tool-transparency chips exactly as before the live wiring.
test('mock mode: the seed challenge renders conf 72% and its tool chips (byte parity)', () => {
  setup()
  expect(screen.getByText('conf 72%')).toBeInTheDocument()
  expect(screen.getByText('get_pr_history(ex=chest_row)')).toBeInTheDocument()
  expect(screen.queryByText('tanulom')).not.toBeInTheDocument()
})

test('prep screen flags the active niggle pre-flight', () => {
  setup()
  expect(screen.getByText('Jobb váll · aktív niggle')).toBeInTheDocument()
  expect(screen.getByText('Értem · jó így')).toBeInTheDocument()
})

test('clicking the start CTA reveals the first active exercise', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  expect(screen.getByText('Chest Supported Row')).toBeInTheDocument()
  expect(screen.getByText('Szett kész ✓')).toBeInTheDocument()
})

test('the excard h2 shows the current exercise name, and a matching set-dot per set', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  expect(container.querySelector('.excard h2')).toHaveTextContent('Chest Supported Row')
  // ex1: 2 warmup + 3 working = 5 planned sets.
  expect(container.querySelectorAll('.setdots .sd')).toHaveLength(5)
})

test('mock mode: the excard shows the "múlt héten" comparison line when lastWeek exists', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  // ex1.lastWeek = { weight: 102.5, reps: 9, rir: 2 }
  expect(await screen.findByText('múlt héten: 102,5 kg × 9 @ RIR 2')).toBeInTheDocument()
})

test('the wk-top header shows the workout title, the gyakorlat/szett counter, an exercise dot per exercise and the Vissza + ⋯ buttons', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  expect(container.querySelector('.wk-top .t1')).toHaveTextContent('Pull Day')
  // currentIdx=0, 5 exercises, 0 sets logged yet, 22 total planned sets (5+5+4+4+4).
  expect(screen.getByText('1/5 gyakorlat · 0/22 szett')).toBeInTheDocument()
  expect(container.querySelectorAll('.exdots i')).toHaveLength(5)
  expect(screen.getByRole('button', { name: 'Vissza' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Gyakorlat műveletek' })).toBeInTheDocument()
})

test('completing a set advances the set-dot cursor and the header counter', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  expect(screen.getByText('1/5 gyakorlat · 0/22 szett')).toBeInTheDocument()
  expect(container.querySelectorAll('.setdots .sd.don')).toHaveLength(0)
  await user.click(screen.getByText('Szett kész ✓'))
  expect(container.querySelectorAll('.setdots .sd.don')).toHaveLength(1)
  expect(screen.getByText('1/5 gyakorlat · 1/22 szett')).toBeInTheDocument()
})

// ---- rest wiring: "Szett kész ✓" starts the island rest (mezo-8141) ----

test('mock mode: logging a mid-exercise set starts the island rest ("Pihenő")', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  expect(container.querySelector('.dynamic-island.live')).toBeNull()
  // ex1 (Chest Supported Row, compound): 2 warmup + 3 working = 5 planned sets.
  // Logging the first (a warmup) leaves 4 sets remaining -> the exercise continues.
  await user.click(screen.getByText('Szett kész ✓'))
  expect(container.querySelector('.dynamic-island.live')).not.toBeNull()
  expect(screen.getByText('Pihenő')).toBeInTheDocument()
})

test('mock mode: logging an exercise\'s final set (opens the feedback modal) starts no rest', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  // Drive through ex1's 4 non-final sets — each is mid-exercise, so each restarts
  // the island rest (overwrite semantics, asserted separately below).
  await user.click(screen.getByText('Szett kész ✓'))
  await user.click(screen.getByText('Szett kész ✓'))
  await user.click(screen.getByText('Szett kész ✓'))
  await user.click(screen.getByText('Szett kész ✓'))
  expect(container.querySelector('.dynamic-island.live')).not.toBeNull()
  // Clear the leftover mid-exercise rest (tap-to-skip) so it can't mask the
  // assertion below — isolates "does THIS click start a rest" from "one is
  // already live from an earlier click".
  await user.click(screen.getByRole('button', { name: 'Pihenő átugrása' }))
  expect(container.querySelector('.dynamic-island.live')).toBeNull()
  // The 5th (last) set completes the exercise -> feedback modal opens, no rest.
  await user.click(screen.getByText('Szett kész ✓'))
  expect(await screen.findByText(/Mentés · tovább|Edzés vége →/)).toBeInTheDocument()
  expect(container.querySelector('.dynamic-island.live')).toBeNull()
})

test('mock mode: exiting the workout clears a live rest', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  await user.click(screen.getByText('Szett kész ✓'))
  expect(container.querySelector('.dynamic-island.live')).not.toBeNull()
  await user.click(screen.getByRole('button', { name: 'Vissza' }))
  expect(container.querySelector('.dynamic-island.live')).toBeNull()
})

test('mock mode: a new rest replaces (does not stack with) an already-live one', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  await user.click(screen.getByText('Szett kész ✓')) // warmup 1 -> rest starts
  expect(container.querySelectorAll('.dynamic-island.live')).toHaveLength(1)
  await user.click(screen.getByText('Szett kész ✓')) // warmup 2 -> replaces, not stacks
  expect(container.querySelectorAll('.dynamic-island.live')).toHaveLength(1)
  expect(screen.getByText('Pihenő')).toBeInTheDocument()
})

test('mock mode: finishing the workout (phase -> complete) clears a live rest', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  // Skip ex0 (no rest on skip), then drive the remaining 4 exercises to completion.
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Kihagyás'))
  await screen.findByText('Lat Pulldown · Pronated')
  for (let ex = 0; ex < 4; ex++) {
    await completeExerciseSets(user)
    if (ex < 3) {
      // Mid-way through, a rest should be live (proves the loop is actually logging
      // mid-exercise sets, not just skipping straight to the debrief).
      expect(container.querySelector('.dynamic-island.live')).not.toBeNull()
    }
    const cta = await screen.findByText(/Mentés · tovább|Edzés vége →/)
    await user.click(cta)
    if (ex < 3) await waitFor(() => expect(document.querySelector('.setdots .sd.don')).toBeNull())
  }
  // The workout is finished (phase -> complete) — any leftover live rest is cleared.
  expect(await screen.findByText(/Edzés vége ·/)).toBeInTheDocument()
  expect(container.querySelector('.dynamic-island.live')).toBeNull()
})

test('mock mode: unmounting the workout session clears a live rest', async () => {
  const user = userEvent.setup()
  function Harness({ mounted }: { mounted: boolean }) {
    return (
      <QueryWrapper>
        <MemoryRouter initialEntries={['/train/session']}>
          <LevelUpProvider>
            <LiveActivityProvider>
              <DynamicIsland />
              {mounted && <ActiveWorkoutPage />}
            </LiveActivityProvider>
          </LevelUpProvider>
        </MemoryRouter>
      </QueryWrapper>
    )
  }
  const { container, rerender } = render(<Harness mounted />)
  await user.click(screen.getByText(/Kezdjük el/))
  await user.click(screen.getByText('Szett kész ✓'))
  expect(container.querySelector('.dynamic-island.live')).not.toBeNull()
  rerender(<Harness mounted={false} />)
  expect(container.querySelector('.dynamic-island.live')).toBeNull()
})

test('mock mode: the giant steppers pre-fill the current set from the prescribed target', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  // ex1: warmups are sets 1-2 (52.5×10, 77.5×5), working sets are 105×10.
  await screen.findByRole('button', { name: 'Súly növelése' }) // wait for the active phase
  expect(container.querySelector('.steprow')).toHaveTextContent('52,5') // first warmup target
  expect(container.querySelector('.steprow')).toHaveTextContent('10')
})

test('mock mode: the current set-dot shows a B-prefixed label on a warmup set', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  await screen.findByRole('button', { name: 'Súly növelése' }) // wait for the active phase
  expect(container.querySelector('.setdots .sd.cur')).toHaveTextContent('B1') // ex1 set 1 is a warmup
})

// Transient per-set note (SetLogRequest.note) — the ONLY write path for it, distinct
// from the durable per-exercise note pill/editor (F4, tested below). Regression guard
// for the excard recomposition that silently dropped this input (mezo-8141).
test('mock mode: the excard renders a per-set note input that clears after logging the set', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  const noteInput = await screen.findByLabelText('Szett megjegyzés')
  await user.type(noteInput, 'Nehéz volt az utolsó ismétlés')
  expect(noteInput).toHaveValue('Nehéz volt az utolsó ismétlés')
  await user.click(screen.getByText('Szett kész ✓'))
  // Post-log reset: the transient note clears (proves it participates in the
  // completeSet submit path, same as the old removed input did).
  expect(await screen.findByLabelText('Szett megjegyzés')).toHaveValue('')
})

test('mock mode: renders the rationale line instead of the static hint', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  expect(await screen.findByText(/→ \+2\.5 kg/)).toBeInTheDocument() // ex1.rationale
})

test('mock mode: warmup sets render up-front as amber "Bemel." rows (spec §6)', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  // The prescribed set list shows ALL sets up front; ex1's 2 warmups are 2 amber rows.
  expect(screen.getAllByText('Bemel.')).toHaveLength(2)
})

// ---- warmup vs working distinction on the logging card (mezo-eerq) ----

test('mock mode: a warmup set shows the Bemelegítő tag and hides the RIR row', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  // ex1 set 1 is a warmup (B1): amber kind tag on the card, no RIR selector.
  expect(await screen.findByText('Bemelegítő · B1')).toBeInTheDocument()
  expect(screen.queryByText('RIR')).not.toBeInTheDocument() // the rirrow label
  expect(screen.queryByRole('button', { name: 'RIR 0' })).not.toBeInTheDocument()
})

test('mock mode: a working set shows the Working tag and the RIR row', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  await user.click(screen.getByText('Szett kész ✓')) // B1
  await user.click(screen.getByText('Szett kész ✓')) // B2
  expect(await screen.findByText('Working · 1/3')).toBeInTheDocument()
  expect(screen.getByText('RIR')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'RIR 0' })).toBeInTheDocument()
})

test('mock mode: a deviated working-set weight carries into the next working set', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  await user.click(screen.getByText('Szett kész ✓')) // B1 (52.5)
  await user.click(screen.getByText('Szett kész ✓')) // B2 (77.5)
  await screen.findByText('Working · 1/3')
  expect(container.querySelector('.steprow')).toHaveTextContent('105') // engine seeds working 1
  await user.click(screen.getByRole('button', { name: 'Súly növelése' })) // 105 -> 107.5
  await user.click(screen.getByText('Szett kész ✓')) // log working 1 at 107.5
  await screen.findByText('Working · 2/3')
  // The next working set inherits the deviated 107.5, not the static 105 target.
  expect(container.querySelector('.steprow')).toHaveTextContent('107,5')
})

test('real mode: null engine targets never reset the weight — the next set inherits it', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  // First-ever session, no anchor: every prescribed target weight is null (the engine
  // still emits the warmup rows — backend mezo-eerq).
  useRealHandlers(
    {
      ...REAL_TODAY,
      exercises: [
        {
          ...REAL_TODAY.exercises[0],
          lastWeek: null,
          rationale: 'Első alkalom — add meg a súlyt',
          warmupSets: 1, workingSets: 2, repMin: 8, repMax: 10,
          prescribedSets: [
            { kind: 'warmup', targetWeightKg: null, targetReps: 10, targetRIR: null },
            { kind: 'working', targetWeightKg: null, targetReps: 10, targetRIR: 1 },
            { kind: 'working', targetWeightKg: null, targetReps: 10, targetRIR: 1 },
          ],
        },
      ],
    },
    calls,
  )
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(await screen.findByText(/Kezdjük el/))
  await waitFor(() => expect(calls).toContain('start:d-1'))
  await screen.findByRole('button', { name: 'Súly növelése' })
  // B1 prefills 0 (nothing to inherit yet) — hand-enter 7.5 kg (3 × +2.5).
  await user.click(screen.getByRole('button', { name: 'Súly növelése' }))
  await user.click(screen.getByRole('button', { name: 'Súly növelése' }))
  await user.click(screen.getByRole('button', { name: 'Súly növelése' }))
  await user.click(screen.getByText('Szett kész ✓'))
  await waitFor(() => expect(calls).toContain('set:w-1:e-1:0:7.5'))
  // The working set inherits the hand-entered 7.5 instead of resetting to 0.
  expect(container.querySelector('.steprow')).toHaveTextContent('7,5')
})

test('real mode: a warmup set posts without rir, a working set posts with it', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(
    {
      ...REAL_TODAY,
      exercises: [
        {
          ...REAL_TODAY.exercises[0],
          warmupSets: 1, workingSets: 1, repMin: 8, repMax: 10,
          prescribedSets: [
            { kind: 'warmup', targetWeightKg: 52.5, targetReps: 10, targetRIR: null },
            { kind: 'working', targetWeightKg: 105, targetReps: 10, targetRIR: 1 },
          ],
        },
      ],
    },
    calls,
  )
  const bodies: Record<string, unknown>[] = []
  server.use(
    http.post(`${API_BASE}/api/train/workouts/:id/sets`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      bodies.push(body)
      return HttpResponse.json({ id: 'st-' + body.setIndex, exerciseId: body.exerciseId, setIndex: body.setIndex }, { status: 201 })
    }),
  )
  const user = userEvent.setup()
  setup()
  await user.click(await screen.findByText(/Kezdjük el/))
  await waitFor(() => expect(calls).toContain('start:d-1'))
  await user.click(screen.getByText('Szett kész ✓')) // B1 — warmup, no RIR logged
  await user.click(screen.getByText('Szett kész ✓')) // working set (opens the debrief)
  await waitFor(() => expect(bodies).toHaveLength(2))
  expect(bodies[0].kind).toBe('warmup')
  expect(bodies[0]).not.toHaveProperty('rir')
  expect(bodies[1].kind).toBe('working')
  expect(bodies[1].rir).toBe(1) // the prescribed working RIR target
})

test('logging a PR-weight third set on the first exercise fires the PR toast', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  // ex1: 2 warmups, then the working sets are prescribed at 105 kg. Set 3 (the first
  // working set) auto-prefills to 105 → clears the PR threshold vs lastWeek 102.5.
  await user.click(screen.getByText('Szett kész ✓')) // warmup 1
  await user.click(screen.getByText('Szett kész ✓')) // warmup 2
  await user.click(screen.getByText('Szett kész ✓')) // working set (setIndex 2) -> PR
  expect(screen.getByText('Personal Record')).toBeInTheDocument()
  expect(screen.getByText('+2.5 kg')).toBeInTheDocument()
})

test('the giant Súly/Ismétlés steppers increment by their step on tap', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  await screen.findByRole('button', { name: 'Súly növelése' })
  expect(container.querySelector('.steprow')).toHaveTextContent('52,5') // first warmup target
  await user.click(screen.getByRole('button', { name: 'Súly növelése' }))
  expect(container.querySelector('.steprow')).toHaveTextContent('55') // +2.5 kg
  await user.click(screen.getByRole('button', { name: 'Ismétlés növelése' }))
  expect(container.querySelector('.steprow')).toHaveTextContent('11') // +1 rep
})

test('reordering remaining exercises changes which exercise comes next', async () => {
  const user = userEvent.setup()
  const { container } = setup() // mock mode (file pins VITE_USE_MOCK=true)
  await user.click(screen.getByText(/Kezdjük el/)) // active, current = Chest Supported Row (ex1)
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' })) // open ⋯
  await user.click(screen.getByText('Áthelyezés')) // reorder sub-view (remaining = ex2..ex5)
  await user.click(screen.getByRole('button', { name: 'Cable Pull-Around feljebb' })) // ex3 up → next becomes ex3
  await user.keyboard('{Escape}') // close the sheet
  // complete Chest Supported Row's sets, then advance through the debrief
  await completeExerciseSets(user)
  await user.click(await screen.findByText('Mentés · tovább')) // debrief advance (non-last)
  // the next active exercise is now Cable Pull-Around (was Lat Pulldown before the reorder)
  expect(await screen.findByText('Cable Pull-Around')).toBeInTheDocument()
  // Header dots (final-review fix, mezo-8141 — Finding 1): Cable Pull-Around is now
  // current even though its STATIC array index (2) is past Lat Pulldown's (1) —
  // Lat Pulldown was only moved BEHIND it by the reorder, never actually logged, so
  // it must stay pending (no `.don`), not read as falsely "done" by array position.
  const dots = container.querySelectorAll('.exdots i')
  expect(dots[0]).toHaveClass('don') // Chest Supported Row: genuinely done
  expect(dots[1]).not.toHaveClass('don') // Lat Pulldown: untouched, merely reordered behind
  expect(dots[2]).toHaveClass('cur') // Cable Pull-Around: now current
})

test('＋ Szett adds an extra set: the set-dots and prescribed list grow 5→6', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))          // active, current = Chest Supported Row (5 planned sets: 2 warmup + 3 working)
  expect(container.querySelectorAll('.setdots .sd')).toHaveLength(5)
  expect(screen.getAllByText('Working')).toHaveLength(3)    // 3 planned working rows
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('＋ Szett'))             // adds one extra set; sheet closes
  const dots = container.querySelectorAll('.setdots .sd')
  expect(dots).toHaveLength(6)
  expect(screen.getAllByText('Working')).toHaveLength(4)    // the extra shows as a 4th working row
  expect(screen.getAllByText('Bemel.')).toHaveLength(2)     // warmups unchanged
  // The added (6th) set-dot carries the restored dashed "extra" marker (final-review
  // fix, mezo-8141 — Finding 2); the planned dots stay plain.
  expect(dots[5]).toHaveClass('extra')
  expect(dots[0]).not.toHaveClass('extra')
})

test('⋯ Kihagyás advances to the next exercise without opening the debrief', async () => {
  const user = userEvent.setup()
  const { container } = setup() // mock mode, current = Chest Supported Row (ex1)
  await user.click(screen.getByText(/Kezdjük el/))
  expect(screen.getByText('Chest Supported Row')).toBeInTheDocument()
  // Start a mid-exercise rest before skipping — skip must clear it (final-review
  // fix, mezo-8141 — Ride-along A), not leave the island counting toward an
  // abandoned exercise.
  await user.click(screen.getByText('Szett kész ✓'))
  expect(container.querySelector('.dynamic-island.live')).not.toBeNull()
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Kihagyás'))
  // Advances straight to the next exercise — no FeedbackModal / debrief CTA.
  expect(await screen.findByText('Lat Pulldown · Pronated')).toBeInTheDocument()
  expect(screen.queryByText('Mentés · tovább')).not.toBeInTheDocument()
  expect(screen.queryByText('Edzés vége →')).not.toBeInTheDocument()
  expect(container.querySelector('.dynamic-island.live')).toBeNull()
})

test('a skipped exercise is marked "kihagyva" in the recap', async () => {
  const user = userEvent.setup()
  setup() // mock mode, 5 exercises, current = Chest Supported Row (ex1)
  await user.click(screen.getByText(/Kezdjük el/))
  // Skip the first exercise.
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Kihagyás'))
  expect(await screen.findByText('Lat Pulldown · Pronated')).toBeInTheDocument()
  // Drive the remaining 4 exercises to completion (each: log every set, then
  // resolve the debrief). The last debrief CTA reads "Edzés vége →" and finishes.
  for (let ex = 0; ex < 4; ex++) {
    await completeExerciseSets(user)
    const cta = await screen.findByText(/Mentés · tovább|Edzés vége →/)
    await user.click(cta) // close() runs the Sheet slide-down, then onResolve advances
    // Wait for the next exercise's fresh set-dots (no done sets yet) before looping.
    if (ex < 3) await waitFor(() => expect(document.querySelector('.setdots .sd.don')).toBeNull())
  }
  // WorkoutComplete recap: the skipped first exercise reads "kihagyva".
  expect(await screen.findByText('kihagyva')).toBeInTheDocument()
})

test('a skipped exercise dot shows as dashed (skp class), not solid done (don class)', async () => {
  const user = userEvent.setup()
  setup() // mock mode, 5 exercises, current = Chest Supported Row (ex0)
  await user.click(screen.getByText(/Kezdjük el/))
  // The header's exdots container has 5 dots (one per exercise); ex0 is current (cur).
  // Skip ex0 and verify its dot now carries .skp, not .don (which marks completed).
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Kihagyás'))
  // After skip, we're on ex1 (Lat Pulldown). The exdots are re-rendered with ex0 skipped.
  await screen.findByText('Lat Pulldown · Pronated')
  const dots = document.querySelectorAll('.exdots i')
  expect(dots.length).toBe(5)
  // Skipped dot (ex0): has .skp, no .don
  expect(dots[0]).toHaveClass('skp')
  expect(dots[0]).not.toHaveClass('don')
  // Current dot (ex1): has .cur
  expect(dots[1]).toHaveClass('cur')
})

test('shows the level-up overlay on finish, then reveals the recap on Tovább (mock)', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  // Skip ex0, then drive the remaining 4 exercises to completion — the last
  // debrief CTA finishes the workout (the proven mock finish path).
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Kihagyás'))
  await screen.findByText('Lat Pulldown · Pronated')
  for (let ex = 0; ex < 4; ex++) {
    await completeExerciseSets(user)
    const cta = await screen.findByText(/Mentés · tovább|Edzés vége →/)
    await user.click(cta)
    if (ex < 3) await waitFor(() => expect(document.querySelector('.setdots .sd.don')).toBeNull())
  }
  // Mock finish returns the seeded gym fixture → the level-up overlay shows over the recap.
  const dialog = await screen.findByRole('dialog', { name: 'Szintlépés' })
  expect(within(dialog).getByText(/KLASSZIK KONDI/)).toBeInTheDocument()
  await user.click(within(dialog).getByRole('button', { name: /Tovább/ }))
  expect(screen.queryByRole('dialog', { name: 'Szintlépés' })).not.toBeInTheDocument()
  // The WorkoutComplete recap is revealed underneath.
  expect(await screen.findByText(/Edzés vége ·/)).toBeInTheDocument()
  // The gym fixture has a max_strength level-up → the recap's PR framing derives
  // from the real signal (hadPrFromSignal), not the old 105 kg demo scan.
  expect(screen.getByText('Megdöntöttük.')).toBeInTheDocument()
})

// ---- F4 note: durable per-exercise note pill + editor (mock-mode) ----

test('mock mode: no note pill on the active card when the exercise has no note', async () => {
  const user = userEvent.setup()
  setup() // mock exercises carry no note
  await user.click(screen.getByText(/Kezdjük el/))
  expect(screen.getByText('Chest Supported Row')).toBeInTheDocument()
  expect(screen.queryByLabelText('Gyakorlat-jegyzet')).not.toBeInTheDocument()
})

test('mock mode: editing a note via ⋯ → Jegyzet renders the note pill with the typed text', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Jegyzet'))
  const textarea = await screen.findByLabelText('Gyakorlat-jegyzet szerkesztése')
  await user.type(textarea, 'Lassú excentrikus')
  await user.click(screen.getByText('Mentés'))
  const pill = await screen.findByLabelText('Gyakorlat-jegyzet')
  expect(pill).toHaveTextContent('Lassú excentrikus')
})

test('mock mode: clearing the note via the editor removes the pill', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  // 1. add a note → the pill renders with the typed text.
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Jegyzet'))
  const textarea = await screen.findByLabelText('Gyakorlat-jegyzet szerkesztése')
  await user.type(textarea, 'Lassú excentrikus')
  await user.click(screen.getByText('Mentés'))
  expect(await screen.findByLabelText('Gyakorlat-jegyzet')).toHaveTextContent('Lassú excentrikus')
  // 2. reopen the editor (row label now reads "Jegyzet szerkesztése"), empty it, save.
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Jegyzet szerkesztése'))
  const reopened = await screen.findByLabelText('Gyakorlat-jegyzet szerkesztése')
  await user.clear(reopened)
  await user.click(screen.getByText('Mentés'))
  // 3. the pill is gone — clearing to empty hides it (effectiveNote falls to '').
  await waitFor(() => expect(screen.queryByLabelText('Gyakorlat-jegyzet')).not.toBeInTheDocument())
})

// ---- real-mode block: the session drives the T2 write endpoints ----

const REAL_MESO = {
  id: 'm-1', title: 'T2 meso', shortTitle: 'T2', status: 'active',
  startDate: '2026-06-01', endDate: '2026-07-13', weeks: 6, currentWeek: 2,
  split: 'Pull / Push · 2×/hét', style: 'RP · 6 hét', phaseCurve: ['MEV', 'MAV'],
}
type PrescribedSetFixture = { kind: string; targetWeightKg: number | null; targetReps: number; targetRIR: number | null }
type RealExercise = {
  id: string; name: string; muscle: string
  warmupSets: number; workingSets: number; repMin: number; repMax: number
  targetRIR: number; type: string; note?: string | null
  anchorWeightKg?: number | null; rationale?: string | null
  prescribedSets?: PrescribedSetFixture[] | null
  lastWeek: { weightKg: number; reps: number; rir: number } | null
}
// Recipe-shaped /today exercise (warmupSets+workingSets = the old `sets`); prescribedSets
// omitted → toWorkoutPlan sets it null → the panel falls back to the lastWeek prefill.
const REAL_TODAY = {
  templateSessionId: 'd-1', dayLabel: 'Ma', title: 'Pull Day', durationEst: 60,
  exercises: [
    { id: 'e-1', name: 'Chest Supported Row', muscle: 'back', warmupSets: 0, workingSets: 2, repMin: 8, repMax: 10, targetRIR: 1, type: 'compound', lastWeek: { weightKg: 102.5, reps: 9, rir: 2 } },
  ] as RealExercise[],
  openWorkout: null as unknown,
}

function useRealHandlers(today: typeof REAL_TODAY, calls: string[]) {
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([REAL_MESO])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/workouts/today`, () => HttpResponse.json(today)),
    http.post(`${API_BASE}/api/train/workouts`, async ({ request }) => {
      const body = (await request.json()) as { templateSessionId: string }
      calls.push(`start:${body.templateSessionId}`)
      return HttpResponse.json({ id: 'w-1', templateSessionId: body.templateSessionId, date: '2026-06-12', status: 'active', sets: [] }, { status: 201 })
    }),
    http.post(`${API_BASE}/api/train/workouts/:id/sets`, async ({ params, request }) => {
      const body = (await request.json()) as { exerciseId: string; setIndex: number; weightKg: number; note?: string }
      // note is appended only when present, so pre-existing exact-string assertions
      // (tests that never type a note) stay unaffected.
      calls.push(`set:${params.id}:${body.exerciseId}:${body.setIndex}:${body.weightKg}` + (body.note ? `:note=${body.note}` : ''))
      return HttpResponse.json({ id: 'st-' + body.setIndex, exerciseId: body.exerciseId, setIndex: body.setIndex }, { status: 201 })
    }),
    http.post(`${API_BASE}/api/train/workouts/:id/skip`, async ({ params, request }) => {
      const body = (await request.json()) as { exerciseId: string }
      calls.push(`skip:${params.id}:${body.exerciseId}`)
      return new HttpResponse(null, { status: 204 })
    }),
    http.post(`${API_BASE}/api/train/workouts/:id/feedback`, ({ params }) => {
      calls.push(`feedback:${params.id}`)
      return new HttpResponse(null, { status: 204 })
    }),
    http.post(`${API_BASE}/api/train/workouts/:id/finish`, ({ params }) => {
      calls.push(`finish:${params.id}`)
      return HttpResponse.json({ id: String(params.id), templateSessionId: 'd-1', date: '2026-06-12', status: 'completed', sets: [] })
    }),
    http.put(`${API_BASE}/api/train/exercises/:exerciseId/note`, async ({ params, request }) => {
      const body = (await request.json()) as { note?: string | null }
      calls.push(`note:${params.exerciseId}:${body.note ?? ''}`)
      return new HttpResponse(null, { status: 204 })
    }),
  )
}

test('real mode: starting creates the instance and Szett kész posts the set', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(REAL_TODAY, calls)
  const user = userEvent.setup()
  setup()
  await user.click(await screen.findByText(/Kezdjük el/))
  await waitFor(() => expect(calls).toContain('start:d-1'))
  await user.click(screen.getByText('Szett kész ✓'))
  await waitFor(() => expect(calls).toContain('set:w-1:e-1:0:102.5')) // prefill = last week
})

test('real mode: typing a per-set note before Szett kész sends it in the logSet payload', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(REAL_TODAY, calls)
  const user = userEvent.setup()
  setup()
  await user.click(await screen.findByText(/Kezdjük el/))
  await waitFor(() => expect(calls).toContain('start:d-1'))
  await user.type(await screen.findByLabelText('Szett megjegyzés'), 'Fájt a csukló')
  await user.click(screen.getByText('Szett kész ✓'))
  await waitFor(() => expect(calls).toContain('set:w-1:e-1:0:102.5:note=Fájt a csukló'))
})

test('real mode: an open instance resumes mid-workout with seeded sets', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(
    {
      ...REAL_TODAY,
      openWorkout: {
        id: 'w-9', templateSessionId: 'd-1', date: '2026-06-12', status: 'active',
        sets: [{ id: 's-1', exerciseId: 'e-1', setIndex: 0, weightKg: 100, reps: 8, rir: 2 }],
      },
    },
    calls,
  )
  const user = userEvent.setup()
  const { container } = setup()
  // no prep screen — jumps straight into the active phase at set 2
  expect(await screen.findByText('Szett kész ✓')).toBeInTheDocument()
  const dots = container.querySelectorAll('.setdots .sd')
  expect(dots).toHaveLength(2)
  expect(dots[0]).toHaveClass('don')
  expect(dots[1]).toHaveClass('cur')
  await user.click(screen.getByText('Szett kész ✓'))
  await waitFor(() => expect(calls.some((c) => c.startsWith('set:w-9:e-1:1'))).toBe(true))
})

test('real mode: a hard reload on /train/session resumes instead of redirecting while queries load', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(
    {
      ...REAL_TODAY,
      openWorkout: {
        id: 'w-9', templateSessionId: 'd-1', date: '2026-06-12', status: 'active',
        sets: [{ id: 's-1', exerciseId: 'e-1', setIndex: 0, weightKg: 100, reps: 8, rir: 2 }],
      },
    },
    calls,
  )
  // Route-mounted render (like a fresh page load): if the guard redirects during
  // the pending query state, the router unmounts the session screen for good.
  const { routes } = await import('@/app/router')
  const { createMemoryRouter, RouterProvider } = await import('react-router-dom')
  const { ThemeProvider } = await import('@/app/ThemeProvider')
  const router = createMemoryRouter(routes, { initialEntries: ['/train/session'] })
  const { container } = render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
  expect(await screen.findByText('Szett kész ✓')).toBeInTheDocument()
  const dots = container.querySelectorAll('.setdots .sd')
  expect(dots).toHaveLength(2) // resumed at the 2nd set
  expect(dots[0]).toHaveClass('don')
  expect(dots[1]).toHaveClass('cur')
})

test('real mode: the last set debrief persists feedback and finish fires', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(
    { ...REAL_TODAY, exercises: [{ ...REAL_TODAY.exercises[0], workingSets: 1 }] },
    calls,
  )
  const user = userEvent.setup()
  setup()
  await user.click(await screen.findByText(/Kezdjük el/))
  await waitFor(() => expect(calls).toContain('start:d-1'))
  await user.click(screen.getByText('Szett kész ✓')) // only set -> FeedbackModal
  await user.click(await screen.findByText('Edzés vége →'))
  await waitFor(() => expect(calls).toContain('feedback:w-1'))
  await waitFor(() => expect(calls).toContain('finish:w-1'))
  expect(await screen.findByText(/Edzés vége ·/)).toBeInTheDocument() // WorkoutComplete
})

test('real mode: ＋ Szett grows a 1-set exercise to 2 and the extra set posts with setIndex 1', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(
    { ...REAL_TODAY, exercises: [{ ...REAL_TODAY.exercises[0], workingSets: 1 }] },
    calls,
  )
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(await screen.findByText(/Kezdjük el/))
  await waitFor(() => expect(calls).toContain('start:d-1'))
  expect(container.querySelectorAll('.setdots .sd')).toHaveLength(1)
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('＋ Szett')) // 1 planned set -> 2 effective
  expect(container.querySelectorAll('.setdots .sd')).toHaveLength(2) // the extra set grew the count to 2
  await user.click(screen.getByText('Szett kész ✓')) // set 1 (setIndex 0)
  expect(container.querySelectorAll('.setdots .sd.don')).toHaveLength(1) // still mid-exercise, not overflowed
  await user.click(screen.getByText('Szett kész ✓')) // extra set (setIndex 1) -> last set, opens FeedbackModal
  await waitFor(() => expect(calls.some((c) => c.startsWith('set:w-1:e-1:1'))).toBe(true))
})

test('real mode: ⋯ Kihagyás POSTs the skip for the current exercise', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  // Two exercises so the skip advances (not finishes) and the POST is isolated.
  useRealHandlers(
    {
      ...REAL_TODAY,
      exercises: [
        REAL_TODAY.exercises[0],
        { id: 'e-2', name: 'Lat Pulldown · Pronated', muscle: 'lats', warmupSets: 0, workingSets: 2, repMin: 10, repMax: 12, targetRIR: 2, type: 'compound', lastWeek: { weightKg: 72, reps: 11, rir: 2 } },
      ],
    },
    calls,
  )
  const user = userEvent.setup()
  setup()
  await user.click(await screen.findByText(/Kezdjük el/))
  await waitFor(() => expect(calls).toContain('start:d-1'))
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Kihagyás'))
  await waitFor(() => expect(calls).toContain('skip:w-1:e-1'))
  expect(await screen.findByText('Lat Pulldown · Pronated')).toBeInTheDocument()
})

test('real mode: a /today exercise WITH a note renders the pill on the active card', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(
    { ...REAL_TODAY, exercises: [{ ...REAL_TODAY.exercises[0], note: '4-es ülés' }] },
    calls,
  )
  const user = userEvent.setup()
  setup()
  await user.click(await screen.findByText(/Kezdjük el/))
  const pill = await screen.findByLabelText('Gyakorlat-jegyzet')
  expect(pill).toHaveTextContent('4-es ülés')
})

test('real mode: editing + saving a note PUTs it for the current exercise', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(REAL_TODAY, calls)
  const user = userEvent.setup()
  setup()
  await user.click(await screen.findByText(/Kezdjük el/))
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Jegyzet'))
  const textarea = await screen.findByLabelText('Gyakorlat-jegyzet szerkesztése')
  await user.type(textarea, 'Tartsd a könyököt')
  await user.click(screen.getByText('Mentés'))
  await waitFor(() => expect(calls).toContain('note:e-1:Tartsd a könyököt'))
  const pill = await screen.findByLabelText('Gyakorlat-jegyzet')
  expect(pill).toHaveTextContent('Tartsd a könyököt')
})

test('real mode: the logging panel pre-fills from the prescribed target (not lastWeek)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(
    {
      ...REAL_TODAY,
      exercises: [
        {
          ...REAL_TODAY.exercises[0],
          warmupSets: 2, workingSets: 3, repMin: 8, repMax: 10,
          rationale: 'Múlt hét 9 × 102.5 kg → +2.5 kg',
          prescribedSets: [
            { kind: 'warmup', targetWeightKg: 52.5, targetReps: 10, targetRIR: null },
            { kind: 'warmup', targetWeightKg: 77.5, targetReps: 5, targetRIR: null },
            { kind: 'working', targetWeightKg: 105, targetReps: 10, targetRIR: 0 },
            { kind: 'working', targetWeightKg: 105, targetReps: 10, targetRIR: 0 },
            { kind: 'working', targetWeightKg: 105, targetReps: 10, targetRIR: 0 },
          ],
        },
      ],
    },
    calls,
  )
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(await screen.findByText(/Kezdjük el/))
  // first warmup target = 52.5 kg × 10 (engine prescription, NOT lastWeek 102.5)
  await screen.findByRole('button', { name: 'Súly növelése' })
  expect(container.querySelector('.steprow')).toHaveTextContent('52,5')
  expect(container.querySelector('.steprow')).toHaveTextContent('10')
  expect(screen.getByText(/→ \+2\.5 kg/)).toBeInTheDocument() // rationale on the active card
  // the logged set carries the prescribed warmup weight, not lastWeek
  await user.click(screen.getByText('Szett kész ✓'))
  await waitFor(() => expect(calls).toContain('set:w-1:e-1:0:52.5'))
})

test('real mode: a first-ever workout (no lastWeek) still shows the engine rationale', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(
    {
      ...REAL_TODAY,
      exercises: [
        {
          ...REAL_TODAY.exercises[0],
          lastWeek: null, // first-ever workout: no Múlt hét comparison
          rationale: 'Kezdő súly (anchor)',
        },
      ],
    },
    calls,
  )
  const user = userEvent.setup()
  setup()
  await user.click(await screen.findByText(/Kezdjük el/))
  // The "múlt héten:" comparison line is absent (no lastWeek) but the rationale still renders.
  expect(await screen.findByText('Kezdő súly (anchor)')).toBeInTheDocument()
  expect(screen.queryByText(/múlt héten/i)).not.toBeInTheDocument()
})

test('real mode: a plyo set hides the kg stepper and logs weightKg 0 (reps-only)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(
    {
      ...REAL_TODAY,
      exercises: [
        {
          ...REAL_TODAY.exercises[0],
          id: 'e-plyo', name: 'Box Jump', muscle: 'quad', type: 'plyo',
          warmupSets: 0, workingSets: 1, repMin: 5, repMax: 5, targetRIR: 2,
          lastWeek: null,
          prescribedSets: [{ kind: 'working', targetWeightKg: null, targetReps: 5, targetRIR: 2 }],
        },
      ],
    },
    calls,
  )
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(await screen.findByText(/Kezdjük el/))
  expect(screen.getByText('Box Jump')).toBeInTheDocument()
  await screen.findByRole('button', { name: 'Ismétlés növelése' })
  expect(screen.queryByRole('button', { name: 'Súly növelése' })).not.toBeInTheDocument() // no load to log
  expect(container.querySelector('.steprow')).toHaveTextContent('5')
  await user.click(screen.getByText('Szett kész ✓'))
  await waitFor(() => expect(calls).toContain('set:w-1:e-plyo:0:0')) // weightKg 0
})

// --- F2 add-set: optional "Minden hétre" template write (reuses the day-exercises PUT) ---

const TEMPLATE_MESO_ID = 'b6f3a0e2-0000-4000-8000-0000000000aa'
const TEMPLATE_DAY_ID = 'c6f3a0e2-0000-4000-8000-0000000000bb'

// A meso whose template day CONTAINS the workout's current exercise (id 'e-1'),
// so the screen can resolve the day from the current exercise and bump its set count.
function useTemplateWriteHandlers(puts: { url: string; body: { name: string; workingSets: number }[] }[]) {
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () =>
      HttpResponse.json([
        {
          id: TEMPLATE_MESO_ID, title: 'T2 meso', shortTitle: 'T2', status: 'active',
          startDate: '2026-06-01', endDate: '2026-07-13', weeks: 6, currentWeek: 2,
          split: 'PPL', style: 'RP', phaseCurve: ['MEV', 'MAV'],
          days: [
            {
              id: TEMPLATE_DAY_ID, day: 'Csü', type: 'Pull', muscle: 'back', exerciseCount: 1, current: true,
              exercises: [
                { id: 'e-1', name: 'Chest Supported Row', muscle: 'back-mid', warmupSets: 2, workingSets: 4, repMin: 8, repMax: 10, targetRIR: 1, type: 'compound' },
              ],
            },
          ],
        },
      ]),
    ),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/workouts/today`, () =>
      HttpResponse.json({
        templateSessionId: 'd-1', dayLabel: 'Ma', title: 'Pull Day', durationEst: 60,
        exercises: [
          { id: 'e-1', name: 'Chest Supported Row', muscle: 'back-mid', warmupSets: 2, workingSets: 4, repMin: 8, repMax: 10, targetRIR: 1, type: 'compound', lastWeek: { weightKg: 102.5, reps: 9, rir: 2 } },
        ],
        openWorkout: null,
      }),
    ),
    http.post(`${API_BASE}/api/train/workouts`, async ({ request }) => {
      const body = (await request.json()) as { templateSessionId: string }
      return HttpResponse.json({ id: 'w-1', templateSessionId: body.templateSessionId, date: '2026-06-12', status: 'active', sets: [] }, { status: 201 })
    }),
    http.put(`${API_BASE}/api/train/mesocycles/:id/days/:dayId/exercises`, async ({ request, params }) => {
      puts.push({ url: `${params.id}/${params.dayId}`, body: (await request.json()) as { name: string; workingSets: number }[] })
      return HttpResponse.json({ id: params.dayId, day: 'Csü', type: 'Pull', muscle: 'back', exerciseCount: 1, exercises: [] })
    }),
  )
}

test('real mode: add-set "Minden hétre" PUTs the day with the current exercise working sets bumped by 1', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const puts: { url: string; body: { name: string; workingSets: number }[] }[] = []
  useTemplateWriteHandlers(puts)
  const user = userEvent.setup()
  setup()
  await user.click(await screen.findByText(/Kezdjük el/))
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('＋ Szett'))
  await user.click(await screen.findByText('Minden hétre'))
  await waitFor(() => expect(puts).toHaveLength(1))
  expect(puts[0].url).toBe(`${TEMPLATE_MESO_ID}/${TEMPLATE_DAY_ID}`)
  expect(puts[0].body.find((e) => e.name === 'Chest Supported Row')?.workingSets).toBe(5) // working 4 -> 5
})

test('real mode: add-set "Csak ma" fires no template PUT', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const puts: { url: string; body: { name: string; workingSets: number }[] }[] = []
  useTemplateWriteHandlers(puts)
  const user = userEvent.setup()
  setup()
  await user.click(await screen.findByText(/Kezdjük el/))
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('＋ Szett'))
  await user.click(await screen.findByText('Csak ma'))
  await new Promise((r) => setTimeout(r, 0))
  expect(puts).toHaveLength(0)
})

// --- loading skeleton (mezo-f2z) ---------------------------------------------
// Real mode renders the generic ScreenSkeleton (role="status") while the
// meso + today queries are unresolved (workoutPending = !mock && (mesoPending ||
// todayPending)); mock seeds → workoutPending is false → no skeleton (parity).
describe('ActiveWorkoutPage (real mode, pending)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())
  it('shows the skeleton while the meso + today queries are unresolved', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles`, () => new Promise(() => {})),
      http.get(`${API_BASE}/api/train/workouts/today`, () => new Promise(() => {})),
    )
    setup()
    expect(await screen.findByRole('status')).toBeInTheDocument()
    // Neither the prep screen nor a redirect content rendered yet.
    expect(screen.queryByText(/Kezdjük el/)).toBeNull()
  })
})

describe('ActiveWorkoutPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())
  it('renders content with no skeleton (synchronous seed)', () => {
    setup()
    expect(screen.queryByRole('status')).toBeNull()
  })
})

// --- real-mode challenges: honest confidence/tools + live L2 accept + outcome states ---

// One live proactive challenge for the session/day. `overrides` shape a proposed
// vs. resolved (hit) row. Live never sends `tools` (fabricated-transparency rule).
function challengeWire(overrides: Record<string, unknown> = {}) {
  return {
    id: 'chal-1',
    exerciseId: 'e-1',
    exercise: 'Chest Supported Row',
    type: 'PR',
    typeLabel: 'PR-attempt',
    status: 'proposed',
    target: '107.5 kg × 8',
    confidence: null,
    risk: 'low',
    why: 'A múlt heti RIR 2 + a stabil 102.5-ös ablak alapján megpróbálható.',
    glory: 'Új csúcs',
    refs: [{ kind: 'PR', label: 'Chest Row 105.8 · Márc 4' }],
    generatedAt: '2026-07-07T08:00:00Z',
    ...overrides,
  }
}

function useChallengeHandlers(rows: Record<string, unknown>[], calls: string[]) {
  useRealHandlers(REAL_TODAY, calls)
  server.use(
    http.get(`${API_BASE}/api/proactive/challenge`, () => HttpResponse.json(rows)),
    http.post(`${API_BASE}/api/proactive/challenge/:id/decision`, async ({ params, request }) => {
      const body = (await request.json()) as { decision: string }
      calls.push(`decide:${params.id}:${body.decision}`)
      return HttpResponse.json(challengeWire({ id: String(params.id), status: 'accepted' }))
    }),
  )
}

test('real mode: a proposed challenge with null confidence renders "tanulom" and NO tool chips', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useChallengeHandlers([challengeWire()], calls)
  setup()
  // prep screen — the carousel shows the live challenge
  expect(await screen.findByText('conf tanulom')).toBeInTheDocument()
  expect(screen.queryByText(/get_pr_history/)).not.toBeInTheDocument() // live sends no tools
  expect(screen.getByText('Vállaljuk')).toBeInTheDocument()
})

test('real mode: clicking "Vállaljuk" POSTs an accept decision for the challenge', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useChallengeHandlers([challengeWire()], calls)
  const user = userEvent.setup()
  setup()
  await user.click(await screen.findByText('Vállaljuk'))
  await waitFor(() => expect(calls).toContain('decide:chal-1:accept'))
})

test('real mode: a resolved (hit) challenge shows the ✓ Megerősítve chip + outcome, no action row', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useChallengeHandlers(
    [challengeWire({ status: 'hit', outcome: '110 kg × 8 — cél igazolva (+2.5 kg)', outcomeGood: true })],
    calls,
  )
  setup()
  expect(await screen.findByText('✓ Megerősítve')).toBeInTheDocument()
  expect(screen.getByText('110 kg × 8 — cél igazolva (+2.5 kg)')).toBeInTheDocument()
  // the workout is decided → the accept/skip row is hidden
  expect(screen.queryByText('Vállaljuk')).not.toBeInTheDocument()
  expect(screen.queryByText('Elfogadva')).not.toBeInTheDocument()
})
