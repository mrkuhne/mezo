// ============================================================
// Mezo · ImportItemSheet (Fuel P6 mezo-bka + P8 Link mode mezo-8vum)
// Two-mode import wizard for adding a new Kamra item, sharing one 3-phase shell:
//   Keresés (OFF) — the P6 OpenFoodFacts lookup: one search field (terméknév VAGY vonalkód)
//                   → OFF lookup → result list → picked draft → "Polcra".
//   Link          — the P8 URL-scrape: paste a product URL → scrapeItem extracts a draft
//                   (name/macros/category/price + source/confidence provenance) → preview → confirm.
// Both modes end in usePantryActions().importItem and close; the Link save passes the scrape
// provenance (sourceUrl/confidence/price) through. Camera/OCR/mic chips stay inert (P8+).
// ============================================================
import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { StatCell } from '@/shared/ui/StatCell'
import { SourceBadge } from '@/features/fuel/components/SourceBadge'
import { NovaDot } from '@/features/fuel/components/NovaDot'
import { usePantry, usePantryActions } from '@/data/hooks'
import type { PantryLookupItem, PantryScrapeDraft } from '@/data/types'

type Phase = 'input' | 'searching' | 'preview'
type Mode = 'search' | 'link'

// The contract's PantryImportRequest category enum — the draft's pick list.
const CONTRACT_CATEGORIES = [
  'vegetables', 'fruits', 'meat', 'fish', 'eggs', 'dairy', 'cheese', 'legumes', 'grains',
  'pasta', 'bakery', 'nuts_seeds', 'oils_fats', 'condiments', 'snacks', 'beverages',
  'supplement', 'other',
] as const

