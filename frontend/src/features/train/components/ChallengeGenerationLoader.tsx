// ============================================================
// Mezo · ChallengeGenerationLoader — game-style loading for the lazy LLM
// challenge generation on the prep Küldetések page (mezo-tvw8). Rotating
// playful status lines + a fake-progress bar (fast start, decelerating creep,
// never self-completes — completion is the data arriving and the loader
// unmounting). Spec: docs/superpowers/specs/2026-08-31-challenge-generation-
// loader-design.md.
// ============================================================
import { useEffect, useState } from 'react'

export const CHALLENGE_LOADER_LINES = [
  'Edzésnapló átfésülése…',
  'Formád felmérése…',
  'Megmérettetések kalibrálása…',
  'Küldetések kisorsolása…',
  'Utolsó simítások…',
] as const

export const CHALLENGE_LOADER_ROTATE_MS = 2200

export function ChallengeGenerationLoader() {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const t = setInterval(
      () => setIdx((i) => (i + 1) % CHALLENGE_LOADER_LINES.length),
      CHALLENGE_LOADER_ROTATE_MS,
    )
    return () => clearInterval(t)
  }, [])
  return (
    <div className="mz-chload" role="status" aria-live="polite">
      {/* key remounts the line so the fade-in replays on every rotation */}
      <div key={idx} className="mz-chload-line">{CHALLENGE_LOADER_LINES[idx]}</div>
      <div className="mz-chload-bar">
        <div className="mz-chload-fill" />
      </div>
    </div>
  )
}
