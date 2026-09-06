import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { CoachingRuleTile } from '@/features/insights/components/CoachingRuleTile'
import type { CoachingRule } from '@/data/types'

const rule = (over: Partial<CoachingRule> = {}): CoachingRule => ({
  flagKey: 'sleep_debt', label: 'Alvásadósság', domain: 'sleep', rank: 6,
  outcome: 'clear', reasonText: 'alvás 6,8 h átlag — a 6,0 h küszöb fölött',
  facts: ['Mért érték: 6,8 · küszöb: 6,0'], ...over,
})

describe('CoachingRuleTile', () => {
  test('shows rank, name, state and the one evidence line without being opened', () => {
    render(<CoachingRuleTile rule={rule()} />)
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('Alvásadósság')).toBeInTheDocument()
    expect(screen.getByText('Rendben')).toBeInTheDocument()
    expect(screen.getByText('alvás 6,8 h átlag — a 6,0 h küszöb fölött')).toBeInTheDocument()
  })

  test('tapping expands the evidence rows', async () => {
    render(<CoachingRuleTile rule={rule()} />)
    const head = screen.getByRole('button', { name: /Alvásadósság/ })
    expect(head).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(head)
    expect(head).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Mért érték: 6,8 · küszöb: 6,0')).toBeVisible()
  })

  test('a rule with nothing to show is not expandable — no empty drawer', () => {
    render(<CoachingRuleTile rule={rule({ outcome: 'unavailable', facts: [] })} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Nem mérhető')).toBeInTheDocument()
  })

  test('a cooldown-suppressed raise reads Pihenőn — it does not vanish', () => {
    render(<CoachingRuleTile rule={rule({ outcome: 'raised', disposition: 'suppressed_by_cooldown' })} />)
    expect(screen.getByText('Pihenőn')).toBeInTheDocument()
  })

  test('the winner carries the gold ring and the Nyertes stamp', () => {
    const { container } = render(<CoachingRuleTile rule={rule()} winner />)
    expect(screen.getByText('Nyertes')).toBeInTheDocument()
    expect(container.querySelector('.mzo-rule.is-winner')).not.toBeNull()
  })

  test('a rule the frontend has never seen renders whole (the round-2 guarantee)', () => {
    render(<CoachingRuleTile rule={rule({
      flagKey: 'round_two_rule', label: 'Új szabály', domain: 'something_new', rank: 1,
      reasonText: 'Rendben.', facts: [],
    })} />)
    expect(screen.getByText('Új szabály')).toBeInTheDocument()
    expect(screen.getByText('Rendben')).toBeInTheDocument()
  })
})
