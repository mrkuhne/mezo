import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/shared/lib/cn'

interface SheetProps {
  // Children may be a render function receiving an animated `close()` so that
  // in-sheet buttons (X, Save…) dismiss with the same slide-down as the backdrop.
  children: ReactNode | ((close: () => void) => ReactNode)
  onClose: () => void
  className?: string
  labelledBy?: string
}

// How far (px) or how fast (px/ms) a downward drag must reach to dismiss.
const CLOSE_DISTANCE = 120
const CLOSE_VELOCITY = 0.5
const EXIT_MS = 300

export function Sheet({ children, onClose, className, labelledBy }: SheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const drag = useRef({ active: false, startY: 0, startT: 0, dy: 0, height: 0 })
  const closing = useRef(false)
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const exitRaf = useRef<number | null>(null)

  // Render into the phone screen so `position: absolute` anchors to the device
  // viewport (and the backdrop covers the tab bar), not the scrolling content
  // the sheet happens to be mounted inside. Falls back to <body> in tests.
  const [target] = useState<Element>(
    () => document.querySelector('.phone-screen') ?? document.body,
  )

  // Slide the sheet down and fade the backdrop, then unmount via onClose.
  // Used by every dismissal path so closing always mirrors the opening motion.
  const requestClose = useCallback(() => {
    if (closing.current) return
    closing.current = true
    const el = sheetRef.current
    const bd = backdropRef.current
    if (!el) {
      onClose()
      return
    }
    // Kill the entrance keyframe, then force a reflow so the browser commits
    // the CURRENT position as the transition's start frame. Without this the
    // style writes are coalesced and it jumps straight to the end (no anim).
    el.style.animation = 'none'
    void el.offsetHeight
    el.style.transition = `transform ${EXIT_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`
    if (bd) bd.style.transition = `opacity ${EXIT_MS}ms ease`

    let done = false
    const finish = () => {
      if (done) return
      done = true
      onClose()
    }
    el.addEventListener('transitionend', finish, { once: true })
    exitTimer.current = setTimeout(finish, EXIT_MS + 80) // fallback if transitionend never fires

    // Apply the end state on the NEXT frame so there is a real start→end delta
    // to animate (works from rest at translateY(0) and from a dragged offset).
    exitRaf.current = requestAnimationFrame(() => {
      el.style.transform = 'translateY(100%)'
      if (bd) bd.style.opacity = '0'
    })
  }, [onClose])

  // The exit fallback timer/rAF must not outlive the component: under jsdom
  // transitionend never fires, and a timer surviving unmount calls onClose (a
  // parent setState) after test-environment teardown — the nondeterministic
  // "window is not defined" CI failure (mezo-91rw).
  useEffect(
    () => () => {
      if (exitTimer.current != null) clearTimeout(exitTimer.current)
      if (exitRaf.current != null) cancelAnimationFrame(exitRaf.current)
    },
    [],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [requestClose])

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const el = sheetRef.current
    if (!el || closing.current) return
    drag.current = { active: true, startY: e.clientY, startT: e.timeStamp, dy: 0, height: el.offsetHeight }
    el.style.animation = 'none'
    el.style.transition = 'none'
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = drag.current
    if (!s.active) return
    const dy = Math.max(0, e.clientY - s.startY) // only track downward drag
    s.dy = dy
    if (sheetRef.current) sheetRef.current.style.transform = `translateY(${dy}px)`
    if (backdropRef.current) {
      backdropRef.current.style.opacity = String(Math.max(0, 1 - (dy / (s.height || 1)) * 1.2))
    }
  }

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const s = drag.current
    if (!s.active) return
    s.active = false
    const dt = Math.max(1, e.timeStamp - s.startT)
    const velocity = s.dy / dt
    const distanceThreshold = Math.min(CLOSE_DISTANCE, (s.height || 0) * 0.28)
    if (s.dy > distanceThreshold || velocity > CLOSE_VELOCITY) {
      requestClose()
      return
    }
    // Snap back to resting position
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'transform 0.26s cubic-bezier(0.22, 1, 0.36, 1)'
      sheetRef.current.style.transform = 'translateY(0)'
    }
    if (backdropRef.current) {
      backdropRef.current.style.transition = 'opacity 0.26s ease'
      backdropRef.current.style.opacity = '1'
    }
  }

  return createPortal(
    <>
      <div ref={backdropRef} className="sheet-backdrop" onClick={requestClose} aria-hidden="true" />
      <div ref={sheetRef} className={cn('sheet', className)} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <div
          className="sheet-handle-zone"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="sheet-handle" />
        </div>
        {typeof children === 'function' ? children(requestClose) : children}
      </div>
    </>,
    target,
  )
}
