// ============================================================
// Mezo · VideoDemo — tap-to-reveal inline demo player for an exercise.
// Resolves a stored demo URL to an embeddable iframe src: YouTube watch/short/
// embed/youtu.be → a privacy-preserving youtube-nocookie embed (16:9), and an
// Instagram reel/post/tv permalink → instagram.com/{kind}/{code}/embed (9:16,
// since reels are portrait). The iframe lazy-mounts only after the user opens
// it. Renders nothing when there is no url or it is unrecognized.
// Used in the workout runner, the exercise browser sheet, and the picker (the picker asks for the
// Folyadék face with `fo`).
// ============================================================
import { useState } from 'react'

/** One resolved embed: the iframe src plus the CSS aspect-ratio the source needs. */
export interface EmbedTarget {
  src: string
  aspectRatio: string
}

/** Extract a YouTube video id from watch/short/embed/youtu.be URLs; null if unrecognized. */
export function youTubeId(url: string): string | null {
  const m = url.match(
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/,
  )
  return m ? m[1] : null
}

/**
 * Extract the `{kind}/{shortcode}` embed path from an Instagram permalink — the kind is kept
 * because /reel/, /p/ and /tv/ each embed under their own path. Handles the profile-scoped
 * share form (instagram.com/{user}/reel/{code}) and normalizes the plural `reels/` the app's
 * share sheet emits to the embeddable singular `reel/`. Null if the URL is not a post.
 */
export function instagramEmbedPath(url: string): string | null {
  const m = url.match(
    /instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(reels?|p|tv)\/([A-Za-z0-9_-]+)/,
  )
  if (!m) return null
  const kind = m[1] === 'reels' ? 'reel' : m[1]
  return `${kind}/${m[2]}`
}

/** Resolve any stored demo URL to its embed target; null when absent or unrecognized. */
export function videoEmbed(url: string | null | undefined): EmbedTarget | null {
  if (!url) return null
  const yt = youTubeId(url)
  if (yt) return { src: `https://www.youtube-nocookie.com/embed/${yt}`, aspectRatio: '16 / 9' }
  const ig = instagramEmbedPath(url)
  if (ig) return { src: `https://www.instagram.com/${ig}/embed`, aspectRatio: '9 / 16' }
  return null
}

/** `fo` (opt-in, the Folyadék exercise picker): the toggle is the kit's text link and the player a rounded
 *  vessel — two siblings without a wrapper, so the caller's row lays them out (`.ee-demo`, `.ee-vid`).
 *  Without it the component renders exactly as before (the in-workout menu's and the catalogue's look). */
export function VideoDemo({ url, fo }: { url: string | null | undefined; fo?: boolean }) {
  const [open, setOpen] = useState(false)
  const embed = videoEmbed(url)
  if (!embed) return null
  if (fo) {
    return (
      <>
        <button type="button" className="fo-lk ee-demo" aria-expanded={open} onClick={() => setOpen((v) => !v)}>▶ Demo</button>
        {open && (
          <div className="ee-vid" style={{ aspectRatio: embed.aspectRatio }}>
            <iframe title="Demo videó" loading="lazy" allowFullScreen src={embed.src} />
          </div>
        )}
      </>
    )
  }
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
        <div style={{ position: 'relative', width: '100%', aspectRatio: embed.aspectRatio, background: 'var(--surface-2)' }}>
          <iframe
            title="Demo videó"
            loading="lazy"
            allowFullScreen
            src={embed.src}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
          />
        </div>
      )}
    </div>
  )
}
