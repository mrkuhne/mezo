import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { ActiveWorkoutPage } from '@/features/train/pages/ActiveWorkoutPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { resetMockMedalHistory } from '@/data/train/medalEvaluator'

// Asserts Phase-1 mock workout data, so pin mock mode explicitly (the swapped
// useTrain hook reads useQuery, so a QueryClientProvider is required too).
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())
// `completeSet` now always calls `logSet` (mezo-wp6n), so mock mode's medal evaluator
// runs on every set logged in every test below — its `history` map is module-level
// state (medalEvaluator.ts) and would otherwise leak across tests in this file (e.g.
// an earlier test logging a heavier Chest Supported Row set would suppress this
// file's own WEIGHT-record test). Reset it per test, same as medalEvaluator.test.ts.
beforeEach(() => resetMockMedalHistory())

function setup() {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/train/session']}>
        <LevelUpProvider>
          <ActiveWorkoutPage />
        </LevelUpProvider>
      </MemoryRouter>
    </QueryWrapper>,
  )
}

// Set counts vary per exercise (warmup + working sets), so a fixed loop is fragile.
// Click "Szett kész ✓" until the exercise's debrief CTA appears (always the last set).
// CTA-morph (mezo-xt65): a mid-exercise log swaps the CTA for the rest bar, so skip
// the rest each round to get the button back.
async function completeExerciseSets(user: ReturnType<typeof userEvent.setup>) {
  for (let i = 0; i < 12; i++) {
    await user.click(screen.getByText('Szett kész ✓'))
    if (screen.queryByText(/Mentés · tovább|Edzés vége →/)) return
    const skip = screen.queryByRole('button', { name: 'Pihenő kihagyása' })
    if (skip) await user.click(skip)
  }
}

// Live re-face (mezo-d20.3.9): the set table is REFERENCE content and lives inside
// the "Szettek" collapsible strip, closed by default (the calm logging default) —
// open it before asserting on / tapping its rows.
async function openSetsStrip(user: ReturnType<typeof userEvent.setup>) {
  const head = screen.getByRole('button', { name: /^Szettek/ })
  if (head.getAttribute('aria-expanded') === 'false') await user.click(head)
}

test('prep screen shows the workout title, the mosaic tiles and the start CTA above the fold', () => {
  setup()
  expect(screen.getAllByText('Pull Day').length).toBeGreaterThan(0)
  expect(screen.getByRole('button', { name: 'A mai küldetések' })).toBeInTheDocument()
  expect(screen.getByText('0/4 elfogadva')).toBeInTheDocument()
  expect(screen.getByText(/Kezdjük el/)).toBeInTheDocument()
})

// --- mission-briefing prep hero + mosaic (mezo-bxpg → mezo-d20.3.8 tile re-face) ---

test('mock mode: the hero shows the 4 mini stat cells (várható XP / szett / idő / izomcsoport)', () => {
  const { container } = setup()
  const strip = container.querySelector('.tp-hero .mz-statstrip')
  expect(strip).toHaveTextContent('várható XP')
  expect(strip).toHaveTextContent('szett')
  expect(strip).toHaveTextContent('idő')
  expect(strip).toHaveTextContent('izomcsoport')
})

test('mock mode: the Gyakorlatok tile opens the muscle-sectioned exercise-tile page', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: 'Gyakorlatok' }))
  // Pull Day (mock): ex1/ex2/ex3 back-mid+lats+back-mid -> Hát (3), ex4 biceps -> Kar (1),
  // ex5 rear-delt -> Váll (1) — plan-order-preserving muscle-color family sections.
  expect(screen.getByText('Hát · 3 gyakorlat')).toBeInTheDocument()
  expect(screen.getByText('Kar · 1 gyakorlat')).toBeInTheDocument()
  expect(screen.getByText('Váll · 1 gyakorlat')).toBeInTheDocument()
  expect(screen.getByText('Chest Supported Row')).toBeInTheDocument()
})

test('mock mode: the 1RM medal is omitted on the Gyakorlatok tile page (mock exerciseRecords is always empty — never fabricated)', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: 'Gyakorlatok' }))
  expect(screen.queryByText('1RM')).not.toBeInTheDocument()
  expect(screen.queryByText(/🏆/)).not.toBeInTheDocument()
})

// Byte-parity guard: the Phase-1 mock seed still renders its fabricated confidence
// (0.72 → "conf 72%") + the tool-transparency chips exactly as before the live wiring —
// now inside the Küldetések tile's own page.
test('mock mode: the seed challenge renders conf 72% and its tool chips (byte parity)', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: 'A mai küldetések' }))
  expect(screen.getByText('conf 72%')).toBeInTheDocument()
  expect(screen.getByText('get_pr_history(ex=chest_row)')).toBeInTheDocument()
  expect(screen.queryByText('tanulom')).not.toBeInTheDocument()
})

test('prep screen shows the Niggle tile, and its page carries the pre-flight message', async () => {
  const user = userEvent.setup()
  setup()
  expect(screen.getByRole('button', { name: 'Aktív niggle' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Aktív niggle' }))
  expect(screen.getByText(/Jobb váll/)).toBeInTheDocument()
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

test('mock mode: the last-week comparison is surfaced (in the Progresszió strip since mezo-d20.3.9)', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  // ex1.lastWeek = { weight: 102.5, reps: 9, rir: 2 }. The calm card no longer
  // repeats it — it lives in the Progresszió strip's Múlt hét cell.
  await user.click(screen.getByRole('button', { name: /Progresszió/ }))
  const banner = container.querySelector('.pobanner') as HTMLElement
  expect(within(banner).getByText('Múlt hét')).toBeInTheDocument()
  expect(within(banner).getByText('102,5 × 9 · RIR 2')).toBeInTheDocument()
})

// ---- Execution card v2 (mezo-8xmf) → calm re-face (mezo-d20.3.9): the muscle-themed
// card, its metaline and the single logging panel ----

test('mock mode: the eyebrow shows idx/n · muscleLabel · type, and the metaline + panel render style, rep-range and set count', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  // ex1: 1/5, muscle 'back-mid' -> MUSCLE_LABELS 'Hát (közép)', type compound.
  expect(container.querySelector('.excard .exo')).toHaveTextContent('1/5 · Hát (közép) · compound')
  // ex1.targetRIR = 0 -> failure style (setStyle, RIR<=1); repMin/repMax = 8/10;
  // 2 warmup + 3 working planned, none logged yet. Style + rep-range read from the
  // metaline; the working-set count from the logging panel's own counter.
  const meta = container.querySelector('.wkx-metaline')
  expect(meta).toHaveTextContent('🔥 Failure')
  expect(meta).toHaveTextContent('8–10')
  expect(container.querySelector('.wkx-lgoal')).toHaveTextContent('0/3')
})

test('mock mode: the RIR row shows the failure-style "bukásig" hint on a working set', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  // Log both ex1 warmups to reach the first working set (RIR row visible).
  await user.click(screen.getByText('Szett kész ✓'))
  await user.click(screen.getByRole('button', { name: 'Pihenő kihagyása' }))
  await user.click(screen.getByText('Szett kész ✓'))
  await user.click(screen.getByRole('button', { name: 'Pihenő kihagyása' }))
  expect(await screen.findByText('🔥 bukásig!')).toBeInTheDocument()
})

test('real mode: a volume-style exercise (targetRIR 2) shows the sage hint and the Volume metaline', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(
    { ...REAL_TODAY, exercises: [{ ...REAL_TODAY.exercises[0], warmupSets: 0, workingSets: 1, targetRIR: 2 }] },
    calls,
  )
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(await screen.findByText(/Kezdjük el/))
  const meta = container.querySelector('.wkx-metaline')
  expect(meta).toHaveTextContent('🌿 Volume')
  expect(meta).toHaveTextContent('RIR 2')
  expect(await screen.findByText('🌿 hagyj 2 rep tartalékot')).toBeInTheDocument()
})

test('mock mode: the session progress bar renders one segment per exercise', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  // Pull Day (mock) has 5 exercises.
  expect(container.querySelectorAll('.wkx-progressbar span')).toHaveLength(5)
})