export function ImportItemSheet({ onClose }: { onClose: () => void }) {
  const { categoryMeta } = usePantry()
  const { lookupItems, importItem, scrapeItem } = usePantryActions()
  const [mode, setMode] = useState<Mode>('search')
  const [phase, setPhase] = useState<Phase>('input')
  const [query, setQuery] = useState('')
  const [url, setUrl] = useState('')
  const [results, setResults] = useState<PantryLookupItem[]>([])
  const [draft, setDraft] = useState<PantryScrapeDraft | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('other')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Switching mode always returns to the input step (each mode has its own input field).
  const switchMode = (m: Mode) => {
    setMode(m)
    setPhase('input')
    setError(null)
  }

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

  const scan = async () => {
    if (!url.trim().startsWith('http')) return
    setPhase('searching')
    setError(null)
    try {
      const found = await scrapeItem(url.trim())
      setDraft(found)
      setName(found?.name ?? '')
      setCategory(found?.category ?? 'other')
      setPhase('preview')
    } catch {
      setError('Az oldal beolvasása nem sikerült — ellenőrizd a linket, vagy próbáld később.')
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

  // Link-mode save: carry the scrape provenance (sourceUrl/confidence/price) through importItem.
  const saveDraft = async (close: () => void) => {
    if (draft == null || saving) return
    setSaving(true)
    try {
      await importItem({
        ...draft,
        name: name.trim() || draft.name,
        category,
        sourceUrl: draft.sourceUrl,
        confidence: draft.confidence,
        priceHuf: draft.priceHuf,
        priceUnit: draft.priceUnit,
      })
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

          <div className="row gap-xs" style={{ marginBottom: 14 }}>
            <button
              className="chip"
              aria-pressed={mode === 'search'}
              onClick={() => switchMode('search')}
              style={{
                flex: 1, justifyContent: 'center', fontSize: 11, padding: '8px 0',
                background: mode === 'search' ? 'color-mix(in srgb, var(--coral) 8%, transparent)' : 'transparent',
                borderColor: mode === 'search' ? 'var(--line)' : 'var(--border-subtle)',
                color: mode === 'search' ? 'var(--text-primary)' : 'var(--text-tertiary)',
              }}
            >
              Keresés (OFF)
            </button>
            <button
              className="chip"
              aria-pressed={mode === 'link'}
              onClick={() => switchMode('link')}
              style={{
                flex: 1, justifyContent: 'center', fontSize: 11, padding: '8px 0',
                background: mode === 'link' ? 'color-mix(in srgb, var(--coral) 8%, transparent)' : 'transparent',
                borderColor: mode === 'link' ? 'var(--line)' : 'var(--border-subtle)',
                color: mode === 'link' ? 'var(--text-primary)' : 'var(--text-tertiary)',
              }}
            >
              Link
            </button>
          </div>

          {phase === 'input' && mode === 'search' && (
            <>
              <div className="card" style={{ padding: '10px 12px', marginBottom: 10 }}>
                <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Terméknév vagy vonalkód</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void search() }}
                  placeholder="pl. skyr · 5900512300108"
                  style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 4, width: '100%' }}
                />
              </div>

              {error && (
                <p style={{ fontSize: 11, color: 'var(--error)', marginBottom: 10 }}>{error}</p>
              )}

              <div className="card" style={{ padding: 12, marginBottom: 14, background: 'var(--surface-1)' }}>
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
                <button className="cta-ghost flex-1" onClick={close}>Mégse</button>
                <button className="cta-primary flex-1" onClick={() => void search()} disabled={query.trim().length < 2}>
                  <Icon name="search" size={14} /> Keresés
                </button>
              </div>
            </>
          )}

          {phase === 'input' && mode === 'link' && (
            <>
              <div className="card" style={{ padding: '10px 12px', marginBottom: 10 }}>
                <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Termékoldal linkje</span>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void scan() }}
                  inputMode="url"
                  placeholder="https://…"
                  aria-label="Termékoldal linkje"
                  style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 4, width: '100%' }}
                />
              </div>

              {error && (
                <p style={{ fontSize: 11, color: 'var(--error)', marginBottom: 10 }}>{error}</p>
              )}

              <p className="text-secondary" style={{ fontSize: 11, lineHeight: 1.5, marginBottom: 14 }}>
                Illeszd be egy termékoldal linkjét (pl. myprotein.hu, gymbeam.hu) — az AI kiolvassa
                a nevet, makrókat és tápértékeket.
              </p>

              <div className="row gap-sm">
                <button className="cta-ghost flex-1" onClick={close}>Mégse</button>
                <button
                  className="cta-primary flex-1"
                  onClick={() => void scan()}
                  disabled={!url.trim().startsWith('http')}
                >
                  <Icon name="sparkle" size={14} /> Beolvasás
                </button>
              </div>
            </>
          )}

          {phase === 'searching' && (
            <div className="card" style={{
              padding: 24, textAlign: 'center',
              background: 'color-mix(in srgb, var(--coral) 4%, transparent)',
              borderColor: 'var(--line)',
            }}>
              <Icon name="search" size={20} color="var(--coral)" />
              <div style={{ fontFamily: 'var(--ff-display)', fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginTop: 10 }}>
                Keresés <SourceBadge source={mode === 'link' ? (draft?.source ?? 'web') : 'openfoodfacts'} size="lg" />
              </div>
              <div className="np-twinkle" style={{
                width: 12, height: 12, borderRadius: '50%', margin: '16px auto 0',
                border: '1.5px solid var(--coral)',
              }} />
            </div>
          )}

          {phase === 'preview' && mode === 'search' && (
            <>
              {results.length === 0 && (
                <div className="card" style={{ padding: 14, marginBottom: 12, textAlign: 'center' }}>
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
                      className="card"
                      style={{
                        padding: '10px 12px', textAlign: 'left', width: '100%', cursor: 'pointer',
                        background: picked === i ? 'color-mix(in srgb, var(--coral) 6%, transparent)' : 'var(--surface-1)',
                        borderColor: picked === i ? 'var(--line)' : 'var(--border-subtle)',
                      }}
                    >
                      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <div className="col" style={{ minWidth: 0 }}>
                          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{r.name}</span>
                          <span className="text-tertiary" style={{ fontSize: 10 }}>
                            {r.brand ?? '—'}{r.barcode ? ` · ${r.barcode}` : ''}
                          </span>
                        </div>
                        <div className="row gap-sm" style={{ alignItems: 'center', flexShrink: 0 }}>
                          <span className="label-mono" style={{ fontSize: 10, color: 'var(--coral)' }}>
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
                <div className="card" style={{
                  padding: 14, marginBottom: 12,
                  background: 'color-mix(in srgb, var(--coral) 4%, transparent)',
                  borderColor: 'var(--line)',
                }}>
                  <Eyebrow brand>Polcra kerül · /{results[picked].per}{results[picked].unit}</Eyebrow>
                  <div className="card" style={{ padding: '8px 10px', margin: '10px 0' }}>
                    <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Név</span>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      aria-label="Tétel neve"
                      style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 2, width: '100%' }}
                    />
                  </div>
                  <div className="card" style={{ padding: '8px 10px', marginBottom: 10 }}>
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
                  <div className="card row" style={{ padding: 10, justifyContent: 'space-between', background: 'var(--surface-1)' }}>
                    <StatCell label={`kcal / ${results[picked].per}${results[picked].unit}`} val={String(results[picked].kcal ?? '—')} sub="" color="var(--coral)" />
                    <StatCell label="P" val={(results[picked].proteinG ?? '—') + 'g'} sub="" color="var(--cat-physiology)" />
                    <StatCell label="C" val={(results[picked].carbsG ?? '—') + 'g'} sub="" color="var(--warning)" />
                    <StatCell label="F" val={(results[picked].fatG ?? '—') + 'g'} sub="" color="var(--cat-preference)" />
                  </div>
                </div>
              )}

              <div className="row gap-sm">
                <button className="cta-ghost flex-1" onClick={() => setPhase('input')}>Vissza</button>
                <button
                  className="cta-primary flex-1"
                  onClick={() => void save(close)}
                  disabled={picked == null || saving}
                >
                  <Icon name="check" size={14} /> {saving ? 'Mentés…' : 'Polcra'}
                </button>
              </div>
            </>
          )}

          {phase === 'preview' && mode === 'link' && (
            <>
              {draft == null && (
                <div className="card" style={{ padding: 14, marginBottom: 12, textAlign: 'center' }}>
                  <span className="text-secondary" style={{ fontSize: 12 }}>
                    Ezen az oldalon nem találtam tápértéket — vidd fel kézzel a Kamrában.
                  </span>
                </div>
              )}

              {draft != null && (
                <div className="card" style={{
                  padding: 14, marginBottom: 12,
                  background: 'color-mix(in srgb, var(--coral) 4%, transparent)',
                  borderColor: 'var(--line)',
                }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <Eyebrow brand>Polcra kerül · /{draft.per}{draft.unit}</Eyebrow>
                    <SourceBadge source={draft.source} />
                  </div>
                  <div className="card" style={{ padding: '8px 10px', margin: '10px 0' }}>
                    <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Név</span>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      aria-label="Tétel neve"
                      style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 2, width: '100%' }}
                    />
                  </div>
                  <div className="card" style={{ padding: '8px 10px', marginBottom: 10 }}>
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
                  <div className="card row" style={{ padding: 10, justifyContent: 'space-between', background: 'var(--surface-1)' }}>
                    <StatCell label={`kcal / ${draft.per}${draft.unit}`} val={String(draft.kcal ?? '—')} sub="" color="var(--coral)" />
                    <StatCell label="P" val={(draft.proteinG ?? '—') + 'g'} sub="" color="var(--cat-physiology)" />
                    <StatCell label="C" val={(draft.carbsG ?? '—') + 'g'} sub="" color="var(--warning)" />
                    <StatCell label="F" val={(draft.fatG ?? '—') + 'g'} sub="" color="var(--cat-preference)" />
                  </div>
                  {draft.needsReview && (
                    <p style={{ fontSize: 11, color: 'var(--warning)', marginTop: 10 }}>
                      Az AI nem teljesen biztos a számokban — ellenőrizd őket mentés előtt.
                    </p>
                  )}
                </div>
              )}

              <div className="row gap-sm">
                <button className="cta-ghost flex-1" onClick={() => setPhase('input')}>Vissza</button>
                <button
                  className="cta-primary flex-1"
                  onClick={() => void saveDraft(close)}
                  disabled={draft == null || saving}
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
