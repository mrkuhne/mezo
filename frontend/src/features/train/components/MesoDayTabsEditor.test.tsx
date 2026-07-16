import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { MesoDay } from '@/data/types'
import { MesoDayTabsEditor, isOffDay } from '@/features/train/components/MesoDayTabsEditor'

const ex = (id: string, name: string) => ({
  id, name, muscle: 'chest', warmupSets: 2, workingSets: 3, repMin: 6, repMax: 8,
  targetRIR: 0, type: 'compound' as const,
})
const DAYS: MesoDay[] = [
  { day: 'Hét', type: 'Push', muscle: 'chest', exerciseCount: 2, exercises: [ex('a', 'Bench Press'), ex('b', 'Lateral Raise')] },
  { day: 'Kedd', type: 'Rest', muscle: '', exerciseCount: 0, exercises: [], note: 'Pihenőnap' },
  { day: 'Sze', type: 'Pull', muscle: 'back', exerciseCount: 1, current: true, exercises: [ex('c', 'Row')] },
  { day: 'Csü', type: 'Volleyball · meccs', muscle: 'sport', exerciseCount: 0, exercises: [] },
]
const noop = { onAddClick: vi.fn(), onRemove: vi.fn(), onChange: vi.fn(), onReorder: vi.fn() }

test('isOffDay is muscle-based', () => {
  expect(isOffDay({ muscle: '' })).toBe(true)
  expect(isOffDay({ muscle: 'sport' })).toBe(true)
  expect(isOffDay({ muscle: 'chest' })).toBe(false)
  expect(isOffDay({ muscle: 'custom' })).toBe(false)
})

test('defaults to the current day and switches on tab tap', async () => {
  render(<MesoDayTabsEditor days={DAYS} {...noop} />)
  // current day (Sze · Pull) is active → its exercise shows
  expect(screen.getByText('Row')).toBeInTheDocument()
  expect(screen.queryByText('Bench Press')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Hét · Push' }))
  expect(screen.getByText('Bench Press')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Hét · Push' })).toHaveAttribute('aria-pressed', 'true')
})

test('off-day tab shows the rest note, no add CTA', async () => {
  render(<MesoDayTabsEditor days={DAYS} {...noop} />)
  await userEvent.click(screen.getByRole('button', { name: 'Kedd · Rest' }))
  expect(screen.getByText('Pihenőnap')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Gyakorlat hozzáadása/ })).not.toBeInTheDocument()
})

test('steppers are always visible and fire patches', async () => {
  const onChange = vi.fn()
  render(<MesoDayTabsEditor days={DAYS} {...noop} onChange={onChange} />)
  // No expand/collapse — the name-scoped steppers are visible from the start.
  await userEvent.click(screen.getByRole('button', { name: 'Row · Working növelése' }))
  expect(onChange).toHaveBeenCalledWith('Sze', 'c', { workingSets: 4 })
  await userEvent.click(screen.getByRole('button', { name: 'Row · RIR növelése' }))
  expect(onChange).toHaveBeenCalledWith('Sze', 'c', { targetRIR: 1 })
  // anchor: from auto, + starts at 20
  await userEvent.click(screen.getByRole('button', { name: 'Row · Kiinduló súly növelése' }))
  expect(onChange).toHaveBeenCalledWith('Sze', 'c', { anchorWeightKg: 20 })
})

test('remove, add and reorder callbacks carry the day key', async () => {
  render(<MesoDayTabsEditor days={DAYS} {...noop} />)
  await userEvent.click(screen.getByRole('button', { name: 'Hét · Push' }))
  await userEvent.click(screen.getByRole('button', { name: 'Bench Press törlése' }))
  expect(noop.onRemove).toHaveBeenCalledWith('Hét', 'a')
  await userEvent.click(screen.getByRole('button', { name: /Gyakorlat hozzáadása/ }))
  expect(noop.onAddClick).toHaveBeenCalledWith('Hét')
  await userEvent.click(screen.getByRole('button', { name: 'Bench Press lejjebb' }))
  expect(noop.onReorder).toHaveBeenCalledWith('Hét', ['b', 'a'])
})
