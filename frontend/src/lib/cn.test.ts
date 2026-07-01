import { cn } from '@/lib/cn'

test('joins truthy class names and skips falsy', () => {
  expect(cn('a', false, 'b', undefined, null, 'c')).toBe('a b c')
})
test('returns empty string for no truthy parts', () => {
  expect(cn(false, undefined)).toBe('')
})
