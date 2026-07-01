import { readStoredTheme, writeStoredTheme, applyTheme, THEME_KEY } from '@/lib/theme'

beforeEach(() => localStorage.clear())

test('readStoredTheme returns null when unset or invalid', () => {
  expect(readStoredTheme()).toBeNull()
  localStorage.setItem(THEME_KEY, 'banana')
  expect(readStoredTheme()).toBeNull()
})
test('write then read round-trips', () => {
  writeStoredTheme('light')
  expect(readStoredTheme()).toBe('light')
})
test('applyTheme sets data-theme=light and removes it for dark', () => {
  applyTheme('light')
  expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  applyTheme('dark')
  expect(document.documentElement.getAttribute('data-theme')).toBeNull()
})
