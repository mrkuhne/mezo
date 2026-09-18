import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installViewportInsets } from '@/shared/lib/viewportInsets'

type Listener = () => void

function stubVisualViewport(init: { height: number; offsetTop?: number; scale?: number }) {
  const listeners: Record<string, Listener[]> = { resize: [], scroll: [] }
  const vv = {
    height: init.height,
    offsetTop: init.offsetTop ?? 0,
    scale: init.scale ?? 1,
    addEventListener: (type: string, fn: Listener) => { (listeners[type] ??= []).push(fn) },
    removeEventListener: (type: string, fn: Listener) => {
      listeners[type] = (listeners[type] ?? []).filter(l => l !== fn)
    },
  }
  vi.stubGlobal('visualViewport', vv)
  return {
    vv,
    /** Move the visual viewport and flush the rAF-coalesced handler. */
    async emit(next: Partial<typeof init>) {
      Object.assign(vv, next)
      listeners.resize.forEach(l => l())
      await new Promise(r => requestAnimationFrame(() => r(null)))
    },
  }
}

const root = () => document.documentElement

describe('installViewportInsets', () => {
  beforeEach(() => {
    vi.stubGlobal('innerHeight', 900)
    root().style.cssText = ''
    root().classList.remove('kb-open')
  })
  afterEach(() => vi.unstubAllGlobals())

  it('is a no-op (and safely disposable) without the visualViewport API', () => {
    vi.stubGlobal('visualViewport', undefined)
    const dispose = installViewportInsets()
    expect(root().style.getPropertyValue('--app-vh')).toBe('')
    expect(() => dispose()).not.toThrow()
  })

  it('mirrors the visible viewport onto the shell custom properties', () => {
    stubVisualViewport({ height: 900 })
    const dispose = installViewportInsets()
    expect(root().style.getPropertyValue('--app-vh')).toBe('900px')
    expect(root().style.getPropertyValue('--kb-inset')).toBe('0px')
    expect(root().classList.contains('kb-open')).toBe(false)
    dispose()
  })

  it('reports the keyboard inset and flags kb-open when the keyboard opens', async () => {
    const { emit } = stubVisualViewport({ height: 900 })
    const dispose = installViewportInsets()
    await emit({ height: 560, offsetTop: 0 })
    expect(root().style.getPropertyValue('--app-vh')).toBe('560px')
    expect(root().style.getPropertyValue('--kb-inset')).toBe('340px')
    expect(root().classList.contains('kb-open')).toBe(true)
    dispose()
  })

  it('offsets the shell by the pan iOS applies instead of letting the screen shift', async () => {
    const { emit } = stubVisualViewport({ height: 900 })
    const dispose = installViewportInsets()
    await emit({ height: 560, offsetTop: 120 })
    expect(root().style.getPropertyValue('--app-vv-top')).toBe('120px')
    // pan + visible height together must still account for the whole layout viewport
    expect(root().style.getPropertyValue('--kb-inset')).toBe('220px')
    dispose()
  })

  it('ignores a zoomed viewport — that crop is not a keyboard', async () => {
    const { emit } = stubVisualViewport({ height: 900 })
    const dispose = installViewportInsets()
    await emit({ height: 400, scale: 2 })
    expect(root().style.getPropertyValue('--app-vh')).toBe('')
    expect(root().classList.contains('kb-open')).toBe(false)
    dispose()
  })

  it('clears every property it set on dispose', async () => {
    const { emit } = stubVisualViewport({ height: 900 })
    const dispose = installViewportInsets()
    await emit({ height: 560 })
    dispose()
    expect(root().style.getPropertyValue('--app-vh')).toBe('')
    expect(root().style.getPropertyValue('--app-vv-top')).toBe('')
    expect(root().style.getPropertyValue('--kb-inset')).toBe('')
    expect(root().classList.contains('kb-open')).toBe(false)
  })
})
