import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { ItemRow } from '@/shared/ui/ItemRow'

describe('ItemRow', () => {
  test('renders title, subtitle and the trailing time when no action is given', () => {
    const { container } = render(
      <ItemRow tone="gym" emoji="🏋️" title="Pull Day" subtitle="Gym · MAV · ~78 perc" time="17:00" />,
    )
    expect(screen.getByText('Pull Day')).toBeInTheDocument()
    expect(screen.getByText('Gym · MAV · ~78 perc')).toBeInTheDocument()
    expect(screen.getByText('17:00')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.querySelector('.itemrow-gym')).toBeTruthy()
  })

  test('an actionLabel + onAction renders a real button that fires', () => {
    const onAction = vi.fn()
    render(<ItemRow tone="mind" emoji="📖" title="Olvass 10 percet" actionLabel="Naplózz" onAction={onAction} />)
    screen.getByRole('button', { name: 'Naplózz' }).click()
    expect(onAction).toHaveBeenCalledOnce()
  })

  test('an actionLabel WITHOUT onAction is inert copy, not a button', () => {
    render(<ItemRow tone="mind" emoji="🌙" title="Napzárás" actionLabel="Még vár" />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Még vár')).toBeInTheDocument()
  })

  test('done dims the row and swaps the shield glyph for a check', () => {
    const { container } = render(<ItemRow tone="body" emoji="⚖️" title="Reggeli súlymérés" done />)
    expect(container.querySelector('.itemrow.is-done')).toBeTruthy()
    expect(container.querySelector('.itemrow-ic')?.textContent).toBe('✓')
  })

  test('the whole row is a button when onAction is given without an actionLabel', () => {
    const onAction = vi.fn()
    render(<ItemRow tone="gym" emoji="🏋️" title="Pull Day" time="17:00" onAction={onAction} ariaLabel="Pull Day megnyitása" />)
    screen.getByRole('button', { name: 'Pull Day megnyitása' }).click()
    expect(onAction).toHaveBeenCalledOnce()
  })
})
