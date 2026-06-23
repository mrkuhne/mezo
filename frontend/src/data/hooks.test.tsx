import { renderHook, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useTodayScenario, useCheckins, useRecipes, useRecipeActions } from './hooks'
import { QueryWrapper } from '@/test/queryWrapper'

const wrap = (path: string) => ({ children }: { children: ReactNode }) => (
  <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
)

test('useTodayScenario defaults: medium, retaDay 3, niggle on, vulnerable off, not anchor', () => {
  const { result } = renderHook(() => useTodayScenario(), { wrapper: wrap('/today') })
  expect(result.current).toEqual({ dayState: 'medium', retaDay: 3, niggle: true, vulnerable: false, anchorMode: false })
})
test('useTodayScenario parses params: rough → anchor, overrides', () => {
  const { result } = renderHook(() => useTodayScenario(), { wrapper: wrap('/today?day=rough&niggle=off&vulnerable=on&retaDay=6') })
  expect(result.current).toEqual({ dayState: 'rough', retaDay: 6, niggle: false, vulnerable: true, anchorMode: true })
})
test('useCheckins.saveCheckIn marks a slot done with values', () => {
  const { result } = renderHook(() => useCheckins(), { wrapper: QueryWrapper })
  act(() => result.current.saveCheckIn(2, { state: 'done', values: { energy: 8, stress: 3, body: 7, mental: 8 }, note: null }))
  expect(result.current.checkins[2].state).toBe('done')
  expect(result.current.checkins[2].values?.energy).toBe(8)
})

test('useRecipes + useRecipeActions are re-exported from @/data/hooks', () => {
  expect(typeof useRecipes).toBe('function')
  expect(typeof useRecipeActions).toBe('function')
})
