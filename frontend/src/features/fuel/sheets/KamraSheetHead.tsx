// ============================================================
// Mezo · KamraSheetHead — a Kamra négy lapjának közös feje (Folyadék F5, mezo-n4wf5.5)
// A négy lap (import, kézi tétel, közös katalógus, kategória-szűrő) a világos Folyadék lap
// (`<Sheet className="fo-sheet">`), a fej pedig a kit `FoSheetHead`-je: ikon-buborék, cím, alatta a lap
// kontextus-sora (prototípus `sh(icon, title, sub)`). A név és a propok megmaradtak: az `eyebrow` a cím ALATTI sor.
// A lapokat a saját láb-linkjük zárja (Mégse / Bezárom), ezért a fej × gombja opcionális.
// ============================================================
import type { ReactNode } from 'react'
import type { Icon3DName } from '@/shared/ui/clay'
import { FoSheetHead } from '@/shared/ui/folyadek'

/** The Kamra sheets' shell class: the light Folyadék sheet. */
export const KAMRA_SHEET_CLASS = 'fo-sheet'

export function KamraSheetHead({ icon, eyebrow, title, titleId, onClose, action }: {
  icon?: Icon3DName
  eyebrow: string
  title: string
  titleId: string
  /** Renders the round × close. */
  onClose?: () => void
  action?: ReactNode
}) {
  return (
    <>
      <FoSheetHead icon={icon} title={title} titleId={titleId} sub={eyebrow} onClose={onClose} />
      {action}
    </>
  )
}
