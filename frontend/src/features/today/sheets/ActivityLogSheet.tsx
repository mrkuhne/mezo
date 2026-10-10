import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { useActivityActions } from '@/data/hooks'
import { buildQuestRewardToast } from '@/features/progression/logic/rewardToast'
import { LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'
import { ContentIcon } from '@/shared/ui/clay'
import { Btn, Chips, FoSheetHead, Jar, Note, Pill, Pills, TwoBtn, Txt, Why } from '@/shared/ui/folyadek'
import { localDateString } from '@/shared/lib/dates'
import { emitToast } from '@/shared/lib/toastBus'
import type { ActivityEntry, DailyQuest, LifeSkillKey } from '@/data/types'
import type { ActivityWriteResult } from '@/data/activity/activityApi'
import { VoiceField } from '@/shared/ui/voice/VoiceField'
import { appendDictation } from '@/shared/lib/voice/useVoiceInput'

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

  // Folyadék (mezo-n4wf5.2, prototype `SHEETS.activity`): a light sheet. compose = the quest callout, the
  // field, a note, two buttons; pick = the question + the eight skills as pills; done = the jar with the
  // earned XP, the skill as a chip, the completed quest.
  const done = phase === 'done' && result != null
  return (
    <Sheet onClose={onClose} labelledBy="activity-log-title" className="fo-sheet">
      {(close) => (
        <>
          <FoSheetHead titleId="activity-log-title" icon="t-steps"
            title={done ? 'Megvan!' : 'Mi történt ma?'}
            sub={done ? 'Tevékenységnapló' : 'Tevékenységnapló · a kis lépések is a napod részei.'}
            onBack={done ? undefined : onBack} onClose={close} />

          {quest && phase === 'compose' && (
            <Why icon="t-quest">
              <b>Mai küldetés:</b> <span>{quest.title}</span> · <span>+{quest.xp} XP a teljesítésért</span>
            </Why>
          )}

          {phase === 'compose' && (
            <>
              <div className="nqk-field">
                <VoiceField domain="nap" onTranscript={t => setText(d => appendDictation(d, t, 500))}>
                  <textarea className="nqk-in" value={text} maxLength={500} onChange={e => setText(e.target.value.slice(0, 500))}
                    aria-labelledby="activity-log-title"
                    placeholder="pl. Olvastam 30 percet, átraktam 50 ezret megtakarításba…" />
                </VoiceField>
              </div>
              <Note>Az AI besorolja, és a megfelelő életterülethez írja az XP-t.</Note>
              <TwoBtn className="nqk-acts">
                <Btn ghost onClick={close}>Mégse</Btn>
                <Btn onClick={submit} disabled={!text.trim() || pending}>Naplózom</Btn>
              </TwoBtn>
            </>
          )}

          {phase === 'pick' && pickTarget && (
            <>
              <Txt>Nem egyértelmű — melyik skillhez tartozik?</Txt>
              <Txt className="nqk-quoted">„{pickTarget.text}”</Txt>
              <Pills className="nqk-acts">
                {LIFE_SKILLS.map(s => (
                  <Pill key={s.key} disabled={pending} onClick={() => pick(s.key)}>
                    <ContentIcon name={s.clayIcon} size={18} /> {s.name}
                  </Pill>
                ))}
              </Pills>
            </>
          )}

          {done && result && (
            <>
              <div className="nqk-bigrow">
                <Jar pct={75} size={74} text={`+${result.entry.xpAwarded}`} />
                <div className="nqk-big">
                  <span className="nqk-xp">+{result.entry.xpAwarded}<small>XP</small></span>
                  {doneMeta
                    ? <Chips items={[doneMeta.name]} />
                    : <span className="nqk-entry">{result.entry.text}</span>}
                </div>
              </div>
              {result.completedQuest && (
                <Why icon="t-quest">
                  Küldetés teljesítve: {result.completedQuest.title} (+{result.completedQuest.xp} XP)
                </Why>
              )}
              <Btn wide className="nqk-acts" onClick={close}>Kész</Btn>
            </>
          )}
        </>
      )}
    </Sheet>
  )
}
