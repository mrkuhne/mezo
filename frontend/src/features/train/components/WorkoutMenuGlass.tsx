// ============================================================
// Mezo · WorkoutMenuGlass — the exercise's menu, its video and the quest detail of the active workout.
//
// Folyadék F4 (mezo-n4wf5.4, area C): the three former glasses are light sheets
// (`<Sheet className="fo-sheet">` + `FoSheetHead`), built to the prototype's `menu`, `demo` and `qb` sheets
// (docs/design_2.0/prototypes/vilagos/edzes.js). The component names and props are the ones the page already
// uses (`tint` is kept in the props and no longer drawn: the muscle chip and the capsules carry the colour).
//
//   · WorkoutMenuGlass — everything that is not „log this set": Videó (only when the exercise carries a demo
//     url) · Jegyzet · Szett hozzáadása · Szett elvétele · Előrébb · Hátrébb · Gyakorlat cseréje (only with
//     `onSwap`) · Gyakorlat kihagyása / Visszavesszük. Under the head the exercise's sets stand as capsules.
//     Every row runs its handler THEN closes (`fire`) — except Videó, whose handler switches the page to the
//     video sheet (the menu's `open` then simply reads false).
//   · WorkoutVideoGlass — the demo video in a frame (VideoDemo's `videoEmbed` resolver), or the empty state.
//     The hero's „Technika" and the menu's „Videó" both open this.
//   · ChallengeDetailGlass — one quest, opened from its line on the exercise: the type, the exercise, the
//     target big, how sure it is (a level), the reasoning, and ONE action — Elengedem (no penalty) or
//     Visszaveszem. A resolved quest shows its outcome instead.
// ============================================================
import type { Challenge, LoggedWorkoutExercise } from '@/data/types'
import { MUSCLE_LABELS } from '@/data/train/train'
import { videoEmbed } from '@/features/train/components/VideoDemo'
import { challengeConfidenceLine, challengeTypeIcon, challengeTypeLabel, targetChips } from '@/features/train/logic/challengeDisplay'
import { Mchp, deepMuscle } from '@/features/train/components/folyadek'
import type { Icon3DName } from '@/shared/ui/clay'
import { Acts, Btn, Bub, Caps, FoSheetHead, Lab, Level, Note, Row, SheetGraphic, Txt } from '@/shared/ui/folyadek'
import { Sheet } from '@/shared/ui/Sheet'

const muscleLabel = (muscle: string) => MUSCLE_LABELS[muscle] ?? muscle

export interface WorkoutMenuGlassProps {
  open: boolean
  /** The exercise whose menu this is — the head, the capsules and the Videó row. */
  exercise: LoggedWorkoutExercise
  /** Kept for the callers; the light sheet draws the muscle's own colour instead. */
  tint: string
  /** 0-based position of `exercise` in the session's current display order. */
  position: number
  /** Total exercise count of the session — the far end Hátrébb disables against. */
  orderLength: number
  /** Effective set count of this exercise right now (the capsules, Szett hozzáadása's hint). */
  slotCount: number
  skipped: boolean
  /** Whether a durable note already exists (toggles the Jegyzet hint). */
  hasNote: boolean
  /** Enabled only for an unchecked TRAILING slot (canRemoveSet + last slot pending). */
  canRemoveTrailingSet: boolean
  onClose: () => void
  /** Opens the video sheet — does NOT also call onClose (see file header). */
  onVideo: () => void
  onEditNote: () => void
  onAddSet: () => void
  onRemoveSet: () => void
  onMoveEarlier: () => void
  onMoveLater: () => void
  onToggleSkip: () => void
  /** Working sets already logged here — the full capsules and the swap row's hint (mezo-mobji). */
  loggedCount?: number
  /** Opens the swap picker; absent → no swap row (e.g. no started workout). */
  onSwap?: () => void
}

function MenuRow({ icon, label, hint, disabled, bad, onClick }: {
  icon: Icon3DName; label: string; hint: string; disabled?: boolean
  /** The destructive-ish row (Gyakorlat kihagyása) reads in the danger tone. */
  bad?: boolean
  onClick: () => void
}) {
  return <Row icon={icon} title={label} sub={hint} bad={bad} disabled={disabled} chev={!disabled} onClick={onClick} />
}

