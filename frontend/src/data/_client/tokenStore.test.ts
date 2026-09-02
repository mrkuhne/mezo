import { tokenStore, TOKEN_KEY } from '@/data/_client/tokenStore'

beforeEach(() => localStorage.clear())

test('set persists to localStorage and get reads it back', () => {
  tokenStore.set('abc')
  expect(localStorage.getItem(TOKEN_KEY)).toBe('abc')
  expect(tokenStore.get()).toBe('abc')
})

test('clear removes the token', () => {
  tokenStore.set('abc')
  tokenStore.clear()
  expect(tokenStore.get()).toBeNull()
  expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
})

test('get survives a throwing storage (private mode) by returning the in-memory value', () => {
  tokenStore.set('mem')
  const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
  expect(tokenStore.get()).toBe('mem')
  spy.mockRestore()
})
