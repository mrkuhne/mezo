// ============================================================
// Mezo · GrowthHubPage (mezo-rmi0.1) — the Growth hub, prototype growth-tab.html hub panel
// ×1.18 (spec docs/superpowers/specs/2026-09-02-growth-hub-design.md §2). Replaces the
// segment-switch GrowthPage: hero (GrowthHero) → Ma strip (MaStrip) → 2×2 mosaic whose
// lines come from each sub-page's OWN hook (undefined while unresolved, never 0/—). The
// four tiles open flat sibling routes (Karakter idiom); the legacy `?tab=` deep links
// redirect to them. Every hook, mutation and honest-state rule is verbatim — only the
// face changed (ADR 0033). ADR 0010: XP is feedback, nothing here gates or counts down.
// ============================================================
import type { CSSProperties } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import {
  useAchievements, useActivityHistory, useGamification, useProgressionProfile, useQuestHistory,
} from '@/data/hooks'
import { STREAK_MILESTONE_COINS } from '@/data/gamification/gamificationStore'
import { GHOST_GAMIFICATION } from '@/data/gamification/gamificationMock'
import { GrowthHero } from '@/features/me/components/GrowthHero'
import { MaStrip } from '@/features/me/components/MaStrip'
import { growthStats } from '@/features/me/logic/growthStats'
import { Icon3D } from '@/shared/ui/clay'
import { Mosaic, MozaikPage, PageBody, PageHead, Tile } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { addDays, localDateString } from '@/shared/lib/dates'

export const TAB_REDIRECT: Record<string, string> = {
  skills: '/me/growth/skillek', routines: '/nap/rutin/epites', journal: '/me/growth/naplo', awards: '/me/growth/kituntetesek',
}
const MILESTONES = Object.keys(STREAK_MILESTONE_COINS).map(Number).sort((a, b) => a - b)
const PULSE_WINDOW_DAYS = 10

export function GrowthHubPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const legacy = params.get('tab')
  const { data: profile } = useProgressionProfile()
  const { profile: gam } = useGamification()
  const { data: achievements } = useAchievements()
  const today = localDateString()
  const from = addDays(today, -29)
  const { data: quests, isPending: questsPending } = useQuestHistory(from, today)
  const { data: activities, isPending: activitiesPending } = useActivityHistory(from, today)

  if (legacy && TAB_REDIRECT[legacy]) return <Navigate to={TAB_REDIRECT[legacy]} replace />

  const stats = growthStats(profile)
  // The gamification level row only when the profile is a real one (ghost = switch off / unresolved).
  const level = gam === GHOST_GAMIFICATION ? null : { level: gam.level, xpInLevel: gam.xpInLevel, xpForNext: gam.xpForNext }

  const skillLine = stats.skillCount > 0 ? <><b>{stats.skillCount} skill</b> · legjobb Lv {stats.bestLevel}</> : undefined
  const completed = quests.filter((q) => q.status === 'completed').length
  const naploLine = (questsPending || activitiesPending) ? undefined : (
    <><b>{completed}<Icon3D name="t-tick" size={15} className="uv-inline uv-after" /><span className="sr-only"> teljesített</span></b>
      {' · '}{activities.length}<Icon3D name="t-pencil" size={15} className="uv-inline uv-after" /><span className="sr-only"> tevékenység</span>
      {' '}<span className="mz-mut">· 30 nap</span></>
  )
  const done = achievements.badges.filter((b) => b.achieved).length
  const kitLine = achievements.badges.length > 0
    ? <><b>{done} / {achievements.badges.length}</b> jelvény · <b>{gam.streakDays}</b> napos sorozat</>
    : undefined
  const nextMilestone = MILESTONES.find((m) => m > gam.streakDays)
  const pulse = nextMilestone != null && nextMilestone - gam.streakDays <= PULSE_WINDOW_DAYS

  return (
    <MozaikPage tone="gold">
      <PageHead glass history fallback="/me" label="Hol tartok" />
      <PageBody>
        <EntranceGroup>
          <GrowthHero totalXp={stats.totalXp} level={level} disciplinePct={profile.traits?.disciplinePct ?? null}
            consistencyWeeks={profile.traits?.consistencyWeeks ?? 0} />
          <MaStrip />
          <Mosaic className="mt-md">
            {/* Skillek + Kitüntetések are composed by hand (the Kitüntetések pulse dot sits in the
                tile top). Their art is 3D since U11 (mezo-me75u.11): the sprout (the old s-hajtas
                spot, a skill growing — t-quest would read as the küldetés chips above) and
                t-record (the Kitüntetések page's own hero). */}
            <button type="button" className="mz-tile glass gr-tile rise" style={{ '--d': '170ms', '--c': 'var(--dv-lav)' } as CSSProperties}
              aria-label="Skillek" onClick={() => navigate('/me/growth/skillek')}>
              <div className="mz-tile-top"><span className="mz-eyebrow">Skillek</span></div>
              <div className="mz-spotwrap"><Icon3D name="t-sprout" size={50} /></div>
              {skillLine !== undefined && <div className="mz-tile-line gr-tile-line">{skillLine}</div>}
            </button>
            <Tile wash="sky" art="t-journal" iconSize={47} eyebrow="Tevékenységek" delayMs={270} className="glass gr-tile gr-tile-line gr-tile-sky"
              line={naploLine} onClick={() => navigate('/me/growth/naplo')} aria-label="Tevékenységek" />
            <button type="button" className="mz-tile glass gr-tile rise" style={{ '--d': '320ms', '--c': 'var(--dv-sage)' } as CSSProperties}
              aria-label="Kitüntetések" onClick={() => navigate('/me/growth/kituntetesek')}>
              <div className="mz-tile-top"><span className="mz-eyebrow">Kitüntetések</span>{pulse && <span className="gr-pulse" aria-hidden="true" />}</div>
              <div className="mz-spotwrap"><Icon3D name="t-record" size={52} /></div>
              {kitLine !== undefined && <div className="mz-tile-line gr-tile-line">{kitLine}</div>}
            </button>
          </Mosaic>
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
