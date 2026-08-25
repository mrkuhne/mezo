// ============================================================
// Mezo · PeakFitCard — peak-week session-time fit signal (mezo-3m5m,
// spec GD6). Renders the days whose PROJECTED peak-week session length
// (peakWeekFit — the week once every group actually reaches its tier's
// landmark target) falls outside SESSION_LENGTH_BAND. This is a DISTINCT
// surface from StructureLintCard's R8 (plan AD7): R8 reads the
// template's OWN minutes, this card reads the projected PEAK week's —
// neither merges into nor silences the other. Modeled on
// StructureLintCard: soft grey rows, count pill in the header, never
// red, never force-opens — same MacroFactor "explain, don't scold"
// register. Renders null when there is nothing to flag.
// ============================================================
import { useState } from 'react'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import type { PeakDayFit } from '@/features/train/logic/peakWeekFit'

function copyFor(f: PeakDayFit): string {
  return f.direction === 'over'
    ? `${f.day}: csúcshéten ~${f.minutes} perc — vegyél el, vagy tedd át.`
    : `${f.day}: csúcshéten is csak ~${f.minutes} perc — férne még bele inger.`
}

export function PeakFitCard({ fits }: { fits: PeakDayFit[] }) {
  const [open, setOpen] = useState(false)
  if (fits.length === 0) return null

  return (
    <div className="card" style={{ padding: 16 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="row"
        style={{
          width: '100%', justifyContent: 'space-between', alignItems: 'center',
          background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0,
        }}
      >
        <Eyebrow brand>Csúcshét · időbecslés</Eyebrow>
        <span className="row" style={{ gap: 8, alignItems: 'center' }}>
          <span
            style={{
              fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
              background: 'var(--wash-amber)', color: 'var(--amber-deep)',
            }}
          >
            {`${fits.length} nap`}
          </span>
          <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>{open ? '▴' : '▾'}</span>
        </span>
      </button>

      {open && (
        <div className="col" style={{ gap: 8, marginTop: 12 }}>
          {fits.map((f, i) => (
            <div
              key={`${f.day}-${i}`}
              style={{
                borderRadius: 12, padding: '9px 11px', fontSize: 11.5, lineHeight: 1.45,
                background: 'var(--surface-2)', color: 'var(--text-secondary)',
              }}
            >
              {copyFor(f)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
