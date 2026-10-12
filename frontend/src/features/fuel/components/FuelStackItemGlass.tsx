// ============================================================
// Mezo · FuelStackItemGlass — one supplement's detail box on the Kiegészítők hub (Folyadék F5, mezo-n4wf5.5;
// S2 manifest D1). Prototype: docs/design_2.0/prototypes/vilagos/fuel.js sheet `item`.
//
// A light sheet: head (name · dose · daily) → three facts (slot + time · where the placement came from · today's state)
// → the one-tap tick → „Ebből a termékből" (or the honest „Termékadatok" face) → „Miért így" → the pantry link (or
// „Nincs a kamrádban") → the boundary line → Bezárom. The component keeps its name and props.
//
// Honest null: when the product's facts are missing we say so and offer setup — no invented count. The placement reason
// is the engine's STORED sentence (never translated); without one nothing is made up. The box has no stock level and no
// „lasts until": the pantry only knows the stock and its unit.
// ============================================================
import { useId } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStack } from '@/data/hooks'
import { useM } from '@/shared/i18n'
import { Sheet } from '@/shared/ui/Sheet'
import { Acts, Btn, FoSheetHead, Lab, Lk, Note, Row, Tags, Txt } from '@/shared/ui/folyadek'
import { Kv } from '@/features/fuel/components/folyadek'
import { fmtAmount } from '@/features/fuel/logic/doseAdvice'
import type { BandRow } from '@/features/fuel/logic/stackBands'
import type { ReactNode } from 'react'

export function FuelStackItemGlass({ row, onClose, onToggle }: {
  row: BandRow
  onClose: () => void
  onToggle: () => void
}) {
  const titleId = useId()
  const navigate = useNavigate()
  const M = useM().fuelKieg
  const { stash } = useStack()
  const item = stash.find(candidate => candidate.id === row.itemId)
  const taken = row.taken

  const stock = item && item.stock != null
    ? `${fmtAmount(item.stock)}${item.stockUnit ? ` ${M.common.stockUnit(item.stockUnit)}` : ''}`
    : null
  const facts: Array<[ReactNode, ReactNode]> = [[M.item.dailyDose, row.dose ?? '—']]
  if (item?.form) facts.push([M.item.form, M.common.form(item.form, 1)])
  if (stock) facts.push([M.item.inStock, stock])
  if (row.entry.dailyTotalHint) facts.push([M.item.dailyTotal, row.entry.dailyTotalHint])

  return (
    <Sheet onClose={onClose} className="fo-sheet fk-sheet" labelledBy={titleId}>
      {(close) => (
        <>
          <FoSheetHead icon="t-supps" title={row.name} titleId={titleId} sub={M.item.sub(row.dose ?? '—')} />
          <Tags className="fk-tags" items={[
            M.protocol.slotTime(row.zoneLabel, row.time),
            row.entry.pinned ? M.item.place.manual : M.item.place[row.entry.placementSource],
            taken ? M.item.taken(row.takenAtHHmm) : M.item.notTaken,
          ]} />
          <Acts><Btn sm onClick={onToggle}>{taken ? M.item.undo : M.common.markTaken}</Btn></Acts>

          {row.dose || stock ? (
            <>
              <Lab>{M.item.fromProduct}</Lab>
              <div className="fk-kv"><Kv items={facts} /></div>
            </>
          ) : (
            <>
              <Lab>{M.item.productDetails}</Lab>
              <Txt>{M.item.detailsMissing}</Txt>
              <Row icon="t-gear" title={M.item.setItUp} onClick={() => { onClose(); navigate('/fuel/stack/manage/add') }} />
            </>
          )}

          <Lab>{M.item.why}</Lab>
          <Txt>
            {row.entry.reason
              ?? (row.entry.pinned ? M.item.placedByHand(row.zoneLabel) : M.item.noReason)}
          </Txt>

          {item ? (
            <Row icon="t-stack" title={item.name} sub={stock ? M.item.inPantryStock(stock) : M.item.inPantry}
              onClick={() => { onClose(); navigate(`/fuel/kamra/${item.id}`) }} />
          ) : (
            <>
              <Lab>{M.item.notInPantry}</Lab>
              <Txt>{M.item.notInPantryText}</Txt>
            </>
          )}

          <Note>{M.common.note}</Note>
          <Acts><Lk onClick={close}>{M.common.close}</Lk></Acts>
        </>
      )}
    </Sheet>
  )
}
