import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useNavigate, useSearchParams } from 'react-router-dom'
import { ScreenContent } from '@/app/ScreenContent'
import { ArrivalProvider } from '@/shared/ui/mozaik/arrival'

// Scroll handling of the app's ONE scroll container. A route change parks the new screen at
// the top; a BACK navigation puts the user back where they left off instead (mezo-kuwj) —
// losing the offset is half of what makes swipe-back feel like a reload.

/**
 * jsdom has no layout, so `.screen-content` can neither scroll nor report an offset: its
 * `scrollTop` is a hard 0 and `scrollTo` does not exist. Give the REAL element a working
 * pair of both, so what the assertions observe is the component's own save/restore logic.
 */
function instrument(el: HTMLElement): () => number {
  let offset = 0
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => offset,
    set: (v: number) => { offset = v },
  })
  Object.defineProperty(el, 'scrollTo', {
    configurable: true,
    value: (opts: ScrollToOptions) => {
      offset = opts.top ?? 0
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
  // Instrumented AFTER mount: the mount reset already ran on the raw element, and every
  // assertion below is about a LATER navigation anyway.
  return { ...view, el, offset: instrument(el) }
}

function scrollTo(el: HTMLElement, top: number) {
  el.scrollTop = top
  fireEvent.scroll(el)
}

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

test('a search-param-only navigation leaves the scroll position alone', () => {
  // A Mai day-hop mints a fresh location key without changing the pathname; it is a view
  // switch, not an arrival, and must not throw the user back to the top.
  const { el, offset } = mount()
  scrollTo(el, 250)
  fireEvent.click(screen.getByRole('button', { name: 'day-hop' }))
  expect(offset()).toBe(250)
})
