// ============================================================
// Mezo · ExerciseImage — the catalog-resolved demo still (mezo-8xdl.3).
//
// The free-exercise-db source ships exactly TWO frames per exercise (start +
// end position, same camera), and alternating them is what actually conveys a
// movement — a single still often does not. `hero` crossfades between them;
// `thumb` shows the start frame only.
//
// imageStartUrl is the presence flag: without it `hero` renders NOTHING (no
// empty placeholder box) and `thumb` falls back to a muscle-wash tile, so the
// 37 catalog rows with no faithful counterpart in the dataset (ADR 0020) leave
// lists with a straight left edge instead of ragged holes.
//
// The photos are tonally foreign to the DS — a man in a red-walled commercial
// gym. Reconciling them lives HERE, once, not at each call site. The `thumb`
// variant's image is always decorative (next to a visible label) — alt="" so
// it does not double-announce the exercise name in the accessible name.
// ============================================================
import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { muscleColor } from '@/features/train/logic/muscleColors'

/** How long each frame is held before crossfading to the other one. */
const FRAME_MS = 1200

interface ExerciseImageProps {
  start: string | null | undefined
  end?: string | null
  /** Exercise name. `hero` uses it as the alt text (never decorative-empty); `thumb` is
   * always decorative (alt="") since it sits next to a visible label, and `name` is used
   * only for the no-image fallback tile's initial. */
  name: string
  /** Catalog muscle token, for the rail tint + the no-image fallback tile. */
  muscle?: string
  variant?: 'hero' | 'thumb'
  /** Caller-side placement (e.g. alignSelf). Component identity styles (muscle colours) always win. */
  style?: CSSProperties
}

/** true when the user asked for reduced motion (SSR/jsdom-safe). */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    setReduced(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])
  return reduced
}

export function ExerciseImage({ start, end, name, muscle, variant = 'hero', style }: ExerciseImageProps) {
  const colors = muscleColor(muscle ?? '')
  const reduced = usePrefersReducedMotion()
  // The alternation is INFORMATION, so reduced motion must not simply drop it —
  // it becomes a manual toggle instead.
  const [showEnd, setShowEnd] = useState(false)
  const animated = Boolean(start && end) && !reduced
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!animated) return
    timer.current = setInterval(() => setShowEnd((v) => !v), FRAME_MS)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [animated])

  if (variant === 'thumb') {
    // A ragged list edge is worse than a plain tile, so the fallback is always rendered.
    if (!start) {
      return (
        <div
          aria-hidden="true"
          className="exdemo-thumb"
          style={{ ...style, background: colors.wash, color: colors.deep }}
        >
          {name.slice(0, 1).toUpperCase()}
        </div>
      )
    }
    return (
      <img
        className="exdemo-thumb"
        src={start}
        alt=""
        width={44}
        height={44}
        loading="lazy"
        decoding="async"
        style={style}
      />
    )
  }

  if (!start) return null

  return (
    <figure className="exdemo" style={{ ...style, borderInlineStartColor: colors.rail }}>
      {/* Both frames are stacked and cross-faded; the end frame is inert when absent. */}
      <img
        className="exdemo-frame"
        src={start}
        alt={name}
        loading="lazy"
        decoding="async"
        style={{ opacity: showEnd && end ? 0 : 1 }}
      />
      {end && (
        <img
          className="exdemo-frame"
          src={end}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          style={{ opacity: showEnd ? 1 : 0 }}
        />
      )}
      {end && reduced && (
        <button
          type="button"
          className="exdemo-toggle"
          onClick={() => setShowEnd((v) => !v)}
          aria-label={showEnd ? 'Kiinduló helyzet' : 'Végpozíció'}
        >
          ⇄
        </button>
      )}
    </figure>
  )
}
