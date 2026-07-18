import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useDailyQuests, useGamification, useProfile, useTitles } from '@/data/hooks'
import { StreakSheet } from '@/features/progression/sheets/StreakSheet'
import { TitleShopSheet } from '@/features/progression/sheets/TitleShopSheet'
import { localDateString } from '@/shared/lib/dates'

const RING_R = 22
const RING_C = 2 * Math.PI * RING_R

/** The unified identity header on all 5 sections — one sticky avatar-height row
 *  (compact-header spec §3). Per-section content arrives via `utilities`
 *  (SubNavDropdown on Train/Fuel/Me/Insights; search + Insights link on Today). */
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
        {/* Two sibling links, not nested (invalid HTML): avatar → /me, level badge → /me/growth. */}
        <div className="avwrap">
          <Link to="/me" className="avlink np-press" aria-label="Profil">
            <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
              <circle cx="24" cy="24" r={RING_R} fill="none" stroke="var(--line)" strokeWidth="3" />
              <circle
                cx="24" cy="24" r={RING_R} fill="none" stroke="var(--coral)" strokeWidth="3"
                strokeLinecap="round" strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - progress)}
                transform="rotate(-90 24 24)"
              />
            </svg>
            <span className="avatar" aria-hidden="true">{initials}</span>
          </Link>
          <Link to="/me/growth" className="lvbadge np-press" aria-label={`Szint ${profile.level} — Growth`}>
            {profile.level}
          </Link>
        </div>
        <div className="idcol">
          <Link to="/me" className="t1">{user.name}</Link>
          <button type="button" className="t2 np-press" onClick={() => setSheet('titles')}>
            {activeTitle?.name ?? ''}
          </button>
        </div>
        <div className="counters">
          <button
            type="button" className="cnt fire np-press"
            aria-label={`${profile.streakDays} napos sorozat`}
            onClick={() => setSheet('streak')}
          >
            🔥 {profile.streakDays}
          </button>
          <Link
            to="/me/growth" className="cnt quest np-press"
            aria-label={`${done}/${quests.length} napi quest`}
          >
            ⚡ {done}/{quests.length}
          </Link>
          <button
            type="button" className="cnt coin np-press"
            aria-label={`${profile.coins} érme`}
            onClick={() => setSheet('titles')}
          >
            🪙 {profile.coins}
          </button>
        </div>
        {utilities && <div className="util">{utilities}</div>}
      </div>
      {sheet === 'titles' && <TitleShopSheet onClose={() => setSheet(null)} />}
      {sheet === 'streak' && <StreakSheet onClose={() => setSheet(null)} />}
    </>
  )
}
