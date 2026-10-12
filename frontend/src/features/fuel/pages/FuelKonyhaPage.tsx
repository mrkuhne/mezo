// ============================================================
// Mezo · FuelKonyhaPage — a Konyha hub (Fuel Titanium S4, mezo-hygp; fagyasztott manifeszt
// B1 · B2 · B3 · B4 · B10). Ez az a cél, amibe a Receptek és a Kamra összeolvad, és a
// vezérgondolata a „Mentsd el, ami jött".
//
// Folyadék (F5, mezo-n4wf5.5) — build target: docs/design_2.0/prototypes/vilagos/fuel.js `konyha()`.
// Anatómia fentről le:
//   hős — az ÜRES fazék a Receptműhely meghívója (owner-döntés: itt nincs mért szint); a támasztó tény a
//     valódi darabszám (a polc tételei). A cél-sor DÍSZ, ahogy az élőben is: nem indít vázlatot — a Műhelyt
//     a hős gombja nyitja,
//   1 · Gyors felvétel — Recept mentése (a kézi szerkesztőbe) és Új elem a kamrába (a meglévő import-lap),
//   2 · Receptek — egy sor a darabszámmal és a legtöbbször evett recepttel, alatta az első öt recept jele,
//   3 · Kamra — egy sor a darabszámmal, alatta a polc megoszlása (Étel · Kiegészítő; minden szó egyszer).
//
// Owner-DROPok, amik SZÁNDÉKOS hiányok — ne „javítsd" vissza őket:
//   • B5 vonalkód-beolvasás: a backend végpont érintetlen marad, de NINCS UI-hívója,
//   • B14 import-előzmény lista: az eredet a kamra-tétel részletlapján él, nem feedben,
//   • B15 bevásárlólista: nem létezik,
//   • B16 készlet/lejárat: a `SHOW_PANTRY_STOCK` zászló mögött alszik, itt egy szó sem esik róla,
//   • B17 „mit főzzünk itthon lévőből": nincs ilyen felület,
//   • B1 link-alapú RECEPT-import: soha nem volt, és az owner kivette a körből. (A kamra
//     URL-importja ettől független, és marad.)
//   • a cél-gombok mint külön indítók (a prototípus „Kikerült" listája).
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePantry, useRecipes } from '@/data/hooks'
import type { RecipeCategory } from '@/data/types'
import { useM } from '@/shared/i18n'
import type { Icon3DName } from '@/shared/ui/clay'
import { Btn, Bub, Card, Hero, Page, Pair, Row, Section, useFrameTitle } from '@/shared/ui/folyadek'
import { Pot, SplitBar } from '@/features/fuel/components/folyadek'
import { buildKamraItems } from '@/features/fuel/logic/kamraItems'
import { ImportItemSheet } from '@/features/fuel/sheets/ImportItemSheet'

/** A Receptműhely öt preset-célja a hősben — a prototípus `GOALS` sora. Csak ARC (jel + felirat): a célok
 *  viselkedése a Műhely lapjáé, ez itt a meghívó. A felirat a katalógusból jön, rendereléskor. */
const WORKSHOP_GOALS = [
  { id: 'high_protein', icon: 't-meat' },
  { id: 'pre_workout', icon: 't-bolt' },
  { id: 'post_workout', icon: 't-dumbbell' },
  { id: 'before_bed', icon: 't-moon' },
  { id: 'breakfast', icon: 't-sun' },
] as const satisfies readonly { id: string; icon: Icon3DName }[]

/** Egy recept jele az étkezése szerint (prototípus `CAT`); ismeretlen kategóriára a tányér. */
const RECIPE_ICON: Record<RecipeCategory, Icon3DName> = { breakfast: 't-sun', lunch: 't-bowl', snack: 't-snack', dinner: 't-moon' }

export function FuelKonyhaPage() {
  const M = useM()
  const K = M.fuelKamra
  const navigate = useNavigate()
  const { recipes } = useRecipes()
  const { ingredients, stash } = usePantry()
  const [importOpen, setImportOpen] = useState(false)

  const items = buildKamraItems(ingredients, stash)
  const foods = items.filter(it => it.kind === 'food').length
  const extras = items.length - foods
  // A sor alján az a recept áll, amit a LEGTÖBBSZÖR ettél — ha egyszer sem ettél
  // semmit, a sor őszintén megmondja (nem írunk oda kitalált kedvencet).
  const favourite = [...recipes].sort((a, b) => (b.timesLogged ?? 0) - (a.timesLogged ?? 0))[0]
  const favouriteTimes = favourite?.timesLogged ?? 0

  useFrameTitle({ eyebrow: K.konyha.eyebrow(K.recipes(recipes.length)) })

  return (
    <Page className="fp-konyha">
      <Hero
        label={K.konyha.heroLabel}
        verdict={K.konyha.verdict}
        sub={K.konyha.sub(items.length)}
        left={<span className="fp-pot" aria-hidden="true"><Pot pct={0} size={96} /></span>}
        actions={<Btn onClick={() => navigate('/fuel/recipes/muhely')}>{K.konyha.open}</Btn>}
      >
        {/* A cél-sor dísz: ígéret arról, mit lehet a Műhelyben kérni — nem gombok. */}
        <div className="fp-goals" aria-hidden="true">
          {WORKSHOP_GOALS.map(g => <span key={g.id}><Bub icon={g.icon} size={24} />{K.konyha.goals[g.id]}</span>)}
        </div>
      </Hero>

      <Section n={1} title={K.konyha.quick} />
      {/* A18/E11 (mezo-qt5q): a Kalauz horgonya — a két gyors-felvétel feltétel nélkül
          renderel, tehát a „Mutasd meg a képernyőn" itt sosem degradál némán. */}
      <Card data-kalauz-anchor="konyha-felvetel">
        <Pair className="fp-pair" items={[
          { icon: 't-book', label: <>{K.konyha.saveRecipe}<small>{K.konyha.saveRecipeSub}</small></>, onClick: () => navigate('/fuel/recipes/new') },
          { icon: 't-camera', label: <>{K.konyha.newItem}<small>{K.konyha.newItemSub}</small></>, onClick: () => setImportOpen(true) },
        ]} />
      </Card>

      <Section n={2} title={K.konyha.recipesSection} />
      <Card>
        <Row icon="t-book" title={K.recipes(recipes.length)}
          sub={favouriteTimes > 0 ? K.konyha.favourite(favourite.name, favouriteTimes) : K.konyha.noRecipes}
          onClick={() => navigate('/fuel/recipes')} />
        {recipes.length > 0 && (
          <div className="fp-bubs" aria-hidden="true">
            {recipes.slice(0, 5).map(r => <Bub key={r.id} icon={RECIPE_ICON[r.category] ?? 't-plate'} size={42} />)}
          </div>
        )}
      </Card>

      <Section n={3} title={K.konyha.pantrySection} />
      <Card>
        <Row icon="t-stack" title={K.konyha.onShelf(items.length)} sub={K.konyha.pantrySub} onClick={() => navigate('/fuel/kamra')} />
        {items.length > 0 && (
          <div className="fp-shelfsplit" role="img" aria-label={K.konyha.splitAria(foods, extras)}>
            <SplitBar height={18} parts={[
              { label: K.konyha.food, pct: foods, color: 'var(--dom)', value: String(foods) },
              { label: K.konyha.supplements, pct: extras, color: 'var(--fx-water)', value: String(extras) },
            ]} />
          </div>
        )}
      </Card>

      {importOpen && <ImportItemSheet onClose={() => setImportOpen(false)} />}
    </Page>
  )
}
