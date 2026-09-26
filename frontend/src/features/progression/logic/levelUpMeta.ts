import { MUSCLE_LABELS } from '@/data/train/train'
import type { LevelUpResult } from '@/data/train/trainApi'
import type { LifeSkillKey } from '@/data/types'
import type { ClayIconName, Icon3DName } from '@/shared/ui/clay'

type Source = LevelUpResult['source'] // 'GYM' | 'SPORT' | 'RUN' | 'QUEST' | 'ACTIVITY'

// Canonical 12-athletic name + emoji (from skill-model-v3.html, the chosen model), plus the
// Titanium 3D symbol (`art3d`, üveg U10 mezo-me75u.10, prototypes/uveg-reteg.html#szint + its
// Új ikonok sheet). The emoji `icon` stays for the surfaces that still read it (bible U4 rule 30).
export const ATHLETIC_META: Record<string, { name: string; icon: string; art3d: Icon3DName }> = {
  explosiveness: { name: 'Robbanékonyság', icon: '⚡', art3d: 't-bolt' },
  vertical_jump: { name: 'Vertikális emelkedés', icon: '🦘', art3d: 't-jump' },
  sprint_speed: { name: 'Sprint-sebesség', icon: '💨', art3d: 't-sprint' },
  aerobic_capacity: { name: 'Aerob kapacitás', icon: '🫁', art3d: 't-breath' },
  anaerobic_capacity: { name: 'Anaerob kapacitás', icon: '🔥', art3d: 't-flame' },
  strength_endurance: { name: 'Erő-állóképesség', icon: '🔁', art3d: 't-repeat' },
  core_stability: { name: 'Core-stabilitás', icon: '🧱', art3d: 't-core' },
  max_strength: { name: 'Maximális erő', icon: '🏋️', art3d: 't-dumbbell' },
  coordination: { name: 'Koordináció', icon: '🤹', art3d: 't-juggle' },
  mobility: { name: 'Mozgékonyság', icon: '🤸', art3d: 't-stretch' },
  agility: { name: 'Agility', icon: '🎯', art3d: 't-target' },
  robustness: { name: 'Robusztusság', icon: '🛡️', art3d: 't-shield' },
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
const MUSCLE_ART: Icon3DName = 't-muscle'
const FALLBACK_ART: Icon3DName = 't-spark'

export type SkillDisplay = {
  name: string
  /** Plain-text emoji fallback — kept for the surfaces that still read it. */
  icon: string
  clayIcon?: ClayIconName
  /** The icon the üveg surfaces draw (via `ContentIcon`): a Titanium name, or — for a LIFE
   *  skill — its clay name, which `CLAY_TO_3D` maps onto the 3D set. */
  art3d: Icon3DName | ClayIconName
}

/**
 * Resolve a gain's display name + icons from its skillKey + kind. The backend
 * sends gain.name = raw skillKey and gain.icon = null, so the FE owns this map.
 * Muscle names reuse the app-wide MUSCLE_LABELS; athletic names are canonical.
 */
export function skillDisplay(
  skillKey: string,
  kind: 'ATHLETIC' | 'MUSCLE' | 'LIFE',
  fallbackName?: string,
): SkillDisplay {
  if (kind === 'MUSCLE') {
    return { name: MUSCLE_LABELS[skillKey] ?? fallbackName ?? skillKey, icon: MUSCLE_ICON, art3d: MUSCLE_ART }
  }
  if (kind === 'LIFE') {
    const life = LIFE_META[skillKey]
    if (life) return { ...life, art3d: life.clayIcon }
  } else {
    const ath = ATHLETIC_META[skillKey]
    if (ath) return { ...ath }
  }
  return { name: fallbackName ?? skillKey, icon: FALLBACK_ICON, art3d: FALLBACK_ART }
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

/** The source chip's Titanium 3D symbol (üveg U10, mezo-me75u.10) — the overlay draws this;
 *  the emoji map above stays for any plain-text reader. */
export const CHIP_3D_BY_SOURCE: Record<Source, Icon3DName> = {
  GYM: 't-dumbbell',
  RUN: 't-run',
  SPORT: 't-volley',
  QUEST: 't-quest',
  ACTIVITY: 't-pencil',
  HABIT: 't-dawn',
}
