import { useState } from 'react'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { useAchievements, useActivityHistory, useProgressionProfile, useQuestHistory } from '@/data/hooks'
import { SkillBandCard, type SkillRowVM } from '@/features/me/components/SkillBandCard'
import { GrowthJournalCard } from '@/features/me/components/GrowthJournalCard'
import { BadgesCard } from '@/features/me/components/BadgesCard'
import { PerksCard } from '@/features/me/components/PerksCard'
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

type Tab = 'skills' | 'journal' | 'awards'

// Normalise hu-HU's NBSP / narrow-NBSP thousands separators to a plain space.
const fmt = (v: number) => v.toLocaleString('hu-HU').replace(/[\u00a0\u202f]/g, ' ')

const byLevelXpDesc = (a: SkillLevel, b: SkillLevel) =>
  b.level - a.level || b.cumulativeXp - a.cumulativeXp

function toRows(skills: SkillLevel[], iconOf: (key: string) => string, nameOf: (key: string) => string): SkillRowVM[] {
  return [...skills].sort(byLevelXpDesc).map((s) => ({
    key: s.skillKey, icon: iconOf(s.skillKey), name: nameOf(s.skillKey),
    level: s.level, progressPct: s.progressPct, xp: s.cumulativeXp,
  }))
}

export function GrowthPage() {
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
    <>
      <div className="pghead-np lav">
        <div>
          <div className="over">Me · Growth</div>
          <h1>Growth</h1>
        </div>
      </div>
      <div style={{ padding: '8px 24px 24px' }}>
        <div className="col gap-md">
          {/* hero trio — always visible */}
          <div className="card" style={{ padding: '10px 12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <HeroStat value={fmt(totalXp)} label="Össz XP" />
              <HeroStat value={disc == null ? '–' : `${disc}%`} label="Fegyelem" />
              <HeroStat value={`${weeks} hét`} label="Ritmus" />
            </div>
          </div>

          {/* segmented control */}
          <div className="row" role="tablist" aria-label="Growth nézetek" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 5, padding: 3, gap: 3 }}>
            <SegButton on={tab === 'skills'} onClick={() => setTab('skills')}>Skillek</SegButton>
            <SegButton on={tab === 'journal'} onClick={() => setTab('journal')}>Napló</SegButton>
            <SegButton on={tab === 'awards'} onClick={() => setTab('awards')}>Kitüntetések</SegButton>
          </div>

          {tab === 'skills' && (
            <>
              {/* "Ma" block (Task 7 relocation): the quests + activity log cards moved here
                  from Today, whose compact TodayQuestsCard links back here (mezo-gj2y). */}
              <div>
                <Eyebrow>Ma</Eyebrow>
                <DailyQuestsCard />
                <ActivityLogCard />
              </div>
              <SkillBandCard
                eyebrow="LIFE"
                chip={`8 skill · ${fmt(lifeXp)} XP`}
                rows={toRows(life, (k) => lifeMeta(k)?.icon ?? '✨', (k) => lifeMeta(k)?.name ?? k)}
                footer={typeof savings === 'number' && savings > 0 ? (
                  <div className="row" style={{ justifyContent: 'space-between', marginTop: 11, paddingTop: 9, borderTop: '1px solid var(--border-subtle)' }}>
                    <span className="text-secondary" style={{ fontSize: 12 }}>Megtakarítás (30 nap)</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--sage-deep)' }}>{fmt(savings)} Ft</span>
                  </div>
                ) : undefined}
              />
              <SkillBandCard
                eyebrow="Atlétikus"
                chip={`12 skill · átlag ${profile.athleteLevel ?? '–'}`}
                rows={toRows(athletic, (k) => athMeta(k)?.icon ?? '✨', (k) => athMeta(k)?.name ?? k)}
              />
              <SkillBandCard
                eyebrow="Izom"
                chip={`13 izom · legjobb Lv ${muscle.length ? Math.max(...muscle.map((m) => m.level)) : 1}`}
                rows={toRows(muscle, () => '💪', (k) => MUSCLE_LABELS[k] ?? k)}
              />
            </>
          )}
          {tab === 'journal' && <JournalTab />}
          {tab === 'awards' && <AwardsTab />}
        </div>
      </div>
    </>
  )
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '11px 6px 9px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--ff-display)', fontSize: 23, color: 'var(--lav-deep)' }}>{value}</div>
      <div className="eyebrow" style={{ marginTop: 3 }}>{label}</div>
    </div>
  )
}

function SegButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button role="tab" aria-selected={on} onClick={onClick}
      className="rad-12"
      style={{ flex: 1, textAlign: 'center', fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', padding: '7px 0', borderRadius: 3,
        color: on ? 'var(--lav-deep)' : 'var(--text-tertiary)',
        background: on ? 'var(--wash-lav)' : 'transparent' }}>
      {children}
    </button>
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
    <>
      <BadgesCard badges={data.badges} />
      <PerksCard perks={data.perks} />
    </>
  )
}
