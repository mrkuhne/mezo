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
import { TutorialProvider } from '@/features/tutorial/TutorialProvider'
import { seedAllKalauzSeen } from '@/test/kalauz'

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
// Mezo-kalauz (mezo-gb1s.5): a /train/session kalauzos T2 route lett, és a fejléc mini ?-e
// useTutorial()-t hív — a page a TutorialProvider alatt él, ahogy az AppLayoutban is.
// Seed nélkül a 0 ms-os (reduced-motion) auto-open a tesztek fölé nyitná a sheetet.
beforeEach(() => seedAllKalauzSeen())

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

// ---- the card-list idiom (mezo-88iwa.7, T6 Task 3) ----
// The active phase shows EVERY exercise at once as a `.wo-card`, so a query has to
// say which card it means. The card's accessible name is the exercise name.
const EX1 = 'Chest Supported Row'
const EX2 = 'Lat Pulldown · Pronated'
const EX3 = 'Cable Pull-Around'

function card(name: string): HTMLElement {
  const el = document.querySelector(`.wo-card[aria-label="${name}"]`)
  if (!el) throw new Error(`no .wo-card for "${name}"`)
  return el as HTMLElement
}
/** The ✓ of the card's ONE editable row (its cursor slot); null when nothing is loggable. */
function submitOf(name: string): HTMLElement {
  return within(card(name)).getByRole('button', { name: /szett mentése$/ })
}
function querySubmitOf(name: string): HTMLElement | null {
  return within(card(name)).queryByRole('button', { name: /szett mentése$/ })
}
const kgInput = (name: string) => within(card(name)).getByRole('spinbutton', { name: /súly$/ })
const repsInput = (name: string) => within(card(name)).getByRole('spinbutton', { name: /ismétlés$/ })
async function typeInto(user: ReturnType<typeof userEvent.setup>, input: HTMLElement, value: string | number) {
  await user.clear(input)
  await user.type(input, String(value))
}
/** Rows of one card, in slot order. */
const rowsOf = (name: string) => Array.from(card(name).querySelectorAll('.wo-row')) as HTMLElement[]
/** The already-logged (tappable) rows of one card. */
const doneRowsOf = (name: string) =>
  within(card(name)).queryAllByRole('button', { name: /szett szerkesztése/ })

async function skipRest(user: ReturnType<typeof userEvent.setup>) {
  const skip = screen.queryByRole('button', { name: 'Kész' })
  if (skip) await user.click(skip)
}
/** Log the card's next set and clear the rest it starts. */
async function logSet(user: ReturnType<typeof userEvent.setup>, name = EX1) {
  await user.click(submitOf(name))
  await skipRest(user)
}
// The workout OPENS in the card list now (mezo-e1ii9) — there is no start CTA to tap.
// In real mode the page shows the skeleton until /today + /meso resolve, so tests that
// need the list await it here; mock mode seeds synchronously and never needs this.
async function enterList() {
  await screen.findByRole('button', { name: 'Vissza' })
}
/** Open the header ⋯ menu's Küldetések glass — accept/dismiss's home since mezo-e1ii9. */
async function openChallenges(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Küldetések'))
}
// Set counts vary per exercise (warmup + working sets), so a fixed loop is fragile:
// log until the card has no editable row left (its debrief CTA is then up).
async function completeExerciseSets(user: ReturnType<typeof userEvent.setup>, name = EX1) {
  for (let i = 0; i < 12; i++) {
    const btn = querySubmitOf(name)
    if (!btn) return
    await user.click(btn)
    if (screen.queryByText(/Mentés · tovább|Edzés vége →/)) return
    await skipRest(user)
  }
}

// ── The workout opens in the card list (mezo-e1ii9, Train parity P1 Task 1) ──────────
// The pre-Titanium PREP mosaic is retired: the prototype (companion-titanium/session.js
// `openSession()`) has no such screen, Mai's CTA opens the list itself. These are the
// whole-screen assertions that the first frame IS the list.
const RETIRED_TILE_LABELS = ['Gyakorlatok', 'Fejlődés', 'Heti zóna', 'Bemelegítés', 'Niggle']

test('the session renders the card list on the FIRST frame — no prep screen at all', () => {
  setup()
  // The card list (T6 Task 3): EVERY exercise is on screen, immediately.
  expect(document.querySelector('.wo-list')).not.toBeNull()
  expect(document.querySelectorAll('.wo-card')).toHaveLength(5)
  expect(within(card(EX1)).getByText(EX1)).toBeInTheDocument()
  expect(submitOf(EX1)).toBeInTheDocument()
  expect(screen.getAllByText('Pull Day').length).toBeGreaterThan(0)
})

test('none of the retired prep surfaces survive: no start CTA, no XP forecast, no mosaic tiles', () => {
  setup()
  expect(screen.queryByText(/Kezdjük el/)).toBeNull()
  expect(screen.queryByText(/várható XP/)).toBeNull()
  expect(document.querySelector('.tp-hero')).toBeNull()
  expect(document.querySelector('.mz-mosaic')).toBeNull()
  for (const label of RETIRED_TILE_LABELS) {
    expect(screen.queryByRole('button', { name: label })).toBeNull()
  }
  // The Küldetések TILE is gone too — the name survives only as the ⋯ menu's row.
  expect(screen.queryByRole('button', { name: 'A mai küldetések' })).toBeNull()
})

// The niggle's home is the banner the card list already renders (the retired Niggle tile
// and its confirm page carried this before).
test('an active niggle surfaces as the card list\'s own banner, carrying the real detail prose', () => {
  setup()
  expect(screen.getByText(/Jobb váll/)).toBeInTheDocument()
  const strip = document.querySelector('.warmstrip')
  expect(strip).not.toBeNull()
  // mezo-e1ii9 fix round 1: the banner renders `niggleWarning.detail` — the backend's own
  // sentence — not just the muscle label plus a hardcoded "óvatos, először warm-up".
  expect(strip?.textContent).toContain('a Cable Pull-Around-ot előrébb hozzuk')
  expect(strip?.textContent).not.toContain('óvatos, először warm-up')
})

// The warmup's home is the amber B-rows inside each card (the retired Bemelegítés tile
// showed the session-level protocol; its `WarmupRow`/`WARMUP_ROWS` data module went with
// it in fix round 1 — a dead module is worse than a documented death).
test('the warmup is present as the card\'s B-prefixed rows', () => {
  setup()
  const idx = Array.from(card(EX1).querySelectorAll('.wo-idx')).map((n) => n.textContent)
  expect(idx.slice(0, 2)).toEqual(['B1', 'B2'])
})

// ── Küldetések: accept/dismiss's new home, the header ⋯ menu's glass ─────────────────
test('the ⋯ menu carries a Küldetések row with the day\'s accepted/total hint', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  expect(screen.getByText('Küldetések')).toBeInTheDocument()
  expect(screen.getByText('0/4 elfogadva')).toBeInTheDocument()
})

// Byte-parity guard: the Phase-1 mock seed still renders its fabricated confidence
// (0.72 → "conf 72%") + the tool-transparency chips exactly as before the live wiring —
// now inside the ⋯ menu's Küldetések glass.
test('mock mode: the seed challenge renders conf 72% and its tool chips (byte parity)', async () => {
  const user = userEvent.setup()
  setup()
  await openChallenges(user)
  expect(screen.getByText('conf 72%')).toBeInTheDocument()
  expect(screen.getByText('get_pr_history(ex=chest_row)')).toBeInTheDocument()
  expect(screen.queryByText('tanulom')).not.toBeInTheDocument()
})

test('mock mode: the challenges glass carries the honest "passzolni ér" principle', async () => {
  const user = userEvent.setup()
  setup()
  await openChallenges(user)
  expect(screen.getByText(/Passzolni ér/)).toBeInTheDocument()
})

test('a card names its exercise and carries one row per effective slot', async () => {
  setup()
  expect(within(card(EX1)).getByText(EX1)).toBeInTheDocument()
  // ex1: 2 warmup + 3 working = 5 planned sets.
  expect(rowsOf(EX1)).toHaveLength(5)
})

test('mock mode: the last-week comparison is surfaced in the card\'s own progression banner', async () => {
  setup()
  // ex1.lastWeek = { weight: 102.5, reps: 9, rir: 2 }. The banner is no longer behind
  // a collapsible strip — it lives inside its exercise's card (T6 Task 3).
  const banner = card(EX1).querySelector('.pobanner') as HTMLElement
  expect(within(banner).getByText('Múlt hét')).toBeInTheDocument()
  expect(within(banner).getByText('102,5 × 9 · RIR 2')).toBeInTheDocument()
})

// ---- Execution card v2 (mezo-8xmf) → calm re-face (mezo-d20.3.9): the muscle-themed
// card, its metaline and the single logging panel ----

