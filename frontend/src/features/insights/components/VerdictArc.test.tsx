import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { VerdictArc } from '@/features/insights/components/VerdictArc'

describe('VerdictArc', () => {
  test('draws one segment per rule — the arc IS the day, not a decoration', () => {
    const { container } = render(
      <VerdictArc split={{ raised: 2, suppressed: 1, clear: 8, unavailable: 3, total: 14 }} />,
    )
    expect(container.querySelectorAll('.mzo-arcseg')).toHaveLength(14)
  })

  test('says the split in words for a screen reader', () => {
    render(<VerdictArc split={{ raised: 2, suppressed: 1, clear: 8, unavailable: 3, total: 14 }} />)
    expect(screen.getByRole('img', { name: '2 jelzett, 1 pihenőn, 8 rendben, 3 nem mérhető' }))
      .toBeInTheDocument()
  })

  test('an unresolved day draws nothing rather than an empty ring of fabricated calm', () => {
    const { container } = render(
      <VerdictArc split={{ raised: 0, suppressed: 0, clear: 0, unavailable: 0, total: 0 }} />,
    )
    expect(container.querySelector('svg')).toBeNull()
  })

  test('the üveg gauge keeps one glowing segment per rule, coloured by state, on a faint track', () => {
    const { container } = render(
      <VerdictArc glow size={156} split={{ raised: 2, suppressed: 1, clear: 8, unavailable: 3, total: 14 }} />,
    )
    expect(container.querySelector('svg.uv-ring')).not.toBeNull()
    expect(container.querySelectorAll('.mzo-arcseg.uv-ring-prog')).toHaveLength(14)
    expect(container.querySelectorAll('.uv-ring-track')).toHaveLength(1)
    expect(container.querySelectorAll('[data-state="raised"]')).toHaveLength(2)
    expect(container.querySelectorAll('[data-state="unavailable"]')).toHaveLength(3)
  })
})

