// ============================================================
// Mezo · AiLogSheet (Fuel P8 · AI meal logging — mezo-78rn)
// The user-facing wizard that turns a free-text description and/or a meal photo into a logged
// meal. Three phases share one shell (mirrors ImportItemSheet's phase machine):
//   input     — a <textarea> ("Mit ettél?") + a photo affordance (hidden file input behind a Chip)
//               → CTA "AI naplózás" calls useMealActions().draftMealFromAi (photo downscaled via
//               resizeImage first).
//   drafting  — the shared spinner card while the draft resolves.
//   review    — the parsed lines land in local editable state (never mutate the shared draft): a
//               per-line source badge (Kamra / Recept / Becslés), editable amount, kcal preview,
//               delete; low-confidence (needsReview) lines get the yellow warning. Confirm maps the
//               lines into MealItemInput arms (estimate lines carry their full snapshot, ref lines
//               carry refId) + a provenance envelope → logMeal. An empty draft offers a manual
//               fallback (onManualFallback); a rejection shows the error copy and returns to input.
// ============================================================
import { useEffect, useMemo, useState } from 'react'
import { useMealActions } from '@/data/hooks'
import type { MealAiDraftLine, MealItemInput, MealSlot } from '@/data/types'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Chip } from '@/shared/ui/Chip'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { GhostState } from '@/shared/ui/GhostState'
import { resizeImage } from '@/shared/lib/resizeImage'

type Phase = 'input' | 'drafting' | 'review'

// A draft line plus this session's local edits (amount). A stable numeric `key` keyed off the
// draft index — we NEVER mutate the shared MOCK_AI_MEAL_DRAFT lines, only this local copy.
interface EditableLine extends MealAiDraftLine {
  key: number
}

// Reuse the LogMealSheet slot-label idiom so the four Hungarian labels stay consistent.
const SLOTS: { id: MealSlot; label: string }[] = [
  { id: 'breakfast', label: 'Reggeli' },
  { id: 'lunch', label: 'Ebéd' },
  { id: 'dinner', label: 'Vacsora' },
  { id: 'snack', label: 'Snack' },
]

function sourceBadge(source: MealAiDraftLine['source']) {
  if (source === 'pantry') return <Chip variant="brand">Kamra</Chip>
  if (source === 'recipe') return <Chip>Recept</Chip>
  return <Chip variant="warning">Becslés</Chip>
}

interface AiLogSheetProps {
  date: string
  initialSlot?: MealSlot
  onClose: () => void
  onManualFallback: () => void
}

