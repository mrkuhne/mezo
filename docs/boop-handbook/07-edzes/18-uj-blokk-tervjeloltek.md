---
cim: Új blokk és tervjelöltek
szint: Funkció
terulet: Edzés
allapot: Ellenőrzés
hol: [iPhone app, Háttérrendszer]
szulo: 00-attekintes
szakasz: [B5]
osszefoglalo: Új blokkot a telefonon indítasz: megadod, meddig tarthat egy edzés és melyik izom mennyire fontos, Boop pedig legfeljebb három hibátlan, kész tervet mutat — te választasz, és már indul is.
---

## Mit csinál
Ha nincs futó blokkod, az Edzés → Blokk fülön megjelenik az **Új blokk** gomb. Két lépés van:

**1. Alapok.** Három dolgot adsz meg, a többit Boop számolja:
- **Hány hetes** legyen a blokk (4–8 hét);
- **Meddig tarthat egy edzés** (percben) — a pihenővel és a bemelegítéssel együtt;
- **Melyik izomnak mi a szintje:** Hangsúly (itt építesz a legtöbbet), Építés (rendesen nő) vagy Tartás (megtartja, amit eddig
  felépítettél).
Az edzésnapokat az évadodból veszi (az Évad oldalon állítható); ha még nincs évadod, előbb azt kéri, és nem csinál semmit.
Ha az évadodban 2-nél kevesebb vagy 6-nál több edzésnap van, megmondja, hogy a tervajánló 2–6 napra tud tervet adni, és az Évad
oldalra küld. Alul egy **heti keret** sor mutatja, mennyi adag fér az első hét napjaiba, és mennyit használ most a tervezett
szint-beállításod. Egy izmot csak akkor tehetsz feljebb, ha Boop úgy is talál hibátlan tervet; ha nem, a sor alatt megmondja,
miért nem.

**2. Jelöltek.** Boop két-három **kész tervet** mutat, mindegyiknél a felosztás neve és a leghosszabb nap becsült ideje
(például „Felső / Alsó · ~58 perc”). Az első az **ajánlott**; mindegyiknél ott van, miért jó (belefér az időbe, minden izom
legalább hetente kétszer sorra kerül), és egy **„miért?”** lap. Kiválasztod, mikor kezdjétek (alapból jövő hétfőn, vagy ma), és
az **Ezzel kezdem** gombbal a blokk létrejön, a megszokott blokképítő pedig megnyílik rajta. Ha mégsem tetszik: **„Mégsem,
eldobom”** — a blokk és a hozzá készült sablon törlődik, nem készül róla összegzés, mintha meg sem kezdted volna. (Ha már
rögzítettél benne edzést, nem dobható el — akkor le kell zárni.)

**Ha semmi nem fér bele.** Boop nem ad hibás tervet. Azt mondja: „Ebbe az időbe most nem fér bele jó terv”, megmutatja a
legközelebbit (ha mégis kéred), és **javításokat** ajánl, amelyek megoldanák: több perc (ha 90 percnél több kell, az is
megjelenik választhatóként), egy megnevezett izom Hangsúly helyett Építésen, vagy több edzésnap (ez utóbbi az Évad oldalon
állítható). Egy koppintással alkalmazod, és a jelöltek újraszámolódnak.

## Hogyan működik
1. A telefon elküldi a hosszt, a napokat, a szinteket és az időkeretet a háttérrendszernek.
2. A háttérrendszer minden szóba jövő felosztáshoz (például Felső / Alsó, vagy teljes test) **összerak egy tervet**, és ugyanúgy
   megméri, mint a blokképítőben: heti adag izmonként, a napok hossza, mely napokon terhelődik túl egy izom.
3. **Csak hibátlan jelölt kerül elő** — olyan, amelyben minden izom hetente legalább kétszer kap munkát, minden nap belefér az
   időkeretbe, és egy izom sem kap nagy terhelést két egymást követő napon. A hibátlanok közül előre kerül, amelyik kevesebb izmot
   hagy a sávján kívül, aztán amelyiknek rövidebb a leghosszabb napja.
4. A **heti keret** azt mutatja, mennyi adagot bír el az időd az első héten (ugyanazon a héten, amelyet a jelöltek szűrése is
   néz). A háttérrendszer minden izomra kipróbálja, hogy egy szinttel feljebb téve marad-e hibátlan jelölt — a telefon csak ezt
   a választ követi, nem számol semmit magától. A blokképítőben a keret a legnehezebb hetet mutatja, mert ott egy emelés a
   későbbi heteket növeli.
5. **Az Ezzel kezdem** gomb kéri a teljes tervet a választott felosztáshoz (az időkerettel együtt: ha az AI gyakorlatválasztása
   kilógna belőle, a szabályokból készült terv marad), elmenti sablonnak, és elindítja a blokkot az aktív évadodhoz kötve. Ha az indítás elakad, a jelöltek a képernyőn maradnak, és újra megpróbálhatod.
6. A blokképítőben minden izomnál ott a **„miért?”** (honnan jön a sávja), a nagy adag két egymást követő napon jelzést kap,
   és a becsült edzésidő a pihenőkkel együtt számolt.

## Miért így
- A tulajdonos döntései (2026-11-20/21): **Boop javasol kész tervet** (2–3 jelölt), nem kérdez végtelenül; **csak hibátlan
  jelölt** kerül elő; a **heti keret és legfeljebb 2 Hangsúly** határozza meg, mi fér bele; az **új blokk az aktív évadhoz
  kerül**; **reálisabb bemelegítés** (csak az izom első nehéz gyakorlata előtt); **a Tartás a sáv aljáról indul**.
- Az időkeret választja ki a felosztást, de **sosem vág le csendben a heti adagból**: ha hosszabb, megmutatja, és hátrébb
  sorolja.
- Edzettségi szintet nem kérdez: egyetlen, edzett felhasználóra készült, a szint kérdése sosem változtatna az eredményen.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.meso-plan.splits` | Napok számához a felosztások listája (név + a napok típusa) | napszámonként 1–3 felosztás |
| `mezo.volume.bands.emphasize-max` | Legfeljebb hány izom lehet egyszerre Hangsúly | 2 |
| `mezo.volume.bands.consecutive-heavy-sets` | Hány adagtól számít nagynak egy izom terhelése két egymást követő napon | 4 |
| `mezo.volume.evaluator.set-seconds` | Egy sorozat munkaideje a becsült edzésidőben (stílusos blokknál) | 40 mp |
| `mezo.volume.evaluator.transition-minutes` | Gyakorlatváltásonként számolt perc | 1 |

## Adattáblák
Nincs új tábla: a jelöltek csak a kérés idejére léteznek; a kiválasztott terv a megszokott sablonként és blokkként mentődik.

## Mi jön még
- **Éves térkép:** Boop egész évre előre megmutatja, melyik blokk milyen hangsúllyal jön és mikor vannak a könnyű hetek — a
  következő szelet.
- **Követés:** a blokkváltáskor a térkép szerint az új blokk magától felajánlódik — a szelet utáni.

## Mi marad ki
- Edzettségi szint kérdése — szándékosan kimarad.
- Mesterséges intelligencia a jelöltek közti válogatásban: a jelöltek szabályokból készülnek; az AI-finomítás legfeljebb a
  kiválasztott tervre futna.
