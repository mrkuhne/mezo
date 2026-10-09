import { render, screen, act } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { FrameProvider, FrameBack, useFrame, useFrameTitle, useFrameBack, useTitleBarMounted, useHasTitleBar } from './index'

function Reader() {
  const f = useFrame()
  return <div data-testid="r">{f.title ?? '-'}|{f.eyebrow ?? '-'}|{f.onBack ? 'back' : 'noback'}</div>
}
function Page({ title, eyebrow, onBack }: { title: string; eyebrow?: string; onBack?: () => void }) {
  useFrameTitle({ title, eyebrow })
  useFrameBack(onBack)
  return null
}

describe('frame', () => {
  it('the hooks are safe no-ops without a provider', () => {
    expect(() => render(<Page title="Alvás" onBack={() => {}} />)).not.toThrow()
    render(<Reader />)
    expect(screen.getByTestId('r').textContent).toBe('-|-|noback')
  })

  it('sets and clears title, eyebrow and back with the calling page', () => {
    const back = vi.fn()
    const { rerender } = render(<FrameProvider><Reader />{true && <Page title="Alvás" eyebrow="Nap" onBack={back} />}</FrameProvider>)
    expect(screen.getByTestId('r').textContent).toBe('Alvás|Nap|back')
    rerender(<FrameProvider><Reader /></FrameProvider>)
    expect(screen.getByTestId('r').textContent).toBe('-|-|noback')
  })

  it('the latest back handler wins without re-registering', () => {
    const a = vi.fn(), b = vi.fn()
    let captured: (() => void) | undefined
    function Spy() { captured = useFrame().onBack; return null }
    const { rerender } = render(<FrameProvider><Spy /><Page title="x" onBack={a} /></FrameProvider>)
    const first = captured
    rerender(<FrameProvider><Spy /><Page title="x" onBack={b} /></FrameProvider>)
    expect(captured).toBe(first)
    act(() => captured!())
    expect(b).toHaveBeenCalledTimes(1)
    expect(a).not.toHaveBeenCalled()
  })

  // The title bar announces itself, so a page knows whether the shell draws its back control.
  it('a page sees the title bar only while one is mounted under the provider', () => {
    function Bar() { useTitleBarMounted(); return null }
    function Probe() { return <div data-testid="bar">{useHasTitleBar() ? 'bar' : 'nobar'}</div> }
    const { rerender } = render(<FrameProvider><Bar /><Probe /></FrameProvider>)
    expect(screen.getByTestId('bar').textContent).toBe('bar')
    rerender(<FrameProvider><Probe /></FrameProvider>)
    expect(screen.getByTestId('bar').textContent).toBe('nobar')
  })

  it('without a provider there is never a title bar, and announcing one is a no-op', () => {
    function Bar() { useTitleBarMounted(); return null }
    function Probe() { return <div data-testid="bar">{useHasTitleBar() ? 'bar' : 'nobar'}</div> }
    render(<><Bar /><Probe /></>)
    expect(screen.getByTestId('bar').textContent).toBe('nobar')
  })

  // FrameBack: a page's hand-rolled back button, handed to the shell.
  it('FrameBack keeps the page’s own button where no title bar is mounted', () => {
    const back = vi.fn()
    render(<FrameBack onBack={back} label="Vissza a Konyhába" className="glass is-round">‹</FrameBack>)
    const btn = screen.getByRole('button', { name: 'Vissza a Konyhába' })
    expect(btn).toHaveClass('glass', 'is-round')
    expect(btn).toHaveTextContent('‹')
    btn.click()
    expect(back).toHaveBeenCalledTimes(1)
  })

  it('FrameBack draws nothing under a title bar and hands its handler to the frame', () => {
    const back = vi.fn()
    function Bar() { useTitleBarMounted(); const f = useFrame(); return <button onClick={f.onBack}>shell-back</button> }
    render(<FrameProvider><Bar /><FrameBack onBack={back} className="x">‹</FrameBack></FrameProvider>)
    expect(document.querySelector('.x')).toBeNull()
    act(() => screen.getByRole('button', { name: 'shell-back' }).click())
    expect(back).toHaveBeenCalledTimes(1)
  })

  // A plain „go back in history" handler is NOT handed to the frame: the title bar's default
  // (history, else the fallback route) must apply, or back is dead on a direct deep link.
  it('FrameBack history: registers nothing with the frame, keeps its own button without a bar', () => {
    const back = vi.fn()
    function Bar() { useTitleBarMounted(); return <Reader /> }
    const shell = render(<FrameProvider><Bar /><FrameBack history onBack={back} className="x">‹</FrameBack></FrameProvider>)
    expect(document.querySelector('.x')).toBeNull()
    expect(screen.getByTestId('r').textContent).toBe('-|-|noback')
    shell.unmount()
    render(<FrameBack history onBack={back} className="x">‹</FrameBack>)
    screen.getByRole('button', { name: 'Vissza' }).click()
    expect(back).toHaveBeenCalledTimes(1)
  })

  // The owner rule: back returns where the user came from; a fixed route is only the fallback.
  describe('FrameBack history + fallback', () => {
    function Loc() { return <div data-testid="loc">{useLocation().pathname}</div> }
    function FallbackReader() { const f = useFrame(); return <div data-testid="fb">{f.fallback ?? '-'}|{f.onBack ? 'back' : 'noback'}</div> }

    it('under a title bar: draws nothing, registers the fallback and NO handler', () => {
      function Bar() { useTitleBarMounted(); return <FallbackReader /> }
      const { rerender } = render(<MemoryRouter><FrameProvider><Bar /><FrameBack history fallback="/fuel/konyha" className="x">‹</FrameBack></FrameProvider></MemoryRouter>)
      expect(document.querySelector('.x')).toBeNull()
      expect(screen.getByTestId('fb').textContent).toBe('/fuel/konyha|noback')
      rerender(<MemoryRouter><FrameProvider><Bar /></FrameProvider></MemoryRouter>)
      expect(screen.getByTestId('fb').textContent).toBe('-|noback')
    })

    it('without a title bar, on a first entry: the page’s own button goes to the fallback', () => {
      render(<MemoryRouter initialEntries={['/fuel/recipes']}><FrameBack history fallback="/fuel/konyha" label="Vissza a Konyhába" className="x">‹</FrameBack><Loc /></MemoryRouter>)
      act(() => screen.getByRole('button', { name: 'Vissza a Konyhába' }).click())
      expect(screen.getByTestId('loc').textContent).toBe('/fuel/konyha')
    })

    it('without a title bar, after in-app navigation: the same button returns where the user came from', () => {
      render(
        <MemoryRouter initialEntries={['/me']}>
          <Routes>
            <Route path="/me" element={<Link to="/fuel/recipes">receptek</Link>} />
            <Route path="/fuel/recipes" element={<FrameBack history fallback="/fuel/konyha">‹</FrameBack>} />
          </Routes>
          <Loc />
        </MemoryRouter>,
      )
      act(() => screen.getByRole('link', { name: 'receptek' }).click())
      expect(screen.getByTestId('loc').textContent).toBe('/fuel/recipes')
      act(() => screen.getByRole('button', { name: 'Vissza' }).click())
      expect(screen.getByTestId('loc').textContent).toBe('/me')
    })
  })
})