/** The note row's hint: what it says the note is FOR. */
export function noteHint(hasNote: boolean): string {
  return hasNote ? 'a megírt jegyzet szerkesztése' : 'ami a következő alkalomra számít'
}

export function WorkoutMenuGlass({
  open, exercise, position, orderLength, slotCount, skipped, hasNote, canRemoveTrailingSet,
  onClose, onVideo, onEditNote, onAddSet, onRemoveSet, onMoveEarlier, onMoveLater, onToggleSkip,
  loggedCount = 0, onSwap,
}: WorkoutMenuGlassProps) {
  if (!open) return null
  // Every row but Videó runs its action then dismisses the sheet (Videó switches the page to the OTHER sheet).
  const fire = (fn: () => void) => () => {
    fn()
    onClose()
  }
  const done = Math.min(loggedCount, slotCount)
  const state = skipped ? 'kihagyva' : `${done} / ${slotCount} szett kész`

  return (
    <Sheet onClose={onClose} labelledBy="wo-menu-title" className="fo-sheet el-sheet">
      {(close) => (
        <>
          <FoSheetHead
            eyebrow="Gyakorlat" title={exercise.name} titleId="wo-menu-title"
            sub={`${slotCount} szett · ${muscleLabel(exercise.muscle)}`} left={<Mchp muscle={exercise.muscle} />} onClose={close}
          />
          <SheetGraphic note={state}>
            <Caps n={slotCount} done={done} cur={skipped ? undefined : done} color={deepMuscle(exercise.muscle)} size="big" />
          </SheetGraphic>
          <div className="el-ls">
            {exercise.videoUrl && (
              <MenuRow icon="t-camera" label="Videó" hint="a gyakorlathoz csatolt felvétel" onClick={onVideo} />
            )}
            <MenuRow icon="t-note" label="Jegyzet" hint={noteHint(hasNote)} onClick={fire(onEditNote)} />
            <MenuRow icon="t-weight" label="Szett hozzáadása" hint={`most ${slotCount} szett van`} disabled={skipped} onClick={fire(onAddSet)} />
            <MenuRow
              icon="t-weight" label="Szett elvétele" hint="csak a még üres utolsó szett"
              disabled={skipped || !canRemoveTrailingSet} onClick={fire(onRemoveSet)}
            />
            <MenuRow icon="t-up" label="Előrébb" hint="egy hellyel korábban" disabled={position === 0} onClick={fire(onMoveEarlier)} />
            <MenuRow icon="t-down" label="Hátrébb" hint="egy hellyel később" disabled={position === orderLength - 1} onClick={fire(onMoveLater)} />
            {onSwap && (
              <MenuRow
                icon="t-swap" label="Gyakorlat cseréje"
                hint={loggedCount > 0 ? `a ${loggedCount} kész szett itt marad, a többi az újé` : 'hasonlóra vagy bármi másra'}
                onClick={fire(onSwap)}
              />
            )}
            <MenuRow
              icon={skipped ? 't-repeat' : 't-skip'}
              bad={!skipped}
              label={skipped ? 'Visszavesszük' : 'Gyakorlat kihagyása'}
              hint={skipped ? 'újra bekerül a mai munkába' : 'a már naplózott szettjeid megmaradnak'}
              onClick={fire(onToggleSkip)}
            />
          </div>
        </>
      )}
    </Sheet>
  )
}

export interface WorkoutVideoGlassProps {
  open: boolean
  /** Null once the sheet is closing. */
  exercise: LoggedWorkoutExercise | null
  /** Kept for the callers; not drawn. */
  tint: string
  onClose: () => void
}

