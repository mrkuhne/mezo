import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { ArchivedMesoCard } from '@/features/train/components/ArchivedMesoCard'
import type { Mesocycle } from '@/data/types'

const meso = (over: Partial<Mesocycle> = {}): Mesocycle => ({
  id: 'm1', status: 'archived', title: 'Recovery rebuild · Tél', shortTitle: 'Recovery 03',
  goal: 'Regeneráció', startDate: 'Feb 12', endDate: 'Ápr 23', weeks: 8, currentWeek: 8,
  split: 'PPL', style: 'RP · 8 hét', phaseCurve: ['MEV'], summary: '8/10 — stabil.',
  closedAt: '2026-04-23T19:40:00Z', hasReport: true,
  ...over,
})

test('advertises the frozen report when the run has one', () => {
  render(<ArchivedMesoCard meso={meso()} onOpen={() => {}} onRerun={() => {}} />)
  expect(screen.getByText('riport →')).toBeInTheDocument()
  expect(screen.queryByText('nincs riport')).toBeNull()
})

test('says so honestly when the closed run carries NO report', () => {
  render(<ArchivedMesoCard meso={meso({ hasReport: false })} onOpen={() => {}} onRerun={() => {}} />)
  expect(screen.getByText('nincs riport')).toBeInTheDocument()
  expect(screen.queryByText('riport →')).toBeNull()
})

test('a legacy run with no hasReport flag at all reads as "no report"', () => {
  const { hasReport: _drop, ...legacy } = meso()
  render(<ArchivedMesoCard meso={legacy as Mesocycle} onOpen={() => {}} onRerun={() => {}} />)
  expect(screen.getByText('nincs riport')).toBeInTheDocument()
})

test('outside selection mode the body opens the report and the rerun action is offered', async () => {
  const user = userEvent.setup()
  const onOpen = vi.fn()
  const onRerun = vi.fn()
  render(<ArchivedMesoCard meso={meso()} onOpen={onOpen} onRerun={onRerun} />)

  const body = screen.getByRole('button', { name: /Recovery rebuild · Tél/ })
  expect(body).not.toHaveAttribute('aria-pressed')
  await user.click(body)
  expect(onOpen).toHaveBeenCalledTimes(1)

  await user.click(screen.getByRole('button', { name: /Újrafuttatás/ }))
  expect(onRerun).toHaveBeenCalledTimes(1)
})

test('in selection mode the body is a pressed-state toggle and the rerun action steps aside', async () => {
  const user = userEvent.setup()
  const onOpen = vi.fn()
  render(<ArchivedMesoCard meso={meso()} onOpen={onOpen} onRerun={() => {}} selectMode selected />)

  const body = screen.getByRole('button', { name: /Recovery rebuild · Tél/ })
  expect(body).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByRole('button', { name: /Újrafuttatás/ })).toBeNull()

  await user.click(body)
  expect(onOpen).toHaveBeenCalledTimes(1)
})
