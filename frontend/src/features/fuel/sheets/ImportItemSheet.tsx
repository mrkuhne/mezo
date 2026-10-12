// ============================================================
// Mezo · ImportItemSheet (Fuel P6 mezo-bka + P8 Link mode mezo-8vum + Fotó mode mezo-d8tr)
// Two-mode import wizard for adding a new Kamra item, sharing one 3-phase shell:
//   Link          — the P8 URL-scrape: paste a product URL → scrapeItem extracts a draft
//                   (name/macros/category/price + source/confidence provenance) → preview → confirm.
//   Fotó          — the mezo-d8tr photo-extract: one label photo (+ optional front-of-pack photo)
//                   → photoExtract reads a draft off the label → the shared preview →
//                   confirm carries an `origin: 'photo'` provenance marker (no URL).
// All modes end in usePantryActions().importItem and close; Link/Fotó saves pass the draft's
// provenance (source/sourceUrl/confidence/price) through saveDraft.
// Folyadék (F5, mezo-n4wf5.5; prototype `fuel.js` `sheetsC.import` — args link · keres · vazlat · bizonytalan · nincs ·
// hiba): the light sheet + `FoSheetHead`; the Fotó / Link switch is the kit `Seg`; a photo is picked on a dashed drop
// row (solid once it holds a file); the draft is the name + category fields, four tinted cells (kcal · feh. · szénh. ·
// zsír) and the four stored facts (`Nutri`); „Mezo" reads the label (never „az AI").
// Errors are held as KEYS and worded at render, so they follow a language switch (N1.3).
// ============================================================
import { useState, type ChangeEvent } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { useM } from '@/shared/i18n'
import { Acts, Btn, Bub, Empty, Input, Lab, Lk, Note, Seg, Select, Txt } from '@/shared/ui/folyadek'
import { MacroTriple, Nutri } from '@/features/fuel/components/folyadek'
import { KamraSheetHead, KAMRA_SHEET_CLASS } from '@/features/fuel/sheets/KamraSheetHead'
import { pantryCategoryLabel } from '@/features/fuel/logic/kamraItems'
import { pantryProvenance } from '@/features/fuel/logic/pantryProvenance'
import { usePantryActions } from '@/data/hooks'
import type { PantryScrapeDraft } from '@/data/types'

type Phase = 'input' | 'searching' | 'preview'

type ErrKey = 'errLink' | 'errPhoto' | 'errTooBig' | 'errSave'

