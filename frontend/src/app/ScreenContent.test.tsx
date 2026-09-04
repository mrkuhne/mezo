import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useNavigate, useSearchParams } from 'react-router-dom'
import { ScreenContent } from '@/app/ScreenContent'
import { ArrivalProvider } from '@/shared/ui/mozaik/arrival'
// Vite `?raw` — the CSS source as a string (the reducedMotionGuard.test.ts precedent).
import prototypeCss from '@/styles/prototype.css?raw'

// Scroll handling of the app's ONE scroll container. A route change parks the new screen at
// the top; a BACK navigation puts the user back where they left off instead (mezo-kuwj) —
// losing the offset is half of what makes swipe-back feel like a reload.

/**
 * jsdom has no layout, so `.screen-content` can neither scroll nor report an offset: its
 * `scrollTop` is a hard 0 and `scrollTo` does not exist. Give the REAL element a working
 * pair of both, so what the assertions observe is the component's own save/restore logic.
 */
function instrument(el: HTMLElement, limit: { max: number }): () => number {
  let offset = 0
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => offset,
    // Browsers clamp a write to whatever the current content height allows — the part that
    // makes restoring an offset onto a still-growing page interesting.
    set: (v: number) => { offset = Math.min(v, limit.max) },
  })
  Object.defineProperty(el, 'scrollTo', {
    configurable: true,
    value: (opts: ScrollToOptions) => {
      el.scrollTop = opts.top ?? 0
      el.dispatchEvent(new Event('scroll'))
    },
  })
  return () => offset
}

function Nav({ label, to }: { label: string, to: string | number }) {
  const navigate = useNavigate()
  return <button onClick={() => navigate(to as string)}>{label}</button>
}

function DayHop() {
  // The Mai day-hop / FuelLog day-step shape: a search-param-only `replace` navigation.
  const [params, setSearchParams] = useSearchParams()
  return (
    <button onClick={() => setSearchParams(new URLSearchParams({ day: String(Number(params.get('day') ?? 0) + 1) }), { replace: true })}>
      day-hop
    </button>
  )
}

function mount(entries: string[] = ['/a'], index?: number) {
  const view = render(
    <MemoryRouter initialEntries={entries} initialIndex={index}>
      <ArrivalProvider>
        <ScreenContent>
          <Nav label="deeper" to="/b" />
          <Nav label="back" to={-1} />
          <DayHop />
        </ScreenContent>
      </ArrivalProvider>
    </MemoryRouter>,
  )
  const el = view.container.querySelector('.screen-content') as HTMLElement
  const limit = { max: Infinity }
  // Instrumented AFTER mount: the mount reset already ran on the raw element, and every
  // assertion below is about a LATER navigation anyway.
  return { ...view, el, limit, offset: instrument(el, limit) }
}

function scrollTo(el: HTMLElement, top: number) {
  el.scrollTop = top
  fireEvent.scroll(el)
}

test('the scroller is marked as a return, so the CSS-only entrance families settle too', () => {
  // `.rise` is armed per-mount in JS (EntranceGroup), but `.np-anim` — the Napív entrance the
  // train hero and the ritual steps use — carries its own `opacity: 0` with no arming class
  // at all, so nothing but a marker in the DOM can stop IT replaying on a back navigation.
  const { el } = mount()
  expect(el.dataset.arrival).toBe('push')
  fireEvent.click(screen.getByRole('button', { name: 'deeper' }))
  expect(el.dataset.arrival).toBe('push')
  fireEvent.click(screen.getByRole('button', { name: 'back' }))
  expect(el.dataset.arrival).toBe('pop')
})

test('the marker actually neutralises .np-anim in the stylesheet', () => {
  // The marker is only half the mechanism; without the rule it is an unused attribute.
  const rule = prototypeCss.match(/\[data-arrival="pop"\][^{]*\.np-anim[^{]*\{([^}]*)\}/)
  expect(rule).not.toBeNull()
  expect(rule![1]).toMatch(/animation\s*:\s*none/)
  expect(rule![1]).toMatch(/opacity\s*:\s*1/)
})

test('a forward navigation parks the new screen at the top', () => {
  const { el, offset } = mount()
  scrollTo(el, 250)
  fireEvent.click(screen.getByRole('button', { name: 'deeper' }))
  expect(offset()).toBe(0)
})

test('a back navigation restores the offset the user left the page at', () => {
  const { el, offset } = mount()
  scrollTo(el, 250)
  fireEvent.click(screen.getByRole('button', { name: 'deeper' }))
  expect(offset()).toBe(0)
  fireEvent.click(screen.getByRole('button', { name: 'back' }))
  expect(offset()).toBe(250)
})

test('a back navigation to an entry with no remembered offset falls back to the top', () => {
  // /a was never rendered (the app started on /b), so there is nothing to restore.
  const { el, offset } = mount(['/a', '/b'], 1)
  scrollTo(el, 180)
  fireEvent.click(screen.getByRole('button', { name: 'back' }))
  expect(offset()).toBe(0)
})

test('the restore keeps re-applying until the landing page is tall enough to hold the offset', () => {
  // Measured in the browser: the offset came back 6px short because the hub's content was
  // still growing when the restore ran, and the write got clamped to the height available
  // at that moment. On a page whose rows resolve a frame later the same clamp lands on 0 —
  // i.e. the remembered position is silently lost, which is the whole bug again.
  let queue: FrameRequestCallback[] = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { queue.push(cb); return queue.length })
  vi.stubGlobal('cancelAnimationFrame', () => {})
  const flushFrame = () => {
    const cbs = queue
    queue = []
    act(() => cbs.forEach(cb => cb(0)))
  }
  try {
    const { el, offset, limit } = mount()
    scrollTo(el, 250)
    fireEvent.click(screen.getByRole('button', { name: 'deeper' }))

    limit.max = 100 // the page we are about to land on is still short
    fireEvent.click(screen.getByRole('button', { name: 'back' }))
    expect(offset()).toBe(100) // clamped, not yet where the user was

    limit.max = 400 // its content finishes arriving
    flushFrame()
    expect(offset()).toBe(250)
  } finally {
    vi.unstubAllGlobals()
  }
})

test('a search-param-only navigation leaves the scroll position alone', () => {
  // A Mai day-hop mints a fresh location key without changing the pathname; it is a view
  // switch, not an arrival, and must not throw the user back to the top.
  const { el, offset } = mount()
  scrollTo(el, 250)
  fireEvent.click(screen.getByRole('button', { name: 'day-hop' }))
  expect(offset()).toBe(250)
})
