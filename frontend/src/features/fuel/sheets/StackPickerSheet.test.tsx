import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, vi } from 'vitest'
import { StackPickerSheet } from '@/features/fuel/sheets/StackPickerSheet'
import { QueryWrapper } from '@/test/queryWrapper'

// StackPickerSheet reads the dual-mode useStack (mezo-09g) — pin mock mode for the seed stash
// and provide a QueryClientProvider (useStack calls useQuery via useDualQuery).
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('filters the stash by query and toggles an item', async () => {
  const onToggle = vi.fn()
  render(
    <QueryWrapper>
      <StackPickerSheet selectedIds={[]} onToggle={onToggle} onClose={() => {}} />
    </QueryWrapper>,
  )
  await userEvent.type(screen.getByPlaceholderText(/Keress a polcon/), 'kreatin')
  await userEvent.click(screen.getByText(/Kreatin/))
  expect(onToggle).toHaveBeenCalled()
})
