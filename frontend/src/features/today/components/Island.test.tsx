import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Island } from '@/features/today/components/Island'

const base = {
  face: 'reggel' as const,
  nowClock: false,
  capsule: { essence: 'Mobilitás videó a következő', count: '3 ›' },
  onSelect: vi.fn(),
}

describe('Island', () => {
  it('capsule button carries the spoken label and fires onSelect', async () => {
    const onSelect = vi.fn()
    render(
      <Island {...base} big={false} onSelect={onSelect}>
        content
      </Island>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Reggel · Mobilitás videó a következő · megnyitás' }))
    expect(onSelect).toHaveBeenCalledWith('reggel')
  })

  it('big island hides the capsule from the a11y tree and shows children', () => {
    render(
      <Island {...base} big>
        BIG CONTENT
      </Island>,
    )
    expect(screen.queryByRole('button', { name: /megnyitás/ })).toBeNull()
    expect(screen.getByText('BIG CONTENT')).toBeInTheDocument()
  })

  it('nowClock adds the MOST tag and the label says most', () => {
    render(
      <Island {...base} big={false} nowClock>
        x
      </Island>,
    )
    expect(screen.getByText('MOST')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reggel · most ·/ })).toBeInTheDocument()
  })

  it('night flag darkens the shell', () => {
    const { container } = render(
      <Island {...base} face="este" big night>
        x
      </Island>,
    )
    expect(container.querySelector('.isl.isl-night')).not.toBeNull()
  })
})
