// ============================================================
// Mezo · itemIcon — a habit-sorok ikonja (mezo-e26w). A régi viselkedés minden
// lánc minden sorára a NAPSZAK emojiját tette, amitől öt egyforma 🌅 állt a
// reggeli rutinban. A létra három fokú, és mindig ad találatot:
//   1. `habitKey` → kurált tábla (a beépített szokások)
//   2. `skillKey` → a life-skill emojija — a `LifeSkillKey` ZÁRT, 8 értékű enum,
//      tehát minden jövőbeli, AI-generált szokásra is van értelmes találat
//   3. napszak-emoji — a régi viselkedés, végső tartalékként
// Pure: no React, no hooks, no side effects.
// A `DAYPART_EMOJI` innen exportálódik (nem a `todayItems`-ből), különben a
// `todayItems → itemIcon → todayItems` import-kör bezárulna.
// ============================================================
import type { HabitChainInfo, HabitDaypart } from '@/data/types'

export const DAYPART_EMOJI: Record<HabitDaypart, string> = { MORNING: '🌅', DAY: '☀️', EVENING: '🌙' }

/** 1. fok — a beépített szokások saját ikonja. Kulcs = `HabitItem.key`. */
const HABIT_ICON: Record<string, string> = {
  pushups: '💪',
  morning_video: '🎬',
  mushroom_coffee: '☕',
  morning_workout: '🤸',
  protein_breakfast: '🍳',
  weigh_in: '⚖️',
  sunlight: '🌞',
  water: '💧',
  caffeine_cutoff: '☕',
  kitchen_closed: '🍽️',
  wind_down: '📵',
  evening_ritual: '🕯️',
  intention_check: '✍️',
  reading: '📖',
  meditation: '🧘',
  stretch: '🤸',
}

/** 2. fok — a nyolc `LifeSkillKey`. Mindegyik KÜLÖNBÖZŐ emojit kap. */
const SKILL_ICON: Record<string, string> = {
  mindfulness: '🧘',
  mindset: '🧠',
  cooking: '🍳',
  financial: '💰',
  productivity: '⚡',
  learning: '📚',
  connection: '🤝',
  recovery: '🛌',
}

export function habitIcon(habitKey: string, chain: HabitChainInfo): string {
  const curated = HABIT_ICON[habitKey]
  if (curated) return curated
  const skillKey = chain.defs.find((d) => d.habitKey === habitKey)?.skillKey
  const bySkill = skillKey ? SKILL_ICON[skillKey] : undefined
  if (bySkill) return bySkill
  return DAYPART_EMOJI[chain.daypart]
}
