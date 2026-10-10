import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CheckInSheet } from '@/features/today/sheets/CheckInSheet'
import { initialCheckins } from '@/data/today/checkins'
import { QueryWrapper } from '@/test/queryWrapper'
import type { CheckinSlot } from '@/data/types'

// Check-in 2.0 (mezo-ck2) — the flow of prototypes/elo/nap.html `SH.checkin`, in the Folyadék look
// (mezo-n4wf5.2, prototypes/vilagos/nap.js `ckSheet()`): the kit's light sheet, `Dots`, the ten
// vials of `Scale` (a radio group), `Pill`s, and the summary as rows with a level. The plan is
// the server config in real mode (MSW serves the mirrored config) and the mirror in mock mode,
// so these flows hold in both.

const slotAt = (time: string, state: CheckinSlot['state'] = 'now'): CheckinSlot => ({ time, state, values: null, note: null })

function renderSheet(slot: CheckinSlot, onSave = vi.fn(), onClose = vi.fn(), slotIdx = 2) {
  render(
    <QueryWrapper>
      <CheckInSheet slot={slot} slotIdx={slotIdx} onClose={onClose} onSave={onSave} />
    </QueryWrapper>,
  )
  return { onSave, onClose }
}

const stepLabel = () => document.querySelector('.nck2-stepl')?.textContent ?? ''
/** One of the ten vials of the scale on screen (the kit's `Scale`: a radio group). */
const vial = (n: number) => screen.getByRole('radio', { name: String(n) })
/** Tap a scale value and wait for the 200 ms auto-advance to land on the next step. */
async function tap(n: number) {
  const before = stepLabel()
  await userEvent.click(vial(n))
  await vi.waitFor(() => expect(stepLabel()).not.toBe(before))
}
const skip = () => userEvent.click(screen.getByRole('button', { name: /Kihagyom/ }))
const summary = () => screen.findByText(/Mentés · /)

