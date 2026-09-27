import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HubRow } from '@/features/insights/components/hub/HubRow'
import { EDIT_ARIA } from '@/features/insights/logic/hubCopy'

const base = { rowKey: 'f:1', icon: 't-bowl' as const, accent: 'var(--dv-sage)', text: 'Laktózérzékeny vagy', muted: false, onMute: vi.fn(), onForget: vi.fn() }

describe('HubRow', () => {
  it('opens the ⋯ strip with the verbs, and Elhallgattatom calls onMute(true)', async () => {
    const onMute = vi.fn()
    render(<HubRow {...base} canEdit onMute={onMute} onEdit={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'További műveletek' }))
    expect(screen.getByRole('button', { name: /Javítom/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Elhallgattatom/ }))
    expect(onMute).toHaveBeenCalledWith(true)
  })

  it('a muted row offers Visszakapcsolom and shows why', async () => {
    const onMute = vi.fn()
    render(<HubRow {...base} muted why={{ text: 'te hallgattattad el', icon: 't-mute' }} onMute={onMute} />)
    expect(screen.getByText('te hallgattattad el')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Visszakapcsolom/ }))
    expect(onMute).toHaveBeenCalledWith(false)
  })

  it('Elfelejtem calls onForget', async () => {
    const onForget = vi.fn()
    render(<HubRow {...base} onForget={onForget} />)
    await userEvent.click(screen.getByRole('button', { name: 'További műveletek' }))
    await userEvent.click(screen.getByRole('button', { name: /Elfelejtem/ }))
    expect(onForget).toHaveBeenCalledTimes(1)
  })

  it('Javítom edits inline and saves the trimmed text', async () => {
    const onEdit = vi.fn()
    render(<HubRow {...base} canEdit onEdit={onEdit} />)
    await userEvent.click(screen.getByRole('button', { name: 'További műveletek' }))
    await userEvent.click(screen.getByRole('button', { name: /Javítom/ }))
    const box = screen.getByRole('textbox', { name: EDIT_ARIA })
    await userEvent.clear(box)
    await userEvent.type(box, '  Laktózérzékeny vagy, csak laktózmentes jöhet ')
    await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
    expect(onEdit).toHaveBeenCalledWith('Laktózérzékeny vagy, csak laktózmentes jöhet')
  })

  it('Mentés with unchanged or blank text is a no-op close', async () => {
    const onEdit = vi.fn()
    render(<HubRow {...base} canEdit onEdit={onEdit} />)
    await userEvent.click(screen.getByRole('button', { name: 'További műveletek' }))
    await userEvent.click(screen.getByRole('button', { name: /Javítom/ }))
    await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
    expect(screen.queryByRole('textbox')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'További műveletek' }))
    await userEvent.click(screen.getByRole('button', { name: /Javítom/ }))
    await userEvent.clear(screen.getByRole('textbox', { name: EDIT_ARIA }))
    await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
    expect(onEdit).not.toHaveBeenCalled()
    expect(screen.getByText('Laktózérzékeny vagy')).toBeInTheDocument()
  })

  it('a muted row hides Elhallgattatom, and canMute=false hides it too', async () => {
    const { unmount } = render(<HubRow {...base} muted />)
    await userEvent.click(screen.getByRole('button', { name: 'További műveletek' }))
    expect(screen.queryByRole('button', { name: /Elhallgattatom/ })).toBeNull()
    unmount()
    render(<HubRow {...base} canMute={false} />)
    await userEvent.click(screen.getByRole('button', { name: 'További műveletek' }))
    expect(screen.queryByRole('button', { name: /Elhallgattatom/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Elfelejtem/ })).toBeInTheDocument()
  })

  it('only one panel is open at a time: opening the source closes the strip', async () => {
    render(<HubRow {...base} source={() => <p>forrás</p>} />)
    const more = screen.getByRole('button', { name: 'További műveletek' })
    await userEvent.click(more)
    expect(more).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(screen.getByRole('button', { name: /Honnan tudom\?/ }))
    expect(more).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: /Elfelejtem/ })).toBeNull()
    expect(screen.getByText('forrás')).toBeInTheDocument()
  })

  it('Honnan tudom? renders the source lazily, only while open', async () => {
    const source = vi.fn(() => <p>forrás</p>)
    render(<HubRow {...base} source={source} />)
    expect(source).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /Honnan tudom\?/ }))
    expect(screen.getByText('forrás')).toBeInTheDocument()
  })

  it('hides Honnan tudom? when there is no source', () => {
    render(<HubRow {...base} />)
    expect(screen.queryByRole('button', { name: /Honnan tudom\?/ })).toBeNull()
  })

  it('highlights the query inside the title', () => {
    render(<HubRow {...base} query="laktoz" />)
    expect(screen.getByText('Laktóz', { selector: 'mark' })).toBeInTheDocument()
  })

  it('a row is flat, never a glass card (§3.4)', () => {
    const { container } = render(<HubRow {...base} />)
    expect(container.querySelector('.th-row')).not.toBeNull()
    expect(container.querySelector('.th-row.glass')).toBeNull()
  })
})
