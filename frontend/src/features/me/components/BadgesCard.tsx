import type { CSSProperties } from 'react'
import type { GrowthBadge } from '@/data/types'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { huInt } from '@/shared/lib/huNum'
import { pct } from '@/shared/lib/pct'

/** The badges' 3D art (üveg, mezo-me75u.7 — prototype uveg-en2.html `BADGES`). The backend still
 *  sends an emoji `icon` (AchievementService); the page never shows it. Matched by key first, then
 *  by that emoji (a renamed key keeps its art), and an unknown badge falls back to the medal. */
const BADGE_ART_BY_KEY: Record<string, Icon3DName> = {
  first_quest: 't-flag', quests_10: 't-scroll', quests_50: 't-record', first_activity: 't-note',
  rhythm_4w: 't-flame', all_life_active: 't-gem', life_lv5: 't-brain', life_xp_10k: 't-peak',
  savings_100k: 't-coin',
}
const BADGE_ART_BY_EMOJI: Record<string, Icon3DName> = {
  '🏁': 't-flag', '📜': 't-scroll', '🎖️': 't-record', '🎖': 't-record', '✍️': 't-note', '✍': 't-note',
  '🔥': 't-flame', '🌈': 't-gem', '🧠': 't-brain', '🏛️': 't-peak', '🏛': 't-peak', '💰': 't-coin',
}
export const badgeArt = (b: Pick<GrowthBadge, 'key' | 'icon'>): Icon3DName =>
  BADGE_ART_BY_KEY[b.key] ?? BADGE_ART_BY_EMOJI[b.icon] ?? 't-record'

/** Badge grid (mezo-rmi0.1; üveg mezo-me75u.7): flat cells, each a glowing sage progress ring
 *  (--v = current/target %) around the badge's 3D art; earned = full ring + t-tick "megvan",
 *  unearned = dimmed cell with the count — reachable badges stay visible. */
export function BadgesCard({ badges }: { badges: GrowthBadge[] }) {
  const done = badges.filter((b) => b.achieved).length
  return (
    <>
      <div className="gr-h3 rise" style={{ '--d': '110ms' } as CSSProperties}>
        <span className="mz-eyebrow">Jelvények</span>
        <span className="gr-h3-em">{done} / {badges.length} megszerezve</span>
      </div>
      <div className="gr-bdggrid rise" style={{ '--d': '140ms' } as CSSProperties}>
        {badges.map((b) => {
          const v = b.achieved ? 100 : Math.round(pct(b.current, b.target))
          return (
            <div key={b.key} className={b.achieved ? 'gr-bdg done' : 'gr-bdg'}>
              <div className="gr-ring" style={{ '--v': v } as CSSProperties}>
                <svg viewBox="0 0 54 54" aria-hidden="true" className="uv-ring">
                  <circle className="uv-ring-track" cx="27" cy="27" r="24" pathLength={100} />
                  {v > 0 && <circle className="uv-ring-prog" cx="27" cy="27" r="24" pathLength={100} strokeDasharray={`${v} 100`} />}
                </svg>
                <Icon3D name={badgeArt(b)} size={28} className="gr-bdg-art" />
              </div>
              <b>{b.name}</b>
              <small>{b.achieved
                ? <><Icon3D name="t-tick" size={12} className="gr-bdg-tick" />megvan</>
                : `${huInt(b.current)} / ${huInt(b.target)}`}</small>
            </div>
          )
        })}
      </div>
    </>
  )
}
