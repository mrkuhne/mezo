import { cn } from '@/shared/lib/cn'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import '@/shared/ui/capture.css'

export type CaptureKind =
  | 'food' | 'water' | 'stack' | 'training' | 'sport' | 'weight' | 'checkin' | 'journal' | 'sleep' | 'chat'
  | 'quick' | 'activity'

/** Capture kind → its Titanium 3D symbol (Üveg, mezo-me75u.3, bible §4). ONE map, so a quick-log
 * tile and the capture sheet it opens always wear the same mark (restored bible rule 28). The
 * meanings are fixed here, not through `CLAY_TO_3D`: `stack` is the supplements shelf (the clay
 * `i-stack` maps to the protocol glyph elsewhere), `sport` is the volleyball, `activity` the steps. */
export const CAPTURE_ART: Record<CaptureKind, Icon3DName> = {
  food: 't-bowl', water: 't-water', stack: 't-supps', training: 't-dumbbell', sport: 't-volley',
  weight: 't-weight', checkin: 't-checkin', journal: 't-journal', sleep: 't-sleep', chat: 't-chat',
  quick: 't-quick', activity: 't-steps',
}

/** Decorative capture mark (aria-hidden via Icon3D). No domain state or invented measurements. */
export function CaptureArt({ kind, size = 68, className }: { kind: CaptureKind; size?: number; className?: string }) {
  return <Icon3D name={CAPTURE_ART[kind]} size={size} className={cn('capture-art', `capture-art-${kind}`, className)} />
}
