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
// YouTube/Instagram idiom the exercise picker also uses — the third user, the
// pre-Titanium `ExerciseRecordSheet`, was deleted in mezo-lf3cv) rather than
// inventing a second embed path.
//
// Üvegesítés U4 (mezo-me75u.4): the three glasses wear the dark glass (coral `--c`), their rows
// are FLAT cells with Titanium 3D icons (Videó t-camera, Küldetések t-quest, Jegyzet t-note,
// Szett ± t-weight, Előrébb t-up, Hátrébb t-down, kihagyás t-skip / visszavétel t-repeat). The
// GlassBox cards carry `className="wos-gbx"` (U10, mezo-8vfr2) so the `uveg edzes session` block
// scopes the shared glass dialog to this page (centred, coral) without re-skinning every other
// caller; the card itself is the ONE glass, the `.wos-gb` bodies inside it are flat.
// ============================================================
import type { Challenge, LoggedWorkoutExercise } from '@/data/types'
import { videoEmbed } from '@/features/train/components/VideoDemo'
import { ChallengeCard } from '@/features/train/components/ChallengeCard'
import { ChallengeGenerationLoader } from '@/features/train/components/ChallengeGenerationLoader'
import { MuscleChip } from '@/features/train/components/MuscleChip'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { GlassBox } from '@/shared/ui/mozaik/GlassBox'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

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
  /** How many of the day's challenges are accepted right now (the Küldetések row's hint). */
  acceptedChallenges: number
  /** How many the day offers at all — 0 renders the honest "ma nincs" hint. */
  totalChallenges: number
  /** The day's challenge list is still being generated (real mode's lazy LLM call). */
  challengesPending: boolean
  onClose: () => void
  /** Opens the video glass — does NOT also call onClose (see file header). */
  onVideo: () => void
  /** Opens the Küldetések glass — like onVideo, does NOT also call onClose. */
  onChallenges: () => void
  onEditNote: () => void
  onAddSet: () => void
  onRemoveSet: () => void
  onMoveEarlier: () => void
  onMoveLater: () => void
  onToggleSkip: () => void
}

function MenuRow({
  icon, label, hint, disabled, warn, onClick,
}: {
  icon: Icon3DName
  label: string
  hint: string
  disabled?: boolean
  /** The destructive-ish row (Gyakorlat kihagyása) reads coral. */
  warn?: boolean
  onClick: () => void
}) {
  return (
    <button type="button" className={warn ? 'wo-menu-row is-warn' : 'wo-menu-row'} disabled={disabled} onClick={onClick}>
      <Icon3D name={icon} size={32} />
      <span>
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
      <b aria-hidden="true">›</b>
    </button>
  )
}

/** The note row's hint (prototype `note()`, session.js:127): what it says the note is FOR. */
export function noteHint(hasNote: boolean): string {
  return hasNote ? 'Megírt jegyzet szerkesztése' : 'Ami a következő alkalomra számít'
}

/** The Küldetések row's hint (mezo-e1ii9) — the day's quest state in one line. */
export function challengeHint(pending: boolean, accepted: number, total: number): string {
  if (pending) return 'A mai ajánlatok készülnek…'
  if (total === 0) return 'Ma nincs kihívás'
  return `${accepted}/${total} elfogadva`
}

