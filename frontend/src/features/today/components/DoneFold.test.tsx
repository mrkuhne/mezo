import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { DoneFold } from '@/features/today/components/DoneFold'
import type { TodayItem } from '@/features/today/logic/todayItems'

const done = (id: string, title: string): TodayItem => ({
  id, source: 'habit', face: 'reggel', status: 'done', tone: 'body', emoji: '🌅', tag: 'R',
  title, subtitle: null, time: null, xp: 10, group: 'Reggeli rutin', action: null,
})

describe('DoneFold', () => {
  test('renders nothing when nothing is done', () => {
    const { container } = render(<DoneFold items={[]} xp={0} />)
    expect(container.firstChild).toBeNull()
  })

  test('summarises count and XP, collapsed by default', () => {
    render(<DoneFold items={[done('a', 'Ébredés időben'), done('b', 'Reggeli napfény')]} xp={40} />)
    expect(screen.getByRole('button', { name: /2 tétel/ })).toBeInTheDocument()
    expect(screen.queryByText('Ébredés időben')).toBeNull()
  })

  test('expands to list the done items and collapses again', () => {
    render(<DoneFold items={[done('a', 'Ébredés időben')]} xp={10} />)
    const toggle = screen.getByRole('button')
    fireEvent.click(toggle)
    expect(screen.getByText('Ébredés időben')).toBeInTheDocument()
    fireEvent.click(toggle)
    expect(screen.queryByText('Ébredés időben')).toBeNull()
  })
})
