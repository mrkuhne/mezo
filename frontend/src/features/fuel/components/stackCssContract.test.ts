// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const css = readFileSync(new URL('../../../styles/prototype.css', import.meta.url), 'utf8')
const marker = 'Fuel Stack 3.0 (mezo-ubxd)'
const stackCss = css.slice(css.indexOf(marker))

describe('Fuel Stack 3.0 scoped CSS contract', () => {
  test.each([
    '.stk-hub-page', '.stk-hub-next', '.stk-hub-progress', '.stk-rhythm-preview',
    '.stk-page-hero', '.stk-timeline', '.stk-manage-grid', '.stk-manage-row',
    '.stk-add-row', '.stk-item-sheet',
  ])('defines %s', selector => {
    expect(css).toContain(selector)
  })

  test('the feature section stays scoped to stk selectors', () => {
    expect(css).toContain(marker)
    expect(stackCss).not.toMatch(/(^|\n)\s*\.(?:card|row|mz-page|toast)(?:[\s,{.:#]|$)/)
  })

  test('44px hit areas cover intake, management and add actions', () => {
    expect(stackCss).toMatch(/\.stk-hub-check[^{]*\{[^}]*min-width:\s*44px[^}]*min-height:\s*44px/s)
    expect(stackCss).toMatch(/\.stk-manage-row[^{]*\{[^}]*min-height:\s*44px/s)
    expect(stackCss).toMatch(/\.stk-add-row[^{]*\{[^}]*min-height:\s*44px/s)
  })

  test('reduced motion neutralizes hero and progress animation', () => {
    const reduced = stackCss.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
    expect(reduced).toContain('.stk-hub-progress-fill')
    expect(reduced).toContain('.stk-hub-next')
    expect(reduced).toContain('animation: none')
  })
})
