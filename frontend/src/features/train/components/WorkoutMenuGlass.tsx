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
// are FLAT cells with Titanium 3D icons (Videó t-camera, Jegyzet t-note,
// Szett ± t-weight, Előrébb t-up, Hátrébb t-down, kihagyás t-skip / visszavétel t-repeat). The
// GlassBox cards carry `className="wos-gbx"` (U10, mezo-8vfr2) so the `uveg edzes session` block
// scopes the shared glass dialog to this page (centred, coral) without re-skinning every other
// caller; the card itself is the ONE glass, the `.wos-gb` bodies inside it are flat.
//
// Csere (mezo-mobji): a „Gyakorlat cseréje" row (t-swap) sits above the skip row; it opens the
// single-pick picker, then the „Csak ma / Mezociklusra is" sheet.
//
// Eligazítás (mezo-mgu2r): the challenge PICKER left this file for the briefing
// (WorkoutBriefing) and the menu lost its Küldetések row; what stays is ChallengeDetailGlass,
// opened from a card's challenge badge — release / take back one challenge mid-workout.
// ============================================================
import type { Challenge, LoggedWorkoutExercise } from '@/data/types'
import { videoEmbed } from '@/features/train/components/VideoDemo'
import { challengeConfidenceLine, challengeTypeIcon, challengeTypeLabel, targetChips } from '@/features/train/logic/challengeDisplay'
import { MuscleChip } from '@/features/train/components/MuscleChip'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
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
  /** Working sets already logged here — the swap row's hint (mezo-mobji). */
  loggedCount?: number
  /** Opens the swap picker; absent → no swap row (e.g. no started workout). */
  onSwap?: () => void
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

export function WorkoutMenuGlass({
  open, exercise, tint, position, orderLength, slotCount, skipped, hasNote, canRemoveTrailingSet,
  onClose, onVideo, onEditNote, onAddSet, onRemoveSet, onMoveEarlier, onMoveLater, onToggleSkip,
  loggedCount = 0, onSwap,
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
        {onSwap && (
          <MenuRow
            icon="t-swap" label="Gyakorlat cseréje"
            hint={loggedCount > 0 ? `A ${loggedCount} kész szett itt marad, a többi az újé` : 'Hasonlóra vagy bármi másra'}
            onClick={fire(onSwap)}
          />
        )}
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

/** A challenge badge's state on its card: taken on, released mid-workout, or resolved. */
export type ChallengeBadgeState = 'accepted' | 'released' | 'hit' | 'miss' | 'inconclusive'

const OUTCOME_LINE: Partial<Record<ChallengeBadgeState, string>> = {
  hit: 'Teljesült.',
  miss: 'Most nem jött össze — semmi gond.',
  inconclusive: 'Ebből nem tudtuk eldönteni.',
}

export interface ChallengeDetailGlassProps {
  open: boolean
  challenge: Challenge | null
  state: ChallengeBadgeState
  tint: string
  /** accepted → release ('undo'); released → take back ('accept'). */
  onToggle: () => void
  onClose: () => void
}

/**
 * One challenge, opened from its card badge (mezo-mgu2r, prototype gbox `qb`): the type, the
 * exercise, the target big, the reasoning, and ONE action — Elengedem (no penalty, it just drops
 * out of the closing tally) or Visszaveszem. A resolved challenge shows its outcome instead.
 */
export function ChallengeDetailGlass({ open, challenge, state, tint, onToggle, onClose }: ChallengeDetailGlassProps) {
  if (!challenge) return null
  const label = challengeTypeLabel(challenge.typeLabel)
  const outcome = OUTCOME_LINE[state]
  return (
    <GlassBox
      open={open} onClose={onClose} label={`${label} küldetés`} tint={tint} className="wos-gbx wos-gbx-qd"
      eyebrow={state === 'accepted' ? 'Küldetés · vállalva' : state === 'released' ? 'Küldetés · elengedve' : 'Küldetés'}
      art={<Icon3D name={challengeTypeIcon(challenge.type)} size={52} className="wos-gb-art3d" />}
    >
      <div className="wos-gb wos-gb-qd">
        {challenge.exercise && <p className="wos-gb-sub">{challenge.exercise}</p>}
        <div className="wos-qd-target">
          {targetChips(challenge.target).map((v, j) => <b key={`${v}-${j}`}>{v}</b>)}
        </div>
        <span className="wos-qc-conf">{challengeConfidenceLine(challenge.confidence, challenge.risk)}</span>
        <p className="wos-qd-why">{outcome && challenge.outcome ? challenge.outcome : challenge.why}</p>
        {outcome ? (
          <p className="wos-qd-note">{outcome}</p>
        ) : (
          <>
            <button
              type="button"
              className={state === 'accepted' ? 'wos-pill is-block is-warn' : 'wos-pill is-block is-lit'}
              onClick={() => { onToggle(); onClose() }}
            >
              <Icon3D name={state === 'accepted' ? 't-skip' : 't-quest'} size={22} />
              {state === 'accepted' ? 'Elengedem' : 'Visszaveszem'}
            </button>
            <p className="wos-qd-note">
              {state === 'accepted'
                ? 'Büntetés nélkül — elengedve nem számít a zárásnál. Bármikor visszaveheted.'
                : 'Most nem számít bele a zárásba. Ha mégis nekifutsz, vedd vissza.'}
            </p>
          </>
        )}
      </div>
    </GlassBox>
  )
}
