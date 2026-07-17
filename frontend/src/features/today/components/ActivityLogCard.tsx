import { useState } from 'react'
import { useActivities } from '@/data/hooks'
import { ActivityLogSheet } from '@/features/today/sheets/ActivityLogSheet'
import { LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'
import { localDateString } from '@/shared/lib/dates'
import type { ActivityEntry } from '@/data/types'

const iconFor = (skillKey: ActivityEntry['skillKey']) =>
  (skillKey && LIFE_SKILLS.find((s) => s.key === skillKey)?.icon) || '✎'

/** Today's activity mini-journal: entries + quick-add; uncategorized rows prompt for a pick. */
export function ActivityLogCard() {
  const date = localDateString()
  const { data: entries } = useActivities(date)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [categorizeEntry, setCategorizeEntry] = useState<ActivityEntry | null>(null)

  return (
    <div className="card" style={{ margin: '8px 0', padding: '14px 16px' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8 }}>
        <span className="eyebrow">Tevékenységnapló</span>
        <button className="chip" onClick={() => setSheetOpen(true)} style={{ cursor: 'pointer' }}>+ Bejegyzés</button>
      </div>

      {entries.length === 0 ? (
        <div className="text-tertiary" style={{ fontSize: 11, paddingTop: 2 }}>Mi történt ma? Jegyezd fel — az XP a tiéd.</div>
      ) : (
        entries.map(e => (
          <div key={e.id} className="row" style={{ alignItems: 'center', gap: 10, padding: '6px 0' }}>
            <span style={{ width: 18, textAlign: 'center' }}>{iconFor(e.skillKey)}</span>
            <div style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.text}</div>
            {e.xpAwarded > 0 && (
              <span className="chip" style={{ whiteSpace: 'nowrap' }}>+{e.xpAwarded} XP</span>
            )}
            {e.skillKey === null && (
              <button className="chip" onClick={() => setCategorizeEntry(e)} style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}>Besorolás?</button>
            )}
          </div>
        ))
      )}

      {sheetOpen && <ActivityLogSheet onClose={() => setSheetOpen(false)} />}
      {categorizeEntry && <ActivityLogSheet entry={categorizeEntry} onClose={() => setCategorizeEntry(null)} />}
    </div>
  )
}
