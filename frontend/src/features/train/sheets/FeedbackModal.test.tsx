import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { LoggedWorkoutExercise } from '@/data/types'
import { FeedbackModal } from '@/features/train/sheets/FeedbackModal'

// FeedbackModal — the debrief after an exercise's last set. Folyadék F4 (mezo-n4wf5.4; owner, round 1 — prototype
// vilagos/edzes.js `rp`): the answers are small vessels, the pain scale in ok / warn / bad, a dashed „pont jó" line
// on the third question, one note line.

const EX: LoggedWorkoutExercise = {
  id: 'e-1', name: 'Húzódzkodás (súlyozott)', warmupSets: 0, workingSets: 4, repMin: 8, repMax: 10, targetRIR: 2,
  anchorWeightKg: null, type: 'compound', muscle: 'back-mid', sets: 4, prescribedSets: null, rationale: null, lastWeek: null,
}

const group = (name: string) => within(screen.getByRole('group', { name }))
const pressed = (name: string) => group(name).getAllByRole('button').map((b) => b.getAttribute('aria-pressed') === 'true')

test('a light sheet: „Gyakorlat kész · hogy ment?" over the exercise, three questions as vessels with the defaults pressed', () => {
  render(<FeedbackModal ex={EX} isLastExercise={false} onResolve={() => {}} />)
  const dialog = screen.getByRole('dialog', { name: 'Húzódzkodás (súlyozott)' })
  expect(dialog).toHaveClass('fo-sheet')
  expect(dialog.querySelector('[class*="wos-"], [class*="wo-"]')).toBeNull()
  expect(within(dialog).getByText('Gyakorlat kész · hogy ment?')).toBeInTheDocument()
  expect(dialog.querySelectorAll('.fo-vo')).toHaveLength(3)
  expect(group('Pumpa · érzed?').getAllByRole('button').map((b) => b.textContent)).toEqual(['Semmi', 'Enyhe', 'Jó', 'Brutális'])
  expect(group('Ízületi fájdalom').getAllByRole('button').map((b) => b.textContent)).toEqual(['Nincs', 'Enyhe', 'Erős'])
  expect(group('Akarunk még?').getAllByRole('button').map((b) => b.textContent)).toEqual(['Kevés volt', 'Pont jó', 'Sok volt'])
  expect(pressed('Pumpa · érzed?')).toEqual([false, false, true, false])
  expect(pressed('Ízületi fájdalom')).toEqual([true, false, false])
  expect(pressed('Akarunk még?')).toEqual([false, true, false])
  // the old English labels are gone
  expect(within(dialog).queryByText(/Joint pain|Set debrief|RP feedback/)).not.toBeInTheDocument()
})

test('the level is what the answer means: pain wears ok / warn / bad, and only the third question has the „pont jó" line', () => {
  render(<FeedbackModal ex={EX} isLastExercise={false} onResolve={() => {}} />)
  const style = (name: string) => group(name).getAllByRole('button').map((b) => [b.style.getPropertyValue('--p'), b.style.getPropertyValue('--c')])
  expect(style('Pumpa · érzed?').map(([p]) => p)).toEqual(['5%', '36%', '68%', '100%'])
  expect(style('Ízületi fájdalom')).toEqual([['5%', 'var(--fo-ok)'], ['50%', 'var(--fo-warn)'], ['100%', 'var(--fo-bad)']])
  expect(style('Akarunk még?').map(([p]) => p)).toEqual(['34%', '64%', '100%'])
  const lines = (name: string) => screen.getByRole('group', { name }).querySelectorAll('.v > u')
  expect(lines('Pumpa · érzed?')).toHaveLength(0)
  expect(lines('Ízületi fájdalom')).toHaveLength(0)
  expect(lines('Akarunk még?')).toHaveLength(3)
  expect((lines('Akarunk még?')[0] as HTMLElement).style.bottom).toBe('64%')
  expect(screen.getAllByText(/Az edény annyira telik, amennyit a válasz jelent\./)).toHaveLength(1)
})

test('save reports the picked answers on 1-based scales, then resolves once', async () => {
  const user = userEvent.setup()
  const onSave = vi.fn()
  const onResolve = vi.fn()
  render(<FeedbackModal ex={EX} isLastExercise={false} onResolve={onResolve} onSave={onSave} />)
  await user.click(group('Pumpa · érzed?').getByRole('button', { name: 'Brutális' }))
  await user.click(group('Ízületi fájdalom').getByRole('button', { name: 'Enyhe' }))
  await user.click(group('Akarunk még?').getByRole('button', { name: 'Sok volt' }))
  expect(pressed('Pumpa · érzed?')).toEqual([false, false, false, true])
  await user.click(screen.getByRole('button', { name: 'Mentés · tovább' }))
  expect(onSave).toHaveBeenCalledWith({ pump: 4, jointPain: 2, workload: 3 })
  await waitFor(() => expect(onResolve).toHaveBeenCalledTimes(1))
})

test('untouched, save reports the defaults (3 / 1 / 2)', async () => {
  const onSave = vi.fn()
  render(<FeedbackModal ex={EX} isLastExercise={false} onResolve={() => {}} onSave={onSave} />)
  await userEvent.click(screen.getByRole('button', { name: 'Mentés · tovább' }))
  expect(onSave).toHaveBeenCalledWith({ pump: 3, jointPain: 1, workload: 2 })
})

test('„Hagyjuk" and the × resolve without saving — exactly once', async () => {
  const user = userEvent.setup()
  const onSave = vi.fn()
  const onResolve = vi.fn()
  render(<FeedbackModal ex={EX} isLastExercise={false} onResolve={onResolve} onSave={onSave} />)
  await user.click(screen.getByRole('button', { name: 'Hagyjuk' }))
  await user.click(screen.getByRole('button', { name: 'Bezárás' }))
  await waitFor(() => expect(onResolve).toHaveBeenCalledTimes(1))
  expect(onSave).not.toHaveBeenCalled()
})

test('on the last exercise the primary reads „Edzés vége" (no arrow)', () => {
  render(<FeedbackModal ex={EX} isLastExercise onResolve={() => {}} />)
  expect(screen.getByRole('button', { name: 'Edzés vége' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Mentés · tovább' })).not.toBeInTheDocument()
})
