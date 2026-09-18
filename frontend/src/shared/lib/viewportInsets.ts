// ============================================================
// Mezo · viewport insets (mobil billentyűzet)
// The shell (.app-root) is `position: fixed` over the LAYOUT viewport, which on iOS
// does NOT shrink when the software keyboard opens — only the VISUAL viewport does.
// So the docked chrome (tab bar, sheets, save bars) ended up underneath the keyboard,
// and Safari then panned/scrolled the page to reveal the focused field: every input
// surface visibly jumped, the sheet header scrolled out of sight (the reported
// "eltoltja a screent teljesen" bug).
//
// This module mirrors the visual viewport onto three CSS custom properties so the
// shell can simply *be* the visible area:
//   --app-vh     visible height          → .app-root height
//   --app-vv-top visual-viewport offset  → .app-root top (cancels Safari's pan)
//   --kb-inset   keyboard height         → anything that wants to react to it
// plus an `html.kb-open` class for chrome that should step aside while typing.
// No-ops where visualViewport is missing (jsdom, older browsers): the shell keeps
// its previous full-height behaviour via the CSS fallbacks.
// ============================================================

/** Below this the "inset" is chrome noise (URL bar, Android nav), not a keyboard. */
const KB_OPEN_PX = 80
/** The visual viewport settles a frame or two after the resize event. */
const REVEAL_DELAY_MS = 140

function isTextField(el: Element | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
}

export function installViewportInsets(): () => void {
  if (typeof window === 'undefined') return () => {}
  const vv = window.visualViewport
  const root = document.documentElement
  if (!vv) return () => {}

  let raf: number | null = null
  let reveal: ReturnType<typeof setTimeout> | null = null
  let kbOpen = false

  const clear = () => {
    root.style.removeProperty('--app-vh')
    root.style.removeProperty('--app-vv-top')
    root.style.removeProperty('--kb-inset')
    root.classList.remove('kb-open')
    kbOpen = false
  }

  const apply = () => {
    raf = null
    // Pinch/page zoom makes the visual viewport a CROP of the layout viewport, not a
    // keyboard inset — shrinking the shell to that crop would be wrong. Zoom is disabled
    // app-wide (viewport meta), this is the belt-and-suspenders branch.
    if (vv.scale > 1.01) { clear(); return }
    const height = Math.round(vv.height)
    const offsetTop = Math.round(vv.offsetTop)
    const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
    root.style.setProperty('--app-vh', `${height}px`)
    root.style.setProperty('--app-vv-top', `${offsetTop}px`)
    root.style.setProperty('--kb-inset', `${kb}px`)
    const open = kb > KB_OPEN_PX
    root.classList.toggle('kb-open', open)
    if (open !== kbOpen) {
      kbOpen = open
      if (open) scheduleReveal()
    }
  }

  // Safari scrolls ancestors to reveal the focused field BEFORE the shell has shrunk,
  // which can leave a sheet scrolled past its own header. Once the shrink has landed the
  // field usually needs no scrolling at all; `block: 'nearest'` re-reveals it only if it
  // really is out of view, and never yanks the surface around when it is already visible.
  const scheduleReveal = () => {
    if (reveal != null) clearTimeout(reveal)
    reveal = setTimeout(() => {
      reveal = null
      // Undo any document-level pan Safari applied (the body cannot scroll, but the
      // visual viewport can still have been shifted).
      if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0)
      const el = document.activeElement
      if (isTextField(el)) el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }, REVEAL_DELAY_MS)
  }

  const schedule = () => {
    if (raf != null) return
    raf = requestAnimationFrame(apply)
  }

  apply()
  vv.addEventListener('resize', schedule)
  vv.addEventListener('scroll', schedule)

  return () => {
    vv.removeEventListener('resize', schedule)
    vv.removeEventListener('scroll', schedule)
    if (raf != null) cancelAnimationFrame(raf)
    if (reveal != null) clearTimeout(reveal)
    clear()
  }
}
