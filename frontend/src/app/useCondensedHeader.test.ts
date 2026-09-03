import { act, renderHook } from '@testing-library/react'
import { useCondensedHeader } from '@/app/useCondensedHeader'

/** A shell egyetlen görgetője; a hook ezt keresi meg. */
function mountScroller(): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'screen-content'
  document.body.appendChild(el)
  return el
}

afterEach(() => { document.body.innerHTML = '' })

test('scroller nélkül nem borul el és nem kompakt', () => {
  const { result } = renderHook(() => useCondensedHeader())
  expect(result.current).toBe(false)
})

test('a küszöb fölé görgetve kompakt lesz, vissza alá pedig nem', () => {
  const el = mountScroller()
  const { result } = renderHook(() => useCondensedHeader())
  expect(result.current).toBe(false)

  act(() => { el.scrollTop = 40; el.dispatchEvent(new Event('scroll')) })
  expect(result.current).toBe(true)

  act(() => { el.scrollTop = 0; el.dispatchEvent(new Event('scroll')) })
  expect(result.current).toBe(false)
})

test('a küszöbön (14px) még nem kompakt, fölötte igen', () => {
  const el = mountScroller()
  const { result } = renderHook(() => useCondensedHeader())

  act(() => { el.scrollTop = 14; el.dispatchEvent(new Event('scroll')) })
  expect(result.current).toBe(false)

  act(() => { el.scrollTop = 15; el.dispatchEvent(new Event('scroll')) })
  expect(result.current).toBe(true)
})

test('leszereléskor lekapcsolja a listenert', () => {
  const el = mountScroller()
  const remove = vi.spyOn(el, 'removeEventListener')
  const { unmount } = renderHook(() => useCondensedHeader())
  unmount()
  expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function))
})
