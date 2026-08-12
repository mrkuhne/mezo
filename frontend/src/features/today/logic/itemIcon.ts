// ============================================================
// Mezo · itemIcon — a habit-sorok ikonja (mezo-e26w). A régi viselkedés minden
// lánc minden sorára a NAPSZAK emojiját tette, amitől öt egyforma 🌅 állt a
// reggeli rutinban. A létra három fokú, és mindig ad találatot:
//   1. `habitKey` → kurált tábla — a TELJES beépített katalógus (9 MORNING + 6
//      EVENING, mirrors `@/data/habit/habitMock`'s `mockHabitCatalog` és a
//      valódi backend seedet, content/habit-catalog.json). Minden seed-kulcs
//      itt van, mindegyik EGYEDI ikonnal — a 2. fokra csak user-létrehozta vagy
//      AI-javasolt szokás juthat (a seedben nem szereplő `habitKey`).
//   2. `skillKey` → a life-skill emojija — a `LifeSkillKey` ZÁRT, 8 értékű enum,
//      tehát minden jövőbeli, AI-generált szokásra is van értelmes találat
//   3. napszak-emoji — a régi viselkedés, végső tartalékként
// Pure: no React, no hooks, no side effects.
// A `DAYPART_EMOJI` innen exportálódik (nem a `todayItems`-ből), különben a
// `todayItems → itemIcon → todayItems` import-kör bezárulna.
// ============================================================
import type { HabitChainInfo, HabitDaypart } from '@/data/types'

export const DAYPART_EMOJI: Record<HabitDaypart, string> = { MORNING: '🌅', DAY: '☀️', EVENING: '🌙' }

/** 1. fok — a TELJES beépített katalógus (9 MORNING + 6 EVENING, mirrors
 *  `mockHabitCatalog` / a backend `content/habit-catalog.json` seedet). Kulcs =
 *  `HabitItem.key` = `HabitDefInfo.habitKey`. Minden ikon EGYEDI — nincs
 *  szándékos átfedés (a `itemIcon.test.ts` regresszió-tesztje ezt őrzi). */
const HABIT_ICON: Record<string, string> = {
  wake_on_time: '⏰',
  morning_sunlight: '🌞',
  morning_pushups: '💪',
  morning_video: '🎬',
  morning_weigh_in: '⚖️',
  morning_coffee: '☕',
  morning_workout: '🤸',
  protein_breakfast: '🍳',
  daily_intention: '🎯',
  caffeine_cutoff: '🚫',
  kitchen_close: '🍽️',
  intention_reflect: '✍️',
  evening_ritual: '🕯️',
  wind_down: '📵',
  bed_on_time: '🛏️',
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
