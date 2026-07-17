// ============================================================
// Mezo · VideoDemo — tap-to-reveal inline demo player for an exercise.
// Extracts the 11-char YouTube id from watch/short/embed/youtu.be URLs and
// lazy-mounts a privacy-preserving youtube-nocookie iframe (16:9) only after
// the user opens it. Renders nothing when there is no url or it is unrecognized.
// Used in the workout runner, the exercise browser sheet, and the picker.
// ============================================================
import { useState } from 'react'

/** Extract a YouTube video id from watch/short/embed/youtu.be URLs; null if unrecognized. */
export function youTubeId(url: string): string | null {
  const m = url.match(
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/,
  )
  return m ? m[1] : null
}

export function VideoDemo({ url }: { url: string | null | undefined }) {
  const [open, setOpen] = useState(false)
  if (!url) return null
  const id = youTubeId(url)
  if (!id) return null
  return (
    <div className="col gap-sm">
      <button
        type="button"
        className="chip"
        style={{ fontSize: 9, alignSelf: 'flex-start' }}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ▶ Demo
      </button>
      {open && (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', background: 'var(--surface-2)' }}>
          <iframe
            title="Demo videó"
            loading="lazy"
            allowFullScreen
            src={`https://www.youtube-nocookie.com/embed/${id}`}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
          />
        </div>
      )}
    </div>
  )
}
