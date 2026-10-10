import { useNavigate } from 'react-router-dom'
import type { ComponentProps } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { FoSheetHead } from '@/shared/ui/folyadek'
import { NapFuelGraphic } from '@/features/today/components/NapFuelGraphic'

/** „A napod üzemanyaga" (Folyadék prototype `SHEETS.uzemanyag`): the day's kcal and the three macros, opened from
 *  the „Továbbiak" row of Mai. The body is `NapFuelGraphic`; „Fuel megnyitása" leaves for the Fuel domain. */
export function NapFuelSheet({ onClose, ...fuel }: { onClose(): void } & Omit<ComponentProps<typeof NapFuelGraphic>, 'onOpenFuel'>) {
  const navigate = useNavigate()
  return (
    <Sheet onClose={onClose} labelledBy="nm-fuel-title" className="fo-sheet">
      {(close) => (
        <>
          <FoSheetHead icon="t-macro" title="A napod üzemanyaga" titleId="nm-fuel-title" sub="Fuel · ma" onClose={close} />
          <NapFuelGraphic {...fuel} onOpenFuel={() => navigate('/fuel')} />
        </>
      )}
    </Sheet>
  )
}
