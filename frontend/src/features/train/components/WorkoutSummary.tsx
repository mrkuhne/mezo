// ============================================================
// Mezo · WorkoutSummary — the explicit-finish summary / review screen,
// colorful pill/chip redesign (mezo-w943, spec 2026-08-10; supersedes the
// grey 2026-07-15 layout). One shell, two modes:
//   'closing': pre-finish — hero + halo(fire) + the closing note field + "Edzés lezárása ✓".
//   'closed':  the same shell read-only (post-finish + /train/review), with the saved note.
// The note (mezo-d20.8.2.2) is REAL since F7.2's tail: its value and its writes belong to the
// page (this shell has two callers), so everything here is props.
// All numbers come from logic/summaryStats (pure, table-tested).
// ============================================================
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { Medal } from '@/data/train/medalTypes'
import { muscleColor, regionColor } from '@/features/train/logic/muscleColors'
import { MEDAL_TYPE_LABEL, MEDAL_UNIT_LABEL, formatMedalNumber, medalValueLabel } from '@/features/train/logic/medalLabels'
import { deriveSummaryStats, type SummaryExerciseInput, type SummarySetChip } from '@/features/train/logic/summaryStats'
import type { WorkoutComparison } from '@/features/train/logic/workoutComparison'
import { ExerciseReview } from '@/features/train/components/ExerciseReview'
import { Icon } from '@/shared/ui/Icon'
import { ClaySpot } from '@/shared/ui/clay'
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

