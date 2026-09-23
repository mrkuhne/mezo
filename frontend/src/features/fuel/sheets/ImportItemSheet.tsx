// ============================================================
// Mezo · ImportItemSheet (Fuel P6 mezo-bka + P8 Link mode mezo-8vum + Fotó mode mezo-d8tr)
// Two-mode import wizard for adding a new Kamra item, sharing one 3-phase shell:
//   Link          — the P8 URL-scrape: paste a product URL → scrapeItem extracts a draft
//                   (name/macros/category/price + source/confidence provenance) → preview → confirm.
//   Fotó          — the mezo-d8tr photo-extract: one label photo (+ optional front-of-pack photo)
//                   → photoExtract reads a draft off the label → the shared Link-mode preview →
//                   confirm carries an `origin: 'photo'` provenance marker (no URL).
// All modes end in usePantryActions().importItem and close; Link/Fotó saves pass the draft's
// provenance (source/sourceUrl/confidence/price) through saveDraft.
// Üveg (mezo-me75u.2, uveg-fuel-tobbi.html `SH.import`): one gold glass sheet; the Fotó/Link
// switch is a flat segmented pill (the active arm filled gold), the photo drops are dashed
// (free space to fill, bible §3 rank 4), the fields, the searching card and the draft preview
// are flat cells, Mégse/Vissza flat and the go button a gold-lit flat pill (never glass in glass).
// ============================================================
import { useState, type ChangeEvent } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Icon3D } from '@/shared/ui/clay'
import { SourceBadge } from '@/features/fuel/components/SourceBadge'
import { KamraSheetHead, KAMRA_SHEET_CLASS } from '@/features/fuel/sheets/KamraSheetHead'
import { NutrientCells } from '@/features/fuel/components/NutrientCells'
import { usePantry, usePantryActions } from '@/data/hooks'
import { factsOf } from '@/data/fuel/recipeMacros'
import type { PantryScrapeDraft } from '@/data/types'

type Phase = 'input' | 'searching' | 'preview'

/** One number of the draft's macro row — the macro band hue on the value (prototype `.stat`). */
function DraftStat({ label, val, color }: { label: string; val: string; color: string }) {
  return (
    <span className="fkk-stat" style={{ '--c': color } as React.CSSProperties}>
      <b>{val}</b>
      <small>{label}</small>
    </span>
  )
}
type Mode = 'link' | 'photo'

// The contract's PantryImportRequest category enum — the draft's pick list.
const CONTRACT_CATEGORIES = [
  'vegetables', 'fruits', 'meat', 'fish', 'eggs', 'dairy', 'cheese', 'legumes', 'grains',
  'pasta', 'bakery', 'nuts_seeds', 'oils_fats', 'condiments', 'snacks', 'beverages',
  'supplement', 'other',
] as const

