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
// Üveg (U10, mezo-me75u.10): a coral glass sheet, the play 3D head, one flat URL field, the
// coral-outline „Eltávolítás" (destructive, rule 29) or flat Mégse + the lit „Mentés" pill.
// ============================================================
import { useState } from 'react'
import { useTrain } from '@/data/hooks'
import { Sheet } from '@/shared/ui/Sheet'
import { SheetHead } from '@/shared/ui/SheetHead'
import { Icon3D } from '@/shared/ui/clay'

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
    <Sheet glass onClose={onClose} labelledBy="video-url-title" className="uvl-edzes">
      {(close) => (
        <div className="uvl-body">
          <SheetHead icon="t-play" eyebrow={`Videó · ${exercise.name}`} title="Demo videó" titleId="video-url-title" onClose={close} />

          {/* Video URL */}
          <label className="uvl-field">
            <span className="uvl-flabel">Videó URL</span>
            <input
              aria-label="Videó URL"
              placeholder="https://youtu.be/… vagy https://instagram.com/reel/…"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
          </label>

          {/* Footer — Eltávolítás clears an existing video; Mégse just closes when there is none */}
          <div className="uvl-foot">
            {hadVideo ? (
              <button type="button" className="uvl-warn" disabled={saving} onClick={() => persist(null, close)}>
                <Icon3D name="t-trash" size={20} />Eltávolítás
              </button>
            ) : (
              <button type="button" className="uvl-ghost" onClick={close}>Mégse</button>
            )}
            <button type="button" className="uvl-cta" disabled={saving} onClick={() => persist(videoUrl.trim() || null, close)}>
              <Icon3D name="t-tick" size={20} />Mentés
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