test('mock mode: the set-dots note shows the last logged warmup\'s percent label once a warmup is logged', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  expect(container.querySelector('.wkx-setdots-note')).toBeNull()
  // ex1 B1: 52.5 kg target vs the first working target 105 kg -> 50%. The kg is
  // hu-HU formatted (final-review fix, mezo-8xmf) like the rest of the card's numbers.
  await user.click(screen.getByText('Szett kész ✓'))
  expect(await screen.findByText('B1 = 50% · 52,5 ✓')).toBeInTheDocument()
})

test('the wk-top header shows the workout title, the gyakorlat/szett counter, an exercise dot per exercise and the Vissza + ⋯ buttons', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  expect(container.querySelector('.wk-top .t1')).toHaveTextContent('Pull Day')
  // currentIdx=0, 5 exercises, 0 sets logged yet, 22 total planned sets (5+5+4+4+4).
  // The counter is now a ▾ overview-trigger button (Task 7 free navigation).
  expect(screen.getByText('▾ 1/5 gyakorlat · 0/22 szett')).toBeInTheDocument()
  expect(container.querySelectorAll('.exdots i')).toHaveLength(5)
  expect(screen.getByRole('button', { name: 'Vissza' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Gyakorlat műveletek' })).toBeInTheDocument()
})

test('completing a set advances the set-dot cursor and the header counter', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  expect(screen.getByText('▾ 1/5 gyakorlat · 0/22 szett')).toBeInTheDocument()
  expect(container.querySelectorAll('.setdots .sd.don')).toHaveLength(0)
  await user.click(screen.getByText('Szett kész ✓'))
  expect(container.querySelectorAll('.setdots .sd.don')).toHaveLength(1)
  expect(screen.getByText('▾ 1/5 gyakorlat · 1/22 szett')).toBeInTheDocument()
})

// ---- rest wiring: "Szett kész ✓" morphs into the in-card rest bar (mezo-xt65) ----

test('mock mode: logging a mid-exercise set morphs the CTA into the rest bar', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  expect(container.querySelector('.restbar')).toBeNull()
  // ex1 (Chest Supported Row, compound): 2 warmup + 3 working = 5 planned sets.
  // Logging the first (a warmup) leaves 4 sets remaining -> the exercise continues.
  await user.click(screen.getByText('Szett kész ✓'))
  expect(container.querySelector('.restbar')).not.toBeNull()
  expect(screen.getByText('Pihenő')).toBeInTheDocument()
  // The morph: while resting there is no Szett kész CTA.
  expect(screen.queryByText('Szett kész ✓')).toBeNull()
})

test('mock mode: skip restores the Szett kész CTA', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  await user.click(screen.getByText('Szett kész ✓'))
  await user.click(screen.getByRole('button', { name: 'Pihenő kihagyása' }))
  expect(container.querySelector('.restbar')).toBeNull()
  expect(screen.getByText('Szett kész ✓')).toBeInTheDocument()
})

test('mock mode: pause freezes the bar into Szünetel; resume brings Pihenő back', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  await user.click(screen.getByText('Szett kész ✓'))
  await user.click(screen.getByRole('button', { name: 'Pihenő szüneteltetése' }))
  expect(screen.getByText('Szünetel')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Pihenő folytatása' }))
  expect(screen.getByText('Pihenő')).toBeInTheDocument()
})

test('mock mode: logging an exercise\'s final set (opens the feedback modal) starts no rest', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  // Drive through ex1's 4 non-final sets, skipping each rest to re-reveal the CTA.
  for (let i = 0; i < 4; i++) {
    await user.click(screen.getByText('Szett kész ✓'))
    await user.click(screen.getByRole('button', { name: 'Pihenő kihagyása' }))
  }
  // The 5th (last) set completes the exercise -> feedback modal opens, no rest.
  await user.click(screen.getByText('Szett kész ✓'))
  expect(await screen.findByText(/Mentés · tovább|Edzés vége →/)).toBeInTheDocument()
  expect(container.querySelector('.restbar')).toBeNull()
})

test('mock mode: the rest bar rides along when navigating to another exercise', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  await user.click(screen.getByText('Szett kész ✓')) // rest starts on ex1
  expect(container.querySelector('.restbar')).not.toBeNull()
  // Free navigation: page to ex2 — the rest is the user's, so the bar stays.
  await user.click(screen.getByRole('button', { name: 'Következő: Lat Pulldown · Pronated' }))
  expect(await screen.findByText('Lat Pulldown · Pronated')).toBeInTheDocument()
  expect(container.querySelector('.restbar')).not.toBeNull()
})

test('mock mode: reaching the summary screen (workout end) shows no rest bar', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  // Skip ex0 (no rest on skip), then drive the remaining 4 exercises to completion.
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Kihagyás'))
  await screen.findByText('Lat Pulldown · Pronated')
  for (let ex = 0; ex < 4; ex++) {
    await completeExerciseSets(user)
    const cta = await screen.findByText(/Mentés · tovább|Edzés vége →/)
    await user.click(cta)
    if (ex < 3) await waitFor(() => expect(document.querySelector('.setdots .sd.don')).toBeNull())
  }
  expect(await screen.findByText('Edzés vége')).toBeInTheDocument()
  await waitFor(() => expect(container.querySelector('.restbar')).toBeNull())
})

test('mock mode: the giant steppers pre-fill the current set from the prescribed target', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  // ex1: warmups are sets 1-2 (52.5×8, 80×3), working sets are 105×10.
  await screen.findByRole('button', { name: 'Súly növelése' }) // wait for the active phase
  expect(container.querySelector('.steprow')).toHaveTextContent('52,5') // first warmup target
  expect(container.querySelector('.steprow')).toHaveTextContent('8')
})

test('the kind chip under the set-dots is gone — the dots alone carry warmup/working (mezo-xt65)', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  await screen.findByRole('button', { name: 'Súly növelése' })
  expect(container.querySelector('.setdots .sd.cur')).toHaveTextContent('B1')
  expect(container.querySelector('.excard .stag')).toBeNull()
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
  // Calm default (mezo-d20.3.9): the input hides behind the ＋ megjegyzés toggle.
  await user.click(screen.getByRole('button', { name: /megjegyzés a szetthez/ }))
  const noteInput = await screen.findByLabelText('Szett megjegyzés')
  await user.type(noteInput, 'Nehéz volt az utolsó ismétlés')
  expect(noteInput).toHaveValue('Nehéz volt az utolsó ismétlés')
  await user.click(screen.getByText('Szett kész ✓'))
  // Post-log reset: the transient note clears AND the field re-collapses (proves it
  // participates in the completeSet submit path, same as the old removed input did).
  expect(screen.queryByLabelText('Szett megjegyzés')).toBeNull()
  await user.click(screen.getByRole('button', { name: /megjegyzés a szetthez/ }))
  expect(await screen.findByLabelText('Szett megjegyzés')).toHaveValue('')
})

test('mock mode: renders the progression banner rationale line instead of the static hint', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  // ex1 has a progression signal (mezo-5pfe), so the ProgressionBanner renders
  // (progression.rationale, Hungarian comma decimal) instead of the plain .aistrip.
  expect(await screen.findByText(/→ \+2,5 kg/)).toBeInTheDocument() // ex1.progression.rationale
})

test('mock mode: warmup sets render up-front as 2 amber-filled "B" marker rows in the set-list table (v4, mezo-8xmf)', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  // The v4 table shows ALL sets up front; ex1's 2 warmups are the 2 "bemelegítő
  // szett" rows (the old kind tag "Bemel." is gone — the marker circle + row
  // label now carry the warmup/working distinction).
  await openSetsStrip(user)
  expect(screen.getAllByRole('button', { name: /bemelegítő szett szerkesztése/ })).toHaveLength(2)
})

// ---- Set list v4 (mezo-8xmf): strict table — header pill, marker/status columns, footer ----

