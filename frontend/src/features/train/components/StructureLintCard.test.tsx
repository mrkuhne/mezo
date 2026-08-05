import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { StructureFinding } from '@/features/train/logic/structureLint'
import { StructureLintCard } from '@/features/train/components/StructureLintCard'

const f = (over: Partial<StructureFinding>): StructureFinding => ({
  rule: 'frequency', label: 'Bicepsz: minden heti szett egy napon.',
  detail: 'Ugyanez a volumen ≥2 napra elosztva akár ~30%-kal gyorsabb fejlődést hozhat.', ...over,
})

describe('StructureLintCard', () => {
  it('collapsed: shows the count pill, hides the detail rows', () => {
    render(<StructureLintCard findings={[f({}), f({ rule: 'push-pull', label: 'Push:pull arány 1.8.' })]} />)
    expect(screen.getByText('2 észrevétel')).toBeInTheDocument()
    expect(screen.queryByText(/gyorsabb fejlődést/)).not.toBeInTheDocument()
  })
  it('clean: shows the ✓ pill and the clean line when expanded', () => {
    render(<StructureLintCard findings={[]} />)
    expect(screen.getByText('✓ rendben')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Struktúra/i }))
    expect(screen.getByText(/strukturálisan rendben/)).toBeInTheDocument()
  })
  it('expanded: renders label + detail per finding', () => {
    render(<StructureLintCard findings={[f({})]} />)
    fireEvent.click(screen.getByRole('button', { name: /Struktúra/i }))
    expect(screen.getByText('Bicepsz: minden heti szett egy napon.')).toBeInTheDocument()
    expect(screen.getByText(/gyorsabb fejlődést hozhat/)).toBeInTheDocument()
  })
})