/** The video sheet: the exercise's demo url embedded in a frame, or „Nincs elérhető videó". */
export function WorkoutVideoGlass({ open, exercise, onClose }: WorkoutVideoGlassProps) {
  if (!open) return null
  const embed = videoEmbed(exercise?.videoUrl)
  return (
    <Sheet onClose={onClose} labelledBy="wo-video-title" className="fo-sheet el-sheet">
      {(close) => (
        <>
          <FoSheetHead
            eyebrow="Videó" titleId="wo-video-title" onClose={close}
            title={exercise ? <>{exercise.name}{' '}<span className="sr-only">· videó</span></> : 'Videó'}
            sub={exercise ? muscleLabel(exercise.muscle) : undefined}
            left={exercise ? <Mchp muscle={exercise.muscle} /> : undefined}
          />
          {embed ? (
            <div className="el-vid" style={{ aspectRatio: embed.aspectRatio }}>
              <iframe title="Demo videó" loading="lazy" allowFullScreen src={embed.src} />
            </div>
          ) : (
            <div className="el-vid is-empty">
              <Bub icon="t-camera" size={54} />
              <small>Nincs elérhető videó</small>
            </div>
          )}
        </>
      )}
    </Sheet>
  )
}

/** A quest's state on its exercise: taken on, released mid-workout, or resolved. */
export type ChallengeBadgeState = 'accepted' | 'released' | 'hit' | 'miss' | 'inconclusive'

const OUTCOME_LINE: Partial<Record<ChallengeBadgeState, string>> = {
  hit: 'Teljesült.',
  miss: 'Most nem jött össze — semmi gond.',
  inconclusive: 'Ebből nem tudtuk eldönteni.',
}

/** The target as one big line: „107,5 kg × 8"; free-text targets keep their own pieces („RIR 0 · utolsó szett"). */
function targetLine(target: string): string {
  const kgReps = /^(\d+(?:[.,]\d+)?)\s*kg\s*×\s*(\d+)$/i.exec(target.trim())
  if (kgReps) return `${kgReps[1].replace('.', ',')} kg × ${kgReps[2]}`
  return targetChips(target).join(' · ')
}

export interface ChallengeDetailGlassProps {
  open: boolean
  challenge: Challenge | null
  state: ChallengeBadgeState
  /** Kept for the callers; not drawn. */
  tint: string
  /** accepted → release ('undo'); released → take back ('accept'). */
  onToggle: () => void
  onClose: () => void
}

/**
 * One quest, opened from its line on the exercise (prototype sheet `qb`): the type, the exercise, the target big,
 * how sure it is, the reasoning, and ONE action — Elengedem (no penalty, it just drops out of the closing tally) or
 * Visszaveszem. A resolved quest shows its outcome instead.
 */
export function ChallengeDetailGlass({ open, challenge, state, onToggle, onClose }: ChallengeDetailGlassProps) {
  if (!open || !challenge) return null
  const label = challengeTypeLabel(challenge.typeLabel)
  const outcome = OUTCOME_LINE[state]
  const pct = challenge.confidence == null ? null : Math.round(challenge.confidence * 100)
  return (
    <Sheet onClose={onClose} labelledBy="wo-quest-title" className="fo-sheet el-sheet">
      {(close) => (
        <>
          <FoSheetHead
            eyebrow={outcome ? 'Küldetés' : state === 'accepted' ? 'Küldetés · vállalva' : 'Küldetés · elengedve'}
            title={<>{label}{' '}<span className="sr-only">küldetés</span></>} titleId="wo-quest-title"
            sub={challenge.exercise || undefined} icon={challengeTypeIcon(challenge.type)} onClose={close}
          />
          <p className="el-qd-target">{targetLine(challenge.target)}</p>
          <Lab>{challengeConfidenceLine(challenge.confidence, challenge.risk)}</Lab>
          {pct != null && <Level pct={pct} color="var(--fo-gold)" height={22} label={`${pct}% biztos`} />}
          <Txt className="el-qd-why">{outcome && challenge.outcome ? challenge.outcome : challenge.why}</Txt>
          {outcome ? (
            <Note>{outcome}</Note>
          ) : (
            <>
              <Acts>
                <Btn grow onClick={() => { onToggle(); onClose() }}>{state === 'accepted' ? 'Elengedem' : 'Visszaveszem'}</Btn>
              </Acts>
              <Note>
                {state === 'accepted'
                  ? 'Büntetés nélkül — elengedve nem számít a zárásnál. Bármikor visszaveheted.'
                  : 'Most nem számít bele a zárásba. Ha mégis nekifutsz, vedd vissza.'}
              </Note>
            </>
          )}
        </>
      )}
    </Sheet>
  )
}
