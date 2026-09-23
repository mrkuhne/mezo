// ============================================================
// Mezo · habitClayIcon — a szokás SAJÁT clay-ikonja (mezo-d20.11).
// A Nap-hub rutin-csempéje és a Rutin-oldal sorai a prototípusban
// (nap-body.html `data-habicon`, #page-hab `items[].i`) NEM egy fix
// „rutin" ikont hordanak, hanem a soron következő szokás ikonját —
// a csempe így egyetlen pillantásra megmondja, MIT kell csinálni.
// A létra ugyanaz a három fok, mint az emoji-s `itemIcon.ts`-é:
//   1. `habitKey` → a beépített katalógus (9 MORNING + 6 EVENING),
//   2. `skillKey` → a nyolc `LifeSkillKey` (AI-javasolt szokásokra is),
//   3. napszak-ikon — végső tartalék, mindig ad találatot.
// Pure: no React, no hooks, no side effects.
// ============================================================
import type { ClayIconName, Icon3DName } from '@/shared/ui/clay'
import type { HabitChainInfo, HabitDaypart } from '@/data/types'

/** 1. fok — a teljes beépített katalógus (mirrors `itemIcon.ts`'s HABIT_ICON keys). */
const HABIT_CLAY: Record<string, ClayIconName> = {
  wake_on_time: 'i-hajnal',
  morning_sunlight: 'i-nap',
  morning_pushups: 'i-edzes',
  morning_video: 'i-video',
  morning_weigh_in: 'i-suly',
  morning_coffee: 'i-fuel',
  morning_workout: 'i-sport',
  protein_breakfast: 'i-reggeli',
  daily_intention: 'i-cel',
  caffeine_cutoff: 'i-idozito',
  kitchen_close: 'i-kamra',
  intention_reflect: 'i-naplo',
  evening_ritual: 'i-lang',
  wind_down: 'i-rend',
  bed_on_time: 'i-alvas',
}

/** A kurált tábla kulcsai — a katalógus-drift regressziótesztjének fogódzója. */
export const CURATED_HABIT_KEYS: readonly string[] = Object.keys(HABIT_CLAY)

/** 2. fok — a nyolc `LifeSkillKey`. */
const SKILL_CLAY: Record<string, ClayIconName> = {
  mindfulness: 'i-eletjel',
  mindset: 'i-kristaly',
  cooking: 'i-recept',
  financial: 'i-erme',
  productivity: 'i-rend',
  learning: 'i-tudas',
  connection: 'i-emberek',
  recovery: 'i-alvas',
}

/** 3. fok — napszak. */
export const DAYPART_CLAY: Record<HabitDaypart, ClayIconName> = {
  MORNING: 'i-hajnal', DAY: 'i-nap', EVENING: 'i-alvas',
}

export function habitClayIcon(habitKey: string, chain: HabitChainInfo): ClayIconName {
  const curated = HABIT_CLAY[habitKey]
  if (curated) return curated
  const skillKey = chain.defs.find((d) => d.habitKey === habitKey)?.skillKey
  const bySkill = skillKey ? SKILL_CLAY[skillKey] : undefined
  if (bySkill) return bySkill
  return DAYPART_CLAY[chain.daypart]
}

/**
 * Üveg (mezo-me75u.3, prototypes/uveg-nap.html `rutin()`): a Rutin-sor 3D ikonja. A clay-név a
 * közös `CLAY_TO_3D`-n át megy (ContentIcon), KIVÉVE ahol a clay-glifa itt mást jelent, mint a
 * közös térképben (bible U1 7. szabály: a jelentést térképezzük, nem a glifát):
 *   morning_workout  i-sport   → t-run      (a futó alak, nem a sport-labda)
 *   protein_breakfast i-reggeli → t-protein (fehérje, nem a reggeli napja)
 *   evening_ritual   i-lang    → t-moon     (az esti rituálé, nem az energia-villám)
 *   wind_down        i-rend    → t-sleep    (lecsendesedés, nem a lánc)
 */
const HABIT_3D: Record<string, Icon3DName> = {
  morning_workout: 't-run',
  protein_breakfast: 't-protein',
  evening_ritual: 't-moon',
  wind_down: 't-sleep',
}

/** A Rutin-sor tartalom-ikonja: a hívóhelyi 3D név, különben a szokás clay-neve (a ContentIcon
 *  fordítja 3D-re). `chain` hiányában a napszak-ikon. */
export function habitContentIcon(
  habitKey: string, chain: HabitChainInfo | undefined, daypart: HabitDaypart,
): ClayIconName | Icon3DName {
  return HABIT_3D[habitKey] ?? (chain ? habitClayIcon(habitKey, chain) : DAYPART_CLAY[daypart])
}
