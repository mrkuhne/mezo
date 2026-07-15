import type { JournalDay } from '@/features/me/logic/growthJournal'
import { LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'

const fmt = (v: number) => v.toLocaleString('hu-HU').replace(/[  ]/g, ' ')

/** 30-day quest+activity journal, day-grouped (Growth page Napló tab). */
export function GrowthJournalCard({ days, summary }: { days: JournalDay[]; summary: string }) {
  return (
    <div className="card notch-12" style={{ padding: '14px 15px 15px', position: 'relative', overflow: 'hidden' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>Utolsó 30 nap</span>
        <span className="chip notch-4">{summary}</span>
      </div>
      {days.length === 0 && (
        <p className="text-tertiary" style={{ fontSize: 12, marginTop: 10 }}>
          Még nincs bejegyzés — a teljesített küldetések és tevékenységek itt gyűlnek.
        </p>
      )}
      {days.map((d) => (
        <div key={d.date} style={{ marginTop: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between', paddingBottom: 5, borderBottom: '1px solid var(--border-subtle)' }}>
            <span className="eyebrow">{d.label}</span>
            <span className="eyebrow" style={{ color: 'var(--amber-deep)' }}>+{d.xpTotal} XP</span>
          </div>
          {d.entries.map((e) =>
            e.kind === 'quest' ? (
              <div key={`q-${e.quest.id}`} className="row" style={{ gap: 9, alignItems: 'flex-start', paddingTop: 7, opacity: e.quest.status === 'expired' ? 0.6 : 1 }}>
                <span style={{ width: 15, textAlign: 'center', color: e.quest.status === 'completed' ? 'var(--sage-deep)' : 'var(--text-quaternary)' }}>
                  {e.quest.status === 'completed' ? '✓' : '—'}
                </span>
                <span style={{ flex: 1, fontSize: 12, lineHeight: 1.35 }}>
                  {e.quest.title}
                  <span className="text-tertiary" style={{ display: 'block', fontSize: 10 }}>
                    küldetés · {e.quest.slot}
                    {e.quest.status === 'completed' && e.quest.completionMode === 'ACTIVITY' ? ' — tevékenységgel teljesült' : ''}
                    {e.quest.status === 'expired' ? ' · csendben lejárt' : ''}
                  </span>
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, color: e.quest.status === 'completed' ? 'var(--amber-deep)' : 'var(--text-quaternary)' }}>
                  {e.quest.status === 'completed' ? `+${e.quest.xp}` : '0'}
                </span>
              </div>
            ) : (
              <div key={`a-${e.activity.id}`} className="row" style={{ gap: 9, alignItems: 'flex-start', paddingTop: 7 }}>
                <span style={{ width: 15, textAlign: 'center', color: 'var(--lav-deep)' }}>✎</span>
                <span style={{ flex: 1, fontSize: 12, lineHeight: 1.35 }}>
                  {e.activity.text}
                  <span className="text-tertiary" style={{ display: 'block', fontSize: 10 }}>
                    tevékenység
                    {e.activity.skillKey ? ` · ${LIFE_SKILLS.find((s) => s.key === e.activity.skillKey)?.icon ?? ''} ${LIFE_SKILLS.find((s) => s.key === e.activity.skillKey)?.name ?? e.activity.skillKey}` : ' · besorolatlan'}
                    {typeof e.activity.amountHuf === 'number' && e.activity.amountHuf > 0 ? ` · ${fmt(e.activity.amountHuf)} Ft` : ''}
                  </span>
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, color: e.activity.xpAwarded > 0 ? 'var(--amber-deep)' : 'var(--text-quaternary)' }}>
                  {e.activity.xpAwarded > 0 ? `+${e.activity.xpAwarded}` : '0'}
                </span>
              </div>
            ),
          )}
        </div>
      ))}
    </div>
  )
}
