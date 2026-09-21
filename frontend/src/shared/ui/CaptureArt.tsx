import { cn } from '@/shared/lib/cn'
import { ClayIcon, type ClayIconName } from '@/shared/ui/clay'
import '@/shared/ui/capture.css'

export type CaptureKind = 'food' | 'water' | 'stack' | 'training' | 'sport' | 'weight' | 'checkin' | 'journal' | 'sleep' | 'chat'

/** Capture kind → its clay symbol. The Titanium metal sculptures this replaced are retired
 * (owner, 2026-09-21, mezo-reocc): every capture surface wears the same clay art as the rest of
 * the app (style bible §6), so a tile and the sheet it opens show one and the same mark. */
const ART: Record<CaptureKind, ClayIconName> = {
  food: 'i-fuel', water: 'i-viz', stack: 'i-stack', training: 'i-edzes', sport: 'i-sport',
  weight: 'i-suly', checkin: 'i-checkin', journal: 'i-naplo', sleep: 'i-alvas', chat: 'i-mezo',
}

/** Decorative capture mark (aria-hidden via ClayIcon). No domain state or invented measurements. */
export function CaptureArt({ kind, size = 68, className }: { kind: CaptureKind; size?: number; className?: string }) {
  return <ClayIcon name={ART[kind]} size={size} className={cn('capture-art', `capture-art-${kind}`, className)} />
}
