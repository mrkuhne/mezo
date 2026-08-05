import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, vi } from 'vitest'
import { StackPickerSheet } from '@/features/fuel/sheets/StackPickerSheet'
import { QueryWrapper } from '@/test/queryWrapper'

// StackPickerSheet reads the dual-mode useStack (mezo-09g) — pin mock mode for the seed stash
// and provide a QueryClientProvider (useStack calls useQuery via useDualQuery).
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('filters the stash by query and adds an item', async () => {
  const onAdd = vi.fn()
  render(
    <QueryWrapper>
      <StackPickerSheet occupiedIds={new Set()} onAdd={onAdd} onClose={() => {}} />
    </QueryWrapper>,
  )
  await userEvent.type(screen.getByPlaceholderText(/Keress a polcon/), 'kreatin')
  await userEvent.click(screen.getByText(/Kreatin/))
  expect(onAdd).toHaveBeenCalledWith('kreatin')
})

test('an occupied item shows the "a stackben" chip but stays tappable', async () => {
  const onAdd = vi.fn()
  render(
    <QueryWrapper>
      <StackPickerSheet occupiedIds={new Set(['kreatin'])} onAdd={onAdd} onClose={() => {}} />
    </QueryWrapper>,
  )
  await userEvent.type(screen.getByPlaceholderText(/Keress a polcon/), 'kreatin')
  expect(screen.getByText('a stackben')).toBeInTheDocument()
  await userEvent.click(screen.getByText(/Kreatin/))
  expect(onAdd).toHaveBeenCalledWith('kreatin')
})
