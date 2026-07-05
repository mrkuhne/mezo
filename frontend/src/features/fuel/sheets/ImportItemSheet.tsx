// ============================================================
// Mezo · ImportItemSheet (Fuel P6, mezo-bka — real since this slice)
// 3-phase OpenFoodFacts import wizard for adding a new Kamra item:
//   input     → one search field (terméknév VAGY vonalkód) + inert quick-import chips
//   searching → OFF lookup in flight (mock mode: canned fixture after a demo delay)
//   preview   → result list → picked draft (name editable, category select) → "Polcra"
//               runs usePantryActions().importItem and closes
// The old per-vendor scrape wizard is gone (P8 territory); source is always
// 'openfoodfacts'. Camera/OCR/mic chips stay inert affordances (P8+).
// ============================================================
import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { StatCell } from '@/shared/ui/StatCell'
import { SourceBadge } from '@/features/fuel/components/SourceBadge'
import { NovaDot } from '@/features/fuel/components/NovaDot'
import { usePantry, usePantryActions } from '@/data/hooks'
import type { PantryLookupItem } from '@/data/types'

type Phase = 'input' | 'searching' | 'preview'

// The contract's PantryImportRequest category enum — the draft's pick list.
const CONTRACT_CATEGORIES = [
  'vegetables', 'fruits', 'meat', 'fish', 'eggs', 'dairy', 'cheese', 'legumes', 'grains',
  'pasta', 'bakery', 'nuts_seeds', 'oils_fats', 'condiments', 'snacks', 'beverages',
  'supplement', 'other',
] as const

