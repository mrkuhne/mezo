import { renderHook } from '@testing-library/react'
import { usePeople, useKnowledge } from '@/data/hooks'
import { affectLabel } from '@/data/me/people'

test('usePeople returns the people list + mentions', () => {
  const { result } = renderHook(() => usePeople())
  expect(result.current.people).toHaveLength(5)
  expect(result.current.mentions).toHaveLength(10)
  expect(result.current.mentions.filter(m => m.flagged)).toHaveLength(2)
})

test('useKnowledge returns 15 facts, 13 edges, 14 active', () => {
  const { result } = renderHook(() => useKnowledge())
  expect(result.current.facts).toHaveLength(15)
  expect(result.current.edges).toHaveLength(13)
  expect(result.current.activeCount).toBe(14)
})

test('affectLabel maps the enum to Hungarian', () => {
  expect(affectLabel('mixed')).toBe('Vegyes')
  expect(affectLabel('negative')).toBe('Nehéz')
})
