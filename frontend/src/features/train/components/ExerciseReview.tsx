// ============================================================
// Mezo · ExerciseReview — one exercise's own view inside the workout review
// (mezo-d20.8.2.1, spec 2026-08-31 §3.3). A tube of the hero or a row of „Gyakorlatonként"
// opens it; it is where the set finally gets room to be read.
//
// Deliberately a LOCAL view of WorkoutSummary rather than a route (one mechanism for one
// screen); the back handler is stateful (bible F1.4): it closes this view, it never pops history.
//
// Folyadék (mezo-n4wf5.4, prototype vilagos/edzes.js `reviewEx`), top to bottom:
//   hero — the top set as one sentence against the previous instance's top set (only with a
//     reference), then one tube per set: the level is the reps, the dashed line the goal (the
//     low end of the rep range), the mark the set's verdict; a missed set is an empty tube.
//   1 · A számok — top szett · kg volumen · Ø RIR, and „előzőleg" only with a reference.
//   2 · Medál — this exercise's records as capsules (only when it has one).
//   3 · Szettek — a row per set: load, RIR, its number and band word, the set's note, its volume;
//     a warm-up is a quiet row, a missed set a dim one.
// ============================================================
import { MEDAL_TYPE_LABEL, MEDAL_UNIT_LABEL, formatMedalNumber, medalPreviousShare, medalValueLabel } from '@/features/train/logic/medalLabels'
import type { SummaryExerciseView, SummarySetChip } from '@/features/train/logic/summaryStats'
import { setBand } from '@/features/train/logic/workoutReviewDerive'
import type { Medal } from '@/data/train/medalTypes'
import { Mchp, Rcap, VERDICT_ICON, VERDICT_WORD, deepMuscle, type SetVerdict } from '@/features/train/components/folyadek'
import {
  Card, Facts, FrameBack, Hero, HeroGraphic, Note, Page, Row, Section, Tubes, type VialItem,
} from '@/shared/ui/folyadek'

const hu = (n: number, digits = 1) => n.toLocaleString('hu-HU', { maximumFractionDigits: digits })
const setLabel = (c: { weight: number; reps: number }) => `${hu(c.weight)} × ${c.reps}`

/** A record's row (prototype `medRows`): the capsule with the old record's line, the exercise,
 *  the kind + what it beat, the new value. Shared with the review's own Medálok card. */
export function ReviewMedalRow({ medal }: { medal: Medal }) {
  const estimate = medal.type === 'E1RM' && medal.weightKg != null && medal.reps != null
    ? ` · ${formatMedalNumber(medal.weightKg)} × ${medal.reps}-ből becsülve` : ''
  const previous = medal.previousValue != null
    ? ` · előző: ${formatMedalNumber(medal.previousValue)} ${MEDAL_UNIT_LABEL[medal.unit] ?? ''}`.trimEnd() : ''
  return (
    <Row
      className="eo-medal"
      left={<Rcap prev={medalPreviousShare(medal)} />}
      title={medal.exerciseName}
      sub={`${MEDAL_TYPE_LABEL[medal.type] ?? medal.type}${previous}${estimate}`}
      value={medalValueLabel(medal)}
    />
  )
}

/** The hero's sentence: today's top set against the reference's (prototype `cmp`). */
function topSentence(top: SummarySetChip | null, prev: SummarySetChip | null): string {
  if (!top) return 'Kihagyva — nincs naplózott szett.'
  const now = setLabel(top)
  if (!prev) return `${now} volt a legnehezebb szetted.`
  if (top.weight > prev.weight) return `${now} — ${hu(top.weight - prev.weight)} kg-mal több, mint legutóbb.`
  if (top.weight < prev.weight) return `${now} — ${hu(prev.weight - top.weight)} kg-mal könnyebb, mint legutóbb.`
  if (top.reps > prev.reps) return `${now} — ${top.reps - prev.reps} ismétléssel több, mint legutóbb.`
  if (top.reps < prev.reps) return `${now} — ${prev.reps - top.reps} ismétléssel kevesebb, mint legutóbb.`
  return `${now} — ugyanaz a top szett, mint legutóbb.`
}

interface SetLine { chip: SummarySetChip; index: string; verdict: SetVerdict | null; word: string | null }

