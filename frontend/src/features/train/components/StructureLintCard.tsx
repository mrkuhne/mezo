// ============================================================
// Mezo · StructureLintCard — the „Struktúra" check of the day editor (mezo-oyhy.2;
// Folyadék mezo-n4wf5.3, prototype vilagos/edzes.js `napszerk()` section 4).
// A collapsible row: soft structural observations from structureLint with their
// why-explanations. Never red, never opens by itself, never blocks (explain, don't scold).
// The pill says „n észrevétel" or „✓ rendben".
// ============================================================
import { useState } from 'react'
import type { StructureFinding } from '@/features/train/logic/structureLint'
import { Row, St } from '@/shared/ui/folyadek'

export function StructureLintCard({ findings }: { findings: StructureFinding[] }) {
  const [open, setOpen] = useState(false)
  const clean = findings.length === 0

  return (
    <>
      <Row className="ee-chk" icon="t-shield" title="Struktúra" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        right={<><St tone={clean ? 'ok' : 'warn'}>{clean ? '✓ rendben' : `${findings.length} észrevétel`}</St><span className="ee-cv" aria-hidden="true">{open ? '▲' : '▼'}</span></>} />
      {open && (
        <div className="ee-in">
          {clean
            ? <p>✓ A terv strukturálisan rendben — gyakorlat/izom, frekvencia és balansz a sávban.</p>
            : findings.map((f, i) => <p key={`${f.rule}-${i}`}><b>{f.label}</b> {f.detail}</p>)}
        </div>
      )}
    </>
  )
}
