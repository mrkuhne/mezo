import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { TimePicker } from '@/features/me/components/TimePicker'
import { useSleep, useSleepShot } from '@/data/hooks'
import type { SleepEntry, SleepLogInput, SleepShotDraft } from '@/data/types'
import { SECTION_LABEL } from '@/shared/ui/sectionLabel'
import { clearNightWake, readNightWake } from '@/features/me/logic/nightTrace'
import { localDateString } from '@/shared/lib/dates'
import { PhaseRail } from '@/features/me/components/PhaseRail'
import { phaseBreakdown } from '@/features/me/logic/sleepPhases'

function computeDuration(bedtime: string, wakeup: string): number {
  const [bh, bm] = bedtime.split(':').map(Number)
  const [wh, wm] = wakeup.split(':').map(Number)
  let bedMins = bh * 60 + bm
  let wakeMins = wh * 60 + wm
  if (wakeMins < bedMins) wakeMins += 24 * 60
  return +((wakeMins - bedMins) / 60).toFixed(1)
}

// The non-phase SleepEntry fields the draft doesn't carry — phaseBreakdown() only reads the
// phase minutes, but its parameter type is the full SleepEntry, so this fills the rest with
// inert placeholders purely to satisfy the shape (mezo-fk9a).
const EMPTY_ENTRY_SHAPE: Omit<SleepEntry, 'awakeMin' | 'lightMin' | 'remMin' | 'deepMin'> = {
  date: '', bedtime: '', wakeup: '', duration: 0, quality: 0, awakenings: 0, mealToSleep: 0, notes: null,
}

type Mode = 'manual' | 'shot'
type ShotPhase = 'pick' | 'drafting' | 'review'

