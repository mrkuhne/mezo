// ============================================================
// Mezo · WorkoutSummary — the explicit-finish summary / review screen,
// colorful pill/chip redesign (mezo-w943, spec 2026-08-10; supersedes the
// grey 2026-07-15 layout). One shell, two modes:
//   'closing': pre-finish — hero + halo + the closing note field + "Edzés lezárása".
//   'closed':  the same shell read-only (post-finish + /train/review), with the saved note.
// The note (mezo-d20.8.2.2) is REAL since F7.2's tail: its value and its writes belong to the
// page (this shell has two callers), so everything here is props.
// All numbers come from logic/summaryStats (pure, table-tested).
// ============================================================
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { Medal } from '@/data/train/medalTypes'
import { muscleColor, muscleRegion, regionColor } from '@/features/train/logic/muscleColors'
import { MEDAL_TYPE_LABEL, MEDAL_UNIT_LABEL, formatMedalNumber, medalValueLabel } from '@/features/train/logic/medalLabels'
import { deriveSummaryStats, type SummaryExerciseInput, type SummarySetChip } from '@/features/train/logic/summaryStats'
import type { WorkoutComparison } from '@/features/train/logic/workoutComparison'
import { ExerciseReview } from '@/features/train/components/ExerciseReview'
import { MuscleChip } from '@/features/train/components/MuscleChip'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { PageHead } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

export type SummaryExercise = SummaryExerciseInput

export interface SummaryChallenge {
  id: string
  typeLabel: string
  exercise?: string
  target: string
  state: 'hit' | 'miss' | 'skipped' | 'inconclusive'
  detail?: string
}

/** Outcome → 3D mark (null = a quiet flat dot) + the visible label that carries the meaning. */
const CHALLENGE_COPY: Record<SummaryChallenge['state'], { icon: Icon3DName | null; label: string; cls: string }> = {
  hit: { icon: 't-tick', label: 'megcsináltad', cls: 'hit' },
  miss: { icon: 't-skip', label: 'nem jött össze', cls: 'miss' },
  skipped: { icon: null, label: 'skippelted', cls: 'skip' },
  inconclusive: { icon: null, label: 'nem értékelhető', cls: 'skip' },
}

/** The wire label may carry an emoji ('⚡ Túlterhelés') — the surface stays emoji-free. */
const cleanLabel = (label: string) => label.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').trim()

const hu = (n: number, digits = 1) => n.toLocaleString('hu-HU', { maximumFractionDigits: digits })

