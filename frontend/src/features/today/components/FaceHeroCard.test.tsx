import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { FaceHeroCard } from '@/features/today/components/FaceHeroCard'
import type { TodayItem } from '@/features/today/logic/todayItems'

const NEXT: TodayItem = {
  id: 'habit:pushups', source: 'habit', face: 'reggel', status: 'open', tone: 'body', emoji: '🌅',
  tag: 'REGGELI RUTIN', title: '50 fekvőtámasz', subtitle: 'napfény után', time: null, xp: 10,
  group: 'Reggeli rutin', action: { kind: 'nav', to: '/x', label: 'Pipa' },
}

describe('FaceHeroCard', () => {
  test('shows the chain ratio as the title and draws the progress bar', () => {
    const { container } = render(
      <FaceHeroCard tone="body" emoji="🌅" tag="REGGELI RUTIN" title="Indul a lánc"
        done={3} total={8} next={NEXT} rest={['Gombakávé']} onAct={() => {}} />,
    )
    expect(screen.getByRole('heading', { name: 'Indul a lánc' })).toBeInTheDocument()
    expect(container.querySelector<HTMLElement>('.fhc-bar i')?.style.width).toBe('37.5%')
  })

  test('promotes the next step with its own action', () => {
    const onAct = vi.fn()
    render(<FaceHeroCard tone="body" emoji="🌅" tag="R" title="T" done={3} total={8}
      next={NEXT} rest={[]} onAct={onAct} />)
    expect(screen.getByText('50 fekvőtámasz')).toBeInTheDocument()
    expect(screen.getByText('napfény után · +10 XP')).toBeInTheDocument()
    screen.getByRole('button', { name: 'Pipa' }).click()
    expect(onAct).toHaveBeenCalledWith(NEXT)
  })

  test('renders the remaining steps as metapills', () => {
    const { container } = render(<FaceHeroCard tone="body" emoji="🌅" tag="R" title="T" done={3} total={8}
      next={NEXT} rest={['Gombakávé', 'Fehérjés reggeli']} onAct={() => {}} />)
    expect(container.querySelectorAll('.metapill')).toHaveLength(2)
  })

  test('without a next step there is no promoted row and no button', () => {
    render(<FaceHeroCard tone="body" emoji="🌅" tag="R" title="Kész a lánc" done={8} total={8}
      next={null} rest={[]} onAct={() => {}} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
