---
cim: Heti volumen és terhelés-csökkentő hét
szint: Kis funkció
terulet: Edzés
allapot: Részben kész
hol: [Háttérrendszer]
szulo: 04-progresszio-motor
szakasz: [B5]
osszefoglalo: A gyakorlatra beírt sorozatszám az igazság — az edzés pontosan annyit ír elő; a hét sávot ad izomcsoportonként, és hétről hétre legfeljebb egy-két sorozatot tol át, amit tényleg megcsináltál alapján.
---

## Mit csinál
**A szám, amit beírsz, az a szám, amit kapsz.** Ha egy gyakorlathoz három munkasorozatot tervezel, az edzés három munkasorozatot ír
elő — nem több, nem kevesebb. (Régen egy rejtett „heti cél” osztotta szét a sorozatokat a gyakorlatok között, és előfordult, hogy
egy háromsorozatos tervből nyolc lett egy edzésen.)

Minden izomcsoportnak van egy **heti sávja** aszerint, milyen szinten tartod:

| Szint | Heti sáv (munkasorozat) | Például (hát) |
|---|---|---|
| **Hangsúly** | az optimum közelétől a maximumig | 14–22 |
| **Építés** (az alap) | a minimumtól az optimumig | 10–16 |
| **Tartás** | a minimum harmadától a minimum alá egy sorozatig | 4–9 |

A sáv **tanácsot ad**, nem tilt: a tervedet nem utasítja vissza, és amit te mentettél, azt a hétről hétre való lépés nem húzza vissza.

Minden új héten a motor izomcsoportonként **megnézi, mit csináltál tényleg** a múlt héten, és ebből dönt:
- megvolt-e minden előírt sorozat,
- túl nehéz volt-e („őrlés”), vagy sok volt-e a munka,
- volt-e ízületi fájdalom,
- maradt-e még izomláz a következő edzés napján,
- fogysz-e éppen (akkor lassabb a lépés).

Ennek alapján **legfeljebb egy-két sorozatot tol át konkrét gyakorlatokra** (hangsúlynál kettőt, építésnél egyet, fogyás alatt
mindkettőnél egyet) — soha nem tesz egy gyakorlatra öt munkasorozatnál többet, és egy izomcsoportra egy edzésen nyolcnál többet.
Tartásnál nem változtat. Ha a hét nem sikerült, tart.

A **könnyebb (terhelés-csökkentő) hét** a gyakorlatok sorozatszámát felezi. A **rá következő hét visszaviszi az előző számokat** — kivéve
azt a gyakorlatot, amit a könnyű héten te magad átírtál: az a te számod marad.

**Kímélő időszak után** (hosszabb kihagyás) izomcsoportonként egy sorozat lekerül egy-egy gyakorlatról; ha meggondolod magad („Mégsem
vagyok jól” vagy „Tévedés volt”), pontosan ugyanaz a sorozat visszakerül — de csak ha közben nem változtattál rajta te vagy a heti lépés.

**Egyelőre a heti változtatás magától érvényesül.** A jóváhagyó képernyő, ahol soronként elfogadhatnád vagy megtarthatnád,
később jön a telefonra.

## Hogyan működik
1. Az új hét első edzés-megnyitásakor (hetente egyszer) a háttérrendszer megnézi a múlt hét elvégzett edzéseit, izomcsoportonként.
2. Minden izomcsoportra eldönti: nő, tart, csökken vagy könnyebb hét — a fenti szempontok alapján, mindig megindokolva.
3. A változás **konkrét gyakorlatokra** kerül (sorokban: melyik gyakorlat, mennyiről mennyire, miért), és azonnal érvényes.
4. A heti sorozatszám-összeg izomcsoportonként ebből a tervből adódik össze — a Terv oldalon és a célőrben is ez látszik.
5. Ha a heti számolás valamiért hibázik, az edzésed ettől **akkor is elindul** a megszokott számokkal; a következő megnyitáskor újra próbálja.
6. A jelenleg futó blokkodat az első indításkor a rendszer egyszer átváltotta az új módra úgy, hogy pontosan azt kapod, amit előző nap
   mutatott neked az app — nem ugrik meg semmi.

