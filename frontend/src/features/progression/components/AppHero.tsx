import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useDailyQuests, useGamification, useProfile, useTitles } from '@/data/hooks'
import { StreakSheet } from '@/features/progression/sheets/StreakSheet'
import { TitleShopSheet } from '@/features/progression/sheets/TitleShopSheet'
import { localDateString } from '@/shared/lib/dates'

const RING_R = 28
const RING_C = 2 * Math.PI * RING_R

/** The unified identity header on all 4 main tabs (spec §3). Per-tab controls arrive
 *  via `utilities` (Today: search + Insights, Me: settings). */
export function AppHero({ utilities }: { utilities?: ReactNode }) {
  const { user } = useProfile()
  const { profile } = useGamification()
  const { titles } = useTitles()
  const { quests } = useDailyQuests(localDateString())
  const [sheet, setSheet] = useState<'titles' | 'streak' | null>(null)

  const initials = user.name.split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2)
  const activeTitle = titles.find((t) => t.equipped)
  const done = quests.filter((q) => q.status === 'completed').length
  const progress = profile.xpForNext > 0 ? profile.xpInLevel / profile.xpForNext : 0

  return (
    <>
      <div className="apphero">
        {/* Two sibling links, not nested (invalid HTML): avatar → /me, level badge → /me/growth (spec §3.1). */}
        <div className="avwrap">
          <Link to="/me" className="avlink np-press" aria-label="Profil">
            <svg viewBox="0 0 62 62" width="62" height="62" aria-hidden="true">
              <circle cx="31" cy="31" r={RING_R} fill="none" stroke="var(--line)" strokeWidth="3.5" />
              <circle
                cx="31" cy="31" r={RING_R} fill="none" stroke="var(--coral)" strokeWidth="3.5"
                strokeLinecap="round" strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - progress)}
                transform="rotate(-90 31 31)"
              />
            </svg>
            <span className="avatar" aria-hidden="true">{initials}</span>
          </Link>
          <Link to="/me/growth" className="lvbadge np-press" aria-label={`Szint ${profile.level} — Growth`}>
            {profile.level}
          </Link>
        </div>
        <div>
          <Link to="/me" className="t1">{user.name}</Link>
          <button type="button" className="t2 np-press" onClick={() => setSheet('titles')}>
            {activeTitle?.name ?? ''}
          </button>
        </div>
        {utilities && <div className="util">{utilities}</div>}
      </div>
      <div className="apphero-chips">
        <button type="button" className="apphero-chip fire np-press" onClick={() => setSheet('streak')}>
          🔥 {profile.streakDays} nap
        </button>
        <Link to="/me/growth" className="apphero-chip quest np-press">
          ⚡ {done}/{quests.length} quest
        </Link>
        <button type="button" className="apphero-chip coin np-press" onClick={() => setSheet('titles')}>
          🪙 {profile.coins}
        </button>
      </div>
      {sheet === 'titles' && <TitleShopSheet onClose={() => setSheet(null)} />}
      {sheet === 'streak' && <StreakSheet onClose={() => setSheet(null)} />}
    </>
  )
}
