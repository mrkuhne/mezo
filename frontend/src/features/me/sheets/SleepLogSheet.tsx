import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { TimePicker } from '@/features/me/components/TimePicker'
import type { SleepLogInput } from '@/data/types'

// Jakarta section-label idiom (Napiv, replaces the retired mono `label-mono` class).
const SECTION_LABEL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '.1em',
  textTransform: 'uppercase',
  color: 'var(--faint)',
}

function computeDuration(bedtime: string, wakeup: string): number {
  const [bh, bm] = bedtime.split(':').map(Number)
  const [wh, wm] = wakeup.split(':').map(Number)
  let bedMins = bh * 60 + bm
  let wakeMins = wh * 60 + wm
  if (wakeMins < bedMins) wakeMins += 24 * 60
  return +((wakeMins - bedMins) / 60).toFixed(1)
}

export function SleepLogSheet({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (input: SleepLogInput) => void
}) {
  const [bedtime, setBedtime] = useState('23:00')
  const [wakeup, setWakeup] = useState('06:30')
  const [quality, setQuality] = useState(7)
  const [awakenings, setAwakenings] = useState(1)
  const [note, setNote] = useState('')
  const duration = computeDuration(bedtime, wakeup)

  const save = (close: () => void) => {
    onSave({
      date: new Date().toISOString().slice(0, 10),
      bedtime, wakeup, durationH: duration, quality, awakenings,
      note: note || undefined,
    })
    close()
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
          <div className="card notch-12" style={{ padding: 18, marginBottom: 14, background: 'var(--wash-lav)' }}>
            <div className="row" style={{ justifyContent: 'center', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: 'var(--ff-display)', fontSize: 48, fontWeight: 600, color: 'var(--ink)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{duration}</span>
              <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>h</span>
            </div>
            <div className="row gap-lg mt-lg" style={{ justifyContent: 'center' }}>
              <TimePicker label="Lefekvés" val={bedtime} onChange={setBedtime} hours={[22, 23, 0, 1]} />
              <TimePicker label="Ébredés" val={wakeup} onChange={setWakeup} hours={[5, 6, 7, 8]} />
            </div>
          </div>
          <div className="col gap-sm">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span style={SECTION_LABEL}>Minőség</span>
              <span style={{ fontFamily: 'var(--ff-display)', fontSize: 18, fontWeight: 600, color: 'var(--ink)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{quality}<span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 4 }}>/10</span></span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 3 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                <button key={n} onClick={() => setQuality(n)}
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
          <div className="col gap-sm mt-lg">
            <span style={SECTION_LABEL}>Egy mondat · opcionális</span>
            <div className="card notch-4" style={{ padding: 10 }}>
              <textarea value={note} onChange={e => setNote(e.target.value.slice(0, 200))}
                placeholder='pl. "magnézium kihagyva" · "Reta D1 reggel" · "késő vacsora"'
                style={{ width: '100%', minHeight: 50, resize: 'none', fontSize: 13, lineHeight: 1.45 }} />
            </div>
          </div>
          <div className="card notch-4 mt-lg" style={{ padding: 10, background: 'var(--wash-lav)' }}>
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
            <button className="cta-ghost notch-4 flex-1" onClick={close}>Mégse</button>
            <button className="cta-primary notch-4 flex-1" onClick={() => save(close)}>
              <Icon name="check" size={14} /> Mentés
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