// The old eyebrow (`idx/n · izom · típus`), the muted metaline and the set-budget
// style hints (`🔥 bukásig!` / `🌿 hagyj 2 rep tartalékot`) had their home in the
// one-exercise-at-a-time execution card, which this slice retires. The poster card's
// head carries the identity instead: the muscle art, the name, and the two buttons
// that open the (T4/T5) glass surfaces.
test('mock mode: the card head carries the muscle art, the records button and the ⋮ menu', async () => {
  setup()
  const head = card(EX1).querySelector('.wo-card-head') as HTMLElement
  expect(within(head).getByText(EX1)).toBeInTheDocument()
  expect(head.querySelector('.wo-card-art')).not.toBeNull()
  expect(within(head).getByRole('button', { name: `${EX1} · előzmények és rekordok` })).toBeInTheDocument()
  expect(within(head).getByRole('button', { name: `${EX1} · további műveletek` })).toBeInTheDocument()
})

test('real mode: the RIR picker shows all 6 buttons (0-5) and the initial value is pressed', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(
    { ...REAL_TODAY, exercises: [{ ...REAL_TODAY.exercises[0], warmupSets: 0, workingSets: 1, lastWeek: { weightKg: 102.5, reps: 9, rir: 4 } }] },
    calls,
  )
  setup()
  await enterList()
  // Verify all six RIR buttons render
  for (let i = 0; i <= 5; i++) {
    expect(screen.getByRole('button', { name: `RIR ${i}` })).toBeInTheDocument()
  }
  // Verify the button matching the initial rir is pressed
  const pressedButton = screen.getByRole('button', { name: 'RIR 4' })
  expect(pressedButton).toHaveAttribute('aria-pressed', 'true')
  // Verify the others are not pressed
  for (let i = 0; i <= 5; i++) {
    if (i !== 4) {
      const btn = screen.getByRole('button', { name: `RIR ${i}` })
      expect(btn).toHaveAttribute('aria-pressed', 'false')
    }
  }
})

test('mock mode: the session progress bar renders one segment per exercise', async () => {
  const { container } = setup()
  // Pull Day (mock) has 5 exercises.
  expect(container.querySelectorAll('.wkx-progressbar span')).toHaveLength(5)
})

test('the sticky header shows the workout title, the live set counter and the Vissza + ⋯ buttons', async () => {
  const { container } = setup()
  expect(container.querySelector('.wk-top .t1')).toHaveTextContent('Pull Day')
  // No exercise counter / dots / jump trigger anymore — every exercise is on screen,
  // so the header only carries the session's own set progress (22 = 5+5+4+4+4).
  expect(screen.getByText('0/22 szett')).toBeInTheDocument()
  expect(container.querySelectorAll('.exdots i')).toHaveLength(0)
  expect(screen.getByRole('button', { name: 'Vissza' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Gyakorlat műveletek' })).toBeInTheDocument()
})

test('completing a set marks the row done and advances the header counter', async () => {
  const user = userEvent.setup()
  setup()
  expect(screen.getByText('0/22 szett')).toBeInTheDocument()
  expect(doneRowsOf(EX1)).toHaveLength(0)
  await user.click(submitOf(EX1))
  expect(doneRowsOf(EX1)).toHaveLength(1)
  expect(screen.getByText('1/22 szett')).toBeInTheDocument()
})

// ---- rest wiring: "Szett kész ✓" morphs the dock into its resting look (mezo-xt65,
// T6 Task 6: the dock — `.wo-dock.is-resting` — replaces the old `.restbar`) ----

test('mock mode: logging a mid-exercise set starts the rest countdown', async () => {
  const user = userEvent.setup()
  setup()
  expect(document.querySelector('.wo-dock.is-resting')).toBeNull()
  // ex1 (Chest Supported Row, compound): 2 warmup + 3 working = 5 planned sets.
  // Logging the first (a warmup) leaves 4 sets remaining -> the exercise continues.
  await user.click(submitOf(EX1))
  expect(document.querySelector('.wo-dock.is-resting')).not.toBeNull()
  expect(screen.getByText(/PIHENŐ · CHEST SUPPORTED ROW/)).toBeInTheDocument()
  // The card list never hides the next row behind the rest — the cursor simply moved.
  expect(doneRowsOf(EX1)).toHaveLength(1)
})

test('mock mode: skipping the rest (dock\'s Kész) clears the resting dock', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(submitOf(EX1))
  await user.click(screen.getByRole('button', { name: 'Kész' }))
  expect(document.querySelector('.wo-dock.is-resting')).toBeNull()
  expect(submitOf(EX1)).toBeInTheDocument()
})

test('mock mode: the dock\'s +30s extends the rest countdown', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(submitOf(EX1))
  const parseMMSS = (t: string) => {
    const [m, s] = t.split(':').map(Number)
    return m * 60 + s
  }
  const before = parseMMSS(screen.getByText(/^\d+:\d+$/).textContent!)
  await user.click(screen.getByRole('button', { name: '+30s' }))
  const after = parseMMSS(screen.getByText(/^\d+:\d+$/).textContent!)
  // Allow a little wall-clock drift (userEvent isn't instantaneous) — the point is the
  // 30s bump landed, not that not a single tick elapsed.
  expect(after).toBeGreaterThanOrEqual(before + 28)
})

test('mock mode: logging an exercise\'s final set (opens the feedback modal) starts no rest', async () => {
  const user = userEvent.setup()
  setup()
  // Drive through ex1's 4 non-final sets, skipping each rest.
  for (let i = 0; i < 4; i++) await logSet(user)
  // The 5th (last) set completes the exercise -> feedback modal opens, no rest.
  await user.click(submitOf(EX1))
  expect(await screen.findByText(/Mentés · tovább|Edzés vége →/)).toBeInTheDocument()
  expect(document.querySelector('.wo-dock.is-resting')).toBeNull()
})

test('mock mode: the rest bar belongs to the SESSION — it survives logging on another card', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(submitOf(EX1)) // rest starts on ex1
  expect(document.querySelector('.wo-dock.is-resting')).not.toBeNull()
  // The rest is the user's, not one card's — working another card keeps it running.
  await user.click(submitOf(EX2))
  expect(document.querySelector('.wo-dock.is-resting')).not.toBeNull()
  expect(doneRowsOf(EX2)).toHaveLength(1)
})

test('mock mode: the closing ceremony (workout end) shows no dock at all', async () => {
  const user = userEvent.setup()
  setup()
  // Skip ex0 (no rest on skip), then drive the remaining 4 exercises to completion.
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Gyakorlat kihagyása'))
  await waitFor(() => expect(card(EX1)).toHaveClass('is-skipped'))
  await finishMockSession(user, [EX2, EX3, 'Hammer Curl', 'Face Pull'])
  await closeWorkout(user)
  expect(await screen.findByText('EDZÉS LEZÁRVA')).toBeInTheDocument()
  // The active-phase-only dock unmounts entirely on the ceremony.
  await waitFor(() => expect(document.querySelector('.wo-dock')).toBeNull())
})

test('mock mode: the editable row pre-fills from the slot\'s prescribed target', async () => {
  setup()
  // ex1: warmups are sets 1-2 (52.5×8, 80×3), working sets are 105×10.
  expect(kgInput(EX1)).toHaveValue(52.5)
  expect(repsInput(EX1)).toHaveValue(8)
})

test('mock mode: a warmup slot carries its amber B-prefixed index label', async () => {
  setup()
  const idx = Array.from(card(EX1).querySelectorAll('.wo-idx')).map((n) => n.textContent)
  // ex1: two warmups (B1, B2) then three working slots.
  expect(idx).toEqual(['B1', 'B2', '1', '2', '3'])
})

test('mock mode: renders the progression banner rationale line instead of the static hint', async () => {
  setup()
  // ex1 has a progression signal (mezo-5pfe), so ITS card renders the ProgressionBanner
  // (progression.rationale, Hungarian comma decimal) instead of the plain .wo-cue.
  // Scoped to the card: every exercise's banner is on screen at once now.
  expect(within(card(EX1)).getByText(/Múlt hét 9 × 102,5 kg → \+2,5 kg/)).toBeInTheDocument()
})

test('mock mode: warmup slots render up-front as the 2 "bemelegítő szett" rows', async () => {
  const user = userEvent.setup()
  setup()
  // The card shows ALL slots up front; ex1's 2 warmups are the 2 B-labelled rows.
  await logSet(user) // B1 -> a done (tappable) warmup row
  expect(doneRowsOf(EX1).map((r) => r.getAttribute('aria-label'))).toEqual([
    expect.stringContaining('B1 bemelegítő szett szerkesztése'),
  ])
  await logSet(user) // B2
  expect(doneRowsOf(EX1)).toHaveLength(2)
  expect(doneRowsOf(EX1)[1].getAttribute('aria-label')).toContain('B2 bemelegítő szett')
})

// ---- the card's rows: one editable slot, the rest inert ----

test('mock mode: only the cursor slot is editable; later slots render their prescribed target, inert', async () => {
  setup()
  const rows = rowsOf(EX1)
  // B1 (index 0) is the cursor slot — the ONE editable row of the card.
  expect(rows[0].tagName).toBe('FORM')
  expect(within(rows[0]).getAllByRole('spinbutton')).toHaveLength(2)
  // B2 (index 1) is a later pending row: its OWN warmup target, no inputs at all.
  expect(rows[1].tagName).toBe('DIV')
  expect(within(rows[1]).queryAllByRole('spinbutton')).toHaveLength(0)
  expect(rows[1]).toHaveTextContent('80')
  expect(rows[1]).toHaveTextContent('3')
  // The first working row (index 2): the TARGET weight and the exercise's own rep
  // RANGE (its single engine targetReps is only meaningful for the warmup ramp).
  expect(rows[2]).toHaveTextContent('105')
  expect(rows[2]).toHaveTextContent('8–10')
})

