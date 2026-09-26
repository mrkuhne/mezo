import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryWrapper } from '@/test/queryWrapper'
import { MOCK_OVERVIEW } from '@/data/character/characterMock'
import type { CharacterOverviewResponse } from '@/data/character/characterApi'
import { onToast, type ToastMessage } from '@/shared/lib/toastBus'
import { pickQuoteClaim, ROLAD_COPY } from '@/features/insights/logic/roladCopy'
import { TEAM } from '@/features/insights/logic/team'
import { RoladQuote } from './RoladQuote'

const hoisted = vi.hoisted(() => ({
  overview: null as unknown as CharacterOverviewResponse | null,
  submit: vi.fn(),
}))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useCharacterOverview: () => ({ overview: hoisted.overview, isLoading: false }),
    useClaimFeedback: () => ({ submit: hoisted.submit, pending: false }),
  }
})

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  hoisted.overview = MOCK_OVERVIEW
  hoisted.submit.mockReset().mockResolvedValue(undefined)
})
afterEach(() => vi.unstubAllEnvs())

describe('RoladQuote', () => {
  test('the most certain claim speaks, in its character’s name, as a rose glass quote', () => {
    const pick = pickQuoteClaim(MOCK_OVERVIEW)!
    const { container } = render(<RoladQuote />, { wrapper: QueryWrapper })
    const quote = container.querySelector('.kr9-quote')
    expect(quote).toHaveClass('glass', 'tf-c-rose')
    expect(quote).toHaveTextContent(`„${pick.text}”`)
    expect(quote).toHaveTextContent(`Így fogalmaz most rólad ${TEAM[pick.character].name}`)
    expect(quote).toHaveTextContent('javítható benyomás, nem címke')
  })

  test('Talál sends the feedback and thanks in place', async () => {
    const pick = pickQuoteClaim(MOCK_OVERVIEW)!
    render(<RoladQuote />, { wrapper: QueryWrapper })
    await userEvent.click(screen.getByRole('button', { name: 'Talál' }))
    expect(hoisted.submit).toHaveBeenCalledWith(pick.id, 'TALAL')
    expect(await screen.findByText('Megerősítetted — a benyomás erősödik')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Talál' })).not.toBeInTheDocument()
  })

  test('Talál also fires a success toast (final-review fix, mezo-zpxv7)', async () => {
    const seen: ToastMessage[] = []
    const off = onToast((t) => seen.push(t))
    render(<RoladQuote />, { wrapper: QueryWrapper })
    await userEvent.click(screen.getByRole('button', { name: 'Talál' }))
    off()
    expect(seen).toContainEqual(
      expect.objectContaining({ kind: 'success', text: 'Talál — megerősítetted, a benyomás erősödik' }))
  })

  test('Pontosítom opens the reply thread on the claim', async () => {
    const { container } = render(<RoladQuote />, { wrapper: QueryWrapper })
    expect(container.querySelector('.kr-reply-thread')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Pontosítom' }))
    expect(container.querySelector('.kr-reply-thread')).not.toBeNull()
  })

  test('no claim yet → the honest empty note, never an invented sentence', () => {
    hoisted.overview = { dimensions: [] }
    const { container } = render(<RoladQuote />, { wrapper: QueryWrapper })
    expect(screen.getByText(ROLAD_COPY.quoteEmpty)).toBeInTheDocument()
    expect(container.querySelector('.kr9-quote')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Talál' })).not.toBeInTheDocument()
  })

  test('overview null (the character switch is off) → nothing at all', () => {
    hoisted.overview = null
    const { container } = render(<RoladQuote />, { wrapper: QueryWrapper })
    expect(container).toBeEmptyDOMElement()
  })
})