test('mock mode: the set-list header pill shows the exercise target once; the current row is outlined with "MOST ↑", later rows are ghosted with their target values', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  await openSetsStrip(user)
  // ex1: repMin 8, repMax 10, targetRIR 0 -> failure style (🔥) — the target
  // appears ONCE, in the header pill, not repeated per row.
  expect(screen.getByText('cél: 8–10 rep · RIR 0 🔥')).toBeInTheDocument()

  const rows = screen.getAllByRole('button', { name: /szett szerkesztése/ })
  // B1 (index 0) is the current (not-yet-logged) row: outlined marker + "MOST ↑".
  expect(rows[0].querySelector('.wkx-mark')).toHaveClass('wkx-mark-cur')
  expect(rows[0].querySelector('.wkx-c-st')).toHaveTextContent('MOST ↑')
  // B2 (index 1) hasn't been reached yet either — a not-yet-current warmup row
  // still marks amber-filled (mirrors the old set-dots' B-prefixed pending
  // marker) and shows its OWN target values, no status glyph.
  expect(rows[1].querySelector('.wkx-mark')).toHaveClass('wkx-mark-warm')
  expect(rows[1].querySelector('.wkx-c-kg')).toHaveTextContent('80')
  expect(rows[1].querySelector('.wkx-c-rep')).toHaveTextContent('3')
  expect(rows[1].querySelector('.wkx-c-st')).toHaveTextContent('')
  // The first working row (index 2) is a plain pending row: ghosted with the
  // TARGET weight and the exercise's own rep RANGE (not the single engine
  // target reps) — the binding v4 rule for pending working rows.
  expect(rows[2].querySelector('.wkx-mark')).toHaveClass('wkx-mark-pend')
  expect(rows[2].querySelector('.wkx-c-kg')).toHaveTextContent('105')
  expect(rows[2].querySelector('.wkx-c-rep')).toHaveTextContent('8–10')
  expect(rows[2].querySelector('.wkx-c-rir')).toHaveTextContent('0')
  expect(rows[2].querySelector('.wkx-c-st')).toHaveTextContent('')
})

test('mock mode: a logged working set below the prescribed rep range shows "▼ cél alatt"', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  await user.click(screen.getByText('Szett kész ✓')) // B1
  await user.click(screen.getByRole('button', { name: 'Pihenő kihagyása' }))
  await user.click(screen.getByText('Szett kész ✓')) // B2
  await user.click(screen.getByRole('button', { name: 'Pihenő kihagyása' }))
  // Prefilled reps = 10 (the engine target); drop to 5 — below ex1's repMin (8).
  for (let i = 0; i < 5; i++) {
    await user.click(screen.getByRole('button', { name: 'Ismétlés csökkentése' }))
  }
  await user.click(screen.getByText('Szett kész ✓'))
  await openSetsStrip(user)
  const workingRow = screen.getAllByRole('button', { name: /working szett szerkesztése/ })[0]
  expect(workingRow.querySelector('.wkx-c-st')).toHaveTextContent('▼ cél alatt')
})

test('mock mode: a logged working set above the prescribed rep range shows "▲ cél felett"', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  await user.click(screen.getByText('Szett kész ✓')) // B1
  await user.click(screen.getByRole('button', { name: 'Pihenő kihagyása' }))
  await user.click(screen.getByText('Szett kész ✓')) // B2
  await user.click(screen.getByRole('button', { name: 'Pihenő kihagyása' }))
  // Prefilled reps = 10 (the repMax boundary, still "ok"); bump to 11 — above
  // ex1's repMax (10).
  await user.click(screen.getByRole('button', { name: 'Ismétlés növelése' }))
  await user.click(screen.getByText('Szett kész ✓'))
  await openSetsStrip(user)
  const workingRow = screen.getAllByRole('button', { name: /working szett szerkesztése/ })[0]
  expect(workingRow.querySelector('.wkx-c-st')).toHaveTextContent('▲ cél felett')
})

test('mock mode: the set-list footer summarizes tonnage, the vs-last-week delta and the average RIR from the logged sets', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  await user.click(screen.getByText('Szett kész ✓')) // B1: 52.5 kg × 8
  await user.click(screen.getByRole('button', { name: 'Pihenő kihagyása' }))
  await user.click(screen.getByText('Szett kész ✓')) // B2: 80 kg × 3
  await user.click(screen.getByRole('button', { name: 'Pihenő kihagyása' }))
  await user.click(screen.getByText('Szett kész ✓')) // working 1: 105 kg × 10 @RIR 0
  const foot = container.querySelector('.wkx-sfoot') as HTMLElement
  // Volumen = Σ(weight×reps) over ALL logged sets (warmups included, per the
  // design doc's literal "of logged sets"): 52.5×8 + 80×3 + 105×10 = 1710 kg.
  expect(within(foot).getByText(`${(1710).toLocaleString('hu-HU')} kg`)).toBeInTheDocument()
  // vs múlt hét = (105 − 102.5) / 102.5 × 100 = 2.44 → round 2 → "+2%" (sage).
  const deltaCell = within(foot).getByText('+2%')
  expect(deltaCell).toBeInTheDocument()
  expect(deltaCell).toHaveStyle({ color: 'var(--sage-deep)' })
  // Átl. RIR = mean of the one logged working RIR (0) → "0,0".
  expect(within(foot).getByText('0,0')).toBeInTheDocument()
})

// ---- warmup vs working distinction on the logging card (mezo-eerq) ----

test('mock mode: a warmup set hides the RIR row (effort tracking is working-set-only)', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  // ex1 set 1 is a warmup (B1) — signalled by the set dot alone (mezo-xt65
  // deleted the kind chip); no RIR selector on the logging card. Scoped to the
  // excard (v4, mezo-8xmf): the set-list table's own "RIR" COLUMN HEADER now
  // also renders that text, so an unscoped query would see two matches.
  await screen.findByRole('button', { name: 'Súly növelése' })
  expect(container.querySelector('.setdots .sd.cur')).toHaveTextContent('B1')
  const excard = container.querySelector('.excard') as HTMLElement
  expect(within(excard).queryByText('RIR')).not.toBeInTheDocument() // the rirrow label
  expect(screen.queryByRole('button', { name: 'RIR 0' })).not.toBeInTheDocument()
})

test('mock mode: a working set shows the RIR row', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  await user.click(screen.getByText('Szett kész ✓')) // B1
  await user.click(screen.getByRole('button', { name: 'Pihenő kihagyása' }))
  await user.click(screen.getByText('Szett kész ✓')) // B2
  await user.click(screen.getByRole('button', { name: 'Pihenő kihagyása' }))
  // Scoped to the excard (v4, mezo-8xmf): the set-list table's RIR column
  // header also renders "RIR" text now.
  const excard = container.querySelector('.excard') as HTMLElement
  expect(await within(excard).findByText('RIR')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'RIR 0' })).toBeInTheDocument()
})

test('mock mode: a deviated working-set weight carries into the next working set', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  await user.click(screen.getByText('Szett kész ✓')) // B1 (52.5)
  await user.click(screen.getByRole('button', { name: 'Pihenő kihagyása' }))
  await user.click(screen.getByText('Szett kész ✓')) // B2 (80)
  await user.click(screen.getByRole('button', { name: 'Pihenő kihagyása' }))
  // Scoped to the excard (v4, mezo-8xmf) — see the two tests above.
  await within(container.querySelector('.excard') as HTMLElement).findByText('RIR') // the first working set is on deck
  expect(container.querySelector('.steprow')).toHaveTextContent('105') // engine seeds working 1
  await user.click(screen.getByRole('button', { name: 'Súly növelése' })) // 105 -> 107.5
  await user.click(screen.getByText('Szett kész ✓')) // log working 1 at 107.5
  await user.click(screen.getByRole('button', { name: 'Pihenő kihagyása' }))
  // The next working set inherits the deviated 107.5, not the static 105 target.
  await waitFor(() => expect(container.querySelector('.steprow')).toHaveTextContent('107,5'))
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
  await user.click(screen.getByRole('button', { name: 'Pihenő kihagyása' }))
  await user.click(screen.getByText('Szett kész ✓')) // working set (opens the debrief)
  await waitFor(() => expect(bodies).toHaveLength(2))
  expect(bodies[0].kind).toBe('warmup')
  expect(bodies[0]).not.toHaveProperty('rir')
  expect(bodies[1].kind).toBe('working')
  expect(bodies[1].rir).toBe(1) // the prescribed working RIR target
})

// ---- real medals (mezo-wp6n): replaces the scripted 105 kg demo toast ----

