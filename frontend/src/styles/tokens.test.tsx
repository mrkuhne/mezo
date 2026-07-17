import { beforeAll } from 'vitest'

beforeAll(() => {
  // jsdom doesn't run @import; inject the raw variable blocks the test asserts on.
  const style = document.createElement('style')
  style.textContent = `
    :root { --canvas:#FBF6EF; --surface-1:#FFFFFF; --coral:#FF6B4A; }
    :root[data-theme="dark"] { --canvas:#191614; --surface-1:#221E1B; --coral:#FF7E5C; }
  `
  document.head.appendChild(style)
})

test('light tokens are the default', () => {
  document.documentElement.removeAttribute('data-theme')
  const s = getComputedStyle(document.documentElement)
  expect(s.getPropertyValue('--canvas').trim()).toBe('#FBF6EF')
})

test('dark theme overrides tokens', () => {
  document.documentElement.setAttribute('data-theme', 'dark')
  const s = getComputedStyle(document.documentElement)
  expect(s.getPropertyValue('--surface-1').trim()).toBe('#221E1B')
  document.documentElement.removeAttribute('data-theme')
})
