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
// Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js sheet `video`): the light sheet with the
// kit head (t-play bubble), one kit URL field, and the foot — Mentés, with „Eltávolítás" as the
// red text link when a video exists, „Mégse" otherwise.
// ============================================================
import { useState } from 'react'
import { useTrain } from '@/data/hooks'
import { Sheet } from '@/shared/ui/Sheet'
import { Acts, Btn, FoSheetHead, Input, Lab, Lk } from '@/shared/ui/folyadek'

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
    <Sheet onClose={onClose} labelledBy="video-url-title" className="fo-sheet">
      {(close) => (
        <>
          <FoSheetHead icon="t-play" eyebrow={`Videó · ${exercise.name}`} title="Demo videó" titleId="video-url-title" onClose={close} />

          <Lab htmlFor="video-url-input">Videó URL</Lab>
          <Input
            id="video-url-input"
            aria-label="Videó URL"
            placeholder="https://youtu.be/… vagy https://instagram.com/reel/…"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
          />

          {/* Foot — Eltávolítás clears an existing video; Mégse just closes when there is none */}
          <Acts>
            <Btn grow disabled={saving} onClick={() => persist(videoUrl.trim() || null, close)}>Mentés</Btn>
            {hadVideo
              ? <Lk className="er-bad" disabled={saving} onClick={() => persist(null, close)}>Eltávolítás</Lk>
              : <Lk onClick={close}>Mégse</Lk>}
          </Acts>
        </>
      )}
    </Sheet>
  )
}
