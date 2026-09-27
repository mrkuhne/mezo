import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HubFold } from '@/features/insights/components/hub/HubFold'

describe('HubFold', () => {
  it('shows label · count and the hint, with aria-expanded reflecting open', () => {
    render(<HubFold id="etel" icon="t-bowl" label="Étel" count="4" hint="2 elhallgattatva" open={false} onToggle={vi.fn()}><p>gyerek</p></HubFold>)
    const btn = screen.getByRole('button', { name: /Étel · 4/ })
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('2 elhallgattatva')).toBeInTheDocument()
  })

  it('renders children only when open', () => {
    const { rerender } = render(<HubFold id="etel" icon="t-bowl" label="Étel" count="4" open={false} onToggle={vi.fn()}><p>gyerek</p></HubFold>)
    expect(screen.queryByText('gyerek')).toBeNull()
    rerender(<HubFold id="etel" icon="t-bowl" label="Étel" count="4" open onToggle={vi.fn()}><p>gyerek</p></HubFold>)
    expect(screen.getByText('gyerek')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Étel · 4/ })).toHaveAttribute('aria-expanded', 'true')
  })

  it('calls onToggle on click', async () => {
    const onToggle = vi.fn()
    render(<HubFold id="etel" icon="t-bowl" label="Étel" count="4" open={false} onToggle={onToggle}><p>gyerek</p></HubFold>)
    await userEvent.click(screen.getByRole('button', { name: /Étel · 4/ }))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})
