---
cim: Heti volumen és terhelés-csökkentő hét
szint: Kis funkció
terulet: Edzés
allapot: Részben kész
hol: [Háttérrendszer]
szulo: 04-progresszio-motor
szakasz: [B5]
osszefoglalo: A gyakorlatra beírt sorozatszám az igazság — az edzés pontosan annyit ír elő; a szerver minden izomcsoportnak sávot ad (a sport által terhelt lábaknak lejjebb tolva), megméri vele a tervet, és hétről hétre legfeljebb egy-két sorozatot tol át, amit tényleg megcsináltál alapján; a heti javaslat gyakorlatonként, indokkal látszik, és egyenként vagy egyben elfogadható.
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

**A sport lejjebb viszi a láb sávját (2026-11-18).** Ha hetente röplabdázol, a lábad már kap terhelést a pályán, ezért az edzésterv
arra az izomcsoportra kisebb sávot kér: az alja eggyel, a teteje kettővel lejjebb kerül (a sáv így sem lesz üres). Ezt a tervnél
és a futó blokknál is beállíthatod izomcsoportonként; ha nem állítod be, a szerver a heti sportbeosztásodból **javasol** csoportokat
(röplabdánál a combfeszítőt, a combhajlítót, a farizmot és a vádlit) — de magától nem alkalmazza. Például: egy 8–12-es Építés sáv
sportos lábnál 7–10 lesz.

**A terv mérése mentés előtt (2026-11-18, a telefon képernyői még hátra).** A szerver az összerakott tervet megméri:
- **Izmonként** megmondja, a sávon belül van-e, alatta vagy fölötte, és mennyivel; ha kell, **konkrét javítást** ad (melyik napon,
  melyik gyakorlaton hány sorozat több vagy kevesebb) úgy, hogy soha ne menjen gyakorlatonként öt, izomcsoportonként egy napon
  nyolc sorozat fölé. Ha emiatt nincs hová tenni a hiányzó sorozatot, kimondja: **új gyakorlat kell**.
- **Naponként becsüli az edzés hosszát** (sorozatonként kb. 2,4 perc, bemelegítő sorozatonként 1 perc, plusz 6 perc ráhagyás), és jelzi,
  ha egy nap túllépi a megadott időt.
- **Figyelmeztet**, ha egy izomra egy napon nyolcnál több sorozat jut, és ha aznap sport is van.
- **Hétről hétre kirajzolja a blokkot**: a könnyű hét felez, utána minden gyakorlat visszaáll, fogyás alatt lassabb az emelés. Ez a
  legjobb eset (mintha minden hét jól sikerülne); a valóság a heti megnézés után ettől eltérhet.

A **futó blokk volumen-íve ugyanezt a vonalat mutatja**: a már lement hetek azt, amit tényleg előírtak neked, a mostani és a következők a
fenti kirajzolást — így egy könnyű hét közepén sem hazudik az ív. A **generált terv** minden izma a saját sávján belül indul (a
sáv szélén: az Építés az aljáról, a Hangsúly a saját sávja aljáról, a Tartás a tetejéről).

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
azt a gyakorlatot, amit a könnyű héten te magad átírtál: az a te számod marad. **Ha a könnyű héten minden (felezett) sorozatot
megcsináltál, a következő hét a visszaállítás mellé lép is egyet (2026-11-18)** — korábban ilyenkor tartott, mert a múlt hét kisebb
számait a visszaállított tervhez mérte. Például: a hát a könnyű héten 6 sorozat, utána nem csak 11-re áll vissza, hanem 13-ra lép.

**Kímélő időszak után** (hosszabb kihagyás) izomcsoportonként egy sorozat lekerül egy-egy gyakorlatról; ha meggondolod magad („Mégsem
vagyok jól” vagy „Tévedés volt”), pontosan ugyanaz a sorozat visszakerül — de csak ha közben nem változtattál rajta te vagy a heti lépés.

