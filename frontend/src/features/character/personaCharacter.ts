/**
 * Üvegesítés U9 (mezo-me75u.9, owner 2026-09-25): a Karakter/Konzílium/Gépterem felületein a régi
 * kilenc szakértő helyett a csapatfal öt szereplője (+ a Szkeptikus) jelenik meg — ugyanaz a
 * leképezés, amit a fal már használ (`characterForPersona`, features/insights/logic/team.ts).
 * Csak MEGJELENÍTÉS: a backend továbbra is a persona-kulcsokat küldi, és a hívások, döntések,
 * kulcsok (`expertKey`) változatlanok.
 */
import { TEAM, characterForPersona, type TeamCharacter } from '@/features/insights/logic/team'

export function personaCharacter(expertKey: string | null | undefined): TeamCharacter {
  return TEAM[characterForPersona(expertKey ?? 'mezo')]
}

/** A kártyán kiírt név — „Derű”, nem „Doki”. */
export function personaName(expertKey: string | null | undefined): string {
  return personaCharacter(expertKey).name
}
