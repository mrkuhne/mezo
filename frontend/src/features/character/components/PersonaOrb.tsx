import { Boop, type BoopDomain } from '@/shared/ui/clay/boop/Boop'
import { ClayIcon, type ClayIconName } from '@/shared/ui/clay'
import { cn } from '@/shared/lib/cn'

// The menu's five Boop families; a role mark identifies each of the nine experts.
const PERSONAS: Record<string, { domain: BoopDomain; badge: ClayIconName }> = {
  doki: { domain: 'nap', badge: 'i-eletjel' },
  edzo: { domain: 'train', badge: 'i-edzes' },
  drill: { domain: 'train', badge: 'i-cel' },
  taplalkozo: { domain: 'fuel', badge: 'i-noveny' },
  szomnologus: { domain: 'mezo', badge: 'i-hold' },
  szkeptikus: { domain: 'mezo', badge: 'i-tudas' },
  pszichologus: { domain: 'me', badge: 'i-life-tudatossag' },
  antropologus: { domain: 'me', badge: 'i-emberek' },
  mezo: { domain: 'mezo', badge: 'i-mezo' },
}

export function PersonaOrb({ expertKey, size = 24, className }: { expertKey: string; size?: number; className?: string }) {
  const persona = PERSONAS[expertKey] ?? PERSONAS.mezo
  const badgeSize = Math.max(12, Math.round(size * .4))
  return (
    <span className={cn('kr-persona', className)} style={{ width: size, height: size }} aria-hidden="true">
      <Boop domain={persona.domain} size={size} alive />
      <span className="kr-persona-badge" style={{ width: badgeSize, height: badgeSize }}>
        <ClayIcon name={persona.badge} size={badgeSize - 2} />
      </span>
    </span>
  )
}