**A heti javaslat gyakorlatonként (2026-11-18).** A heti változás egy lista: minden sor egy gyakorlat egy napon (például „Hétfő ·
Evezés: 3 → 4 sorozat”), és mindegyik mellett ott az oka (például „minden sorozat megvolt”, „van még hely a sávban”, „könnyű hét”).
Három fajta sor van:
- **sorozat** — hány munkasorozat legyen; ez az egyetlen, ami a tervedet átírja;
- **súly** — mennyivel nő vagy csökken a súly (például 60 → 62,5 kg), mert a múlt héten az ismétléstartomány tetején voltál, maradt
  tartalék, vagy túl nehéz volt;
- **ismétlés** — hány ismétlés legyen ugyanazzal a súllyal.

A súly- és ismétlés-sorok **előzetes kép** arról, mit fog kérni az első edzés a héten — a tervet nem írják át. Izmonként egy
összegzés is jár: milyen szinten van, mi a sávja, hány sorozat volt és lesz, és ha nem változik, miért nem.

**Elfogadás.** Minden sor egyenként **elfogadható** vagy **megtartható** („marad”), vagy egyszerre az összes („Elfogadom átnézés
nélkül”, illetve „a többi marad”). Ha közben te magad átírtad azt a gyakorlatot, a te számod marad, a javaslat nem írja felül. Amit
a hét végéig nem döntesz el, az nem történik meg: a múlt heti szám marad, és a javaslat a következő héten lejár. Egy már lezárt
javaslaton nem lehet változtatni.

**A „marad” egy súlyemelésnél a múlt heti súlyt tartja.** Ha egy súly- vagy ismétlésemelést megtartasz, azon a héten az edzés a múlt
heti súlyt és ismétlést kéri annál a gyakorlatnál (akkor is, ha közben a napot átszerkesztetted); a következő héten újra javasol.

**Kézi mód — a szerveren kész, de még ki van kapcsolva.** Kézi módban a heti változás megvárja a döntésedet. Amíg a telefonon
nincs meg a jóváhagyó képernyő, **minden magától érvényesül** (mintha mindent elfogadnál), a lista pedig utólag megnézhető.

**Ha futam közben szintet vagy sportot váltasz (2026-11-18),** a szerver rögtön megnézi, kicsúszott-e a sávjából az az izom, **amelyiken
változtattál**, és ha igen, azonnal javasol: sorozatot tesz hozzá vagy vesz el konkrét gyakorlatokon, a korlátokon belül. Most, magától
érvényesülő módban, ez azonnal be is kerül a tervbe; kézi módban várna a döntésedre. A többi izmot nem bántja — amit te mentettél,
azt nem húzza vissza. Ha egy újabb váltás jön, az felváltja a még eldöntetlen előzőt. Például: a hát Építésről Hangsúlyra vált, 11
sorozatról rögtön 14 lesz.

## Hogyan működik
1. Az új hét első edzés-megnyitásakor (hetente egyszer) a háttérrendszer megnézi a múlt hét elvégzett edzéseit, izomcsoportonként.
2. Minden izomcsoportra eldönti: nő, tart, csökken vagy könnyebb hét — a fenti szempontok alapján, mindig megindokolva.
3. A változás **konkrét gyakorlatokra** kerül (sorokban: melyik gyakorlat, mennyiről mennyire, miért). Magától érvényesülő módban
   (ez a mostani) azonnal érvényes; kézi módban vár, amíg soronként vagy egyben döntesz, és a hét végén lejár, ami eldöntetlen maradt.
   A javaslat az edzés megnyitása nélkül is lekérhető, így a telefon előre megmutathatja.
4. A heti sorozatszám-összeg izomcsoportonként ebből a tervből adódik össze — a Terv oldalon és a célőrben is ez látszik.
5. Ha a heti számolás valamiért hibázik, az edzésed ettől **akkor is elindul** a megszokott számokkal; a következő megnyitáskor újra próbálja.
6. A jelenleg futó blokkodat az első indításkor a rendszer egyszer átváltotta az új módra úgy, hogy pontosan azt kapod, amit előző nap
   mutatott neked az app — nem ugrik meg semmi.

