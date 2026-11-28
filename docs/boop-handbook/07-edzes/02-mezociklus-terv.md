---
cim: Mezociklus-terv és tervgenerátor
szint: Funkció
terulet: Edzés
allapot: Részben kész
hol: [iPhone app, Háttérrendszer, AI]
szulo: 00-attekintes
szakasz: [B5]
osszefoglalo: Néhány kérdés után Boop összerak egy több hetes edzés-mezociklust, amit átszabhatsz, sablonként elmenthetsz és újraindíthatsz.
---

## Mit csinál

**A Mezociklus fül (B5, 2026-11-17 — ez már él; a fül neve 2026-11-26 óta „Mezociklus”, 2026-11-28 óta új kinézettel —
a fül felépítése: [Mezociklusaim](20-mezociklusaim.md)):**

- **A mezociklus terhelése:** a hetek íve a fő kártyán áll (idő balra-jobbra, magasság = mennyit kér a hét); az
  **Izmok ezen a héten** kártya mutatja a hét öt legtöbbet dolgozó izmát és a hét összes sorozatát. Rákoppintva megnyílik **A mezociklus terhelése** oldal, és ott az áll, amit tudni akarsz:
  - egy mondat arról, hány izomcsoportot edzel ezen a héten, hányban van még hova nőni, hány érte el a felső
    értékét, és mennyivel több vagy kevesebb ez a múlt hétnél;
  - a hét **összes sorozata egy nagy számként**, mellette a **test**, amin minden izom annyira van kitöltve,
    amennyire a saját felső értékéhez képest áll;
  - **izomcsoportonként egy sor, abban a sorrendben, ahogy még hely van bennük**: a szerepe ebben a mezociklusban
    (Hangsúly · Építés · Tartás), egy **mondat** („Még 3 szett fér bele" / „Elérte a felső értéket ebben a
    tervben"), egy sáv, aminek a vége ennek a tervnek a felső értéke, benne jelölve az a szint, ami alatt már nem
    fejlődik — és a szettszám.
  - Egy izomra koppintva megnyílik a **saját oldala**: ott hétről hétre le van írva, melyik hét mit kér és mi lett
    belőle („3. hét · építés · 8 / 12 megvolt / terv"), ott vannak a határai szavakkal, és hogy hol van a testen.

  **Amin az egész áll:** egy izom felső értéke **nem az, amennyit elbír**, hanem az, ameddig *ez a terv* viszi — a
  szerepe szerint. Egy szinten tartott izomnak azt mondani, hogy „még 8 szett fér bele", olyan ígéret lenne, amit
  a terv soha nem tett.
- **A heted:** a mezociklus napjai lapozható kártyákon (hétfőtől vasárnapig), mindegyiken a nap típusa, mely
  izomcsoportokat dolgoztatja és hány gyakorlat. A mai nap meg van jelölve, a már megcsinált napok ki vannak
  pipálva. (Korábban ez a Ma oldalon volt; a Ma a mai napról szól, a hét a blokk dolga — 2026-11-17.)

**A tervgenerátor és a szerkesztés (még nem él):**

- **Tervgenerátor (varázsló):** kiválasztod a napokat, a hetek számát és a kiemelt izomcsoportokat (legfeljebb kettő
  „kiemelt”), Boop összerak egy mezociklust.
- **Szerkesztés:** napok, gyakorlatok, sorozatok, ismétlés-tartomány, cél-tartalék (RIR), kezdősúly. *A sorozatok szerkesztése
  és a napi gyakorlatszerkesztő (hozzáadás, csere, törlés, sorrend, ismétlés-tartomány, tartalék, kezdősúly) már él a
  [blokképítőben](16-blokk-epito.md); napot hozzáadni vagy átnevezni még nem lehet.*
- **Sablonok és futamok:** a terv sablonként mentődik; egy sablont többször is elindíthatsz („futam”), egy régit újrafuttathatsz.
- **Saját edzés:** mezociklus nélküli, bármikor ismételhető edzés.
- **Heti beosztás:** hétköznaponként egy edzésidő.
- **Lezárás:** a mezociklus végén zárójelentés (lásd [Gyakorlatok és előzmények](06-gyakorlatok-elozmenyek.md)).

## Hogyan működik
1. **Váz:** a hetente vállalt napok számából felosztás — napszámonként több is van (például négy napra Felső / Alsó vagy teljes test
   ×4; hatra Toló / Húzó / Láb ×2 vagy Felső / Alsó ×3), a választott felosztás szerint épül a terv —, az izomcsoportonkénti sorozatszám
   egy bevett táblázatból (minimum, optimális és maximális heti sorozat — lásd [Heti volumen](05-heti-volumen.md)). **Minden izomcsoport az
   első héten a saját sávján belül indul, a sáv aljáról** (Építés: a sáv aljáról, Hangsúly: a saját sávja aljáról, Tartás: a sáv aljáról,
   a megtartó adagról) — a tulajdonos döntése, 2026-11-18, a Tartás részét felülírta a 2026-11-21-i „A sáv aljáról”. Egyszerre legfeljebb
   **két** izom lehet Hangsúly. A **bemelegítő sorozat** csak egy izom első nehéz gyakorlata előtt van. A felosztás-választást és a
   kész jelölteket lásd [Új blokk és tervjelöltek](18-uj-blokk-tervjeloltek.md).
2. **Gyakorlatok kitöltése:** szabályok szerint a katalógusból.
3. **AI-válogatás (opcionális):** egy AI-modell a szabályos keretek között jobb gyakorlatokat választhat; ha ki van kapcsolva,
   a szabályos kitöltés marad.
4. Semmi nem mentődik, amíg el nem mented sablonként; indításkor a sablon napjaiból létrejönnek az edzésnapok, és a gyakorlatokra
   beírt sorozatszámok maradnak az igazság — az első héten pontosan az, amit megterveztél (lásd [Heti volumen](05-heti-volumen.md)).
5. **A terv mérése (2026-11-18, a szerver már tudja):** a szerver az összerakott tervet izmonként a sávjához méri (a sporttal terhelt lábaknál
   lejjebb tolt sávhoz), konkrét, a korlátokat betartó javítást javasol — vagy kimondja, hogy új gyakorlat kell —, becsüli napi edzésidőt,
   figyelmeztet a napi nyolc sorozat fölötti izomra és a sportos napokra, és hétről hétre kirajzolja a blokkot; a futó blokk volumen-íve
   ugyanezt a vonalat használja. Részletek: [Heti volumen](05-heti-volumen.md).
6. Ma csak **izomépítő (hipertrófia)** irányt ismer a generátor.
7. A mezociklus csatolható a súlycélhoz (lásd a Terv részt).

## Miért így
A terv és a futam szétválasztása lehetővé teszi, hogy egy bevált blokkot újra lefuttass, és két futamot összehasonlíts.
Az AI csak gyakorlatot választ, a terhelésről soha nem dönt.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.feature.meso-plan-ai.enabled` | Be/ki kapcsolja az AI gyakorlat-válogatást (ki: szabályos kitöltés) | be |
| `mezo.meso-plan.max-exercises-per-group-per-day` | Izomcsoportonként legfeljebb ennyi gyakorlat egy napon | 2 |
| `mezo.meso-plan.compound-rep-min/max` | Összetett gyakorlat ismétlés-tartománya | 8–10 |
| `mezo.meso-plan.isolation-rep-min/max` | Izolációs gyakorlat ismétlés-tartománya | 12–15 |
| `mezo.meso-plan.default-training-style` | A tervezett blokk stílusa; ez adja az ismétlés-tartományt, a tartalékot és a pihenőt | Kiegyensúlyozott |
| `mezo.meso-plan.target-rir` | Cél-tartalék, ha a stílus ki van kapcsolva | 1 |
| `mezo.meso-plan.compound-warmup` / `isolation-warmup` | Bemelegítő sorozatok száma | 2 / 1 |
| `mezo.train.gym-default-minutes` | Edzés feltételezett hossza (a beosztásnak nincs hossza) | 60 perc |
| `mezo.volume.bands.sport-low-shift` / `sport-high-shift` | Sporttal terhelt izomcsoportnál ennyivel lejjebb kerül a sáv alja / teteje | 1 / 2 |
| `mezo.volume.evaluator.*` | A tervmérő időbecslése: munkasorozatonként / bemelegítő sorozatonként / edzésenként ráhagyás | 2,4 perc / 1 perc / 6 perc |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `meso_template` | A tervsablon: napok, gyakorlatok, a sporttal terhelt izomcsoportok |
| `mesocycle` | Egy futam: hetek, fázisgörbe (például utolsó hét terhelés-csökkentő), aktuális hét, izom-prioritások, sporttal terhelt izomcsoportok, állapot |
| `workout_session` | Edzésnapok (sablon) és elvégzett edzések (példány) |
| `exercise` | Gyakorlat-recept egy napon: bemelegítő és munkasorozatok, ismétlés-tartomány, cél-RIR, kezdősúly, megjegyzés |
| `gym_schedule_slot` | Heti beosztás |

## Mi jön még
- B5: natív varázsló, szerkesztő és sablonkönyvtár — a **blokk-építő képernyők**, amelyek megmutatják a szerver mérését és javításait.
- **A heti jóváhagyás** (soronként elfogadod vagy megtartod a heti változtatást, és a szintváltás is javaslat lesz): a következő szelet (S3).
- B6: a mezociklus a Terv része lesz a súlycél és az étrend mellett.

## Mi marad ki
Nincs.