test('mock mode: logging a set that beats the mock lastWeek fires the RECORD medal toast', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  // ex1 (Chest Supported Row): 2 warmups, then working sets prefill to 105 kg × 10 —
  // beats lastWeek (102.5 kg × 9) on WEIGHT and E1RM, and also meets the prescribed
  // target (TARGET_HIT) — three medals on one set. The toast shows the highest-
  // priority RECORD (WEIGHT before E1RM) and counts the other two.
  await user.click(screen.getByText('Szett kész ✓')) // warmup 1
  await user.click(screen.getByRole('button', { name: 'Pihenő kihagyása' }))
  await user.click(screen.getByText('Szett kész ✓')) // warmup 2
  await user.click(screen.getByRole('button', { name: 'Pihenő kihagyása' }))
  await user.click(screen.getByText('Szett kész ✓')) // working set (setIndex 2) -> RECORD
  expect(await screen.findByText('ÚJ REKORD · SÚLY')).toBeInTheDocument()
  expect(screen.getByText('105 kg × 10')).toBeInTheDocument()
  // Mock-mode RECORD medals never carry a previousDate (medalEvaluator.ts) — the
  // "— … óta állt" clause must be dropped, never render as "null"/"undefined".
  expect(screen.getByText(/Eddigi legjobbad 102,5 kg volt\./)).toBeInTheDocument()
  expect(screen.queryByText(/óta állt/)).not.toBeInTheDocument()
  expect(screen.getByText(/\+2 további medál/)).toBeInTheDocument()
})

test('real mode: a set-log response with only a TARGET_HIT medal shows no toast (TARGET tier stays quiet)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(REAL_TODAY, calls)
  server.use(
    http.post(`${API_BASE}/api/train/workouts/:id/sets`, async ({ params, request }) => {
      const body = (await request.json()) as { exerciseId: string; setIndex: number; weightKg: number }
      calls.push(`set:${params.id}:${body.exerciseId}:${body.setIndex}:${body.weightKg}`)
      return HttpResponse.json({
        id: 'st-' + body.setIndex, exerciseId: body.exerciseId, setIndex: body.setIndex,
        medals: [{
          type: 'TARGET_HIT', tier: 'TARGET', exerciseName: 'Chest Supported Row',
          date: '2026-06-12', setIndex: body.setIndex,
          value: 9, unit: 'REPS', weightKg: 102.5, reps: 9,
          previousValue: null, previousDate: null,
        }],
      }, { status: 201 })
    }),
  )
  const user = userEvent.setup()
  setup()
  await user.click(await screen.findByText(/Kezdjük el/))
  await waitFor(() => expect(calls).toContain('start:d-1'))
  await user.click(screen.getByText('Szett kész ✓'))
  await waitFor(() => expect(calls).toContain('set:w-1:e-1:0:102.5'))
  expect(screen.queryByText(/ÚJ REKORD/)).not.toBeInTheDocument()
})

// ---- the set-row half of the two-tier split (mezo-wp6n) ----
// v4 (mezo-8xmf): the read-only row is now a `<button class="wkx-srow">` found
// by its aria-label (setSlotLabel), not by a `.stag` kind tag — the old
// "Bemel."/"Working" text tags are gone (the marker circle + row label carry
// that distinction now). RECORD medal chips (MedalChip, role="img") still
// render in the row's status cell; the old coral/sage "done-tick" Icon that
// tracked the TARGET_HIT medal is GONE — the v4 status column already conveys
// hit/miss directly via the rep-range status (✓ / ▼ cél alatt / ▲ cél felett),
// so that distinction no longer needs a second, medal-driven visual.
const firstWorkingRow = () => screen.getAllByRole('button', { name: /working szett szerkesztése/ })[0]

test('mock mode: a set that hits its target gets a sage ✓ status and a chip per RECORD medal', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  // ex1 working sets are prescribed 105 kg × 10 and prefill to exactly that, so
  // set index 2 earns WEIGHT + E1RM (RECORD) *and* TARGET_HIT (TARGET) — the
  // three-medal case that makes the loud/quiet split visible on one row.
  await user.click(screen.getByText('Szett kész ✓')) // B1 (warmup)
  await user.click(screen.getByRole('button', { name: 'Pihenő kihagyása' }))
  await user.click(screen.getByText('Szett kész ✓')) // B2 (warmup)
  await user.click(screen.getByRole('button', { name: 'Pihenő kihagyása' }))
  await user.click(screen.getByText('Szett kész ✓')) // working set (index 2)
  await openSetsStrip(user)

  // Exactly TWO chips — the TARGET_HIT contributes none (MedalChip gates on tier).
  await waitFor(() => expect(within(firstWorkingRow()).getAllByRole('img')).toHaveLength(2))
  const workingRow = firstWorkingRow()
  expect(within(workingRow).getByRole('img', { name: 'Súly-rekord' })).toBeInTheDocument()
  expect(within(workingRow).getByRole('img', { name: '1RM-rekord' })).toBeInTheDocument()
  // 10 reps is within ex1's prescribed [8,10] range -> the sage ✓ status.
  expect(workingRow.querySelector('.wkx-c-st')).toHaveTextContent('✓')

  // The warmup arm: a done warmup row earns no medals (the mock evaluator never
  // scores warmup-kind sets), but still shows its own ✓ status.
  const warmupRow = screen.getAllByRole('button', { name: /bemelegítő szett szerkesztése/ })[0]
  expect(within(warmupRow).queryAllByRole('img')).toHaveLength(0)
  expect(warmupRow.querySelector('.wkx-c-st')).toHaveTextContent('✓')
})

test('mock mode: a set that sets records still shows its chips even when the logged weight misses the prescribed target', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  await user.click(screen.getByText('Szett kész ✓')) // B1 (warmup)
  await user.click(screen.getByRole('button', { name: 'Pihenő kihagyása' }))
  await user.click(screen.getByText('Szett kész ✓')) // B2 (warmup)
  await user.click(screen.getByRole('button', { name: 'Pihenő kihagyása' }))
  // Drop the prefilled 105 kg to 102.5 — under the prescribed 105, so NO TARGET_HIT,
  // yet 102,5 × 10 still beats lastWeek (102,5 × 9) on REPS_AT_WEIGHT and E1RM.
  await user.click(screen.getByRole('button', { name: 'Súly csökkentése' }))
  await user.click(screen.getByText('Szett kész ✓')) // working set (index 2)
  await openSetsStrip(user)

  await waitFor(() => expect(within(firstWorkingRow()).getAllByRole('img')).toHaveLength(2))
  const workingRow = firstWorkingRow()
  expect(within(workingRow).getByRole('img', { name: 'Rep-rekord' })).toBeInTheDocument()
  expect(within(workingRow).getByRole('img', { name: '1RM-rekord' })).toBeInTheDocument()
  // The weight miss doesn't affect reps (still 10, within [8,10]) -> still ✓;
  // the v4 status column is rep-range-only, unlike the old TARGET_HIT tick.
  expect(workingRow.querySelector('.wkx-c-st')).toHaveTextContent('✓')
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
  expect(container.querySelector('.steprow')).toHaveTextContent('9') // +1 rep
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

// mezo-vad0: the CURRENT exercise is reorderable too — the common gym case is
// "the machine is taken, push the one I'm on back" — and moving it off the head of
// the list hands the screen to whatever is up next.
test('the current exercise can be moved back, and the view follows to the new next one', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/)) // active, current = Chest Supported Row (ex1)
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Áthelyezés')) // reorder sub-view (ex1..ex5, ex1 = current)
  await user.click(screen.getByRole('button', { name: 'Chest Supported Row lejjebb' }))
  await user.keyboard('{Escape}')
  // Lat Pulldown (ex2) took over the head of the order → it is now the logged exercise.
  expect(await screen.findByRole('heading', { name: /^Lat Pulldown/ })).toBeInTheDocument()
})

test('reordering only the exercises BEHIND the current one leaves the view put', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Áthelyezés'))
  await user.click(screen.getByRole('button', { name: 'Cable Pull-Around feljebb' })) // ex3 over ex2
  await user.keyboard('{Escape}')
  expect(screen.getByRole('heading', { name: 'Chest Supported Row' })).toBeInTheDocument()
})

// mezo-vad0: the prep CTA sits at the BOTTOM of a long briefing — starting the workout
// swaps the whole tree without a route change, so the page must reset the app scroller
// itself (ScreenContent only does it on navigation).
test('starting the workout jumps the app scroller back to the top', async () => {
  const user = userEvent.setup()
  const scroller = document.createElement('div')
  scroller.className = 'screen-content'
  const scrollTo = vi.fn()
  Object.assign(scroller, { scrollTo })
  document.body.appendChild(scroller)
  try {
    setup()
    scrollTo.mockClear() // ignore the mount-time reset; the phase flip is what matters
    await user.click(screen.getByText(/Kezdjük el/))
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' })
  } finally {
    scroller.remove()
  }
})

