import type { JournalDay } from '@/features/me/logic/growthJournal'
import { LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'
import { ClayIcon } from '@/shared/ui/clay'

const fmt = (v: number) => v.toLocaleString('hu-HU').replace(/[  ]/g, ' ')

/**
 * 30-day quest+activity journal, day-grouped (Growth page Napló tab). Mozaik reface
 * (mezo-d20.6.5): each day is its own washed `.gr-day` tile (prototype #page-growth
 * `naplo()`); the honest "csendben lejárt" line for a silently-expired quest is
 * preserved verbatim, never recolored, never hidden.
 */
export function GrowthJournalCard({ days, summary }: { days: JournalDay[]; summary: string }) {
  return (
    <div className="rise" style={{ '--d': '0ms' } as React.CSSProperties}>
      <div className="row" style={{ justifyContent: 'space-between', padding: '0 2px 6px' }}>
        <span className="mz-eyebrow">Utolsó 30 nap</span>
        <span className="gr-band-chip">{summary}</span>
      </div>
      {days.length === 0 && (
        <p className="text-tertiary" style={{ fontSize: 12, padding: '4px 2px' }}>
          Még nincs bejegyzés — a teljesített küldetések és tevékenységek itt gyűlnek.
        </p>
      )}
      {days.map((d) => (
        <div key={d.date} className="gr-day">
          <div className="gr-day-head">
            <span className="mz-eyebrow">{d.label}</span>
            <span className="mz-eyebrow" style={{ color: 'var(--mz-cell-amber-ink)' }}>+{d.xpTotal} XP</span>
          </div>
          {d.entries.map((e) =>
            e.kind === 'quest' ? (
              <div key={`q-${e.quest.id}`} className="gr-row" style={{ opacity: e.quest.status === 'expired' ? 0.6 : 1 }}>
                <span style={{ width: 15, textAlign: 'center', color: e.quest.status === 'completed' ? 'var(--mz-cell-sage-ink)' : 'var(--mz-ink-mut)' }}>
                  {e.quest.status === 'completed' ? '✓' : '—'}
                </span>
                <span style={{ flex: 1, fontSize: 12, lineHeight: 1.35 }}>
                  {e.quest.title}
                  <span style={{ display: 'block', fontSize: 10, color: 'var(--mz-ink-soft)' }}>
                    küldetés · {e.quest.slot}
                    {e.quest.status === 'completed' && e.quest.completionMode === 'ACTIVITY' ? ' — tevékenységgel teljesült' : ''}
                    {e.quest.status === 'expired' ? ' · csendben lejárt' : ''}
                  </span>
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, color: e.quest.status === 'completed' ? 'var(--mz-cell-amber-ink)' : 'var(--mz-ink-mut)' }}>
                  {e.quest.status === 'completed' ? `+${e.quest.xp}` : '0'}
                </span>
              </div>
            ) : (
              <div key={`a-${e.activity.id}`} className="gr-row">
                <span style={{ width: 15, textAlign: 'center', color: 'var(--mz-cell-lav-ink)' }}>✎</span>
                <span style={{ flex: 1, fontSize: 12, lineHeight: 1.35 }}>
                  {e.activity.text}
                  <span style={{ display: 'block', fontSize: 10, color: 'var(--mz-ink-soft)' }}>
                    tevékenység
                    {e.activity.skillKey ? (() => {
                      const m = LIFE_SKILLS.find((s) => s.key === e.activity.skillKey)
                      return <> · {m && <ClayIcon name={m.clayIcon} size={11} className="inline-clay" />} {m?.name ?? e.activity.skillKey}</>
                    })() : ' · besorolatlan'}
                    {typeof e.activity.amountHuf === 'number' && e.activity.amountHuf > 0 ? ` · ${fmt(e.activity.amountHuf)} Ft` : ''}
                  </span>
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, color: e.activity.xpAwarded > 0 ? 'var(--mz-cell-amber-ink)' : 'var(--mz-ink-mut)' }}>
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
