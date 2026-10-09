import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useKnowledgeGraphNodes } from '@/data/hooks'
import { ROLAD_COPY } from '@/features/insights/logic/roladCopy'
import { RoladTimeline } from '@/features/insights/components/rolad/RoladTimeline'
import '@/features/insights/boop-world.css'
import { FrameBack } from '@/shared/ui/folyadek'

/**
 * S6c (mezo-2dfy2, prototype `eletesemenyek6`): the life-event timeline moved off the Rólad page
 * behind its own door — tf-dhead (‹ Rólad), a lede, then the same amber timeline card. An empty
 * list is a real answer here (`showEmpty`), never a blank page.
 */
export function RoladLifeEventsPage() {
  const { nodes, isError, refetch } = useKnowledgeGraphNodes()
  return (
    <div className="kr9-rolad">
      <EntranceGroup className="kr9-rflow">
        <div className="tf-dhead">
          <FrameBack className="glass tf-back" history fallback="/mezo/rolad" label="Vissza: Rólad">‹</FrameBack>
          <span className="tf-dtitle"><small>Rólad</small><strong>Életesemények</strong></span>
        </div>
        <p className="kr9-quiet">{ROLAD_COPY.lifeEventsLede}</p>
        <RoladTimeline nodes={nodes} isError={isError} onRetry={refetch} delay={80} showEmpty />
        <p className="kr9-quiet">{ROLAD_COPY.lifeEventsFoot}</p>
      </EntranceGroup>
    </div>
  )
}
