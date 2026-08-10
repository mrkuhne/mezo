// ============================================================
// Mezo · ViewMorning — the morning daypart's view (mezo-puci), the
// IslandMorning successor. Two things the island had are gone on
// purpose: the promoted chain CTA (the step is right there as a row —
// the button was a duplicate) and the briefing head (it moved up into
// the standing MezoMessage band). What is left is the whole morning,
// visible at once: hero, facts, every row, the creed, the done fold.
// ============================================================
import type { ChainCelebrationInput } from '@/features/today/components/ChainCelebrations'
import { ChainCelebrations } from '@/features/today/components/ChainCelebrations'
import { DayGroups } from '@/features/today/components/DayGroups'
import { DayHeroLine, DayView } from '@/features/today/components/DayView'
import { IntentionBanner } from '@/features/today/components/IntentionBanner'
import { IslandFactsStrip } from '@/features/today/components/IslandFactsStrip'
import type { GrowthTodaySummary } from '@/features/today/logic/growthToday'
import type { IslandFact, IslandHero } from '@/features/today/logic/islandFacts'
import type { TodayItem } from '@/features/today/logic/todayItems'

export interface ViewMorningProps {
  hero: IslandHero
  facts: IslandFact[]
  open: TodayItem[]
  done: TodayItem[]
  doneXp: number
  celebrations: ChainCelebrationInput[]
  growth?: GrowthTodaySummary | null
  habitPending?: boolean
  onAct: (item: TodayItem) => void
}

export function ViewMorning({
  hero, facts, open, done, doneXp, celebrations, growth, habitPending, onAct,
}: ViewMorningProps) {
  return (
    <DayView tone="reggel">
      <ChainCelebrations chains={celebrations} />
      <DayHeroLine value={hero.value} unit={hero.unit} sub={hero.sub} />
      <IslandFactsStrip facts={facts} />
      <DayGroups
        open={open}
        done={done}
        doneLabel={`✓ ${done.length} kész ma · +${doneXp} XP`}
        focus={<IntentionBanner variant="chip" />}
        growth={growth}
        habitPending={habitPending}
        onAct={onAct}
      />
    </DayView>
  )
}