// Fix wave I2: the verdict cell is 22×22 and ICON-ONLY (prototype `verdictCell`) — the
// sentence rides on its title/aria-label, and a RECORD medal takes the cell over
// entirely when the set earned one. So the assertions below read the title, which is
// present in every case, rather than overflowing text that only existed medal-less.
test('mock mode: a logged working set below the prescribed rep range is marked "cél alatt"', async () => {
  const user = userEvent.setup()
  setup()
  await logSet(user) // B1
  await logSet(user) // B2
  // Prefilled reps = 10 (the engine target); drop to 5 — below ex1's repMin (8).
  await typeInto(user, repsInput(EX1), 5)
  await user.click(submitOf(EX1))
  const workingRow = within(card(EX1)).getAllByRole('button', { name: /working szett szerkesztése/ })[0]
  const cell = workingRow.querySelector('.wo-verdict')!
  expect(cell).toHaveClass('is-below')
  expect(cell.getAttribute('title')).toMatch(/Cél alatt/)
})

test('mock mode: a logged working set above the prescribed rep range is marked "cél felett"', async () => {
  const user = userEvent.setup()
  setup()
  await logSet(user) // B1
  await logSet(user) // B2
  // Prefilled reps = 10 (the repMax boundary, still "ok"); bump to 11 — above repMax.
  await typeInto(user, repsInput(EX1), 11)
  await user.click(submitOf(EX1))
  const workingRow = within(card(EX1)).getAllByRole('button', { name: /working szett szerkesztése/ })[0]
  const cell = workingRow.querySelector('.wo-verdict')!
  expect(cell).toHaveClass('is-above')
  expect(cell.getAttribute('title')).toMatch(/Cél felett/)
})

// ---- warmup vs working distinction on the logging card (mezo-eerq) ----

test('mock mode: a warmup slot hides the RIR pills (effort tracking is working-set-only)', async () => {
  setup()
  // ex1 slot 1 is a warmup (B1) — no RIR picker on its editable row.
  expect(rowsOf(EX1)[0]).toHaveTextContent('B1')
  expect(within(card(EX1)).queryByRole('button', { name: 'RIR 0' })).not.toBeInTheDocument()
})

test('mock mode: a working slot shows the RIR pills', async () => {
  const user = userEvent.setup()
  setup()
  await logSet(user) // B1
  await logSet(user) // B2
  expect(within(card(EX1)).getByRole('button', { name: 'RIR 0' })).toBeInTheDocument()
})

test('mock mode: a deviated working-set weight carries into the next working set', async () => {
  const user = userEvent.setup()
  setup()
  await logSet(user) // B1 (52.5)
  await logSet(user) // B2 (80)
  expect(kgInput(EX1)).toHaveValue(105) // engine seeds working 1
  await typeInto(user, kgInput(EX1), 107.5)
  await logSet(user) // log working 1 at 107.5
  // The next working set inherits the deviated 107.5, not the static 105 target.
  await waitFor(() => expect(kgInput(EX1)).toHaveValue(107.5))
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
  setup()
  await enterList()
  await waitFor(() => expect(calls).toContain('start:d-1'))
  // B1 prefills 0 (nothing to inherit yet) — hand-enter 7.5 kg.
  expect(kgInput(EX1)).toHaveValue(0)
  await typeInto(user, kgInput(EX1), 7.5)
  await user.click(submitOf(EX1))
  await waitFor(() => expect(calls).toContain('set:w-1:e-1:0:7.5'))
  // The working set inherits the hand-entered 7.5 instead of resetting to 0.
  await waitFor(() => expect(kgInput(EX1)).toHaveValue(7.5))
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
  await enterList()
  await waitFor(() => expect(calls).toContain('start:d-1'))
  await logSet(user) // B1 — warmup, no RIR logged
  await user.click(submitOf(EX1)) // working set (opens the debrief)
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
  // ex1 (Chest Supported Row): 2 warmups, then working sets prefill to 105 kg × 10 —
  // beats lastWeek (102.5 kg × 9) on WEIGHT and E1RM, and also meets the prescribed
  // target (TARGET_HIT) — three medals on one set. The toast shows the highest-
  // priority RECORD (WEIGHT before E1RM) and counts the other two.
  await logSet(user) // warmup 1
  await logSet(user) // warmup 2
  await user.click(submitOf(EX1)) // working set (setIndex 2) -> RECORD
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
  await enterList()
  await waitFor(() => expect(calls).toContain('start:d-1'))
  await user.click(submitOf(EX1))
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
const firstWorkingRow = () => within(card(EX1)).getAllByRole('button', { name: /working szett szerkesztése/ })[0]

test('mock mode: a set that hits its target gets a sage ✓ status and a chip per RECORD medal', async () => {
  const user = userEvent.setup()
  setup()
  // ex1 working sets are prescribed 105 kg × 10 and prefill to exactly that, so
  // set index 2 earns WEIGHT + E1RM (RECORD) *and* TARGET_HIT (TARGET) — the
  // three-medal case that makes the loud/quiet split visible on one row.
  await logSet(user) // B1 (warmup)
  await logSet(user) // B2 (warmup)
  await user.click(submitOf(EX1)) // working set (index 2)

  // Exactly TWO chips — the TARGET_HIT contributes none (MedalChip gates on tier).
  await waitFor(() => expect(within(firstWorkingRow()).getAllByRole('img')).toHaveLength(2))
  const workingRow = firstWorkingRow()
  expect(within(workingRow).getByRole('img', { name: 'Súly-rekord' })).toBeInTheDocument()
  expect(within(workingRow).getByRole('img', { name: '1RM-rekord' })).toBeInTheDocument()
  // 10 reps is within ex1's prescribed [8,10] range -> the in-range verdict. The two
  // medals OWN the 22px cell (I2), so the verdict itself is carried by the title.
  expect(workingRow.querySelector('.wo-verdict')).toHaveClass('is-ok')
  expect(workingRow.querySelector('.wo-verdict')!.getAttribute('title')).toMatch(/javasolt rep-sávban/)

  // The warmup arm: a done warmup row earns no medals (the mock evaluator never
  // scores warmup-kind sets), so its cell shows the in-range ✓ glyph instead.
  const warmupRow = within(card(EX1)).getAllByRole('button', { name: /bemelegítő szett szerkesztése/ })[0]
  expect(within(warmupRow).queryAllByRole('img', { name: /rekord/i })).toHaveLength(0)
  expect(warmupRow.querySelector('.wo-verdict')).toHaveTextContent('✓')
})

test('mock mode: a set that sets records still shows its chips even when the logged weight misses the prescribed target', async () => {
  const user = userEvent.setup()
  setup()
  await logSet(user) // B1 (warmup)
  await logSet(user) // B2 (warmup)
  // Drop the prefilled 105 kg to 102.5 — under the prescribed 105, so NO TARGET_HIT,
  // yet 102,5 × 10 still beats lastWeek (102,5 × 9) on REPS_AT_WEIGHT and E1RM.
  await typeInto(user, kgInput(EX1), 102.5)
  await user.click(submitOf(EX1)) // working set (index 2)

  await waitFor(() => expect(within(firstWorkingRow()).getAllByRole('img')).toHaveLength(2))
  const workingRow = firstWorkingRow()
  expect(within(workingRow).getByRole('img', { name: 'Rep-rekord' })).toBeInTheDocument()
  expect(within(workingRow).getByRole('img', { name: '1RM-rekord' })).toBeInTheDocument()
  // The weight miss doesn't affect reps (still 10, within [8,10]) -> still in-range;
  // the verdict is rep-range-only, unlike the old TARGET_HIT tick.
  expect(workingRow.querySelector('.wo-verdict')).toHaveClass('is-ok')
})

// The card list has no "next exercise" to hand over to — a reorder now literally
// restacks the cards, which is the thing to assert.
const cardOrder = () =>
  Array.from(document.querySelectorAll('.wo-card')).map((c) => c.getAttribute('aria-label'))

test('reordering remaining exercises restacks the cards', async () => {
  const user = userEvent.setup()
  setup() // mock mode (file pins VITE_USE_MOCK=true)
  expect(cardOrder().slice(0, 3)).toEqual([EX1, EX2, EX3])
  // Előrébb/Hátrébb (T6 Task 4) address the CARD whose own ⋮ opened the menu —
  // pull ex3 up over ex2 via ex3's own menu, one hop.
  await user.click(within(card(EX3)).getByRole('button', { name: `${EX3} · további műveletek` }))
  await user.click(screen.getByText('Előrébb'))
  await waitFor(() => expect(cardOrder().slice(0, 3)).toEqual([EX1, EX3, EX2]))
})

// mezo-vad0: the exercise whose menu is open is reorderable too — the common gym case
// is "the machine is taken, push the one I'm on back".
test('the menu\'s own exercise can be moved back', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Hátrébb'))
  await waitFor(() => expect(cardOrder().slice(0, 2)).toEqual([EX2, EX1]))
})

test('a card\'s own ⋮ menu targets THAT exercise, not the session cursor', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(within(card(EX2)).getByRole('button', { name: `${EX2} · további műveletek` }))
  await user.click(screen.getByText('Gyakorlat kihagyása'))
  // The SECOND card is the one that got skipped — the first is untouched.
  await waitFor(() => expect(card(EX2)).toHaveClass('is-skipped'))
  expect(card(EX1)).not.toHaveClass('is-skipped')
})

