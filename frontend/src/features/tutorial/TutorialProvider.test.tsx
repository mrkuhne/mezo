import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { TutorialProvider, useTutorial } from '@/features/tutorial/TutorialProvider'
import { readLocalProgress, writeLocalProgress } from '@/shared/lib/tutorialSeen'
import { QueryWrapper } from '@/test/queryWrapper'

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  localStorage.clear()
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

function Probe() {
  const t = useTutorial()
  const navigate = useNavigate()
  return (
    <div>
      <span data-testid="current">{t.current?.id ?? '-'}</span>
      <span data-testid="unseen">{String(t.isUnseen('fuel'))}</span>
      <button onClick={() => t.open('fuel')}>nyisd</button>
      <button onClick={() => navigate('/train')}>train</button>
      <button onClick={() => navigate('/fuel')}>fuel</button>
    </div>
  )
}

const renderAt = (path: string) =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[path]}>
        <TutorialProvider>
          <Routes><Route path="*" element={<Probe />} /></Routes>
        </TutorialProvider>
      </MemoryRouter>
    </QueryWrapper>,
  )

const flush = () => act(() => { vi.advanceTimersByTime(700) })

test('/fuel első belépésre a késleltetés után felugrik, és a megjelenéskor már látottnak számít', async () => {
  renderAt('/fuel')
  expect(screen.getByTestId('current')).toHaveTextContent('fuel')
  expect(screen.queryByRole('dialog')).toBeNull()
  flush()
  expect(await screen.findByRole('dialog', { name: 'Kalauz · Fuel' })).toBeInTheDocument()
  expect(screen.getByTestId('unseen')).toHaveTextContent('false')
  expect(readLocalProgress().fuel?.version).toBe(1)
  expect(readLocalProgress().fuel?.completedAt).toBeNull()
})

test('Kihagyom → dismissedAtStep; nem ugrik fel újra ugyanabban a sessionben, sem route-visszatérésre', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/fuel')
  flush()
  await user.click(await screen.findByRole('button', { name: 'Tovább' }))
  await user.click(screen.getByRole('button', { name: 'Kihagyom' }))
  await act(async () => { vi.advanceTimersByTime(500) })
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(readLocalProgress().fuel?.dismissedAtStep).toBe(1)
  await user.click(screen.getByRole('button', { name: 'train' }))
  await user.click(screen.getByRole('button', { name: 'fuel' }))
  flush()
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('látott kalauz nem ugrik fel, de a „?" (open) bármikor nyit', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  writeLocalProgress({ fuel: { version: 1, seenAt: '2026-09-01T10:00:00.000Z', completedAt: null, dismissedAtStep: null } })
  renderAt('/fuel')
  flush()
  expect(screen.queryByRole('dialog')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'nyisd' }))
  expect(screen.getByRole('dialog', { name: 'Kalauz · Fuel' })).toBeInTheDocument()
})

test('regi verzió látva → az új verzió újra felugrik', async () => {
  writeLocalProgress({ fuel: { version: 0, seenAt: '2026-09-01T10:00:00.000Z', completedAt: null, dismissedAtStep: null } })
  renderAt('/fuel')
  flush()
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
})

test('kalauz nélküli route-on nincs felugrás és current null', () => {
  renderAt('/train')
  flush()
  expect(screen.getByTestId('current')).toHaveTextContent('-')
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('a kapcsolat-chip navigál, a kalauz completedAt-tal zár', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/fuel')
  flush()
  await screen.findByRole('dialog')
  await user.click(screen.getByRole('button', { name: '5. kártya' }))
  await user.click(screen.getByRole('button', { name: /^Edzés/ }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByTestId('current')).toHaveTextContent('-') // /train-en vagyunk
  expect(readLocalProgress().fuel?.completedAt).not.toBeNull()
})
