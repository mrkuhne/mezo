// ============================================================
// Mezo · KamraItemDetailPage — EGY kamra-tétel részletező oldala
// (Fuel Titanium S4, mezo-hygp; fagyasztott manifeszt B6 · B7 · B12).
//
// Folyadék (F5, mezo-n4wf5.5) — build target: docs/design_2.0/prototypes/vilagos/fuel.js `kamraItem()`.
// Anatómia: hős (márka vagy fajta · a nagy szám: kcal / bázis, kiegészítőnél az adag · az ítélet-mondat ·
// „Mi van 100 grammban?" sáv · gombok: Logolás / Kiegészítők megnyitása, Szerkesztés, két lépéses Törlés)
// → A napodban (csak kiegészítőnél) → Makrók (három fiola) → Minőség (sorok) → Forrás (a polcon · a felvétel
// módja, forrása, ideje, a közös katalógus szerzője KÜLÖN sorban · ár) → Receptekben.
//
// SZABÁLYOK, amik a rajzból nem látszanak:
//   · A tápérték-blokkok a „VAN-E BÁRMELY MAKRÓ" kérdést követik, nem a fajtát: a mezo-1za9 óta egy kiegészítő
//     (kreatin / whey) is hordozhat tápértéket, és akkor ugyanúgy jár neki a Makrók és a Minőség.
//   · A „Mi van 100 grammban?" sáv csak akkor rajzolható, ha MINDHÁROM makró megvan, a bázis 100 g, és a tétel étel;
//     a maradék (víz, rost…) számolt, nem mért.
//   · ŐSZINTE-NULL: amire a megosztott definíciónak nincs értéke, az „—" / „nincs adat", nem 0 (mezo-6omv).
//   · B14 owner-DROP ellenpárja: a per-tétel EREDET (forrás + mikor) ITT él, a Forrás kártyán — nem egy import-feedben.
//   · B16 owner-DROP: a készlet/lejárat blokk a `SHOW_PANTRY_STOCK` zászló mögött alszik, változatlanul.
//   · A forrás, a kategória, a NOVA és az időpont a szervertől ADAT (kulcs / ISO): a felirat és a dátum itt készül
//     (katalógus + `shared/lib/format`). A tétel neve, márkája, adagja és a protokoll-szöveg a felhasználóé: nem fordítjuk.
//
// Változatlan viselkedés: `usePantryActions`, a 'stash-' előtag-levágás, az `AddPantryItemSheet`
// előtöltése és definíció-zárolása, a LogFlow előtöltése, a két lépéses törlés, a mai protokoll-
// vetületből olvasott „a kiegészítőid között" hivatkozás és a `Receptekben` élő kereszt-hivatkozás.
// ============================================================
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { IngredientStock, PantryItem, PantryItemInput } from '@/data/types'
import { usePantry, usePantryActions, useStackDay, useRecipes } from '@/data/hooks'
import { SHOW_PANTRY_STOCK } from '@/data/_client/flags'
import { useM } from '@/shared/i18n'
import { fmtGrouped, fmtNum } from '@/shared/lib/format'
import { Btn, Card, Empty, FrameBack, Hero, Lab, Lk, Page, Row, Section, St, useFrameTitle } from '@/shared/ui/folyadek'
import { MacroVials, SplitBar } from '@/features/fuel/components/folyadek'
import { buildKamraItems, kamraItemIcon, pantryCategoryLabel } from '@/features/fuel/logic/kamraItems'
import { pantryProvenance } from '@/features/fuel/logic/pantryProvenance'
import { recipeSlotFace } from '@/features/fuel/logic/recipeSlotFace'
import { AddPantryItemSheet } from '@/features/fuel/sheets/AddPantryItemSheet'
import { LogFlowPage } from '@/features/fuel/pages/LogFlowPage'

