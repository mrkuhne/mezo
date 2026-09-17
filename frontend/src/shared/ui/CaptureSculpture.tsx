import { cn } from '@/shared/lib/cn'
import '@/shared/ui/capture.css'

export type CaptureKind = 'food' | 'water' | 'stack' | 'training' | 'sport' | 'weight' | 'checkin' | 'journal' | 'sleep' | 'chat'

/** Decorative, code-native metallic forms. No domain state or invented measurements. */
export function CaptureSculpture({ kind, className }: { kind: CaptureKind; className?: string }) {
  return <span className={cn('capture-sculpture', `capture-art-${kind}`, className)} aria-hidden="true"><i /><b /><i /></span>
}