export function AiLogSheet({ date, initialSlot, onClose, onManualFallback }: AiLogSheetProps) {
  const { draftMealFromAi, logMeal } = useMealActions(date)
  const [phase, setPhase] = useState<Phase>('input')
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lines, setLines] = useState<EditableLine[]>([])
  const [slot, setSlot] = useState<MealSlot>(initialSlot ?? 'snack')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState<string | null>(null)

  const canSubmit = text.trim().length > 0 || photo != null

  // Thumbnail preview for the attached photo (mezo-j4e6) — object URL revoked on change/unmount.
  const photoUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo])
  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl) }, [photoUrl])

  const submit = async () => {
    if (!canSubmit) return
    setPhase('drafting')
    setError(null)
    try {
      const blob = photo ? await resizeImage(photo) : undefined
      const d = await draftMealFromAi({ date, text: text.trim() || undefined, photo: blob })
      // Map the shared draft lines into local editable state — a fresh object per line, so edits
      // never reach back into MOCK_AI_MEAL_DRAFT (a shared reference in mock mode).
      setLines(d.items.map((it, i) => ({ ...it, key: i })))
      setSlot(d.slot)
      setTitle(d.title ?? '')
      setNote(d.note)
      setPhase('review')
    } catch {
      setError('Nem sikerült az AI-feldolgozás. Próbáld újra, vagy naplózz kézzel.')
      setPhase('input')
    }
  }

  const setAmount = (key: number, value: string) => {
    const n = Number(value)
    // Blank/zero guard (mezo-j4e6): Number('') coerces to 0 — a 0-amount line would confirm
    // as a 0 kcal entry. Anything non-positive keeps the previous amount instead.
    setLines(prev => prev.map(l => (l.key === key ? { ...l, amount: !Number.isFinite(n) || n <= 0 ? l.amount : n } : l)))
  }
  const removeLine = (key: number) => setLines(prev => prev.filter(l => l.key !== key))

  const confirm = (close: () => void) => {
    const items: MealItemInput[] = lines.map(l =>
      l.source === 'estimate'
        ? {
            source: 'estimate', name: l.name, amount: l.amount, unit: l.unit,
            per: l.per, basisUnit: l.basisUnit, kcal: l.kcal, proteinG: l.proteinG,
            carbsG: l.carbsG, fatG: l.fatG, nova: l.nova,
          }
        : {
            source: l.source,
            refId: (l.source === 'pantry' ? l.pantryItemId : l.recipeId)!,
            amount: l.amount, unit: l.unit,
          },
    )
    logMeal({
      slot,
      loggedAt: new Date().toISOString(),
      title: title.trim() || null,
      items,
      provenance: {
        origin: photo ? 'ai-photo' : 'ai-text',
        confidence: lines.length ? Math.min(...lines.map(l => l.confidence)) : null,
        rawText: text.trim() || null,
      },
    })
    close()
  }

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhoto(e.target.files?.[0] ?? null)
  }

  const goManual = (close: () => void) => {
    close()
    onManualFallback()
  }

  return (
    <Sheet onClose={onClose} labelledBy="ai-log-title">
      {(close) => (
        <>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div className="col">
              <Eyebrow brand>AI naplózás · mai nap</Eyebrow>
              <div id="ai-log-title" className="h-display size-md" style={{ marginTop: 4 }}>AI ételnapló</div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          {phase === 'input' && (
            <>
              <div className="card" style={{ padding: '10px 12px', marginBottom: 10 }}>
                <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Írd le szabadon</span>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  aria-label="Mit ettél?"
                  placeholder="pl. csirkés wrap és egy latte…"
                  rows={3}
                  style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 4, width: '100%', resize: 'vertical', background: 'transparent' }}
                />
              </div>

              <div className="row gap-xs flex-wrap" style={{ marginBottom: 10, alignItems: 'center' }}>
                <label className="chip" style={{ cursor: 'pointer', fontSize: 11, padding: '8px 12px' }}>
                  <Icon name="camera" size={12} /> Fotó
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    aria-label="Étel fotó"
                    onChange={onPickPhoto}
                    style={{ display: 'none' }}
                  />
                </label>
                {photo && (
                  <span className="row gap-xs" style={{ alignItems: 'center', fontSize: 11, color: 'var(--text-secondary)' }}>
                    {photoUrl && (
                      <img
                        src={photoUrl}
                        alt="Fotó előnézet"
                        style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border-subtle)' }}
                      />
                    )}
                    {photo.name}
                    <button
                      aria-label="Fotó eltávolítása"
                      onClick={() => setPhoto(null)}
                      style={{ padding: 2, color: 'var(--text-tertiary)', display: 'inline-flex' }}
                    >
                      <Icon name="x" size={11} />
                    </button>
                  </span>
                )}
              </div>

              {error && (
                <p style={{ fontSize: 11, color: 'var(--error)', marginBottom: 10 }}>{error}</p>
              )}

              <p className="text-secondary" style={{ fontSize: 11, lineHeight: 1.5, marginBottom: 14 }}>
                Írd le, mit ettél, vagy tölts fel egy fotót — az AI felismeri a tételeket és
                megbecsüli a makrókat. Mentés előtt mindent átnézhetsz.
              </p>

              <div className="row gap-sm">
                <button className="cta-ghost flex-1" onClick={close}>Mégse</button>
                <button className="cta-primary flex-1" onClick={() => void submit()} disabled={!canSubmit}>
                  <Icon name="sparkle" size={14} /> AI naplózás
                </button>
              </div>
            </>
          )}

          {phase === 'drafting' && (
            <div className="card" style={{
              padding: 24, textAlign: 'center',
              background: 'color-mix(in srgb, var(--coral) 4%, transparent)',
              borderColor: 'var(--line)',
            }}>
              <Icon name="sparkle" size={20} color="var(--coral)" />
              <div style={{ fontFamily: 'var(--ff-display)', fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginTop: 10 }}>
                Elemzem az étkezést…
              </div>
              <div className="np-twinkle" style={{
                width: 12, height: 12, borderRadius: '50%', margin: '16px auto 0',
                border: '1.5px solid var(--coral)',
              }} />
            </div>
          )}

          {phase === 'review' && lines.length === 0 && (
            <>
              <GhostState
                message="Nem ismertem fel ételt a megadottakból."
                ctaLabel="Kézi naplózás"
                onCta={() => goManual(close)}
              />
              <div className="row gap-sm" style={{ marginTop: 14 }}>
                <button className="cta-ghost flex-1" onClick={() => setPhase('input')}>Vissza</button>
              </div>
            </>
          )}

          {phase === 'review' && lines.length > 0 && (
            <>
              {/* Slot selector */}
              <span className="label-mono" style={{ fontSize: 8.5, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>MIKOR</span>
              <div className="row gap-xs" style={{ margin: '7px 0 10px', padding: 5, background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}>
                {SLOTS.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSlot(s.id)}
                    aria-label={s.label}
                    aria-pressed={slot === s.id}
                    className={'chip flex-1' + (slot === s.id ? ' brand' : '')}
                    style={{ justifyContent: 'center', padding: '8px 0', fontSize: 11, textTransform: 'uppercase' }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Editable title */}
              <div className="card" style={{ padding: '8px 10px', marginBottom: 10 }}>
                <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Étkezés neve</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  aria-label="Étkezés neve"
                  placeholder="pl. Csirkés wrap + latte"
                  style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 2, width: '100%', background: 'transparent' }}
                />
              </div>
              {note && (
                <p className="text-secondary" style={{ fontSize: 11, lineHeight: 1.5, marginBottom: 10 }}>{note}</p>
              )}

              {/* Line list */}
              <div className="col gap-sm" style={{ marginBottom: 12 }}>
                {lines.map(l => {
                  const kcalPreview = l.per ? Math.round((l.kcal / l.per) * l.amount) : l.kcal
                  return (
                    <div key={l.key} className="card" style={{ padding: '11px 12px' }}>
                      <div className="row" style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {sourceBadge(l.source)}
                        <span className="flex-1" style={{ fontSize: 13, color: 'var(--text-primary)', minWidth: 0 }}>{l.name}</span>
                        <span className="label-mono" style={{ fontSize: 10, color: 'var(--coral)', flexShrink: 0 }}>{kcalPreview} kcal</span>
                        <button
                          onClick={() => removeLine(l.key)}
                          aria-label="Sor törlése"
                          style={{ padding: 3, color: 'var(--text-tertiary)', flexShrink: 0, display: 'inline-flex' }}
                        >
                          <Icon name="x" size={12} />
                        </button>
                      </div>
                      <div className="row gap-xs" style={{ alignItems: 'center', marginTop: 8 }}>
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          value={l.amount}
                          onChange={(e) => setAmount(l.key, e.target.value)}
                          aria-label="Mennyiség"
                          style={{ fontSize: 13, color: 'var(--text-primary)', width: 72, background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', padding: '4px 8px' }}
                        />
                        <span className="label-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{l.unit}</span>
                      </div>
                      {l.needsReview && (
                        <p style={{ fontSize: 11, color: 'var(--warning)', marginTop: 8 }}>
                          Az AI nem teljesen biztos ebben a sorban — ellenőrizd a számokat.
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="row gap-sm">
                <button className="cta-ghost flex-1" onClick={() => setPhase('input')}>Vissza</button>
                <button className="cta-primary flex-1" onClick={() => confirm(close)}>
                  <Icon name="check" size={14} /> Naplózás
                </button>
              </div>
            </>
          )}

          <div style={{ height: 24 }} />
        </>
      )}
    </Sheet>
  )
}
