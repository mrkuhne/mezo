---
cim: Az Étel szoba Ma füle
szint: Funkció
terulet: Étel
allapot: Élesben
hol: [iPhone app, Háttérrendszer]
szulo: 00-attekintes
szakasz: [B4]
osszefoglalo: Egy pillantásra megmutatja, hogyan áll a napod egy görbén, mennyi fér még bele, és egy koppintással rögzíthetsz étkezést.
---

## Mit csinál
Az Étel szoba (a kezdőlap Étel gömbjéről nyílik) saját alsó sávval jön: Ma · Receptek · Kamra · Hét · Boop. A **Ma**
fül fentről lefelé:

- **Fejléc:** a festett zöld táj (fotó nélkül), a gömbben a mai étkezéseid átlagpontszáma, alatta egy mondat:
  „1 980 kalória van még hátra” (például) és hogy melyik makró van a legmesszebb.
- **Kímélő nap:** ha kímélő módban vagy, felül egy kártya jelzi, hogy ma nincs kalóriakeret. (A „Következik: …” tippkártya 2026-11-21-én kikerült: az éppen nyitott étkezés sora már megmondja, mi jön, és mit javasol Boop.)
- **Rögzítés egy koppintással:** Fotó · Leírom · Szokásos. (A vonalkód gomb 2026-11-21-én lekerült innen; vonalkódot a rögzítő lapon és a Kamrában továbbra is olvashatsz.)
- **Ma eddig:** három szám — kalória (a kereteddel), fehérje (kiemelve), étkezések a tervből.
- **A nap menete:** egy görbe. Folytonos vonal, amit megettél; szaggatott, ahová a mai terv visz; fölötte a kereted.
- **Makrók:** mindháromnál mennyi van meg és mennyi fér még bele.
- **A mai étkezések:** sorok. A megevett étkezés koppintásra helyben kinyílik a nyolc szemponttal és Boop
  megjegyzésével; az éppen aktuális étkezés mutatja a javaslatot és a Megeszem / Kihagyom gombot, a későbbiek
  egy csendes sor, ami koppintásra nyílik.
- **Víz** (+250 / +500) és **kiegészítők** (Bevettem), alul „Kérdezd meg Boopot az étkezésedről”.

## Hogyan működik
A telefon a háttérrendszertől kéri a napot (célok, elfogyasztott, étkezések) és a napi tervet (étkezési ablakok,
keretek, javaslat, tipp). A görbét a telefon rajzolja: a megevett étkezések időpontja szerint összeadva, „most”-tól
a terv nyitott ablakainak kereteivel. Minden blokk magában töltődik és magában jelez hibát, egy lassú rész nem
üríti ki az oldalt. A keret túllépése negatív szám normál színnel, soha nem piros, és semmi nem számol sorozatot.

## Miért így
A tulajdonos 2026-11-19-én kérte, hogy az Étel szoba az Élet-vázlat meleg elrendezését kapja: kevés kártya, sok
egymondatos tény, egy görbe a napról. A paradicsomos fotót ugyanaznap kérte kivenni a fejlécből.

## Beállítások
Nincs saját; a keretek és az ablakok az [étrend-beállításokból](04-napi-keret.md) jönnek.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `meal`, `meal_item` | Az étkezések, ebből adódik össze a nap és a görbe |
| `water_log` | A víz bejegyzései |
| `supplement_intake` | A kiegészítők bevétele |

## Mi jön még
A Hét fül ugyanerre az elrendezésre kerül.

## Mi marad ki
Nincs.