// mezo-vad0: a phase flip swaps the whole tree WITHOUT a route change, so the page must
// reset the app scroller itself (ScreenContent only does it on navigation). Since
// mezo-e1ii9 the entry phase is already 'active', so this is the MOUNT-time reset.
test('entering the session jumps the app scroller back to the top', async () => {
  const scroller = document.createElement('div')
  scroller.className = 'screen-content'
  const scrollTo = vi.fn()
  Object.assign(scroller, { scrollTo })
  document.body.appendChild(scroller)
  try {
    setup()
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' })
  } finally {
    scroller.remove()
  }
})

test('Szett hozzáadása adds an extra set: the card grows 5→6 rows', async () => {
  const user = userEvent.setup()
  setup()                                                   // active: Chest Supported Row has 5 planned slots (2 warmup + 3 working)
  expect(rowsOf(EX1)).toHaveLength(5)
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Szett hozzáadása'))             // adds one extra set; sheet closes
  expect(rowsOf(EX1)).toHaveLength(6)
  // The extra slot is a WORKING one — the warmup labels are unchanged.
  const idx = Array.from(card(EX1).querySelectorAll('.wo-idx')).map((n) => n.textContent)
  expect(idx).toEqual(['B1', 'B2', '1', '2', '3', '4'])
})

test('⋯ Gyakorlat kihagyása collapses the exercise\'s card without opening the debrief', async () => {
  const user = userEvent.setup()
  setup() // mock mode, cursor = Chest Supported Row (ex1)
  // Start a mid-exercise rest before skipping — skip must clear it (final-review
  // fix, mezo-8141 — Ride-along A), not leave the bar counting toward an
  // abandoned exercise.
  await user.click(submitOf(EX1))
  expect(document.querySelector('.wo-dock.is-resting')).not.toBeNull()
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Gyakorlat kihagyása'))
  // The card collapses in place — no FeedbackModal / debrief CTA.
  await waitFor(() => expect(card(EX1)).toHaveClass('is-skipped'))
  expect(within(card(EX1)).getByText('KIHAGYVA')).toBeInTheDocument()
  expect(rowsOf(EX1)).toHaveLength(0)
  expect(screen.queryByText('Mentés · tovább')).not.toBeInTheDocument()
  expect(screen.queryByText('Edzés vége →')).not.toBeInTheDocument()
  expect(document.querySelector('.wo-dock.is-resting')).toBeNull()
})

/** Drive every non-skipped exercise of the mock Pull Day to completion. */
/** The explicit close (T7): the active list's finish CTA (plus the confirm glass when sets are
 *  pending) — and the closing ceremony IS what lands. Since mezo-e1ii9 (Train parity P1, Task 2)
 *  the workout close raises NO level-up overlay on top of it. */
async function closeWorkout(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Edzés befejezése|Edzés kihagyása/ }))
  const confirm = screen.queryByRole('button', { name: /Befejezem így|Kihagyom a mai edzést/ })
  if (confirm) await user.click(confirm)
}

/** The ceremony is TWO steps since mezo-e1ii9 Task 3 (prototype `summary()` →
 *  `detailsStep()`): the muscle rows, the kcal tile, the note field and the close CTA all
 *  live one `Részletek` tap away. */
async function openCeremonyDetails(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Részletek/ }))
}

async function finishMockSession(user: ReturnType<typeof userEvent.setup>, names: string[]) {
  for (const name of names) {
    await completeExerciseSets(user, name)
    const cta = await screen.findByText(/Mentés · tovább|Edzés vége →/)
    await user.click(cta)
    await waitFor(() => expect(screen.queryByText(/Mentés · tovább|Edzés vége →/)).toBeNull())
  }
}

test('a skipped exercise stays missing work in the ceremony\'s muscle row', async () => {
  const user = userEvent.setup()
  setup() // mock mode, 5 exercises
  // Skip the first exercise (ex1: back-mid, 2 warmup + 4 working = 6 planned sets).
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Gyakorlat kihagyása'))
  await waitFor(() => expect(card(EX1)).toHaveClass('is-skipped'))
  await finishMockSession(user, [EX2, EX3, 'Hammer Curl', 'Face Pull'])
  await closeWorkout(user)
  await openCeremonyDetails(user)
  // Hát (közép) pools the skipped ex1 with the completed ex3 — the skip is missed work, so
  // its sets stay on the PLAN side of the row (cerScore's rule), never quietly dropped.
  expect(await screen.findByText('Hát (közép)')).toBeInTheDocument()
  expect(screen.getByText('4 / 9 szett')).toBeInTheDocument()
  // Every muscle the user actually worked reads as fully done — only the skipped one carries a gap.
  expect(screen.getByText('Váll (hátsó)').parentElement).toHaveTextContent('4 / 4 szett')
})

test('a skipped exercise\'s card reads KIHAGYVA and hides its rows', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Gyakorlat kihagyása'))
  await waitFor(() => expect(card(EX1)).toHaveClass('is-skipped'))
  expect(within(card(EX1)).getByText('KIHAGYVA')).toBeInTheDocument()
  // The other cards are untouched — a skip is not a completion.
  expect(card(EX2)).not.toHaveClass('is-skipped')
  expect(card(EX2)).not.toHaveClass('is-complete')
})

// mezo-e1ii9 (Train parity P1, Task 2) — the owner's headline complaint: closing a workout never
// showed him the star ceremony, because the pre-Titanium `.levelup` overlay (416×932, z-index 250)
// went up on top of it. The prototype's close (companion-titanium/session.js) has exactly ONE
// layer, and it carries `+N szerzett XP` itself. Other domains keep the overlay — see
// SportPage.test.tsx and RunningPage.test.tsx, which still assert the Szintlépés dialog.
test('the finish CTA lands straight on the closing ceremony — NO level-up overlay on top (mock)', async () => {
  const user = userEvent.setup()
  setup()
  // Skip ex0, then drive the remaining 4 exercises to completion — the last debrief leaves
  // the card list fully resolved (T7: no pre-finish review screen, no auto-finish).
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Gyakorlat kihagyása'))
  await waitFor(() => expect(card(EX1)).toHaveClass('is-skipped'))
  await finishMockSession(user, [EX2, EX3, 'Hammer Curl', 'Face Pull'])
  expect(screen.queryByText('EDZÉS LEZÁRVA')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Edzés befejezése' }))
  // The ceremony IS the closing frame: the stars, the verdict and the way out.
  expect(await screen.findByText('EDZÉS LEZÁRVA')).toBeInTheDocument()
  // Nothing above it — no overlay node, no Szintlépés dialog, none of its pre-Titanium content.
  expect(document.querySelector('.levelup')).toBeNull()
  expect(screen.queryByRole('dialog', { name: 'Szintlépés' })).not.toBeInTheDocument()
  expect(screen.queryByText(/KLASSZIK KONDI/)).not.toBeInTheDocument()
  // The XP is not lost: the ceremony carries the finish response's REAL award (mock seed: 480).
  const stats = document.querySelector('.cer-stats')
  expect(stats).not.toBeNull()
  expect(stats).toHaveTextContent('+480')
  expect(stats).toHaveTextContent('szerzett XP')
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/csillag az ötből/)
  // Step ONE has exactly one way on (mezo-e1ii9 Task 3): the close CTA is on step two.
  expect(screen.queryByRole('button', { name: /Vissza a mai napra/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Részletek/ })).toBeInTheDocument()
  // The session's real records (mezo-wp6n) drive the ceremony's record strip — ex2..ex5's
  // working sets all hit their prescribed target and several beat last week.
  expect(screen.getByText(/új rekord|Új rekord/)).toBeInTheDocument()
  await openCeremonyDetails(user)
  expect(screen.getByRole('button', { name: /Vissza a mai napra/ })).toBeInTheDocument()
})

// ---- T6 Task 6: the 3-state `.wo-finish` CTA + the finish confirm glass — replaces
// Task 4's temporary plain "Edzés befejezése" button. ----

test('nothing logged: the finish CTA reads "Edzés kihagyása" and opens the confirm glass', async () => {
  const user = userEvent.setup()
  setup()
  const cta = screen.getByRole('button', { name: 'Edzés kihagyása' })
  expect(cta).toHaveClass('is-skip')
  await user.click(cta)
  expect(await screen.findByText('Egy szettet sem rögzítettél ma.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Kihagyom a mai edzést/ })).toBeInTheDocument()
})

test('the confirm glass\'s Mégse closes it without finishing — the active phase stays put', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: 'Edzés kihagyása' }))
  await screen.findByText('Egy szettet sem rögzítettél ma.')
  await user.click(screen.getByRole('button', { name: 'Mégse, visszamegyek' }))
  expect(screen.queryByText('Egy szettet sem rögzítettél ma.')).not.toBeInTheDocument()
  expect(submitOf(EX1)).toBeInTheDocument()
})

