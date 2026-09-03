import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { CatalogExerciseSheet } from '@/features/train/sheets/CatalogExerciseSheet'
import type { ExerciseLibraryItem } from '@/data/types'

// The sheet builds a CatalogExerciseCreateRequest and calls the mutation hook
// directly — mock useTrain so the tests assert the exact request payload.
const { createCatalogExercise, updateCatalogExercise, deleteCatalogExercise } = vi.hoisted(() => ({
  createCatalogExercise: vi.fn(),
  updateCatalogExercise: vi.fn(),
  deleteCatalogExercise: vi.fn(),
}))
vi.mock('@/data/hooks', () => ({
  useTrain: () => ({ createCatalogExercise, updateCatalogExercise, deleteCatalogExercise }),
}))

beforeEach(() => {
  createCatalogExercise.mockClear()
  updateCatalogExercise.mockClear()
  deleteCatalogExercise.mockClear()
})

test('create mode shows no delete button', () => {
  render(<CatalogExerciseSheet onClose={vi.fn()} />)
  expect(screen.queryByRole('button', { name: 'Gyakorlat törlése' })).toBeNull()
})

test('create mode builds the request and calls createCatalogExercise', async () => {
  render(<CatalogExerciseSheet onClose={vi.fn()} />)
  await userEvent.type(screen.getByLabelText('Név'), 'DB Row')
  await userEvent.click(screen.getByRole('button', { name: 'Hát (széles)' })) // muscle -> back-wide
  await userEvent.click(screen.getByRole('button', { name: 'isolation' })) // type
  await userEvent.click(screen.getByRole('button', { name: 'Stim növelése' })) // 0.7 -> 0.75
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(createCatalogExercise).toHaveBeenCalledWith(
    {
      name: 'DB Row', muscle: 'back-wide', type: 'isolation', stim: 0.75, fatigue: 0.3,
      videoUrl: null, imageStartUrl: null, imageEndUrl: null,
    },
    { onSuccess: expect.any(Function), onError: expect.any(Function) },
  )
  expect(updateCatalogExercise).not.toHaveBeenCalled()
})

test('a video URL is trimmed into the request', async () => {
  render(<CatalogExerciseSheet onClose={vi.fn()} />)
  await userEvent.type(screen.getByLabelText('Név'), 'Cable Fly')
  await userEvent.type(screen.getByLabelText('Videó URL'), '  https://youtu.be/dQw4w9WgXcQ  ')
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(createCatalogExercise.mock.calls[0][0].videoUrl).toBe('https://youtu.be/dQw4w9WgXcQ')
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
    stim: 0.74, fatigue: 0.25, videoUrl: 'https://youtu.be/dQw4w9WgXcQ', editable: true,
  }
  render(<CatalogExerciseSheet onClose={vi.fn()} edit={edit} />)
  expect(screen.getByLabelText('Név')).toHaveValue('Cable Fly')
  expect(screen.getByLabelText('Videó URL')).toHaveValue('https://youtu.be/dQw4w9WgXcQ')
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(updateCatalogExercise).toHaveBeenCalledWith(
    'cat-1',
    {
      name: 'Cable Fly', muscle: 'chest', type: 'isolation', stim: 0.74, fatigue: 0.25,
      videoUrl: 'https://youtu.be/dQw4w9WgXcQ', imageStartUrl: null, imageEndUrl: null,
    },
    { onSuccess: expect.any(Function), onError: expect.any(Function) },
  )
  expect(createCatalogExercise).not.toHaveBeenCalled()
})

// Regression (mezo-qw37.5 fix-wave): the backend's update() writes imageStartUrl/imageEndUrl
// UNCONDITIONALLY, so an edit body that omits them silently wipes the row's demo stills —
// including, since this slice, stills on rows an OWNER edits that belong to someone else.
// The sheet must carry the edited row's existing stills through on every submit.
test('edit mode carries the row\'s existing demo stills through unchanged', async () => {
  const edit: ExerciseLibraryItem = {
    id: 'cat-2', catalogId: 'cat-2', name: 'Box Jump', muscle: 'quad', type: 'plyo',
    stim: 0.6, fatigue: 0.4, videoUrl: null,
    imageStartUrl: '/exercises/box-jump-a.jpg', imageEndUrl: '/exercises/box-jump-b.jpg',
    editable: true,
  }
  render(<CatalogExerciseSheet onClose={vi.fn()} edit={edit} />)
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(updateCatalogExercise.mock.calls[0][1]).toMatchObject({
    imageStartUrl: '/exercises/box-jump-a.jpg',
    imageEndUrl: '/exercises/box-jump-b.jpg',
  })
})
