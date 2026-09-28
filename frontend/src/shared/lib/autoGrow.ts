// Every multi-line text field grows with its text (mezo chat-window sizing): a long message used
// to sit in a 4-line box that was hard to scroll. The field keeps its designed height as a floor,
// grows to fit the content, and only past AUTOGROW_MAX_VH of the viewport (or its own CSS
// max-height, whichever is smaller) does its own scrollbar take over.

export const AUTOGROW_MAX_VH = 0.4

/** Fields that opt out keep their designed height (`data-autogrow="off"`). */
const OPT_OUT = 'off'

function scrollParents(el: HTMLElement): Array<[Element, number]> {
  const out: Array<[Element, number]> = []
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (p.scrollTop) out.push([p, p.scrollTop])
  }
  const root = document.scrollingElement
  if (root && root.scrollTop) out.push([root, root.scrollTop])
  return out
}

export function autoGrow(el: HTMLTextAreaElement): void {
  if (el.dataset.autogrow === OPT_OUT || !el.isConnected) return
  // The first measurement (before we ever write an inline height) is the designed height.
  if (!el.dataset.agMin) {
    if (!el.offsetHeight) return // hidden — measure once it is laid out
    el.dataset.agMin = String(el.offsetHeight)
  }
  const min = Number(el.dataset.agMin)
  const cs = getComputedStyle(el)
  const cssMax = parseFloat(cs.maxHeight)
  const max = Math.max(min, Math.min(Number.isFinite(cssMax) ? cssMax : Infinity, window.innerHeight * AUTOGROW_MAX_VH))
  const border = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0)
  const padding = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0)
  const contentBox = cs.boxSizing === 'content-box'
  const toStyle = (outer: number) => (contentBox ? outer - border - padding : outer)

  // Shrinking to the floor to measure can clamp a scrolled sheet; put its scroll back after.
  const saved = scrollParents(el)
  el.style.height = `${toStyle(min)}px`
  const need = el.scrollHeight + border
  el.style.height = `${toStyle(Math.min(Math.max(need, min), max))}px`
  for (const [p, top] of saved) p.scrollTop = top
}

let installed = false

const pending = new Set<HTMLTextAreaElement>()
let flushQueued = false

function queue(el: HTMLTextAreaElement): void {
  pending.add(el)
  if (flushQueued) return
  flushQueued = true
  requestAnimationFrame(() => {
    flushQueued = false
    const els = [...pending]
    pending.clear()
    els.forEach(autoGrow)
  })
}

/**
 * Installs the app-wide behaviour once. Typing, pasting or focusing a textarea resizes it, and
 * so does any value written by code (dictation, a prefilled draft, a cleared field after send):
 * React writes a controlled textarea through the native `value` setter, which is wrapped here to
 * queue a resize for the next frame — no screen has to remember to call anything.
 */
export function installAutoGrow(): void {
  if (installed || typeof document === 'undefined') return
  installed = true
  const onEvent = (e: Event) => {
    if (e.target instanceof HTMLTextAreaElement) autoGrow(e.target)
  }
  document.addEventListener('input', onEvent, true)
  document.addEventListener('focusin', onEvent, true)

  const proto = HTMLTextAreaElement.prototype
  const desc = Object.getOwnPropertyDescriptor(proto, 'value')
  if (desc?.set && desc.get && desc.configurable) {
    const { get, set } = desc
    Object.defineProperty(proto, 'value', {
      ...desc,
      get,
      set(this: HTMLTextAreaElement, v: string) {
        set.call(this, v)
        queue(this)
      },
    })
  }
}
