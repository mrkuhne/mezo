# Fuel — a számok megmaradnak, a részletek a helyükre kerülnek

2026-09-09 · `mezo-88jw.12` · külön, kattintható vizuális prototípus.

**[Megnyitás](http://127.0.0.1:5196/#diary)**

**[Mobilkeretes előnézet](http://127.0.0.1:5196/phone.html)** — a kért telefonház,
kamerasziget, státuszsáv és gesztuscsík külön keretezi a működő prototípust.
A belső mobilnézet 384 px széles; a teljes készülék arányosan illeszkedik az ablakba.
Az alkalmazás és a panelek a telefon kijelzőjén belül maradnak, ugyanazzal a helyi mentéssel.

Daniel iránya: az új Boop navigáció és nyugodtabb hierarchia a Design 2.0 színeivel,
Clay ikonjaival és a jelenlegi Fuel részletes számaival, makróival, AI score-jával.
A külön **Ma megszűnik**: a napi áttekintés és az előzmények a Naplóba kerülnek.
Az állandó alsó sor: **színes mezo területváltó + Napló · Receptek · Kamra · Stack · Beállítások**.
Ez az ötfüles modell a prototípusra elfogadott irány, nem a production alkalmazás átírása.
[Döntés](../../decisions/0040-fuel-five-entry-prototype.md).

## Indítás

A repo gyökeréből:

```bash
python3 -m http.server 5196 --bind 127.0.0.1 --directory docs/design_3.0/fuel-prototype
```

Nincs csomagtelepítés, build vagy külső szolgáltatás. Natív ES modulok, HTML/CSS,
helyi betűk és SVG sprite-ok. A forrás módosítása után frissítsd a böngészőt.
A `file://` megnyitás a modulok miatt nem támogatott.

## Kipróbálható oldalak és utak

| Család | Nézetek | Mit lehet kipróbálni? |
| --- | --- | --- |
| Napló | `diary`, `week` | Kcal/makró/rost/víz, napi étkezések, dátumválasztó, heti grafikon és visszanyitható napok. |
| Keret | `energy`, `movement` | Alap + mozgás + cél bontás; a mintamozgás átállítása a napi keretet frissíti. |
| Étkezés | `log`, `meal`, `score` | Kamra + recept + szöveg/fotópélda egy vázlatban; név, időpont, nap, gramm; mentés, javítás, törlés/undo; 8 lenyitható score-nézőpont. |
| Receptek | `recipes`, `recipe`, `recipe-edit`, `workshop`, `cook` | Keresés, kategória/kedvenc, adagváltás, hozzávaló-adatlapok, szerkesztő, Műhely-vázlat és vezetett főzésből étkezésrögzítés. |
| Kamra | `pantry`, `item`, `item-edit`, `catalog`, `import`, `shopping` | Keresés, saját tápérték/készlet módosítása, katalógusminták, jelölt importelőnézet; receptből hiánylista, pipálás és eltávolítás. |
| Stack | `stack`, `stack-today`, `protocol`, `timing`, `matches`, `stack-item` | Következő bevétel, pipa/undo, napi idővonal, tartós protokoll és indoklás, időzítési/étkezési nézet, tétel hozzáadása és szerkesztése. |
| Gyógyszernapló | `medications` | Saját tétel, szerkesztés, napi bevétel, szüneteltetés/újraaktiválás. A Stackből és a Beállításokból is elérhető. |
| Beállítások | `settings`, `settings-goals`, `settings-rhythm`, `slots`, `plan` | Keret és makrók; étkezésszám/koffeinhatár; ablakidő és 100%-os elosztás; napokra mentett receptötletek a mintahét végéig. |
| Közös panelek | területválasztó, beszélgetés, víz, hozzávaló/receptválasztó | A színes kétszemű karakter megmarad; a chat vázlata és beszélgetése megmarad a panelek között. |

A listából nyisd meg az azonosítóhoz kötött részletet: például `#recipe?id=bowl`
vagy `#score?id=m1`. A böngészőelőzmény és a fejléc visszagombja a tényleges
belépési helyet követi. Közvetlen linknél a visszagombnak értelmes szülője van.
A listakeresés és a görgetési hely az oldalak közötti visszalépésnél megmarad.

## Vizuális szerződés

- Meleg papír, zsálya napi keret, korall fehérje, arany szénhidrát, levendula zsír/score, kék víz.
- Geist a számokhoz és kezelőelemekhez; Fraunces és dőlt hangsúly a címsorokhoz.
- Az eredeti [Clay ikoncsalád](../../design_2.0/assets/README.md) helyi másolata; azonos szimbólumazonosítók.
- Finom oldalsó bemetszések és körívek a kiemelt kereten; részletekhez sorok,
  szerkesztőkhöz célzott űrlap, receptekhez saját illusztrált gyűjtemény.
- A mezo szerepváltó kör alakú, kétszemű, tónust váltó CSS karaktertanulmány.
  Nem az Avatar Lab motorjának másolata vagy integrációja.
- A dock külön elrendezési sor, nem takarja a görgethető munkafelületet.
- A mozgás csökkenthető; a panelek natív dialogok, Escape-pel zárhatók.

## Mintaadatok és határok

Az állapot kizárólag `localStorage`-ba kerül, `mezo-fuel-clay-lab-v1` kulccsal.
A másik, 5193-as Boop prototípus állapotát nem olvassa vagy módosítja.
A mintanap 2026. szeptember 9.; szeptember 8. történeti mintát tartalmaz. A hét
többi rögzítés nélküli napja nem kap kitalált kalóriát vagy pontszámot.

Az étkezési mennyiségek és receptadagok ténylegesen újraszámolják a tápértékeket
a szerkeszthető mintakamrából. Ez nem a production táplálkozási modell másolata:
a mintakamra értékeinek módosítása a korábbi mintanaplók számítását is megváltoztatja.
A productionben meglévő frozen nutrient snapshot itt nincs implementálva.

Az **AI score előre adott demonstráció**: 8 egyenlő súlyú mintadimenzió, nem a
production pontozó algoritmus. Az új étkezés 84-es mintapontot kap, újraértékeléskor
a demópont nem változik. Az AI chat, receptműhely, fotó és import szimulált;
nem történik kép-/linkfeltöltés, külső lekérés vagy AI-hívás. A szöveges minta
csak a kamrában szereplő neveket és az előttük álló grammot ismeri fel.

A készlet, bevásárlólista és főzés kézi próba; a bevásárlópipa és étkezésmentés
nem von le vagy tölt fel készletet. A terv mentése nem naplóz elfogyasztott ételt.
A tervező napi receptválasztó, nem a production heti energia-/protokollmotor.
A makróprofil itt elnevezés; a grammokat kézzel szerkeszted. A Stackben explicit
mentés szemlélteti a szerkesztést; a production occurrence-autosave nem fut.
A nem Fuel terek a szerepváltóból a régi Boop prototípushoz vezető átjárást adnak.

## Ellenőrzés és források

```bash
node --test docs/design_3.0/fuel-prototype/model.test.mjs
node --check docs/design_3.0/fuel-prototype/app.mjs
```

8 állapotteszt: étkezés javítása, adagszorzó, invalid mennyiség, napelhatárolás,
mozgás–keret kapcsolat, bevétel visszavonása, hiánylista duplikációvédelme,
sérült mentés kezelése. Böngészőben 28 olvasási útvonal bejárva 390 és 360 px-en
vízszintes túlcsordulás nélkül; az alsó hat vezérlő legalább 44 px széles.
Receptből étkezés, 150 → 200 g lazac, mentés/részlet/score és napi összegzés,
valamint Stack bevétel/undo külön interakciós próbát kapott.

Termékfunkciók: [Fuel](../../features/fuel.md), [Pantry](../../features/pantry.md),
[Recipe](../../features/recipe.md), [korábbi Fuel iterációk](../../design_2.0/2026-08-27-fuel-design-iterations.md).
Navigációs referencia: [PR #610](https://github.com/mrkuhne/mezo/pull/610) és a
[korábbi Boop prototípus](http://127.0.0.1:5193/?v=boop#presence/home/today).
Új külső termékkutatás ebben a körben nem történt.