## Miért így
- A tulajdonos döntése (2026-11-17): az app **javasol, te döntesz**, és a te elfogadott számod az igazság.
- A „minimum – optimális – maximum” heti sorozat bevett modell (RP-táblázat); a számok beállíthatók, nem kőbe vésettek.
- A fogyás alatti lassabb lépés a bevett elv: étel-hiányban a munkát nem vágjuk, csak lassabban emeljük.
- Részletek: Döntések napló, 2026-11-17.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.feature.volume-progression.enabled` | Be/ki kapcsolja a heti sorozat-lépést és az összegzést | be |
| `mezo.volume.step-emphasize` | Hangsúly szinten ennyi sorozattal több egy jó hét után | 2 |
| `mezo.volume.step-grow` | Építés szinten ennyi sorozattal több egy jó hét után | 1 |
| `mezo.volume.step-deficit` | Fogyás alatt mindkét szinten ennyi | 1 |
| `mezo.volume.deload-fraction` | Terhelés-csökkentő héten a sorozatszám szorzója | 0,5 |
| `mezo.volume.grind-rir-gap` | Ennyivel a cél alatti tartalék számít őrlésnek | 2 |
| `mezo.volume.bands.exercise-cap` | Legfeljebb ennyi munkasorozat egy gyakorlaton | 5 |
| `mezo.volume.bands.session-cap` | Legfeljebb ennyi munkasorozat egy izomcsoportra egy edzésen | 8 |
| `mezo.volume.bands.maintain-low-divisor` / `emphasize-low-offset` | Hogyan jön ki a Tartás és a Hangsúly sáv alja | 3 / 2 |
| `mezo.volume.signals.*` | Mikor számít soknak a munka, erősnek a fájdalom, magasnak az izomláz (1–10-es skálán) | 3 / 2 / 7 |
| `mezo.volume.weekly-review.mode` | A heti változás magától érvényesül-e (`auto`) vagy jóváhagyásra vár (`manual`, később) | magától |
| `mezo.volume.baselines.*` | Izomcsoportonkénti minimum / optimális / maximum heti sorozat (például mell 8 / 14 / 20) | lásd konfiguráció |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `exercise` | A gyakorlat sorozatszáma — ez az igazság, ezt írja elő az edzés |
| `muscle_group_volume_log` | Izomcsoportonként a heti összeg (a tervből kiszámolva) és a hozzá tartozó sáv alja és teteje |
| `meso_week_proposal` | A heti változás: soronként a gyakorlat, a régi és az új szám, az indok; a könnyű hét után visszaállítandó számok |
| `mesocycle` | A fázisgörbe, az izom-szintek, az utolsó heti számolás nyoma és hogy a futam már az új módon megy-e |

## Mi jön még
- **Jóváhagyó képernyő a telefonon:** soronkénti „Elfogadom / Megtartom”, vagy „Elfogadom átnézés nélkül”, és a változtatás okai.
- **Tervépítő sáv-értékelő:** a terv mentése előtt megmondja, melyik izomcsoport van a sávja alatt vagy fölött, és javasol konkrét átrakást.
- **A sport (például röplabda) lejjebb viszi a láb sávját** — még nincs bekötve.
- **Szintváltás a futam közben** azonnali javaslatot is adjon, ne csak a sávot tolja el.
- **A telefon és a webes ív „még férő” számai** egyelőre közelítőek az új számítás mellett; a következő szelet pontosítja őket.
- Technikák (például dropszett) és a terv stílusa — külön tervezett csomag.

## Mi marad ki
- A **tört (közvetett) sorozatok** számolása: csak a közvetlen munkasorozat számít.
- A jóváhagyás nélküli, rejtett átírás: amit az app megváltoztat, az sorokban látszik és megindokolt.
- A mag- és a csuklyás izom sávja: ezeknek nincs heti sávja, így nincs is ítélet rájuk.
