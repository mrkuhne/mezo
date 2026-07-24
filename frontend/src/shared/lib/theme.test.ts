import { readStoredTheme, writeStoredTheme, applyTheme, THEME_KEY, DEFAULT_THEME } from '@/shared/lib/theme'
import { DEFAULT_MODE, readStoredMode, writeStoredMode } from '@/shared/lib/theme'

beforeEach(() => {
  localStorage.clear()
  document.querySelector('meta[name="theme-color"]')?.remove()
  document.head.insertAdjacentHTML('beforeend', '<meta name="theme-color" content="#FBF6EF">')
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
test('applyTheme sets data-theme=dark and removes it for light', () => {
  applyTheme('dark')
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  applyTheme('light')
  expect(document.documentElement.getAttribute('data-theme')).toBeNull()
})
test('applyTheme syncs the browser-chrome theme-color meta', () => {
  const meta = document.querySelector('meta[name="theme-color"]')!
  applyTheme('dark')
  expect(meta.getAttribute('content')).toBe('#191614')
  applyTheme('light')
  expect(meta.getAttribute('content')).toBe('#FBF6EF')
})

describe('theme mode storage (mezo-d71m)', () => {
  beforeEach(() => localStorage.clear())

  test('default mode is auto', () => {
    expect(DEFAULT_MODE).toBe('auto')
  })
  test('round-trips all three modes, legacy values stay valid', () => {
    for (const m of ['light', 'dark', 'auto'] as const) {
      writeStoredMode(m)
      expect(readStoredMode()).toBe(m)
    }
    localStorage.setItem(THEME_KEY, 'garbage')
    expect(readStoredMode()).toBeNull()
  })
})