const CHALLENGE_COPY: Record<SummaryChallenge['state'], { glyph: string; label: string; cls: string }> = {
  hit: { glyph: '✓', label: 'megcsináltad', cls: 'hit' },
  miss: { glyph: '◯', label: 'nem jött össze', cls: 'miss' },
  skipped: { glyph: '⊘', label: 'skippelted', cls: 'skip' },
  inconclusive: { glyph: '◌', label: 'nem értékelhető', cls: 'skip' },
}

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

  // The tone is the page's own, as in the prototype (`p-coral` closing / `p-sage` closed) —
  // the report had no page tone at all before mezo-d20.8.2.1.
  const tone = mode === 'closing' ? 'mz-p-coral' : 'mz-p-sage'

  if (openEx) {
    return (
      <div className={`wr-root ${tone}`}>
        <ExerciseReview
          exercise={openEx}
          medals={s.records.filter((m) => m.exerciseName === openEx.name)}
          prevTop={prevTopByName[openEx.name] ?? null}
          onBack={() => setOpenExId(null)}
        />
      </div>
    )
  }

  return (
    <div className={`wr-root ${tone}`}>
      <div className="wsum-top">
        <button onClick={onExit}>
          <span className="wsum-xi" aria-hidden="true">{mode === 'closing' ? '✕' : '←'}</span>
          {mode === 'closing' ? 'Bezárás' : 'Vissza'}
        </button>
      </div>

      {/* The report had NO entrance choreography at all — the F9 audit's class A
          (docs/design_2.0/2026-08-29-fidelity-audit-findings.md §A). */}
      <EntranceGroup>
      <div className="wsum-hero rise" style={{ '--d': '0ms' } as CSSProperties}>
        <div className={`wsum-halo ${mode === 'closing' ? 'fire' : 'calm'}`} aria-hidden="true" />
        <div className={`wsum-over${mode === 'closed' ? ' closed' : ''}`}>{eyebrow}</div>
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
            // a narrow phone width (measured wrap at 360px, mezo-1jm8 review fix): the <br/>
            // forces a deliberate, fixed break between "terv" and "tény" instead of letting the
            // browser wrap wherever the text happens to run out of room (which split "71" from
            // "perc" — see fix report). This keeps the exact wording, just not on one line.
            ? <> · terv ~{durationMin}<br />tény <b>{actualMin} perc</b></>
            : actualMin
              ? <> · <b>{actualMin} perc</b></>
              : durationMin ? <> · ~{durationMin} perc</> : null}
        </div>
      </div>

      {s.regions.length > 0 && (
        <div className="wsum-regrow rise" style={{ '--d': '70ms' } as CSSProperties}>
          {s.regions.map((r) => {
            const fam = regionColor(r.region)
            return (
              <span key={r.region} className={`wsum-reg${r.off ? ' off' : ''}`}
                style={r.off ? undefined : { '--fam-wash': fam.wash, '--fam-deep': fam.deep } as CSSProperties}>
                {r.label}{r.off ? null : <span className="n">{r.sets} szett</span>}
              </span>
            )
          })}
        </div>
      )}

      {/* No comparison → no tile. There is deliberately no empty state: a first instance of a
          template day has nothing to be compared against, and saying so would be noise. */}
      {comparison && (
        <div className="wr-cmp rise" style={{ '--d': '110ms' } as CSSProperties}>
          <div className="eyebrow">Mihez képest</div>
          <div className="wr-cmp-ref">
            <b>Előző {title} · {comparison.refDateLabel}</b>
            <span className="ago">{comparison.gapLabel}</span>
          </div>
          <div className="wr-cmp-cells">
            {comparison.cells.map((c) => (
              <div key={c.key} className="wr-cmp-cell">
                <span className={`v${c.tone === 'up' ? ' up' : ''}`}>{c.value}</span>
                <span className="l">{c.label}</span>
                {c.was && <span className="was">{c.was}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="wsum-stripwrap rise" style={{ '--d': '150ms' } as CSSProperties}>
        <div className="mz-statstrip">
          <div className="mz-statcell"><div className="v">{hu(s.volumeT)}<span className="u">t</span></div><div className="l">Volumen</div></div>
          <div className="mz-statcell"><div className={`v${s.records.length ? ' gold' : ''}`}>{s.records.length}</div><div className="l">Rekord</div></div>
          <div className="mz-statcell"><div className={`v${s.targetCount ? ' green' : ''}`}>{s.targetCount}<span className="u">✓</span></div><div className="l">Célszett</div></div>
          <div className="mz-statcell"><div className="v">{s.avgRir == null ? '–' : hu(s.avgRir)}</div><div className="l">Ø RIR</div></div>
        </div>
      </div>

      {medals.length > 0 && (
        <div className="wsum-sec rise" style={{ '--d': '200ms' } as CSSProperties}>
          <div className="wsum-slabel">Medálok <span className="cnt">{s.records.length} rekord · {s.targetCount} cél</span></div>
          {s.records.map((m, i) => (
            <div key={`${m.type}-${m.exerciseName}-${m.date}-${m.setIndex ?? i}`} className="wsum-medal">
              <div className="disc" aria-hidden="true"><ClaySpot name="s-medal" size={26} /></div>
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
            <div className="wsum-targets">
              <div className="tick" aria-hidden="true">✓</div>
              <div style={{ flex: 1 }}>
                <div className="t">{s.targetCount} célszett teljesítve</div>
                <div className="chips">
                  {s.targetGroups.map((g) => <span key={g.exerciseName}>{g.exerciseName} ×{g.count}</span>)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {challenges.length > 0 && (
        <div className="wsum-sec rise" style={{ '--d': '250ms' } as CSSProperties}>
          <div className="wsum-slabel">Kihívások <span className="cnt">{chalHit} megvan · {chalMiss} kimaradt</span></div>
          {challenges.map((c) => {
            const copy = CHALLENGE_COPY[c.state]
            return (
              <div key={c.id} className={`wsum-chal ${copy.cls}`}>
                <div className="st" aria-hidden="true">{copy.glyph}</div>
                <div className="tx">
                  <div className="t">{c.typeLabel}{c.exercise ? ` · ${c.exercise}` : ''}</div>
                  <div className="m">{c.detail ?? c.target}</div>
                </div>
                <div className="out">{copy.label}</div>
              </div>
            )
          })}
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
          {s.exercises.map((e) => {
            const fam = muscleColor(e.muscle)
            const famStyle = { '--fam-rail': fam.rail, '--fam-wash': fam.wash, '--fam-deep': fam.deep } as CSSProperties
            return (
              <button
                key={e.id}
                type="button"
                className={`wr-extile${e.abandoned ? ' dead' : ''}`}
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
                  {e.chips.map((c, i) => (
                    <i key={i} className={c.record ? 'med' : c.warmup ? 'warm' : ''} />
                  ))}
                  {Array.from({ length: e.missing }, (_, i) => <i key={`m${i}`} className="miss" />)}
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
              <button type="button" className="cancel" onClick={onNoteCancel}>Mégse</button>
            </div>
          ) : (
            <p className="wsum-note-hint">Nem kötelező — később is hozzáírhatod.</p>
          )}
        </div>
      ) : null}

      {/* `closed`: the saved sentence, or — only where revisiting is the point — a quiet way to
          add one. No note and no editor means nothing renders (ADR 0010). */}
      {mode === 'closed' && !noteEditing && note ? (
        <div className="wsum-note-r">
          <span className="wsum-note-lbl">Amit aznap írtál</span>
          <p>{note}</p>
          {onEditNote ? (
            <button type="button" className="wsum-note-edit" aria-label="Jegyzet szerkesztése" onClick={onEditNote}>
              <Icon name="pencil" size={12} />
            </button>
          ) : null}
        </div>
      ) : null}
      {mode === 'closed' && !noteEditing && !note && onEditNote ? (
        <button type="button" className="wsum-note-add" onClick={onEditNote}>
          ＋ Jegyzet ehhez az edzéshez
        </button>
      ) : null}

      {footer}
      </EntranceGroup>

      <div className="wsum-ctas">
        {mode === 'closing' ? (
          <>
            <button className="cta-primary" disabled={finishPending} onClick={onFinish}>
              <Icon name="check" size={16} />
              <span>Edzés lezárása ✓</span>
            </button>
            <button type="button" className="cta-ghost" style={{ padding: 12 }} onClick={onBack}>
              ← Vissza az edzéshez
            </button>
          </>
        ) : (
          <button className="cta-ghost" style={{ padding: 12 }} onClick={onExit}>
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
