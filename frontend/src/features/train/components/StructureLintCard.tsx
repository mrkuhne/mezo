// ============================================================
// Mezo · StructureLintCard — collapsible "Struktúra" card in the meso
// day editor (mezo-oyhy.2): soft structural observations from
// structureLint with why-explanations. Never red, never force-opens,
// never blocks — MacroFactor principle (explain, don't scold).
// Header pill: "{n} észrevétel" (amber wash) or "✓ rendben" (sage wash).
// ============================================================
import { useState } from 'react'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import type { StructureFinding } from '@/features/train/logic/structureLint'

export function StructureLintCard({ findings }: { findings: StructureFinding[] }) {
  const [open, setOpen] = useState(false)
  const clean = findings.length === 0

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
        <Eyebrow brand>Struktúra</Eyebrow>
        <span className="row" style={{ gap: 8, alignItems: 'center' }}>
          <span
            style={{
              fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
              background: clean ? 'var(--wash-sage)' : 'var(--wash-amber)',
              color: clean ? 'var(--sage-deep)' : 'var(--amber-deep)',
            }}
          >
            {clean ? '✓ rendben' : `${findings.length} észrevétel`}
          </span>
          <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>{open ? '▴' : '▾'}</span>
        </span>
      </button>

      {open && (
        <div className="col" style={{ gap: 8, marginTop: 12 }}>
          {clean ? (
            <div style={{ fontSize: 11.5, lineHeight: 1.45, color: 'var(--sage-deep)' }}>
              ✓ A terv strukturálisan rendben — gyakorlat/izom, frekvencia és balansz a sávban.
            </div>
          ) : (
            findings.map((f, i) => (
              <div
                key={`${f.rule}-${i}`}
                style={{
                  borderRadius: 12, padding: '9px 11px', fontSize: 11.5, lineHeight: 1.45,
                  background: 'var(--surface-2)', color: 'var(--text-secondary)',
                }}
              >
                <strong style={{ color: 'var(--text-primary)' }}>{f.label}</strong> {f.detail}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
