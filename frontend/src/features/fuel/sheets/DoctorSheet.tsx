// ============================================================
// Mezo · DoctorSheet — „Mikor fordulj orvoshoz?" (Kihagyás S3, mezo-q4xt2.3; Folyadék F5, mezo-n4wf5.5 —
// prototype vilagos/fuel.js `orvos`). A calm, factual list of warning signs for the two guidance
// categories (ILLNESS, STOMACH). Not medical advice — the sheet says so, and so does its card.
// ============================================================
import { Sheet } from '@/shared/ui/Sheet'
import { useM } from '@/shared/i18n'
import { Acts, FoSheetHead, Lk } from '@/shared/ui/folyadek'
import { Tip } from '@/features/fuel/components/folyadek'

export type DoctorCategory = 'ILLNESS' | 'STOMACH'

export function DoctorSheet({ category, onClose }: { category: DoctorCategory; onClose: () => void }) {
  const M = useM()
  const D = M.fuelMai.doctor
  return (
    <Sheet onClose={onClose} labelledBy="fuel-doctor-title" className="fo-sheet fa-doctor">
      {(close) => (
        <>
          <FoSheetHead icon="t-info" title={D.title} titleId="fuel-doctor-title" sub={D.sub[category]} />
          <ul className="fa-docl">
            {D.signs[category].map((t) => (
              <li key={t}><i aria-hidden="true" /><span>{t}</span></li>
            ))}
          </ul>
          <Tip icon="t-info" title={D.notMedical}>{D.unsure}</Tip>
          <Acts><Lk onClick={close}>{D.close}</Lk></Acts>
        </>
      )}
    </Sheet>
  )
}
