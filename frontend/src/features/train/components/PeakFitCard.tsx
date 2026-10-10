// ============================================================
// Mezo · PeakFitCard — the „Csúcshét · időbecslés" check of the day editor (mezo-3m5m,
// spec GD6; Folyadék mezo-n4wf5.3, prototype vilagos/edzes.js `napszerk()` section 4).
// A collapsible row: the days whose PROJECTED peak-week session length (peakWeekFit — the
// week once every group reaches its tier's target) falls outside SESSION_LENGTH_BAND. A
// different signal from StructureLintCard's own-minutes rule; neither silences the other.
// Explains, never scolds: a quiet warning pill with the day count, never red, never opens
// by itself. Renders nothing when there is nothing to flag.
// ============================================================
import { useState } from 'react'
import type { PeakDayFit } from '@/features/train/logic/peakWeekFit'
import { Row, St } from '@/shared/ui/folyadek'

function copyFor(f: PeakDayFit): string {
  return f.direction === 'over'
    ? `${f.day}: csúcshéten ~${f.minutes} perc — vegyél el, vagy tedd át.`
    : `${f.day}: csúcshéten is csak ~${f.minutes} perc — férne még bele inger.`
}

export function PeakFitCard({ fits }: { fits: PeakDayFit[] }) {
  const [open, setOpen] = useState(false)
  if (fits.length === 0) return null

  return (
    <>
      <Row className="ee-chk" icon="t-clock" title="Csúcshét · időbecslés" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        right={<><St tone="warn">{`${fits.length} nap`}</St><span className="ee-cv" aria-hidden="true">{open ? '▲' : '▼'}</span></>} />
      {open && (
        <div className="ee-in">
          {fits.map((f, i) => <p key={`${f.day}-${i}`}>{copyFor(f)}</p>)}
        </div>
      )}
    </>
  )
}
