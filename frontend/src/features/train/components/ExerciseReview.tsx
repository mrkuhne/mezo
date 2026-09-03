// ============================================================
// Mezo · ExerciseReview — one exercise's own view inside the workout report
// (mezo-d20.8.2.1, spec 2026-08-31 §3.3). The swimlane tile opens this; it is
// where the set finally gets room to be read.
//
// Deliberately a LOCAL view of WorkoutSummary rather than a route: the closing
// report lives inside ActiveWorkoutPage's phase machine and has no route of its
// own, so a routed variant would mean two mechanisms for one screen — and the
// one that is harder to reach would be the one that drifts.
// ============================================================
import type { CSSProperties } from 'react'
import { MUSCLE_LABELS } from '@/data/train/train'
import { muscleColor } from '@/features/train/logic/muscleColors'
import { MEDAL_TYPE_LABEL, MEDAL_UNIT_LABEL, formatMedalNumber, medalValueLabel } from '@/features/train/logic/medalLabels'
import type { SummaryExerciseView, SummarySetChip } from '@/features/train/logic/summaryStats'
import type { Medal } from '@/data/train/medalTypes'
import { ClaySpot } from '@/shared/ui/clay'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

const hu = (n: number, digits = 1) => n.toLocaleString('hu-HU', { maximumFractionDigits: digits })
const setLabel = (c: SummarySetChip) => `${hu(c.weight)} × ${c.reps}`

/** In-band / out-of-band is only meaningful for a working set against a prescribed band. */
function bandLabel(c: SummarySetChip, repMin?: number, repMax?: number) {
  if (c.warmup) return { text: 'bemelegítő', inBand: false }
  if (repMin == null || repMax == null) return null
  const inBand = c.reps >= repMin && c.reps <= repMax
  return { text: inBand ? 'célsávban' : 'sávon kívül', inBand }
}

export function ExerciseReview({
  exercise, medals, prevTop, onBack,
}: {
  exercise: SummaryExerciseView
  /** This workout's RECORD medals, already filtered to this exercise by the caller. */
  medals: Medal[]
  /** The reference session's top set for the same exercise — absent in closing mode and
   *  whenever there is no reference, exactly like the comparison tile (spec §3.3). */
  prevTop: SummarySetChip | null
  onBack: () => void
}) {
  const e = exercise
  const fam = muscleColor(e.muscle)
  const famStyle = { '--fam-rail': fam.rail, '--fam-wash': fam.wash, '--fam-deep': fam.deep } as CSSProperties
  // Working sets are numbered 1..n on their own; a warmup carries `B` instead, so the third
  // working set never reads as "4" just because a warmup preceded it.
  let workingIdx = 0

  return (
    <div style={famStyle}>
      <div className="wsum-top">
        <button onClick={onBack}>
          <span className="wsum-xi" aria-hidden="true">←</span>
          Vissza a riporthoz
        </button>
      </div>

      <EntranceGroup>
        <div className="wr-exhero">
          <span className="mono" aria-hidden="true">{e.name.charAt(0)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="nm">{e.name}</div>
            <div className="sb">
              <span className="mus">{MUSCLE_LABELS[e.muscle] ?? e.muscle}</span>
              <span>{e.abandoned ? 'kihagyva' : `${e.doneSets}/${e.plannedSets} szett`}</span>
              {e.repMin != null && e.repMax != null && <span>cél {e.repMin}–{e.repMax} ism.</span>}
            </div>
          </div>
        </div>

        <div className="wsum-stripwrap">
          <div className="mz-statstrip">
            <div className="mz-statcell"><div className="v">{e.topChip ? setLabel(e.topChip) : '–'}</div><div className="l">Top szett</div></div>
            <div className="mz-statcell"><div className="v">{hu(e.volumeKg, 0)}</div><div className="l">kg volumen</div></div>
            <div className="mz-statcell"><div className="v">{e.avgRir == null ? '–' : hu(e.avgRir)}</div><div className="l">Ø RIR</div></div>
            {/* Same gate as the comparison tile: no reference, or closing mode → the cell is
                absent and the strip narrows to three. Comparison never enters by a side door. */}
            {prevTop && <div className="mz-statcell"><div className="v">{setLabel(prevTop)}</div><div className="l">Előzőleg</div></div>}
          </div>
        </div>

        {medals.length > 0 && (
          <div className="wsum-sec">
            <div className="wsum-slabel">Medál</div>
            {medals.map((m, i) => (
              <div key={`${m.type}-${m.date}-${m.setIndex ?? i}`} className="wsum-medal">
                <div className="disc" aria-hidden="true"><ClaySpot name="s-medal" size={26} /></div>
                <div className="tx">
                  <div className="t">{MEDAL_TYPE_LABEL[m.type] ?? m.type}</div>
                  <div className="m">
                    {m.type === 'E1RM' && m.weightKg != null && m.reps != null ? `${formatMedalNumber(m.weightKg)} × ${m.reps}-ből becsülve` : e.name}
                  </div>
                </div>
                <div className="val">
                  <div className="now">{medalValueLabel(m)}</div>
                  {m.previousValue != null && (
                    <div className="prev">előző: {formatMedalNumber(m.previousValue)} {MEDAL_UNIT_LABEL[m.unit] ?? ''}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="wsum-sec">
          <div className="wsum-slabel">Szettek</div>
          {e.chips.map((c, i) => {
            if (!c.warmup) workingIdx += 1
            const band = bandLabel(c, e.repMin, e.repMax)
            return (
              <div key={i} className={`wr-set${c.record ? ' rec' : ''}${c.warmup ? ' warm' : ''}`}>
                <span className="ix" aria-hidden="true">{c.warmup ? 'B' : workingIdx}</span>
                <div className="tx">
                  <div>
                    <span className="load"><b>{hu(c.weight)}</b> kg × <b>{c.reps}</b></span>
                    {c.rir != null && <span className="rir">RIR {c.rir}</span>}
                    {band && <span className={`band${band.inBand ? ' in' : ''}`}>{band.text}</span>}
                  </div>
                  {/* The note has always been on the wire (`ExerciseSetResponse.note`) and was
                      displayed nowhere; here it sits under the set it was written about. */}
                  {c.note?.trim() && <div className="note">{c.note.trim()}</div>}
                </div>
                <span className="vol">{hu(c.weight * c.reps, 0)} kg</span>
              </div>
            )
          })}
          {/* Ghost slots continue the WORKING numbering, not the raw set count: with one warmup
              logged the tiles read B · 1 · 2, so a ghost numbered by doneSets would jump to 4
              and line up with nothing on screen. */}
          {Array.from({ length: e.missing }, (_, i) => (
            <div key={`ghost-${i}`} className="wr-set ghost">
              <span className="ix" aria-hidden="true">{workingIdx + i + 1}</span>
              <div className="tx"><span className="load">— kimaradt</span></div>
            </div>
          ))}
        </div>
      </EntranceGroup>
    </div>
  )
}
