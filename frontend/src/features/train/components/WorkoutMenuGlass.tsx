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
import { useState } from 'react'
import type { Challenge, LoggedWorkoutExercise } from '@/data/types'
import { videoEmbed } from '@/features/train/components/VideoDemo'
import { challengeConfidenceLine, challengeTypeIcon, challengeTypeLabel, targetChips } from '@/features/train/logic/challengeDisplay'
import { RefTag } from '@/shared/ui/RefTag'
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
  if (total === 0) return 'Ma nincs küldetés'
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
  /** id -> accepted (mock: the local toggle; live: status-derived). */
  accepted: Record<string, boolean>
  /** Tick / untick — the mock local toggle or real mode's persisted `decide` (accept / undo). */
  onToggle: (id: string) => void
  /** The lazy backend generation is in flight (real mode only). */
  pending: boolean
  /** The list could not be read (real mode only) — say so and offer a retry. */
  failed?: boolean
  onRetry?: () => void
  tint: string
  onClose: () => void
}

/** A resolved challenge (the workout is decided): its check slot shows the outcome instead. */
const OUTCOME: Partial<Record<string, { icon: Icon3DName; label: string }>> = {
  hit: { icon: 't-tick', label: 'teljesült' },
  miss: { icon: 't-skip', label: 'nem teljesült' },
  inconclusive: { icon: 't-skip', label: 'nem értékelhető' },
}

/**
 * The Küldetések glass — the start-of-workout picker (mezo-oy91i, owner-picked variant B of
 * `prototypes/uveg-kuldetes.html`). One row per challenge in the closing ceremony's shape (bible
 * U4 rule 28): the exercise name, then ONE chip line (the type chip with its 3D icon, then the
 * target values), the check circle at the top-right. „Miért ezt?" folds the reasoning open under
 * a hairline. Ticking accepts, unticking undoes; untouched rows simply stay offers. The foot
 * button closes the glass: „Indulhat · N küldetéssel" once something is ticked.
 */
export function WorkoutChallengesGlass({
  open, challenges, accepted, onToggle, pending, failed = false, onRetry, tint, onClose,
}: WorkoutChallengesGlassProps) {
  const [openWhy, setOpenWhy] = useState<string | null>(null)
  const acceptedCount = challenges.filter((c) => accepted[c.id]).length
  const sub = pending ? 'készül…' : acceptedCount > 0 ? `${acceptedCount} vállalva` : 'Válassz, amennyit bírsz'
  return (
    <GlassBox
      open={open} onClose={onClose} label="A mai küldetések" tint={tint} className="wos-gbx wos-gbx-chal"
      eyebrow="Küldetések"
      art={<Icon3D name="t-quest" size={52} className="wos-gb-art3d" />}
    >
      <div className="wos-gb wos-gb-chal">
        <p className="wos-gb-sub">{sub}</p>
        {pending ? (
          <ChallengeGenerationLoader />
        ) : failed ? (
          <div className="wos-gb-empty uv-empty">
            <p>A küldetések nem jöttek le. Az edzés ettől még indulhat.</p>
            {onRetry && <button type="button" className="wos-pill is-lit" onClick={onRetry}>Újra</button>}
          </div>
        ) : challenges.length === 0 ? (
          <p className="wos-gb-empty uv-empty">Ma nincs küldetés — ehhez az edzéshez még kevés az előzmény.</p>
        ) : (
          <>
            <p className="wos-qlead">Pipáld ki, amit vállalsz. A többi magától kimarad — passzolni ér.</p>
            <EntranceGroup className="wos-chlist">
              {challenges.map((c) => {
                const on = !!accepted[c.id]
                const outcome = c.status ? OUTCOME[c.status] : undefined
                const why = openWhy === c.id
                return (
                  <div key={c.id} className={`wos-qc${on ? ' is-accepted' : ''}${outcome ? ` is-${c.status}` : ''}`}>
                    <div className="wos-qc-body">
                      {c.exercise && <strong>{c.exercise}</strong>}
                      <span className="wos-qc-vals">
                        <span className="wos-qc-type">
                          <Icon3D name={challengeTypeIcon(c.type)} size={24} />
                          {challengeTypeLabel(c.typeLabel)}
                        </span>
                        {targetChips(c.target).map((v, j) => <b key={`${v}-${j}`}>{v}</b>)}
                      </span>
                    </div>
                    {outcome ? (
                      <span className="wos-qc-ck is-outcome" role="img" aria-label={outcome.label}>
                        <Icon3D name={outcome.icon} size={28} />
                      </span>
                    ) : (
                      <button
                        type="button" className="wos-qc-ck" aria-pressed={on}
                        aria-label={`${c.exercise ?? challengeTypeLabel(c.typeLabel)}: ${on ? 'vállalva' : 'vállalom'}`}
                        onClick={() => onToggle(c.id)}
                      >
                        <Icon3D name="t-tick" size={28} />
                      </button>
                    )}
                    {why && (
                      <div className="wos-qc-why">
                        <p>{outcome && c.outcome ? c.outcome : c.why}</p>
                        {!outcome && (
                          <span className="wos-qc-glory"><Icon3D name="t-star" size={20} />{c.glory}</span>
                        )}
                        <span className="wos-qc-conf">{challengeConfidenceLine(c.confidence, c.risk)}</span>
                        {c.refs.length > 0 && (
                          <span className="wos-qc-refs">
                            {c.refs.map((r, i) => <RefTag key={i} kind={r.kind} label={r.label} glass />)}
                          </span>
                        )}
                      </div>
                    )}
                    <button type="button" className="wos-qc-more" aria-expanded={why} onClick={() => setOpenWhy(why ? null : c.id)}>
                      {why ? 'Kevesebb' : 'Miért ezt? ›'}
                    </button>
                  </div>
                )
              })}
            </EntranceGroup>
          </>
        )}
        <button
          type="button"
          className={acceptedCount > 0 ? 'wos-qfoot is-lit' : 'wos-qfoot'}
          onClick={onClose}
        >
          {acceptedCount > 0 && <Icon3D name="t-dumbbell" size={24} />}
          {acceptedCount > 0 ? `Indulhat · ${acceptedCount} küldetéssel` : 'Ma küldetés nélkül'}
        </button>
      </div>
    </GlassBox>
  )
}
