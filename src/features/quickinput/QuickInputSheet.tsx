// ============================================================
// Mezo · QuickInputSheet — IDENT-4 (self-logging is the enemy)
// Multimodal unified intake: voice / photo / number / chip / text
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { Icon, type IconName } from '@/components/ui/Icon'
import { Sheet } from '@/components/ui/Sheet'
import { cn } from '@/lib/cn'

interface ParsedEntity {
  kind: string
  label: string
  confidence: number
}

interface Parsed {
  entities: ParsedEntity[]
  suggestion: string
}

type Mode = 'voice' | 'photo' | 'number' | 'chip' | 'text'
type VoiceState = 'idle' | 'recording' | 'transcribing' | 'parsed'

interface QuickInputSheetProps {
  onClose: () => void
  onCommit?: (parsed: unknown) => void
}

const MODALITIES: { id: Mode; label: string; icon: IconName }[] = [
  { id: 'voice', label: 'Voice', icon: 'mic' },
  { id: 'photo', label: 'Photo', icon: 'camera' },
  { id: 'number', label: 'Szám', icon: 'plus' },
  { id: 'chip', label: 'Választ', icon: 'check' },
  { id: 'text', label: 'Szöveg', icon: 'tool' },
]

export function QuickInputSheet({ onClose, onCommit }: QuickInputSheetProps) {
  const [mode, setMode] = useState<Mode>('voice')
  const [voiceState, setVoiceState] = useState<VoiceState>('idle') // idle | recording | transcribing | parsed
  const [transcript, setTranscript] = useState('')
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [text, setText] = useState('')
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Voice simulation
  const startRecording = () => {
    setVoiceState('recording')
    setTranscript('')
    let i = 0
    const sample = 'Most ettem 30 gramm whey-t és egy banánt — pre-workout előkészület'
    recordTimerRef.current = setInterval(() => {
      i++
      setTranscript(sample.slice(0, Math.min(i * 3, sample.length)))
      if (i * 3 >= sample.length + 4) {
        if (recordTimerRef.current) clearInterval(recordTimerRef.current)
        setTimeout(() => stopRecording(sample), 400)
      }
    }, 80)
  }
  const stopRecording = (_final: string) => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current)
    setVoiceState('transcribing')
    setTimeout(() => {
      setParsed({
        entities: [
          { kind: 'MealItem', label: 'MyProtein Impact Whey · 30g', confidence: 0.94 },
          { kind: 'MealItem', label: 'Banán · 1db', confidence: 0.96 },
          { kind: 'Context', label: 'Pre-workout · 13:42', confidence: 0.91 },
          { kind: 'Pattern', label: '→ Pre-workout fueling 2-3h before', confidence: 0.83 },
        ],
        suggestion: 'Mentsem mint Snack? 17:00 edzés előtt 3 órás ablakon belül.',
      })
      setVoiceState('parsed')
    }, 700)
  }

  useEffect(
    () => () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current)
    },
    [],
  )

  return (
    <Sheet onClose={onClose}>
      {(close) => (
      <>
      <div
        className="row"
        style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}
      >
        <div className="col">
          <span className="eyebrow brand">Quick input · 13:42</span>
          <div className="h-display size-md" style={{ marginTop: 4 }}>
            Mi van veled?
          </div>
        </div>
        <button className="chip" onClick={close} style={{ padding: '6px 8px' }} aria-label="Bezárás">
          <Icon name="x" size={12} />
        </button>
      </div>

      {/* Modality selector */}
      <div className="row gap-sm" style={{ marginBottom: 16 }}>
        {MODALITIES.map((m) => (
          <button
            key={m.id}
            className={cn('chip', mode === m.id && 'brand')}
            onClick={() => setMode(m.id)}
            style={{ padding: '8px 10px', fontSize: 9 }}
          >
            <Icon name={m.icon} size={11} />
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'voice' && (
        <div className="col gap-md">
          <div
            className="card notch-12"
            style={{
              padding: 20,
              textAlign: 'center',
              minHeight: 180,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {voiceState === 'idle' && (
              <>
                <button
                  onClick={startRecording}
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: '50%',
                    background: 'var(--brand-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 24px rgba(20, 184, 166, 0.5)',
                  }}
                >
                  <Icon name="mic" size={36} color="var(--text-inverse)" />
                </button>
                <span className="label-mono mt-md">Tartsd nyomva · vagy koppints</span>
                <span className="text-tertiary" style={{ fontSize: 12, marginTop: 8 }}>
                  "Ettem 30g whey + banán" · "Bal csukló feszül" · "Aludtam 7h-t"
                </span>
              </>
            )}
            {voiceState === 'recording' && (
              <>
                <div
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: '50%',
                    background: 'var(--error)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    animation: 'pulse-soft 1.2s ease-in-out infinite',
                    boxShadow: '0 0 0 8px rgba(244, 63, 94, 0.2)',
                  }}
                >
                  <Icon name="voice-wave" size={40} color="white" />
                </div>
                <span className="label-mono mt-md text-error">Felvétel · 0:04</span>
                <div className="row gap-xs mt-sm" style={{ height: 20, alignItems: 'center' }}>
                  {[3, 6, 8, 5, 9, 7, 4, 8, 6, 9, 5, 7, 3, 6].map((h, i) => (
                    <div
                      key={i}
                      style={{
                        width: 3,
                        height: h * 2,
                        background: 'var(--brand-glow)',
                        animation: `pulse-soft ${0.4 + i * 0.07}s ease-in-out infinite alternate`,
                      }}
                    />
                  ))}
                </div>
                <p
                  style={{
                    fontSize: 13,
                    marginTop: 14,
                    color: 'var(--text-primary)',
                    minHeight: 20,
                  }}
                >
                  {transcript}
                  <span style={{ color: 'var(--brand-glow)' }}>|</span>
                </p>
              </>
            )}
            {voiceState === 'transcribing' && (
              <>
                <div className="col gap-sm" style={{ alignItems: 'center' }}>
                  <span className="eyebrow brand">Értelmezés…</span>
                  <p style={{ fontSize: 14, color: 'var(--text-primary)', maxWidth: 280 }}>
                    "{transcript}"
                  </p>
                </div>
              </>
            )}
            {voiceState === 'parsed' && parsed && (
              <div className="col gap-md" style={{ width: '100%', textAlign: 'left' }}>
                <div className="col gap-xs">
                  <span className="eyebrow brand">Felismerve</span>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>"{transcript}"</p>
                </div>
                <div className="col gap-sm">
                  {parsed.entities.map((e, i) => (
                    <div key={i} className="row gap-sm" style={{ alignItems: 'center' }}>
                      <span className="toolchip read" style={{ fontSize: 9 }}>
                        {e.kind}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1 }}>
                        {e.label}
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--ff-mono)',
                          fontSize: 9,
                          color: 'var(--text-tertiary)',
                        }}
                      >
                        {(e.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
                <p
                  style={{
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                    marginTop: 4,
                  }}
                >
                  {parsed.suggestion}
                </p>
              </div>
            )}
          </div>

          {voiceState === 'parsed' && (
            <div className="row gap-sm">
              <button className="cta-ghost notch-4 flex-1" onClick={() => setVoiceState('idle')}>
                Újra
              </button>
              <button
                className="cta-primary notch-4 flex-1"
                onClick={() => {
                  onCommit?.(parsed)
                  close()
                }}
              >
                Megvan · ment
              </button>
            </div>
          )}
        </div>
      )}

      {mode === 'photo' && (
        <div className="col gap-md">
          <div className="card notch-12" style={{ padding: 24, textAlign: 'center', minHeight: 200 }}>
            <div
              style={{
                margin: '0 auto',
                width: 72,
                height: 72,
                borderRadius: 16,
                background: 'var(--surface-2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px dashed var(--border-strong)',
              }}
            >
              <Icon name="camera" size={32} color="var(--text-secondary)" />
            </div>
            <div className="label-mono mt-md">Étel · kifli.hu csomag · gyógyszer címke</div>
            <p className="text-secondary" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>
              Egy fotó és a recipe vagy product címke automatikusan strukturálódik. A Reta-kapszula
              belőle automatikusan beazonosítjuk a típust + dózist.
            </p>
            <button className="cta-primary notch-4 mt-lg" style={{ width: '100%' }}>
              <Icon name="camera" size={16} /> Kamera megnyitása
            </button>
          </div>
        </div>
      )}

      {mode === 'number' && (
        <div className="col gap-md">
          <div className="card notch-12" style={{ padding: 18 }}>
            <span className="eyebrow brand">Gyors szám</span>
            <div className="col gap-sm mt-md">
              {[
                { label: 'Súly', val: '78.6', unit: 'kg' },
                { label: 'Víz', val: '+500', unit: 'ml' },
                { label: 'Magnézium', val: '300', unit: 'mg' },
              ].map((n, i) => (
                <div
                  key={i}
                  className="row gap-sm"
                  style={{
                    padding: '10px 0',
                    borderBottom: i < 2 ? '1px solid var(--border-subtle)' : 'none',
                  }}
                >
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>
                    {n.label}
                  </span>
                  <span
                    style={{ fontFamily: 'var(--ff-mono)', fontSize: 14, color: 'var(--brand-glow)' }}
                  >
                    {n.val}
                    <span style={{ color: 'var(--text-tertiary)' }}>{n.unit}</span>
                  </span>
                  <Icon name="plus" size={14} color="var(--text-tertiary)" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {mode === 'chip' && (
        <div className="col gap-md">
          <div className="card notch-12" style={{ padding: 18 }}>
            <span className="eyebrow brand">Mezo · gyors kérdés</span>
            <p style={{ fontSize: 14, color: 'var(--text-primary)', marginTop: 10, lineHeight: 1.5 }}>
              Milyen ma az energiád 1-10 között?
            </p>
            <div className="row gap-sm flex-wrap mt-md">
              {[5, 6, 7, 8, 9].map((n) => (
                <button
                  key={n}
                  className="chip"
                  style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'var(--ff-display)' }}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="row mt-md gap-sm flex-wrap">
              <span className="chip" style={{ fontSize: 9 }}>
                ...és pumpa volt
              </span>
              <span className="chip" style={{ fontSize: 9 }}>
                fáradtnak érzem
              </span>
              <span className="chip" style={{ fontSize: 9 }}>
                jól aludtam
              </span>
            </div>
          </div>
        </div>
      )}

      {mode === 'text' && (
        <div className="col gap-md">
          <div className="card notch-12" style={{ padding: 14 }}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Free note · ha más nem talált. Mindent felismerünk: ételek, niggle, hangulat, emberek..."
              style={{
                width: '100%',
                minHeight: 100,
                resize: 'none',
                fontSize: 14,
                color: 'var(--text-primary)',
                background: 'transparent',
                lineHeight: 1.5,
              }}
            />
            <div className="row mt-sm" style={{ justifyContent: 'space-between' }}>
              <span className="text-tertiary" style={{ fontSize: 11 }}>
                {text.length}/500
              </span>
              <button
                className="cta-primary notch-4"
                style={{ padding: '8px 16px', fontSize: 12 }}
                onClick={close}
              >
                Mentés
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="row mt-lg" style={{ justifyContent: 'center', paddingTop: 10 }}>
        <span
          className="text-tertiary"
          style={{
            fontSize: 10,
            fontFamily: 'var(--ff-mono)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          Self-logging · az ellenfelünk
        </span>
      </div>
      </>
      )}
    </Sheet>
  )
}
