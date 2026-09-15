// ============================================================
// Mezo · KamraItemDetailPage — EGY kamra-tétel Titán részletező oldala
// (Fuel Titanium S4, mezo-hygp; fagyasztott manifeszt B6 · B7 · B12).
//
// Jóváhagyott vizuális referencia: docs/design_2.0/prototypes/companion-titanium/fuel-pages.js
// `pantryDetailPage` (:93), a fuel-pages.css „Konyha v2" (:497) blokkjával. Anatómia:
// al-fejléc (‹ Kamra + kategória/név + forrás-chip) → osztott hős (ikon + kcal/100 g vagy adag;
// jobbra „A polcodon" és a felvétel módja) → FORRÁS-kártya → étel: Makró-gyűrűk + Minőség
// lapkák /100 g; kiegészítő: a napi protokoll ajtaja → Receptekben → Logolás → műveletek.
//
// B14 owner-DROP, ITT A HELYE: a „Legutóbbi importok" feed megszűnt, és a per-tétel EREDET
// (forrás + mikor) erre a lapra, a `Forrás` kártyára került. Ez a DROP ellenpárja, nem a
// visszacsempészése: egy lista helyett ott áll az eredet, ahol a tételt olvasod.
// B16 owner-DROP: a készlet/lejárat blokk a `SHOW_PANTRY_STOCK` zászló mögött alszik,
// változatlanul — a kód érintetlen, új hivatkozás nem készült rá.
//
// Változatlan viselkedés: `usePantryActions`, a 'stash-' előtag-levágás, az `AddPantryItemSheet`
// előtöltése és definíció-zárolása, a LogFlow előtöltése, a két lépéses törlés, a mai stack-
// projekcióból olvasott „a stackben" hivatkozás és a `Receptekben` élő kereszt-hivatkozás.
//
// ŐSZINTE-NULL: amire a megosztott definíciónak nincs értéke, az „—", nem 0 (mezo-6omv).
// ============================================================
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { IngredientStock, PantryItem, PantryItemInput } from '@/data/types'
import { usePantry, usePantryActions, useStackDay, useRecipes } from '@/data/hooks'
import { buildKamraItems } from '@/features/fuel/logic/kamraItems'
import { SHOW_PANTRY_STOCK } from '@/data/_client/flags'
import { ClayIcon, type ClayIconName } from '@/shared/ui/clay'
import { hu1, huInt } from '@/shared/lib/huNum'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { mealMacroShare } from '@/features/fuel/logic/mealShare'
import { pantryProvenance } from '@/features/fuel/logic/pantryProvenance'
import { recipeSlotFace } from '@/features/fuel/logic/recipeSlotFace'
import { NOVA, FuelMacroShareSection, FuelNutriTiles, type FuelNutriTile }
  from '@/features/fuel/components/FuelQualityBlocks'
import { AddPantryItemSheet } from '@/features/fuel/sheets/AddPantryItemSheet'
import { LogFlowPage } from '@/features/fuel/pages/LogFlowPage'

// The full IngredientStock carries expires/lowExpiry; the bare { qty, unit }
// stock shape does not. Narrow once instead of fighting `in`-narrowing in JSX.
function isFullStock(s: NonNullable<PantryItem['stock']>): s is IngredientStock {
  return 'expires' in s
}

/** Egy tétel arca: ház-hue + clay szimbólum (a prototípus `pantryStyle`-ja ház-tokenekkel). */
const KIND_FACE: Record<string, { color: string; icon: ClayIconName }> = {
  food: { color: 'var(--sage)', icon: 'i-gabona' },
  supplement: { color: 'var(--lav)', icon: 'i-kiegeszito' },
  stim: { color: 'var(--coral)', icon: 'i-lang' },
  med: { color: 'var(--sky)', icon: 'i-injekcio' },
}

