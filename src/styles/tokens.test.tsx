import { beforeAll } from 'vitest'

beforeAll(() => {
  // jsdom doesn't run @import; inject the raw variable blocks the test asserts on.
  const style = document.createElement('style')
  style.textContent = `
    :root { --canvas:#0A0F14; --surface-1:#121A22; --brand-glow:#5EEAD4; }
    :root[data-theme="light"] { --canvas:#F4F6F8; --surface-1:#FFFFFF; --brand-glow:#0E7C7B; }
  `
  document.head.appendChild(style)
})

test('dark tokens are the default', () => {
  document.documentElement.removeAttribute('data-theme')
  const s = getComputedStyle(document.documentElement)
  expect(s.getPropertyValue('--canvas').trim()).toBe('#0A0F14')
})

test('light theme overrides tokens', () => {
  document.documentElement.setAttribute('data-theme', 'light')
  const s = getComputedStyle(document.documentElement)
  expect(s.getPropertyValue('--surface-1').trim()).toBe('#FFFFFF')
  document.documentElement.removeAttribute('data-theme')
})
