// ============================================================
// Mezo · GrowthNaploPage (mezo-rmi0.1) — /me/growth/naplo, prototype growth-tab.html
// #page-naplo ×1.18 (spec §5). Hero = completed quests (30 days). "Ez a hét" tile = the first
// consumer of GET /api/progression/growth-week (useGrowthWeek); renders NOTHING when the
// source is unavailable. Then the 30-day journal (buildGrowthJournal verbatim).
// Üveg re-dress (mezo-me75u.7, prototype uveg-en2.html `gnaplo()`): halo hero t-journal, sky glass.
// ============================================================
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useActivityHistory, useGrowthWeek, useQuestHistory } from '@/data/hooks'
import { GrowthJournalCard } from '@/features/me/components/GrowthJournalCard'
import { buildGrowthJournal } from '@/features/me/logic/growthJournal'
import { Icon3D } from '@/shared/ui/clay'
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
    <MozaikPage tone="sky" className="grn-page">
      <PageHead glass onBack={() => navigate('/me/growth')} label="Growth" />
      <PageHero art="t-journal" accent="var(--dv-sky)" name="Napló" big={<>{completed}<small> teljesített küldetés</small></>} />
      <PageBody principle="Utolsó 30 nap · a teljesített küldetések és tevékenységek itt gyűlnek. A csendben lejárt küldetés nem hiba — ajánlat volt.">
        <EntranceGroup>
          {week && (
            <div className="gr-band sky glass rise" style={{ '--d': '0ms', '--c': 'var(--dv-sky)' } as CSSProperties}>
              <div className="gr-band-top">
                <Icon3D name="t-calendar" size={34} className="gr-band-art" />
                <span className="gr-band-ttl">Ez a hét</span>
                <span className="gr-band-chip sky">{huMonthDay(weekStart)} – {huMonthDay(addDays(weekStart, 6))}</span>
              </div>
              <MCells cells={[
                { label: 'küldetés', value: week.questCompleted, tone: 'sage' },
                { label: 'lejárt', value: Math.max(0, week.questClosed - week.questCompleted), tone: 'amber' },
                { label: 'tevékenység', value: week.activities, tone: 'lav' },
                { label: 'LIFE XP', value: `+${huInt(week.lifeXp)}`, tone: 'sky' },
              ]} />
              {week.savingsHuf > 0 && <div className="gr-band-foot"><span>Megtakarítás e héten</span><b>{huInt(week.savingsHuf)} Ft</b></div>}
            </div>
          )}
          <GrowthJournalCard days={days} />
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
