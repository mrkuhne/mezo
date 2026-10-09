import { render, screen, act } from '@testing-library/react'
import { FrameProvider, useFrame, useFrameTitle, useFrameBack } from './index'

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
})