test('confirming a zero-logged finish goes straight through finishAndCelebrate (no closing review screen)', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: 'Edzés kihagyása' }))
  await user.click(await screen.findByRole('button', { name: /Kihagyom a mai edzést/ }))
  // The ceremony is the close moment for the zero-logged path too (T7) — and the only layer
  // on screen (mezo-e1ii9): no level-up overlay in front of it.
  expect(await screen.findByText('EDZÉS LEZÁRVA')).toBeInTheDocument()
  expect(document.querySelector('.levelup')).toBeNull()
  await openCeremonyDetails(user)
  expect(screen.getByRole('button', { name: /Vissza a mai napra/ })).toBeInTheDocument()
  // Nothing was logged, so the kcal tile stays away entirely — never a 0.
  expect(screen.queryByText('kcal')).not.toBeInTheDocument()
})

test('once every set is logged (full state) the finish CTA reads "Edzés befejezése" and finishes with no confirm glass', async () => {
  const user = userEvent.setup()
  setup()
  // Drive every exercise to completion — the debrief flow leaves the user ON the card list
  // (T7), fully logged, with nothing FINISHED yet.
  await finishMockSession(user, [EX1, EX2, EX3, 'Hammer Curl', 'Face Pull'])
  const cta = screen.getByRole('button', { name: 'Edzés befejezése' })
  expect(cta).toHaveClass('is-full')
  await user.click(cta)
  // Zero pending -> straight to finishAndCelebrate, no confirm glass in between.
  expect(screen.queryByText(/bepipálatlan szetted/)).not.toBeInTheDocument()
  expect(await screen.findByText('EDZÉS LEZÁRVA')).toBeInTheDocument()
  expect(document.querySelector('.levelup')).toBeNull()
})

// mezo-e1ii9 Task 3: the küldetés rows T7 put in the ceremony have no prototype counterpart
// on either step, so they are gone from the close. The outcomes keep their other home — the
// review page (WorkoutReviewPage → WorkoutSummary's own `Kihívások` strip), which is covered
// in WorkoutReviewPage.test.tsx.
test('neither ceremony step carries a küldetés row — and the old WorkoutSummary report is still gone', async () => {
  const user = userEvent.setup()
  setup()
  await finishMockSession(user, [EX1, EX2, EX3, 'Hammer Curl', 'Face Pull'])
  await closeWorkout(user)
  expect(await screen.findByText('EDZÉS LEZÁRVA')).toBeInTheDocument()
  expect(document.querySelector('.cer-chals')).toBeNull()
  expect(screen.queryByText('skippelted')).not.toBeInTheDocument()
  await openCeremonyDetails(user)
  expect(document.querySelector('.cer-chals')).toBeNull()
  expect(screen.queryByText('skippelted')).not.toBeInTheDocument()
  // The pre-Titanium summary shell no longer renders anywhere on this page.
  expect(document.querySelector('.wr-root')).toBeNull()
  expect(document.querySelector('.wsum-chal')).toBeNull()
})

/** The ceremony's kcal tile numeral (`.cer-kcal-line strong`), as a plain integer —
 *  huNumber() renders thousands with a (possibly non-breaking) space separator. */
function readKcalValue(): number {
  const el = document.querySelector('.cer-kcal-line strong')
  if (!el) throw new Error('no .cer-kcal-line tile in the document')
  return Number((el.textContent ?? '').replace(/[^\d]/g, ''))
}

test('mock mode: the kcal tile scales with the done/planned set share, not the whole plan (mezo-88iwa.8)', async () => {
  // Full completion: every exercise, every set.
  const userFull = userEvent.setup()
  const full = setup()
  await finishMockSession(userFull, [EX1, EX2, EX3, 'Hammer Curl', 'Face Pull'])
  await closeWorkout(userFull)
  expect(await screen.findByText('EDZÉS LEZÁRVA')).toBeInTheDocument()
  await openCeremonyDetails(userFull)
  const fullKcal = readKcalValue()
  full.unmount()

  // Partial completion: a single exercise's sets, everything else left pending.
  const userPartial = userEvent.setup()
  setup()
  await completeExerciseSets(userPartial, EX1)
  const debriefCta = await screen.findByText(/Mentés · tovább|Edzés vége →/)
  await userPartial.click(debriefCta)
  await waitFor(() => expect(screen.queryByText(/Mentés · tovább|Edzés vége →/)).toBeNull())
  await closeWorkout(userPartial)
  expect(await screen.findByText('EDZÉS LEZÁRVA')).toBeInTheDocument()
  await openCeremonyDetails(userPartial)
  const partialKcal = readKcalValue()

  expect(partialKcal).toBeGreaterThan(0)
  expect(partialKcal).toBeLessThan(fullKcal)
})

// ---- F4 note: durable per-exercise note pill + editor (mock-mode) ----

test('mock mode: no note pill on a card when the exercise has no note', async () => {
  setup() // mock exercises carry no note
  expect(within(card(EX1)).getByText(EX1)).toBeInTheDocument()
  expect(screen.queryByLabelText('Gyakorlat-jegyzet')).not.toBeInTheDocument()
})

test('mock mode: editing a note via ⋯ → Jegyzet renders the note pill with the typed text', async () => {
  const user = userEvent.setup()
  setup()
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
  // 1. add a note → the pill renders with the typed text.
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Jegyzet'))
  const textarea = await screen.findByLabelText('Gyakorlat-jegyzet szerkesztése')
  await user.type(textarea, 'Lassú excentrikus')
  await user.click(screen.getByText('Mentés'))
  expect(await screen.findByLabelText('Gyakorlat-jegyzet')).toHaveTextContent('Lassú excentrikus')
  // 2. reopen the editor (the row's hint now reads "Megírt jegyzet szerkesztése"), empty it, save.
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Megírt jegyzet szerkesztése'))
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
    // The ceremony's closing note (mezo-88iwa.8, fix round 1) — distinct namespace
    // (workoutNote:) from the per-exercise `note:` calls pushed above.
    http.put(`${API_BASE}/api/train/workouts/:id/note`, async ({ params, request }) => {
      const body = (await request.json()) as { note?: string | null }
      calls.push(`workoutNote:${params.id}:${body.note ?? ''}`)
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
  await enterList()
  // The e1RM's home since the prep mosaic retired (mezo-e1ii9): the card's OWN
  // records glass, not a briefing badge.
  await user.click(await screen.findByRole('button', { name: `${EX1} · előzmények és rekordok` }))
  expect(await screen.findByText('BECSÜLT 1RM')).toBeInTheDocument()
  expect(screen.getByText('133 kg')).toBeInTheDocument()
})

test('real mode: starting creates the instance and Szett kész posts the set', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(REAL_TODAY, calls)
  const user = userEvent.setup()
  setup()
  await enterList()
  await waitFor(() => expect(calls).toContain('start:d-1'))
  await user.click(submitOf(EX1))
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
  setup()
  await enterList()
  await waitFor(() => expect(calls).toContain('start:d-1'))
  await user.click(submitOf(EX1))
  // Round 2 rolled the entry back on failure — but that could desync logged[i] from
  // prescribed[i] for anything but the LAST entry (fix round 3, F1). The honest move
  // is to leave the set visible: the row stays done throughout.
  await waitFor(() => expect(doneRowsOf(EX1)).toHaveLength(1))
  // The row is disabled while the POST is genuinely in flight, then becomes tappable
  // again once it's KNOWN to have failed (not stuck disabled forever, unlike a still-
  // in-flight row).
  await waitFor(() => expect(doneRowsOf(EX1)[0]).not.toBeDisabled())
  await user.click(doneRowsOf(EX1)[0])
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
  await enterList()
  await waitFor(() => expect(calls).toContain('start:d-1'))

  // Log the first working set at its 102.5 kg prefill (useRealHandlers echoes id `st-0`).
  await user.click(submitOf(EX1))
  await waitFor(() => expect(calls).toContain('set:w-1:e-1:0:102.5'))
  await user.click(await screen.findByRole('button', { name: 'Kész' }))
  // Bump the weight on the CARD's own next row (not the sheet) before logging the SECOND
  // set, so the two rows carry visibly DIFFERENT weights — the only way to prove the
  // later edit/delete addressed the right ROW, not merely "some" row.
  await typeInto(user, kgInput(EX1), 105)
  await user.click(submitOf(EX1))
  await waitFor(() => expect(calls).toContain('set:w-1:e-1:1:105'))
  await user.click(await screen.findByRole('button', { name: 'Kész' }))

  // Edit the FIRST row (102.5 kg) — bump REPS only (not weight), so the 102.5/105 kg
  // marker keeps discriminating the two rows through the edit.
  await user.click(doneRowsOf(EX1)[0])
  await user.click(within(screen.getByRole('dialog')).getByLabelText('Ismétlés növelése'))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Mentés ✓' }))
  await waitFor(() => expect(calls).toContain('put:st-0'))
  expect(putBodies['st-0']).toMatchObject({ weightKg: 102.5, reps: 10 }) // lastWeek reps 9 + 1

  // Delete the FIRST row — must DELETE st-0 specifically, not st-1.
  await user.click(doneRowsOf(EX1)[0])
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Szett törlése' }))
  await waitFor(() => expect(calls).toContain('delete:st-0'))
  // The surviving row (now at index 0) carries the SECOND set's 105 kg marker —
  // proof the shift landed correctly, not just that "a" DELETE fired.
  expect(doneRowsOf(EX1)[0].getAttribute('aria-label')).toContain('105')
})

// mezo-e1ii9 fix round 1: a FAILED start used to strand the session silently — `workoutId`
// stayed null, the list looked fully functional, and every set POSTed against 'mock'.
test('real mode: a failed start blocks logging, says so, and a successful retry unblocks the list', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(REAL_TODAY, calls)
  let startShouldFail = true
  server.use(
    http.post(`${API_BASE}/api/train/workouts`, async ({ request }) => {
      const body = (await request.json()) as { templateSessionId: string }
      calls.push(`start:${body.templateSessionId}`)
      if (startShouldFail) return new HttpResponse(null, { status: 500 })
      return HttpResponse.json(
        { id: 'w-1', templateSessionId: body.templateSessionId, date: '2026-06-12', status: 'active', sets: [] },
        { status: 201 },
      )
    }),
  )
  const user = userEvent.setup()
  setup()
  await enterList()
  // The failure is LOUD and the ✓ is dead.
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toContain('Nem sikerült elindítani az edzést')
  expect(submitOf(EX1)).toBeDisabled()
  // Nothing may be POSTed while there is no instance id — not even against 'mock'.
  await user.click(submitOf(EX1))
  expect(calls.some((c) => c.startsWith('set:'))).toBe(false)
  expect(doneRowsOf(EX1)).toHaveLength(0)

  // The retry binds a real id and the list comes back to life.
  startShouldFail = false
  await user.click(screen.getByRole('button', { name: 'Újra' }))
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  await user.click(submitOf(EX1))
  await waitFor(() => expect(calls.some((c) => c.startsWith('set:w-1:e-1:0'))).toBe(true))
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
  setup()
  // a resumed instance seeds straight to set 2 (and re-POSTs no start)
  await waitFor(() => expect(document.querySelector('.wo-card')).not.toBeNull())
  expect(calls).not.toContain('start:d-1')
  expect(rowsOf(EX1)).toHaveLength(2)
  expect(doneRowsOf(EX1)).toHaveLength(1) // the persisted set is a done row
  await user.click(submitOf(EX1))
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
  render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
  await waitFor(() => expect(document.querySelector('.wo-card')).not.toBeNull())
  expect(rowsOf(EX1)).toHaveLength(2) // resumed at the 2nd set
  expect(doneRowsOf(EX1)).toHaveLength(1)
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
  await enterList()
  await waitFor(() => expect(calls).toContain('start:d-1'))
  await user.click(submitOf(EX1)) // only set -> FeedbackModal
  await user.click(await screen.findByText('Edzés vége →'))
  await waitFor(() => expect(calls).toContain('feedback:w-1'))
  // New flow: the debrief leaves the card list up; finish fires only on the explicit CTA.
  await user.click(await screen.findByRole('button', { name: 'Edzés befejezése' }))
  await waitFor(() => expect(calls).toContain('finish:w-1'))
  expect(await screen.findByText('EDZÉS LEZÁRVA')).toBeInTheDocument() // the ceremony
})

