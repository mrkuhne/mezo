import type { ClayIconName } from '@/shared/ui/clay'
import type { MozaikWash } from '@/shared/ui/mozaik'
import type { LifeGoalDimension, LifeGoalStatus, PillarDayStatus, PillarKind, TrendArrow } from '@/data/lifegoal/lifegoalApi'

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

// Live-progress rendering (Task 9, mezo-iizd.5, prototype celok.html #page-g1 `.arrow`/`.wk7`/`.hm`).
// `insufficient` maps to the SAME glyph/class as the honest "no data yet" placeholder on purpose —
// a goal/pillar below the 5-data-day floor reads identically whether progress is absent or present-
// but-insufficient (guardrail: never invent a direction out of too little data).
export const ARROW_GLYPH: Record<TrendArrow, string> = { up: '↗', flat: '→', down: '↘', insufficient: '—' }
export const ARROW_CLASS: Record<TrendArrow, string> = { up: 'up', flat: 'flat', down: 'down', insufficient: 'none' }
// prototype celok.html data-dots/data-hm characters: h=hit, p=partial, m=miss, n=no_data.
export const DOT_CLASS: Record<PillarDayStatus, string> = { hit: 'h', partial: 'p', miss: 'm', no_data: 'n' }