// The Szett stat-cell's value (e.g. "0/3") — helper so callers don't hand-roll the
// wkx-statcell/wkx-statlabel traversal.
// The live working-slot counter — since mezo-d20.3.9 it is the logging panel's own
// "n/m szett" readout (the 3-cell stat strip it used to live in is gone).
function szettCellValue(container: HTMLElement): string | null {
  return container.querySelector('.wkx-lgoal')?.textContent?.replace(' szett', '') ?? null
}

test('＋ Szett adds an extra set: the set-dots and prescribed list grow 5→6', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))          // active, current = Chest Supported Row (5 planned sets: 2 warmup + 3 working)
  expect(container.querySelectorAll('.setdots .sd')).toHaveLength(5)
  // v4 (mezo-8xmf): the set-list table row count is the "Working"/"Bemel." tag
  // count's replacement — count rows by their aria-label instead.
  await openSetsStrip(user)
  expect(screen.getAllByRole('button', { name: /working szett szerkesztése/ })).toHaveLength(3) // 3 planned working rows
  // Szett stat-cell (final-review fix, mezo-8xmf): denominator must track the LIVE
  // working-slot count, not the static `current.workingSets` — before the extra set
  // it reads the planned 0/3.
  expect(szettCellValue(container)).toBe('0/3')
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('＋ Szett'))             // adds one extra set; sheet closes
  const dots = container.querySelectorAll('.setdots .sd')
  expect(dots).toHaveLength(6)
  expect(screen.getAllByRole('button', { name: /working szett szerkesztése/ })).toHaveLength(4) // the extra shows as a 4th working row
  expect(screen.getAllByRole('button', { name: /bemelegítő szett szerkesztése/ })).toHaveLength(2) // warmups unchanged
  // The added (6th) set-dot carries the restored dashed "extra" marker (final-review
  // fix, mezo-8141 — Finding 2); the planned dots stay plain.
  expect(dots[5]).toHaveClass('extra')
  expect(dots[0]).not.toHaveClass('extra')
  // Denominator now reflects the 4th live working slot — 0/4, not the stale 0/3.
  expect(szettCellValue(container)).toBe('0/4')
})

test('⋯ Kihagyás advances to the next exercise without opening the debrief', async () => {
  const user = userEvent.setup()
  const { container } = setup() // mock mode, current = Chest Supported Row (ex1)
  await user.click(screen.getByText(/Kezdjük el/))
  expect(screen.getByText('Chest Supported Row')).toBeInTheDocument()
  // Start a mid-exercise rest before skipping — skip must clear it (final-review
  // fix, mezo-8141 — Ride-along A), not leave the bar counting toward an
  // abandoned exercise.
  await user.click(screen.getByText('Szett kész ✓'))
  expect(container.querySelector('.restbar')).not.toBeNull()
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Kihagyás'))
  // Advances straight to the next exercise — no FeedbackModal / debrief CTA.
  expect(await screen.findByText('Lat Pulldown · Pronated')).toBeInTheDocument()
  expect(screen.queryByText('Mentés · tovább')).not.toBeInTheDocument()
  expect(screen.queryByText('Edzés vége →')).not.toBeInTheDocument()
  expect(container.querySelector('.restbar')).toBeNull()
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
  // resolve the debrief). The last debrief CTA reads "Edzés vége →" and lands on the summary.
  for (let ex = 0; ex < 4; ex++) {
    await completeExerciseSets(user)
    const cta = await screen.findByText(/Mentés · tovább|Edzés vége →/)
    await user.click(cta) // close() runs the Sheet slide-down, then onResolve advances
    // Wait for the next exercise's fresh set-dots (no done sets yet) before looping.
    if (ex < 3) await waitFor(() => expect(document.querySelector('.setdots .sd.don')).toBeNull())
  }
  // Summary recap: the skipped first exercise reads "kihagyva".
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

test('summary → Edzés lezárása shows the level-up overlay, then the closed summary on Tovább (mock)', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  // Skip ex0, then drive the remaining 4 exercises to completion — the last
  // debrief lands on the closing summary (no auto-finish).
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Kihagyás'))
  await screen.findByText('Lat Pulldown · Pronated')
  for (let ex = 0; ex < 4; ex++) {
    await completeExerciseSets(user)
    const cta = await screen.findByText(/Mentés · tovább|Edzés vége →/)
    await user.click(cta)
    if (ex < 3) await waitFor(() => expect(document.querySelector('.setdots .sd.don')).toBeNull())
  }
  // New flow: the last debrief lands on the summary; the explicit CTA finishes.
  expect(await screen.findByText('Edzés vége')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /Edzés lezárása/ }))
  // Mock finish returns the seeded gym fixture → the level-up overlay shows over the closed summary.
  const dialog = await screen.findByRole('dialog', { name: 'Szintlépés' })
  expect(within(dialog).getByText(/KLASSZIK KONDI/)).toBeInTheDocument()
  await user.click(within(dialog).getByRole('button', { name: /Tovább/ }))
  expect(screen.queryByRole('dialog', { name: 'Szintlépés' })).not.toBeInTheDocument()
  // The read-only closed summary is revealed underneath.
  expect(await screen.findByText(/Lezárva · ma/)).toBeInTheDocument()
  // Workout identity still holds on the closed summary (was asserted via the old
  // title-suffix framing "Pull Day · N medál" — the title itself renders standalone now).
  expect(screen.getAllByText('Pull Day').length).toBeGreaterThan(0)
  // ex2..ex5's working sets all hit their prescribed target (and several also beat
  // lastWeek), so the session's real medal count (mezo-wp6n) drives the redesigned
  // Medálok section's count — replaces the old hadPrFromSignal / title-suffix framing.
  expect(screen.getByText(/\d+ rekord · \d+ cél/)).toBeInTheDocument()
})

test('the ⋯ menu offers early finish and it lands on the summary screen', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Edzés befejezése…'))
  expect(screen.getByText('Edzés vége')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Edzés lezárása/ })).toBeInTheDocument()
})

test('leaving the summary via Vissza az edzéshez resumes the active phase without finishing', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Edzés befejezése…'))
  await user.click(screen.getByText('← Vissza az edzéshez'))
  expect(screen.getByText('Szett kész ✓')).toBeInTheDocument()
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
  imageStartUrl?: string | null; imageEndUrl?: string | null
  videoUrl?: string | null
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

// D3: the 1RM badge is sourced from the record engine, matched by catalogId-else-name —
// `/today` exercises never carry a catalogId (see TodayExercise/toWorkoutPlan), so the
// match falls to name; the fixture record below deliberately omits catalogId too.
test('real mode: the 1RM badge renders when an exercise record matches the workout exercise by name', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(REAL_TODAY, calls)
  server.use(
    http.get(`${API_BASE}/api/train/exercise-records`, () =>
      HttpResponse.json([
        {
          name: 'Chest Supported Row', muscle: 'back', type: 'compound',
          bestE1rm: { value: 133, set: { weightKg: 100, reps: 8, date: '2026-06-01' } },
          totalVolume: 0, totalSets: 0, totalReps: 0, sessionCount: 0,
          repRecords: [], recentTopSets: [],
        },
      ]),
    ),
  )
  const user = userEvent.setup()
  setup()
  await user.click(await screen.findByRole('button', { name: 'Gyakorlatok' }))
  expect(await screen.findByText('🏆 133 kg')).toBeInTheDocument()
  expect(screen.getByText('1RM')).toBeInTheDocument()
})

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