export function WorkoutSummary({
  title, eyebrow, mode, exercises, challenges, medals = [], durationMin = null, actualMin = null,
  comparison = null, prevTopByName = {}, footer = null,
  note = null, draftNote = '', onDraftNote, onEditNote, noteEditing = false, onNoteSave, onNoteCancel,
  onFinish, finishPending = false, onBack, onExit,
}: {
  title: string
  eyebrow: string
  mode: 'closing' | 'closed'
  exercises: SummaryExercise[]
  challenges: SummaryChallenge[]
  medals?: Medal[]
  durationMin?: number | null
  /** The MEASURED counterpart (mezo-1jm8) — actualMinutes(...) of the session's real timing.
   *  Null in real mode until a session finishes with a usable measurement, and always null on
   *  the closing phase (no measurement exists yet). See logic/actualDuration. */
  actualMin?: number | null
  /** The "Mihez képest" tile's content. Null in closing mode and whenever there is no previous
   *  instance of this template day — the tile then does not render AT ALL, rather than showing
   *  an empty-state placeholder for something that legitimately does not exist. */
  comparison?: WorkoutComparison | null
  /** Reference top set per exercise NAME, for the exercise view's `Előzőleg` cell. */
  prevTopByName?: Record<string, SummarySetChip>
  /** Page-owned tail (the template-day stepping) — the shell knows nothing about routes. */
  footer?: ReactNode
  /** The saved closing note (mezo-d20.8.2.2). `closed` renders it, absent → nothing rendered. */
  note?: string | null
  /** `closing` only: the in-progress note text, owned by the page so it survives a phase flip. */
  draftNote?: string
  onDraftNote?: (value: string) => void
  /**
   * `closed` only: opens the note for editing. Passed by the REVIEW page, where filling a gap
   * is a meaningful intent — so an absent note offers `＋ Jegyzet` there. The just-finished
   * summary passes nothing: you wrote it a second ago, there is nothing to revisit.
   */
  onEditNote?: () => void
  /** `closed` only: the note is open for editing — the field replaces the read block. */
  noteEditing?: boolean
  onNoteSave?: () => void
  onNoteCancel?: () => void
  onFinish?: () => void
  finishPending?: boolean
  onBack?: () => void
  onExit: () => void
}) {
  // The exercise view replaces the report body rather than pushing a route: the closing report
  // lives inside ActiveWorkoutPage's phase machine and has no route of its own (ExerciseReview).
  const [openExId, setOpenExId] = useState<string | null>(null)
  const s = deriveSummaryStats(exercises, medals)
  const openEx = openExId == null ? null : s.exercises.find((e) => e.id === openExId) ?? null
  const chalHit = challenges.filter((c) => c.state === 'hit').length
  const chalMiss = challenges.filter((c) => c.state !== 'hit').length

  if (openEx) {
    return (
      <div className="wr-root uv-rev">
        <ExerciseReview
          exercise={openEx}
          medals={s.records.filter((m) => m.exerciseName === openEx.name)}
          prevTop={prevTopByName[openEx.name] ?? null}
          onBack={() => setOpenExId(null)}
        />
      </div>
    )
  }

  // Üveg re-dress (mezo-me75u.4, prototype uveg-edzes.html#review): a frameless halo hero,
  // flat chips/cells, glass for the primary objects (comparison, medals, targets, challenges,
  // exercise tiles, the note) — one accent each, never glass in glass. `.uv-rev` scopes it.
  return (
    <div className="wr-root uv-rev">
      <PageHead glass label={mode === 'closing' ? 'Bezárás' : 'Vissza'} onBack={onExit} />

      {/* The report had NO entrance choreography at all — the F9 audit's class A
          (docs/design_2.0/2026-08-29-fidelity-audit-findings.md §A). */}
      <EntranceGroup>
      <section className="wsum-hero uv-halo rise" style={{ '--d': '0ms' } as CSSProperties}>
        <div className={`wsum-over uv-eyebrow${mode === 'closed' ? ' closed' : ''}`}>{eyebrow}</div>
        <h2>{title}</h2>
        <div className="wsum-num" aria-label={`${s.doneSets} / ${s.plannedSets} szett`}>
          <span aria-hidden="true">
            {s.doneSets}<span className="of">/{s.plannedSets}</span><span className="unit">szett</span>
          </span>
        </div>
        <div className="wsum-sub">
          <b>{hu(s.volumeT)} t</b> összvolumen · <b>{s.doneEx}/{s.totalEx}</b> gyakorlat
          {durationMin && actualMin
            // The combined string is materially longer than either half alone and can overflow
            // a narrow phone width (measured wrap at 360px, mezo-1jm8 review fix). A hard <br/>
            // used to force a fixed break between "terv" and "tény" on every width, including
            // ones where the text fits on one line; a non-breaking space between the number and
            // its unit (mezo-dzbm) prevents only the mid-word wrap that caused the overflow
            // (which split "71" from "perc" — see fix report), letting the browser wrap normally.
            ? <> · terv ~{durationMin} tény <b>{actualMin}&nbsp;perc</b></>
            : actualMin
              ? <> · <b>{actualMin} perc</b></>
              : durationMin ? <> · ~{durationMin} perc</> : null}
        </div>
      </section>

      {s.regions.length > 0 && (
        <div className="wsum-regrow rise" style={{ '--d': '70ms' } as CSSProperties}>
          {s.regions.map((r) => {
            // The region's art is the real anatomy of the first exercise that trained it.
            const token = r.off ? null : s.exercises.find((e) => muscleRegion(e.muscle) === r.region)?.muscle ?? null
            return (
              <span key={r.region} className={`wsum-reg uv-flat${r.off ? ' off' : ''}`}
                style={{ '--c': regionColor(r.region).rail } as CSSProperties}>
                {token && <span className="wr-mchp sm" aria-hidden="true"><MuscleChip token={token} size={28} /></span>}
                {r.label}{r.off ? null : <span className="n"> · {r.sets} szett</span>}
              </span>
            )
          })}
        </div>
      )}

      {/* No comparison → no tile. There is deliberately no empty state: a first instance of a
          template day has nothing to be compared against, and saying so would be noise. */}
      {comparison && (
        <article className="wr-cmp glass rise" style={{ '--d': '110ms' } as CSSProperties}>
          <div className="wr-cmp-head">
            <span className="uv-eyebrow">Mihez képest</span>
            <span className="wr-cmp-ref">
              <b>Előző {title} · {comparison.refDateLabel}</b>
              <span className="ago">{comparison.gapLabel}</span>
            </span>
          </div>
          <div className="wr-cmp-cells">
            {comparison.cells.map((c) => (
              <div key={c.key} className="wr-cmp-cell uv-flat">
                <span className="l">{c.label}</span>
                <span className={`v${c.tone === 'up' ? ' up' : ''}`}>{c.value}</span>
                {c.was && <span className="was">{c.was}</span>}
              </div>
            ))}
          </div>
        </article>
      )}

      <div className="wsum-stripwrap rise" style={{ '--d': '150ms' } as CSSProperties}>
        <div className="mz-statstrip">
          <div className="mz-statcell uv-flat"><div className="v">{hu(s.volumeT)}<span className="u">t</span></div><div className="l">Volumen</div></div>
          <div className={`mz-statcell uv-flat${s.records.length ? ' is-gold' : ''}`}><div className={`v${s.records.length ? ' gold' : ''}`}>{s.records.length}</div><div className="l">Rekord</div></div>
          <div className={`mz-statcell uv-flat${s.targetCount ? ' is-ok' : ''}`}><div className={`v${s.targetCount ? ' green' : ''}`}>{s.targetCount}</div><div className="l">Célszett</div></div>
          <div className="mz-statcell uv-flat"><div className="v">{s.avgRir == null ? '–' : hu(s.avgRir)}</div><div className="l">Ø RIR</div></div>
        </div>
      </div>

      {medals.length > 0 && (
        <div className="wsum-sec rise" style={{ '--d': '200ms' } as CSSProperties}>
          <div className="wsum-slabel">Medálok <span className="cnt">{s.records.length} rekord · {s.targetCount} cél</span></div>
          {s.records.map((m, i) => (
            <div key={`${m.type}-${m.exerciseName}-${m.date}-${m.setIndex ?? i}`} className="wsum-medal glass">
              <span className="uv-well" aria-hidden="true"><Icon3D name="t-record" size={34} /></span>
              <div className="tx">
                <div className="t">{MEDAL_TYPE_LABEL[m.type] ?? m.type}</div>
                <div className="m">{m.exerciseName}{m.type === 'E1RM' && m.weightKg != null && m.reps != null ? ` · ${formatMedalNumber(m.weightKg)} × ${m.reps}-ből becsülve` : ''}</div>
              </div>
              <div className="val">
                <div className="now">{medalValueLabel(m)}</div>
                {m.previousValue != null && (
                  <div className="prev">előző: {formatMedalNumber(m.previousValue)} {MEDAL_UNIT_LABEL[m.unit] ?? ''}</div>
                )}
              </div>
            </div>
          ))}
          {s.targetCount > 0 && (
            <div className="wsum-targets glass">
              <div className="wsum-targets-head">
                <Icon3D name="t-tick" size={30} />
                <div className="t">{s.targetCount} célszett teljesítve</div>
              </div>
              <div className="chips">
                {s.targetGroups.map((g) => <span key={g.exerciseName} className="uv-flat">{g.exerciseName} ×{g.count}</span>)}
              </div>
            </div>
          )}
        </div>
      )}

      {challenges.length > 0 && (
        <div className="wsum-sec rise" style={{ '--d': '250ms' } as CSSProperties}>
          <div className="wsum-slabel">Kihívások <span className="cnt">{chalHit} megvan · {chalMiss} kimaradt</span></div>
          <div className="wsum-chals glass">
            {challenges.map((c) => {
              const copy = CHALLENGE_COPY[c.state]
              return (
                <div key={c.id} className={`wsum-chal ${copy.cls}`}>
                  {/* The mark is decoration: the visible outcome label carries the meaning. */}
                  <span className="st" aria-hidden="true">
                    {copy.icon ? <Icon3D name={copy.icon} size={30} /> : <i className="dot" />}
                  </span>
                  <div className="tx">
                    <div className="t">{cleanLabel(c.typeLabel)}{c.exercise ? ` · ${c.exercise}` : ''}</div>
                    <div className="m">{c.detail ?? c.target}</div>
                  </div>
                  <div className="out">{copy.label}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* The inventory runs sideways, and the depth is on the exercise's own view — five
          near-identical stacked cards made the individual SET unreadable (spec §1 finding 2). */}
      <div className="wsum-sec rise" style={{ '--d': '300ms' } as CSSProperties}>
        <div className="wr-lane-head">
          <span className="wsum-slabel">Gyakorlatonként</span>
          <span className="hint">koppints egy csempére ›</span>
        </div>
        <div className="wr-lane">
          {s.exercises.map((e, i) => {
            const fam = muscleColor(e.muscle)
            const famStyle = { '--c': fam.rail, '--fam-rail': fam.rail, '--i': i } as CSSProperties
            return (
              <button
                key={e.id}
                type="button"
                className={`wr-extile glass${e.abandoned ? ' dead' : ''}`}
                style={famStyle}
                aria-label={`${e.name} — ${e.abandoned ? 'kihagyva' : `${e.doneSets} / ${e.plannedSets} szett`}`}
                onClick={() => setOpenExId(e.id)}
              >
                <span className="hd">
                  <span className="mono" aria-hidden="true">{e.name.charAt(0)}</span>
                  {e.hasRecord && <span className="stamp">REKORD</span>}
                </span>
                <span className="nm">{e.name}</span>
                <span className="lbl">{e.abandoned ? 'kihagyva' : 'top szett'}</span>
                <span className="top">
                  {e.topChip ? <>{hu(e.topChip.weight)} <span className="x">×</span> {e.topChip.reps}</> : '—'}
                </span>
                {/* solid = logged · gold = medal · faint = warmup · dashed = missed */}
                <span className="wr-setbars" aria-hidden="true">
                  {e.chips.map((c, j) => (
                    <i key={j} className={c.record ? 'med' : c.warmup ? 'warm' : ''} />
                  ))}
                  {Array.from({ length: e.missing }, (_, j) => <i key={`m${j}`} className="miss" />)}
                </span>
                <span className="foot">
                  {e.abandoned ? 'nincs szett' : `${e.doneSets}/${e.plannedSets} szett`}
                  {e.noteCount > 0 && <span className="ncnt">· {e.noteCount} jegyzet</span>}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* The field: the closing screen's capture point, and the review page's editor. Both bind
          the same page-owned draft, so neither the shell nor a phase flip owns the text. */}
      {onDraftNote && (mode === 'closing' || noteEditing) ? (
        <div className="wsum-note">
          <span className="wsum-note-q">Hogy ment?</span>
          <textarea
            className="wsum-note-ta"
            maxLength={1000}
            value={draftNote}
            aria-label="Hogy ment?"
            placeholder="Pl. rosszul aludtam, de a húzódzkodás jól ment…"
            onChange={(e) => onDraftNote(e.target.value)}
          />
          {noteEditing ? (
            <div className="wsum-note-ed">
              <button type="button" className="save" onClick={onNoteSave}>Mentés</button>
              <button type="button" className="cancel uv-flat" onClick={onNoteCancel}>Mégse</button>
            </div>
          ) : (
            <p className="wsum-note-hint">Nem kötelező — később is hozzáírhatod.</p>
          )}
        </div>
      ) : null}

      {/* `closed`: the saved sentence, or — only where revisiting is the point — a quiet way to
          add one. No note and no editor means nothing renders (ADR 0010). */}
      {mode === 'closed' && !noteEditing && note ? (
        <article className="wsum-note-r glass">
          <div className="wsum-note-head">
            <span className="wsum-note-lbl uv-eyebrow">Amit aznap írtál</span>
            {onEditNote ? (
              <button type="button" className="wsum-note-edit uv-flat" aria-label="Jegyzet szerkesztése" onClick={onEditNote}>
                <Icon3D name="t-note" size={20} />
              </button>
            ) : null}
          </div>
          <p className="uv-voice">{note}</p>
        </article>
      ) : null}
      {mode === 'closed' && !noteEditing && !note && onEditNote ? (
        <button type="button" className="wsum-note-add uv-empty" onClick={onEditNote}>
          ＋ Jegyzet ehhez az edzéshez
        </button>
      ) : null}

      {footer}
      </EntranceGroup>

      <div className="wsum-ctas">
        {mode === 'closing' ? (
          <>
            <button className="wsum-finish glass" disabled={finishPending} onClick={onFinish}>
              <Icon3D name="t-tick" size={36} />
              <span>Edzés lezárása</span>
            </button>
            <button type="button" className="wsum-ghost uv-flat" onClick={onBack}>
              ← Vissza az edzéshez
            </button>
          </>
        ) : (
          <button className="wsum-ghost uv-flat" onClick={onExit}>
            ← Vissza
          </button>
        )}
      </div>

      {/* Quiet principle line (mezo-d20.3.9, prototype .habnote) — the closing report's
          honesty contract, said once at the bottom instead of colour-coding the misses. */}
      <p className="wsum-principle">
        A riport sosem büntet: a kimaradt szett szellem-chip, a kihagyott kihívás tompított — piros nincs.
      </p>
    </div>
  )
}
