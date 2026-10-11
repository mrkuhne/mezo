// ============================================================
// Mezo · WorkoutSummary — the workout review's shell („Összegzés"). One shell, two modes:
//   'closed':  the read-only revisit (/train/review/:id), with the saved note.
//   'closing': the pre-finish face (hero + the note field + „Edzés lezárása"). The live finish
//              runs through WorkoutCeremony now; the mode is kept working for a caller that
//              wants the plain report.
// The note (mezo-d20.8.2.2) is real: its value and its writes belong to the page, so everything
// here is props. All numbers come from logic/summaryStats (pure, table-tested).
//
// Folyadék (mezo-n4wf5.4, prototype vilagos/edzes.js `review`), top to bottom:
//   hero — „N szett a M-ből, X tonna összvolumen.", then one tube per exercise (the level is
//     the done share, the dashed line the previous instance's done sets — only with a
//     reference), the region tags, a quiet key. A tube opens its exercise.
//   1 · A számok — volumen · rekord · célszett · Ø RIR; with a previous instance the three
//     comparison rows under them (the level is today, the line the value then).
//   2 · Medálok — the records as capsules and ONE row for the target sets.
//   3 · Küldetések — every quest of the day with its outcome pill.
//   4 · Gyakorlatonként — a row per exercise: top set, set capsules, the record tag.
//   5 · Amit aznap írtál — the note: read, edited in place, or the way to add one.
//   the page-owned tail (stepping to the previous / next instance).
// ============================================================
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Medal } from '@/data/train/medalTypes'
import { MUSCLE_LABELS } from '@/data/train/train'
import { deriveSummaryStats, type SummaryExerciseInput, type SummarySetChip, type SummaryStats } from '@/features/train/logic/summaryStats'
import type { ComparisonCell, WorkoutComparison } from '@/features/train/logic/workoutComparison'
import { prevDoneByName, prevDoneLine, type QuestRow } from '@/features/train/logic/workoutReviewDerive'
import { ExerciseReview, ReviewMedalRow } from '@/features/train/components/ExerciseReview'
import { Mchp, Rcap, deepMuscle } from '@/features/train/components/folyadek'
import type { Icon3DName } from '@/shared/ui/clay'
import {
  Acts, Btn, Caps, Card, Facts, FrameBack, Hero, HeroGraphic, Lab, LevelMarks, Lk, Note, Page, Row, RowEnd, Section, St, Tags,
  TextArea, Tubes, Txt, useFrameTitle, type VialItem,
} from '@/shared/ui/folyadek'
import { screenScroller, scrollToTop } from '@/shared/lib/screenScroll'
import { VoiceField } from '@/shared/ui/voice/VoiceField'
import { appendDictation } from '@/shared/lib/voice/useVoiceInput'

export type SummaryExercise = SummaryExerciseInput
/** A quest of the day with its outcome — `questRows(challenges).rows` (logic/workoutReviewDerive). */
export type SummaryChallenge = QuestRow

const hu = (n: number, digits = 1) => n.toLocaleString('hu-HU', { maximumFractionDigits: digits })
/** „Hát (széles)" → „Hát széles": the caption under a tube has no room for brackets. */
const shortMuscle = (muscle: string) => (MUSCLE_LABELS[muscle] ?? muscle).replace(/\s*\((.+)\)/, ' $1')
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const CMP_ICON: Record<ComparisonCell['key'], Icon3DName> = { volume: 't-weight', target: 't-tick', rir: 't-hold' }

