// ============================================================
// Mezo · DoctorSheet — „Mikor fordulj orvoshoz?" (Kihagyás S3, mezo-q4xt2.3; prototype
// elo/fuel.html `orvos()`). A calm, factual list of warning signs for the two guidance
// categories (ILLNESS, STOMACH). Not medical advice — the sheet says so, and so does its card.
// ============================================================
import { Sheet } from '@/shared/ui/Sheet'
import { SheetHead } from '@/shared/ui/SheetHead'
import { Icon3D } from '@/shared/ui/clay'

export type DoctorCategory = 'ILLNESS' | 'STOMACH'

export const DOCTOR_SIGNS: Record<DoctorCategory, readonly string[]> = {
  STOMACH: [
    'Nem marad meg benned a folyadék',
    'Véres a széklet vagy a hányás',
    'A hasmenés 7 napnál, a hányás 2 napnál tovább tart',
    'Kiszáradás jelei: szédülsz, alig van vizeleted',
    'Erős hasi fájdalom vagy magas láz',
  ],
  ILLNESS: [
    'A magas láz 3 napnál tovább tart',
    'Nehezen kapsz levegőt, vagy mellkasi fájdalmad van',
    'Néhány nap javulás után megint romlik az állapotod',
    'Nem tudsz inni, vagy a kiszáradás jeleit érzed',
  ],
}

export function DoctorSheet({ category, onClose }: { category: DoctorCategory; onClose: () => void }) {
  return (
    <Sheet glass onClose={onClose} labelledBy="fuel-doctor-title" className="fmx-doctor-sheet">
      {(close) => (
        <div className="uvl-body">
          <SheetHead icon="t-info" eyebrow={category === 'STOMACH' ? 'GYOMORRONTÁS' : 'BETEGSÉG'}
            title="Mikor fordulj orvoshoz?" titleId="fuel-doctor-title" onClose={close} />
          <ul className="fmx-docl">
            {DOCTOR_SIGNS[category].map((t) => (
              <li key={t}><i aria-hidden="true" /><span>{t}</span></li>
            ))}
          </ul>
          <div className="fmx-docnote">
            <Icon3D name="t-info" size={22} />
            <span>Ez nem orvosi tanács. Ha bizonytalan vagy, hívd a háziorvosodat vagy az ügyeletet.</span>
          </div>
          <button type="button" className="uvl-ghost is-wide" onClick={close}>Bezárom</button>
        </div>
      )}
    </Sheet>
  )
}
