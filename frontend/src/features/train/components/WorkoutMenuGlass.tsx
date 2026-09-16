// ============================================================
// Mezo · WorkoutMenuGlass (mezo-88iwa.7, T6 Task 4) — the per-card ⋮ menu, ported
// off the shared GlassBox primitive. Replaces the old ExerciseActionSheet for the
// active-workout card list: everything that is not "log this set" lives here.
//
// Ported 1:1 from the prototype's `menuGlass` (docs/design_2.0/prototypes/
// companion-titanium/session.js:101-126): Videó (only when the exercise carries a
// demo url) · Jegyzet · Szett hozzáadása · Szett elvétele · Előrébb · Hátrébb ·
// Gyakorlat kihagyása / Visszavesszük. Every action row runs its handler THEN
// closes the glass (mirrors the old sheet's `fire` idiom) — except Videó, whose
// handler switches the page to the VIDEO glass instead (the menu glass's `open`
// prop then simply reads false, no separate close needed).
//
// A second, minimal glass — WorkoutVideoGlass — embeds the exercise's demo video
// inside `.wo-video-frame`, reusing VideoDemo's `videoEmbed` resolver (the same
// YouTube/Instagram idiom already used by ExerciseRecordSheet and the exercise
// picker) rather than inventing a second embed path.
// ============================================================
import type { LoggedWorkoutExercise } from '@/data/types'
import { videoEmbed } from '@/features/train/components/VideoDemo'
import { ClayIcon, type ClayIconName } from '@/shared/ui/clay'
import { GlassBox } from '@/shared/ui/mozaik/GlassBox'

export interface WorkoutMenuGlassProps {
  open: boolean
  /** The card whose menu this is — drives the glass label/tint and the Videó row. */
  exercise: LoggedWorkoutExercise
  /** Accent for the glass card (the exercise's own muscle-family color). */
  tint: string
  /** 0-based position of `exercise` in the session's current display order. */
  position: number
  /** Total exercise count of the session — the far end Hátrébb disables against. */
  orderLength: number
  /** Effective set count of this exercise right now (Szett hozzáadása's hint). */
  slotCount: number
  skipped: boolean
  /** Whether a durable note already exists (toggles the Jegyzet hint). */
  hasNote: boolean
  /** Enabled only for an unchecked TRAILING slot (canRemoveSet + last slot pending). */
  canRemoveTrailingSet: boolean
  onClose: () => void
  /** Opens the video glass — does NOT also call onClose (see file header). */
  onVideo: () => void
  onEditNote: () => void
  onAddSet: () => void
  onRemoveSet: () => void
  onMoveEarlier: () => void
  onMoveLater: () => void
  onToggleSkip: () => void
}

function MenuRow({
  icon, label, hint, disabled, onClick,
}: {
  icon: ClayIconName
  label: string
  hint: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button type="button" className="wo-menu-row" disabled={disabled} onClick={onClick}>
      <ClayIcon name={icon} size={28} />
      <span>
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
      <b>›</b>
    </button>
  )
}

/** The note row's hint (prototype `note()`, session.js:127): what it says the note is FOR. */
export function noteHint(hasNote: boolean): string {
  return hasNote ? 'Megírt jegyzet szerkesztése' : 'Ami a következő alkalomra számít'
}

export function WorkoutMenuGlass({
  open, exercise, tint, position, orderLength, slotCount, skipped, hasNote, canRemoveTrailingSet,
  onClose, onVideo, onEditNote, onAddSet, onRemoveSet, onMoveEarlier, onMoveLater, onToggleSkip,
}: WorkoutMenuGlassProps) {
  // Every row but Videó runs its action then dismisses the glass (Videó switches
  // the page to the OTHER glass instead — see the file header).
  const fire = (fn: () => void) => () => {
    fn()
    onClose()
  }

  return (
    <GlassBox open={open} onClose={onClose} label={exercise.name} tint={tint} variant="menu">
      <div className="wo-menu">
        {exercise.videoUrl && (
          <MenuRow icon="i-video" label="Videó" hint="A gyakorlathoz csatolt felvétel" onClick={onVideo} />
        )}
        <MenuRow icon="i-checkin" label="Jegyzet" hint={noteHint(hasNote)} onClick={fire(onEditNote)} />
        <MenuRow
          icon="i-suly" label="Szett hozzáadása" hint={`Most ${slotCount} szett van`}
          disabled={skipped} onClick={fire(onAddSet)}
        />
        <MenuRow
          icon="i-suly" label="Szett elvétele" hint="Csak bepipálatlan utolsó szett"
          disabled={skipped || !canRemoveTrailingSet} onClick={fire(onRemoveSet)}
        />
        <MenuRow
          icon="i-stack" label="Előrébb" hint="Egy hellyel korábban"
          disabled={position === 0} onClick={fire(onMoveEarlier)}
        />
        <MenuRow
          icon="i-stack" label="Hátrébb" hint="Egy hellyel később"
          disabled={position === orderLength - 1} onClick={fire(onMoveLater)}
        />
        <MenuRow
          icon="i-eletjel"
          label={skipped ? 'Visszavesszük' : 'Gyakorlat kihagyása'}
          hint={skipped ? 'Újra bekerül a mai munkába' : 'A már logolt szettjeid megmaradnak'}
          onClick={fire(onToggleSkip)}
        />
      </div>
    </GlassBox>
  )
}

export interface WorkoutVideoGlassProps {
  open: boolean
  /** Null once the glass is closing (mirrors GlassBox's own open-gates-render idiom). */
  exercise: LoggedWorkoutExercise | null
  tint: string
  onClose: () => void
}

/** The minimal video glass (Task 4): a `.wo-video-frame` embed of the exercise's demo url. */
export function WorkoutVideoGlass({ open, exercise, tint, onClose }: WorkoutVideoGlassProps) {
  const embed = videoEmbed(exercise?.videoUrl)
  return (
    <GlassBox open={open} onClose={onClose} label={exercise ? `${exercise.name} · videó` : 'Videó'} tint={tint}>
      {embed ? (
        <div className="wo-video-frame" style={{ aspectRatio: embed.aspectRatio }}>
          <iframe
            title="Demo videó"
            loading="lazy"
            allowFullScreen
            src={embed.src}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
          />
        </div>
      ) : (
        <div className="wo-video-frame">
          <ClayIcon name="i-video" size={62} />
          <span>Nincs elérhető videó</span>
        </div>
      )}
    </GlassBox>
  )
}
