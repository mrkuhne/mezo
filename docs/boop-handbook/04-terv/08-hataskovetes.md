---
cim: Hatás — kísérletek
szint: Funkció
terulet: Terv
allapot: Élesben
hol: [iPhone app, Háttérrendszer, Apple Health, AI]
szulo: 00-attekintes
szakasz: [B6]
osszefoglalo: Kipróbálsz valamit (egy kiegészítőt, egy receptet, egy szokást), és Boop két hét után őszintén megmondja, változott-e az alvásod, a pulzusod vagy a közérzeted — vagy azt, hogy nem lehet megítélni.
---

## Mit csinál
Az Évad szoba **Kísérlet** fülén (2026-11-28 óta; régen az Évad oldal Hatás füle) egyszerre **egy** kísérlet fut. Egy kísérlet egy változás (például „esti magnézium” vagy „este 9
után nincs telefon”), általában 14 napig (7 és 28 nap között). A végén Boop összeveti a kísérlet napjait az **előtte lévő, ugyanolyan
hosszú időszakkal**, és jelenként megmutatja: előtte | közben, a napok számával.

A fül részei:
- **Boop ötlete** — ha Boop észrevesz valami újat, felajánlja: „Indulhat” vagy „Most nem”. Ugyanez a javaslat a Ma falon is megjelenik,
  egy koppintással indul.
- **Folyamatban** — a futó kísérlet: hányadik napnál tart, hány napot pipáltál ki (a napok kis körein; egy kimaradt napot utólag is), mennyi kell az eredményhez, és ha
  közben más is változott (új edzésblokk, könnyebb hét, kímélő napok, évadmódosítás, vagy amit magad jeleztél: új étrend-kiegészítő, egy naplóbejegyzés arról, hogy elkezdtél valamit), azt is kiírja. „Leállítom” megszakítja.
- **Korábbi kísérletek** — mindegyik egy sorral és az eredménnyel; koppintásra az eredménylap.
- **Új kísérlet** — magad nevezel el egyet és választasz hosszt. Amíg egy fut, újat nem indíthatsz.

Az **eredménylap**: előtte | közben táblázat, „Mit jelent ez?” (ami tényleg változott, ami nem érdemben, mire figyelj), és két gomb:
**Megtartom szokásnak** (bekerül az évad szabályai közé, Boop onnantól a beszélgetésben, a reggeli összefoglalóban és az étkezések
értékelésénél is tud róla) és **Újra kipróbálom**. A kész eredmény a Ma falon is megjelenik („Kész a kísérlet”).

## Hogyan működik
1. **Amit figyel:** alvás hossza, mély alvás, pulzus-variabilitás, nyugalmi pulzus (az Apple Watchról, az Egészség appon át), és a
   bejelentkezéseidből az energia, a hangulat és a reggeli közérzet (kipihentség). Ahol egy napra nincs adat, az a nap kimarad.
2. **Kapuk, kerek szám nélkül:**
   - ha a napok kevesebb mint 70 %-át pipáltad ki (14 napból 10), az eredmény: **„túl kevés nap, nem lehet megítélni”**;
   - egy jel csak akkor számít **tényleges változásnak**, ha mindkét oldalon legalább 5 napnyi adat van, és a különbség nagyobb annál,
     amennyit magától is ingadozni szokott (a két időszak napjait páronként összevetve);
   - ha egyik jel sem lépi át: **„nem hozott érezhető változást”**.
   Soha nincs egyetlen százalék vagy pontszám; mindig látszik, hány napból jött az eredmény. Az eredménylap mindig kimondja: „Ez a te
   napjaidból látszik, de nem bizonyíték.”
3. **Boop is javasol** (az évad szabályai között kikapcsolható): ha új étrend-kiegészítő kerül a napi listádba; ha egy receptet vagy
   ételt először eszel, és egy héten belül újra; vagy ha a naplóba azt írod, „elkezdtem…” / „mostantól…”. Egyszerre legfeljebb egy
   nyitott javaslat van, és amíg kísérlet fut, nem javasol újat.
4. **Naponta egyszer** (hajnalban) a szerver lezárja a lejárt kísérletet és megnézi, van-e új javaslat; a Kísérlet fül megnyitásakor ugyanez
   azonnal is lefut.
5. A régi, webes kísérletjavasló kikapcsolt (a régi adatai megmaradnak, csak már nem javasol), így az évad kísérletei az egyetlenek.

## Miért így
A tulajdonos azt kérte, hogy Boop is javasolhasson kísérletet, és az eredmény őszinte legyen, egyetlen százalék nélkül (döntés,
2026-11-20). A „két hét előtte, két hét közben” összevetés és a minimum pipált napok az Oura kísérleteiből jönnek; a „nem bizonyíték”
kimondása a WHOOP-ból; az áttekinthetetlen százalékot (WHOOP) szándékosan elhagytuk.

## Beállítások
| Beállítás | Mit csinál | Alapállapot |
|---|---|---|
| „Ajánljon kísérletet, ha valami újat kezdek” (évad-szabály) | Boop javasolhat kísérletet | be |
| A kísérlet hossza | 7, 14, 21 vagy 28 nap | 14 nap |

## Adattáblák
`season_experiment` (az évad kísérletei: alany, cím, kezdet, hossz, állapot, kipipált napok, eredmény, „megtartva”). Olvas:
`sleep_log`, `daily_metric`, `check_in`, `protocol_item`, `meal` / `meal_item`, `journal_entry`, `season_revision`, az edzésblokkok.

## Mi jön még
A mélyebb, hosszabb távú minták a Napló „Minták” részében (B8).

## Mi marad ki
Két kísérlet egyszerre; kerek „hatásszázalék”; a régi webes kísérletek megjelenítése.
