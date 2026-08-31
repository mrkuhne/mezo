// ============================================================
// Mezo · GrowthPage — Mozaik 2.0 reface (mezo-d20.6.5).
// Source of truth: docs/design_2.0/prototypes/src/en-body.html #page-growth
// (p-gold tone, ×1.18): a page hero (i-growth clay icon + big "{XP} XP" +
// "Fegyelem {n}% · Ritmus {n} hét" subline), then a 4-way segmented switch
// (Skillek/Rutin/Napló/Kitüntetések) driving one Mozaik panel below. Every
// data hook, mutation and behavioral contract is verbatim from before this
// slice — only the face changed. ADR 0010: traits (Fegyelem/Ritmus) are
// FE-computed, never self-claimed; XP is feedback, never payment, so the
// hero never gates or rewards anything by itself.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClayIcon } from '@/shared/ui/clay'
import { MozaikPage, PageHead, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useAchievements, useActivityHistory, useProgressionProfile, useQuestHistory } from '@/data/hooks'
import { SkillBandCard, type SkillRowVM } from '@/features/me/components/SkillBandCard'
import { GrowthJournalCard } from '@/features/me/components/GrowthJournalCard'
import { BadgesCard } from '@/features/me/components/BadgesCard'
import { PerksCard } from '@/features/me/components/PerksCard'
import { RoutinesTab } from '@/features/me/components/RoutinesTab'
import { buildGrowthJournal } from '@/features/me/logic/growthJournal'
import { ATHLETIC_META, LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'
import { MUSCLE_LABELS } from '@/data/train/train'
import { localDateString } from '@/shared/lib/dates'
import type { SkillLevel } from '@/data/progression/progressionApi'
// Cross-feature import — legal here (Task 7, mezo-8141): the quests + activity log cards
// don't move files, they relocate onto Growth's "Ma" block while Today keeps a summary row.
import { DailyQuestsCard } from '@/features/today/components/DailyQuestsCard'
import { ActivityLogCard } from '@/features/today/components/ActivityLogCard'

const isoDaysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return localDateString(d)
}

type Tab = 'skills' | 'routines' | 'journal' | 'awards'
const TABS: { key: Tab; label: string }[] = [
  { key: 'skills', label: 'Skillek' },
  { key: 'routines', label: 'Rutin' },
  { key: 'journal', label: 'Napló' },
  { key: 'awards', label: 'Kitüntetések' },
]

// Normalise hu-HU's NBSP / narrow-NBSP thousands separators to a plain space.
const fmt = (v: number) => v.toLocaleString('hu-HU').replace(/[  ]/g, ' ')

const byLevelXpDesc = (a: SkillLevel, b: SkillLevel) =>
  b.level - a.level || b.cumulativeXp - a.cumulativeXp

function toRows(skills: SkillLevel[], iconOf: (key: string) => React.ReactNode, nameOf: (key: string) => string): SkillRowVM[] {
  return [...skills].sort(byLevelXpDesc).map((s) => ({
    key: s.skillKey, icon: iconOf(s.skillKey), name: nameOf(s.skillKey),
    level: s.level, progressPct: s.progressPct, xp: s.cumulativeXp,
  }))
}

