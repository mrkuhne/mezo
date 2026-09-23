// ============================================================
// Mezo · FuelRecipesPage (Receptek) — a Konyha egyik ajtaja mögötti könyvtár
// (Fuel Titanium S4, mezo-hygp; fagyasztott manifeszt B8).
//
// Üveg (mezo-me75u.2, owner 2026-09-23 a jóváhagyott prototípuson — prototypes/src/
// uveg-fuel-tobbi-body.html `receptek()`): SORONKÉNT EGY recept, nem két-hasábos csempe-rács.
// Anatómia: al-fejléc (kerek üveg ‹ + KONYHA/Receptek + lapos `＋ Új`) → lapos szűrő-chipek a
// saját darabszámukkal → üveg sorok (a blokk-hue a `--c`: megvilágított kút a blokk 3D
// ikonjával, név, meta-sor, ADAGONKÉNTI kcal jobbra, alatta a három adagonkénti makró-gramm a
// saját sávjával + a lapos levendula pont-pirula) → szaggatott, cselekvésre hívó üres állapot.
//
// B10 owner-döntés: a Receptműhely gombja LEJÖTT erről a lapról — a Műhely a Konyha hub
// saját posztere. Ide NE kerüljön vissza.
//
// Változatlan viselkedés: a szűrés tengelye, a valódi módú betöltő csontváz (mezo-f2z), a
// `＋ Új` a kézi szerkesztőbe, és a sor a részletlapra visz.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Recipe, RecipeCategory } from '@/data/types'
import { useRecipes } from '@/data/hooks'
import { ContentIcon } from '@/shared/ui/clay'
import { hu1, huInt } from '@/shared/lib/huNum'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { recipeSlotFace } from '@/features/fuel/logic/recipeSlotFace'
import { roleLabel } from '@/features/fuel/logic/recipeRole'
import RecipesSkeleton from '@/features/fuel/pages/RecipesSkeleton'

type FilterId = 'all' | RecipeCategory | 'starred'

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'Mind' },
  { id: 'breakfast', label: 'Reggeli' },
  { id: 'lunch', label: 'Ebéd' },
  { id: 'dinner', label: 'Vacsi' },
  { id: 'snack', label: 'Snack' },
  { id: 'starred', label: 'Csillagos' },
]

function matches(r: Recipe, id: FilterId): boolean {
  if (id === 'all') return true
  if (id === 'starred') return r.starred
  return r.category === id
}

/** A per-serving share of a whole-recipe value (the list's one basis, owner 2026-09-23). */
function perServing(v: number, servings: number) {
  return Math.round(v / Math.max(1, servings))
}

const MACROS = [
  { key: 'p', short: 'fehérje', long: 'fehérje', color: 'var(--macro-protein)' },
  { key: 'c', short: 'szénh.', long: 'szénhidrát', color: 'var(--macro-carbs)' },
  { key: 'f', short: 'zsír', long: 'zsír', color: 'var(--macro-fat)' },
] as const