export function WorkoutMenuGlass({
  open, exercise, tint, position, orderLength, slotCount, skipped, hasNote, canRemoveTrailingSet,
  acceptedChallenges, totalChallenges, challengesPending,
  onClose, onVideo, onChallenges, onEditNote, onAddSet, onRemoveSet, onMoveEarlier, onMoveLater, onToggleSkip,
}: WorkoutMenuGlassProps) {
  // Every row but Videó runs its action then dismisses the glass (Videó switches
  // the page to the OTHER glass instead — see the file header).
  const fire = (fn: () => void) => () => {
    fn()
    onClose()
  }

  return (
    <GlassBox
      open={open} onClose={onClose} label={exercise.name} tint={tint} variant="menu" className="wos-gbx"
      eyebrow="Gyakorlat"
      art={<span className="wos-gb-art"><MuscleChip token={exercise.muscle} size={40} /></span>}
    >
      <div className="wo-menu wos-gb wos-gb-menu">
        {exercise.videoUrl && (
          <MenuRow icon="t-camera" label="Videó" hint="A gyakorlathoz csatolt felvétel" onClick={onVideo} />
        )}
        {/* The day's quests (mezo-e1ii9): the home the retired prep mosaic's Küldetések
            tile handed over to. Like Videó, it switches the page to its OWN glass. */}
        <MenuRow
          icon="t-quest" label="Küldetések"
          hint={challengeHint(challengesPending, acceptedChallenges, totalChallenges)}
          onClick={onChallenges}
        />
        <MenuRow icon="t-note" label="Jegyzet" hint={noteHint(hasNote)} onClick={fire(onEditNote)} />
        <MenuRow
          icon="t-weight" label="Szett hozzáadása" hint={`Most ${slotCount} szett van`}
          disabled={skipped} onClick={fire(onAddSet)}
        />
        <MenuRow
          icon="t-weight" label="Szett elvétele" hint="Csak bepipálatlan utolsó szett"
          disabled={skipped || !canRemoveTrailingSet} onClick={fire(onRemoveSet)}
        />
        <MenuRow
          icon="t-up" label="Előrébb" hint="Egy hellyel korábban"
          disabled={position === 0} onClick={fire(onMoveEarlier)}
        />
        <MenuRow
          icon="t-down" label="Hátrébb" hint="Egy hellyel később"
          disabled={position === orderLength - 1} onClick={fire(onMoveLater)}
        />
        <MenuRow
          icon={skipped ? 't-repeat' : 't-skip'}
          warn={!skipped}
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
    <GlassBox open={open} onClose={onClose} label={exercise ? `${exercise.name} · videó` : 'Videó'} tint={tint} className="wos-gbx">
      <div className="wos-gb wos-gb-video">
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
        <div className="wo-video-frame uv-empty">
          <Icon3D name="t-camera" size={62} />
          <span>Nincs elérhető videó</span>
        </div>
      )}
      </div>
    </GlassBox>
  )
}

export interface WorkoutChallengesGlassProps {
  open: boolean
  /** The day's challenges (mock seed or the live server list — `useChallenges`). */
  challenges: Challenge[]
  /** id -> accepted, the same map the retired prep tile fed to `ChallengeCard`. */
  accepted: Record<string, boolean>
  /** Accept/dismiss — the mock local toggle or real mode's persisted `decide`. */
  onToggle: (id: string) => void
  /** The lazy backend generation is in flight (real mode only). */
  pending: boolean
  tint: string
  onClose: () => void
}

/**
 * The Küldetések glass (mezo-e1ii9) — accept/dismiss's home now that the pre-Titanium
 * prep mosaic is gone. Opened from the workout header's ⋯ menu; the body is the SAME
 * three states, the SAME `ChallengeCard`s and the SAME copy the old `PrepKuldetesekPage`
 * carried (pending loader → honest empty line → the vertical card stack + the
 * "passzolni ér" principle), just docked in a glass instead of a full page.
 */
export function WorkoutChallengesGlass({
  open, challenges, accepted, onToggle, pending, tint, onClose,
}: WorkoutChallengesGlassProps) {
  const acceptedCount = challenges.filter((c) => accepted[c.id]).length
  return (
    <GlassBox
      open={open} onClose={onClose} label="A mai küldetések" tint={tint} className="wos-gbx wos-gbx-chal"
      eyebrow="Küldetések"
      art={<Icon3D name="t-quest" size={52} className="wos-gb-art3d" />}
    >
      <div className="wos-gb wos-gb-chal">
        <p className="wos-gb-sub">{pending ? 'készül…' : `${acceptedCount} / ${challenges.length} elfogadva`}</p>
        {pending ? (
          <ChallengeGenerationLoader />
        ) : challenges.length === 0 ? (
          <p className="wos-gb-empty uv-empty">Ma nincs kihívás</p>
        ) : (
          <EntranceGroup className="wos-chlist">
            {challenges.map((c) => (
              <ChallengeCard key={c.id} challenge={c} accepted={!!accepted[c.id]} onToggle={() => onToggle(c.id)} />
            ))}
          </EntranceGroup>
        )}
        <p className="wos-gb-note">
          Passzolni ér — a kihívás ajánlat, nem elvárás. Az eredmény a záráskor derül ki, és sosem piros.
        </p>
      </div>
    </GlassBox>
  )
}
