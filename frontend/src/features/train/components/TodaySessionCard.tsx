// ============================================================
// Mezo · TodaySessionCard — one scheduled session of the selected day on
// Train's Mai. Since mezo-jyua this is a thin wrapper over the shared
// `ItemCard`: the card language moved to `shared/ui` so Today and Train
// render the same card. Kept as a named seam so Train's call sites keep
// their session vocabulary (`SessionTone`) instead of the broader `ItemTone`.
// ============================================================
import { ItemCard } from '@/shared/ui/ItemCard'
import type { SessionTone } from '@/features/train/logic/sportKinds'

interface TodaySessionCardProps {
  tone: SessionTone
  emoji: string
  tag: string
  time?: string | null
  title: string
  facts: readonly (string | null | undefined | false)[]
  logged: boolean
  loggedSummary?: string
  loggedDetail?: string | null
  stateLabel?: string | null
  ctaLabel?: string
  onLog?: () => void
}

export function TodaySessionCard(props: TodaySessionCardProps) {
  return <ItemCard {...props} />
}