export function SleepLogSheet({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (input: SleepLogInput) => void
}) {
  const { extract } = useSleepShot()
  const { sleepLog } = useSleep()
  const [mode, setMode] = useState<Mode>('manual')
  const [shotPhase, setShotPhase] = useState<ShotPhase>('pick')
  const [shotError, setShotError] = useState<string | null>(null)
  const [draft, setDraft] = useState<SleepShotDraft | null>(null)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [durationInput, setDurationInput] = useState('') // screenshot mode's own editable duration
  const [bedtime, setBedtime] = useState('23:00')
  const [wakeup, setWakeup] = useState('06:30')
  const [quality, setQuality] = useState(7)
  // Soft night-trace prefill (spec D7): read once on mount; manual edits simply override.
  const [nightTrace] = useState(() => readNightWake(localDateString()))
  const [awakenings, setAwakenings] = useState(nightTrace ? Math.min(nightTrace.count, 4) : 1)
  const [inBedMin, setInBedMin] = useState('')
  const [note, setNote] = useState('')
  const duration = computeDuration(bedtime, wakeup)

  const isShot = mode === 'shot'
  const showInputs = mode === 'manual' || shotPhase === 'review'
  // The ONE saved duration, used by both save paths and by the hero readout.
  // `SleepEntry.duration` means ASLEEP hours everywhere (sleepStats treats it as asleep
  // minutes; the bed span lives in inBedMin), so once an extraction exists its asleep
  // duration wins over the bedtime→wakeup span — otherwise a row would carry 8.3h next to
  // phase minutes summing to 7.5h and inflate efficiency (mezo-fk9a). A user-typed
  // durationInput still overrides. With no draft this is the span, exactly as before.
  const durationH = draft
    ? (durationInput ? Number(durationInput) : (draft.durationH ?? duration))
    : duration

  // The draft is shaped like a SleepEntry for this purpose — reuse the one breakdown rule
  // rather than re-deriving it here.
  const draftPhases = draft
    ? phaseBreakdown({
        ...EMPTY_ENTRY_SHAPE,
        awakeMin: draft.awakeMin, lightMin: draft.lightMin,
        remMin: draft.remMin, deepMin: draft.deepMin,
      })
    : null

  /** Phase fields ride along whenever an extraction happened, regardless of the active mode —
   *  switching back to 'Kézi' used to discard them silently (mezo-fk9a). */
  const phasePayload = draft
    ? {
        source: 'screenshot' as const,
        sourceQualityPct: draft.sourceQualityPct ?? undefined,
        awakeMin: draft.awakeMin ?? undefined,
        lightMin: draft.lightMin ?? undefined,
        remMin: draft.remMin ?? undefined,
        deepMin: draft.deepMin ?? undefined,
        hypnogram: draft.hypnogram ?? undefined,
      }
    : {}

  const save = (close: () => void) => {
    onSave({
      date: new Date().toISOString().slice(0, 10),
      bedtime, wakeup, durationH, quality, awakenings,
      inBedMin: inBedMin ? Number(inBedMin) : undefined,
      note: note || undefined,
      ...phasePayload,
    })
    clearNightWake(localDateString())
    close()
  }

  const saveShot = (close: () => void) => {
    onSave({
      date,
      bedtime, wakeup, durationH, quality, awakenings,
      inBedMin: inBedMin ? Number(inBedMin) : undefined,
      note: note || undefined,
      ...phasePayload,
    })
    clearNightWake(localDateString())
    close()
  }

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setShotPhase('drafting')
    setShotError(null)
    try {
      const d = await extract(file)
      setDraft(d)
      if (d.bedtime) setBedtime(d.bedtime)
      if (d.wakeup) setWakeup(d.wakeup)
      setDurationInput(d.durationH != null ? String(d.durationH) : '')
      if (d.inBedMin != null) setInBedMin(String(d.inBedMin))
      if (d.sourceQualityPct != null) setQuality(Math.min(10, Math.max(1, Math.round(d.sourceQualityPct / 10))))
      setShotPhase('review')
    } catch {
      setShotError('A screenshot beolvasása nem sikerült — próbáld újra, vagy válts kézire.')
      setShotPhase('pick')
    }
  }

  return (
    <Sheet onClose={onClose} labelledBy="sleep-log-title">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div className="col">
              <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>Reggeli sleep log</span>
              <div id="sleep-log-title" className="h-display size-md" style={{ marginTop: 4 }}>Hogyan aludtunk?</div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}><Icon name="x" size={12} /></button>
          </div>

          <div className="row gap-xs" style={{ marginBottom: 14 }}>
            {(['manual', 'shot'] as const).map((m) => (
              <button key={m} className="chip" aria-pressed={mode === m}
                onClick={() => { setMode(m); setShotPhase('pick'); setShotError(null) }}
                style={{
                  flex: 1, justifyContent: 'center', fontSize: 11, padding: '8px 0',
                  background: mode === m ? 'var(--wash-lav)' : 'transparent',
                  borderColor: mode === m ? 'var(--lav-deep)' : 'var(--border-subtle)',
                  color: mode === m ? 'var(--lav-deep)' : 'var(--text-tertiary)',
                }}>
                {m === 'manual' ? 'Kézi' : 'Screenshot'}
              </button>
            ))}
          </div>

          {isShot && shotPhase === 'pick' && (
            <div className="col gap-sm" style={{ marginBottom: 14 }}>
              <label className="chip" style={{ justifyContent: 'center', padding: '14px 0', fontSize: 12, cursor: 'pointer', borderColor: 'var(--lav-deep)', color: 'var(--lav-deep)' }}>
                <Icon name="camera" size={14} color="var(--lav-deep)" /> Sleep Cycle screenshot kiválasztása
                <input type="file" accept="image/*" aria-label="Sleep Cycle screenshot"
                  style={{ display: 'none' }} onChange={onPick} />
              </label>
              {shotError && <span style={{ fontSize: 10, color: 'var(--warning)' }}>{shotError}</span>}
            </div>
          )}

          {isShot && shotPhase === 'drafting' && (
            <div className="card" style={{
              padding: 24, textAlign: 'center', marginBottom: 14,
              background: 'var(--wash-lav)', borderColor: 'var(--lav-deep)',
            }}>
              <Icon name="sparkle" size={20} color="var(--lav-deep)" />
              <div style={{ fontFamily: 'var(--ff-display)', fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginTop: 10 }}>
                Elemzem a screenshotot…
              </div>
              <div className="np-twinkle" style={{
                width: 12, height: 12, borderRadius: '50%', margin: '16px auto 0',
                border: '1.5px solid var(--lav-deep)',
              }} />
            </div>
          )}

          {showInputs && (
            <>
              {/* F7.4: the duration + window headline rides the tinted hero band. */}
              <div className="mz-sheet-hero" style={{ padding: 18, background: 'var(--mz-wash-lav)', boxShadow: 'var(--mz-shadow-lav)', display: 'block' }}>
                <div className="row" style={{ justifyContent: 'center', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontFamily: 'var(--ff-display)', fontSize: 48, fontWeight: 600, color: 'var(--ink)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{durationH}</span>
                  <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>h</span>
                </div>
                <div className="row gap-lg mt-lg" style={{ justifyContent: 'center' }}>
                  <TimePicker label="Lefekvés" val={bedtime} onChange={setBedtime} />
                  <TimePicker label="Ébredés" val={wakeup} onChange={setWakeup} />
                </div>
              </div>

              {isShot && (
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', marginBottom: 14, background: 'var(--surface-2)' }}>
                  <span style={SECTION_LABEL}>Alvásidő (óra)</span>
                  <input type="number" inputMode="decimal" step={0.1} min={0} aria-label="Alvásidő (óra)"
                    value={durationInput} onChange={(e) => setDurationInput(e.target.value)}
                    style={{ width: 72, background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} />
                </div>
              )}

              <div className="col gap-sm">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span style={SECTION_LABEL}>Minőség</span>
                  <span style={{ fontFamily: 'var(--ff-display)', fontSize: 18, fontWeight: 600, color: 'var(--ink)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{quality}<span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 4 }}>/10</span></span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 3 }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                    <button key={n} onClick={() => setQuality(n)} aria-pressed={quality === n}
                      style={{ padding: '8px 0',
                        background: quality === n ? 'var(--lav-deep)' : quality >= n ? 'var(--wash-lav)' : 'var(--surface-2)',
                        border: '1px solid ' + (quality === n ? 'var(--lav-deep)' : 'var(--border-subtle)'),
                        color: quality === n ? 'var(--text-inverse)' : quality >= n ? 'var(--lav-deep)' : 'var(--text-tertiary)',
                        fontFamily: 'var(--ff-display)', fontSize: 11, fontWeight: 600,
                        clipPath: 'polygon(2px 0, 100% 0, 100% calc(100% - 2px), calc(100% - 2px) 100%, 0 100%, 0 2px)' }}>{n}</button>
                  ))}
                </div>
              </div>

              <div className="col gap-sm mt-lg">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span style={SECTION_LABEL}>Ébredések éjjel</span>
                  <span style={{ fontFamily: 'var(--ff-display)', fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{awakenings}<span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 4 }}>×</span></span>
                </div>
                <div className="row gap-sm" role="group" aria-label="Ébredések éjjel">
                  {[0, 1, 2, 3, '4+'].map(n => {
                    const val = n === '4+' ? 4 : (n as number)
                    return (
                      <button key={n} onClick={() => setAwakenings(val)} className="flex-1 chip"
                        aria-pressed={awakenings === val}
                        style={{ padding: '10px',
                          background: awakenings === val ? 'var(--wash-lav)' : 'var(--surface-1)',
                          borderColor: awakenings === val ? 'var(--lav-deep)' : 'var(--border-subtle)',
                          color: awakenings === val ? 'var(--lav-deep)' : 'var(--text-secondary)',
                          fontFamily: 'var(--ff-display)', fontSize: 13, justifyContent: 'center' }}>{n}</button>
                    )
                  })}
                </div>
                {nightTrace && (
                  <div className="row gap-sm" style={{ alignItems: 'flex-start', background: 'var(--wash-lav)', borderRadius: 14, padding: '11px 13px' }}>
                    <span aria-hidden="true" style={{ fontSize: 13 }}>🌙</span>
                    <span style={{ fontSize: 11.5, lineHeight: 1.55, color: 'var(--lav-deep)', flex: 1 }}>
                      Az éjjel {nightTrace.count}× jártál az éjszakai módban — előtöltöttem. Írd felül, ha máshogy emlékszel.
                    </span>
                  </div>
                )}
              </div>

              <div className="row mt-lg" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: 'var(--surface-2)' }}>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)' }}>
                  Ágyban összesen (perc)
                </span>
                <input type="number" inputMode="numeric" min={1} placeholder="opcionális" aria-label="Ágyban összesen (perc)"
                  value={inBedMin} onChange={(e) => setInBedMin(e.target.value)}
                  style={{ width: 72, background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} />
              </div>

              {isShot && draftPhases && (
                <div style={{ padding: '10px 12px 0' }}>
                  <PhaseRail breakdown={draftPhases} />
                </div>
              )}

              {/* The tracker's own quality score. PhaseRail has no slot for it (three cards share
                  that component and only this one has the value), but the review step's whole job
                  is showing what the AI read before the user commits it (mezo-fk9a). */}
              {isShot && draft?.sourceQualityPct != null && (
                <div style={{ padding: '8px 12px 0', fontSize: 10, fontWeight: 700, color: 'var(--faint)' }}>
                  Sleep Cycle minőség: {draft.sourceQualityPct}%
                </div>
              )}

              {isShot && (
                <>
                  <div className="row mt-sm" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: 'var(--surface-2)' }}>
                    <span style={SECTION_LABEL}>Dátum</span>
                    <input type="date" aria-label="Dátum" value={date} onChange={(e) => e.target.value && setDate(e.target.value)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 13, colorScheme: 'dark' }} />
                  </div>
                  {sleepLog.some((s) => s.date === date) && (
                    <span style={{ fontSize: 10, color: 'var(--warning)' }}>Erre a napra már van bejegyzés — mentéskor új sor készül.</span>
                  )}
                  {draft?.needsReview && (
                    <span style={{ fontSize: 10, color: 'var(--warning)' }}>Az AI bizonytalan volt — nézd át az értékeket mentés előtt.</span>
                  )}
                </>
              )}

              <div className="col gap-sm mt-lg">
                <span style={SECTION_LABEL}>Egy mondat · opcionális</span>
                <div className="card" style={{ padding: 10 }}>
                  <textarea value={note} onChange={e => setNote(e.target.value.slice(0, 200))}
                    placeholder='pl. "magnézium kihagyva" · "sok só tegnap" · "késő vacsora"'
                    style={{ width: '100%', minHeight: 50, resize: 'none', fontSize: 13, lineHeight: 1.45 }} />
                </div>
              </div>

              <div className="card mt-lg" style={{ padding: 10, background: 'var(--wash-lav)' }}>
                <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
                  <Icon name="sparkle" size={11} color="var(--lav-deep)" />
                  <p style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.5, flex: 1 }}>
                    {/* durationH, not the bare bedtime→wakeup `duration` — the 48px hero above
                        was repointed to durationH (mezo-fk9a), so the tip must agree with what
                        the user is actually looking at. */}
                    {durationH < 7 ? '7h alatt — a sleep-first triage alapján a reggeli briefing ezt fogja primary risk-ként jelölni.'
                      : quality <= 5 ? 'Alacsony minőség — keressük meg a faktort együtt (késő szénhidrát? kávé? stressz?).'
                      : durationH >= 7.5 && quality >= 8 ? 'Target felett · ragyogó nap. Pattern engine ezt boldog vasárnap megerősíti.'
                      : 'Stabil tartomány — beírom a 7-napos MA-ba.'}
                  </p>
                </div>
              </div>

              <div className="row gap-sm mt-lg">
                <button className="cta-ghost flex-1" onClick={close}>Mégse</button>
                <button className="cta-primary flex-1" onClick={() => (isShot ? saveShot(close) : save(close))}>
                  <Icon name="check" size={14} /> Mentés
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Sheet>
  )
}
