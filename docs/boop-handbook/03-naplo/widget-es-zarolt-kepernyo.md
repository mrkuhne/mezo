---
cim: Widget és válasz a zárolt képernyőről
szint: Kis funkció
terulet: Napló
allapot: Tervezve
hol: [iPhone app]
szulo: 00-attekintes
szakasz: [B3]
osszefoglalo: A kezdőképernyőn egy widgetből, vagy közvetlenül az értesítésből tölthetsz ki az app megnyitása nélkül — külön jegyben jön.
---

## Mit csinál
A megtervezett (de még meg nem épített) változat:
- **közepes widget** a kezdőképernyőn: kérdésenként egy koppintás egy 2×5-ös számrácson, „Ennyi” a megálláshoz, a
  végén például „16:02 · 6 koppintás”;
- **válaszgombok az értesítésen**, amelyek mentenek, anélkül hogy az app megnyílna.

## Hogyan működik
A B3 megtervezte (a mintán megvan), az építés egy külön jegyben vár. Az eredeti feltevés („az ingyenes Apple-fiók
nem engedi”) 2026-11-27-én megdőlt: a közös kulcstartón keresztül a widget megkapja az adatokat, a pipa pedig a
háttérben, az appon keresztül ment.

## Miért így
B3 spec, D9: tervezzük most, építsük, amikor a fizetős fiók megjön. A widgetben nem lehet húzni, ezért ott számrács van.

## Beállítások
Nincs.

## Adattáblák
Nincs — ugyanazokba a táblákba ír, mint a kitöltés.

## Mi jön még
Külön jegyben épül. Közben kiderült, hogy a fizetős fiók nem kell hozzá: a többi widget (Következő, Mai nap) már az
ingyenes fiókkal is működik, a közös kulcstartón keresztül. Ami még hátra van: kitalálni, hogyan jelenjen meg a
fájdalom és a sóvárgás kérdése, mert ezek nem férnek bele egy számrácsba.

## Mi marad ki
Zárolt képernyős „élő tevékenység” a kitöltéshez — az edzésnél jön (B5).
