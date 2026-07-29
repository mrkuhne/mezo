import { fireEvent, render, screen } from '@testing-library/react'
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

  test('a linkUrl exposes a new-tab link to that URL', () => {
    render(<ItemRow tone="body" emoji="🌅" title="Reggeli videó" linkUrl="https://example.test/video" />)
    const link = screen.getByRole('link', { name: 'Reggeli videó megnyitása' })
    expect(link).toHaveAttribute('href', 'https://example.test/video')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'))
  })

  test('a row without a linkUrl exposes no link', () => {
    render(<ItemRow tone="body" emoji="🌅" title="Reggeli napfény" actionLabel="Pipa" onAction={vi.fn()} />)
    expect(screen.queryByRole('link')).toBeNull()
  })

  test('the link and the action pill coexist — neither swallows the other', () => {
    const onAction = vi.fn()
    render(
      <ItemRow tone="body" emoji="🌅" title="Reggeli videó" actionLabel="Pipa" onAction={onAction}
        linkUrl="https://example.test/video" />,
    )
    expect(screen.getByRole('link', { name: 'Reggeli videó megnyitása' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Pipa' }))
    expect(onAction).toHaveBeenCalledOnce()
  })

  test('a link-bearing whole-row button keeps BOTH: the action fires and the <a> is not nested', () => {
    const onAction = vi.fn()
    const { container } = render(
      <ItemRow tone="body" emoji="🌅" title="Reggeli videó" onAction={onAction} ariaLabel="Videó megnyitása"
        linkUrl="https://example.test/video" />,
    )
    // the <a> must never sit inside the row's own <button> (invalid + click-conflicting)…
    expect(container.querySelector('button a')).toBeNull()
    expect(screen.getByRole('link', { name: 'Reggeli videó megnyitása' })).toBeInTheDocument()
    // …and the action is NOT silently dropped: the hit area is an inner button
    fireEvent.click(screen.getByRole('button', { name: 'Videó megnyitása' }))
    expect(onAction).toHaveBeenCalledOnce()
  })

  test('disabled withdraws the action pill to inert copy — nothing stays clickable', () => {
    const onAction = vi.fn()
    render(<ItemRow tone="body" emoji="🌅" title="Napfény" actionLabel="Pipa" onAction={onAction} disabled />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Pipa')).toBeInTheDocument() // the label stays — no layout jump
  })

  test('disabled also withdraws the whole-row button shape', () => {
    render(<ItemRow tone="gym" emoji="🏋️" title="Pull Day" onAction={vi.fn()} ariaLabel="Pull Day megnyitása" disabled />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  test('disabled never touches a row that has no action', () => {
    const { container } = render(<ItemRow tone="body" emoji="🌅" title="Napfény" time="07:00" disabled />)
    expect(container.querySelector('.itemrow-tm')?.textContent).toBe('07:00')
  })
})
