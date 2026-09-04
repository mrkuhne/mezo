// ============================================================
// Mezo · VideoUrlSheet — attach / replace / remove the demo video URL on a
// catalog exercise the viewer may re-mediate (`mediaEditable`: the author or
// the OWNER on a user row, the OWNER only on a master row — multi-user S5,
// mezo-qw37.5). Single URL input + Mentés; when a video already exists an
// Eltávolítás ghost clears it (saves null). Calls setExerciseVideo (PUT
// /api/train/exercises/{id}/video) — gated server-side by the same rule; a 403
// EXERCISE_CATALOG_NOT_EDITABLE surfaces as the generic „Mentés sikertelen"
// toast, unlike the owner-only full edit in CatalogExerciseSheet. The contract
// pattern accepts a YouTube watch/short URL or an Instagram reel/post
// permalink; anything else comes back 400.
// Mirrors the CatalogExerciseSheet visual idiom.
// ============================================================
import { useState } from 'react'
import { useTrain } from '@/data/hooks'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Display } from '@/shared/ui/Display'
import { CtaPrimary, CtaGhost } from '@/shared/ui/Cta'

const fieldStyle = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 14,
  background: 'var(--surface-1)',
  border: '1px solid var(--border-subtle)',
} as const

interface VideoUrlSheetProps {
  // The catalog row to target: its id (catalog uuid), display name, current video.
  exercise: { id: string; name: string; videoUrl: string | null }
  onClose: () => void
}

export function VideoUrlSheet({ exercise, onClose }: VideoUrlSheetProps) {
  const { setExerciseVideo } = useTrain()
  const [videoUrl, setVideoUrl] = useState(exercise.videoUrl ?? '')
  const [saving, setSaving] = useState(false)
  const hadVideo = (exercise.videoUrl ?? '') !== ''

  // Defer the animated close until the mutation lands (mock resolves synchronously).
  // onError re-enables the CTAs so a real-mode failure doesn't leave them stuck.
  const persist = (value: string | null, close: () => void) => {
    if (saving) return
    setSaving(true)
    setExerciseVideo(exercise.id, value, { onSuccess: close, onError: () => setSaving(false) })
  }

  return (
    <Sheet onClose={onClose} labelledBy="video-url-title">
      {(close) => (
        <>
          {/* Header */}
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div className="col">
              <span className="eyebrow brand">Videó · {exercise.name}</span>
              <div id="video-url-title" style={{ marginTop: 4 }}>
                <Display size="md">Demo videó</Display>
              </div>
            </div>
            <button className="chip" onClick={close} aria-label="Bezárás" style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          {/* Video URL */}
          <div className="col gap-sm" style={{ marginBottom: 4 }}>
            <span className="label-mono">Videó URL</span>
            <input
              aria-label="Videó URL"
              className="rad-12"
              placeholder="https://youtu.be/… vagy https://instagram.com/reel/…"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              style={fieldStyle}
            />
          </div>

          {/* Footer — Eltávolítás clears an existing video; Mégse just closes when there is none */}
          <div className="row gap-sm mt-lg">
            {hadVideo ? (
              <CtaGhost className="flex-1" disabled={saving} onClick={() => persist(null, close)}>
                <Icon name="trash" size={14} color="var(--warning)" /> Eltávolítás
              </CtaGhost>
            ) : (
              <CtaGhost className="flex-1" onClick={close}>
                Mégse
              </CtaGhost>
            )}
            <CtaPrimary className="flex-1" disabled={saving} onClick={() => persist(videoUrl.trim() || null, close)}>
              <Icon name="check" size={14} /> Mentés
            </CtaPrimary>
          </div>
          <div style={{ height: 8 }} />
        </>
      )}
    </Sheet>
  )
}
