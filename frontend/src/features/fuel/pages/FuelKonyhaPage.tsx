// ============================================================
// Mezo · FuelKonyhaPage — a Konyha hub (Fuel Titanium S4, mezo-hygp; fagyasztott manifeszt
// B1 · B2 · B3 · B4 · B10). Ez az a cél, amibe a Receptek és a Kamra összeolvad, és a
// vezérgondolata a „Mentsd el, ami jött": a két rögzítő művelet áll elöl.
//
// Jóváhagyott vizuális referencia: docs/design_2.0/prototypes/companion-titanium/fuel-pages.js
// `konyha` (:25), a fuel-pages.css „Konyha v2 — mosaic posters…" blokkjával (:497).
// Anatómia fentről le:
//   a két rögzítő kártya — Recept mentése (a kézi szerkesztőbe) és Új elem a kamrába (a
//     meglévő import-sheet fotó + link karjával),
//   a Receptműhely SAJÁT posztere (owner-döntés: a gomb lejött a recept-listáról),
//   két ajtó-poszter — Receptek és Kamra, poszter-anatómiával: kiskapitális fejléc,
//     clay-szimbólum és EGY nagy szám; nem lista (owner-döntés).
//
// Owner-DROPok, amik SZÁNDÉKOS hiányok — ne „javítsd" vissza őket:
//   • B5 vonalkód-beolvasás: a backend végpont érintetlen marad, de NINCS UI-hívója,
//   • B14 import-előzmény lista: az eredet a kamra-tétel részletlapján él, nem feedben,
//   • B15 bevásárlólista: nem létezik,
//   • B16 készlet/lejárat: a `SHOW_PANTRY_STOCK` zászló mögött alszik, itt egy szó sem esik róla,
//   • B17 „mit főzzünk itthon lévőből": nincs ilyen felület,
//   • B1 link-alapú RECEPT-import: soha nem volt, és az owner kivette a körből. (A kamra
//     URL-importja ettől független, és marad.)
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePantry, useRecipes } from '@/data/hooks'
import { buildKamraItems } from '@/features/fuel/logic/kamraItems'
import { ClayIcon, type ClayIconName } from '@/shared/ui/clay'
import { MozaikPage, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useFuelCountUp } from '@/features/fuel/components/FuelMacroRings'
import { ImportItemSheet } from '@/features/fuel/sheets/ImportItemSheet'
import { recipeSlotFace } from '@/features/fuel/logic/recipeSlotFace'

/** A Receptműhely öt preset-célja a Konyha poszterén — a prototípus `GOALS` sora.
 *  Csak ARC (ikon + hue): a célok viselkedése a Műhely lapjáé, ez itt a meghívó. */
const WORKSHOP_GOAL_FACES: { id: string; label: string; icon: ClayIconName; color: string }[] = [
  { id: 'high_protein', label: 'Magas fehérje', icon: 'i-hus', color: 'var(--macro-protein)' },
  { id: 'pre_workout', label: 'Edzés előtt', icon: 'i-lang', color: 'var(--amber)' },
  { id: 'post_workout', label: 'Edzés után', icon: 'i-edzes', color: 'var(--sage)' },
  { id: 'before_bed', label: 'Lefekvés előtt', icon: 'i-hold', color: 'var(--lav)' },
  { id: 'breakfast', label: 'Reggeli', icon: 'i-nap', color: 'var(--macro-carbs)' },
]

