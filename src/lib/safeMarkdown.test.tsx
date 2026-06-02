import { render } from '@testing-library/react'
import { SafeMarkdown } from './safeMarkdown'

test('renders **bold** as <strong> without raw HTML injection', () => {
  const { container } = render(<SafeMarkdown text="hello **world**" />)
  expect(container.querySelector('strong')?.textContent).toBe('world')
})
test('escapes/ignores embedded HTML (no XSS)', () => {
  const { container } = render(<SafeMarkdown text={'<img src=x onerror=alert(1)> **safe**'} />)
  expect(container.querySelector('img')).toBeNull()
  expect(container.textContent).toContain('<img src=x onerror=alert(1)>')
  expect(container.querySelector('strong')?.textContent).toBe('safe')
})
