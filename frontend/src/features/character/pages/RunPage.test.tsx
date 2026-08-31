// RunPage — narrative hero, RunFlowStrip, signal chain / quiet-night / conference faces, the
// honest-callCount ruling, and the AI-napló deep-link (mezo-1gim.14, Task 4). Mode-agnostic via
// the KarakterHubPage.test.tsx hook-override idiom.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { RunPage } from './RunPage'
import { MOCK_EXPERTS, MOCK_RUN_DETAIL } from '@/data/character/characterMock'
import type { CharacterRunResponse } from '@/data/character/characterApi'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => ({ id: hoisted.id }) }
})

const hoisted = vi.hoisted(() => ({
  id: 'ejsz-27',
  run: null as unknown as CharacterRunResponse | null,
}))

vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useCharacterRun: () => ({ run: hoisted.run, isLoading: false }),
    useCharacterExperts: () => ({ experts: MOCK_EXPERTS, isLoading: false }),
  }
})

beforeEach(() => {
  hoisted.id = 'ejsz-27'
  hoisted.run = MOCK_RUN_DETAIL['ejsz-27'] // a signal nightly run (journal-note + logging-gap)
  mockNavigate.mockReset()
})

const renderRun = () => render(<RunPage />)

describe('RunPage', () => {
  test('a signal NIGHTLY run renders the flow strip with jel/hívás/megfigyelés and the signal chain', () => {
    renderRun()
    const flow = screen.getByRole('group', { name: 'Futás-lánc' })
    expect(flow).toBeInTheDocument()
    expect(within(flow).getByText('jel')).toBeInTheDocument()
    expect(within(flow).getByText('hívás')).toBeInTheDocument()
    expect(within(flow).getByText('megfigyelés')).toBeInTheDocument()
    expect(screen.getByText('logging-gap')).toBeInTheDocument()
    expect(screen.getAllByText(/forrás-hivatkozás/).length).toBeGreaterThan(0)
  })

  test('a quiet NIGHTLY run shows the proud QUIET_MSG face, no chain cards, 0/0/0 flow', () => {
    hoisted.id = 'ejsz-11'
    hoisted.run = MOCK_RUN_DETAIL['ejsz-11']
    renderRun()
    expect(screen.getByText(/Nulla LLM-hívás, nulla token, nulla költség/)).toBeInTheDocument()
    expect(screen.queryByText('logging-gap')).not.toBeInTheDocument()
    const stepValues = screen.getAllByRole('group', { name: 'Futás-lánc' })[0].querySelectorAll('b')
    stepValues.forEach((v) => expect(v.textContent).toBe('0'))
  })

  test('a WEEKLY run never renders a "0 hívás" cell — only a megfigyelés step (binding ruling)', () => {
    hoisted.id = 'run-w2'
    hoisted.run = MOCK_RUN_DETAIL['run-w2']
    renderRun()
    expect(screen.queryByText('hívás')).not.toBeInTheDocument()
    expect(screen.getByText('megfigyelés')).toBeInTheDocument()
  })

  test('a WEEKLY run with a conferenceId links to the real konzílium transcript', async () => {
    hoisted.id = 'run-w2'
    hoisted.run = MOCK_RUN_DETAIL['run-w2']
    renderRun()
    await userEvent.click(screen.getByRole('button', { name: 'Teljes transzkript megnyitása ›' }))
    expect(mockNavigate).toHaveBeenCalledWith('/me/karakter/konzilium?id=w2')
  })

  test('an unknown/foreign run id (404 -> null) renders the honest not-found face, not a crash', () => {
    hoisted.run = null
    renderRun()
    expect(screen.getByText('Ez a futás nem található.')).toBeInTheDocument()
  })

  test('the AI-napló row navigates to /me/ai-usage unfiltered (AiCallFilters is not URL-driven)', async () => {
    renderRun()
    await userEvent.click(screen.getByText('Ehhez a futáshoz tartozó nyers hívások az AI-naplóban'))
    expect(mockNavigate).toHaveBeenCalledWith('/me/ai-usage')
  })

  test('‹ Futások back button navigates to the Futások list', async () => {
    renderRun()
    await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
    expect(mockNavigate).toHaveBeenCalledWith('/me/karakter/gepterem/futasok')
  })
})
