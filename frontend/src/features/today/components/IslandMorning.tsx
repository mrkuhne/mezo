// ============================================================
// Mezo · IslandMorning — the morning island's big view (mezo-euze).
// L0 is hero + facts + one CTA, nothing else: no greeting, no status
// eyebrow (v3 decision) — the island's identity is its position and
// blob. The briefing prose lives at the TOP of the L1 list as a
// CoachBubble (BriefingCard reused), the creed under a Fókusz group
// (IntentionBanner reused). The promoted CTA is the chain's first
// open step; `még N ›` unfolds L1.
// ============================================================
import type { Briefing } from '@/data/types'
import { BriefingCard } from '@/features/today/components/BriefingCard'
import type { ChainCelebrationInput } from '@/features/today/components/ChainCelebrations'
import { ChainCelebrations } from '@/features/today/components/ChainCelebrations'
import { IntentionBanner } from '@/features/today/components/IntentionBanner'
import { IslandFactsStrip } from '@/features/today/components/IslandFactsStrip'
import { IslandList } from '@/features/today/components/IslandList'
import type { GrowthTodaySummary } from '@/features/today/logic/growthToday'
import type { IslandFact, IslandHero } from '@/features/today/logic/islandFacts'
import type { TodayItem } from '@/features/today/logic/todayItems'

export interface IslandMorningProps {
  hero: IslandHero
  facts: IslandFact[]
  /** The promoted first open chain step — the island's ONE CTA. */
  next: TodayItem | null
  open: TodayItem[]
  done: TodayItem[]
  doneXp: number
  listOpen: boolean
  onToggleList: (open: boolean) => void
  briefing: Briefing
  briefingDemo?: boolean
  celebrations: ChainCelebrationInput[]
  growth?: GrowthTodaySummary | null
  habitPending?: boolean
  onAct: (item: TodayItem) => void
}

export function IslandMorning({
  hero, facts, next, open, done, doneXp, listOpen, onToggleList,
  briefing, briefingDemo, celebrations, growth, habitPending, onAct,
}: IslandMorningProps) {
  const restCount = open.length - (next ? 1 : 0)

  if (listOpen) {
    return (
      <>
        <ChainCelebrations chains={celebrations} />
        <div className="isl-openhead">🌅 Reggel</div>
        <IslandList
          open={open}
          done={done}
          doneHeading="Kész ma"
          head={<BriefingCard briefing={briefing} demo={briefingDemo} />}
          focus={<IntentionBanner variant="chip" />}
          growth={growth}
          habitPending={habitPending}
          onAct={onAct}
          onClose={() => onToggleList(false)}
        />
      </>
    )
  }

  return (
    <>
      <ChainCelebrations chains={celebrations} />
      <div className="isl-hero-v">
        {hero.value}
        <span className="isl-hero-u">{hero.unit}</span>
      </div>
      {hero.sub && <div className="isl-hero-sub">{hero.sub}</div>}
      <IslandFactsStrip facts={facts} />
      <div className="isl-act">
        {next && (
          <button
            type="button"
            className="isl-cta np-press"
            disabled={habitPending && next.action?.kind === 'habit'}
            onClick={() => onAct(next)}
          >
            {next.title}
          </button>
        )}
        {restCount > 0 && (
          <button type="button" className="isl-more" onClick={() => onToggleList(true)}>
            még {restCount} ›
          </button>
        )}
      </div>
      {done.length > 0 && (
        <button type="button" className="isl-doneline" onClick={() => onToggleList(true)}>
          ✓ {done.length} kész ma · +{doneXp} XP
        </button>
      )}
    </>
  )
}
