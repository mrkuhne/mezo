---
cim: Étel
szint: Fő szekció
terulet: Étel
allapot: Tervezve
hol: [iPhone app, Háttérrendszer, AI]
szulo:
szakasz: [S3, B2, B4, B6]
osszefoglalo: Egy teljes étkezés-app a Boopon belül — fotóból, szóból vagy vonalkódból rögzített étkezések, pontozás a súlycélhoz mérve, receptek, kamra és heti kép.
---

## Mit csinál
Az Étel szoba a Boop „teljes konyhája”. Nem egy lecsupaszított oldal, hanem egy egész étkezés-app a Boopon
belül (a tulajdonos döntése, 2026-11-11: „teljes étel-app és teljes edzés-app”). Négy belső füle lesz:

- **Ma** — a mai étkezések, a napi keret (mennyi fér még bele), a víz, és Boop tippje a következő étkezésre.
- **Receptek** — a saját receptek, a receptműhely (AI-val együtt összerakott receptek), recept behúzása egy weboldalról.
- **Kamra** — az alapanyagok és termékek, behúzás termékoldalról, címkefotóról vagy vonalkódról.
- **Hét** — a hét napjai a célokhoz mérve.

Étkezést rögzíteni a szobából és a globális **„+”** gombról is lehet: fotóval, szabad szöveggel (szóval is),
vonalkóddal, receptből, alapanyagból vagy a „szokásosak” közül. Boop egy vázlatot készít, amit jóváhagysz —
jóváhagyás nélkül semmi nem kerül be.

## Hogyan működik
A Boop nem talál ki új étkezés-motort: a webes Mezo app **meglévő, kipróbált háttérrendszerére** épül
(étkezés-mentés, AI-vázlat, pontozás, receptek, kamra, behúzások). Ezek ma is élesben futnak a webes appnak.
A Boop ezekre rajzol natív iPhone-felületet, és néhány dolgot, ami ma csak a webes felület logikájában él
(napi étkezési terv, „szokásosak” rangsor, vércukor-sáv), átköltöztet a háttérrendszerbe.

**Ma a Boopban (B2 után):** a Ma oldalon a „Fuel” gömbre koppintva megnyílik egy egyszerű szoba: a mai elfogyasztott
kalória a célhoz képest, a napi útvonal étkezés-állomásai. A „+” lapon már ott az „Étkezés” csempe (Fotó · Szöveg ·
Vonalkód · Recept), de még „hamarosan” választ ad — a valódi rögzítés a B4 szakaszban jön.

## Miért így
- Egy appot akarunk, nem öt külön appot: az Étel szoba ugyanazt a szobavázat követi, mint a többi (ítélet → szint →
  a napok mögötte → teendők), csak belső fülei vannak.
- A háttérrendszer a „agy”: a számokat soha nem az AI adja (az AI csak szöveget ír), így a Boop ugyanazokat a
  számokat mutatja, mint bármelyik másik felület. (Spec §4 újrahasznosítási térkép.)
- A tulajdonos jellemzően fotóval és szöveggel rögzít, ezért ez a fő út.

## Beállítások
Az egyes funkcióoldalak tartalmazzák (rögzítés, pontozás, keret, kamra, receptek).

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `meal`, `meal_item` | Az étkezések és tételeik (befagyasztott tápérték-pillanatképpel) |
| `water_log` | Vízfogyasztás bejegyzései |
| `recipe`, `recipe_ingredient` | Receptek és hozzávalóik |
| `pantry_catalog`, `pantry_item` | Közös termékkatalógus és a saját kamra |
| `diet_settings`, `fuel_settings` | Étrendi beállítások (makróarány, fehérje, víz, rost; étkezésszám, koffein) |
| `protocol`, `protocol_item`, `supplement_intake` | Táplálékkiegészítő-stack és bevételek |

## Mi jön még
- **B4 Étel**: a teljes szoba a négy füllel, minden „megtartott” funkció natívan, plusz az újak: vonalkód, allergének,
  szerveroldali napi keret és „következő étkezés” tipp, recept behúzása weboldalról.
- **B6 A Terv**: étrendi terv („csak ezek a receptek N hétig”) és bevásárlólista.
- **B7**: élő javaslatok („egyél ma +300 kalóriát”) a napi keret alapján.

## Mi marad ki
Gyógyszer-ciklus, kamra árak és készlet, étkezési idősáv-sablon szerkesztő, „Hogy tanultam?” oldal — lásd
[Ami kimarad az Étel szobából](10-ami-kimarad.md).
