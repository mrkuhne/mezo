import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { TimePicker } from '@/features/me/components/TimePicker'
import { useSleep, useSleepShot } from '@/data/hooks'
import type { SleepLogInput, SleepShotDraft } from '@/data/types'
import { SECTION_LABEL } from '@/shared/ui/sectionLabel'

function computeDuration(bedtime: string, wakeup: string): number {
  const [bh, bm] = bedtime.split(':').map(Number)
  const [wh, wm] = wakeup.split(':').map(Number)
  let bedMins = bh * 60 + bm
  let wakeMins = wh * 60 + wm
  if (wakeMins < bedMins) wakeMins += 24 * 60
  return +((wakeMins - bedMins) / 60).toFixed(1)
}

// Compact H:MM for the read-only phase breakdown (mezo-66ab).
const fmtHm = (min: number) =>
  min >= 60 ? `${Math.floor(min / 60)}ó${String(min % 60).padStart(2, '0')}p` : `${min}p`

type Mode = 'manual' | 'shot'
type ShotPhase = 'pick' | 'drafting' | 'review'

const HOURS_24 = [...Array(24).keys()]

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
  const [awakenings, setAwakenings] = useState(1)
  const [inBedMin, setInBedMin] = useState('')
  const [note, setNote] = useState('')
  const duration = computeDuration(bedtime, wakeup)

  const isShot = mode === 'shot'
  const showInputs = mode === 'manual' || shotPhase === 'review'
  // Shot review shows the value that will actually be SAVED (the asleep duration),
  // not the bed span — manual mode keeps the span-derived value (mezo-66ab).
  const heroDuration = isShot ? (durationInput ? Number(durationInput) : duration) : duration

  const save = (close: () => void) => {
    onSave({
      date: new Date().toISOString().slice(0, 10),
      bedtime, wakeup, durationH: duration, quality, awakenings,
      inBedMin: inBedMin ? Number(inBedMin) : undefined,
      note: note || undefined,
    })
    close()
  }

  const saveShot = (close: () => void) => {
    onSave({
      date,
      bedtime, wakeup,
      durationH: durationInput ? Number(durationInput) : computeDuration(bedtime, wakeup),
      quality, awakenings,
      inBedMin: inBedMin ? Number(inBedMin) : undefined,
      awakeMin: draft?.awakeMin ?? undefined,
      lightMin: draft?.lightMin ?? undefined,
      remMin: draft?.remMin ?? undefined,
      deepMin: draft?.deepMin ?? undefined,
      sourceQualityPct: draft?.sourceQualityPct ?? undefined,
      source: 'screenshot',
      note: note || undefined,
    })
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
              <div className="card" style={{ padding: 18, marginBottom: 14, background: 'var(--wash-lav)' }}>
                <div className="row" style={{ justifyContent: 'center', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontFamily: 'var(--ff-display)', fontSize: 48, fontWeight: 600, color: 'var(--ink)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{heroDuration}</span>
                  <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>h</span>
                </div>
                <div className="row gap-lg mt-lg" style={{ justifyContent: 'center' }}>
                  <TimePicker label="Lefekvés" val={bedtime} onChange={setBedtime} hours={isShot ? HOURS_24 : [22, 23, 0, 1]} />
                  <TimePicker label="Ébredés" val={wakeup} onChange={setWakeup} hours={isShot ? HOURS_24 : [5, 6, 7, 8]} />
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
                <div className="row gap-sm">
                  {[0, 1, 2, 3, '4+'].map(n => {
                    const val = n === '4+' ? 4 : (n as number)
                    return (
                      <button key={n} onClick={() => setAwakenings(val)} className="flex-1 chip"
                        style={{ padding: '10px',
                          background: awakenings === val ? 'var(--wash-lav)' : 'var(--surface-1)',
                          borderColor: awakenings === val ? 'var(--lav-deep)' : 'var(--border-subtle)',
                          color: awakenings === val ? 'var(--lav-deep)' : 'var(--text-secondary)',
                          fontFamily: 'var(--ff-display)', fontSize: 13, justifyContent: 'center' }}>{n}</button>
                    )
                  })}
                </div>
              </div>

              <div className="row mt-lg" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: 'var(--surface-2)' }}>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)' }}>
                  Ágyban összesen (perc)
                </span>
                <input type="number" inputMode="numeric" min={1} placeholder="opcionális" aria-label="Ágyban összesen (perc)"
                  value={inBedMin} onChange={(e) => setInBedMin(e.target.value)}
                  style={{ width: 72, background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} />
              </div>

              {isShot && draft && (draft.awakeMin != null || draft.sourceQualityPct != null) && (
                <div style={{ padding: '6px 12px', fontSize: 10, color: 'var(--text-tertiary)' }}>
                  fázisok: {[
                    draft.awakeMin != null && `éber ${draft.awakeMin}p`,
                    draft.lightMin != null && `könnyű ${fmtHm(draft.lightMin)}`,
                    draft.remMin != null && `REM ${fmtHm(draft.remMin)}`,
                    draft.deepMin != null && `mély ${fmtHm(draft.deepMin)}`,
                    draft.sourceQualityPct != null && `minőség ${draft.sourceQualityPct}%`,
                  ].filter(Boolean).join(' · ')}
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
                    placeholder='pl. "magnézium kihagyva" · "Reta D1 reggel" · "késő vacsora"'
                    style={{ width: '100%', minHeight: 50, resize: 'none', fontSize: 13, lineHeight: 1.45 }} />
                </div>
              </div>

              <div className="card mt-lg" style={{ padding: 10, background: 'var(--wash-lav)' }}>
                <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
                  <Icon name="sparkle" size={11} color="var(--lav-deep)" />
                  <p style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.5, flex: 1 }}>
                    {duration < 7 ? '7h alatt — a sleep-first triage alapján a reggeli briefing ezt fogja primary risk-ként jelölni.'
                      : quality <= 5 ? 'Alacsony minőség — keressük meg a faktort együtt (késő szénhidrát? kávé? Reta?).'
                      : duration >= 7.5 && quality >= 8 ? 'Target felett · ragyogó nap. Pattern engine ezt boldog vasárnap megerősíti.'
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
