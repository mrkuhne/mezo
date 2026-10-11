// ============================================================
// Mezo · StructureLintCard — the „Struktúra" check of the day editor (mezo-oyhy.2;
// Folyadék mezo-n4wf5.3, prototype vilagos/edzes.js `napszerk()` section 4).
// A collapsible row: soft structural observations from structureLint with their
// why-explanations. Never red, never opens by itself, never blocks (explain, don't scold).
// The pill says „n észrevétel" or „✓ rendben".
// ============================================================
import type { StructureFinding } from '@/features/train/logic/structureLint'
import { CheckRow } from '@/features/train/components/folyadek'
import { St } from '@/shared/ui/folyadek'

export function StructureLintCard({ findings }: { findings: StructureFinding[] }) {
  const clean = findings.length === 0
  return (
    <CheckRow icon="t-shield" title="Struktúra"
      stamp={<St tone={clean ? 'ok' : 'warn'}>{clean ? '✓ rendben' : `${findings.length} észrevétel`}</St>}>
      {clean
        ? <p>✓ A terv strukturálisan rendben — gyakorlat/izom, frekvencia és balansz a sávban.</p>
        : findings.map((f, i) => <p key={`${f.rule}-${i}`}><b>{f.label}</b> {f.detail}</p>)}
    </CheckRow>
  )
}
