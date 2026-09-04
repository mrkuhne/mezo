// ============================================================
// Mezo · GrowthSkillsPage (mezo-rmi0.1) — /me/growth/skillek, prototype growth-tab.html
// #page-skillek ×1.18 (spec §3). Hero (s-hajtas spot + skill count) → StatStrip (LIFE
// Lv-átlag · Atléta-szint · Izom legjobb; null → —, the StatCell rule) → three parallel
// SkillBandCards, chips derived from band lengths (never the old 8/12/13 hardcode).
// No skill-detail page, no XP time series (the contract carries no series).
// ============================================================
import type { CSSProperties, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLifeGoals, useProgressionProfile } from '@/data/hooks'
import type { SkillLevel } from '@/data/progression/progressionApi'
import { MUSCLE_LABELS } from '@/data/train/train'
import { SkillBandCard, type SkillRowVM } from '@/features/me/components/SkillBandCard'
import { goalSkillChips } from '@/features/me/logic/goalSkillChips'
import { growthStats } from '@/features/me/logic/growthStats'
import { ATHLETIC_META, LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'
import { ClayIcon } from '@/shared/ui/clay'
import { MozaikPage, PageBody, PageHead, PageHero, StatCell, StatStrip } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { hu1, huInt } from '@/shared/lib/huNum'

const byLevelXpDesc = (a: SkillLevel, b: SkillLevel) => b.level - a.level || b.cumulativeXp - a.cumulativeXp
const initials = (name: string) => name.slice(0, 2)

function toRows(skills: SkillLevel[], iconOf: (key: string, name: string) => ReactNode, nameOf: (key: string) => string): SkillRowVM[] {
  return [...skills].sort(byLevelXpDesc).map((s) => {
    const name = nameOf(s.skillKey)
    return { key: s.skillKey, icon: iconOf(s.skillKey, name), name, level: s.level, progressPct: s.progressPct, xp: s.cumulativeXp }
  })
}

export function GrowthSkillsPage() {
  const navigate = useNavigate()
  const { data: profile } = useProgressionProfile()
  const life = profile.life ?? [], athletic = profile.athletic ?? [], muscle = profile.muscle ?? []
  const s = growthStats(profile)
  const lifeMeta = (k: string) => LIFE_SKILLS.find((x) => x.key === k)
  const savings = profile.savingsHuf30d
  // A goalchip (mezo-iizd.12) mindhárom sávra megy: a pillér `skillKey`-e a LIFE-taxonómián
  // KÍVÜLRE is mutathat (a jel-katalógus `weight_goal`/`gym_volume` bejegyzései például
  // `max_strength`/`aerobic_capacity` atlétikai skillt adnak).
  const { goals: lifeGoals } = useLifeGoals()
  const chips = goalSkillChips(lifeGoals)

  return (
    <MozaikPage tone="lav">
      <PageHead onBack={() => navigate('/me/growth')} label="‹ Growth" />
      <PageHero spot="s-hajtas" iconSize={54} big={s.skillCount} name="skill" />
      <PageBody principle="A szint visszajelzés, nem jutalom — semmi nem nyílik vagy zárul tőle. Az XP-idősort nem rajzoljuk: a contract nem hordoz sorozatot.">
        <EntranceGroup>
          <div className="rise" style={{ '--d': '0ms' } as CSSProperties}>
            <StatStrip>
              <StatCell value={s.lifeAvg != null ? hu1(s.lifeAvg) : '—'} label="LIFE Lv-átlag" />
              <StatCell value={profile.athleteLevel != null ? hu1(profile.athleteLevel) : '—'} label="Atléta-szint" />
              <StatCell value={s.muscleBest != null ? `Lv ${s.muscleBest}` : '—'} label="Izom legjobb" />
            </StatStrip>
          </div>
          {life.length > 0 && (
            <SkillBandCard delayMs={60} wash="lav" chipTone="lav" eyebrow="LIFE" chip={`${life.length} skill · ${huInt(s.lifeXp)} XP`}
              rows={toRows(life, (k, n) => { const m = lifeMeta(k); return m ? <ClayIcon name={m.clayIcon} size={16} /> : initials(n) }, (k) => lifeMeta(k)?.name ?? k)}
              footer={typeof savings === 'number' && savings > 0 ? <>Megtakarítás (30 nap) · <b>{huInt(savings)} Ft</b></> : undefined}
              goalChips={chips} />
          )}
          {athletic.length > 0 && (
            <SkillBandCard delayMs={120} wash="sage" chipTone="ok" eyebrow="Atlétikus"
              chip={`${athletic.length} skill · átlag ${s.athleticAvg != null ? hu1(s.athleticAvg) : '—'}`}
              rows={toRows(athletic, (_, n) => initials(n), (k) => ATHLETIC_META[k]?.name ?? k)}
              goalChips={chips} />
          )}
          {muscle.length > 0 && (
            <SkillBandCard delayMs={180} wash="amber" chipTone="warn" eyebrow="Izom"
              chip={`${muscle.length} izom · legjobb Lv ${s.muscleBest ?? '—'}`}
              rows={toRows(muscle, (_, n) => initials(n), (k) => MUSCLE_LABELS[k] ?? k)}
              goalChips={chips} />
          )}
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
