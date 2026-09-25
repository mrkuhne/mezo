import { describe, expect, it, vi } from 'vitest'
import { installSwAutoReload } from '@/app/swAutoReload'

function fakeWindow(controller: object | null) {
  const swListeners: Record<string, () => void> = {}
  const docListeners: Record<string, () => void> = {}
  const update = vi.fn(() => Promise.resolve())
  const reload = vi.fn()
  const doc = { visibilityState: 'visible', addEventListener: (t: string, f: () => void) => { docListeners[t] = f } }
  const win = {
    navigator: { serviceWorker: {
      controller,
      addEventListener: (t: string, f: () => void) => { swListeners[t] = f },
      getRegistration: () => Promise.resolve({ update }),
    } },
    location: { reload },
    document: doc,
  } as unknown as Window
  return { win, swListeners, docListeners, update, reload, doc }
}

describe('installSwAutoReload', () => {
  it('reloads once when a NEW worker takes over a controlled page', () => {
    const f = fakeWindow({})
    installSwAutoReload(f.win)
    f.swListeners.controllerchange()
    f.swListeners.controllerchange()
    expect(f.reload).toHaveBeenCalledTimes(1)
  })

  it('does not reload on the very first install (no previous controller)', () => {
    const f = fakeWindow(null)
    installSwAutoReload(f.win)
    f.swListeners.controllerchange()
    expect(f.reload).not.toHaveBeenCalled()
  })

  it('checks for an update when the app comes back to the foreground', async () => {
    const f = fakeWindow({})
    installSwAutoReload(f.win)
    f.docListeners.visibilitychange()
    await Promise.resolve(); await Promise.resolve()
    expect(f.update).toHaveBeenCalledTimes(1)
  })

  it('is a no-op without service worker support', () => {
    expect(() => installSwAutoReload({ navigator: {} } as unknown as Window)).not.toThrow()
  })
})
