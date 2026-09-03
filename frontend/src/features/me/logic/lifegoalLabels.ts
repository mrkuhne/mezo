import type { ClayIconName } from '@/shared/ui/clay'
import type { MozaikWash } from '@/shared/ui/mozaik'
import type { LifeGoalDimension, LifeGoalStatus, PillarKind } from '@/data/lifegoal/lifegoalApi'

// PERMAH → the six house domain colors (prototype celok-head.html .d-* tokens).
export const DIMENSIONS: Record<LifeGoalDimension, { label: string; wash: MozaikWash; icon: ClayIconName; cls: string }> = {
  positive_emotion: { label: 'Érzelem',      wash: 'gold', icon: 'i-life-tudatossag',  cls: 'lg-d-p' },
  engagement:       { label: 'Elmélyülés',   wash: 'lav',  icon: 'i-life-tanulas',     cls: 'lg-d-e' },
  relationships:    { label: 'Kapcsolatok',  wash: 'rose', icon: 'i-life-kapcsolatok', cls: 'lg-d-r' },
  meaning:          { label: 'Értelem',      wash: 'coral',icon: 'i-life-szemlelet',   cls: 'lg-d-m' },
  accomplishment:   { label: 'Teljesítmény', wash: 'sky',  icon: 'i-life-produktivitas', cls: 'lg-d-a' },
  health:           { label: 'Egészség',     wash: 'sage', icon: 'i-life-regeneracio', cls: 'lg-d-h' },
}
export const DIMENSION_ORDER: LifeGoalDimension[] = ['positive_emotion', 'engagement', 'relationships', 'meaning', 'accomplishment', 'health']
export const KIND_LABEL: Record<PillarKind, string> = { habit: 'szokás', average: 'átlag', target: 'cél-érték', baseline: 'baseline', linked: 'kapcsolt' }
export const STATUS_LABEL: Record<LifeGoalStatus, string> = { draft: 'tervezett', active: 'aktív', parked: 'parkol', done: 'kész', archived: 'archivált' }
