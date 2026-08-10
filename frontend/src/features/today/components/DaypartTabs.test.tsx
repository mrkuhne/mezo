import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { DaypartTabs } from '@/features/today/components/DaypartTabs'

describe('DaypartTabs', () => {
  test('renders the three dayparts in chronological order', () => {
    render(<DaypartTabs selected="nap" current="nap" onSelect={() => {}} />)
    const tabs = screen.getAllByRole('button')
    expect(tabs.map((t) => t.textContent?.trim())).toEqual(['🌅 Reggel', '☀️ Nap', '🌙 Este'])
  })

  test('the selected daypart is the pressed segment', () => {
    render(<DaypartTabs selected="este" current="reggel" onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: /Este/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Nap/ })).toHaveAttribute('aria-pressed', 'false')
  })

  test('the MOST marker follows the CLOCK, not the selection', () => {
    render(<DaypartTabs selected="este" current="reggel" onSelect={() => {}} />)
    const now = screen.getByLabelText('most')
    expect(screen.getByRole('button', { name: /Reggel/ })).toContainElement(now)
    expect(screen.getAllByLabelText('most')).toHaveLength(1)
  })

  test('clicking a segment reports its face', async () => {
    const onSelect = vi.fn()
    render(<DaypartTabs selected="nap" current="nap" onSelect={onSelect} />)
    await userEvent.click(screen.getByRole('button', { name: /Reggel/ }))
    expect(onSelect).toHaveBeenCalledWith('reggel')
  })

  test('the group carries a spoken Hungarian label', () => {
    render(<DaypartTabs selected="nap" current="nap" onSelect={() => {}} />)
    expect(screen.getByRole('group', { name: 'Napszak' })).toBeInTheDocument()
  })
})
