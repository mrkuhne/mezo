import { readStoredTheme, writeStoredTheme, applyTheme, THEME_KEY, DEFAULT_THEME } from '@/shared/lib/theme'

beforeEach(() => {
  localStorage.clear()
  document.querySelector('meta[name="theme-color"]')?.remove()
  document.head.insertAdjacentHTML('beforeend', '<meta name="theme-color" content="#F4F6F8">')
})

test('DEFAULT_THEME is light', () => {
  expect(DEFAULT_THEME).toBe('light')
})
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
test('applyTheme syncs the browser-chrome theme-color meta', () => {
  const meta = document.querySelector('meta[name="theme-color"]')!
  applyTheme('dark')
  expect(meta.getAttribute('content')).toBe('#0A0F14')
  applyTheme('light')
  expect(meta.getAttribute('content')).toBe('#F4F6F8')
})
