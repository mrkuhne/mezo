// ============================================================
// Mezo · GrowthAwardsPage (mezo-rmi0.1) — /me/growth/kituntetesek, prototype growth-tab.html
// #page-kit ×1.18 (spec §6). The progression's home (F7.4): StreakCard + TitlesSection
// (buy/equip/saver + canMutate gating verbatim — the coin's only sink), the badge grid with
// progress rings, the perks card. The hub's streak/coin chips and the legacy ?tab=awards land here.
// ============================================================
import { useNavigate } from 'react-router-dom'
import { useAchievements, useProgressionProfile } from '@/data/hooks'
import { MUSCLE_LABELS } from '@/data/train/train'
import { BadgesCard } from '@/features/me/components/BadgesCard'
import { PerksCard } from '@/features/me/components/PerksCard'
import { nearestMilestone } from '@/features/me/logic/perkMilestones'
import { StreakCard, TitlesSection } from '@/features/progression/components/ProgressionHome'
import { ATHLETIC_META, LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

const nameOf = (key: string) => ATHLETIC_META[key]?.name ?? LIFE_SKILLS.find((s) => s.key === key)?.name ?? MUSCLE_LABELS[key] ?? key

export function GrowthAwardsPage() {
  const navigate = useNavigate()
  const { data } = useAchievements()
  const { data: profile } = useProgressionProfile()
  const done = data.badges.filter((b) => b.achieved).length
  const next = nearestMilestone([...(profile.life ?? []), ...(profile.athletic ?? []), ...(profile.muscle ?? [])].map((s) => ({ name: nameOf(s.skillKey), level: s.level })))
  return (
    <MozaikPage tone="sage">
      <PageHead onBack={() => navigate('/me/growth')} label="‹ Growth" />
      <PageHero spot="s-medal" iconSize={59} big={done} name={`/ ${data.badges.length} jelvény`} />
      <PageBody principle="Az érme itt költhető el — címre vagy sorozat-mentőre. Semmi más nem vásárolható, és semmi nem jár le.">
        <EntranceGroup>
          <StreakCard delayMs={0} />
          <TitlesSection delayMs={60} />
          <BadgesCard badges={data.badges} />
          <PerksCard perks={data.perks} next={next} />
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
