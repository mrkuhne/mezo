import { fireEvent, render, screen } from '@testing-library/react'
import { ToolWorkStrip } from '@/features/insights/components/ToolWorkStrip'
import type { Tool } from '@/shared/ui/ToolChip'

const TOOLS: Tool[] = [
  { type: 'read', name: 'get_weight_log', args: 'days=7' },
  { type: 'read', name: 'get_recovery', args: 'days=7, scope=sleep' },
  { type: 'read', name: 'get_fuel_log', args: 'days=7, range=day' },
]

describe('ToolWorkStrip', () => {
  it('collapsed by default: human eyebrow + source count, no detail rows', () => {
    render(<ToolWorkStrip tools={TOOLS} />)
    expect(screen.getByRole('button', { name: /Utánanézett/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('3 forrás')).toBeInTheDocument()
    expect(screen.queryByText('Súlynapló')).not.toBeInTheDocument()
  })

  it('expands to human-labeled rows with raw args and a done-tick icon', () => {
    const { container } = render(<ToolWorkStrip tools={TOOLS} />)
    fireEvent.click(screen.getByRole('button', { name: /Utánanézett/ }))
    expect(screen.getByRole('button', { name: /Utánanézett/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Súlynapló')).toBeInTheDocument()
    expect(screen.getByText('days=7, scope=sleep')).toBeInTheDocument()
    expect(container.querySelectorAll('.mzc-wst svg')).toHaveLength(3)
    expect(container.textContent).not.toMatch(/✓/)
  })

  it('unknown tool name falls back to the raw name', () => {
    render(<ToolWorkStrip tools={[{ type: 'read', name: 'recallSharedMemory' }]} />)
    fireEvent.click(screen.getByRole('button', { name: /Utánanézett/ }))
    expect(screen.getByText('recallSharedMemory')).toBeInTheDocument()
  })

  it('live mode: the working label, and the LAST source runs while earlier ones are done', () => {
    const { container } = render(<ToolWorkStrip tools={TOOLS} live />)
    const strip = screen.getByRole('button', { name: /Utánanéz…/ })
    fireEvent.click(strip)
    expect(container.querySelectorAll('.mzc-wst svg')).toHaveLength(2)
    expect(screen.getByText('fut')).toBeInTheDocument()
  })

  it('the collapse chevron renders as an icon, not a typographic glyph', () => {
    const { container } = render(<ToolWorkStrip tools={TOOLS} />)
    expect(container.querySelector('.mzc-wchev svg')).toBeTruthy()
    expect(container.querySelector('.mzc-wchev')?.textContent).not.toMatch(/[⌃⌄]/)
  })

  it('a baked wire name shows the parsed label and params subline when args is absent', () => {
    render(<ToolWorkStrip tools={[{ type: 'read', name: 'get_recovery(days=7, scope=sleep)' }]} />)
    fireEvent.click(screen.getByRole('button', { name: /Utánanézett/ }))
    expect(screen.getByText('Alvás & pihenés')).toBeInTheDocument()
    expect(screen.getByText('days=7, scope=sleep')).toBeInTheDocument()
  })

  it('renders nothing for an empty tool list', () => {
    const { container } = render(<ToolWorkStrip tools={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  // S9.7 provenance (mezo-rj214.7): the rows become cards — the planner's reason and the
  // tool's own returned text, per row.
  describe('provenance cards (S9.7)', () => {
    it('shows the reason and the returned text below the human label', () => {
      render(<ToolWorkStrip tools={[{
        type: 'read', name: 'get_recovery', args: 'days=3',
        why: 'Meg akartam nézni, mennyit pihentél.',
        outcome: 'Az elmúlt 3 napban átlag 6.1 óra alvás volt.',
      }]} />)
      fireEvent.click(screen.getByRole('button', { name: /Utánanézett/ }))
      expect(screen.getByText('Alvás & pihenés')).toBeInTheDocument()
      expect(screen.getByText('Meg akartam nézni, mennyit pihentél.')).toBeInTheDocument()
      expect(screen.getByText('Az elmúlt 3 napban átlag 6.1 óra alvás volt.')).toBeInTheDocument()
    })

    it('a failed step shows a visible failure mark and still shows its text', () => {
      const { container } = render(<ToolWorkStrip tools={[{
        type: 'read', name: 'get_medication', failed: true,
        outcome: 'Időtúllépés — nem sikerült lekérni.',
      }]} />)
      fireEvent.click(screen.getByRole('button', { name: /Utánanézett/ }))
      expect(screen.getByText('Időtúllépés — nem sikerült lekérni.')).toBeInTheDocument()
      // an honest failure mark replaces the done-tick, never hides the row or its text
      expect(container.querySelector('.mzc-wst svg')).toBeTruthy()
      expect(container.querySelectorAll('.mzc-wrow')).toHaveLength(1)
    })

    it('a retention-scrubbed row (no outcome) renders the ask without an empty content block', () => {
      render(<ToolWorkStrip tools={[{
        type: 'read', name: 'get_recovery', args: 'days=3',
        why: 'Meg akartam nézni, mennyit pihentél.',
      }]} />)
      fireEvent.click(screen.getByRole('button', { name: /Utánanézett/ }))
      expect(screen.getByText('Meg akartam nézni, mennyit pihentél.')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /eredmény megnyitása/ })).not.toBeInTheDocument()
    })

    it('an empty-string why/outcome renders no line (empty becomes undefined at the boundary)', () => {
      render(<ToolWorkStrip tools={[{ type: 'read', name: 'get_recovery', args: 'days=3', why: '', outcome: '' }]} />)
      fireEvent.click(screen.getByRole('button', { name: /Utánanézett/ }))
      expect(screen.queryByRole('button', { name: /eredmény megnyitása/ })).not.toBeInTheDocument()
    })

    it('a live streaming turn (no outcomes yet) renders exactly as today', () => {
      const { container } = render(<ToolWorkStrip tools={TOOLS} live />)
      fireEvent.click(screen.getByRole('button', { name: /Utánanéz…/ }))
      expect(container.querySelectorAll('.mzc-wout')).toHaveLength(0)
      expect(container.querySelectorAll('.mzc-wwhy')).toHaveLength(0)
    })
  })
})
