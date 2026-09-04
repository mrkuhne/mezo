import { useNavigate } from 'react-router-dom'
import { useProtocol, useStack, useStackDay } from '@/data/hooks'
import { StackManageCard } from '@/features/fuel/components/StackManageCard'
import { StackPageScaffold } from '@/features/fuel/components/StackPageScaffold'

const mealZones = new Set(['breakfast', 'lunch', 'dinner'])

export function FuelStackManagePage() {
  const navigate = useNavigate()
  const { occurrences, pending: protocolPending } = useProtocol()
  const { slots } = useStackDay()
  const { stash, pending: stackPending } = useStack()
  const loading = protocolPending || stackPending
  const zoneCount = slots.length
  const mealCount = occurrences.filter(occurrence => mealZones.has(occurrence.slotKey)).length

  return (
    <StackPageScaffold
      tone="lav" backTo="/fuel/stack" backLabel="‹ Stack" icon="i-beallitas"
      name="Protokoll kezelése" sub="Minden változás azonnal mentődik"
    >
      <div className="stk-manage-grid">
        <StackManageCard icon="i-stack" wash="sage" title="Protokoll tételei"
          detail={loading ? '—' : `${occurrences.length} tétel`} onClick={() => navigate('/fuel/stack/manage/protocol')} />
        <StackManageCard icon="i-idozito" wash="gold" title="Időzítési rend"
          detail={loading ? '—' : `${zoneCount} zóna`} onClick={() => navigate('/fuel/stack/manage/timing')} />
        <StackManageCard icon="i-recept" wash="coral" title="Étkezési horgonyok"
          detail={loading ? '—' : `${mealCount} tétel`} onClick={() => navigate('/fuel/stack/manage/meals')} />
        <StackManageCard icon="i-kamra" wash="sky" title="Új tétel a Kamrából"
          detail={loading ? '—' : `${stash.length} kamratétel`} onClick={() => navigate('/fuel/stack/manage/add')} />
      </div>
    </StackPageScaffold>
  )
}