test('real mode: a failed logSet POST leaves the row present AND tappable, and deleting it fires no server call (F1, fix round 3)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(REAL_TODAY, calls)
  server.use(
    http.post(`${API_BASE}/api/train/workouts/:id/sets`, () => new HttpResponse(null, { status: 500 })),
    http.delete(`${API_BASE}/api/train/workouts/:id/sets/:setId`, ({ params }) => {
      calls.push(`delete:${params.setId}`)
      return new HttpResponse(null, { status: 204 })
    }),
  )
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(await screen.findByText(/Kezdjük el/))
  await waitFor(() => expect(calls).toContain('start:d-1'))
  await user.click(screen.getByText('Szett kész ✓'))
  // Round 2 rolled the entry back on failure — but that could desync logged[i] from
  // prescribed[i] for anything but the LAST entry (fix round 3, F1). The honest move
  // is to leave the set visible: the dot stays "done" throughout.
  await waitFor(() => expect(container.querySelector('.setdots .sd.don')).toBeInTheDocument())
  await openSetsStrip(user)
  // The row is disabled while the POST is genuinely in flight, then becomes tappable
  // again once it's KNOWN to have failed (not stuck disabled forever, unlike a still-
  // in-flight row).
  await waitFor(() => {
    const row = screen.getAllByRole('button', { name: /szett szerkesztése/ })[0]
    expect(row).not.toBeDisabled()
  })
  await user.click(screen.getAllByRole('button', { name: /szett szerkesztése/ })[0])
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Szett törlése' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  // No DELETE fired — there is no server row to address (the POST never succeeded);
  // the removal is purely local, exactly like deleting a never-logged pending slot.
  expect(calls.some((c) => c.startsWith('delete:'))).toBe(false)
})

test('real mode: an edit PUTs the FIRST logged set\'s OWN server id, and deleting it DELETEs that same id (F2, fix round 3)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  // 3 working sets so logging the first TWO never completes the exercise (no debrief
  // takeover, which would block set-editing entirely by design).
  useRealHandlers({ ...REAL_TODAY, exercises: [{ ...REAL_TODAY.exercises[0], workingSets: 3 }] }, calls)
  const putBodies: Record<string, Record<string, unknown>> = {}
  server.use(
    http.put(`${API_BASE}/api/train/workouts/:id/sets/:setId`, async ({ params, request }) => {
      const body = (await request.json()) as Record<string, unknown>
      putBodies[String(params.setId)] = body
      calls.push(`put:${params.setId}`)
      return HttpResponse.json({ id: String(params.setId), exerciseId: 'e-1', setIndex: 0, medals: [] })
    }),
    http.delete(`${API_BASE}/api/train/workouts/:id/sets/:setId`, ({ params }) => {
      calls.push(`delete:${params.setId}`)
      return new HttpResponse(null, { status: 204 })
    }),
  )
  const user = userEvent.setup()
  setup()
  await user.click(await screen.findByText(/Kezdjük el/))
  await waitFor(() => expect(calls).toContain('start:d-1'))

  // Log the first working set at its 102.5 kg prefill (useRealHandlers echoes id `st-0`).
  await user.click(screen.getByText('Szett kész ✓'))
  await waitFor(() => expect(calls).toContain('set:w-1:e-1:0:102.5'))
  await user.click(await screen.findByRole('button', { name: 'Pihenő kihagyása' }))
  // Bump the weight on the MAIN excard (not the sheet) before logging the SECOND set, so
  // the two rows carry visibly DIFFERENT weights — the only way to prove the later
  // edit/delete addressed the right ROW, not merely "some" row.
  await user.click(screen.getByLabelText('Súly növelése'))
  await user.click(screen.getByText('Szett kész ✓'))
  await waitFor(() => expect(calls).toContain('set:w-1:e-1:1:105'))
  await user.click(await screen.findByRole('button', { name: 'Pihenő kihagyása' }))

  // Edit the FIRST row (102.5 kg) — bump REPS only (not weight), so the 102.5/105 kg
  // marker keeps discriminating the two rows through the edit.
  await openSetsStrip(user)
  await user.click(screen.getAllByRole('button', { name: /szett szerkesztése/ })[0])
  await user.click(within(screen.getByRole('dialog')).getByLabelText('Ismétlés növelése'))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Mentés ✓' }))
  await waitFor(() => expect(calls).toContain('put:st-0'))
  expect(putBodies['st-0']).toMatchObject({ weightKg: 102.5, reps: 10 }) // lastWeek reps 9 + 1

  // Delete the FIRST row — must DELETE st-0 specifically, not st-1.
  await user.click(screen.getAllByRole('button', { name: /szett szerkesztése/ })[0])
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Szett törlése' }))
  await waitFor(() => expect(calls).toContain('delete:st-0'))
  // The surviving row (now at index 0) carries the SECOND set's 105 kg marker —
  // proof the shift landed correctly, not just that "a" DELETE fired.
  const survivorRow = screen.getAllByRole('button', { name: /szett szerkesztése/ })[0]
  expect(survivorRow.getAttribute('aria-label')).toContain('105')
})

test('real mode: typing a per-set note before Szett kész sends it in the logSet payload', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(REAL_TODAY, calls)
  const user = userEvent.setup()
  setup()
  await user.click(await screen.findByText(/Kezdjük el/))
  await waitFor(() => expect(calls).toContain('start:d-1'))
  await user.click(await screen.findByRole('button', { name: /megjegyzés a szetthez/ }))
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

// 20s, not the 5s default: this is the one test that mounts the WHOLE route tree
// (`createMemoryRouter(routes)`), so its cost grows with every page the app gains and it has
// been timing out on CI's parallel load — on main too, not just on the branch that tripped it
// (mezo-3zue.4). Raising the ceiling for this test is the honest fix; the alternative is a
// route-tree mock that would stop testing the thing the test exists to test.
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
}, 20_000)

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
  // New flow: the debrief lands on the summary; finish fires only on the explicit CTA.
  await user.click(await screen.findByRole('button', { name: /Edzés lezárása/ }))
  await waitFor(() => expect(calls).toContain('finish:w-1'))
  expect(await screen.findByText(/Lezárva · ma/)).toBeInTheDocument() // closed summary
})

test('real mode: a failed finish POST re-enables the "Edzés lezárása ✓" CTA (not stuck disabled)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(
    { ...REAL_TODAY, exercises: [{ ...REAL_TODAY.exercises[0], workingSets: 1 }] },
    calls,
  )
  // Override the finish endpoint to fail (500). Mutations don't retry (QueryWrapper),
  // so the mutation settles once → onSettled must re-enable the CTA (finishPending false).
  server.use(
    http.post(`${API_BASE}/api/train/workouts/:id/finish`, () => new HttpResponse(null, { status: 500 })),
  )
  const user = userEvent.setup()
  setup()
  await user.click(await screen.findByText(/Kezdjük el/))
  await waitFor(() => expect(calls).toContain('start:d-1'))
  await user.click(screen.getByText('Szett kész ✓')) // only set -> FeedbackModal
  await user.click(await screen.findByText('Edzés vége →')) // debrief -> closing summary
  await user.click(await screen.findByRole('button', { name: /Edzés lezárása/ }))
  // The finish POST fails; the CTA must become enabled again so the user can retry
  // (regression guard for the reset living only in onSuccess — mezo-cd8s).
  await waitFor(() => expect(screen.getByRole('button', { name: /Edzés lezárása/ })).toBeEnabled())
  // Still on the closing summary — never advanced to the read-only closed view.
  expect(screen.getByText('Edzés vége')).toBeInTheDocument()
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
  await user.click(screen.getByRole('button', { name: 'Pihenő kihagyása' }))
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

// --- done-day gating: the session route redirects to the review (mezo-cd8s) ---
// A completed today instance with nothing open means the workout is over; the prep
// screen must be unreachable — the guard redirects /train/session to the review.
test('real mode: a completed today instance redirects the session route to the review', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([REAL_MESO])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/workouts/today`, () =>
      HttpResponse.json({
        templateSessionId: 'd-1', dayLabel: 'Ma', title: 'Pull Day', durationEst: 0,
        exercises: [{ id: 'e-1', name: 'Row', muscle: 'back', warmupSets: 0, workingSets: 2, repMin: 8, repMax: 10, targetRIR: 1, type: 'compound', lastWeek: null }],
        openWorkout: null,
        completedWorkout: { id: 'w-done', templateSessionId: 'd-1', date: '2026-06-12', status: 'completed', sets: [] },
      }),
    ),
  )
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/train/session']}>
        <LevelUpProvider>
          <Routes>
            <Route path="/train/session" element={<ActiveWorkoutPage />} />
            <Route path="/train/review/:workoutId" element={<div>REVIEW PROBE</div>} />
          </Routes>
        </LevelUpProvider>
      </MemoryRouter>
    </QueryWrapper>,
  )
  expect(await screen.findByText('REVIEW PROBE')).toBeInTheDocument()
  expect(screen.queryByText(/Kezdjük el/)).toBeNull()
})

// --- meso-less custom (saját) workout: getToday is meso-independent (D4, final-review
// fix, mezo-ws2x — Finding 1). No active meso must NOT bounce a custom day's prep screen. ---
test('real mode: a custom workout with NO active meso renders the prep screen instead of redirecting', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/workouts/today`, () =>
      HttpResponse.json({
        templateSessionId: 'cw-1', dayLabel: 'Ma', title: 'Saját HIIT', durationEst: 30,
        exercises: [
          { id: 'e-1', name: 'Burpee', muscle: 'full', warmupSets: 0, workingSets: 3, repMin: 10, repMax: 12, targetRIR: 2, type: 'compound', lastWeek: null },
        ],
        openWorkout: null,
        completedWorkout: null,
        weekDoneDates: [],
      }),
    ),
  )
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/train/session?day=cw-1']}>
        <LevelUpProvider>
          <ActiveWorkoutPage />
        </LevelUpProvider>
      </MemoryRouter>
    </QueryWrapper>,
  )
  // Title renders in more than one spot (the hero title + the no-meso week-label
  // fallback in the hero over-line, both W.title) — assert presence, not uniqueness.
  expect((await screen.findAllByText('Saját HIIT')).length).toBeGreaterThan(0)
  expect(screen.getByText(/Kezdjük el/)).toBeInTheDocument()
})

