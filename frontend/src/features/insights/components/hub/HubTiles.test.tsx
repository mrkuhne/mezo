import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HubTiles } from '@/features/insights/components/hub/HubTiles'

describe('HubTiles', () => {
  it('renders four glass tiles with honest numbers, a dashed tile for an unavailable section', async () => {
    const onOpen = vi.fn()
    render(<HubTiles onOpen={onOpen}
      facts={{ state: 'ok', total: 52, sub: '49 bekapcsolva · 3 elhallgattatva' }}
      people={{ state: 'ok', total: 60, sub: '14 ember · 2 elhallgattatva' }}
      observations={{ state: 'off', total: 0, sub: '' }}
      effects={{ state: 'error', total: 0, sub: '', retry: vi.fn() }} />)
    expect(screen.getByRole('button', { name: /Rólad/ })).toHaveTextContent('52')
    expect(screen.getByText('A társ most nincs bekapcsolva.')).toBeInTheDocument()
    expect(screen.getByText('Most nem sikerült betölteni.')).toBeInTheDocument()
    expect(screen.queryByText('0')).toBeNull() // never an invented zero
    await userEvent.click(screen.getByRole('button', { name: /Emberek/ }))
    expect(onOpen).toHaveBeenCalledWith('emberek')
  })

  it('each tile carries its own accent; ok tiles are glass, unavailable ones dashed and not a door', () => {
    const { container } = render(<HubTiles onOpen={vi.fn()}
      facts={{ state: 'off', total: 0, sub: '' }}
      people={{ state: 'ok', total: 3, sub: 's' }}
      observations={{ state: 'loading', total: 0, sub: '' }}
      effects={{ state: 'ok', total: 5, sub: 's' }} />)
    const tiles = [...container.querySelectorAll<HTMLElement>('.th-tile')]
    expect(tiles.map((t) => t.style.getPropertyValue('--c'))).toEqual(
      ['var(--dv-rose)', 'var(--dv-lav)', 'var(--dv-amber)', 'var(--dv-sky)'])
    expect(tiles.map((t) => t.classList.contains('glass'))).toEqual([false, true, false, true])
    expect(screen.queryByRole('button', { name: /Rólad/ })).toBeNull()
    expect(screen.getByText('A társ most nincs bekapcsolva — a tények most nem elérhetők.')).toBeInTheDocument()
    expect(screen.getByText('Betöltés…')).toBeInTheDocument()
  })

  it('the retry control of a failed section calls its retry', async () => {
    const retry = vi.fn()
    render(<HubTiles onOpen={vi.fn()}
      facts={{ state: 'error', total: 0, sub: '', retry }}
      people={{ state: 'ok', total: 3, sub: 's' }}
      observations={{ state: 'ok', total: 1, sub: 's' }}
      effects={{ state: 'ok', total: 5, sub: 's' }} />)
    await userEvent.click(screen.getByRole('button', { name: 'Újrapróbálom ›' }))
    expect(retry).toHaveBeenCalledOnce()
  })
})
