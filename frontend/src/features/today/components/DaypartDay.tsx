// ============================================================
// Mezo · DaypartDay — the day daypart's view (mezo-puci), the IslandDay
// successor. The hero is the day's session (`13:00 · Pull A`), rest
// days read `Pihenő` with the `Saját edzés` CTA; the niggle warning
// survives as the one safety chip. The `DayHero` shape lives here now
// (it moved from the retired IslandDay, unchanged) — TodayPage's
// `heroCardOf` builds it, so the row and the hero stay one object.
// ============================================================
import type { CompanionNote } from '@/data/types'
import type { ItemTone } from '@/shared/ui/ItemCard'
import type { ChainCelebrationInput } from '@/features/today/components/ChainCelebrations'
import { ChainCelebrations } from '@/features/today/components/ChainCelebrations'
import { CompanionNoteCard } from '@/features/today/components/CompanionNoteCard'
import { DayGroups } from '@/features/today/components/DayGroups'
import { DaypartHero, DaypartPanel } from '@/features/today/components/DaypartPanel'
import { IntentionBanner } from '@/features/today/components/IntentionBanner'
import { IslandFactsStrip } from '@/features/today/components/IslandFactsStrip'
import type { GrowthTodaySummary } from '@/features/today/logic/growthToday'
import type { IslandFact } from '@/features/today/logic/islandFacts'
import type { TodayItem } from '@/features/today/logic/todayItems'

/** The day's hero session, shaped by TodayPage — one session authored once (heroCardOf). */
export interface DayHero {
  tone: ItemTone
  emoji: string
  tag: string
  time: string | null
  title: string
  facts: (string | null | undefined | false)[]
  logged: boolean
  loggedSummary?: string
  ctaLabel?: string
  onLog?: () => void
}

export interface DaypartDayProps {
  hero: DayHero | null
  heroWarn?: string | null
  facts: IslandFact[]
  mesoLine: string | null
  open: TodayItem[]
  done: TodayItem[]
  doneXp: number
  note: CompanionNote | null
  celebrations: ChainCelebrationInput[]
  growth?: GrowthTodaySummary | null
  habitPending?: boolean
  onAct: (item: TodayItem) => void
  onCustom: () => void
}

export function DaypartDay({
  hero, heroWarn, facts, mesoLine, open, done, doneXp, note, celebrations,
  growth, habitPending, onAct, onCustom,
}: DaypartDayProps) {
  const durationFact = hero?.facts.find((f) => typeof f === 'string' && /perc|′/.test(f))
  const heroUnit = hero ? `${hero.title}${durationFact ? ` · ${durationFact}` : ''}` : 'nap'

  return (
    <DaypartPanel tone="nap">
      <ChainCelebrations chains={celebrations} />
      <DaypartHero
        value={hero ? hero.time ?? '—' : 'Pihenő'}
        unit={heroUnit}
        sub={hero ? mesoLine : 'Ma nincs tervezett edzés'}
      />
      <IslandFactsStrip facts={facts} />
      {heroWarn && <div className="isl-warnchip">⚠️ {heroWarn}</div>}
      <div className="dv-act">
        {hero ? (
          <button type="button" className="isl-cta np-press" onClick={() => hero.onLog?.()}>
            {hero.ctaLabel ?? 'Indítsuk'}
          </button>
        ) : (
          <button type="button" className="isl-cta np-press" onClick={onCustom}>
            Saját edzés
          </button>
        )}
      </div>
      <DayGroups
        open={open}
        done={done}
        doneLabel={`✓ ${done.length} kész ma · +${doneXp} XP`}
        head={note ? <CompanionNoteCard note={note} /> : undefined}
        focus={<IntentionBanner variant="chip" />}
        growth={growth}
        habitPending={habitPending}
        onAct={onAct}
      />
    </DaypartPanel>
  )
}
