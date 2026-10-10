import { createContext, useContext, type ReactNode } from 'react'
import { Foot, Lk } from '@/shared/ui/folyadek'

/** The flow's consequence-free exit, provided by `RitualPage`. Absent (an act rendered alone): no exit link. */
export const RitualExitContext = createContext<(() => void) | null>(null)

/**
 * The floating action bar of a Napzárás act (Folyadék, mezo-n4wf5.2): „Kilépés" on the left, the
 * act's own buttons after it. Each act renders it as its LAST element, so inside `RitualPage`'s
 * `<Page nonav>` it is the page's foot; the act keeps owning its primary action (act 3 saves on
 * advance from its own state).
 */
export function RitualFoot({ children }: { children: ReactNode }) {
  const exit = useContext(RitualExitContext)
  return (
    <Foot nonav>
      {exit && <Lk aria-label="Kilépés" onClick={exit}>Kilépés</Lk>}
      {children}
    </Foot>
  )
}
