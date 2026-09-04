// Fuel · Stack hub — next action first, depth through four dedicated subpages (mezo-ubxd).
// The application shell supplies the real header; this page deliberately starts with useful
// content instead of repeating a local PageHead/PageHero.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFuelDay, useProtocol, useRecipes, useStack, useStackDay } from '@/data/hooks'
import { StackNextHero } from '@/features/fuel/components/StackNextHero'
import { StackRhythmPreview } from '@/features/fuel/components/StackRhythmPreview'
import { buildStackDayView } from '@/features/fuel/logic/stackPresentation'
import { useStackIntakeToggle } from '@/features/fuel/logic/useStackIntakeToggle'
import { matchMealsToStack } from '@/features/fuel/logic/matchMealsToStack'
import type { StackDayEntry } from '@/features/fuel/logic/projectStackDay'
import { StackItemSheet } from '@/features/fuel/sheets/StackItemSheet'
import { addDays, localDateString } from '@/shared/lib/dates'
import { MozaikPage, Mosaic, PageBody, Tile } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

export function FuelStackPage() {
  const navigate = useNavigate()
  const { slots, occurrences } = useStackDay()
  const { pending: protocolPending } = useProtocol()
  const { pending: stackPending } = useStack()
  const { recipes } = useRecipes()
  const { toggleIntake } = useStackIntakeToggle()
  const today = localDateString()
  const { fuel: todayFuel } = useFuelDay(today)
  const { fuel: yesterdayFuel } = useFuelDay(addDays(today, -1))
  const [openEntry, setOpenEntry] = useState<StackDayEntry | null>(null)

  const view = buildStackDayView(slots)
  const mealMatch = matchMealsToStack(slots, recipes, todayFuel.meals, yesterdayFuel.meals)
  const mealMatchCount = mealMatch.suggestions.length + mealMatch.verdicts.length
  const zoneCount = new Set(occurrences.map(occurrence => occurrence.slotKey)).size
  const loading = protocolPending || stackPending

  return (
    <MozaikPage tone="sage" className="stk-hub-page">
      <EntranceGroup>
        <PageBody className="stk-hub-body">
          <StackNextHero
            view={view}
            onToggle={entry => { void toggleIntake(entry) }}
            onOpen={setOpenEntry}
            onAdd={() => navigate('/fuel/stack/manage/add')}
          />

          {view.totalCount > 0 && (
            <StackRhythmPreview
              rows={view.previewRows}
              totalCount={view.totalCount}
              onOpenAll={() => navigate('/fuel/stack/today')}
            />
          )}

          <Mosaic className="stk-hub-mosaic">
            <Tile
              wash="sage" icon="i-stack" eyebrow="Teljes protokoll"
              line={loading ? 'betöltés…' : `${occurrences.length} tétel · ${zoneCount} zóna`}
              onClick={() => navigate('/fuel/stack/protocol')} aria-label="Teljes protokoll"
              delayMs={80}
            />
            <Tile
              wash="gold" icon="i-idozito" eyebrow="Mai ritmus"
              line={`${view.takenCount}/${view.totalCount} bevéve`}
              onClick={() => navigate('/fuel/stack/today')} aria-label="Mai ritmus"
              delayMs={110}
            />
            <Tile
              wash="coral" icon="i-recept" eyebrow="Étkezéshez"
              line={mealMatchCount > 0 ? `${mealMatchCount} kapcsolódás` : 'Mit mivel érdemes?'}
              onClick={() => navigate('/fuel/stack/meals')} aria-label="Étkezéshez"
              delayMs={140}
            />
            <Tile
              wash="lav" icon="i-beallitas" eyebrow="Kezelés"
              line={`${occurrences.length} tétel · beállítás`}
              onClick={() => navigate('/fuel/stack/manage')} aria-label="Kezelés"
              delayMs={170}
            />
          </Mosaic>
        </PageBody>
      </EntranceGroup>

      {openEntry && <StackItemSheet entry={openEntry} onClose={() => setOpenEntry(null)} />}
    </MozaikPage>
  )
}
