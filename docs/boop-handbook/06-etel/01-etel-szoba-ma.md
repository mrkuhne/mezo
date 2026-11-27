---
cim: Az Étel szoba Ma füle
szint: Funkció
terulet: Étel
allapot: Élesben
hol: [iPhone app, Háttérrendszer]
szulo: 00-attekintes
szakasz: [B4]
osszefoglalo: Egy pillantásra megmutatja, mennyi fér még a napodba, ablakonként külön kártyán látod az étkezéseket, és minden étkezésnek saját oldala van javítással és törléssel.
---

## Mit csinál
Az Étel szoba (a kezdőlap Étel gömbjéről nyílik) saját alsó sávval jön: Ma · Receptek · Kamra · Hét · Boop. A szoba
égboltja világosabb, mint a többi szobáé (2026-11-27). A **Ma** fül három szintben épül fel, fentről lefelé:

**1. A nap egy pillantásra** (egy üvegkártya, balra-jobbra lapozható)
- **Első oldal:** egy gyűrű, közepén „még 1 980 kcal” (például); a keret túllépése „−120 kcal”, normál színnel, soha
  nem piros; kímélő napon „ma nincs keret”. Mellette a **Fehérje · Szénhidrát · Zsír** sávok, mindháromnál „megevett/cél g” (például „120/176 g”).
- **Második oldal: A nap menete:** egy görbe — folytonos vonal, amit megettél; szaggatott, ahová a mai terv visz;
  fölötte a kereted. Nagy betűmérettel vagy VoiceOverrel a két oldal egymás alá kerül, és a görbét szavakkal is felolvassa.

**2. Egy kártya minden étkezési ablaknak**
- A kártya fejlécén az ablak neve és egy **+**: ide rögzítesz étkezést.
- A már megevett étkezések sorai: időpont, fehérje · szénhidrát · zsír, kalória, pont. A sorra koppintva az
  étkezés **saját oldala** nyílik (lásd [Étkezés értékelése](03-etkezes-ertekelese.md)).
- A később következő, nyitott ablak javaslatot mutat és **Kihagyom** gombot; a kihagyott ablaknál visszavonás van.
  A jóváhagyásra váró és a net nélkül várakozó étkezések kártyái itt maradtak.
- **Törlés:** a sort elhúzva, hosszan nyomva, VoiceOver-műveletből vagy az étkezés oldaláról. Az étkezés azonnal
  eltűnik, és 6 másodpercig ott a **Visszavonás**. Ha letelt, tényleg törlődik; ha a törlés nem sikerült, az étkezés
  visszakerül egy nyugodt mondattal. Net nélkül a törlés és a javítás halványul, és megmondja az okát.

**3. Alul**
- **Víz** (+250 / +500), **Kiegészítők** (Bevettem csoportonként), **Italok**, végül „Kérdezd meg Boopot az
  étkezésedről”.

## Hogyan működik
A telefon a háttérrendszertől kéri a napot (célok, elfogyasztott, étkezések) és a napi tervet (étkezési ablakok,
keretek, javaslat). Törléskor az étkezés azonnal eltűnik a telefonon, a szerver felé a kérés csak a 6 másodperc
lejárta után megy el (addig a Visszavonás semmit sem kér a szervertől). A görbét a telefon rajzolja: a megevett étkezések időpontja szerint összeadva, „most”-tól
a terv nyitott ablakainak kereteivel. Minden blokk magában töltődik és magában jelez hibát, egy lassú rész nem
üríti ki az oldalt. A keret túllépése negatív szám normál színnel, soha nem piros, és semmi nem számol sorozatot.

## Miért így
A tulajdonos 2026-11-27-én kérte az oldal újratervezését: legyen tagolt, a kalória és a makrók jól látszanak felül, minden étkezésnek legyen saját oldala, és utólag ki lehessen javítani vagy törölni. (Az alábbi
2026-11-19-i kérés az alap maradt.)

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
A Hét fül ugyanerre az elrendezésre kerül. A szoba alsó sávja a legnagyobb betűméreteknél még levágja a feliratokat.

## Mi marad ki
Nincs.