// Fix round 1 (mezo-e1ii9 Task 3): the ceremony's "a pulton töltött idő" tile must come
// from the wire response's own startedAt/finishedAt/activeSeconds, never a client clock, in
// real mode — the default `useRealHandlers` finish handler above returns none of the three,
// which silently exercised the (mock-only) client-clock fallback in every other real-mode
// test. These two cases pin the documented contract directly (docs/features/train.md).
test('real mode: a finish response carrying startedAt/finishedAt/activeSeconds renders the measured tile', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(
    { ...REAL_TODAY, exercises: [{ ...REAL_TODAY.exercises[0], workingSets: 1 }] },
    calls,
  )
  server.use(
    http.post(`${API_BASE}/api/train/workouts/:id/finish`, ({ params }) => {
      calls.push(`finish:${params.id}`)
      return HttpResponse.json({
        id: String(params.id), templateSessionId: 'd-1', date: '2026-06-12', status: 'completed', sets: [],
        startedAt: '2026-06-12T10:00:00Z', finishedAt: '2026-06-12T10:41:00Z', activeSeconds: 2460,
      })
    }),
  )
  const user = userEvent.setup()
  setup()
  await enterList()
  await waitFor(() => expect(calls).toContain('start:d-1'))
  await user.click(submitOf(EX1)) // only set -> FeedbackModal
  await user.click(await screen.findByText('Edzés vége →'))
  await user.click(await screen.findByRole('button', { name: 'Edzés befejezése' }))
  await waitFor(() => expect(calls).toContain('finish:w-1'))
  expect(await screen.findByText('EDZÉS LEZÁRVA')).toBeInTheDocument() // the ceremony
  // finishedAt − startedAt = 41 minutes, straight off the wire — not a mount-to-finish clock.
  expect(await screen.findByText('a pulton töltött idő')).toBeInTheDocument()
  expect(screen.getByText('41')).toBeInTheDocument()
})

test('real mode: a finish response with no startedAt renders NO measured-time tile', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(
    { ...REAL_TODAY, exercises: [{ ...REAL_TODAY.exercises[0], workingSets: 1 }] },
    calls,
  )
  // The default useRealHandlers finish handler already omits startedAt/finishedAt/
  // activeSeconds (a pre-mezo-1jm8 row or a resumed legacy instance) — no override needed.
  const user = userEvent.setup()
  setup()
  await enterList()
  await waitFor(() => expect(calls).toContain('start:d-1'))
  await user.click(submitOf(EX1)) // only set -> FeedbackModal
  await user.click(await screen.findByText('Edzés vége →'))
  await user.click(await screen.findByRole('button', { name: 'Edzés befejezése' }))
  await waitFor(() => expect(calls).toContain('finish:w-1'))
  expect(await screen.findByText('EDZÉS LEZÁRVA')).toBeInTheDocument() // the ceremony
  // Never a mount-to-finish client clock standing in for a real measurement in real mode.
  expect(screen.queryByText('a pulton töltött idő')).not.toBeInTheDocument()
})

test('real mode: a failed finish POST re-enables the finish CTA (not stuck disabled)', async () => {
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
  await enterList()
  await waitFor(() => expect(calls).toContain('start:d-1'))
  await user.click(submitOf(EX1)) // only set -> FeedbackModal
  await user.click(await screen.findByText('Edzés vége →')) // debrief -> back to the list
  await user.click(await screen.findByRole('button', { name: 'Edzés befejezése' }))
  // The finish POST fails; the CTA must become enabled again so the user can retry
  // (regression guard for the reset living only in onSuccess — mezo-cd8s).
  await waitFor(() => expect(screen.getByRole('button', { name: 'Edzés befejezése' })).toBeEnabled())
  // Still on the card list — the ceremony only ever follows a resolved finish.
  expect(screen.queryByText('EDZÉS LEZÁRVA')).not.toBeInTheDocument()
})

test('real mode: Szett hozzáadása grows a 1-set exercise to 2 and the extra set posts with setIndex 1', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(
    { ...REAL_TODAY, exercises: [{ ...REAL_TODAY.exercises[0], workingSets: 1 }] },
    calls,
  )
  const user = userEvent.setup()
  setup()
  await enterList()
  await waitFor(() => expect(calls).toContain('start:d-1'))
  expect(rowsOf(EX1)).toHaveLength(1)
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Szett hozzáadása')) // 1 planned set -> 2 effective
  expect(rowsOf(EX1)).toHaveLength(2) // the extra set grew the count to 2
  await user.click(submitOf(EX1)) // set 1 (setIndex 0)
  expect(doneRowsOf(EX1)).toHaveLength(1) // still mid-exercise, not overflowed
  await user.click(screen.getByRole('button', { name: 'Kész' }))
  await user.click(submitOf(EX1)) // extra set (setIndex 1) -> last set, opens FeedbackModal
  await waitFor(() => expect(calls.some((c) => c.startsWith('set:w-1:e-1:1'))).toBe(true))
})

test('real mode: ⋯ Gyakorlat kihagyása POSTs the skip for the current exercise', async () => {
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
  await enterList()
  await waitFor(() => expect(calls).toContain('start:d-1'))
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Gyakorlat kihagyása'))
  await waitFor(() => expect(calls).toContain('skip:w-1:e-1'))
  await waitFor(() => expect(card(EX1)).toHaveClass('is-skipped'))
})

test('real mode: a /today exercise WITH a note renders the pill on the active card', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(
    { ...REAL_TODAY, exercises: [{ ...REAL_TODAY.exercises[0], note: '4-es ülés' }] },
    calls,
  )
  setup()
  await enterList()
  const pill = await screen.findByLabelText('Gyakorlat-jegyzet')
  expect(pill).toHaveTextContent('4-es ülés')
})

