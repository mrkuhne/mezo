import type { CSSProperties } from 'react'
import type { JournalDay } from '@/features/me/logic/growthJournal'
import { LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'
import { ClayIcon } from '@/shared/ui/clay'
import { huInt } from '@/shared/lib/huNum'
import { cn } from '@/shared/lib/cn'

/**
 * 30-day quest + activity journal, one card per day (Growth Napló page, mezo-rmi0.1, prototype
 * growth-tab.html JOURNAL). Day header = label · date-ish · +xp; rows: ✓ quest · ✎ activity ·
 * — silently expired ("csendben lejárt", muted, never recolored, never hidden).
 */
export function GrowthJournalCard({ days }: { days: JournalDay[] }) {
  if (days.length === 0) {
    return (
      <p className="gr-band-foot rise" style={{ '--d': '60ms' } as CSSProperties}>
        Még nincs bejegyzés — a teljesített küldetések és tevékenységek itt gyűlnek.
      </p>
    )
  }
  return (
    <>
      {days.map((d, i) => (
        <div key={d.date} className="rise" style={{ '--d': `${60 + i * 60}ms` } as CSSProperties}>
          <div className="gr-dayhd">
            <span className="dow">{d.label}</span>
            <span className="dt">{d.date.slice(5).replace('-', '.')}</span>
            <span className="xp">+{d.xpTotal} XP</span>
          </div>
          <div className="gr-day">
            {d.entries.map((e) => e.kind === 'quest' ? (
              <div key={`q-${e.quest.id}`} className={cn('gr-jrow', e.quest.status !== 'completed' && 'gone')}>
                <span className="gr-jk" aria-hidden="true">{e.quest.status === 'completed' ? '✓' : '—'}</span>
                <span className="tx">{e.quest.title}</span>
                <span className="gr-jmeta">
                  küldetés · {e.quest.slot.toLowerCase()}
                  {e.quest.status === 'completed' && e.quest.completionMode === 'ACTIVITY' ? ' — tevékenységgel teljesült' : ''}
                  {e.quest.status === 'completed' ? ` · +${e.quest.xp}` : ' · csendben lejárt'}
                </span>
              </div>
            ) : (
              <div key={`a-${e.activity.id}`} className="gr-jrow act">
                <span className="gr-jk" aria-hidden="true">✎</span>
                <span className="tx">{e.activity.text}</span>
                <span className="gr-jmeta">
                  tevékenység{e.activity.skillKey ? (() => { const m = LIFE_SKILLS.find((s) => s.key === e.activity.skillKey); return <> · {m && <ClayIcon name={m.clayIcon} size={11} className="inline-clay" />} {m?.name ?? e.activity.skillKey}</> })() : ' · besorolatlan'}
                  {e.activity.xpAwarded > 0 ? ` · +${e.activity.xpAwarded}` : ''}
                  {typeof e.activity.amountHuf === 'number' && e.activity.amountHuf > 0 ? ` · ${huInt(e.activity.amountHuf)} Ft` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}
