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

test('advertises the frozen report when the run has one — a plain state stamp, no arrow', () => {
  render(<ArchivedMesoCard meso={meso()} onOpen={() => {}} onRerun={() => {}} onSaveAsTemplate={() => {}} />)
  expect(screen.getByText('riport')).toBeInTheDocument()
  expect(screen.queryByText('riport →')).toBeNull()
  expect(screen.queryByText('nincs riport')).toBeNull()
})

test('says so honestly when the closed run carries NO report', () => {
  render(<ArchivedMesoCard meso={meso({ hasReport: false })} onOpen={() => {}} onRerun={() => {}} onSaveAsTemplate={() => {}} />)
  expect(screen.getByText('nincs riport')).toBeInTheDocument()
  expect(screen.queryByText('riport')).toBeNull()
})

test('the eyebrow shows the actual closedAt, not the plan endDate, when the two differ', () => {
  // endDate is the PLANNED window; closedAt is when the run was actually archived —
  // deliberately different months here to prove the eyebrow reads the real close date.
  render(
    <ArchivedMesoCard
      meso={meso({ endDate: 'Márc 30', closedAt: '2026-04-23T19:40:00Z' })}
      onOpen={() => {}}
      onRerun={() => {}} onSaveAsTemplate={() => {}}
    />,
  )
  expect(screen.getByText('Archív · Ápr 23')).toBeInTheDocument()
  expect(screen.queryByText('Archív · Márc 30')).toBeNull()
})

test('falls back to endDate for a legacy run with no closedAt at all', () => {
  const { closedAt: _drop, ...legacy } = meso({ endDate: 'Márc 30' })
  render(<ArchivedMesoCard meso={legacy as Mesocycle} onOpen={() => {}} onRerun={() => {}} onSaveAsTemplate={() => {}} />)
  expect(screen.getByText('Archív · Márc 30')).toBeInTheDocument()
})

test('a legacy run with no hasReport flag at all reads as "no report"', () => {
  const { hasReport: _drop, ...legacy } = meso()
  render(<ArchivedMesoCard meso={legacy as Mesocycle} onOpen={() => {}} onRerun={() => {}} onSaveAsTemplate={() => {}} />)
  expect(screen.getByText('nincs riport')).toBeInTheDocument()
})

test('outside selection mode the body opens the report and the rerun action is offered', async () => {
  const user = userEvent.setup()
  const onOpen = vi.fn()
  const onRerun = vi.fn()
  render(<ArchivedMesoCard meso={meso()} onOpen={onOpen} onRerun={onRerun} onSaveAsTemplate={() => {}} />)

  const body = screen.getByRole('button', { name: /Recovery rebuild · Tél/ })
  expect(body).not.toHaveAttribute('aria-pressed')
  await user.click(body)
  expect(onOpen).toHaveBeenCalledTimes(1)

  await user.click(screen.getByRole('button', { name: /Újrafuttatás/ }))
  expect(onRerun).toHaveBeenCalledTimes(1)
})

test('in selection mode the body is a pressed-state toggle and BOTH actions step aside', async () => {
  const user = userEvent.setup()
  const onOpen = vi.fn()
  render(<ArchivedMesoCard meso={meso()} onOpen={onOpen} onRerun={() => {}} onSaveAsTemplate={() => {}} selectMode selected />)

  const body = screen.getByRole('button', { name: /Recovery rebuild · Tél/ })
  expect(body).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByRole('button', { name: /Újrafuttatás/ })).toBeNull()
  expect(screen.queryByRole('button', { name: /Sablonná/ })).toBeNull()

  await user.click(body)
  expect(onOpen).toHaveBeenCalledTimes(1)
})

test('the Sablonná action hands the closed run back to the parent (mezo-tlwa)', async () => {
  const user = userEvent.setup()
  const onSaveAsTemplate = vi.fn()
  render(
    <ArchivedMesoCard meso={meso()} onOpen={() => {}} onRerun={() => {}} onSaveAsTemplate={onSaveAsTemplate} />,
  )
  await user.click(screen.getByRole('button', { name: /Sablonná/ }))
  expect(onSaveAsTemplate).toHaveBeenCalledTimes(1)
})
