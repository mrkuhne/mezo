import { MUSCLE_LABELS } from '@/data/train/train'
import type { LevelUpResult } from '@/data/train/trainApi'
import type { LifeSkillKey } from '@/data/types'
import type { ClayIconName } from '@/shared/ui/clay'

type Source = LevelUpResult['source'] // 'GYM' | 'SPORT' | 'RUN' | 'QUEST' | 'ACTIVITY'

// Canonical 12-athletic name + emoji (from skill-model-v3.html, the chosen model).
export const ATHLETIC_META: Record<string, { name: string; icon: string }> = {
  explosiveness: { name: 'Robbanékonyság', icon: '⚡' },
  vertical_jump: { name: 'Vertikális emelkedés', icon: '🦘' },
  sprint_speed: { name: 'Sprint-sebesség', icon: '💨' },
  aerobic_capacity: { name: 'Aerob kapacitás', icon: '🫁' },
  anaerobic_capacity: { name: 'Anaerob kapacitás', icon: '🔥' },
  strength_endurance: { name: 'Erő-állóképesség', icon: '🔁' },
  core_stability: { name: 'Core-stabilitás', icon: '🧱' },
  max_strength: { name: 'Maximális erő', icon: '🏋️' },
  coordination: { name: 'Koordináció', icon: '🤹' },
  mobility: { name: 'Mozgékonyság', icon: '🤸' },
  agility: { name: 'Agility', icon: '🎯' },
  robustness: { name: 'Robusztusság', icon: '🛡️' },
}

// LIFE band (gamified growth E2, mezo-jzca) — octagon order, mirrors ProgressionTaxonomy.LIFE.
// F7.4 (mezo-d20.8.4.1): every LIFE skill carries its clay symbol — React surfaces render
// the ClayIcon, the emoji stays as the plain-text fallback only.
export const LIFE_SKILLS: { key: LifeSkillKey; name: string; icon: string; clayIcon: ClayIconName }[] = [
  { key: 'mindfulness', name: 'Tudatosság', icon: '🧘', clayIcon: 'i-life-tudatossag' },
  { key: 'mindset', name: 'Szemlélet', icon: '🌱', clayIcon: 'i-life-szemlelet' },
  { key: 'cooking', name: 'Konyha', icon: '🍳', clayIcon: 'i-life-konyha' },
  { key: 'financial', name: 'Pénzügyek', icon: '💰', clayIcon: 'i-life-penzugyek' },
  { key: 'productivity', name: 'Produktivitás', icon: '🎯', clayIcon: 'i-life-produktivitas' },
  { key: 'learning', name: 'Tanulás', icon: '📚', clayIcon: 'i-life-tanulas' },
  { key: 'connection', name: 'Kapcsolatok', icon: '🤝', clayIcon: 'i-life-kapcsolatok' },
  { key: 'recovery', name: 'Regeneráció', icon: '🛌', clayIcon: 'i-life-regeneracio' },
]
const LIFE_META: Record<string, { name: string; icon: string; clayIcon: ClayIconName }> =
  Object.fromEntries(LIFE_SKILLS.map((s) => [s.key, { name: s.name, icon: s.icon, clayIcon: s.clayIcon }]))

const MUSCLE_ICON = '💪'
const FALLBACK_ICON = '✨'

/**
 * Resolve a gain's display name + emoji from its skillKey + kind. The backend
 * sends gain.name = raw skillKey and gain.icon = null, so the FE owns this map.
 * Muscle names reuse the app-wide MUSCLE_LABELS; athletic names are canonical.
 */
export function skillDisplay(
  skillKey: string,
  kind: 'ATHLETIC' | 'MUSCLE' | 'LIFE',
  fallbackName?: string,
): { name: string; icon: string; clayIcon?: ClayIconName } {
  if (kind === 'MUSCLE') {
    return { name: MUSCLE_LABELS[skillKey] ?? fallbackName ?? skillKey, icon: MUSCLE_ICON }
  }
  const meta = kind === 'LIFE' ? LIFE_META[skillKey] : ATHLETIC_META[skillKey]
  if (meta) return meta
  return { name: fallbackName ?? skillKey, icon: FALLBACK_ICON }
}

export const HEADLINE_BY_SOURCE: Record<Source, string> = {
  GYM: 'Erős nap volt.',
  RUN: 'Lett benne tempó.',
  SPORT: 'Megdolgoztattad.',
  QUEST: 'Napi győzelem.',
  ACTIVITY: 'Az élet is edzés.',
  HABIT: 'A rutin épít.',
}

/** Headline when XP accrued but no level was crossed (the common case). */
export const HEADLINE_NO_LEVELUP = 'Szépen gyűlik.'

export const CHIP_ICON_BY_SOURCE: Record<Source, string> = {
  GYM: '🏋️',
  RUN: '🏃',
  SPORT: '🏐',
  QUEST: '📜',
  ACTIVITY: '✍️',
  HABIT: '☀️',
}