export function ImportItemSheet({ onClose }: { onClose: () => void }) {
  const { categoryMeta } = usePantry()
  const { lookupItems, importItem } = usePantryActions()
  const [phase, setPhase] = useState<Phase>('input')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PantryLookupItem[]>([])
  const [picked, setPicked] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('other')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const search = async () => {
    if (query.trim().length < 2) return
    setPhase('searching')
    setError(null)
    try {
      const found = await lookupItems(query.trim())
      setResults(found)
      setPicked(found.length ? 0 : null)
      setName(found[0]?.name ?? '')
      setPhase('preview')
    } catch {
      setError('A keresés most nem érhető el — próbáld újra kicsit később.')
      setPhase('input')
    }
  }

  const pick = (i: number) => {
    setPicked(i)
    setName(results[i].name)
  }

  const save = async (close: () => void) => {
    if (picked == null || saving) return
    setSaving(true)
    try {
      await importItem({ ...results[picked], name: name.trim() || results[picked].name, category })
      close()
    } catch {
      setError('A mentés nem sikerült — próbáld újra.')
      setPhase('input')
      setSaving(false)
    }
  }

  return (
    <Sheet onClose={onClose} labelledBy="import-item-title">
      {(close) => (
        <>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div className="col">
              <Eyebrow brand>Import · OpenFoodFacts</Eyebrow>
              <div id="import-item-title" className="h-display size-md" style={{ marginTop: 4 }}>Új tétel a Kamrába</div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          <p className="text-secondary" style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 14 }}>
            Keresés az OpenFoodFacts adatbázisban — makrók, tápértékek és NOVA-osztály automatikusan.
            Terméknevet vagy vonalkódot is beírhatsz.
          </p>

          {phase === 'input' && (
            <>
              <div className="card notch-4" style={{ padding: '10px 12px', marginBottom: 10 }}>
                <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Terméknév vagy vonalkód</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void search() }}
                  placeholder="pl. skyr · 5900512300108"
                  style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 4, width: '100%', fontFamily: 'var(--ff-mono)' }}
                />
              </div>

              {error && (
                <p style={{ fontSize: 11, color: 'var(--error)', marginBottom: 10 }}>{error}</p>
              )}

              <div className="card notch-4" style={{ padding: 12, marginBottom: 14, background: 'var(--surface-1)' }}>
                <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>HAMAROSAN · gyors-import</span>
                <div className="row gap-xs mt-sm flex-wrap">
                  <button className="chip" disabled style={{ fontSize: 9, padding: '6px 10px', opacity: 0.5 }}>
                    <Icon name="camera" size={11} /> Címke fotó
                  </button>
                  <button className="chip" disabled style={{ fontSize: 9, padding: '6px 10px', opacity: 0.5 }}>
                    <Icon name="tool" size={11} /> Vonalkód-szkenner
                  </button>
                  <button className="chip" disabled style={{ fontSize: 9, padding: '6px 10px', opacity: 0.5 }}>
                    <Icon name="mic" size={11} /> Diktálás
                  </button>
                </div>
              </div>

              <div className="row gap-sm">
                <button className="cta-ghost notch-4 flex-1" onClick={close}>Mégse</button>
                <button className="cta-primary notch-4 flex-1" onClick={() => void search()} disabled={query.trim().length < 2}>
                  <Icon name="search" size={14} /> Keresés
                </button>
              </div>
            </>
          )}

          {phase === 'searching' && (
            <div className="card notch-12" style={{
              padding: 24, textAlign: 'center',
              background: 'color-mix(in srgb, var(--brand-glow) 4%, transparent)',
              borderColor: 'var(--border-brand)',
            }}>
              <Icon name="search" size={20} color="var(--brand-glow)" />
              <div style={{ fontFamily: 'var(--ff-display)', fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginTop: 10 }}>
                Keresés <SourceBadge source="openfoodfacts" size="lg" />
              </div>
              <div style={{
                width: 12, height: 12, borderRadius: '50%', margin: '16px auto 0',
                border: '1.5px solid var(--brand-glow)', animation: 'pulse 1.2s ease-in-out infinite',
              }} />
            </div>
          )}

          {phase === 'preview' && (
            <>
              {results.length === 0 && (
                <div className="card notch-4" style={{ padding: 14, marginBottom: 12, textAlign: 'center' }}>
                  <span className="text-secondary" style={{ fontSize: 12 }}>
                    Nincs találat erre: „{query}" — próbáld pontosabb névvel vagy vonalkóddal.
                  </span>
                </div>
              )}

              {results.length > 0 && (
                <div className="col gap-xs" style={{ marginBottom: 12 }}>
                  {results.map((r, i) => (
                    <button
                      key={`${r.barcode ?? r.name}-${i}`}
                      onClick={() => pick(i)}
                      className="card notch-4"
                      style={{
                        padding: '10px 12px', textAlign: 'left', width: '100%', cursor: 'pointer',
                        background: picked === i ? 'color-mix(in srgb, var(--brand-glow) 6%, transparent)' : 'var(--surface-1)',
                        borderColor: picked === i ? 'var(--border-brand)' : 'var(--border-subtle)',
                      }}
                    >
                      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <div className="col" style={{ minWidth: 0 }}>
                          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{r.name}</span>
                          <span className="text-tertiary" style={{ fontSize: 10, fontFamily: 'var(--ff-mono)' }}>
                            {r.brand ?? '—'}{r.barcode ? ` · ${r.barcode}` : ''}
                          </span>
                        </div>
                        <div className="row gap-sm" style={{ alignItems: 'center', flexShrink: 0 }}>
                          <span className="label-mono" style={{ fontSize: 10, color: 'var(--brand-glow)' }}>
                            {r.kcal ?? '—'} kcal
                          </span>
                          {r.nova != null && <NovaDot nova={r.nova} />}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {picked != null && results[picked] && (
                <div className="card notch-4" style={{
                  padding: 14, marginBottom: 12,
                  background: 'color-mix(in srgb, var(--brand-glow) 4%, transparent)',
                  borderColor: 'var(--border-brand)',
                }}>
                  <Eyebrow brand>Polcra kerül · /{results[picked].per}{results[picked].unit}</Eyebrow>
                  <div className="card notch-4" style={{ padding: '8px 10px', margin: '10px 0' }}>
                    <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Név</span>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      aria-label="Tétel neve"
                      style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 2, width: '100%' }}
                    />
                  </div>
                  <div className="card notch-4" style={{ padding: '8px 10px', marginBottom: 10 }}>
                    <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Kategória</span>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      aria-label="Kategória"
                      style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 2, width: '100%', background: 'transparent' }}
                    >
                      {CONTRACT_CATEGORIES.map(c => (
                        <option key={c} value={c}>{categoryMeta[c]?.label ?? c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="card notch-4 row" style={{ padding: 10, justifyContent: 'space-between', background: 'var(--surface-1)' }}>
                    <StatCell label={`kcal / ${results[picked].per}${results[picked].unit}`} val={String(results[picked].kcal ?? '—')} sub="" color="var(--brand-glow)" />
                    <StatCell label="P" val={(results[picked].proteinG ?? '—') + 'g'} sub="" color="var(--cat-physiology)" />
                    <StatCell label="C" val={(results[picked].carbsG ?? '—') + 'g'} sub="" color="var(--warning)" />
                    <StatCell label="F" val={(results[picked].fatG ?? '—') + 'g'} sub="" color="var(--cat-preference)" />
                  </div>
                </div>
              )}

              <div className="row gap-sm">
                <button className="cta-ghost notch-4 flex-1" onClick={() => setPhase('input')}>Vissza</button>
                <button
                  className="cta-primary notch-4 flex-1"
                  onClick={() => void save(close)}
                  disabled={picked == null || saving}
                >
                  <Icon name="check" size={14} /> {saving ? 'Mentés…' : 'Polcra'}
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