export function ExerciseReview({
  exercise, medals, prevTop, onBack,
}: {
  exercise: SummaryExerciseView
  /** This workout's RECORD medals, already filtered to this exercise by the caller. */
  medals: Medal[]
  /** The reference session's top set for the same exercise — absent whenever there is no
   *  reference, exactly like the comparison (spec §3.3). */
  prevTop: SummarySetChip | null
  onBack: () => void
}) {
  const e = exercise
  const color = deepMuscle(e.muscle)
  const range = { repMin: e.repMin, repMax: e.repMax }
  // Working sets are numbered 1..n on their own; a warm-up carries `B` instead, so the third
  // working set never reads as "4" just because a warm-up preceded it.
  let working = 0
  const lines: SetLine[] = e.chips.map((chip) => {
    if (!chip.warmup) working += 1
    const band = setBand(range, chip)
    const verdict: SetVerdict | null = chip.warmup ? null
      : chip.record ? 'record'
      : band == null ? null
      : band.key === 'in' ? 'tick' : band.key === 'below' ? 'down' : 'up'
    return { chip, index: chip.warmup ? 'B' : String(working), verdict, word: chip.record ? VERDICT_WORD.record : band?.word ?? null }
  })
  // Ghost slots continue the WORKING numbering, not the raw set count.
  const ghosts = Array.from({ length: e.missing }, (_, i) => working + i + 1)

  const goal = e.repMin ?? null
  const top = Math.max(e.repMax ?? 0, goal ?? 0, ...e.chips.map((c) => c.reps), 1)
  const line = goal != null ? (goal / top) * 94 : undefined
  const tubes: VialItem[] = [
    ...lines.map(({ chip, index, verdict, word }): VialItem => ({
      label: chip.warmup ? 'bemelegítő' : `${index}. szett`,
      value: setLabel(chip),
      note: chip.warmup ? null : [chip.rir != null ? `RIR ${chip.rir}` : null, word].filter(Boolean).join(' · '),
      pct: (chip.reps / top) * 94,
      wl: chip.warmup ? undefined : line,
      color: chip.warmup ? 'var(--fo-faint)' : verdict === 'down' ? 'var(--fo-warn)' : verdict === 'record' ? 'var(--fo-gold)' : color,
      icon: verdict ? VERDICT_ICON[verdict] : undefined,
    })),
    ...ghosts.map((n): VialItem => ({ label: `${n}. szett`, value: '—', note: 'kimaradt', pct: 0, wl: line, ghost: true, color })),
  ]
  const tubeWords = [
    ...lines.map(({ chip, index, word }) => `${chip.warmup ? 'bemelegítő' : `${index}. szett`} ${setLabel(chip)}${word && !chip.warmup ? `, ${word}` : ''}`),
    ...ghosts.map((n) => `${n}. szett kimaradt`),
  ].join('; ')

  const facts: [string, string][] = [
    [e.topChip ? setLabel(e.topChip) : '–', 'top szett'],
    [hu(e.volumeKg, 0), 'kg volumen'],
    [e.avgRir == null ? '–' : hu(e.avgRir), 'Ø RIR'],
  ]
  let n = 0

  return (
    <Page className="eo-page eo-ex">
      <FrameBack className="fo-backpill" onBack={onBack} label="Vissza az összegzéshez">Vissza az összegzéshez</FrameBack>

      <Hero
        className="eo-exhero"
        label="Top szett"
        verdict={topSentence(e.topChip, prevTop)}
        sub={(
          <>
            {e.abandoned ? 'kihagyva' : `${e.doneSets}/${e.plannedSets} szett`}
            {e.repMin != null && e.repMax != null && ` · cél ${e.repMin}–${e.repMax} ism.`}
          </>
        )}
        left={<Mchp muscle={e.muscle} />}
      >
        {tubes.length > 0 && (
          <HeroGraphic>
            <Tubes items={tubes} height={96} size="sm" className="eo-settubes" aria-label={`A szettek: ${tubeWords}`} />
          </HeroGraphic>
        )}
        <Note>
          Egy edény egy szett: {goal != null ? `a vonal a cél (${goal} ismétlés), ` : ''}a folyadék, amennyi sikerült.
        </Note>
      </Hero>

      <Section n={++n} title="A számok" />
      {/* Same gate as the comparison: no reference → the cell is absent and the strip is three
          across. Comparison never enters by a side door. */}
      <Card className="eo-nums">
        {prevTop ? (
          <>
            <Facts items={facts.slice(0, 2)} />
            <Facts items={[facts[2], [setLabel(prevTop), 'előzőleg']]} />
          </>
        ) : <Facts items={facts} />}
      </Card>

      {medals.length > 0 && (
        <>
          <Section n={++n} title="Medál" />
          <Card className="eo-medals">
            {medals.map((m, i) => <ReviewMedalRow key={`${m.type}-${m.date}-${m.setIndex ?? i}`} medal={m} />)}
            <Note>A vonal a kapszulán a régi rekord: a folyadék fölötte áll.</Note>
          </Card>
        </>
      )}

      <Section n={++n} title="Szettek" />
      <Card className="eo-sets">
        {lines.map(({ chip, index, verdict, word }, i) => (
          <Row
            key={i}
            className={`eo-set${chip.record ? ' rec' : ''}${chip.warmup ? ' warm' : ''}`}
            data-ix={index}
            icon={verdict ? VERDICT_ICON[verdict] : undefined}
            left={verdict ? undefined : <span className="eo-ix" aria-hidden="true">{index}</span>}
            title={<>{hu(chip.weight)} kg × {chip.reps}{chip.rir != null && <span className="eo-rir"> · RIR {chip.rir}</span>}</>}
            sub={(
              <>
                {chip.warmup ? 'bemelegítő' : `${index}. szett`}
                {!chip.warmup && word && <> · <span className="eo-band">{word}</span></>}
                {/* The set's own note sits under the set it was written about. */}
                {chip.note?.trim() && <> · <span className="eo-setnote">„{chip.note.trim()}”</span></>}
              </>
            )}
            value={`${hu(chip.weight * chip.reps, 0)} kg`}
          />
        ))}
        {ghosts.map((g) => (
          <Row key={`ghost-${g}`} className="eo-set eo-ghost" data-ix={String(g)} state="dim" icon="t-skip"
            title={`${g}. szett — kimaradt`} sub="üres maradt, nem számít hibának" />
        ))}
      </Card>
    </Page>
  )
}
