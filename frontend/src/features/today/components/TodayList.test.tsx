import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { TodayList } from '@/features/today/components/TodayList'
import { TodayRow } from '@/features/today/components/TodayRow'

describe('TodayList', () => {
  test('a sorokat EGY dobozba fogja', () => {
    const { container } = render(
      <TodayList>
        <TodayRow tone="habit" icon="💪" title="Egy" accessory="none" />
        <TodayRow tone="habit" icon="☕" title="Kettő" accessory="none" />
      </TodayList>,
    )
    const boxes = container.querySelectorAll('.td-list')
    expect(boxes).toHaveLength(1)
    expect(boxes[0].querySelectorAll('.td-row')).toHaveLength(2)
  })

  test('a fejléc a dobozon KÍVÜL, fölötte áll', () => {
    const { container } = render(
      <TodayList label="Reggeli rutin" count={5}>
        <TodayRow tone="habit" icon="💪" title="Egy" accessory="none" />
      </TodayList>,
    )
    expect(screen.getByText('Reggeli rutin · 5')).toBeInTheDocument()
    const head = container.querySelector('.td-sech')
    expect(head?.nextElementSibling).toHaveClass('td-list')
  })

  test('fejléc nélkül nem renderel fejlécet', () => {
    const { container } = render(
      <TodayList><TodayRow tone="habit" icon="💪" title="Egy" accessory="none" /></TodayList>,
    )
    expect(container.querySelector('.td-sech')).toBeNull()
  })

  test('a fejléc jobb oldali linkje megjelenik', () => {
    render(
      <TodayList label="Napi küldetések" count={1} action={<a href="/me/growth">1/3 · +48 XP ›</a>}>
        <TodayRow tone="quest" icon="📖" title="Olvass" accessory="none" />
      </TodayList>,
    )
    expect(screen.getByRole('link', { name: '1/3 · +48 XP ›' })).toBeInTheDocument()
  })
})
