---
cim: A Mozgás szoba ma és az edzés áthelyezése
szint: Funkció
terulet: Edzés
allapot: Élesben
hol: [iPhone app, Háttérrendszer]
szulo: 00-attekintes
szakasz: [S3, B2]
osszefoglalo: A Mozgás gömbről nyíló szoba mutatja a mai edzést, és ha egy megbeszélés ütközik vele, Boop javasolja az áthelyezését.
---

## Mit csinál
- **A mai edzés** a reggeli összefoglalóban és a Mozgás szobában: cím, időpont, becsült hossz, a gyakorlatok és a sorozatszám
  (ha aznap könnyítés van, már a könnyített sorozatszámmal).
- **Ütközés-javaslat:** ha az utolsó naptári megbeszélés kevesebb mint 45 perccel az edzés előtt ér véget, Boop egy javaslatkártyát
  tesz ki: az edzés kezdését egész vagy fél órára kerekítve későbbre tenné. **Elfogadom** = áthelyezi (visszavonható a szoba
  edzéskártyáján a „Vissza…” gombbal), **Most nem** = aznapra elrejti, **miért?** = megmutatja a tényeket.
- A „+” lap „Edzés indítása · a mai terv szerint” csempéje még csak keret („hamarosan”).

## Hogyan működik
1. A reggeli összefoglalót a háttérrendszer állítja össze: a mai tervezett edzésnap a futó mezociklusból jön, az időpont az
   áthelyezésből, ha van, különben a heti beosztás aznapi idejéből.
2. Az ütközést **szabály** számolja (a naptár és az edzés időpontja alapján), az AI sosem dönti el.
3. Elfogadáskor a telefon elmenti az aznapi új időpontot; az összefoglaló ettől újragenerálódik.
4. Naponta legfeljebb 3 javaslat jelenik meg, és semmi nem változik koppintás nélkül.

## Miért így
A javaslatkártya a Boop „élő igazítás” egysége (spec §3.1): egy mondat, egy fő gomb, egy másodlagos, és „miért?”. Az edzés
áthelyezése volt az első valódi forrása.

**Ismert korlát:** az áthelyezést ma csak a reggeli összefoglaló látja; az étkezési ablakok (edzés előtti/utáni) és az értesítések
még a heti beosztás eredeti idejével számolnak (kutatás 03 §2.7).

## Beállítások
Nincs külön kapcsoló; a 45 perces ütközési határ és a napi 3 javaslat a kódban rögzített.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `workout_time_override` | Egy napra áthelyezett edzésidő (az utolsó írás érvényes; törlés = visszavonás) |
| `gym_schedule_slot` | A heti beosztás: hétköznaponként egy edzésidő |
| `boop_brief` | A reggeli összefoglaló, benne a mai edzés |

## Mi jön még
- B5: a szoba helyére a teljes Edzés szoba lép a négy füllel; az „Edzés indítása” élesedik.
- B7: több fajta javaslat (rövidebb/hosszabb edzés, más mozgás).

## Mi marad ki
Nincs.
