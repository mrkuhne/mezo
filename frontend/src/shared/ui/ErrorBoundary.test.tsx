import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary'

function Bomb({ explode }: { explode: boolean }) {
  if (explode) throw new Error('boom')
  return <div>tartalom</div>
}

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <Bomb explode={false} />
      </ErrorBoundary>,
    )
    expect(screen.getByText('tartalom')).toBeInTheDocument()
  })

  it('swaps in the default fallback on a render throw instead of blanking', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <Bomb explode />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Valami elromlott ezen a nézeten.')
    spy.mockRestore()
  })

  it('recovers when resetKey changes (navigation away from a crashed page)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    function Harness() {
      const [route, setRoute] = useState('/a')
      return (
        <>
          <button onClick={() => setRoute('/b')}>navigate</button>
          <ErrorBoundary resetKey={route}>
            <Bomb explode={route === '/a'} />
          </ErrorBoundary>
        </>
      )
    }
    render(<Harness />)
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.click(screen.getByText('navigate'))
    expect(screen.getByText('tartalom')).toBeInTheDocument()
    spy.mockRestore()
  })

  it('uses a custom fallback when provided', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary fallback={() => <p>egyedi hibaüzenet</p>}>
        <Bomb explode />
      </ErrorBoundary>,
    )
    expect(screen.getByText('egyedi hibaüzenet')).toBeInTheDocument()
    spy.mockRestore()
  })
})
