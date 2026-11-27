---
cim: Widgetek a kezdő- és a zárolt képernyőn
szint: Funkció
terulet: Ma
allapot: Ellenőrzés
hol: [iPhone app]
szulo: 00-attekintes
szakasz: [B5]
osszefoglalo: A nap következő teendője és a mai emlékeztetők a kezdőképernyőn és a zárolt képernyőn — az emlékeztetőket a widgeten ki is pipálhatod, az app megnyitása nélkül.
---

## Mit csinál
Három widget, a Boop megnyitása nélkül:
- **Következő** (kicsi, a kezdőképernyőn): a nap következő teendője — az idő nagyban, alatta a neve és hogy mennyi
  idő van még addig (például „még 1 ó 20 p”). A háttér a teendő színvilága: étkezés zöld, edzés narancs, lefekvés kék.
- **Mai nap** (közepes, a kezdőképernyőn): balra a nap következő három teendője, jobbra a mai emlékeztetők
  karikával. A karikára koppintva kipipálod (a vitamincsoportos emlékeztető pipája a bevételt is beírja az Ételbe,
  mint a „Bevettem”); kipipáltra koppintva visszanyitod.
- **Boop · Következő** (a zárolt képernyőn, az óra alatt): például „12:30 Ebéd”, alatta a következő ki nem pipált
  emlékeztető: „13:00 Fogorvos · még nincs kész”. Egysoros változat is van az óra fölé.

Magától lép tovább: ami elmúlt, eltűnik, a következő kerül előre — az app megnyitása nélkül is.

## Hogyan működik
A Boop minden változáskor (megjön a napi terv, beírsz egy étkezést, pipálsz vagy szerkesztesz egy emlékeztetőt,
visszatérsz az appba) felírja a widgeteknek, mi van ma. A widgetek ebből dolgoznak, és maguktól lépnek tovább a nap
folyamán. A pipa a háttérben ugyanazon az úton megy, mint az ébresztő „Kész” / „Bevettem” gombja.

- **Ha a terv nem mai** (például reggel még nem nyitottad meg a Boopot): csak az emlékeztetők látszanak, és egy halk
  sor: „Nyisd meg a Boopot a mai tervhez” — tegnapi tervet sosem mutat mai helyett.
- **Ha mára nincs több teendő:** „Mára nincs több teendő”, és a holnapi első emlékeztető.
- **Kijelentkezéskor** a widgetek kiürülnek — más fiók semmit sem lát a tiédből.

## Miért így
Az ingyenes Apple-fiók nem enged közös mappát az app és a widget között (ezt a telefonon kipróbáltuk, 2026-11-27).
A közös kulcstartó viszont működik, ezért a widgetek adatai ott utaznak — így a widgetek a fizetős fiók nélkül is
működnek. Pontszám szándékosan nincs rajtuk (tulajdonosi döntés).

## Beállítások
Nincs — a widgetet a kezdőképernyő szerkesztésével teszed ki (hosszan nyomva → Szerkesztés → Widget hozzáadása → Boop).

## Adattáblák
Nincs új — a widgetek a napi tervet és az emlékeztetőket olvassák (`reminders.json`).

## Mi jön még
- **Napközbeni kérdés** widget (a jóváhagyott minta szerint: kérdésenként egy koppintás a számrácson) — külön jegyben,
  mert a kérdéssor egyes kérdései (fájdalom, sóvárgás) nem férnek bele egy számrácsba.

## Mi marad ki
- A widgeten nem lehet új emlékeztetőt felvenni vagy szerkeszteni — ahhoz a Boop kell.
- A widget nem a szerverről frissül: amit a Boop utoljára felírt, azt mutatja.
