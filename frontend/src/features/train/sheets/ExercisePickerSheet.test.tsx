import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, vi } from 'vitest'
import { ExercisePickerSheet } from '@/features/train/sheets/ExercisePickerSheet'
import { QueryWrapper } from '@/test/queryWrapper'

// Reads the static exerciseLibrary via useTrain, but the swapped hook calls
// useQuery — pin mock mode + provide a QueryClientProvider.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('renders the picker title', () => {
  render(<ExercisePickerSheet onClose={() => {}} onPick={() => {}} />, { wrapper: QueryWrapper })
  expect(screen.getByText('Mit pakolunk be?')).toBeInTheDocument()
})

test('search with no matches shows the empty-state copy', async () => {
  render(<ExercisePickerSheet onClose={() => {}} onPick={() => {}} />, { wrapper: QueryWrapper })
  await userEvent.type(screen.getByPlaceholderText('Keresés · pl. row, curl, press'), 'zzzz')
  expect(screen.getByText('Nincs találat ezzel a szűrővel.')).toBeInTheDocument()
})

test('plyo chip filters by type in real mode (API catalog)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false') // override the file-level mock pin
  render(<ExercisePickerSheet onClose={() => {}} onPick={() => {}} />, { wrapper: QueryWrapper })
  expect(await screen.findByText('Box Jump')).toBeInTheDocument()
  expect(screen.getByText('Hip Thrust')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Plyo' }))
  expect(screen.getByText('Box Jump')).toBeInTheDocument()
  expect(screen.queryByText('Hip Thrust')).not.toBeInTheDocument()
})

test('region → muscle sub-filter narrows the API catalog by muscle', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  render(<ExercisePickerSheet onClose={() => {}} onPick={() => {}} />, { wrapper: QueryWrapper })
  await screen.findByText('Box Jump')
  // Láb (sage) region shows level-2 sub-chips; Vádli (calf) narrows to calf only.
  await userEvent.click(screen.getByRole('button', { name: 'Láb' }))
  await userEvent.click(screen.getByRole('button', { name: 'Vádli' }))
  expect(screen.getByText('Standing Calf Raise')).toBeInTheDocument()
  expect(screen.queryByText('Box Jump')).not.toBeInTheDocument() // Box Jump is quad
  // Core region has a single muscle → the top chip filters directly (no sub-row).
  await userEvent.click(screen.getByRole('button', { name: 'Core' }))
  expect(screen.getByText('Cable Crunch')).toBeInTheDocument()
})

test('picking keeps the sheet open, counts adds, and flashes the row', async () => {
  const picks: string[] = []
  render(
    <ExercisePickerSheet onClose={() => {}} onPick={(i) => picks.push(i.name)} dayLabel="Csü · Pull" />,
    { wrapper: QueryWrapper },
  )
  expect(screen.getByText('Csü · Pull', { exact: false })).toBeInTheDocument()
  await userEvent.click(screen.getByText('Hip Thrust'))
  // sheet is still open, the pick registered, counter + flash feedback shown
  expect(screen.getByText('Mit pakolunk be?')).toBeInTheDocument()
  expect(picks).toEqual(['Hip Thrust'])
  expect(screen.getByText('1 hozzáadva')).toBeInTheDocument()
  // the „added" mark is the ok status pill in place of the row's + (no ✓ glyph)
  expect(screen.getByText('Hozzáadva')).toHaveClass('fo-st', 'ok')
  await userEvent.click(screen.getByText('Hip Thrust'))
  expect(picks).toEqual(['Hip Thrust', 'Hip Thrust']) // duplicates allowed
  expect(screen.getByText('2 hozzáadva')).toBeInTheDocument()
})

test('Kész closes the sheet and reflects the added count', async () => {
  const onClose = vi.fn()
  render(<ExercisePickerSheet onClose={onClose} onPick={() => {}} />, { wrapper: QueryWrapper })
  expect(screen.getByRole('button', { name: 'Kész' })).toBeInTheDocument()
  await userEvent.click(screen.getByText('Hip Thrust'))
  await userEvent.click(screen.getByRole('button', { name: 'Kész · 1' }))
  // Sheet dismissal is animated → onClose fires async
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})

test('each picker row leads with the exercise thumbnail', async () => {
  render(<ExercisePickerSheet onClose={() => {}} onPick={() => {}} />, { wrapper: QueryWrapper })
  const row = await screen.findByRole('button', { name: /Chest Supported Row/ })
  // Present for every row: the photo when the catalog row has stills, the muscle chip when it
  // does not — the left edge never goes ragged.
  // (Chest Supported Row is deliberately imageless: one of the 37 unmapped slugs.)
  expect(row.querySelector('.ee-thumb')).not.toBeNull()
})

// Folyadék (mezo-n4wf5.3, prototype `xpick`)
test('the light sheet: context line, the stimulus as five drops, the type in plain words', async () => {
  render(<ExercisePickerSheet onClose={() => {}} onPick={() => {}} dayLabel="Csü · Pull" />, { wrapper: QueryWrapper })
  const dialog = screen.getByRole('dialog')
  expect(dialog).toHaveClass('fo-sheet')
  expect(dialog).not.toHaveClass('glass')
  expect(screen.getByText('Gyakorlat választás · Csü · Pull')).toBeInTheDocument()
  expect(screen.getByRole('searchbox', { name: 'Keresés' })).toBeInTheDocument()
  const row = screen.getByRole('button', { name: /Chest Supported Row/ })
  expect(row).toHaveTextContent('összetett')
  expect(row).not.toHaveTextContent('compound')
  expect(row.querySelectorAll('.fo-dm i')).toHaveLength(5)
  expect(screen.getByRole('button', { name: 'Összes' })).toHaveAttribute('aria-pressed', 'true')
})

test('single mode: no Kész, a pick closes; the similar group leads the list', async () => {
  const onClose = vi.fn()
  const picks: string[] = []
  render(
    <ExercisePickerSheet mode="single" eyebrow="Csere" title="Mire cseréled?" similarTo="back-mid"
      excludeNames={['Chest Supported Row']} onClose={onClose} onPick={(i) => picks.push(i.name)} />,
    { wrapper: QueryWrapper },
  )
  expect(screen.getByText('Mire cseréled?')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /^Kész/ })).not.toBeInTheDocument()
  expect(screen.queryByText('Chest Supported Row')).not.toBeInTheDocument()
  const similar = screen.getByRole('group', { name: 'Hasonló gyakorlatok' })
  const first = similar.querySelector('button')!
  await userEvent.click(first)
  expect(picks).toHaveLength(1)
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})