export function WorkoutSummary({
  title, eyebrow, mode, exercises, challenges, medals = [], durationMin = null, actualMin = null,
  comparison = null, reference = null, prevTopByName = {}, footer = null,
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
  /** The previous instance's stats (same gate as `comparison`): the dashed line on the hero's
   *  tubes and the line in the comparison levels. Null → no line anywhere. */
  reference?: SummaryStats | null
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
  // The exercise view replaces the report body rather than pushing a route (ExerciseReview):
  // a local view with a stateful back, and the scroller reset the swap would otherwise skip.
  const [openExId, setOpenExId] = useState<string | null>(null)
  const s = deriveSummaryStats(exercises, medals)
  const openEx = openExId == null ? null : s.exercises.find((e) => e.id === openExId) ?? null
  const openName = openEx?.name ?? null
  useEffect(() => { scrollToTop(screenScroller()) }, [openName])
  useFrameTitle(openEx
    ? { title: openEx.name, eyebrow: `Összegzés · ${MUSCLE_LABELS[openEx.muscle] ?? openEx.muscle} · ${title}` }
    : { title: 'Összegzés', eyebrow: `${eyebrow} · ${title}` })

  if (openEx) {
    return (
      <ExerciseReview
        exercise={openEx}
        medals={s.records.filter((m) => m.exerciseName === openEx.name)}
        prevTop={prevTopByName[openEx.name] ?? null}
        onBack={() => setOpenExId(null)}
      />
    )
  }

  const closed = mode === 'closed'
  const chalHit = challenges.filter((c) => c.state === 'hit').length
  // The dashed line needs a reference: no previous instance → no line, on any tube.
  const prevDone = reference ? prevDoneByName(reference.exercises) : {}
  const setsWord = (e: { abandoned: boolean; doneSets: number; plannedSets: number }) =>
    (e.abandoned ? 'kihagyva' : `${e.doneSets} / ${e.plannedSets} szett`)

  const tubes: VialItem[] = s.exercises.map((e) => {
    const share = e.plannedSets > 0 ? Math.min(1, e.doneSets / e.plannedSets) : e.doneSets > 0 ? 1 : 0
    const line = reference ? prevDoneLine(prevDone[e.name], e.plannedSets) : null
    return {
      node: <Mchp muscle={e.muscle} size={28} />,
      label: shortMuscle(e.muscle),
      value: `${e.doneSets}/${e.plannedSets}`,
      note: e.abandoned ? 'kihagyva' : e.missing > 0 ? `−${e.missing} szett` : 'megvan',
      pct: share * 92,
      wl: line == null ? undefined : line * 92,
      ghost: e.abandoned,
      color: deepMuscle(e.muscle),
      onClick: () => setOpenExId(e.id),
      ariaLabel: `${e.name} szettjei — ${setsWord(e)}`,
    }
  })

  // The level is today, the line the value then; only an improvement takes the domain's colour.
  const bar = (c: ComparisonCell): ReactNode => {
    if (!reference || c.key === 'rir') return null
    const [now, then] = c.key === 'volume' ? [s.volumeT, reference.volumeT] : [s.targetCount, reference.targetCount]
    const top = Math.max(now, then)
    if (!(top > 0)) return null
    return <span className="fo-rowbar"><LevelMarks pct={(now / top) * 92} color="var(--eo-liq)" height={12} marks={[{ at: (then / top) * 92 }]} /></span>
  }

  const duration = durationMin && actualMin
    // A non-breaking space keeps the number with its unit on a narrow phone (mezo-dzbm).
    ? <> · terv ~{durationMin}, tény {actualMin}&nbsp;perc</>
    : actualMin ? <> · {actualMin}&nbsp;perc</>
      : durationMin ? <> · ~{durationMin}&nbsp;perc</> : null

  const noteField = onDraftNote && (mode === 'closing' || noteEditing)
  let n = 0

  return (
    <Page className="eo-page">
      <FrameBack className="fo-backpill" onBack={onExit} label={closed ? 'Vissza' : 'Bezárás'}>{closed ? 'Vissza' : 'Bezárás'}</FrameBack>

      <Hero
        className="eo-hero"
        label={closed ? `Kész · ${title}` : `${eyebrow} · ${title}`}
        verdict={(
          <span className="eo-num" aria-label={`${s.doneSets} / ${s.plannedSets} szett, ${hu(s.volumeT)} tonna összvolumen`}>
            <span aria-hidden="true">{s.doneSets} szett a {s.plannedSets}-ból, {hu(s.volumeT)} tonna összvolumen.</span>
          </span>
        )}
        sub={<>{s.doneEx}/{s.totalEx} gyakorlat{duration}</>}
        actions={closed ? undefined : (
          <>
            <Btn grow icon="t-tick" disabled={finishPending} onClick={onFinish}>Edzés lezárása</Btn>
            <Btn ghost onClick={onBack}>Vissza az edzéshez</Btn>
          </>
        )}
      >
        {tubes.length > 0 && (
          <HeroGraphic>
            <Tubes items={tubes} height={104} size="sm" gap={6} className="eo-extubes" aria-label="Gyakorlatonként a mai szettek" />
          </HeroGraphic>
        )}
        {s.regions.length > 0 && (
          <Tags className="eo-regs" items={s.regions.map((r) => (r.off ? { label: <s>{r.label}</s> } : `${r.label} · ${r.sets} szett`))} />
        )}
        <Note>
          Gyakorlatonként a mai szettek.{comparison && reference ? ` A szaggatott vonal az előző alkalom (${comparison.refDateLabel}).` : ''} Koppints egy edényre a szettjeiért.
        </Note>
      </Hero>

      <Section n={++n} title={comparison ? 'A számok · az előzőhöz mérve' : 'A számok'} />
      <Card className="eo-nums">
        <Facts items={[
          [`${hu(s.volumeT)} t`, 'volumen'],
          [String(s.records.length), 'rekord'],
          [String(s.targetCount), 'célszett'],
          [s.avgRir == null ? '–' : hu(s.avgRir), 'Ø RIR'],
        ]} />
        {/* No comparison → no rows. There is deliberately no empty state: a first instance of a
            template day has nothing to be compared against, and saying so would be noise. */}
        {comparison && (
          <>
            {comparison.cells.map((c) => (
              <Row
                key={c.key}
                className={`eo-cmp${c.tone === 'up' ? ' up' : ''}`}
                data-cell={c.key}
                icon={CMP_ICON[c.key]}
                title={capital(c.label)}
                sub={<>{c.was}{c.key === 'rir' ? `${c.was ? ' · ' : ''}itt a kevesebb a nehezebb` : null}{bar(c)}</>}
                value={c.value}
              />
            ))}
            <Note className="eo-cmp-ref">
              Mihez képest: az előző {title}, {comparison.refDateLabel} ({comparison.gapLabel}). A vonal az akkori érték, a folyadék a mai. A szám mindig őszinte; színt csak az kap, ami előrelépés.
            </Note>
          </>
        )}
      </Card>

      {medals.length > 0 && (
        <>
          <Section n={++n} title={`Medálok · ${s.records.length} rekord · ${s.targetCount} célszett`} />
          <Card className="eo-medals">
            {s.records.map((m, i) => <ReviewMedalRow key={`${m.type}-${m.exerciseName}-${m.date}-${m.setIndex ?? i}`} medal={m} />)}
            {s.targetCount > 0 && (
              <Row
                className="eo-targets"
                left={<Rcap color="var(--fo-ok)" />}
                title={`${s.targetCount} célszett teljesítve`}
                sub={s.targetGroups.map((g) => `${g.exerciseName} ×${g.count}`).join(' · ')}
              />
            )}
            {s.records.length > 0 && <Note>A vonal a kapszulán a régi rekord: a folyadék fölötte áll.</Note>}
          </Card>
        </>
      )}

      {challenges.length > 0 && (
        <>
          <Section n={++n} title={`Küldetések · ${chalHit} megvan · ${challenges.length - chalHit} kimaradt`} />
          <Card className="eo-quests">
            {challenges.map((c) => (
              <Row
                key={c.id}
                className="eo-quest"
                data-state={c.state}
                state={c.tone === 'ok' ? undefined : 'dim'}
                icon={c.state === 'hit' ? 't-tick' : 't-skip'}
                title={`${c.typeLabel}${c.exercise ? ` · ${c.exercise}` : ''}`}
                sub={c.detail}
                right={<St tone={c.tone}>{c.label}</St>}
              />
            ))}
          </Card>
        </>
      )}

      <Section n={++n} title="Gyakorlatonként" />
      <Card className="eo-exlist">
        {s.exercises.map((e) => (
          <Row
            key={e.id}
            className="eo-exrow"
            state={e.abandoned ? 'dim' : undefined}
            left={<Mchp muscle={e.muscle} sm />}
            title={e.name}
            sub={e.abandoned
              ? 'kihagyva · nincs szett'
              : <>top szett <b className="eo-best">{e.topChip ? `${hu(e.topChip.weight)} × ${e.topChip.reps}` : '—'}</b>{e.noteCount > 0 && ` · ${e.noteCount} jegyzet`}</>}
            right={(
              <RowEnd stack>
                {e.hasRecord && <St tone="warn">Rekord</St>}
                <Caps n={Math.max(e.plannedSets, e.doneSets)} done={e.doneSets} color={deepMuscle(e.muscle)} />
              </RowEnd>
            )}
            chev
            aria-label={`${e.name} — ${setsWord(e)}`}
            onClick={() => setOpenExId(e.id)}
          />
        ))}
        <Note>Az összegzés sosem büntet: a kimaradt szett üres kapszula, a kihagyott küldetés halk — piros nincs.</Note>
      </Card>

      {/* The field: the closing face's capture point, and the review's editor IN PLACE. Both bind
          the same page-owned draft. `closed` without a note and without an editor renders
          nothing at all (ADR 0010). */}
      {(noteField || (closed && (note || onEditNote))) && (
        <>
          <Section n={++n} title={closed ? 'Amit aznap írtál' : 'Hogy ment?'} />
          <Card className="eo-note">
            {noteField ? (
              <>
                <Lab htmlFor="eo-note-field">Hogy ment?</Lab>
                <VoiceField domain="train" onTranscript={(t) => onDraftNote(appendDictation(draftNote, t, 1000))}>
                  <TextArea
                    id="eo-note-field"
                    rows={4}
                    maxLength={1000}
                    value={draftNote}
                    placeholder="Pl. rosszul aludtam, de a húzódzkodás jól ment…"
                    onChange={(e) => onDraftNote(e.target.value)}
                  />
                </VoiceField>
                {noteEditing
                  ? <Acts><Btn sm onClick={onNoteSave}>Mentés</Btn><Lk onClick={onNoteCancel}>Mégse</Lk></Acts>
                  : <Note>Nem kötelező — később is hozzáírhatod.</Note>}
              </>
            ) : note ? (
              <>
                <Txt className="eo-note-read">{note}</Txt>
                {onEditNote && <Acts><Lk onClick={onEditNote}>Szerkesztés</Lk></Acts>}
              </>
            ) : (
              <Acts><Lk onClick={onEditNote}>+ Jegyzet ehhez az edzéshez</Lk></Acts>
            )}
          </Card>
        </>
      )}

      {footer}
    </Page>
  )
}