export function GrowthPage() {
  const navigate = useNavigate()
  const { data: profile } = useProgressionProfile()
  const [tab, setTab] = useState<Tab>('skills')

  const life = profile.life ?? []
  const athletic = profile.athletic ?? []
  const muscle = profile.muscle ?? []
  const totalXp = [...life, ...athletic, ...muscle].reduce((s, x) => s + x.cumulativeXp, 0)
  const lifeXp = life.reduce((s, x) => s + x.cumulativeXp, 0)
  const disc = profile.traits?.disciplinePct
  const weeks = profile.traits?.consistencyWeeks ?? 0
  const savings = profile.savingsHuf30d

  const lifeMeta = (k: string) => LIFE_SKILLS.find((s) => s.key === k)
  const athMeta = (k: string) => ATHLETIC_META[k]

  return (
    <MozaikPage tone="gold">
      <PageHead onBack={() => navigate('/me')} label="‹ Én" />
      <EntranceGroup replayKey={tab}>
        <div className="mz-page-hero">
          <div className="mz-hero-nm">Growth</div>
          <div className="mz-hero-row">
            <ClayIcon name="i-growth" size={45} />
            <span className="gr-xpwrap">
              <span className="mz-bignum">{fmt(totalXp)}</span>
              <span className="gr-unit">XP</span>
            </span>
          </div>
          <div className="mz-hero-sb">Fegyelem {disc == null ? '–' : `${disc}%`} · Ritmus {weeks} hét</div>
        </div>
        <PageBody>
          <div className="gr-seg" role="tablist" aria-label="Growth nézetek">
            {TABS.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
                className={tab === t.key ? 'on' : undefined} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'skills' && (
            <>
              {/* "Ma" block: Growth keeps the full quest + activity cards. Today reads the
                  same query through its standing DailyQuestsChip/Sheet; both surfaces share
                  DailyQuestList, while Growth additionally owns the activity-log overview. */}
              <div className="mt-md rise" style={{ '--d': '0ms' } as React.CSSProperties}>
                <span className="mz-eyebrow">Ma</span>
                <div className="mt-sm">
                  <DailyQuestsCard />
                  <ActivityLogCard />
                </div>
              </div>
              <div className="mt-md">
                <SkillBandCard
                  delayMs={60}
                  wash="lav"
                  eyebrow="LIFE"
                  chip={`8 skill · ${fmt(lifeXp)} XP`}
                  rows={toRows(life, (k) => {
                    const m = lifeMeta(k)
                    // F7.4: the LIFE band renders the clay life-area symbol, not the emoji.
                    return m ? <ClayIcon name={m.clayIcon} size={15} /> : '✨'
                  }, (k) => lifeMeta(k)?.name ?? k)}
                  footer={typeof savings === 'number' && savings > 0 ? (
                    <>
                      <span style={{ color: 'var(--mz-ink-soft)' }}>Megtakarítás (30 nap)</span>
                      <span style={{ fontWeight: 700, color: 'var(--mz-cell-sage-ink)' }}>{fmt(savings)} Ft</span>
                    </>
                  ) : undefined}
                />
                <SkillBandCard
                  delayMs={120}
                  wash="sage"
                  eyebrow="Atlétikus"
                  chip={`12 skill · átlag ${profile.athleteLevel ?? '–'}`}
                  rows={toRows(athletic, (k) => athMeta(k)?.icon ?? '✨', (k) => athMeta(k)?.name ?? k)}
                />
                <SkillBandCard
                  delayMs={180}
                  wash="amber"
                  eyebrow="Izom"
                  chip={`13 izom · legjobb Lv ${muscle.length ? Math.max(...muscle.map((m) => m.level)) : 1}`}
                  rows={toRows(muscle, () => '💪', (k) => MUSCLE_LABELS[k] ?? k)}
                />
              </div>
            </>
          )}
          {tab === 'routines' && <RoutinesTab />}
          {tab === 'journal' && <JournalTab />}
          {tab === 'awards' && <AwardsTab />}
        </PageBody>
      </EntranceGroup>
    </MozaikPage>
  )
}

function JournalTab() {
  const today = localDateString()
  const from = isoDaysAgo(29)
  const { data: quests } = useQuestHistory(from, today)
  const { data: activities } = useActivityHistory(from, today)
  const days = buildGrowthJournal(quests, activities, today)
  const completed = quests.filter((q) => q.status === 'completed').length
  const expired = quests.filter((q) => q.status === 'expired').length
  return <GrowthJournalCard days={days} summary={`${completed} ✓ · ${expired} — · ${activities.length} ✎`} />
}

function AwardsTab() {
  const { data } = useAchievements()
  return (
    <div className="col gap-md">
      <BadgesCard badges={data.badges} />
      <PerksCard perks={data.perks} />
    </div>
  )
}
