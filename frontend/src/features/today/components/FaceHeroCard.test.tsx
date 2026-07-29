import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { FaceHeroCard } from '@/features/today/components/FaceHeroCard'
import type { TodayItem } from '@/features/today/logic/todayItems'

const NEXT: TodayItem = {
  id: 'habit:pushups', source: 'habit', face: 'reggel', status: 'open', tone: 'body', emoji: '🌅',
  tag: 'REGGELI RUTIN', title: '50 fekvőtámasz', subtitle: 'napfény után', time: null, xp: 10,
  group: 'Reggeli rutin', action: { kind: 'nav', to: '/x', label: 'Pipa' }, linkUrl: null,
}

describe('FaceHeroCard', () => {
  test('shows the chain ratio as the title and draws the progress bar', () => {
    const { container } = render(
      <FaceHeroCard tone="body" emoji="🌅" tag="REGGELI RUTIN" title="Indul a lánc"
        done={3} total={8} next={NEXT} onAct={() => {}} />,
    )
    expect(screen.getByRole('heading', { name: 'Indul a lánc' })).toBeInTheDocument()
    expect(container.querySelector<HTMLElement>('.fhc-bar i')?.style.width).toBe('37.5%')
  })

  test('promotes the next step with its own action', () => {
    const onAct = vi.fn()
    render(<FaceHeroCard tone="body" emoji="🌅" tag="R" title="T" done={3} total={8}
      next={NEXT} onAct={onAct} />)
    expect(screen.getByText('50 fekvőtámasz')).toBeInTheDocument()
    expect(screen.getByText('napfény után · +10 XP')).toBeInTheDocument()
    screen.getByRole('button', { name: 'Pipa' }).click()
    expect(onAct).toHaveBeenCalledWith(NEXT)
  })

  test('does NOT repeat the remaining steps as metapills — they are actionable rows now', () => {
    const { container } = render(<FaceHeroCard tone="body" emoji="🌅" tag="R" title="T" done={3} total={8}
      next={NEXT} onAct={() => {}} />)
    expect(container.querySelectorAll('.metapill')).toHaveLength(0)
  })

  test('the promoted step exposes its external content alongside its action', () => {
    const next: TodayItem = { ...NEXT, title: 'Reggeli videó', linkUrl: 'https://example.test/v' }
    render(<FaceHeroCard tone="body" emoji="🌅" tag="R" title="T" done={3} total={8}
      next={next} onAct={() => {}} />)
    const link = screen.getByRole('link', { name: 'Reggeli videó megnyitása' })
    expect(link).toHaveAttribute('href', 'https://example.test/v')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'))
    // the link never swallows the action
    expect(screen.getByRole('button', { name: 'Pipa' })).toBeInTheDocument()
  })

  test('a promoted step without external content exposes no link', () => {
    render(<FaceHeroCard tone="body" emoji="🌅" tag="R" title="T" done={3} total={8}
      next={NEXT} onAct={() => {}} />)
    expect(screen.queryByRole('link')).toBeNull()
  })

  test('without a next step there is no promoted row and no button', () => {
    render(<FaceHeroCard tone="body" emoji="🌅" tag="R" title="Kész a lánc" done={8} total={8}
      next={null} onAct={() => {}} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  test('a zero-total chain draws a 0% bar, not NaN%', () => {
    const { container } = render(
      <FaceHeroCard tone="body" emoji="🌅" tag="R" title="T" done={0} total={0} next={null} onAct={() => {}} />,
    )
    expect(container.querySelector<HTMLElement>('.fhc-bar i')?.style.width).toBe('0%')
  })

  test('the promoted subtitle drops the leading separator when there is no subtitle', () => {
    const next: TodayItem = { ...NEXT, subtitle: null }
    render(<FaceHeroCard tone="body" emoji="🌅" tag="R" title="T" done={3} total={8}
      next={next} onAct={() => {}} />)
    expect(screen.getByText('+10 XP')).toBeInTheDocument()
  })

  test('the promoted subtitle drops the trailing separator when there is no xp', () => {
    const next: TodayItem = { ...NEXT, xp: null }
    render(<FaceHeroCard tone="body" emoji="🌅" tag="R" title="T" done={3} total={8}
      next={next} onAct={() => {}} />)
    expect(screen.getByText('napfény után')).toBeInTheDocument()
  })

  test('a promoted next step with no action still renders its text but no button', () => {
    const next: TodayItem = { ...NEXT, action: null }
    render(<FaceHeroCard tone="body" emoji="🌅" tag="R" title="T" done={3} total={8}
      next={next} onAct={() => {}} />)
    expect(screen.getByText('50 fekvőtámasz')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
