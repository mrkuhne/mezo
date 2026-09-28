// ============================================================
// Mezo · WorkoutBriefing (mezo-mgu2r) — the Eligazítás, the 'brief' phase of /train/session.
// A fresh start opens here (a resumed workout never does): the duration band, the counts, the
// niggle, the day's challenges to opt into (pre-ticked by the owner-approved rule), the overload
// line, the exercise list, and the sticky Indulás that starts the workout. Presentational only —
// ActiveWorkoutPage owns the state and the start.
// Build target: docs/design_2.0/prototypes/elo/edzes.html `#indulas` (`briefing()`).
// Ranking (bible §3.4): the hero is a frameless halo, the challenge card is the ONE glass,
// everything else is flat.
// ============================================================
import type { ReactNode } from 'react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { Challenge, NiggleWarning, OverloadSummary } from '@/data/types'
import { ChallengeGenerationLoader } from '@/features/train/components/ChallengeGenerationLoader'
import { MuscleChip } from '@/features/train/components/MuscleChip'
import { WorkoutOverloadLine } from '@/features/train/components/WorkoutOverloadLine'
import { challengeConfidenceLine, challengeTypeIcon, challengeTypeLabel, targetChips } from '@/features/train/logic/challengeDisplay'
import { Icon3D } from '@/shared/ui/clay'

export interface BriefingExercise {
  id: string
  name: string
  muscle: string
  sets: number
  /** "105 × 10" — the first working set's prescription; null when the plan carries none. */
  goal: string | null
  chip: { text: string; tone: 'up' | 'hold' | 'down' } | null
  /** Why the target sits past the range top (reps before a too-big jump, mezo-bk7sn); else null. */
  why?: string | null
}

export interface WorkoutBriefingProps {
  title: string
  eyebrow: string
  /** The duration band; null while unknown (timing profile pending / nothing to estimate). */
  minutes: [number, number] | null
  exerciseCount: number
  setCount: number
  niggle: NiggleWarning | null | undefined
  challenges: Challenge[]
  pending: boolean
  failed: boolean
  onRetry?: () => void
  ticked: Record<string, boolean>
  onToggle: (id: string) => void
  overload: OverloadSummary | null | undefined
  exercises: BriefingExercise[]
  onBack: () => void
  onStart: () => void
  /** The kalauz ? — only when the route has a kalauz. */
  kalauzButton?: ReactNode
}