/** A photo slot: a dashed row that opens the camera / the file picker; solid, with the file's name, once it holds one. */
function Drop({ title, hint, file, onPick }: { title: string; hint: string; file: File | null; onPick: (e: ChangeEvent<HTMLInputElement>) => void }) {
  const M = useM()
  return (
    <label className={file ? 'fp-drop has' : 'fp-drop'}>
      <Bub icon="t-camera" size={40} />
      <span><strong>{title}</strong><small>{file ? M.fuelKamra.import.picked(file.name) : hint}</small></span>
      <input type="file" accept="image/*" capture="environment" aria-label={title} onChange={onPick} />
    </label>
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
  const M = useM()
  const T = M.fuelKamra.import
  const { importItem, scrapeItem, photoExtract } = usePantryActions()
  const [mode, setMode] = useState<Mode>('photo')
  const [phase, setPhase] = useState<Phase>('input')
  const [url, setUrl] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoFile2, setPhotoFile2] = useState<File | null>(null)
  const [draft, setDraft] = useState<PantryScrapeDraft | null>(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('other')
  const [error, setError] = useState<ErrKey | null>(null)
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
      setError('errLink')
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
      setError('errPhoto')
      setPhase('input')
    }
  }

  const pickPhoto = (setter: (f: File | null) => void) => (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    if (f && f.size > MAX_PHOTO_BYTES) {
      setError('errTooBig')
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
      setError('errSave')
      setPhase('input')
      setSaving(false)
    }
  }

  const errorLine = error && <Note tone="bad" role="alert">{T[error]}</Note>

  return (
    <Sheet onClose={onClose} labelledBy="import-item-title" className={KAMRA_SHEET_CLASS}>
      {(close) => (
        <div className="fp-form">
          <KamraSheetHead icon="t-camera" eyebrow={T.sub} title={T.title} titleId="import-item-title" />

          <Txt>{T.lead}</Txt>

          <Seg className="fp-seg" value={mode} onChange={switchMode}
            items={[{ key: 'photo', label: T.photo }, { key: 'link', label: T.link }]} />

          {phase === 'input' && mode === 'link' && (
            <>
              <Lab htmlFor="import-item-url">{T.url}</Lab>
              <Input
                id="import-item-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void scan() }}
                inputMode="url"
                placeholder="https://…"
              />
              {errorLine}
              <Note>{T.linkNote}</Note>
              <Acts>
                <Btn sm onClick={() => void scan()} disabled={!url.trim().startsWith('http')}>{T.read}</Btn>
                <Lk onClick={close}>{M.kit.cancel}</Lk>
              </Acts>
            </>
          )}

          {phase === 'input' && mode === 'photo' && (
            <>
              <Drop title={T.labelPhoto} hint={T.labelPhotoHint} file={photoFile} onPick={pickPhoto(setPhotoFile)} />
              <Drop title={T.frontPhoto} hint={T.frontPhotoHint} file={photoFile2} onPick={pickPhoto(setPhotoFile2)} />
              {errorLine}
              <Note>{T.photoNote}</Note>
              <Acts>
                <Btn sm onClick={() => void extractPhotos()} disabled={!photoFile}>{T.read}</Btn>
                <Lk onClick={close}>{M.kit.cancel}</Lk>
              </Acts>
            </>
          )}

          {phase === 'searching' && (
            <div className="fp-busy" role="status">
              <Bub icon={mode === 'photo' ? 't-camera' : 't-link'} size={48} />
              <strong>{T.reading}</strong>
              <small>{M.fuelKamra.capture[mode === 'photo' ? 'photo' : 'link']}</small>
            </div>
          )}

          {phase === 'preview' && (mode === 'link' || mode === 'photo') && (
            <>
              {draft == null && (
                <Empty icon={mode === 'photo' ? 't-camera' : 't-link'}>
                  {mode === 'photo' ? T.nonePhoto : T.noneLink}
                </Empty>
              )}

              {draft != null && (
                <>
                  <Lab className="fp-grp">{T.goes(draft.per, draft.unit, pantryProvenance({ source: draft.source }).kindLabel)}</Lab>
                  <Lab htmlFor="import-item-name">{M.fuelKamra.add.name}</Lab>
                  <Input id="import-item-name" value={name} onChange={(e) => setName(e.target.value)} aria-label={T.itemName} />
                  <Lab htmlFor="import-item-category">{M.fuelKamra.add.category}</Lab>
                  <Select id="import-item-category" value={category} onChange={(e) => setCategory(e.target.value)}>
                    {CONTRACT_CATEGORIES.map(c => <option key={c} value={c}>{pantryCategoryLabel(c)}</option>)}
                  </Select>
                  <MacroTriple className="fp-lnm" kcal={draft.kcal ?? null} p={draft.proteinG ?? null} c={draft.carbsG ?? null} f={draft.fatG ?? null} />
                  <Nutri fiber={draft.fiberG ?? null} sugar={draft.sugarG ?? null} salt={draft.saltG ?? null} satFat={draft.saturatedFatG ?? null} />
                  {draft.needsReview && <Note tone="warn">{T.unsure}</Note>}
                  {mode === 'photo' && !photoFile2 && (!name.trim() || draft.needsReview) && (
                    <Acts>
                      <label className="fo-lk fp-addphoto">
                        {T.addFront}
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          aria-label={T.addFrontAria}
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null
                            if (!f) return
                            // Same 5 MB pre-check as the input phase (mezo-iqf9) — an oversized
                            // front photo must not fire a doomed server round-trip.
                            if (f.size > MAX_PHOTO_BYTES) {
                              setError('errTooBig')
                              return
                            }
                            setError(null)
                            setPhotoFile2(f)
                            void extractPhotos(f) // re-extract with BOTH images
                          }}
                        />
                      </label>
                    </Acts>
                  )}
                  {errorLine}
                </>
              )}

              <Acts>
                <Btn sm ghost onClick={() => setPhase('input')}>{T.back}</Btn>
                <Btn
                  sm
                  onClick={() => void saveDraft(close)}
                  // Name guard (mezo-a74c): a photo draft can arrive with an unreadable → empty
                  // name; the contract requires name minLength 1, so block the save until typed.
                  disabled={draft == null || saving || !name.trim()}
                >
                  {saving ? T.saving : T.toShelf}
                </Btn>
              </Acts>
              {draft != null && !name.trim() && <Note>{T.needsName}</Note>}
            </>
          )}
        </div>
      )}
    </Sheet>
  )
}
