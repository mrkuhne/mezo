// ============================================================
// Mezo · DaypartMorning — the morning daypart's view (mezo-puci), the
// IslandMorning successor. Two things the island had are gone on
// purpose: the promoted chain CTA (the step is right there as a row —
// the button was a duplicate) and the briefing head (it moved up into
// the standing MezoMessage band). What is left is the whole morning,
// visible at once: hero, facts, every row, the creed, the done fold.
// ============================================================
import type { ChainCelebrationInput } from '@/features/today/components/ChainCelebrations'
import { ChainCelebrations } from '@/features/today/components/ChainCelebrations'
import { DayGroups } from '@/features/today/components/DayGroups'
import { DaypartHero, DaypartPanel } from '@/features/today/components/DaypartPanel'
import { IntentionBanner } from '@/features/today/components/IntentionBanner'
import { TodayStats } from '@/features/today/components/TodayStats'
import type { IslandFact, IslandHero } from '@/features/today/logic/islandFacts'
import type { TodayItem } from '@/features/today/logic/todayItems'

export interface DaypartMorningProps {
  hero: IslandHero
  facts: IslandFact[]
  open: TodayItem[]
  done: TodayItem[]
  doneXp: number
  celebrations: ChainCelebrationInput[]
  habitPending?: boolean
  onAct: (item: TodayItem) => void
}

export function DaypartMorning({
  hero, facts, open, done, doneXp, celebrations, habitPending, onAct,
}: DaypartMorningProps) {
  return (
    <DaypartPanel tone="reggel">
      <ChainCelebrations chains={celebrations} />
      <DaypartHero value={hero.value} unit={hero.unit} sub={hero.sub} />
      <TodayStats facts={facts} />
      <DayGroups
        open={open}
        done={done}
        doneLabel={`✓ ${done.length} kész ma · +${doneXp} XP`}
        focus={<IntentionBanner variant="chip" />}
        habitPending={habitPending}
        onAct={onAct}
      />
    </DaypartPanel>
  )
}