test('the full morning: 10 steps (plan + question of the day), pain Igen, nothing pre-selected', async () => {
  const { onSave, onClose } = renderSheet(slotAt('06:30'), undefined, undefined, 0)
  expect(await screen.findByRole('heading', { name: 'Hogy vagy?' })).toBeInTheDocument()
  expect(screen.getByText('Check-in · Reggel · 06:30')).toBeInTheDocument()
  // the light Folyadék sheet, no glass
  expect(document.querySelector('.sheet.fo-sheet')).not.toBeNull()
  expect(document.querySelector('.glass')).toBeNull()
  expect(await screen.findByText('01 / 10 · Energia · alap')).toBeInTheDocument()
  expect(screen.getByText('Mennyi energia van benned most?')).toBeInTheDocument()
  // eleven progress segments: ten steps + the summary
  expect(document.querySelectorAll('.fo-dots i')).toHaveLength(11)
  // the first is the current step, the next four are the rest of the core
  expect(document.querySelectorAll('.fo-dots i.on')).toHaveLength(1)
  expect(document.querySelectorAll('.fo-dots i.core')).toHaveLength(4)
  // nothing pre-selected: the numeral is the „–" placeholder, no cell is active
  expect(screen.getByTestId('ck-value')).toHaveTextContent('–')
  expect(screen.queryByRole('radio', { checked: true })).toBeNull()
  // the answer is a jar you fill, the item's icon sits in its chip
  expect(document.querySelector('.nck2-bigrow .fo-jar')).not.toBeNull()
  expect(document.querySelector('.nck2-bigrow .fo-bub use')?.getAttribute('href')).toBe('#t-bolt')

  await tap(7) // energy
  expect(stepLabel()).toBe('02 / 10 · Hangulat · alap')
  // the next step starts empty again
  expect(screen.getByTestId('ck-value')).toHaveTextContent('–')
  await tap(8) // mood
  await tap(3) // stress
  await tap(6) // body
  await tap(7) // mental
  expect(stepLabel()).toBe('06 / 10 · Kipihentség · Reggel')
  expect(screen.getByText('Az alap megvan. Innen bármikor kiléphetsz.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Most csak ennyi' })).toBeInTheDocument()
  await tap(6) // rested
  expect(screen.queryByText('Az alap megvan. Innen bármikor kiléphetsz.')).not.toBeInTheDocument()
  await tap(5) // soreness
  expect(stepLabel()).toBe('08 / 10 · Fájdalom · Reggel')
  expect(screen.getByText('Fáj valami?')).toBeInTheDocument()

  // pain: Igen → figure + chips + intensity; Tovább waits for a region AND an intensity
  await userEvent.click(screen.getByRole('button', { name: 'Igen' }))
  expect(screen.getByText(/Hol fáj\?/i)).toBeInTheDocument()
  expect(screen.getByText('ELÖL')).toBeInTheDocument()
  expect(screen.getByText('HÁTUL')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Egyéb' })).toBeInTheDocument()
  const next = screen.getByRole('button', { name: /Tovább/ })
  expect(next).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Térd' }))
  expect(next).toBeDisabled()
  // the figure's knee dot lit with the chip
  expect(document.querySelector('.nck2-dot.on[data-region="TERD"]')).not.toBeNull()
  // a figure tap toggles a region too (back view: Derék)
  fireEvent.click(document.querySelector('.nck2-dot[data-region="DEREK"]')!)
  expect(screen.getByRole('button', { name: 'Derék' })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(vial(4))
  expect(screen.getByText(/Mennyire fáj · 4 \/ 10/i)).toBeInTheDocument()
  expect(next).toBeEnabled()
  await userEvent.click(next)
  expect(stepLabel()).toBe('09 / 10 · Motiváció · Reggel')
  await tap(8) // motivation

  // the question of the day: its own tag and the why callout, no daypart tag
  expect(stepLabel()).toBe('10 / 10 · Éhség · a nap kérdése')
  expect(document.querySelector('.fo-why')).toHaveTextContent('A nap kérdése.')
  expect(screen.getByText('Most azt figyeljük, összefügg-e a reggeli éhséged a tegnapi vacsorával.')).toBeInTheDocument()
  await tap(5) // hunger → summary

  await summary()
  const cells = document.querySelectorAll('.nck2-sum .fo-row')
  expect(cells).toHaveLength(10)
  expect(within(cells[7] as HTMLElement).getByText('Térd, Derék · 4/10')).toBeInTheDocument()
  expect(within(cells[9] as HTMLElement).getByText(/a nap kérdése/)).toBeInTheDocument()
  expect(cells[9]).toHaveClass('is-ad')
  expect(cells[0].querySelector('use')?.getAttribute('href')).toBe('#t-bolt')
  expect(cells[1].querySelector('use')?.getAttribute('href')).toBe('#t-mood')
  // every row carries its answer as a level: energy 7 → 70 %, a reported pain in the warn colour
  expect((cells[0].querySelector('.fo-level i') as HTMLElement).style.width).toBe('70%')
  expect((cells[7].querySelector('.fo-level') as HTMLElement).style.getPropertyValue('--c')).toBe('var(--fo-warn)')

  await userEvent.click(screen.getByRole('button', { name: /Mentés · 06:30/ }))
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
  const saved = onSave.mock.calls[0][0]
  expect(saved).toMatchObject({
    state: 'done',
    values: {
      energy: 7, mood: 8, stress: 3, body: 6, mental: 7, rested: 6, soreness: 5,
      pain: { regions: ['TERD', 'DEREK'], intensity: 4 }, motivation: 8, hunger: 5,
    },
    askedItems: ['energy', 'mood', 'stress', 'body', 'mental', 'rested', 'soreness', 'pain', 'motivation', 'hunger'],
    adaptiveItem: 'hunger',
    adaptiveReason: 'NEED',
    quickExit: false,
  })
})

test('the afternoon quick exit after the core five saves only what was asked', async () => {
  const { onSave } = renderSheet(slotAt('14:00'))
  expect(await screen.findByText('01 / 09 · Energia · alap')).toBeInTheDocument()
  // „Most csak ennyi" only from the sixth step
  expect(screen.queryByRole('button', { name: 'Most csak ennyi' })).not.toBeInTheDocument()
  await tap(6)
  await tap(7)
  await skip() // stress → skipped (NULL)
  await tap(5)
  await tap(6)
  expect(stepLabel()).toBe('06 / 09 · Éhség · Délután')
  await userEvent.click(screen.getByRole('button', { name: 'Most csak ennyi' }))

  await summary()
  expect(screen.getByText('Az alap megvan. A többi kérdés üres marad, a check-in így is beszámít.')).toBeInTheDocument()
  // skipped reads „kihagyva", not reached reads „üres"
  expect(screen.getAllByText('kihagyva')).toHaveLength(1)
  expect(screen.getAllByText('üres')).toHaveLength(4)

  await userEvent.click(screen.getByRole('button', { name: /Mentés · 14:00/ }))
  await vi.waitFor(() => expect(onSave).toHaveBeenCalled())
  const saved = onSave.mock.calls[0][0]
  expect(saved.quickExit).toBe(true)
  expect(saved.askedItems).toEqual(['energy', 'mood', 'stress', 'body', 'mental'])
  expect(saved.values).toEqual({ energy: 6, mood: 7, stress: null, body: 5, mental: 6 })
  // never a default: nothing un-asked carries a value
  expect(saved.values).not.toHaveProperty('hunger')
})

test('the evening: craving ≥ 4 asks what, pain „Nem" answers and advances', async () => {
  const { onSave } = renderSheet(slotAt('20:00'), undefined, undefined, 3)
  expect(await screen.findByText('01 / 12 · Energia · alap')).toBeInTheDocument()
  for (let i = 0; i < 5; i++) await tap(7)
  await tap(3) // soreness
  expect(stepLabel()).toBe('07 / 12 · Fájdalom · Este')
  await userEvent.click(screen.getByRole('button', { name: 'Nem' }))
  await vi.waitFor(() => expect(stepLabel()).toBe('08 / 12 · Sóvárgás · Este'))

  // craving from 4: the kinds + its own Tovább, no auto-advance
  await userEvent.click(vial(6))
  expect(screen.getByText(/Mit kívánsz\?/i)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Édes' }))
  await userEvent.click(screen.getByRole('button', { name: 'Sós' }))
  expect(stepLabel()).toBe('08 / 12 · Sóvárgás · Este')
  await userEvent.click(screen.getByRole('button', { name: /Tovább/ }))
  expect(stepLabel()).toBe('09 / 12 · Emésztés · Este')
  await tap(8) // digestion
  await tap(9) // connection
  expect(stepLabel()).toBe('11 / 12 · A nap mérlege · Este')
  await tap(7) // day
  expect(stepLabel()).toBe('12 / 12 · Motiváció · a nap kérdése')
  await skip() // the question of the day skipped

  await summary()
  expect(screen.getByText('6 · Édes, Sós')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Mentés · 20:00/ }))
  await vi.waitFor(() => expect(onSave).toHaveBeenCalled())
  const saved = onSave.mock.calls[0][0]
  expect(saved.values).toMatchObject({
    soreness: 3, pain: false, craving: { value: 6, kinds: ['EDES', 'SOS'] }, digestion: 8, connection: 9, day: 7, motivation: null,
  })
  expect(saved.askedItems).toHaveLength(12)
  expect(saved.quickExit).toBe(false)
})

