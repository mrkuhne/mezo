// ============================================================
// Mezo · IslandDay — the day island's big view (mezo-euze). Hero is
// the session's time (`13:00 · Pull A · 55′`), rest days read `Pihenő`
// with the `Saját edzés` CTA. Facts: protein + energy from the fuel
// plan. The niggle warning survives as the ONE safety chip allowed on
// L0. The `DayHero` shape moved here from the retired FaceDay.
// ============================================================
import type { CompanionNote } from '@/data/types'
import type { ItemTone } from '@/shared/ui/ItemCard'
import type { ChainCelebrationInput } from '@/features/today/components/ChainCelebrations'
import { ChainCelebrations } from '@/features/today/components/ChainCelebrations'
import { CompanionNoteCard } from '@/features/today/components/CompanionNoteCard'
import { IntentionBanner } from '@/features/today/components/IntentionBanner'
import { IslandFactsStrip } from '@/features/today/components/IslandFactsStrip'
import { IslandList } from '@/features/today/components/IslandList'
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

export interface IslandDayProps {
  hero: DayHero | null
  heroWarn?: string | null
  facts: IslandFact[]
  mesoLine: string | null
  open: TodayItem[]
  done: TodayItem[]
  doneXp: number
  listOpen: boolean
  onToggleList: (open: boolean) => void
  note: CompanionNote | null
  celebrations: ChainCelebrationInput[]
  growth?: GrowthTodaySummary | null
  habitPending?: boolean
  onAct: (item: TodayItem) => void
  onCustom: () => void
}

export function IslandDay({
  hero, heroWarn, facts, mesoLine, open, done, doneXp, listOpen, onToggleList,
  note, celebrations, growth, habitPending, onAct, onCustom,
}: IslandDayProps) {
  if (listOpen) {
    return (
      <>
        <ChainCelebrations chains={celebrations} />
        <div className="isl-openhead">☀️ Nap</div>
        <IslandList
          open={open}
          done={done}
          doneHeading="Kész ma"
          head={note ? <CompanionNoteCard note={note} /> : undefined}
          focus={<IntentionBanner variant="chip" />}
          growth={growth}
          habitPending={habitPending}
          onAct={onAct}
          onClose={() => onToggleList(false)}
        />
      </>
    )
  }

  const durationFact = hero?.facts.find((f) => typeof f === 'string' && /perc|′/.test(f))
  return (
    <>
      <ChainCelebrations chains={celebrations} />
      {hero ? (
        <div className="isl-hero-v">
          {hero.time ?? '—'}
          <span className="isl-hero-u">
            {hero.title}
            {durationFact ? ` · ${durationFact}` : ''}
          </span>
        </div>
      ) : (
        <div className="isl-hero-v is-word">
          Pihenő
          <span className="isl-hero-u">nap</span>
        </div>
      )}
      <div className="isl-hero-sub">{hero ? mesoLine : 'Ma nincs tervezett edzés'}</div>
      <IslandFactsStrip facts={facts} />
      {heroWarn && <div className="isl-warnchip">⚠️ {heroWarn}</div>}
      <div className="isl-act">
        {hero ? (
          <button type="button" className="isl-cta np-press" onClick={() => hero.onLog?.()}>
            {hero.ctaLabel ?? 'Indítsuk'}
          </button>
        ) : (
          <button type="button" className="isl-cta np-press" onClick={onCustom}>
            Saját edzés
          </button>
        )}
        {open.length > 0 && (
          <button type="button" className="isl-more" onClick={() => onToggleList(true)}>
            még {open.length} ›
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