function RecipeRow({ recipe, onOpen }: { recipe: Recipe; onOpen: () => void }) {
  const face = recipeSlotFace(recipe.category)
  const servings = recipe.servings
  const kcal = perServing(recipe.macros.kcal, servings)
  const grams = { p: perServing(recipe.macros.p, servings), c: perServing(recipe.macros.c, servings), f: perServing(recipe.macros.f, servings) }
  const top = Math.max(grams.p, grams.c, grams.f, 1)
  const mins = recipe.prepMins + recipe.cookMins
  const scorePct = recipe.mezoFit.score == null ? null : Math.round(recipe.mezoFit.score * 100)
  return (
    <button type="button" className="fkx-recipe-row glass rise"
      style={{ '--c': face.color } as React.CSSProperties} onClick={onOpen}>
      <span className="fkx-rrow-top">
        <span className="uv-well" aria-hidden="true"><ContentIcon name={face.icon} size={34} /></span>
        <span className="fkx-rrow-copy">
          <strong>{recipe.name}</strong>
          <small>
            {face.label}{mins > 0 ? ` · ${mins} perc` : ''}
            {/* A szerep a MÉRCÉT nevezi meg, amihez a pontszám mér (mezo-uavr). Az „Általános" a
                hallgatólagos alapeset, ezért SOHA nem kap jelölést. */}
            {recipe.role !== 'standard' && <> · <em className="fkx-role">{roleLabel(recipe.role)}</em></>}
            {servings > 1 ? ` · ${servings} adag` : ''}
          </small>
        </span>
        <span className="fkx-rrow-kcal"><b className="uv-tint">{huInt(kcal)}</b><small>kcal / adag</small></span>
      </span>
      <span className="fkx-rrow-foot">
        <span className="fkx-rrow-macros" role="img"
          aria-label={`Makrók adagonként: ${MACROS.map(m => `${m.long} ${grams[m.key]} g`).join(', ')}`}>
          {MACROS.map(m => (
            <span key={m.key} style={{ '--c': m.color } as React.CSSProperties}>
              <em><b>{huInt(grams[m.key])}</b>g {m.short}</em>
              <span className="uv-bar"><b style={{ '--w': `${(grams[m.key] / top) * 100}%` } as React.CSSProperties} /></span>
            </span>
          ))}
        </span>
        {/* The score is a flat lavender-lit pill inside the glass row (never glass in glass);
            a span, not a button: the whole row is the one tap target (it always was — the old
            tile chip had no handler of its own). */}
        {scorePct == null ? (
          <span className="fmx-score is-pending fkx-rrow-score">
            <ContentIcon name="t-other" size={22} /><b>folyamatban</b>
          </span>
        ) : (
          <span className="fmx-score fkx-rrow-score" role="img" aria-label={`AI értékelés: ${hu1(scorePct / 10)}`}>
            <ContentIcon name="t-score" size={22} /><b>{hu1(scorePct / 10)}</b>
          </span>
        )}
      </span>
    </button>
  )
}

export function FuelRecipesPage() {
  const navigate = useNavigate()
  const { recipes, pending } = useRecipes()
  const [filter, setFilter] = useState<FilterId>('all')

  const filtered = recipes.filter(r => matches(r, filter))

  // Real-mode loading window — skeleton before the empty-state list (hooks are all
  // above, so hook order stays stable). Mock mode never sets pending (mezo-f2z).
  if (pending) return <RecipesSkeleton />

  return (
    <div className="fmx-page fkx-library fkx-recipes">
      <EntranceGroup>
        <div className="fmx-subhead">
          <button type="button" className="glass is-round" onClick={() => navigate('/fuel/konyha')} aria-label="Vissza a Konyhába">‹</button>
          <span>
            <small>KONYHA</small>
            <strong>Receptek</strong>
          </span>
          <button type="button" className="fkx-head-act is-on" onClick={() => navigate('/fuel/recipes/new')}>
            ＋ Új
          </button>
        </div>

        <div className="fkx-filters" role="group" aria-label="Recept-szűrő" data-kalauz-anchor="receptek-tabs">
          {FILTERS.map(f => {
            const n = recipes.filter(r => matches(r, f.id)).length
            const face = f.id === 'all' || f.id === 'starred' ? null : recipeSlotFace(f.id)
            return (
              <button key={f.id} type="button" aria-pressed={filter === f.id}
                style={{ '--c': face?.color ?? 'var(--dv-lav)' } as React.CSSProperties}
                onClick={() => setFilter(f.id)}>
                {face && <ContentIcon name={face.icon} size={18} />}
                {f.label}<b>{n}</b>
              </button>
            )
          })}
        </div>

        {filtered.length > 0 ? (
          <div className="fkx-recipe-list">
            {filtered.map(r => (
              <RecipeRow key={r.id} recipe={r} onOpen={() => navigate(`/fuel/recipes/${r.id}`)} />
            ))}
          </div>
        ) : (
          <div className="fkx-empty uv-empty" style={{ '--c': 'var(--dv-sage)' } as React.CSSProperties}>
            <ContentIcon name="t-plate" size={52} />
            <strong>Ebben a blokkban még nincs recepted.</strong>
            <button type="button" className="glass" onClick={() => navigate('/fuel/recipes/new')}>Mentsünk egyet ＋</button>
          </div>
        )}
      </EntranceGroup>
    </div>
  )
}