test('real mode: editing + saving a note PUTs it for the current exercise', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(REAL_TODAY, calls)
  const user = userEvent.setup()
  setup()
  await enterList()
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Jegyzet'))
  const textarea = await screen.findByLabelText('Gyakorlat-jegyzet szerkesztése')
  await user.type(textarea, 'Tartsd a könyököt')
  await user.click(screen.getByText('Mentés'))
  await waitFor(() => expect(calls).toContain('note:e-1:Tartsd a könyököt'))
  const pill = await screen.findByLabelText('Gyakorlat-jegyzet')
  expect(pill).toHaveTextContent('Tartsd a könyököt')
})

// ---- mezo-88iwa.8 fix round 1: the closing note's end-to-end save path ----

test('real mode: finishing then tapping "Vissza a mai napra" with a typed note PUTs it for the instance', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(REAL_TODAY, calls)
  const user = userEvent.setup()
  setup()
  await enterList()
  await user.click(screen.getByRole('button', { name: 'Edzés kihagyása' }))
  await user.click(await screen.findByRole('button', { name: /Kihagyom a mai edzést/ }))
  expect(await screen.findByText('EDZÉS LEZÁRVA')).toBeInTheDocument()
  await openCeremonyDetails(user)
  await user.type(screen.getByLabelText('Hogy ment?'), 'Jól ment az edzés')
  await user.click(screen.getByRole('button', { name: /Vissza a mai napra/ }))
  await waitFor(() => expect(calls).toContain('workoutNote:w-1:Jól ment az edzés'))
})

test('real mode: closing with an empty note fires no note PUT', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(REAL_TODAY, calls)
  const user = userEvent.setup()
  setup()
  await enterList()
  await user.click(screen.getByRole('button', { name: 'Edzés kihagyása' }))
  await user.click(await screen.findByRole('button', { name: /Kihagyom a mai edzést/ }))
  expect(await screen.findByText('EDZÉS LEZÁRVA')).toBeInTheDocument()
  await openCeremonyDetails(user)
  await user.click(screen.getByRole('button', { name: /Vissza a mai napra/ }))
  await waitFor(() => expect(calls.some((c) => c.startsWith('finish:'))).toBe(true))
  expect(calls.some((c) => c.startsWith('workoutNote:'))).toBe(false)
})

// ---- T6 Task 4: the per-card ⋮ menu glass (Videó · Szett elvétele · Visszavesszük) ----

test('real mode: no videoUrl -> no Videó row', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(REAL_TODAY, calls)
  const user = userEvent.setup()
  setup()
  await enterList()
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  expect(screen.queryByText('Videó')).not.toBeInTheDocument()
})

test('real mode: a videoUrl -> Videó opens the embed glass', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers({ ...REAL_TODAY, exercises: [{ ...REAL_TODAY.exercises[0], videoUrl: 'https://youtu.be/GZTvxN5fPBc' }] }, calls)
  const user = userEvent.setup()
  setup()
  await enterList()
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Videó'))
  const frame = document.querySelector('.wo-video-frame') as HTMLElement
  expect(frame).not.toBeNull()
  expect(within(frame).getByTitle('Demo videó')).toBeInTheDocument()
  // The menu itself is gone — the Videó action switched the glass, it never fired onClose.
  expect(screen.queryByText('Jegyzet')).not.toBeInTheDocument()
})

test('real mode: Szett elvétele removes the trailing pending slot and, once nothing pending remains, opens the debrief (I2 revived)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(
    { ...REAL_TODAY, exercises: [{ ...REAL_TODAY.exercises[0], warmupSets: 0, workingSets: 2 }] },
    calls,
  )
  const user = userEvent.setup()
  setup()
  await enterList()
  await waitFor(() => expect(calls).toContain('start:d-1'))
  expect(rowsOf(EX1)).toHaveLength(2)
  await user.click(submitOf(EX1)) // log the first working set -> 1 logged, 1 trailing pending
  await user.click(await screen.findByRole('button', { name: 'Kész' }))
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Szett elvétele'))
  // The trailing pending slot is gone and the exercise now reads fully logged —
  // no editable row left, and the debrief takes over (the dead I2 branch, revived).
  expect(await screen.findByText(/Mentés · tovább|Edzés vége →/)).toBeInTheDocument()
  expect(rowsOf(EX1)).toHaveLength(1)
})

test('real mode: Szett elvétele is disabled at the one-slot floor', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(
    { ...REAL_TODAY, exercises: [{ ...REAL_TODAY.exercises[0], warmupSets: 0, workingSets: 1 }] },
    calls,
  )
  const user = userEvent.setup()
  setup()
  await enterList()
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  expect(screen.getByText('Szett elvétele').closest('button')).toBeDisabled()
})

test('real mode: Visszavesszük restores a skipped card\'s rows', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
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
  await enterList()
  await waitFor(() => expect(calls).toContain('start:d-1'))
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Gyakorlat kihagyása'))
  await waitFor(() => expect(card(EX1)).toHaveClass('is-skipped'))
  expect(rowsOf(EX1)).toHaveLength(0)
  await user.click(within(card(EX1)).getByRole('button', { name: `${EX1} · további műveletek` }))
  expect(screen.getByText('Visszavesszük')).toBeInTheDocument()
  await user.click(screen.getByText('Visszavesszük'))
  await waitFor(() => expect(card(EX1)).not.toHaveClass('is-skipped'))
  expect(rowsOf(EX1)).toHaveLength(2)
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
  setup()
  await enterList()
  // first warmup target = 52.5 kg × 10 (engine prescription, NOT lastWeek 102.5)
  await waitFor(() => expect(document.querySelector('.wo-card')).not.toBeNull())
  expect(kgInput(EX1)).toHaveValue(52.5)
  expect(repsInput(EX1)).toHaveValue(10)
  expect(screen.getByText(/→ \+2\.5 kg/)).toBeInTheDocument() // the card's own .wo-cue
  // the logged set carries the prescribed warmup weight, not lastWeek
  await user.click(submitOf(EX1))
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
  setup()
  await enterList()
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
  setup()
  await enterList()
  await waitFor(() => expect(document.querySelector('.wo-card')).not.toBeNull())
  expect(within(card('Box Jump')).getByText('Box Jump')).toBeInTheDocument()
  expect(kgInput('Box Jump')).toBeDisabled() // no load to log
  expect(repsInput('Box Jump')).toHaveValue(5)
  await user.click(submitOf('Box Jump'))
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
  await enterList()
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Szett hozzáadása'))
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
  await enterList()
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Szett hozzáadása'))
  await user.click(await screen.findByText('Csak ma'))
  await new Promise((r) => setTimeout(r, 0))
  expect(puts).toHaveLength(0)
})

// --- done-day gating: the session route redirects to the review (mezo-cd8s) ---
// A completed today instance with nothing open means the workout is over; the session
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
        <TutorialProvider>
          <LevelUpProvider>
            <Routes>
              <Route path="/train/session" element={<ActiveWorkoutPage />} />
              <Route path="/train/review/:workoutId" element={<div>REVIEW PROBE</div>} />
            </Routes>
          </LevelUpProvider>
        </TutorialProvider>
      </MemoryRouter>
    </QueryWrapper>,
  )
  expect(await screen.findByText('REVIEW PROBE')).toBeInTheDocument()
  expect(screen.queryByText(/Kezdjük el/)).toBeNull()
})

// --- meso-less custom (saját) workout: getToday is meso-independent (D4, final-review
// fix, mezo-ws2x — Finding 1). No active meso must NOT bounce a custom day's session. ---
test('real mode: a custom workout with NO active meso renders the card list instead of redirecting', async () => {
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
        <TutorialProvider>
          <LevelUpProvider>
            <ActiveWorkoutPage />
          </LevelUpProvider>
        </TutorialProvider>
      </MemoryRouter>
    </QueryWrapper>,
  )
  expect((await screen.findAllByText('Saját HIIT')).length).toBeGreaterThan(0)
  expect(document.querySelector('.wo-list')).not.toBeNull()
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
    // Neither the card list nor a redirect content rendered yet.
    expect(document.querySelector('.wo-list')).toBeNull()
  })
})

describe('ActiveWorkoutPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())
  it('renders content with no skeleton (synchronous seed)', () => {
    setup()
    // The dock is itself a role="status" region, so assert the SKELETON is absent.
    expect(screen.queryByLabelText('Betöltés…')).toBeNull()
    expect(document.querySelector('.wo-list')).not.toBeNull()
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
  // The card list's ⋯ menu -> the Küldetések glass (mezo-e1ii9).
  await enterList()
  await openChallenges(user)
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
  await enterList()
  await openChallenges(user)
  await user.click(await screen.findByText('⚔️ Elfogadom'))
  await waitFor(() => expect(calls).toContain('decide:chal-1:accept'))
})

// The dismiss half of `decide` (mezo-e1ii9): the prep tile was its ONLY reachable home —
// it must stay reachable from the glass that inherited it.
test('real mode: clicking "Passz" POSTs a dismiss decision for the challenge', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useChallengeHandlers([challengeWire({ status: 'accepted' })], calls)
  const user = userEvent.setup()
  setup()
  await enterList()
  await openChallenges(user)
  // An ACCEPTED challenge's chip toggles back off — that is the dismiss decision
  // (`ChallengeCard`'s separate "Passz" button only shows while undecided and is inert).
  await user.click(await screen.findByText('Elfogadva'))
  await waitFor(() => expect(calls).toContain('decide:chal-1:dismiss'))
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
  await enterList()
  await openChallenges(user)
  expect(await screen.findByText('✓ Megerősítve')).toBeInTheDocument()
  expect(screen.getByText('110 kg × 8 — cél igazolva (+2.5 kg)')).toBeInTheDocument()
  // the workout is decided → the accept/skip row is hidden
  expect(screen.queryByText('⚔️ Elfogadom')).not.toBeInTheDocument()
  expect(screen.queryByText('Elfogadva')).not.toBeInTheDocument()
})

