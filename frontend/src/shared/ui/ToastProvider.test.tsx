import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emitToast } from '@/shared/lib/toastBus'
import { ToastProvider, useToast } from '@/shared/ui/ToastProvider'

// ESM test file (no __dirname) — resolve relative to this file's own URL,
// matching the convention used elsewhere in the repo (e.g. dualMode.guard.test.ts).
const TEST_DIR = dirname(fileURLToPath(import.meta.url))

function ShowButton() {
  const toast = useToast()
  return <button onClick={() => toast.show({ kind: 'success', text: 'Mentve' })}>trigger</button>
}

const items = () => screen.queryAllByTestId('toast-item')

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('ToastProvider — simple toasts (a mai viselkedés megőrzése)', () => {
  it('kirendereli a buszon érkező toastot és 4s után elengedi', () => {
    render(<ToastProvider>content</ToastProvider>)

    act(() => emitToast({ kind: 'error', text: 'Mentés sikertelen — próbáld újra' }))
    expect(screen.getByRole('status')).toHaveTextContent('Mentés sikertelen — próbáld újra')
    expect(items()[0]).toHaveAttribute('data-kind', 'error')

    // error = 6000ms; 4000-nél még él
    act(() => { vi.advanceTimersByTime(4100) })
    expect(items()).toHaveLength(1)

    act(() => { vi.advanceTimersByTime(2000 + 500) })  // 6000 + exit
    expect(items()).toHaveLength(0)
  })

  it('a success 4s után tűnik el', () => {
    render(<ToastProvider>content</ToastProvider>)
    act(() => emitToast({ kind: 'success', text: 'Mentve' }))
    act(() => { vi.advanceTimersByTime(4000 + 500) })
    expect(items()).toHaveLength(0)
  })

  it('a useToast().show() a buszon át emitál', () => {
    render(<ToastProvider><ShowButton /></ToastProvider>)
    fireEvent.click(screen.getByText('trigger'))
    expect(items()[0]).toHaveTextContent('Mentve')
  })

  it('provider nélküli emitToast csendes no-op', () => {
    expect(() => emitToast({ kind: 'info', text: 'senki sem hallja' })).not.toThrow()
  })
})

describe('ToastProvider — stack', () => {
  it('a legújabb toast van elöl, és egyik sem cseréli le a másikat', () => {
    render(<ToastProvider>content</ToastProvider>)
    act(() => emitToast({ kind: 'success', text: 'első' }))
    act(() => { vi.advanceTimersByTime(100) })
    act(() => emitToast({ kind: 'success', text: 'második' }))

    const rendered = items()
    expect(rendered).toHaveLength(2)
    expect(rendered[0]).toHaveTextContent('második')
    expect(rendered[1]).toHaveTextContent('első')
  })

  it('legfeljebb 3 látható; a 4. rejtett marad', () => {
    render(<ToastProvider>content</ToastProvider>)
    for (const text of ['a', 'b', 'c', 'd']) {
      act(() => emitToast({ kind: 'success', text }))
      act(() => { vi.advanceTimersByTime(50) })
    }
    const rendered = items()
    expect(rendered).toHaveLength(4)
    expect(rendered[0]).toHaveAttribute('data-idx', '0')
    expect(rendered[1]).toHaveAttribute('data-idx', '1')
    expect(rendered[2]).toHaveAttribute('data-idx', '2')
    expect(rendered[3]).toHaveAttribute('data-idx', 'hidden')
  })

  it('a queue 20 elemnél nem nő tovább', () => {
    render(<ToastProvider>content</ToastProvider>)
    for (let i = 0; i < 25; i += 1) {
      act(() => emitToast({ kind: 'success', text: `t${i}` }))
    }
    expect(items().length).toBeLessThanOrEqual(20)
    expect(items()[0]).toHaveTextContent('t24')
  })

  it('a ✕ azonnal zárja az adott toastot, a többit nem', () => {
    render(<ToastProvider>content</ToastProvider>)
    act(() => emitToast({ kind: 'success', text: 'marad' }))
    act(() => { vi.advanceTimersByTime(50) })
    act(() => emitToast({ kind: 'success', text: 'megy' }))

    fireEvent.click(screen.getAllByRole('button', { name: 'Bezárás' })[0])
    act(() => { vi.advanceTimersByTime(500) })

    const rendered = items()
    expect(rendered).toHaveLength(1)
    expect(rendered[0]).toHaveTextContent('marad')
  })
})

describe('ToastProvider — z-index tier', () => {
  it('a toast tier a sheetek és a level-up overlay FÖLÖTT van (DS: „Toast above Modal")', () => {
    const css = readFileSync(resolve(TEST_DIR, '../../styles/prototype.css'), 'utf8')
    const tierOf = (selector: string) => {
      const block = css.split(selector)[1]?.split('}')[0] ?? ''
      return Number(block.match(/z-index:\s*(\d+)/)?.[1] ?? NaN)
    }
    expect(tierOf('.toast-stack {')).toBeGreaterThan(250)   // above the level-up overlay
    expect(tierOf('.toast-solo {')).toBeGreaterThan(250)
  })
})
