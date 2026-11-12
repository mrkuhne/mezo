---
cim: Heti volumen és terhelés-csökkentő hét
szint: Kis funkció
terulet: Edzés
allapot: Tervezve
hol: [Háttérrendszer]
szulo: 04-progresszio-motor
szakasz: [B5]
osszefoglalo: Izomcsoportonként hétről hétre nő a sorozatszám egy plafonig, a blokk végén pedig könnyebb hét jön.
---

## Mit csinál
Minden hét elején izomcsoportonként eldönti, hány munkasorozat legyen ezen a héten, és ezt elosztja az adott izomcsoport
gyakorlatai között.

## Hogyan működik
1. A múlt hét elvégzett edzéseiből izomcsoportonként megszámolja a munkasorozatokat és az „őrléseket” (amikor a tartalék legalább
   2-vel a cél alatt maradt).
2. **Jó hét** → +2 sorozat, amíg el nem éri a prioritás szerinti plafont (kiemelt → maximum, növelendő → optimális, szinten
   tartandó → minimum).
3. **Terhelés-csökkentő hét** (a mezociklus fázisgörbéje szerint) → kb. a felére esik, de nem a minimum fele alá.
4. **Korai terhelés-csökkentés**, ha a maximumon őrlés jelenik meg.
5. Hetente egyszer fut (a mai edzés lekérésekor), kétszer nem számol.

## Miért így
A bevett „minimum – optimális – maximum heti sorozat” modell (RP-táblázat) szerint dolgozik, átlátható és hétről hétre követhető.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.feature.volume-progression.enabled` | Be/ki kapcsolja a heti sorozatszám-emelést | be |
| `mezo.volume.step` | Jó hét után ennyi sorozattal több | 2 |
| `mezo.volume.deload-fraction` | Terhelés-csökkentő héten a sorozatszám szorzója | 0,5 |
| `mezo.volume.grind-rir-gap` | Ennyivel a cél alatti tartalék számít őrlésnek | 2 |
| `mezo.volume.baselines.*` | Izomcsoportonkénti minimum / optimális / maximum heti sorozat (például mell 8 / 14 / 20) | lásd konfiguráció |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `muscle_group_volume_log` | Izomcsoportonként az aktuális heti sorozatszám és a minimum/optimális/maximum határok |
| `mesocycle` | A fázisgörbe, az izom-prioritások és az utolsó heti újraszámolás nyoma |

## Mi jön még
B5: a Boop Terv fülén látszik majd a heti sorozatszám izomcsoportonként.

## Mi marad ki
Nincs.
