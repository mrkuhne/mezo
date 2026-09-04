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

  it('az opcionális action valódi gombként lefut, majd csak a saját toastját zárja', async () => {
    const action = vi.fn()
    render(<ToastProvider>content</ToastProvider>)
    act(() => emitToast({ kind: 'success', text: 'marad' }))
    act(() => { vi.advanceTimersByTime(50) })
    act(() => emitToast({
      kind: 'success',
      text: 'Kreatin bevéve',
      action: { label: 'Visszavonás', onClick: action },
    }))

    const button = screen.getByRole('button', { name: 'Visszavonás' })
    expect(button.tagName).toBe('BUTTON')
    await act(async () => { fireEvent.click(button) })
    expect(action).toHaveBeenCalledOnce()
    expect(items()[0]).toHaveClass('is-leaving')

    act(() => { vi.advanceTimersByTime(500) })
    expect(items()).toHaveLength(1)
    expect(items()[0]).toHaveTextContent('marad')
  })

  it('megvárja a Promise actiont, és annak hibája után is bezárja a toastot', async () => {
    const action = vi.fn(async () => { throw new Error('mutation cache owns this error') })
    render(<ToastProvider>content</ToastProvider>)
    act(() => emitToast({
      kind: 'success',
      text: 'Kreatin bevéve',
      action: { label: 'Visszavonás', onClick: action },
    }))

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Visszavonás' })) })
    expect(action).toHaveBeenCalledOnce()
    expect(items()[0]).toHaveClass('is-leaving')
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

  it('minden toast a saját status régiója — nem egy közös container ismétli a régit', () => {
    // Regression for mezo-k5sa: role="status" must sit on each toast item, not on the
    // .toast-stack container. role="status" implies aria-atomic="true", so a container-level
    // live region would re-announce every older card on each new toast. Under that (broken)
    // arrangement there is exactly one `status` element no matter how many toasts stack —
    // this assertion fails there and passes once each item owns its own status role.
    render(<ToastProvider>content</ToastProvider>)
    act(() => emitToast({ kind: 'success', text: 'első' }))
    act(() => { vi.advanceTimersByTime(100) })
    act(() => emitToast({ kind: 'success', text: 'második' }))

    expect(screen.getAllByRole('status')).toHaveLength(2)
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

describe('ToastProvider — reward variáns', () => {
  it('kirendereli az eyebrow-t, a címet, a metert és a level-up badge-et', () => {
    render(<ToastProvider>content</ToastProvider>)
    act(() =>
      emitToast({
        kind: 'reward',
        eyebrow: 'Szokás · 2 / 3',
        title: 'Napi szándék',
        meter: { label: 'Mentális', delta: 15 },
        levelUp: { label: 'Mentális', from: 3, to: 4 },
      }),
    )

    const item = items()[0]
    expect(item).toHaveAttribute('data-kind', 'reward')
    expect(item).toHaveTextContent('Szokás · 2 / 3')
    expect(item).toHaveTextContent('Napi szándék')
    expect(item).toHaveTextContent('Mentális')
    expect(item).toHaveTextContent('+15')
    expect(item).toHaveTextContent('LEVEL UP · Mentális · Lv3 → 4')
  })

  it('meter és level-up nélkül is teljes értékű: eyebrow + cím + meta', () => {
    render(<ToastProvider>content</ToastProvider>)
    act(() => emitToast({ kind: 'reward', eyebrow: 'Küldetés', title: 'Vízivás', meta: '2000 ml' }))

    const item = items()[0]
    expect(item).toHaveTextContent('Küldetés')
    expect(item).toHaveTextContent('Vízivás')
    expect(item).toHaveTextContent('2000 ml')
    expect(item.textContent).not.toContain('undefined')
    expect(item.textContent).not.toContain('LEVEL UP')
  })

  it('a reward 4s után tűnik el', () => {
    render(<ToastProvider>content</ToastProvider>)
    act(() => emitToast({ kind: 'reward', eyebrow: 'Szokás', title: 'Pipa' }))
    act(() => { vi.advanceTimersByTime(4000 + 500) })
    expect(items()).toHaveLength(0)
  })
})
