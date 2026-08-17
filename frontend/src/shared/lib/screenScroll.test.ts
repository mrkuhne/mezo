import { afterEach, expect, test, vi } from 'vitest'
import { screenScroller, scrollToTop } from '@/shared/lib/screenScroll'

afterEach(() => {
  document.body.innerHTML = ''
})

test('screenScroller finds the .screen-content element, null when the shell is absent', () => {
  expect(screenScroller()).toBeNull()
  const el = document.createElement('div')
  el.className = 'screen-content'
  document.body.appendChild(el)
  expect(screenScroller()).toBe(el)
})

test('scrollToTop uses an INSTANT scrollTo (never the smooth-animated scrollTop assignment)', () => {
  const el = document.createElement('div')
  const scrollTo = vi.fn()
  Object.assign(el, { scrollTo })
  scrollToTop(el)
  expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' })
})

test('scrollToTop falls back to scrollTop where scrollTo is unavailable, and no-ops on null', () => {
  const el = document.createElement('div')
  // jsdom's scrollTop getter always reports 0, so spy on the setter instead.
  const setter = vi.fn()
  Object.defineProperty(el, 'scrollTop', { set: setter, get: () => 0 })
  Object.assign(el, { scrollTo: undefined })
  scrollToTop(el)
  expect(setter).toHaveBeenCalledWith(0)
  expect(() => scrollToTop(null)).not.toThrow()
})
