import { beforeAll } from 'vitest'

beforeAll(() => {
  // jsdom doesn't run @import; inject a mirror of the P1 token architecture
  // (DS literals + legacy alias bridge) that the tests assert on.
  const style = document.createElement('style')
  style.textContent = `
    :root {
      --surface-page:#FBF6EF; --surface-card:#FFFFFF;
      --primary-base:#FF6B4A; --primary-deep:#A84A26;
      --canvas:var(--surface-page); --coral:var(--primary-base);
    }
    :root[data-theme="dark"] {
      --surface-page:#191614; --surface-card:#221E1B;
      --primary-base:#FF7E5C; --primary-deep:#F0966B;
    }
  `
  document.head.appendChild(style)
})

test('light DS tokens are the default', () => {
  document.documentElement.removeAttribute('data-theme')
  const s = getComputedStyle(document.documentElement)
  expect(s.getPropertyValue('--surface-page').trim()).toBe('#FBF6EF')
  expect(s.getPropertyValue('--primary-deep').trim()).toBe('#A84A26')
})

test('dark theme overrides DS tokens', () => {
  document.documentElement.setAttribute('data-theme', 'dark')
  const s = getComputedStyle(document.documentElement)
  expect(s.getPropertyValue('--surface-card').trim()).toBe('#221E1B')
  expect(s.getPropertyValue('--primary-deep').trim()).toBe('#F0966B')
  document.documentElement.removeAttribute('data-theme')
})

test('legacy names are aliases onto DS tokens (the P1 bridge)', () => {
  const s = getComputedStyle(document.documentElement)
  // jsdom returns the declared value for custom props — which is exactly the
  // contract under test: legacy tokens must POINT at DS tokens, not hold literals.
  expect(s.getPropertyValue('--canvas').trim()).toBe('var(--surface-page)')
  expect(s.getPropertyValue('--coral').trim()).toBe('var(--primary-base)')
})

test('folyadék tokens live on bare :root (mezo-n4wf5.1, bible §3)', async () => {
  const css = (await import('@/styles/folyadek.css?raw')).default
  const root = css.match(/(?:^|\n):root\s*\{([^}]*)\}/)![1]
  for (const t of ['--fo-ink', '--fo-sub', '--fo-faint', '--fo-page', '--fo-card', '--dom', '--dom2', '--liq1', '--liq2']) {
    expect(root).toContain(`${t}:`)
  }
  for (const d of ['train', 'fuel', 'mezo', 'me']) {
    expect(css).toContain(`.phone-screen[data-domain="${d}"]`)
  }
})

test('the folyadék ground beats the warm day-part tints in light only, and hides .sky (mezo-n4wf5.1)', async () => {
  const css = (await import('@/styles/folyadek.css?raw')).default
  const ground = css.match(/([^{}]*)\{\s*background:\s*linear-gradient[^}]*\}/)![1].trim()
  expect(ground).toContain(':not([data-theme="dark"])')
  expect(ground).toContain('[data-domain]')
  expect(css).toMatch(/:not\(\[data-theme="dark"\]\)\s+\.phone-screen\[data-domain\]\s+\.sky\s*\{\s*display:\s*none/)
})