## Miért így
- A tulajdonos döntése (2026-11-17): az app **javasol, te döntesz**, és a te elfogadott számod az igazság.
- A „minimum – optimális – maximum” heti sorozat bevett modell (RP-táblázat); a számok beállíthatók, nem kőbe vésettek.
- A fogyás alatti lassabb lépés a bevett elv: étel-hiányban a munkát nem vágjuk, csak lassabban emeljük.
- A generált terv a sáv szélén indul — a tulajdonos döntése, 2026-11-18 („Sáv széle”).
- Részletek: Döntések napló, 2026-11-17 és 2026-11-18.

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
| `mezo.volume.bands.sport-low-shift` / `sport-high-shift` | Sporttal terhelt izomcsoportnál ennyivel lejjebb kerül a sáv alja / teteje | 1 / 2 |
| `mezo.volume.evaluator.minutes-per-working-set` | A tervmérő ennyi percet számol egy munkasorozatra | 2,4 perc |
| `mezo.volume.evaluator.minutes-per-warmup-set` | … egy bemelegítő sorozatra | 1 perc |
| `mezo.volume.evaluator.session-overhead-minutes` | … ráhagyás egy edzésre (készülődés, pihenők közötti szünetek) | 6 perc |
| `mezo.volume.sport-groups-by-sport` | Melyik izomcsoportot terheli egy sport (a javaslathoz) | röplabda: comb, combhajlító, far, vádli |
| `mezo.volume.signals.*` | Mikor számít soknak a munka, erősnek a fájdalom, magasnak az izomláz (1–10-es skálán) | 3 / 2 / 7 |
| `mezo.volume.weekly-review.mode` | A heti változás magától érvényesül-e (`auto`) vagy jóváhagyásra vár (`manual` — a szerveren kész, a telefon képernyőjéig nem kapcsoljuk be) | magától |
| `mezo.volume.baselines.*` | Izomcsoportonkénti minimum / optimális / maximum heti sorozat (például mell 8 / 14 / 20) | lásd konfiguráció |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `exercise` | A gyakorlat sorozatszáma — ez az igazság, ezt írja elő az edzés |
| `muscle_group_volume_log` | Izomcsoportonként a heti összeg (a tervből kiszámolva) és a hozzá tartozó sáv alja és teteje |
| `meso_week_proposal` | A heti változás: soronként a gyakorlat, a nap, a régi és az új szám (súlynál kilóban), az indok és a döntésed; izmonként egy összegzés; az állapota (vár, elfogadva, magától érvényesült, lejárt, felváltva); a könnyű hét után visszaállítandó számok |
| `mesocycle` | A fázisgörbe, az izom-szintek, a sporttal terhelt izomcsoportok, az utolsó heti számolás nyoma és hogy a futam már az új módon megy-e |
| `meso_template` | A terv sablonja — itt is eltárolódik, mely izomcsoportokat terheli a sport |

## Mi jön még
- **Jóváhagyó képernyő a telefonon:** a szerver már tudja (soronkénti „Elfogadom / Marad”, „Elfogadom átnézés nélkül”, az okok),
  a telefonon még nincs meg. Vele jön a **fiókonkénti kapcsoló** a kézi módhoz.
- **A „marad” a súlycsökkentésnél is a múlt heti súlyt tartsa:** most csak egy emelést tud megfogni; egy javasolt csökkentésnél a
  „marad” még nem hozza vissza a múlt heti súlyt. Csak kézi módban számít.
- **A telefon képernyői a mérésre (blokk-építő):** a szerver már tud mérni és javítást adni, de a telefonon még nincs olyan képernyő, ami megmutatná és elfogadtatná.
- **A telefon „még férő” számai** egyelőre a régi közelítést használják; a szerver ívét és sávjait a telefon-szelet köti rá.
- Technikák (például dropszett) és a terv stílusa — külön tervezett csomag.

## Mi marad ki
- A **tört (közvetett) sorozatok** számolása: csak a közvetlen munkasorozat számít.
- A jóváhagyás nélküli, rejtett átírás: amit az app megváltoztat, az sorokban látszik és megindokolt.
- A mag- és a csuklyás izom sávja: ezeknek nincs heti sávja, így nincs is ítélet rájuk.
- Ebben a lépésben **a telefonos jóváhagyó képernyő és a fiókonkénti kézi/automata kapcsoló** kimaradt: a szerver kész, de mindenkinek
  a magától érvényesülő mód fut, amíg a telefon-szelet el nem készül.
- Szintváltásnál a **régóta sávon kívül lévő, de most nem változtatott izom** nem kap javaslatot — azt a blokk-építő képernyő javítja.
