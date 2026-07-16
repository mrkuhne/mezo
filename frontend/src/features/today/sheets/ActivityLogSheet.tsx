import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { useActivityActions } from '@/data/hooks'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import { LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'
import { localDateString } from '@/shared/lib/dates'
import type { ActivityEntry, DailyQuest, LifeSkillKey } from '@/data/types'
import type { ActivityWriteResult } from '@/data/activity/activityApi'

interface ActivityLogSheetProps {
  onClose: () => void
  /** Opened from an activity-mode quest → contextual banner + the quest completes on a match. */
  quest?: DailyQuest | null
  /** Opened to categorize an existing uncategorized entry → starts in the picker phase. */
  entry?: ActivityEntry | null
}

const skillMeta = (key: LifeSkillKey | null | undefined) =>
  key ? LIFE_SKILLS.find((s) => s.key === key) : undefined

export function ActivityLogSheet({ onClose, quest, entry }: ActivityLogSheetProps) {
  const date = localDateString()
  const { logActivity, categorize, pending } = useActivityActions(date)
  const { showLevelUp } = useLevelUp()
  const [text, setText] = useState('')
  const [result, setResult] = useState<ActivityWriteResult | null>(null)
  const [phase, setPhase] = useState<'compose' | 'pick' | 'done'>(entry ? 'pick' : 'compose')
  const pickTarget = result?.entry ?? entry ?? null

  const surfaceLevelUps = (r: ActivityWriteResult) => {
    const payload = r.levelUps.find((l) => l.levelUps.length > 0) ?? r.levelUps[0]
    if (payload) showLevelUp(payload)
  }

  const submit = async () => {
    if (!text.trim() || pending) return
    const r = await logActivity(text.trim())
    setResult(r)
    surfaceLevelUps(r)
    setPhase(r.entry.skillKey ? 'done' : 'pick')
  }

  const pick = async (skillKey: LifeSkillKey) => {
    if (!pickTarget || pending) return
    const r = await categorize(pickTarget.id, skillKey)
    setResult(r)
    surfaceLevelUps(r)
    setPhase('done')
  }

  const doneMeta = skillMeta(result?.entry.skillKey)

  return (
    <Sheet onClose={onClose} labelledBy="activity-log-title">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div className="col">
              <span className="eyebrow">Tevékenységnapló</span>
              <div id="activity-log-title" className="h-display size-md" style={{ marginTop: 4 }}>Mi történt ma?</div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}><Icon name="x" size={12} /></button>
          </div>

          {quest && phase === 'compose' && (
            <div className="card" style={{ padding: 12, marginBottom: 14, background: 'color-mix(in srgb, var(--coral) 4%, transparent)', borderColor: 'color-mix(in srgb, var(--coral) 30%, transparent)' }}>
              <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
                <Icon name="sparkle" size={11} color="var(--coral)" />
                <div className="col" style={{ flex: 1, gap: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{quest.title}</span>
                  <span className="text-tertiary" style={{ fontSize: 11 }}>+{quest.xp} XP a teljesítésért</span>
                </div>
              </div>
            </div>
          )}

          {phase === 'compose' && (
            <>
              <div className="col gap-sm">
                <div className="card" style={{ padding: 10 }}>
                  <textarea value={text} maxLength={500} onChange={e => setText(e.target.value.slice(0, 500))}
                    placeholder="pl. Olvastam 30 percet, átraktam 50 ezret megtakarításba…"
                    style={{ width: '100%', minHeight: 90, resize: 'none', fontSize: 13, lineHeight: 1.45 }} />
                </div>
                <p className="text-tertiary" style={{ fontSize: 11, lineHeight: 1.5 }}>Az AI besorolja, és a megfelelő LIFE skillhez írja az XP-t.</p>
              </div>
              <div className="row gap-sm mt-lg">
                <button className="cta-ghost flex-1" onClick={close}>Mégse</button>
                <button className="cta-primary flex-1" onClick={submit} disabled={!text.trim() || pending}>Naplózom</button>
              </div>
            </>
          )}

          {phase === 'pick' && pickTarget && (
            <div className="col gap-sm">
              <span style={{ fontSize: 13, fontWeight: 600 }}>Nem egyértelmű — melyik skillhez tartozik?</span>
              <div className="card" style={{ padding: 10 }}>
                <p className="text-tertiary" style={{ fontSize: 12, fontStyle: 'italic', lineHeight: 1.45 }}>„{pickTarget.text}"</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 4 }}>
                {LIFE_SKILLS.map(s => (
                  <button key={s.key} className="chip" disabled={pending} onClick={() => pick(s.key)}
                    style={{ justifyContent: 'flex-start', cursor: 'pointer' }}>
                    {`${s.icon} ${s.name}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {phase === 'done' && result && (
            <>
              <div className="col gap-sm">
                <div className="card" style={{ padding: 14, background: 'color-mix(in srgb, var(--coral) 4%, transparent)', borderColor: 'color-mix(in srgb, var(--coral) 30%, transparent)' }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{doneMeta ? `${doneMeta.icon} ${doneMeta.name}` : result.entry.text}</span>
                    <span className="chip" style={{ whiteSpace: 'nowrap' }}>+{result.entry.xpAwarded} XP</span>
                  </div>
                </div>
                {result.completedQuest && (
                  <div className="card" style={{ padding: 10 }}>
                    <div className="row gap-sm" style={{ alignItems: 'center' }}>
                      <Icon name="check" size={12} color="var(--success)" />
                      <span style={{ fontSize: 12, lineHeight: 1.4 }}>Küldetés teljesítve: {result.completedQuest.title} (+{result.completedQuest.xp} XP)</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="row gap-sm mt-lg">
                <button className="cta-primary flex-1" onClick={close}>Kész</button>
              </div>
            </>
          )}
        </div>
      )}
    </Sheet>
  )
}