test('a logged working set shows its RIR in the row\'s own RIR cell', async () => {
  const user = userEvent.setup()
  setup()
  // ex1 has 2 warmups first: log 3 sets so ONE working set (index 2) is done.
  await logSet(user)
  await logSet(user)
  // the current (3rd) slot is a working one — pick RIR 1, then log it
  await user.click(within(card(EX1)).getByRole('button', { name: 'RIR 1' }))
  await user.click(submitOf(EX1))
  const workingRow = within(card(EX1)).getAllByRole('button', { name: /working szett szerkesztése/ })[0]
  expect(workingRow.getAttribute('aria-label')).toContain('RIR 1')
})

// ---- T6 Task 5: the per-card records glass (előzmények és rekordok) ----

test('mock mode: the records button opens the records glass for THAT card, matched by name', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(within(card(EX1)).getByRole('button', { name: `${EX1} · előzmények és rekordok` }))
  const dialog = screen.getByRole('dialog', { name: `${EX1} előzményei és rekordjai` })
  // Chest Supported Row's mock fixture (train.ts exerciseRecordsMock) carries a real bestE1rm.
  expect(within(dialog).getByText('140 kg')).toBeInTheDocument()
  expect(within(dialog).getByText('BECSÜLT 1RM')).toBeInTheDocument()
})

test('mock mode: Bezárás closes the records glass', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(within(card(EX1)).getByRole('button', { name: `${EX1} · előzmények és rekordok` }))
  expect(document.querySelector('.gl-card')).not.toBeNull()
  await user.click(screen.getByRole('button', { name: 'Bezárás' }))
  expect(document.querySelector('.gl-card')).toBeNull()
})

test('real mode: no matching record (never logged before) shows em dashes, not zeros', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(REAL_TODAY, calls)
  server.use(http.get(`${API_BASE}/api/train/exercise-records`, () => HttpResponse.json([])))
  const user = userEvent.setup()
  setup()
  await enterList()
  await user.click(within(card(EX1)).getByRole('button', { name: `${EX1} · előzmények és rekordok` }))
  const dialog = screen.getByRole('dialog', { name: `${EX1} előzményei és rekordjai` })
  expect(within(dialog).getAllByText('—').length).toBeGreaterThanOrEqual(2)
  expect(within(dialog).queryByText(/0 kg/)).not.toBeInTheDocument()
})

// ---- set edit + slot delete (mezo-l3on) ----

/** The card's row buttons carry the row's own label; the first is always B1 on ex1. */
const firstRow = () => doneRowsOf(EX1)[0]
test('mock mode: a logged set row opens the edit sheet, and saving rewrites the row', async () => {
  const user = userEvent.setup()
  setup()
  await logSet(user) // B1: prescribed 52.5 kg × 8

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
  // B1 is a warmup — the mock evaluator never scores warmup-kind sets (isWorking gate in
  // trainHooks.ts), so this log earns NO medal at all. Regression guard for the headline
  // judgement call (attachSetId must run before the `!medals.length` early return): if that
  // ordering ever regresses, the row would stay disabled forever (C2's fix below).
  await logSet(user)
  await waitFor(() => expect(firstRow()).not.toBeDisabled())
  await user.click(firstRow())
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

// Pending slots are inert in the card idiom (only the cursor row takes input), so the
// slot-delete path now runs through an already-LOGGED row's edit sheet. Removing a
// still-pending slot moves to the per-card ⋮ menu ("Szett elvétele") in T6 Task 4.
test('mock mode: deleting a logged set drops one slot from the exercise', async () => {
  const user = userEvent.setup()
  setup()
  expect(rowsOf(EX1)).toHaveLength(5)
  await logSet(user) // B1 (52,5 × 8)

  await user.click(firstRow())
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Szett törlése' }))

  await waitFor(() => expect(rowsOf(EX1)).toHaveLength(4))
  // Fix round 1 (C1(a) / I3): discriminate WHICH slot was removed. Deleting the logged
  // B1 warmup must leave exactly ONE warmup slot behind and all three working slots
  // intact — not silently swallow a working slot while both warmups survive. The
  // prescription shifts in lock-step, so the surviving warmup re-labels to B1.
  const idx = Array.from(card(EX1).querySelectorAll('.wo-idx')).map((n) => n.textContent)
  expect(idx).toEqual(['B1', '1', '2', '3'])
  expect(doneRowsOf(EX1)).toHaveLength(0) // its logged entry went with it
})

test('mock mode: deleting a logged set never takes the exercise below one slot', async () => {
  const user = userEvent.setup()
  setup()
  // Log 4 of ex1's 5 planned sets, then delete them one at a time: each delete drops
  // both the entry and its slot (5→4→3→2→1), stopping at the model's one-slot floor.
  for (let i = 0; i < 4; i++) await logSet(user)
  for (let i = 0; i < 4; i++) {
    await user.click(firstRow())
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Szett törlése' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  }
  expect(rowsOf(EX1)).toHaveLength(1)
  // Nothing is logged anymore, so the single surviving slot is the card's editable row —
  // there is no done row left to delete from (the floor holds).
  expect(doneRowsOf(EX1)).toHaveLength(0)
  expect(querySubmitOf(EX1)).not.toBeNull()
})

// ============================================================
// Titanium card list (mezo-88iwa.7, T6 Task 3) — structural guards for the face
// that replaced the calm one-exercise execution card: one `.wo-list`, a card per
// exercise, the reference content (progression / note / cue) INSIDE its own card
// instead of in page-level collapsible strips.
// ============================================================

test('the active phase is ONE list of cards — no collapsible reference strips, no execution card', async () => {
  const { container } = setup()
  expect(container.querySelectorAll('.wo-list')).toHaveLength(1)
  expect(container.querySelectorAll('.wo-card')).toHaveLength(5)
  expect(container.querySelector('.excard')).toBeNull()
  expect(container.querySelector('.wkx-logbox')).toBeNull()
  expect(container.querySelectorAll('.mz-colstrip')).toHaveLength(0)
})

test('each card carries its own progression banner — the reference content is per exercise', async () => {
  setup()
  // ex1 has a progression signal (+2,5 kg), so its card shows the banner, not the cue.
  const banner = card(EX1).querySelector('.pobanner') as HTMLElement
  expect(within(banner).getByText('⚡ Progresszió')).toBeInTheDocument()
  expect(within(banner).getByText('+2,5 kg ↑')).toBeInTheDocument()
  expect(card(EX1).querySelector('.wo-cue')).toBeNull()
})

test('a fully logged exercise reads as complete and offers no editable row', async () => {
  const user = userEvent.setup()
  setup()
  await completeExerciseSets(user)
  await user.click(screen.getByText('Hagyjuk')) // dismiss the debrief
  await waitFor(() => expect(card(EX1)).toHaveClass('is-complete'))
  expect(querySubmitOf(EX1)).toBeNull()
  expect(doneRowsOf(EX1)).toHaveLength(5)
})

// Fix wave I5: a logged row's ✓ is a plain span (it is not a pressable control, so it
// cannot carry `aria-pressed`) — it therefore never picked up the filled "pressed" look
// and a done row read as un-done. `.is-checked` is the span's half of that CSS rule.
test('a done row\'s ✓ carries is-checked so it reads as filled, like a pressed tick', async () => {
  const user = userEvent.setup()
  setup()
  await logSet(user)
  const tick = doneRowsOf(EX1)[0].querySelector('.wo-check') as HTMLElement
  expect(tick).toHaveClass('is-checked')
  // The cursor row's ✓ is the pressable submit and stays unchecked.
  expect(submitOf(EX1)).not.toHaveClass('is-checked')
})

// Fix wave M3: the dock's "n / m szett" ran over ALL exercises while the finish CTA's
// state came from pendingSetCount, which SKIPS excluded exercises — so a session with a
// skipped exercise showed unfinished-looking numbers beside a "nothing left" CTA.
test('the dock\'s denominator drops when an exercise is skipped (same count as the finish CTA)', async () => {
  const user = userEvent.setup()
  setup()
  // Mock Pull Day: 5 exercises, 21 planned sets in total; ex1 alone plans 5.
  const denominator = () => document.querySelector('.wo-dock-copy strong')!.textContent
  const before = denominator()!
  const beforeTotal = Number(before.split(' / ')[1].replace(' szett', ''))
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Gyakorlat kihagyása'))
  await waitFor(() => expect(card(EX1)).toHaveClass('is-skipped'))
  const afterTotal = Number(denominator()!.split(' / ')[1].replace(' szett', ''))
  expect(afterTotal).toBe(beforeTotal - 5)
})
