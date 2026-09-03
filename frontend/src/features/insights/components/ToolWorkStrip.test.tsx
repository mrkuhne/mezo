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
})