// --- loading skeleton (mezo-f2z) ---------------------------------------------
// Real mode renders the generic ScreenSkeleton (role="status") while the
// meso + today queries are unresolved (workoutPending = !mock && (mesoPending ||
// todayPending)); mock seeds → workoutPending is false → no skeleton (mock has no loading frame).
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
  const user = userEvent.setup()
  setup()
  // prep hub — the Küldetések tile opens the live challenge's own page.
  await user.click(await screen.findByRole('button', { name: 'A mai küldetések' }))
  expect(await screen.findByText('conf tanulom')).toBeInTheDocument()
  expect(screen.queryByText(/get_pr_history/)).not.toBeInTheDocument() // live sends no tools
  expect(screen.getByText('⚔️ Elfogadom')).toBeInTheDocument()
})

test('real mode: clicking "⚔️ Elfogadom" POSTs an accept decision for the challenge', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useChallengeHandlers([challengeWire()], calls)
  const user = userEvent.setup()
  setup()
  await user.click(await screen.findByRole('button', { name: 'A mai küldetések' }))
  await user.click(await screen.findByText('⚔️ Elfogadom'))
  await waitFor(() => expect(calls).toContain('decide:chal-1:accept'))
})

test('real mode: a resolved (hit) challenge shows the ✓ Megerősítve chip + outcome, no action row', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useChallengeHandlers(
    [challengeWire({ status: 'hit', outcome: '110 kg × 8 — cél igazolva (+2.5 kg)', outcomeGood: true })],
    calls,
  )
  const user = userEvent.setup()
  setup()
  await user.click(await screen.findByRole('button', { name: 'A mai küldetések' }))
  expect(await screen.findByText('✓ Megerősítve')).toBeInTheDocument()
  expect(screen.getByText('110 kg × 8 — cél igazolva (+2.5 kg)')).toBeInTheDocument()
  // the workout is decided → the accept/skip row is hidden
  expect(screen.queryByText('⚔️ Elfogadom')).not.toBeInTheDocument()
  expect(screen.queryByText('Elfogadva')).not.toBeInTheDocument()
})

test('a logged working set shows its RIR in the set-list table\'s own RIR column', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  // ex1 has 2 warmups first: log 3 sets so ONE working set (index 2) is done.
  await user.click(screen.getByText('Szett kész ✓'))
  await user.click(screen.getByRole('button', { name: 'Pihenő kihagyása' }))
  await user.click(screen.getByText('Szett kész ✓'))
  await user.click(screen.getByRole('button', { name: 'Pihenő kihagyása' }))
  // the current (3rd) set is a working set — select RIR 1, then log it
  await user.click(screen.getByRole('button', { name: 'RIR 1' }))
  await user.click(screen.getByText('Szett kész ✓'))
  // v4 (mezo-8xmf): RIR is its own table column now, not a chip — the just-
  // logged (first) working row's RIR cell reads the logged value directly.
  await openSetsStrip(user)
  const workingRow = screen.getAllByRole('button', { name: /working szett szerkesztése/ })[0]
  expect(workingRow.querySelector('.wkx-c-rir')).toHaveTextContent('1')
})

// ---- Task 7: free exercise navigation (pager bar, overview sheet, tappable dots) ----

test('the pager bar navigates to the next and previous exercise', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  expect(container.querySelector('.excard h2')).toHaveTextContent('Chest Supported Row')
  await user.click(screen.getByRole('button', { name: /Következő/ }))
  expect(container.querySelector('.excard h2')).not.toHaveTextContent('Chest Supported Row')
  await user.click(screen.getByRole('button', { name: /Előző/ }))
  expect(container.querySelector('.excard h2')).toHaveTextContent('Chest Supported Row')
})

test('the header counter opens the exercise overview and a row jump switches the card', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  await user.click(screen.getByRole('button', { name: 'Gyakorlatlista' }))
  // jump to the LAST exercise from the list (mock plan has 5)
  const rows = screen.getAllByRole('button', { name: /ugrás/i })
  await user.click(rows[rows.length - 1])
  expect(container.querySelector('.excard h2')).not.toHaveTextContent('Chest Supported Row')
})

test('the header counter is disabled while a debrief modal is open (jumps must no-op)', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  // Log every set of the first exercise → the debrief pins feedbackEx.
  await completeExerciseSets(user)
  expect(await screen.findByText(/Mentés · tovább|Edzés vége →/)).toBeInTheDocument()
  // Parity with the ⋯ actions button: the overview trigger is inert during a debrief.
  expect(screen.getByRole('button', { name: 'Gyakorlatlista' })).toBeDisabled()
})

// ---- set edit + slot delete (mezo-l3on) ----

/** The set-list row buttons carry the row's own label; the first is always B1 on ex1. */
const firstRow = () => screen.getAllByRole('button', { name: /szett szerkesztése/ })[0]

test('mock mode: a logged set row opens the edit sheet, and saving rewrites the row', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  await user.click(screen.getByText('Szett kész ✓')) // B1: prescribed 52.5 kg × 8
  const skipRest = screen.queryByRole('button', { name: 'Pihenő kihagyása' })
  if (skipRest) await user.click(skipRest)

  await openSetsStrip(user)
  await user.click(firstRow())
  const sheet = within(screen.getByRole('dialog'))
  await user.click(sheet.getByLabelText('Ismétlés növelése'))
  await user.click(sheet.getByRole('button', { name: 'Mentés ✓' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  // Fix round 1 (I3): assert the EXACT rewritten label, not just "it changed" — a save
  // that silently wrote the wrong field (or the wrong index) would still pass a mere
  // inequality check.
  expect(firstRow().getAttribute('aria-label')).toBe('B1 bemelegítő szett szerkesztése — 52.5 kg × 9')
})

test('mock mode: logging a set that earns no medal still binds its server id (the row stays tappable)', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  // B1 is a warmup — the mock evaluator never scores warmup-kind sets (isWorking gate in
  // trainHooks.ts), so this log earns NO medal at all. Regression guard for the headline
  // judgement call (attachSetId must run before the `!medals.length` early return): if that
  // ordering ever regresses, the row would stay disabled forever (C2's fix below).
  await user.click(screen.getByText('Szett kész ✓'))
  const skipRest = screen.queryByRole('button', { name: 'Pihenő kihagyása' })
  if (skipRest) await user.click(skipRest)

  await openSetsStrip(user)
  await waitFor(() => expect(firstRow()).not.toBeDisabled())
  await user.click(firstRow())
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

test('mock mode: deleting a set drops one slot from the exercise', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  expect(container.querySelectorAll('.setdots .sd')).toHaveLength(5)

  // The pending-slot path: nothing is logged yet, so this row has no server row either.
  await openSetsStrip(user)
  await user.click(firstRow())
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Szett törlése' }))

  await waitFor(() => expect(container.querySelectorAll('.setdots .sd')).toHaveLength(4))
  // Fix round 1 (C1(a) / I3): discriminate WHICH slot was removed. Deleting the pending
  // B1 warmup must leave exactly ONE warmup dot behind and all three working dots intact
  // — not silently swallow a working slot while both warmups survive.
  const dots = Array.from(container.querySelectorAll('.setdots .sd'))
  expect(dots.map((d) => d.textContent)).toEqual(['B1', '1', '2', '3'])
})

test('mock mode: deleting the last pending slot completes the exercise and triggers its debrief', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  // Log 4 of ex1's 5 planned sets (2 warmup + 2 working), leaving the 5th (last working
  // set) pending.
  for (let i = 0; i < 4; i++) {
    await user.click(screen.getByText('Szett kész ✓'))
    const skip = screen.queryByRole('button', { name: 'Pihenő kihagyása' })
    if (skip) await user.click(skip)
  }
  expect(screen.getByText('Szett kész ✓')).toBeInTheDocument()

  // Delete the still-pending 5th (last) slot.
  await openSetsStrip(user)
  const lastRow = screen.getAllByRole('button', { name: /szett szerkesztése/ })[4]
  await user.click(lastRow)
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Szett törlése' }))

  // I3/I2: the exercise is now fully logged (4/4) — the debrief must fire (mirroring the
  // last-set-logged path) and the CTA must not linger with nothing left to log.
  await waitFor(() => expect(screen.getByText(/Mentés · tovább|Edzés vége →/)).toBeInTheDocument())
  expect(screen.queryByText('Szett kész ✓')).not.toBeInTheDocument()
})

test('mock mode: the last remaining slot cannot be deleted', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))

  // 5 planned slots -> delete four of them, one at a time.
  await openSetsStrip(user)
  for (let i = 0; i < 4; i++) {
    await user.click(firstRow())
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Szett törlése' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  }
  expect(container.querySelectorAll('.setdots .sd')).toHaveLength(1)

  await user.click(firstRow())
  const sheet = within(screen.getByRole('dialog'))
  expect(sheet.getByRole('button', { name: 'Szett törlése' })).toBeDisabled()
  expect(sheet.getByText(/Az utolsó szett nem törölhető/)).toBeInTheDocument()
})