// Build a complete PantryItemInput from the displayed item — prefills every
// field of the edit sheet so an edit preserves untouched values. Moved here from
// the retired IngredientDetailSheet.
export function inputFromItem(item: PantryItem): PantryItemInput {
  const base: PantryItemInput = {
    kind: item.kind,
    name: item.name,
    source: item.source,
    per: item.per,
    unit: item.unit,
    stockQty: item.stock?.qty,
    stockUnit: item.stock?.unit,
  }
  // Honest nulls (mezo-xaq5): a field the definition does not carry must stay OUT of the request.
  // The DTO cannot tell an omitted field from an explicit null, and applyDefinitionPartial reads
  // "absent" as "leave unchanged" — so sending null would blank the value on a definition every
  // other user reads. `category` used to be assigned unconditionally, which put an empty string
  // on the wire for a null category. `pkg`/`form` carry the real 403 risk: definitionDiffers has
  // no null-normalization for them, so an echoed "" trips PANTRY_CATALOG_NOT_EDITABLE.
  if (item.brand != null) base.brand = item.brand
  if (item.category != null) base.category = item.category
  // Null macro = "no data on the shared definition" (mezo-6omv). Same OUT-of-request rule.
  if (item.macros) {
    if (item.macros.kcal != null) base.kcal = item.macros.kcal
    if (item.macros.p != null) base.proteinG = item.macros.p
    if (item.macros.c != null) base.carbsG = item.macros.c
    if (item.macros.f != null) base.fatG = item.macros.f
  }
  if (item.fiberG != null) base.fiberG = item.fiberG
  if (item.sugarG != null) base.sugarG = item.sugarG
  if (item.saltG != null) base.saltG = item.saltG
  if (item.saturatedFatG != null) base.saturatedFatG = item.saturatedFatG
  if (item.price != null) base.price = item.price
  if (item.priceUnit != null) base.priceUnit = item.priceUnit
  if (item.pkg != null) base.pkg = item.pkg
  if (item.dose) base.dose = item.dose
  if (item.form != null) base.form = item.form
  if (item.protocol) base.protocol = item.protocol
  return base
}

