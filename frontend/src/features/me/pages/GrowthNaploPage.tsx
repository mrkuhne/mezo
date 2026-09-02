// ============================================================
// Mezo · GrowthNaploPage (mezo-rmi0.1) — /me/growth/naplo, prototype growth-tab.html
// #page-naplo ×1.18 (spec §5). Hero = completed quests (30 days). "Ez a hét" tile = the first
// consumer of GET /api/progression/growth-week (useGrowthWeek); renders NOTHING when the
// source is unavailable. Then the 30-day journal (buildGrowthJournal verbatim).
// ============================================================
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useActivityHistory, useGrowthWeek, useQuestHistory } from '@/data/hooks'
import { GrowthJournalCard } from '@/features/me/components/GrowthJournalCard'
import { buildGrowthJournal } from '@/features/me/logic/growthJournal'
import { MCells, MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { addDays, huMonthDay, localDateString, mondayOf } from '@/shared/lib/dates'
import { huInt } from '@/shared/lib/huNum'

export function GrowthNaploPage() {
  const navigate = useNavigate()
  const today = localDateString()
  const from = addDays(today, -29)
  const { data: quests } = useQuestHistory(from, today)
  const { data: activities } = useActivityHistory(from, today)
  const weekStart = mondayOf(today)
  const { data: week } = useGrowthWeek(weekStart)
  const days = buildGrowthJournal(quests, activities, today)
  const completed = quests.filter((q) => q.status === 'completed').length

  return (
    <MozaikPage tone="sky">
      <PageHead onBack={() => navigate('/me/growth')} label="‹ Growth" />
      <PageHero icon="i-naplo" iconSize={52} big={completed} name="teljesített küldetés" />
      <PageBody principle="Utolsó 30 nap · a teljesített küldetések és tevékenységek itt gyűlnek. A csendben lejárt küldetés nem hiba — ajánlat volt.">
        <EntranceGroup>
          {week && (
            <div className="gr-band sky rise" style={{ '--d': '0ms' } as CSSProperties}>
              <div className="gr-band-top">
                <span className="mz-eyebrow" style={{ color: 'var(--mz-cell-sky-ink)' }}>Ez a hét</span>
                <span className="gr-band-chip sky">{huMonthDay(weekStart)} – {huMonthDay(addDays(weekStart, 6))}</span>
              </div>
              <MCells cells={[
                { label: 'küldetés ✓', value: week.questCompleted, tone: 'sage' },
                { label: 'lejárt', value: Math.max(0, week.questClosed - week.questCompleted), tone: 'amber' },
                { label: 'tevékenység', value: week.activities, tone: 'lav' },
                { label: 'LIFE XP', value: `+${huInt(week.lifeXp)}`, tone: 'sky' },
              ]} />
              {week.savingsHuf > 0 && <div className="gr-band-foot">Megtakarítás e héten · <b>{huInt(week.savingsHuf)} Ft</b></div>}
            </div>
          )}
          <GrowthJournalCard days={days} />
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
