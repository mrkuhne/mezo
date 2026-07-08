import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { CatalogExerciseSheet } from '@/features/train/sheets/CatalogExerciseSheet'
import type { ExerciseLibraryItem } from '@/data/types'

// The sheet builds a CatalogExerciseCreateRequest and calls the mutation hook
// directly — mock useTrain so the tests assert the exact request payload.
const { createCatalogExercise, updateCatalogExercise } = vi.hoisted(() => ({
  createCatalogExercise: vi.fn(),
  updateCatalogExercise: vi.fn(),
}))
vi.mock('@/data/hooks', () => ({
  useTrain: () => ({ createCatalogExercise, updateCatalogExercise }),
}))

beforeEach(() => {
  createCatalogExercise.mockClear()
  updateCatalogExercise.mockClear()
})

test('create mode builds the request and calls createCatalogExercise', async () => {
  render(<CatalogExerciseSheet onClose={vi.fn()} />)
  await userEvent.type(screen.getByLabelText('Név'), 'DB Row')
  await userEvent.click(screen.getByRole('button', { name: 'Lat' })) // muscle -> lats
  await userEvent.click(screen.getByRole('button', { name: 'isolation' })) // type
  await userEvent.click(screen.getByRole('button', { name: 'Stim növelése' })) // 0.7 -> 0.75
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(createCatalogExercise).toHaveBeenCalledWith(
    { name: 'DB Row', muscle: 'lats', type: 'isolation', stim: 0.75, fatigue: 0.3, videoUrl: null },
    { onSuccess: expect.any(Function) },
  )
  expect(updateCatalogExercise).not.toHaveBeenCalled()
})

test('a video URL is trimmed into the request', async () => {
  render(<CatalogExerciseSheet onClose={vi.fn()} />)
  await userEvent.type(screen.getByLabelText('Név'), 'Cable Fly')
  await userEvent.type(screen.getByLabelText('Videó URL'), '  https://youtu.be/abc  ')
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(createCatalogExercise.mock.calls[0][0].videoUrl).toBe('https://youtu.be/abc')
})

test('Mentés is disabled while the name is blank', async () => {
  render(<CatalogExerciseSheet onClose={vi.fn()} />)
  expect(screen.getByRole('button', { name: /Mentés/ })).toBeDisabled()
  await userEvent.type(screen.getByLabelText('Név'), 'X')
  expect(screen.getByRole('button', { name: /Mentés/ })).toBeEnabled()
})

test('edit mode seeds the fields and calls updateCatalogExercise with the id', async () => {
  const edit: ExerciseLibraryItem = {
    id: 'cat-1', catalogId: 'cat-1', name: 'Cable Fly', muscle: 'chest', type: 'isolation',
    stim: 0.74, fatigue: 0.25, videoUrl: 'https://youtu.be/x', editable: true,
  }
  render(<CatalogExerciseSheet onClose={vi.fn()} edit={edit} />)
  expect(screen.getByLabelText('Név')).toHaveValue('Cable Fly')
  expect(screen.getByLabelText('Videó URL')).toHaveValue('https://youtu.be/x')
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(updateCatalogExercise).toHaveBeenCalledWith(
    'cat-1',
    { name: 'Cable Fly', muscle: 'chest', type: 'isolation', stim: 0.74, fatigue: 0.25, videoUrl: 'https://youtu.be/x' },
    { onSuccess: expect.any(Function) },
  )
  expect(createCatalogExercise).not.toHaveBeenCalled()
})
