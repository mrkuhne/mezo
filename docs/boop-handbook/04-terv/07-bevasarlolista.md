---
cim: Bevásárlólista
szint: Kis funkció
terulet: Terv
allapot: Élesben
hol: [iPhone app, Háttérrendszer]
szulo: 06-terv-csomag
szakasz: [B6]
osszefoglalo: A jóváhagyott heti menüből Boop összeadja, mit kell megvenned, polcok szerint, és minden tétel alatt látod, melyik ételhez kell.
---

## Mit csinál
Az **Étel szoba Hét fülén** (2026-11-28 óta; régen az Évad Lista füle volt, döntés #133) a jóváhagyott heti menü bevásárlólistája látszik.
- **Polcok szerint:** Zöldség, gyümölcs · Hús, hal · Tejtermék · Kamra · Egyéb.
- **Minden tételnél** a mennyiség (például „1,4 kg”, „600 g”) és alatta, melyik ételhez kell („Csirkés rizstál ×3”).
- **Pipálás:** koppintásra kipipálod, ami a kosárba került; a pipa a szerveren marad (újratelepítés után is megvan). Ha
  épp nincs net, kétszer próbálja, utána visszaveszi a pipát és szól.
- **Szokásos tételek:** a mindig otthon tartott dolgaid (alapból olívaolaj, kávé, tojás, só, fűszerpaprika, citrom)
  gombként jelennek meg, és csak akkor kerülnek a listára, ha rájuk koppintasz. A listájukat a „Szokásos tételek”
  gombbal szerkesztheted.
- **Változott:** ha a hét közben módosítasz az évadon (vagy lecserélsz egy ételt a jóváhagyott menüben), a lista tetején
  egy rövid rész mutatja, mi változott — ami több lett, ami új, és ami már nem kell.
- **Megosztás:** a még meg nem vett tételek egyszerű szövegként mennek a megosztás menüből (például üzenetben):
  „Bevásárlólista · nov. 23–29.”, alatta polconként a tételek.
- **Korábbi listák:** minden jóváhagyott hét listája megmarad és visszanézhető.
- Ha még nincs jóváhagyott menü, a fül megmondja, hogy a lista a jóváhagyással készül.

## Hogyan működik
A jóváhagyáskor a háttérrendszer minden étel hozzávalóit összeszorozza az adaggal, és összeadja ugyanannak az
alapanyagnak a mennyiségét az egész hétre. Grammban és milliliterben számol; 1000 fölött kilóban / literben, egy
tizedesre, felfelé kerekítve (például 1350 g → „1,4 kg”), alatta 5-re vagy 10-re felfelé kerekítve. A polcot az alapanyag
kamrabeli kategóriája adja.

## Miért így
A „csak ezek a receptek” étrend gyakorlati párja: ha tudod, mit eszel, tudod, mit vegyél. A szokásos tételek a Plan to
Eat mintáját követik: nem kerülnek fel maguktól, mert otthon általában megvannak.

## Beállítások
Szokásos tételek szerkesztése az Étel Hét fülének listaoldalán.

## Adattáblák
`shopping_list` (hetente egy), `shopping_item` (a tételek: mennyiség, polc, mihez kell, kipipálva, változott),
`season_staple` (a szokásos tételeid). Épít rá: `recipe`, `recipe_ingredient`, `pantry_item`, `pantry_catalog`.

## Mi jön még
Semmi tervezett.

## Mi marad ki
Árak és készlet (lásd az Étel rész „Ami kimarad” oldalát); boltonkénti sorrend.