export function FuelKonyhaPage() {
  const navigate = useNavigate()
  const { recipes } = useRecipes()
  const { ingredients, stash } = usePantry()
  const [importOpen, setImportOpen] = useState(false)

  const items = buildKamraItems(ingredients, stash)
  const foods = items.filter(it => it.kind === 'food').length
  const extras = items.length - foods
  // A felpörgő szám KÖZTES értéke tört — az ajtók darabszáma viszont mindig egész,
  // ezért a megjelenítés kerekít (a többi Fuel-számláló is így tesz).
  const recipeCount = Math.round(useFuelCountUp(recipes.length))
  const pantryCount = Math.round(useFuelCountUp(items.length))
  // A poszter alján az a recept áll, amit a LEGTÖBBSZÖR ettél — ha egyszer sem ettél
  // semmit, a sor őszintén elmarad (nem írunk oda kitalált kedvencet).
  const favourite = [...recipes].sort((a, b) => (b.timesLogged ?? 0) - (a.timesLogged ?? 0))[0]
  const favouriteTimes = favourite?.timesLogged ?? 0

  return (
    <MozaikPage tone="gold" className="fkx-page">
      <EntranceGroup>
        <PageBody className="fkx-body">
          {/* A18/E11 (mezo-qt5q): a Kalauz horgonya — a két gyors-felvétel feltétel nélkül
              renderel, tehát a „Mutasd meg a képernyőn" itt sosem degradál némán. */}
          <div className="fkx-captures" data-kalauz-anchor="konyha-felvetel">
            <button type="button" className="fkx-capture" style={{ '--fkx': 'var(--lav)' } as React.CSSProperties}
              onClick={() => navigate('/fuel/recipes/new')}>
              <span className="fkx-capture-art" aria-hidden="true"><ClayIcon name="i-recept" size={54} /></span>
              <b className="fkx-plus" aria-hidden="true">＋</b>
              <strong>Recept mentése</strong>
              <small>Kézzel, a saját szavaiddal</small>
            </button>
            <button type="button" className="fkx-capture" style={{ '--fkx': 'var(--amber)' } as React.CSSProperties}
              onClick={() => setImportOpen(true)}>
              <span className="fkx-capture-art" aria-hidden="true"><ClayIcon name="i-kamra" size={54} /></span>
              <b className="fkx-plus" aria-hidden="true">＋</b>
              <strong>Új elem a kamrába</strong>
              <small>Fotó a címkéről vagy egy termék linkje</small>
            </button>
          </div>

          {/* B10: a Receptműhely a hub SAJÁT posztere — a gomb lejött a recept-listáról. */}
          <button type="button" className="fkx-poster is-workshop"
            style={{ '--fkx': 'var(--lav)' } as React.CSSProperties}
            onClick={() => navigate('/fuel/recipes/muhely')}>
            <span className="fkx-poster-head">
              <span className="fkx-poster-title">
                <span aria-hidden="true"><ClayIcon name="i-muhely" size={30} /></span>
                <strong>Receptműhely</strong>
              </span>
              <b aria-hidden="true">↗</b>
            </span>
            <span className="fkx-ws-copy">
              <strong>Főzzünk ki valamit</strong>
              <small>Te mondod a célt, én a hozzávalót — a számokat a kamrád adja.</small>
            </span>
            {/* A jóváhagyott poszter cél-sora (`kx-ws-goals`): a Műhely öt preset-célja
                egy pillantásra, a saját hue-jukkal — ígéret arról, mit lehet itt kérni. */}
            <span className="fkx-ws-goals" aria-hidden="true">
              {WORKSHOP_GOAL_FACES.map(g => (
                <i key={g.id} style={{ '--fkx': g.color } as React.CSSProperties} title={g.label}>
                  <ClayIcon name={g.icon} size={22} />
                </i>
              ))}
            </span>
          </button>

          <button type="button" className="fkx-poster is-recipes"
            style={{ '--fkx': 'var(--lav)' } as React.CSSProperties}
            onClick={() => navigate('/fuel/recipes')}>
            <span className="fkx-poster-head">
              <span className="fkx-poster-title">
                <span aria-hidden="true"><ClayIcon name="i-recept" size={30} /></span>
                <strong>Receptek</strong>
              </span>
              <b aria-hidden="true">↗</b>
            </span>
            <span className="fkx-poster-main">
              <strong>{recipeCount}</strong>
              <span className="fkx-bowls" aria-hidden="true">
                {recipes.slice(0, 5).map(r => (
                  <i key={r.id} style={{ '--slot': recipeSlotFace(r.category).color } as React.CSSProperties}>
                    <ClayIcon name="i-tanyer" size={30} />
                  </i>
                ))}
              </span>
            </span>
            {favouriteTimes > 0 && (
              <span className="fkx-poster-foot">
                <span aria-hidden="true"><ClayIcon name="i-kristaly" size={22} /></span>
                <span>Kedvenced most: <b>{favourite.name}</b> · {favouriteTimes}× etted</span>
              </span>
            )}
          </button>

          <button type="button" className="fkx-poster is-pantry"
            style={{ '--fkx': 'var(--amber)' } as React.CSSProperties}
            onClick={() => navigate('/fuel/kamra')}>
            <span className="fkx-poster-head">
              <span className="fkx-poster-title">
                <span aria-hidden="true"><ClayIcon name="i-polc" size={30} /></span>
                <strong>Kamra</strong>
              </span>
              <b aria-hidden="true">↗</b>
            </span>
            <span className="fkx-poster-main">
              <strong>{pantryCount}</strong>
              <span className="fkx-split" role="img" aria-label={`${foods} étel, ${extras} kiegészítő`}>
                <i style={{ '--w': `${items.length ? (foods / items.length) * 100 : 0}%` } as React.CSSProperties} />
              </span>
            </span>
            <span className="fkx-legend">
              <em><span aria-hidden="true"><ClayIcon name="i-gabona" size={18} /></span>{foods} étel</em>
              <em><span aria-hidden="true"><ClayIcon name="i-kiegeszito" size={18} /></span>{extras} kiegészítő</em>
            </span>
          </button>
        </PageBody>
      </EntranceGroup>

      {importOpen && <ImportItemSheet onClose={() => setImportOpen(false)} />}
    </MozaikPage>
  )
}