export function WorkoutBriefing({
  title, eyebrow, minutes, exerciseCount, setCount, niggle, challenges, pending, failed, onRetry,
  ticked, onToggle, overload, exercises, onBack, onStart, kalauzButton,
}: WorkoutBriefingProps) {
  const [openWhy, setOpenWhy] = useState<string | null>(null)
  const tickedCount = challenges.filter((c) => ticked[c.id]).length
  const questOn = (exerciseId: string) => challenges.some((c) => ticked[c.id] && c.exerciseId === exerciseId)

  return (
    <div className="wos wbr">
      <div className="wk-top wos-top wbr-top" data-kalauz-anchor="session-start">
        <button type="button" className="back wos-rb np-press" aria-label="Vissza" onClick={onBack}>‹</button>
        <div className="tt"><div className="t1">Eligazítás</div></div>
        {kalauzButton}
      </div>

      <section className="wbr-hero" aria-label={`${title} · várható időtartam`}>
        <Icon3D name="t-clock" size={84} className="wbr-hero-art" />
        <span className="wbr-eyebrow">{eyebrow}</span>
        <div className="wbr-num">
          {minutes ? <>{minutes[0]}–{minutes[1]}<small>perc</small></> : <span className="wbr-num-pending">…</span>}
        </div>
        <p className="wbr-sub">ennyi várható, a saját tempód alapján</p>
        <div className="wbr-pills">
          <span className="uv-flat">{exerciseCount} gyakorlat</span>
          <span className="uv-flat">{setCount} szett</span>
        </div>
      </section>

      {niggle && (
        <div className="wos-warn-wrap">
          <div className="warmstrip wos-warn" role="note" aria-label="Sérülés-figyelmeztetés">
            <Icon3D name="t-bandage" size={30} />
            <span>
              <b>{niggle.muscleLabel ?? 'Jobb váll'} aktív</b> · {niggle.detail || 'óvatos, először warm-up'}
            </span>
          </div>
        </div>
      )}

      <section className="wbr-quests glass" aria-label="Küldetések">
        <div className="wbr-qhead">
          <Icon3D name="t-quest" size={40} />
          <span>
            <span className="wbr-eyebrow">KÜLDETÉSEK · MA</span>
            <h3>Mit vállalsz ma?</h3>
          </span>
        </div>
        {pending ? (
          <ChallengeGenerationLoader />
        ) : failed ? (
          <div className="wbr-qempty">
            <p>A küldetések nem jöttek le. Az edzés ettől még indulhat.</p>
            {onRetry && <button type="button" className="wos-pill is-lit" onClick={onRetry}>Újra</button>}
          </div>
        ) : challenges.length === 0 ? (
          <p className="wbr-qempty">Ma nincs küldetés — ehhez az edzéshez még kevés az előzmény.</p>
        ) : (
          <>
            <div className="wbr-chlist">
              {challenges.map((c) => {
                const on = !!ticked[c.id]
                const why = openWhy === c.id
                return (
                  <div key={c.id} className={`wos-qc${on ? ' is-accepted' : ''}`}>
                    <div className="wos-qc-body">
                      {c.exercise && <strong>{c.exercise}</strong>}
                      <span className="wos-qc-vals">
                        <span className="wos-qc-type">
                          <Icon3D name={challengeTypeIcon(c.type)} size={24} />
                          {challengeTypeLabel(c.typeLabel)}
                        </span>
                        {targetChips(c.target).map((v, j) => <b key={`${v}-${j}`}>{v}</b>)}
                      </span>
                      <span className="wos-qc-conf">{challengeConfidenceLine(c.confidence, c.risk)}</span>
                    </div>
                    <button
                      type="button" className="wos-qc-ck" aria-pressed={on}
                      aria-label={`${c.exercise ?? challengeTypeLabel(c.typeLabel)} · ${challengeTypeLabel(c.typeLabel)}: ${on ? 'vállalva' : 'vállalom'}`}
                      onClick={() => onToggle(c.id)}
                    >
                      <Icon3D name="t-tick" size={28} />
                    </button>
                    {why && (
                      <div className="wos-qc-why">
                        <p>{c.why}</p>
                        <span className="wos-qc-glory"><Icon3D name="t-star" size={20} />{c.glory}</span>
                      </div>
                    )}
                    <button type="button" className="wos-qc-more" aria-expanded={why} onClick={() => setOpenWhy(why ? null : c.id)}>
                      {why ? 'Kevesebb' : 'Miért ezt? ›'}
                    </button>
                  </div>
                )
              })}
            </div>
            <p className="wbr-qnote">Az előre bepipáltakat javaslom. Passzolni ér — és edzés közben is elengedheted bármelyiket.</p>
          </>
        )}
      </section>

      <div className="wbr-ovl"><WorkoutOverloadLine overload={overload} /></div>

      <div className="wbr-eyeb">
        <span className="wbr-eyebrow">A MAI SOR</span>
        <h2>Gyakorlatok</h2>
      </div>
      <ul className="wbr-list">
        {exercises.map((e) => (
          <li key={e.id} className="wbr-row">
            <MuscleChip token={e.muscle} size={28} />
            <span className="wbr-row-copy">
              <strong>{e.name}</strong>
              <small>
                {e.sets} szett{e.goal ? ` · cél ${e.goal}` : ''}
                {e.chip && <span className={`wo-delta is-${e.chip.tone}`}>{e.chip.text}</span>}
              </small>
              {e.why && <em className="wbr-row-why">{e.why}</em>}
            </span>
            {questOn(e.id) && (
              <span className="wbr-row-quest" role="img" aria-label="Van vállalt küldetés">
                <Icon3D name="t-quest" size={28} />
              </span>
            )}
          </li>
        ))}
      </ul>

      {/* The Indulás foot floats over the phone frame like the workout dock (portalled into
          `.phone-screen`): a sticky child of the scroller would sit above its tab-bar padding. */}
      {createPortal(
        <div className="wbr-foot">
          <button type="button" className="wbr-start np-press" onClick={onStart}>
            <Icon3D name="t-play" size={26} />
            {tickedCount > 0 ? `Indulás · ${tickedCount} küldetéssel` : 'Indulás küldetés nélkül'}
          </button>
        </div>,
        document.querySelector('.phone-screen') ?? document.body,
      )}
    </div>
  )
}