export function ImportItemSheet({ onClose }: { onClose: () => void }) {
  const { categoryMeta } = usePantry()
  const { importItem, scrapeItem, photoExtract } = usePantryActions()
  const [mode, setMode] = useState<Mode>('photo')
  const [phase, setPhase] = useState<Phase>('input')
  const [url, setUrl] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoFile2, setPhotoFile2] = useState<File | null>(null)
  const [draft, setDraft] = useState<PantryScrapeDraft | null>(null)
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

  const MAX_PHOTO_BYTES = 5_000_000

  const extractPhotos = async (second?: File | null) => {
    if (!photoFile) return
    const p2 = second !== undefined ? second : photoFile2
    setPhase('searching')
    setError(null)
    try {
      const found = await photoExtract(photoFile, p2 ?? undefined)
      setDraft(found)
      setName(found?.name ?? '')
      setCategory(found?.category ?? 'other')
      setPhase('preview')
    } catch {
      setError('A fotó beolvasása nem sikerült — próbáld élesebb képpel, vagy vidd fel kézzel.')
      setPhase('input')
    }
  }

  const pickPhoto = (setter: (f: File | null) => void) => (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    if (f && f.size > MAX_PHOTO_BYTES) {
      setError('A kép túl nagy (JPEG/PNG/WebP, max 5 MB).')
      return
    }
    setError(null)
    setter(f)
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
        // Provenance follows the DRAFT (mezo-iqf9): a mode flip while the extraction is in
        // flight must not relabel a photo draft as an URL-scrape confirm.
        origin: draft.source === 'photo' ? 'photo' : undefined,
      })
      close()
    } catch {
      setError('A mentés nem sikerült — próbáld újra.')
      setPhase('input')
      setSaving(false)
    }
  }

  return (
    <Sheet onClose={onClose} labelledBy="import-item-title" className={KAMRA_SHEET_CLASS}>
      {(close) => (
        <>
          <KamraSheetHead icon="t-camera" eyebrow="Import · Fotó & Link" title="Új tétel a Kamrába"
            titleId="import-item-title" onClose={close} />

          <p className="fkk-sh-lead">
            Fotózd le a termék címkéjét, vagy illeszd be egy termékoldal linkjét — a nevet, makrókat
            és tápértékeket az AI olvassa ki.
          </p>

          <div className="fkk-seg">
            <button type="button" aria-pressed={mode === 'photo'} onClick={() => switchMode('photo')}>
              Fotó
            </button>
            <button type="button" aria-pressed={mode === 'link'} onClick={() => switchMode('link')}>
              Link
            </button>
          </div>

          {phase === 'input' && mode === 'link' && (
            <>
              <label className="fkk-field">
                <span className="uv-eyebrow">Termékoldal linkje</span>
                <input
                  className="fkk-inp"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void scan() }}
                  inputMode="url"
                  placeholder="https://…"
                  aria-label="Termékoldal linkje"
                />
              </label>

              {error && <p className="fkk-sh-error">{error}</p>}

              <p className="fkk-sh-hint">
                Illeszd be egy termékoldal linkjét (pl. myprotein.hu, gymbeam.hu) — az AI kiolvassa
                a nevet, makrókat és tápértékeket.
              </p>

              <div className="fkk-sh-acts">
                <button type="button" className="fkk-btn is-flat" onClick={close}>Mégse</button>
                <button
                  type="button"
                  className="fkk-btn is-go"
                  onClick={() => void scan()}
                  disabled={!url.trim().startsWith('http')}
                >
                  <Icon3D name="t-score" size={22} /> Beolvasás
                </button>
              </div>
            </>
          )}

          {phase === 'input' && mode === 'photo' && (
            <>
              <div className="fkk-drop uv-empty">
                <label>
                  <span className="fkk-drop-art" aria-hidden="true"><Icon3D name="t-camera" size={40} /></span>
                  <strong>Címke fotó</strong>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    aria-label="Címke fotó"
                    onChange={pickPhoto(setPhotoFile)}
                  />
                </label>
                {photoFile && <span className="fkk-drop-file">✓ {photoFile.name}</span>}
              </div>
              <div className="fkk-drop uv-empty">
                <label>
                  <small>Előlap fotó (opcionális — ha a név nem látszik a címkén)</small>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    aria-label="Előlap fotó"
                    onChange={pickPhoto(setPhotoFile2)}
                  />
                </label>
                {photoFile2 && <span className="fkk-drop-file">✓ {photoFile2.name}</span>}
              </div>

              {error && <p className="fkk-sh-error">{error}</p>}

              <p className="fkk-sh-hint">
                Fotózd le a termék tápérték-táblázatát — az AI kiolvassa a makrókat /100 g bázison.
                A fotó nem kerül tárolásra.
              </p>

              <div className="fkk-sh-acts">
                <button type="button" className="fkk-btn is-flat" onClick={close}>Mégse</button>
                <button
                  type="button"
                  className="fkk-btn is-go"
                  onClick={() => void extractPhotos()}
                  disabled={!photoFile}
                >
                  <Icon3D name="t-score" size={22} /> Beolvasás
                </button>
              </div>
            </>
          )}

          {phase === 'searching' && (
            <div className="fkk-searching uv-flat">
              <span aria-hidden="true"><Icon3D name={mode === 'photo' ? 't-camera' : 't-link'} size={44} /></span>
              <strong>
                Keresés <SourceBadge source={mode === 'photo' ? 'photo' : (draft?.source ?? 'web')} size="lg" />
              </strong>
              <i className="np-twinkle" aria-hidden="true" />
            </div>
          )}

          {phase === 'preview' && (mode === 'link' || mode === 'photo') && (
            <>
              {draft == null && (
                <div className="fkk-draft is-none uv-empty">
                  <span>
                    {mode === 'photo'
                      ? 'Nem találtam használható adatot a fotón — próbáld élesebb képpel, adj hozzá előlap fotót (név/márka), vagy vidd fel kézzel.'
                      : 'Ezen az oldalon nem találtam tápértéket — vidd fel kézzel a Kamrában.'}
                  </span>
                </div>
              )}

              {draft != null && (
                <div className="fkk-draft uv-flat">
                  <div className="fkk-draft-top">
                    <span className="uv-eyebrow">Polcra kerül · /{draft.per}{draft.unit}</span>
                    <SourceBadge source={draft.source} />
                  </div>
                  <label className="fkk-field">
                    <span className="uv-eyebrow">Név</span>
                    <input
                      className="fkk-inp"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      aria-label="Tétel neve"
                    />
                  </label>
                  <label className="fkk-field">
                    <span className="uv-eyebrow">Kategória</span>
                    <select
                      className="fkk-inp"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      aria-label="Kategória"
                    >
                      {CONTRACT_CATEGORIES.map(c => (
                        <option key={c} value={c}>{categoryMeta[c]?.label ?? c}</option>
                      ))}
                    </select>
                  </label>
                  <div className="fkk-stats">
                    <DraftStat label={`kcal / ${draft.per}${draft.unit}`} val={String(draft.kcal ?? '—')} color="var(--dv-amber)" />
                    <DraftStat label="P" val={(draft.proteinG ?? '—') + 'g'} color="var(--macro-protein)" />
                    <DraftStat label="C" val={(draft.carbsG ?? '—') + 'g'} color="var(--macro-carbs)" />
                    <DraftStat label="F" val={(draft.fatG ?? '—') + 'g'} color="var(--macro-fat)" />
                  </div>
                  <div className="fkk-draft-nutri">
                    <NutrientCells nutrients={factsOf(draft)} />
                  </div>
                  {draft.needsReview && (
                    <p className="fkk-sh-warn">
                      Az AI nem teljesen biztos a számokban — ellenőrizd őket mentés előtt.
                    </p>
                  )}
                  {mode === 'photo' && !photoFile2 && (!name.trim() || draft.needsReview) && (
                    <label className="fkk-sh-addphoto">
                      <Icon name="camera" size={11} /> + előlap fotó (név/márka)
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        aria-label="Előlap fotó hozzáadása"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null
                          if (!f) return
                          // Same 5 MB pre-check as the input phase (mezo-iqf9) — an oversized
                          // front photo must not fire a doomed server round-trip.
                          if (f.size > MAX_PHOTO_BYTES) {
                            setError('A kép túl nagy (JPEG/PNG/WebP, max 5 MB).')
                            return
                          }
                          setError(null)
                          setPhotoFile2(f)
                          void extractPhotos(f) // re-extract with BOTH images
                        }}
                      />
                    </label>
                  )}
                  {error && <p className="fkk-sh-error">{error}</p>}
                </div>
              )}

              <div className="fkk-sh-acts">
                <button type="button" className="fkk-btn is-flat" onClick={() => setPhase('input')}>Vissza</button>
                <button
                  type="button"
                  className="fkk-btn is-go"
                  onClick={() => void saveDraft(close)}
                  // Name guard (mezo-a74c): a photo draft can arrive with an unreadable → empty
                  // name; the contract requires name minLength 1, so block the save until typed.
                  disabled={draft == null || saving || !name.trim()}
                >
                  <Icon name="check" size={14} /> {saving ? 'Mentés…' : 'Polcra'}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </Sheet>
  )
}
