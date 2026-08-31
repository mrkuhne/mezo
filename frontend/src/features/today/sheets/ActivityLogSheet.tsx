import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { useActivityActions } from '@/data/hooks'
import { buildQuestRewardToast } from '@/features/progression/logic/rewardToast'
import { LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'
import { ClayIcon } from '@/shared/ui/clay'
import { localDateString } from '@/shared/lib/dates'
import { emitToast } from '@/shared/lib/toastBus'
import type { ActivityEntry, DailyQuest, LifeSkillKey } from '@/data/types'
import type { ActivityWriteResult } from '@/data/activity/activityApi'

interface ActivityLogSheetProps {
  onClose: () => void
  /** Return to the naplo-pick grid (QuickInputSheet). */
  onBack?: () => void
  /** Opened from an activity-mode quest → contextual banner + the quest completes on a match. */
  quest?: DailyQuest | null
  /** Opened to categorize an existing uncategorized entry → starts in the picker phase. */
  entry?: ActivityEntry | null
}

const skillMeta = (key: LifeSkillKey | null | undefined) =>
  key ? LIFE_SKILLS.find((s) => s.key === key) : undefined

export function ActivityLogSheet({ onClose, onBack, quest, entry }: ActivityLogSheetProps) {
  const date = localDateString()
  const { logActivity, categorize, pending } = useActivityActions(date)
  const [text, setText] = useState('')
  const [result, setResult] = useState<ActivityWriteResult | null>(null)
  const [phase, setPhase] = useState<'compose' | 'pick' | 'done'>(entry ? 'pick' : 'compose')
  const pickTarget = result?.entry ?? entry ?? null

  const surfaceLevelUps = (r: ActivityWriteResult) => {
    const payload = r.levelUps.find((l) => l.levelUps.length > 0) ?? r.levelUps[0]
    if (payload) {
      emitToast(buildQuestRewardToast({
        eyebrow: 'Naplózva',
        title: payload.workoutLabel ?? 'Tevékenység',
        levelUp: payload,
      }))
    }
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
            <div className="col" style={{ gap: 4 }}>
              {onBack && (
                <button type="button" className="cta-ghost" onClick={onBack}
                  style={{ padding: '4px 8px', fontSize: 14 }}>
                  ← Vissza
                </button>
              )}
              <span className="eyebrow">Tevékenységnapló</span>
              <div id="activity-log-title" className="h-display size-md" style={{ marginTop: 4 }}>Mi történt ma?</div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}><Icon name="x" size={12} /></button>
          </div>

          {quest && phase === 'compose' && (
            <div className="card" style={{ padding: 12, marginBottom: 14, background: 'var(--primary-bg)', borderColor: 'var(--primary-soft)' }}>
              <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
                <Icon name="sparkle" size={11} color="var(--primary-deep)" />
                <div className="col" style={{ flex: 1, gap: 3 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>{quest.title}</span>
                  <span className="text-tertiary" style={{ fontSize: 12 }}>+{quest.xp} XP a teljesítésért</span>
                </div>
              </div>
            </div>
          )}

          {phase === 'compose' && (
            <>
              <div className="col gap-sm">
                <div className="card" style={{ padding: 10 }}>
                  <textarea value={text} maxLength={500} onChange={e => setText(e.target.value.slice(0, 500))}
                    aria-labelledby="activity-log-title"
                    placeholder="pl. Olvastam 30 percet, átraktam 50 ezret megtakarításba…"
                    style={{ width: '100%', minHeight: 90, resize: 'none', fontSize: 16, lineHeight: 1.45 }} />
                </div>
                <p className="text-tertiary" style={{ fontSize: 12, lineHeight: 1.5 }}>Az AI besorolja, és a megfelelő LIFE skillhez írja az XP-t.</p>
              </div>
              <div className="row gap-sm mt-lg">
                <button className="cta-ghost flex-1" onClick={close}>Mégse</button>
                <button className="cta-primary flex-1" onClick={submit} disabled={!text.trim() || pending}>Naplózom</button>
              </div>
            </>
          )}

          {phase === 'pick' && pickTarget && (
            <div className="col gap-sm">
              <span style={{ fontSize: 14, fontWeight: 600 }}>Nem egyértelmű — melyik skillhez tartozik?</span>
              <div className="card" style={{ padding: 10 }}>
                <p className="text-tertiary" style={{ font: 'italic 500 14px/1.45 var(--ff-serif)' }}>„{pickTarget.text}"</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 4 }}>
                {LIFE_SKILLS.map(s => (
                  <button key={s.key} className="chip" disabled={pending} onClick={() => pick(s.key)}
                    style={{ justifyContent: 'flex-start', cursor: 'pointer' }}>
                    <ClayIcon name={s.clayIcon} size={13} /> {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {phase === 'done' && result && (
            <>
              <div className="col gap-sm">
                <div className="card" style={{ padding: 14, background: 'var(--primary-bg)', borderColor: 'var(--primary-soft)' }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>{doneMeta ? <><ClayIcon name={doneMeta.clayIcon} size={14} /> {doneMeta.name}</> : result.entry.text}</span>
                    <span className="chip" style={{ whiteSpace: 'nowrap' }}>+{result.entry.xpAwarded} XP</span>
                  </div>
                </div>
                {result.completedQuest && (
                  <div className="card" style={{ padding: 10 }}>
                    <div className="row gap-sm" style={{ alignItems: 'center' }}>
                      <Icon name="check" size={12} color="var(--success-hover)" />
                      <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>Küldetés teljesítve: {result.completedQuest.title} (+{result.completedQuest.xp} XP)</span>
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
