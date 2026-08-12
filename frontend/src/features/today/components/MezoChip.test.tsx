import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { MezoChip } from '@/features/today/components/MezoChip'
import type { MezoMessageItem } from '@/features/today/logic/mezoMessages'

const msg = (id: string, first: string): MezoMessageItem => ({
  id, eyebrow: 'Reggeli briefing', time: '06:30', paragraphs: [first], refs: [], meta: null,
})

describe('MezoChip', () => {
  test('üzenet nélkül SEMMIT nem renderel (honest absence)', () => {
    const { container } = render(<MezoChip messages={[]} unread={false} onOpen={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  test('a legfrissebb üzenet első mondatát mutatja', () => {
    render(<MezoChip unread={false} onOpen={() => {}}
      messages={[msg('briefing', 'Jó reggelt.'), msg('note', 'Fehérjéből 100 g van meg.')]} />)
    expect(screen.getByText('Fehérjéből 100 g van meg.')).toBeInTheDocument()
    expect(screen.queryByText('Jó reggelt.')).not.toBeInTheDocument()
  })

  test('a plecsni az üzenetek darabszáma', () => {
    render(<MezoChip unread={false} onOpen={() => {}}
      messages={[msg('a', 'x'), msg('b', 'y'), msg('c', 'z')]} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  test('az akadálymentes név hordozza a darabszámot és az olvasatlanságot', () => {
    render(<MezoChip messages={[msg('a', 'x'), msg('b', 'y')]} unread onOpen={() => {}} />)
    expect(screen.getByRole('button', { name: /Mezo üzenetei, 2 üzenet, olvasatlan/ })).toBeInTheDocument()
  })

  test('olvasottan nincs olvasatlan-pötty és a név sem említi', () => {
    const { container } = render(
      <MezoChip messages={[msg('a', 'x')]} unread={false} onOpen={() => {}} />,
    )
    expect(container.querySelector('.td-av.is-unread')).toBeNull()
    expect(screen.getByRole('button', { name: /Mezo üzenetei, 1 üzenet$/ })).toBeInTheDocument()
  })

  test('olvasatlanul ott a pötty', () => {
    const { container } = render(<MezoChip messages={[msg('a', 'x')]} unread onOpen={() => {}} />)
    expect(container.querySelector('.td-av.is-unread')).toBeInTheDocument()
  })

  test('a TELJES chip a gomb, és megnyitja a szálat', async () => {
    const onOpen = vi.fn()
    render(<MezoChip messages={[msg('a', 'x')]} unread onOpen={onOpen} />)
    const chip = screen.getByRole('button', { name: /Mezo üzenetei/ })
    expect(chip).toHaveAttribute('aria-haspopup', 'dialog')
    await userEvent.click(chip)
    expect(onOpen).toHaveBeenCalledOnce()
  })
})