export function KamraItemDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { ingredients, stash, categoryMeta } = usePantry()
  const { deleteItem } = usePantryActions()
  const { recipes } = useRecipes()
  const { slots } = useStackDay()
  const [editOpen, setEditOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [delArmed, setDelArmed] = useState(false)

  const item = buildKamraItems(ingredients, stash).find(it => it.id === id)

  if (!item) {
    return (
      <div className="fmx-page">
        <div className="fmx-subhead">
          <button type="button" onClick={() => navigate('/fuel/kamra')} aria-label="Vissza">‹ Kamra</button>
          <span><strong>Nincs ilyen tétel.</strong></span>
        </div>
        <p className="fmx-block-empty">
          Lehet, hogy közben levetted a polcról. A Kamrában minden megmaradt tételed ott van.
        </p>
      </div>
    )
  }

  // buildKamraItems prefixes stash (supplement/stim/med) card ids with 'stash-'
  // to keep them collision-free against food ingredient ids. Mutations target the
  // BACKEND id (the raw mock id / real UUID) — strip the prefix once here. Food
  // cards carry the raw ingredient id, so this is a no-op for them.
  const backendId = item.id.startsWith('stash-') ? item.id.slice('stash-'.length) : item.id
  // The stack's occurrences key by the STASH id even for items that also have a food-shaped
  // Ingredient row (kreatin/whey carry BOTH — buildKamraItems represents them by their
  // ingredient id, not 'stash-<id>'): prefer stashRefId when present, else the backend id.
  const stackKey = item.stashRefId ?? backendId
  const catLabel = categoryMeta[item.category ?? '']?.label ?? item.category
  const face = KIND_FACE[item.kind] ?? { color: 'var(--amber)', icon: 'i-polc' as ClayIconName }
  const prov = pantryProvenance(item)
  const isFood = item.kind === 'food'

  const stock = item.stock ?? null
  const stockQty: number | undefined = stock?.qty
  const stockUnit: string | undefined = stock?.unit
  const hasStock = stock != null && typeof stockQty === 'number'
  const stockExpires = stock && isFullStock(stock) ? stock.expires : undefined

  // "a stackben · {zóna} {idő}" cross-link — today's live stack projection, the
  // same composition FuelStackPage reads. Hidden when this item has no occurrence today.
  const stackSlot = slots.find(s => s.entries.some(e => e.pantryItemId === stackKey))

  // "Receptekben" chips (audit gap #5 — usedInRecipes was read from the contract but never
  // displayed anywhere): the real recipe names that reference this pantry item, not the bare
  // count, computed from the live Recipe.ingredients rather than trusting a stale counter.
  const usedInRecipes = recipes.filter(r => r.ingredients.some(l => l.refId === backendId))

  const remove = () => {
    if (!delArmed) { setDelArmed(true); return }
    deleteItem(backendId)
    navigate('/fuel/kamra')
  }

  const hasAnyMacro = item.macros != null
    && (item.macros.kcal != null || item.macros.p != null || item.macros.c != null || item.macros.f != null)
  const perLabel = `${item.per ?? 100} ${item.unit ?? 'g'}`
  const shares = mealMacroShare({ p: item.macros?.p, c: item.macros?.c, f: item.macros?.f })
  // A prototípus per-100 g minőség-lapkái: három tárolt tény + a feldolgozottság (NOVA).
  const nova = item.nova != null ? NOVA[item.nova] : null
  const qualityTiles: FuelNutriTile[] = [
    { label: `Cukor · ${perLabel}`, value: item.sugarG == null ? null : hu1(item.sugarG), unit: 'g', icon: 'i-termes', color: 'var(--rose)' },
    { label: `Só · ${perLabel}`, value: item.saltG == null ? null : hu1(item.saltG), unit: 'g', icon: 'i-kristaly', color: 'var(--sky)' },
    { label: `Telített zsír · ${perLabel}`, value: item.saturatedFatG == null ? null : hu1(item.saturatedFatG), unit: 'g', icon: 'i-avokado', color: 'var(--amber)' },
    { label: nova ? nova.short : 'Feldolgozottság', value: item.nova == null ? null : String(item.nova), unit: 'NOVA', icon: 'i-retegek', color: nova?.color ?? 'var(--sky)' },
  ]

  return (
    <div className="fmx-page fkx-detail" style={{ '--block-color': face.color } as React.CSSProperties}>
      <EntranceGroup>
        <div className="fmx-subhead">
          <button type="button" onClick={() => navigate('/fuel/kamra')} aria-label="Vissza">‹ Kamra</button>
          <span>
            <small>{(catLabel ?? 'KAMRA').toLocaleUpperCase('hu-HU')}</small>
            <strong>{item.name}</strong>
          </span>
          <span className="fkx-source-chip">
            <ClayIcon name={prov.icon} size={20} />{prov.kind}
          </span>
        </div>

        <div className="fmx-detail-hero">
          <span className="fmx-detail-glow" aria-hidden="true" />
          <div className="fmx-detail-left">
            <span className="fmx-detail-art" aria-hidden="true"><ClayIcon name={face.icon} size={96} /></span>
            <div className="fmx-detail-kcal">
              {isFood ? (
                <>
                  <strong>{item.macros?.kcal == null ? '—' : huInt(item.macros.kcal)}</strong>
                  <small>kcal / {perLabel}</small>
                </>
              ) : (
                <>
                  <strong className="fkx-dose">{item.dose ?? '—'}</strong>
                  <small>adag</small>
                </>
              )}
            </div>
          </div>
          <div className="fmx-detail-right">
            <div className="fmx-detail-when">
              <span className="fmx-di-art" aria-hidden="true"><ClayIcon name="i-polc" size={30} /></span>
              <span>
                <strong>A polcodon</strong>
                <small>{item.brand ?? (catLabel ?? 'nincs márka megadva')}</small>
              </span>
            </div>
            <div className="fmx-detail-share">
              <span className="fmx-di-art" aria-hidden="true"><ClayIcon name={prov.icon} size={30} /></span>
              <span>
                <strong>{prov.sourceLabel}</strong>
                <small>{prov.when ?? 'a felvétel ideje nincs rögzítve'}</small>
              </span>
            </div>
          </div>
        </div>

        {/* B14 ellenpárja: a per-tétel EREDET itt él, nem egy import-feedben. */}
        <section className="fkx-source" aria-label="Forrás">
          <span aria-hidden="true"><ClayIcon name={prov.icon} size={34} /></span>
          <span className="fkx-source-copy">
            <strong>Így került a polcra: {prov.kind}</strong>
            <small>{prov.sourceLabel} · {prov.when ?? 'az időpont nincs rögzítve'}</small>
            {/* Megosztott katalógus-definíció: a szerzőt NEVEZZÜK, mert az ő adatát olvasod. */}
            {item.sharedFrom && <em className="fkx-shared">közös · {item.sharedFrom.authorName}</em>}
          </span>
        </section>

        {/* A tápérték-blokk KIND-független: a mezo-1za9 óta egy kiegészítő (kreatin/whey) is
            hordozhat valódi tápértéket, és akkor ugyanúgy jár neki a gyűrű és a lapka-rács. */}
        {hasAnyMacro && (
          <>
            <FuelMacroShareSection shares={shares}
              groupLabel={`A tétel energiájának megoszlása ${perLabel}-ra`}
              frame={`a tétel energiájának`} />
            <section className="fmx-detail-sec">
              <div className="fmx-section"><h2>Minőség</h2></div>
              <FuelNutriTiles tiles={qualityTiles} />
            </section>
          </>
        )}
        {isFood && !hasAnyMacro && (
          <p className="fmx-block-empty">
            Ehhez az elemhez még nincs tápérték — a forrás nem adott értéket.
          </p>
        )}

        {/* Dose/protocol/stack-chip is a KIND fact (any supp/stim/med row), independent of
            whether this particular item also carries a macros object — mezo-1za9 lets
            supplements carry real nutrition data too (kreatin/whey), so both sections can
            legitimately coexist for the same item. */}
        {!isFood && (
          <>
            <div className="fmx-section"><h2>A napodban</h2></div>
            <button type="button" className="fkx-door" onClick={() => navigate('/fuel/stack')}>
              <span aria-hidden="true"><ClayIcon name="i-idozito" size={26} /></span>
              <span>
                <strong>{item.protocol ?? 'Nincs időzítve'}</strong>
                <small>
                  {stackSlot
                    ? `a stackben · ${stackSlot.label} ${stackSlot.time}`
                    : 'A Kiegészítők oldalon pipálod — ott látod a protokollt is'}
                </small>
              </span>
              <b aria-hidden="true">›</b>
            </button>
          </>
        )}

        {/* B16: a készlet/lejárat felület a zászló mögött marad — változatlanul dormant. */}
        {SHOW_PANTRY_STOCK && (
          <>
            <div className="fmx-section"><h2>Készlet</h2></div>
            <p className="fkx-meta">
              {hasStock ? `${stockQty} ${stockUnit}${stockExpires ? ` · ${stockExpires}` : ''}` : '—'}
            </p>
          </>
        )}

        {item.price != null && (
          <p className="fkx-meta">Ár: {huInt(item.price)} Ft{item.priceUnit ? ` ${item.priceUnit}` : ''}</p>
        )}

        {usedInRecipes.length > 0 && (
          <>
            <div className="fmx-section"><h2>Receptekben</h2></div>
            <div className="fkx-used">
              {usedInRecipes.map(r => (
                <button key={r.id} type="button"
                  style={{ '--fkx': recipeSlotFace(r.category).color } as React.CSSProperties}
                  onClick={() => navigate(`/fuel/recipes/${r.id}`)}>
                  <span aria-hidden="true"><ClayIcon name="i-tanyer" size={22} /></span>
                  <span>{r.name}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {hasAnyMacro && (
          <button type="button" className="fkx-cta is-primary" onClick={() => setLogOpen(true)}>
            <span aria-hidden="true"><ClayIcon name="i-tanyer" size={28} /></span>
            <span>Logolás · mai étkezésbe</span>
            <b aria-hidden="true">›</b>
          </button>
        )}

        <div className="fkx-actions">
          <button type="button" onClick={() => setEditOpen(true)}>
            <span aria-hidden="true"><ClayIcon name="i-beallitas" size={20} /></span>Szerkesztés
          </button>
          <button type="button" className="fkx-del" onClick={remove}>
            {delArmed ? 'Biztos? Még egy érintés a törléshez' : 'Törlés'}
          </button>
        </div>
      </EntranceGroup>

      <AddPantryItemSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        editId={backendId}
        initial={inputFromItem(item)}
        definitionLocked={item.catalogEditable === false}
      />
      {logOpen && <LogFlowPage prefill={{ source: 'pantry', pantryItemId: backendId }} onClose={() => setLogOpen(false)} />}
    </div>
  )
}
