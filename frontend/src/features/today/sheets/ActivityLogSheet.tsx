import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { CaptureHeader } from '@/shared/ui/CaptureHeader'
import { useActivityActions } from '@/data/hooks'
import { buildQuestRewardToast } from '@/features/progression/logic/rewardToast'
import { LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'
import { ContentIcon, Icon3D } from '@/shared/ui/clay'
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
        source: 'activity',
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
    <Sheet onClose={onClose} labelledBy="activity-log-title" className="capture-sheet capture-tone-journal glass">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px' }}>
          <CaptureHeader id="activity-log-title" title="Mi történt ma?" eyebrow="Tevékenységnapló"
            subtitle="A kis lépések is a napod részei." kind="activity" onClose={close} onBack={onBack} />

          {quest && phase === 'compose' && (
            // Üveg (mezo-me75u.3, `SH.activity`): the quest banner is a flat gold callout, not a card.
            <div className="capture-quest">
              <Icon3D name="t-quest" size={24} />
              <div className="col" style={{ flex: 1, gap: 3 }}>
                <span className="capture-quest-title">{quest.title}</span>
                <span className="capture-quest-xp">+{quest.xp} XP a teljesítésért</span>
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
              <div className="capture-actions">
                <button className="cta-ghost flex-1" onClick={close}>Mégse</button>
                <button className="cta-primary capture-save flex-1" onClick={submit} disabled={!text.trim() || pending}>Naplózom</button>
              </div>
            </>
          )}

          {phase === 'pick' && pickTarget && (
            <div className="col gap-sm">
              <span style={{ fontSize: 14, fontWeight: 600 }}>Nem egyértelmű — melyik skillhez tartozik?</span>
              <div className="card" style={{ padding: 10 }}>
                <p className="text-tertiary" style={{ font: 'italic 500 14px/1.45 var(--ff-serif)' }}>„{pickTarget.text}"</p>
              </div>
              <div className="capture-skillchips">
                {LIFE_SKILLS.map(s => (
                  <button key={s.key} className="capture-skillchip" disabled={pending} onClick={() => pick(s.key)}>
                    <ContentIcon name={s.clayIcon} size={26} /> {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {phase === 'done' && result && (
            <>
              {/* Üveg (mezo-me75u.3, `SH.activity` done): the coin, the skill as a flat chip and the
                  earned XP as the one gold numeral. */}
              <div className="capture-gotit">
                <Icon3D name="t-coin" size={70} className="capture-gotit-art" />
                <span className="capture-gotit-skill">{doneMeta ? <><ContentIcon name={doneMeta.clayIcon} size={20} /> {doneMeta.name}</> : result.entry.text}</span>
                <b className="capture-xp">+{result.entry.xpAwarded} XP</b>
                {result.completedQuest && (
                  <p className="capture-gotit-quest">
                    <Icon3D name="t-tick" size={18} />
                    <span>Küldetés teljesítve: {result.completedQuest.title} (+{result.completedQuest.xp} XP)</span>
                  </p>
                )}
              </div>
              <div className="capture-actions is-single">
                <button className="cta-primary capture-save flex-1" onClick={close}>Kész</button>
              </div>
            </>
          )}
        </div>
      )}
    </Sheet>
  )
}