test('a craving below 4 answers and advances like any scale', async () => {
  renderSheet(slotAt('14:00'))
  await screen.findByText('01 / 09 · Energia · alap')
  for (let i = 0; i < 6; i++) await tap(5)
  expect(stepLabel()).toBe('07 / 09 · Sóvárgás · Délután')
  await tap(2)
  expect(stepLabel()).toBe('08 / 09 · Emésztés · Délután')
})

test('a summary cell jumps back to its step', async () => {
  renderSheet(slotAt('10:00'), undefined, undefined, 1)
  await screen.findByText('01 / 08 · Energia · alap')
  for (let i = 0; i < 8; i++) await skip()
  await summary()
  await userEvent.click(screen.getAllByRole('button', { name: /Stressz/ })[0])
  expect(stepLabel()).toBe('03 / 08 · Stressz · alap')
})

test('saves a long check-in note without truncating it', async () => {
  const { onSave } = renderSheet(initialCheckins[2])
  await screen.findByText(/01 \//)
  while (!screen.queryByText(/Mentés · /)) await skip()
  const note = 'Hosszabb gondolat a mai napról. '.repeat(100)
  const input = screen.getByRole('textbox')
  fireEvent.change(input, { target: { value: note } })
  expect(input).toHaveValue(note)
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  await vi.waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ note: note.trim() })))
})

test('keeps the note and allows retry when persistence fails', async () => {
  const onSave = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined)
  const { onClose } = renderSheet(initialCheckins[2], onSave)
  await screen.findByText(/01 \//)
  while (!screen.queryByText(/Mentés · /)) await skip()
  const note = 'Megőrzendő hosszú gondolat. '.repeat(100)
  fireEvent.change(screen.getByRole('textbox'), { target: { value: note } })
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent('A mentés nem sikerült. A szöveged megmaradt, próbáld újra.')
  expect(screen.getByRole('textbox')).toHaveValue(note)
  expect(onClose).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave).toHaveBeenCalledTimes(2)
  expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ note: note.trim() }))
})

test('summary does not fabricate past observations or changed training targets', async () => {
  renderSheet({ ...initialCheckins[2], values: { energy: 8, stress: 4, body: 7, mental: 8 } })
  await screen.findByText(/01 \//)
  while (!screen.queryByText(/Mentés · /)) await skip()
  expect(screen.queryByText(/107.5kg|múlt kedden|3. nap a héten/)).not.toBeInTheDocument()
})
