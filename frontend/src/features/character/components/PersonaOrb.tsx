import { Boop } from '@/shared/ui/clay/boop/Boop'
import { cn } from '@/shared/lib/cn'
import { personaCharacter } from '@/features/character/personaCharacter'

/**
 * A szakértő arca. Üvegesítés U9 (mezo-me75u.9): a csapatfal öt szereplőjének (+ Szkeptikus)
 * figurája a karakter akcentusú, megvilágított kútban (`tf-av`, boop-world.css) — ugyanaz az arc,
 * amit a fal és A csapat mutat. A régi agyag-jelvény megszűnt; az API (`expertKey`) változatlan.
 */
export function PersonaOrb({ expertKey, size = 24, className }: { expertKey: string; size?: number; className?: string }) {
  const who = personaCharacter(expertKey)
  return (
    <span className={cn('tf-av', `tf-c-${who.accent}`, 'kr-persona', className)} style={{ width: size, height: size }}
      data-character={who.id} aria-hidden="true">
      <Boop domain={who.boop} size={Math.round(size * 0.8)} alive />
    </span>
  )
}
