import { afterEach, describe, expect, it } from 'vitest'
import { autoGrow, installAutoGrow } from './autoGrow'

// jsdom has no layout, so the heights the browser would compute are stubbed per element.
function field(designed: number, content: number): HTMLTextAreaElement {
  const el = document.createElement('textarea')
  Object.defineProperty(el, 'offsetHeight', { configurable: true, get: () => designed })
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => content })
  document.body.appendChild(el)
  return el
}

afterEach(() => { document.body.innerHTML = '' })

describe('autoGrow', () => {
  it('keeps the designed height as a floor', () => {
    const el = field(40, 20)
    autoGrow(el)
    expect(el.style.height).toBe('40px')
  })

  it('grows with the content', () => {
    const el = field(40, 180)
    autoGrow(el)
    expect(el.style.height).toBe('180px')
  })

  it('stops at 40% of the viewport, then the field scrolls', () => {
    window.innerHeight = 800
    const el = field(40, 2000)
    autoGrow(el)
    expect(el.style.height).toBe('320px')
  })

  it('respects an opt-out', () => {
    const el = field(40, 180)
    el.dataset.autogrow = 'off'
    autoGrow(el)
    expect(el.style.height).toBe('')
  })

  it('resizes on typing once installed', () => {
    installAutoGrow()
    const el = field(40, 120)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    expect(el.style.height).toBe('120px')
  })
})
