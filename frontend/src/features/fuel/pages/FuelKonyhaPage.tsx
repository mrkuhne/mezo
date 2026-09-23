// ============================================================
// Mezo · FuelKonyhaPage — a Konyha hub (Fuel Titanium S4, mezo-hygp; fagyasztott manifeszt
// B1 · B2 · B3 · B4 · B10). Ez az a cél, amibe a Receptek és a Kamra összeolvad, és a
// vezérgondolata a „Mentsd el, ami jött": a két rögzítő művelet áll elöl.
//
// Vizuális referencia (Üvegesítés U2, mezo-me75u.2): docs/design_2.0/prototypes/
// uveg-fuel-tobbi.html `konyha()` + docs/design_2.0/2026-09-23-uveg-style-bible.md — a két
// rögzítő kártya és a három poszter `.glass` a saját hue-jukban (`--c`), a 3D ikonkészlettel;
// a Műhely cél-chipjei és a tálkák lapos cellák (üvegben nincs üveg).
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
import { ContentIcon, Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { MozaikPage, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useFuelCountUp } from '@/features/fuel/components/FuelMacroRings'
import { ImportItemSheet } from '@/features/fuel/sheets/ImportItemSheet'
import { recipeSlotFace } from '@/features/fuel/logic/recipeSlotFace'

/** A Receptműhely öt preset-célja a Konyha poszterén — a prototípus `GOALS` sora.
 *  Csak ARC (ikon + felirat): a célok viselkedése a Műhely lapjáé, ez itt a meghívó.
 *  Üveg (mezo-me75u.2): lapos chipek a 3D ikonnal és a felirattal (uveg-fuel-tobbi.html). */
const WORKSHOP_GOAL_FACES: { id: string; label: string; icon: Icon3DName }[] = [
  { id: 'high_protein', label: 'Magas fehérje', icon: 't-meat' },
  { id: 'pre_workout', label: 'Edzés előtt', icon: 't-bolt' },
  { id: 'post_workout', label: 'Edzés után', icon: 't-dumbbell' },
  { id: 'before_bed', label: 'Lefekvés előtt', icon: 't-moon' },
  { id: 'breakfast', label: 'Reggeli', icon: 't-sun' },
]

type Hue = React.CSSProperties & Record<'--c' | '--i', string | number>

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
            <button type="button" className="fkx-capture glass rise"
              style={{ '--c': 'var(--dv-lav)', '--i': 0 } as Hue}
              onClick={() => navigate('/fuel/recipes/new')}>
              <span className="fkx-capture-art" aria-hidden="true"><Icon3D name="t-book" size={50} /></span>
              <b className="fkx-plus" aria-hidden="true">＋</b>
              <strong>Recept mentése</strong>
              <small>Kézzel, a saját szavaiddal</small>
            </button>
            <button type="button" className="fkx-capture glass rise"
              style={{ '--c': 'var(--dv-amber)', '--i': 1 } as Hue}
              onClick={() => setImportOpen(true)}>
              <span className="fkx-capture-art" aria-hidden="true"><Icon3D name="t-stack" size={50} /></span>
              <b className="fkx-plus" aria-hidden="true">＋</b>
              <strong>Új elem a kamrába</strong>
              <small>Fotó a címkéről vagy egy termék linkje</small>
            </button>
          </div>

          {/* B10: a Receptműhely a hub SAJÁT posztere — a gomb lejött a recept-listáról. */}
          <button type="button" className="fkx-poster is-workshop glass rise"
            style={{ '--c': 'var(--dv-lav)', '--i': 2 } as Hue}
            onClick={() => navigate('/fuel/recipes/muhely')}>
            <span className="fkx-poster-head">
              <span className="fkx-poster-title">
                <span aria-hidden="true"><Icon3D name="t-chef" size={34} /></span>
                <strong>Receptműhely</strong>
              </span>
              <b aria-hidden="true">↗</b>
            </span>
            <span className="fkx-ws-copy">
              <strong className="uv-voice">Főzzünk ki valamit</strong>
              <small>Te mondod a célt, én a hozzávalót — a számokat a kamrád adja.</small>
            </span>
            {/* A jóváhagyott poszter cél-sora: a Műhely öt preset-célja egy pillantásra — ígéret
                arról, mit lehet itt kérni. Lapos chipek (üvegben nincs üveg). */}
            <span className="fkx-ws-goals" aria-hidden="true">
              {WORKSHOP_GOAL_FACES.map(g => (
                <i key={g.id}>
                  <Icon3D name={g.icon} size={18} />{g.label}
                </i>
              ))}
            </span>
          </button>

          <button type="button" className="fkx-poster is-recipes glass rise"
            style={{ '--c': 'var(--dv-sage)', '--i': 3 } as Hue}
            onClick={() => navigate('/fuel/recipes')}>
            <span className="fkx-poster-head">
              <span className="fkx-poster-title">
                <span aria-hidden="true"><Icon3D name="t-book" size={34} /></span>
                <strong>Receptek</strong>
              </span>
              <b aria-hidden="true">↗</b>
            </span>
            <span className="fkx-poster-main">
              <strong>{recipeCount}</strong>
              <small aria-hidden="true">recept</small>
            </span>
            <span className="fkx-bowls" aria-hidden="true">
              {recipes.slice(0, 5).map(r => {
                const face = recipeSlotFace(r.category)
                return (
                  <i key={r.id} style={{ '--slot': face.color } as React.CSSProperties}>
                    <ContentIcon name={face.icon} size={26} />
                  </i>
                )
              })}
            </span>
            {favouriteTimes > 0 && (
              <span className="fkx-poster-foot">
                <span aria-hidden="true"><Icon3D name="t-score" size={18} /></span>
                <span>Kedvenced most: <b>{favourite.name}</b> · {favouriteTimes}× etted</span>
              </span>
            )}
          </button>

          <button type="button" className="fkx-poster is-pantry glass rise"
            style={{ '--c': 'var(--dv-amber)', '--i': 4 } as Hue}
            onClick={() => navigate('/fuel/kamra')}>
            <span className="fkx-poster-head">
              <span className="fkx-poster-title">
                <span aria-hidden="true"><Icon3D name="t-stack" size={34} /></span>
                <strong>Kamra</strong>
              </span>
              <b aria-hidden="true">↗</b>
            </span>
            <span className="fkx-poster-main">
              <strong>{pantryCount}</strong>
              <small aria-hidden="true">tétel</small>
            </span>
            <span className="fkx-split" role="img" aria-label={`${foods} étel, ${extras} kiegészítő`}>
              <i style={{ '--w': `${items.length ? (foods / items.length) * 100 : 0}%` } as React.CSSProperties} />
            </span>
            <span className="fkx-legend">
              <em><span aria-hidden="true"><Icon3D name="t-carb" size={20} /></span>{foods} étel</em>
              <em><span aria-hidden="true"><Icon3D name="t-supps" size={20} /></span>{extras} kiegészítő</em>
            </span>
          </button>
        </PageBody>
      </EntranceGroup>

      {importOpen && <ImportItemSheet onClose={() => setImportOpen(false)} />}
    </MozaikPage>
  )
}