// The full IngredientStock carries expires/lowExpiry; the bare { qty, unit }
// stock shape does not. Narrow once instead of fighting `in`-narrowing in JSX.
function isFullStock(s: NonNullable<PantryItem['stock']>): s is IngredientStock {
  return 'expires' in s
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
  const M = useM()
  const K = M.fuelKamra
  const I = K.item
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { ingredients, stash } = usePantry()
  const { deleteItem } = usePantryActions()
  const { recipes } = useRecipes()
  const { slots } = useStackDay()
  const [editOpen, setEditOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [delArmed, setDelArmed] = useState(false)

  const item = buildKamraItems(ingredients, stash).find(it => it.id === id)
  const catLabel = item ? pantryCategoryLabel(item.category) : null

  useFrameTitle({
    title: item ? item.name : I.notFoundTitle,
    eyebrow: item ? [I.eyebrow, catLabel].filter(Boolean).join(' · ') : I.eyebrow,
  })
  const back = <FrameBack history fallback="/fuel/kamra" className="fo-backpill" label={K.back.pantry}>‹ {K.pantry}</FrameBack>

  if (!item) {
    return (
      <Page className="fp-item">
        {back}
        <Card>
          <Empty icon="t-stack" actions={<Btn sm onClick={() => navigate('/fuel/kamra')}>{K.back.pantry}</Btn>}>
            {I.notFound}
          </Empty>
        </Card>
      </Page>
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
  const prov = pantryProvenance(item)
  const isFood = item.kind === 'food'

  const stock = item.stock ?? null
  const stockQty: number | undefined = stock?.qty
  const stockUnit: string | undefined = stock?.unit
  const hasStock = stock != null && typeof stockQty === 'number'
  const stockExpires = stock && isFullStock(stock) ? stock.expires : undefined

  // "a kiegészítőid között · {idősáv} {idő}" cross-link — today's live protocol projection, the
  // same composition FuelStackPage reads. Hidden when this item has no occurrence today.
  const stackSlot = slots.find(s => s.entries.some(e => e.pantryItemId === stackKey))

  // "Receptekben" (audit gap #5 — usedInRecipes was read from the contract but never
  // displayed anywhere): the real recipes that reference this pantry item, not the bare
  // count, computed from the live Recipe.ingredients rather than trusting a stale counter.
  const usedInRecipes = recipes.filter(r => r.ingredients.some(l => l.refId === backendId))

  const remove = () => {
    if (!delArmed) { setDelArmed(true); return }
    deleteItem(backendId)
    // the deleted item must not stay behind the user (history back)
    navigate('/fuel/kamra', { replace: true })
  }

  const p = item.macros?.p ?? null
  const c = item.macros?.c ?? null
  const f = item.macros?.f ?? null
  const kcal = item.macros?.kcal ?? null
  const hasAnyMacro = kcal != null || p != null || c != null || f != null
  const per = item.per ?? 100
  const unit = item.unit ?? 'g'
  const perLabel = `${per} ${unit}`

  // A fő mondat: ételnél a domináns makró (energia szerint), kiegészítőnél az idősáv saját mondata —
  // egy üzenet sávonként, nem ragasztott szó.
  const basis: 'g' | 'ml' | 'other' = unit === 'g' ? 'g' : unit === 'ml' ? 'ml' : 'other'
  const lead = p == null || c == null || f == null ? null
    : ([['protein', p * 4, p], ['carbs', c * 4, c], ['fat', f * 9, f]] as const).slice().sort((a, b) => b[1] - a[1])[0]
  const sentence = (key: 'protein' | 'carbs' | 'fat', grams: number) =>
    basis === 'other' ? I[key].other(fmtNum(grams), perLabel) : I[key][basis](fmtNum(grams), per)
  const verdict = !isFood
    ? (stackSlot ? I.zone[stackSlot.zone] : I.notScheduledVerdict)
    : !hasAnyMacro ? I.noNutrition
      : lead ? sentence(lead[0], lead[2])
        : I.partNutrition

  // A 100 g-os összetétel: mindhárom makró megvan, a bázis 100 g. A maradék számolt (víz, rost, hamu), nem mért.
  const comp = isFood && unit === 'g' && per === 100 && p != null && c != null && f != null
  const rest = comp ? Math.max(0, Math.round((100 - p - c - f) * 10) / 10) : 0
  const grams = (g: number | null | undefined) => (g == null ? '—' : <>{fmtNum(g)}<small>g</small></>)
  const price = item.price == null ? null
    // a mock „Ft/kg" alakban hordozza az egységet, a szerver „/kg"-ként is adhatja: a pénznem egyszer áll
    : item.priceUnit?.startsWith('Ft') ? K.price(fmtGrouped(item.price), item.priceUnit)
      : K.price(fmtGrouped(item.price), `Ft${item.priceUnit ?? ''}`)

  let n = 0
  return (
    <Page className="fp-item">
      {back}
      <Hero
        art={kamraItemIcon(item)}
        label={item.brand ?? K.kind[item.kind]}
        verdict={(
          <>
            <span className="fo-big fp-n">
              {isFood
                ? (kcal == null ? '—' : fmtGrouped(kcal))
                : <span className="fp-dn">{item.dose ?? '—'}</span>}
              <small>{isFood ? I.kcalPer(perLabel) : I.oneDose}</small>
            </span>
            {verdict}
          </>
        )}
        sub={isFood && !hasAnyMacro ? I.noNutritionSub : undefined}
        actions={(
          <>
            {hasAnyMacro
              ? <Btn onClick={() => setLogOpen(true)}>{I.log}</Btn>
              : !isFood && <Btn onClick={() => navigate('/fuel/stack')}>{I.openSupplements}</Btn>}
            <Lk onClick={() => setEditOpen(true)}>{I.edit}</Lk>
            <Lk bad={delArmed} onClick={remove}>{delArmed ? I.deleteArmed : I.delete}</Lk>
          </>
        )}
      >
        {comp && (
          <div className="fp-comp">
            <Lab>{I.whatsIn}</Lab>
            <SplitBar height={30} parts={[
              { label: M.fuelKozos.macro.protein, pct: p, color: 'var(--fx-protein)', value: I.grams(fmtNum(p)) },
              { label: M.fuelKozos.macro.carbs, pct: c, color: 'var(--fx-carb)', value: I.grams(fmtNum(c)) },
              { label: M.fuelKozos.macro.fat, pct: f, color: 'var(--fx-fat)', value: I.grams(fmtNum(f)) },
              { label: I.rest, pct: rest, color: 'color-mix(in srgb, var(--fx-water) 30%, #fff)', value: I.grams(fmtNum(rest)) },
            ]} />
          </div>
        )}
      </Hero>

      {/* Az adag / protokoll / idősáv a FAJTA ténye (minden kiegészítő, stimuláns, gyógyszer) — független attól,
          hogy a tétel hordoz-e tápértéket is (mezo-1za9), ezért a két rész együtt is állhat. */}
      {!isFood && (
        <>
          <Section n={++n} title={I.inYourDay} />
          <Card>
            <Row icon="t-clock" title={item.protocol ?? I.notScheduled}
              sub={stackSlot ? I.amongSupplements(stackSlot.label, stackSlot.time) : I.supplementsHint}
              onClick={() => navigate('/fuel/stack')} />
          </Card>
        </>
      )}

      {hasAnyMacro && (
        <>
          <Section n={++n} title={I.macros} />
          <Card className="fp-mac"><MacroVials p={p} c={c} f={f} /></Card>
          <Section n={++n} title={I.quality(perLabel)} />
          <Card>
            <Row icon="t-sugar" title={M.fuelKozos.factsLong.sugar} value={grams(item.sugarG)} />
            <Row icon="t-salt" title={M.fuelKozos.factsLong.salt} value={grams(item.saltG)} />
            <Row icon="t-fat" title={M.fuelKozos.factsLong.satFat} value={grams(item.saturatedFatG)} />
            <Row icon="t-processing" title={I.processing}
              sub={item.nova != null ? I.nova(item.nova) : M.fuelKozos.noData}
              {...(item.nova != null
                ? { right: <St tone={item.nova === 1 ? 'ok' : item.nova === 4 ? 'warn' : 'q'}>{M.fuelKozos.nova[`n${item.nova}`]}</St> }
                : { value: '—' })} />
          </Card>
        </>
      )}

      {/* B16: a készlet/lejárat felület a zászló mögött marad — változatlanul alszik. */}
      {SHOW_PANTRY_STOCK && (
        <>
          <Section n={++n} title={I.stock} />
          <Card>
            <Row icon="t-stack" title={I.stock}
              value={hasStock ? `${stockQty} ${stockUnit}${stockExpires ? ` · ${stockExpires}` : ''}` : '—'} />
          </Card>
        </>
      )}

      <Section n={++n} title={I.sourceSection} />
      <Card aria-label={I.sourceSection}>
        <Row icon="t-stack" title={I.onYourShelf} sub={item.brand ?? catLabel ?? I.noBrand} />
        <Row icon={prov.icon} title={I.howItGotHere(prov.kindLabel)}
          sub={(
            <>
              {prov.sourceLabel} · {prov.when ?? I.noTime}
              {/* Megosztott katalógus-definíció: a szerzőt NEVEZZÜK, külön sorban, mert az ő adatát olvasod. */}
              {item.sharedFrom && <span className="fp-shared">{I.shared(item.sharedFrom.authorName)}</span>}
            </>
          )} />
        {price != null && <Row icon="t-coin" title={I.price} value={price} />}
      </Card>

      {usedInRecipes.length > 0 && (
        <>
          <Section n={++n} title={I.usedIn} />
          <Card>
            {usedInRecipes.map(r => (
              <Row key={r.id} icon="t-plate" title={r.name}
                sub={I.recipeSub(recipeSlotFace(r.category).label, r.timesLogged ?? 0)}
                onClick={() => navigate(`/fuel/recipes/${r.id}`)} />
            ))}
          </Card>
        </>
      )}

      <AddPantryItemSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        editId={backendId}
        initial={inputFromItem(item)}
        definitionLocked={item.catalogEditable === false}
      />
      {logOpen && <LogFlowPage prefill={{ source: 'pantry', pantryItemId: backendId }} onClose={() => setLogOpen(false)} />}
    </Page>
  )
}