test('real mode: the active exercise hides its demo still behind a chip', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(
    {
      ...REAL_TODAY,
      exercises: [
        {
          ...REAL_TODAY.exercises[0],
          imageStartUrl: '/exercises/chest-supported-t-bar-row-a.jpg',
          imageEndUrl: '/exercises/chest-supported-t-bar-row-b.jpg',
        },
      ],
    },
    calls,
  )
  const user = userEvent.setup()
  setup()
  await user.click(await screen.findByText(/Kezdjük el/))
  const chip = await screen.findByRole('button', { name: 'Kép' })
  // Nothing is shown until asked for — mid-set the screen belongs to logging.
  expect(document.querySelector('.exdemo')).toBeNull()
  await user.click(chip)
  expect(document.querySelector('.exdemo')).not.toBeNull()
})

// ============================================================
// Live-session re-face (mezo-d20.3.9) — the CALM DEFAULT: only the execution
// card is expanded (single-line name + small media icon buttons, a muted
// metaline, a one-line note pill and ONE white "Logolás" panel); Progresszió
// and Szettek are thin collapsible strips whose CLOSED header already carries
// the summary. Structural guards for that face.
// ============================================================

test('calm default: exactly ONE white logging panel, and the reference content sits in closed collapsible strips', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  // "a kártyán logolsz, a sávokban utánanézel": one bounded input panel …
  expect(container.querySelectorAll('.wkx-logbox')).toHaveLength(1)
  // … and it is the ONLY place the steppers / CTA live.
  const box = container.querySelector('.wkx-logbox') as HTMLElement
  expect(within(box).getByRole('button', { name: 'Súly növelése' })).toBeInTheDocument()
  expect(within(box).getByText('Szett kész ✓')).toBeInTheDocument()
  // Both reference strips exist and start CLOSED.
  const strips = container.querySelectorAll('.mz-colstrip')
  expect(strips).toHaveLength(2)
  for (const s of strips) expect(s.querySelector('.mz-colhead')).toHaveAttribute('aria-expanded', 'false')
})

test('the Progresszió strip: its closed header carries the delta chip; opening reveals the Múlt hét → Ma a cél cells', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  const head = screen.getByRole('button', { name: /Progresszió/ })
  // Closed header already tells the story (ex1: +2,5 kg).
  expect(head).toHaveTextContent('⚡ Progresszió')
  expect(head).toHaveTextContent('+2,5 kg')
  // The last-week comparison moved INTO the strip body (it is no longer repeated
  // on the calm card) — ex1.lastWeek = 102,5 kg × 9 @RIR 2.
  await user.click(head)
  expect(head).toHaveAttribute('aria-expanded', 'true')
  const body = container.querySelector('.pobanner') as HTMLElement
  expect(within(body).getByText('Múlt hét')).toBeInTheDocument()
  expect(within(body).getByText('102,5 × 9 · RIR 2')).toBeInTheDocument()
})

test('the Szettek strip: its closed header carries "n/m ✓ · tonnage" and the set table lives in its body', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  expect(screen.getByRole('button', { name: /Szettek/ })).toHaveTextContent('0/5 ✓')
  // Log B1 (52,5 × 8 = 420 kg) — the CLOSED header updates with the live tonnage.
  await user.click(screen.getByText('Szett kész ✓'))
  const head = screen.getByRole('button', { name: /Szettek/ })
  expect(head).toHaveTextContent(`1/5 ✓ · ${(420).toLocaleString('hu-HU')} kg`)
  // The table is inside the strip body, not loose on the page.
  const strip = head.parentElement as HTMLElement
  expect(strip).toHaveClass('mz-colstrip')
  expect(container.querySelector('.mz-colbody .wkx-slist')).not.toBeNull()
})

test('the calm card: a muted metaline replaces the 3-cell stat strip, and the old múlt-hét subrow is gone', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  expect(container.querySelector('.wkx-statstrip')).toBeNull()
  expect(container.querySelector('.wkx-subrow')).toBeNull()
  const meta = container.querySelector('.wkx-metaline') as HTMLElement
  expect(meta).toHaveTextContent('🔥 Failure')
  expect(meta).toHaveTextContent('8–10 rep')
  expect(meta).toHaveTextContent('RIR 0')
})

test('the logging panel header names the slot with its target, and carries the working-set counter', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  // ex1 slot 1 is warmup B1, target 52,5 × 8; 0 of 3 working sets done.
  expect(container.querySelector('.wkx-logtop')).toHaveTextContent('Logolás · B1 · cél 52,5 × 8')
  expect(container.querySelector('.wkx-lgoal')).toHaveTextContent('0/3 szett')
})

test('the per-set note starts COLLAPSED behind a ＋ megjegyzés toggle', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  expect(screen.queryByLabelText('Szett megjegyzés')).toBeNull()
  await user.click(screen.getByRole('button', { name: /megjegyzés a szetthez/ }))
  expect(await screen.findByLabelText('Szett megjegyzés')).toBeInTheDocument()
})

test('the execution card offers the media as small icon buttons, not labelled chips', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(
    {
      ...REAL_TODAY,
      exercises: [{
        ...REAL_TODAY.exercises[0],
        imageStartUrl: '/exercises/a.jpg',
        imageEndUrl: '/exercises/b.jpg',
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      }],
    },
    calls,
  )
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(await screen.findByText(/Kezdjük el/))
  const head = container.querySelector('.wkx-exhead') as HTMLElement
  expect(within(head).getByRole('button', { name: 'Kép' })).toHaveClass('wkx-mbtn')
  const vid = within(head).getByRole('button', { name: 'Demo videó' })
  expect(vid).toHaveClass('wkx-mbtn')
  // Hidden until asked for — mid-set the screen belongs to logging.
  expect(container.querySelector('.exvideo')).toBeNull()
  await user.click(vid)
  expect(vid).toHaveAttribute('aria-expanded', 'true')
  expect(container.querySelector('.exvideo')).not.toBeNull()
})

test('when every slot of the exercise is logged the panel says so instead of leaving a dead CTA slot', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  await completeExerciseSets(user)
  // Dismiss the debrief, then navigate BACK to the finished exercise.
  await user.click(screen.getByText('Hagyjuk'))
  await user.click(await screen.findByRole('button', { name: /Előző:/ }))
  expect(await screen.findByText('✓ Minden szett megvan ennél a gyakorlatnál')).toBeInTheDocument()
  expect(screen.queryByText('Szett kész ✓')).toBeNull()
})
