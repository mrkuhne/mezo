import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { VideoUrlSheet } from '@/features/train/sheets/VideoUrlSheet'

// The sheet calls setExerciseVideo directly — mock useTrain so the tests assert
// the exact (id, videoUrl) arguments passed to the mutation.
const { setExerciseVideo } = vi.hoisted(() => ({ setExerciseVideo: vi.fn() }))
vi.mock('@/data/hooks', () => ({ useTrain: () => ({ setExerciseVideo }) }))

beforeEach(() => setExerciseVideo.mockClear())

test('attaching a video to a row with none trims the URL and calls setExerciseVideo', async () => {
  render(<VideoUrlSheet exercise={{ id: 'cat-9', name: 'Box Jump', videoUrl: null }} onClose={vi.fn()} />)
  expect(screen.getByText('Videó · Box Jump')).toBeInTheDocument()
  expect(screen.getByLabelText('Videó URL')).toHaveValue('')
  await userEvent.type(screen.getByLabelText('Videó URL'), '  https://youtu.be/dQw4w9WgXcQ  ')
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(setExerciseVideo).toHaveBeenCalledWith(
    'cat-9',
    'https://youtu.be/dQw4w9WgXcQ',
    { onSuccess: expect.any(Function), onError: expect.any(Function) },
  )
})

test('a row with no video shows Mégse, not Eltávolítás', () => {
  render(<VideoUrlSheet exercise={{ id: 'cat-9', name: 'Box Jump', videoUrl: null }} onClose={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Mégse' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Eltávolítás/ })).toBeNull()
})

test('an existing video seeds the field and the Eltávolítás action clears it (null)', async () => {
  render(
    <VideoUrlSheet
      exercise={{ id: 'cat-1', name: 'Chest Supported Row', videoUrl: 'https://youtu.be/GZTvxN5fPBc' }}
      onClose={vi.fn()}
    />,
  )
  expect(screen.getByLabelText('Videó URL')).toHaveValue('https://youtu.be/GZTvxN5fPBc')
  await userEvent.click(screen.getByRole('button', { name: /Eltávolítás/ }))
  expect(setExerciseVideo).toHaveBeenCalledWith(
    'cat-1',
    null,
    { onSuccess: expect.any(Function), onError: expect.any(Function) },
  )
})

test('clearing the field then saving persists null', async () => {
  render(
    <VideoUrlSheet
      exercise={{ id: 'cat-1', name: 'Chest Supported Row', videoUrl: 'https://youtu.be/GZTvxN5fPBc' }}
      onClose={vi.fn()}
    />,
  )
  await userEvent.clear(screen.getByLabelText('Videó URL'))
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(setExerciseVideo).toHaveBeenCalledWith('cat-1', null, expect.anything())
})
