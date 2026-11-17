---
cim: Mezociklus-terv és tervgenerátor
szint: Funkció
terulet: Edzés
allapot: Részben kész
hol: [iPhone app, Háttérrendszer, AI]
szulo: 00-attekintes
szakasz: [B5]
osszefoglalo: Néhány kérdés után Boop összerak egy több hetes edzésblokkot, amit átszabhatsz, sablonként elmenthetsz és újraindíthatsz.
---

## Mit csinál

**A Blokk fül (B5, 2026-11-17 — ez már él):**

- **A blokk terhelése:** a blokk hetei egy sorban (idő balra-jobbra, magasság = mennyit kér a hét), alatta a hét
  összes sorozata. Rákoppintva megnyílik **A blokk terhelése** oldal, és ott az áll, amit tudni akarsz:
  - egy mondat arról, hány izomcsoportot edzel ezen a héten, hányban van még hova nőni, hány érte el a felső
    értékét, és mennyivel több vagy kevesebb ez a múlt hétnél;
  - a hét **összes sorozata egy nagy számként**, mellette a **test**, amin minden izom annyira van kitöltve,
    amennyire a saját felső értékéhez képest áll;
  - **izomcsoportonként egy sor, abban a sorrendben, ahogy még hely van bennük**: a szerepe ebben a blokkban
    (Hangsúly · Építés · Tartás), egy **mondat** („Még 3 szett fér bele" / „Elérte a felső értéket ebben a
    tervben"), egy sáv, aminek a vége ennek a tervnek a felső értéke, benne jelölve az a szint, ami alatt már nem
    fejlődik — és a szettszám.
  - Egy izomra koppintva megnyílik a **saját oldala**: ott hétről hétre le van írva, melyik hét mit kér és mi lett
    belőle („3. hét · építés · 8 / 12 megvolt / terv"), ott vannak a határai szavakkal, és hogy hol van a testen.

  **Amin az egész áll:** egy izom felső értéke **nem az, amennyit elbír**, hanem az, ameddig *ez a terv* viszi — a
  szerepe szerint. Egy szinten tartott izomnak azt mondani, hogy „még 8 szett fér bele", olyan ígéret lenne, amit
  a terv soha nem tett.
- **A heted:** a blokk napjai lapozható kártyákon (hétfőtől vasárnapig), mindegyiken a nap típusa, mely
  izomcsoportokat dolgoztatja és hány gyakorlat. A mai nap meg van jelölve, a már megcsinált napok ki vannak
  pipálva. (Korábban ez a Ma oldalon volt; a Ma a mai napról szól, a hét a blokk dolga — 2026-11-17.)

**A tervgenerátor és a szerkesztés (még nem él):**

- **Tervgenerátor (varázsló):** kiválasztod a napokat, a hetek számát és a kiemelt izomcsoportokat (legfeljebb kettő
  „kiemelt”), Boop összerak egy mezociklust.
- **Szerkesztés:** napok, gyakorlatok, sorozatok, ismétlés-tartomány, cél-tartalék (RIR), kezdősúly.
- **Sablonok és futamok:** a terv sablonként mentődik; egy sablont többször is elindíthatsz („futam”), egy régit újrafuttathatsz.
- **Saját edzés:** mezociklus nélküli, bármikor ismételhető edzés.
- **Heti beosztás:** hétköznaponként egy edzésidő.
- **Lezárás:** a mezociklus végén zárójelentés (lásd [Gyakorlatok és előzmények](06-gyakorlatok-elozmenyek.md)).

## Hogyan működik
1. **Váz:** a hetente vállalt napok számából felosztás, az izomcsoportonkénti sorozatszám egy bevett táblázatból (minimum,
   optimális és maximális heti sorozat — lásd [Heti volumen](05-heti-volumen.md)).
2. **Gyakorlatok kitöltése:** szabályok szerint a katalógusból.
3. **AI-válogatás (opcionális):** egy AI-modell a szabályos keretek között jobb gyakorlatokat választhat; ha ki van kapcsolva,
   a szabályos kitöltés marad.
4. Semmi nem mentődik, amíg el nem mented sablonként; indításkor a sablon napjaiból létrejönnek az edzésnapok, és a heti
   sorozatszámok a táblázatból indulnak.
5. Ma csak **izomépítő (hipertrófia)** irányt ismer a generátor.
6. A mezociklus csatolható a súlycélhoz (lásd a Terv részt).

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
| `mezo.meso-plan.target-rir` | Cél-tartalék (hány ismétlés maradjon „a tankban”) | 1 |
| `mezo.meso-plan.compound-warmup` / `isolation-warmup` | Bemelegítő sorozatok száma | 2 / 1 |
| `mezo.train.gym-default-minutes` | Edzés feltételezett hossza (a beosztásnak nincs hossza) | 60 perc |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `meso_template` | A tervsablon: napok, gyakorlatok, izomcsoportonkénti volumen |
| `mesocycle` | Egy futam: hetek, fázisgörbe (például utolsó hét terhelés-csökkentő), aktuális hét, izom-prioritások, állapot |
| `workout_session` | Edzésnapok (sablon) és elvégzett edzések (példány) |
| `exercise` | Gyakorlat-recept egy napon: bemelegítő és munkasorozatok, ismétlés-tartomány, cél-RIR, kezdősúly, megjegyzés |
| `gym_schedule_slot` | Heti beosztás |

## Mi jön még
- B5: natív varázsló, szerkesztő és sablonkönyvtár.
- B6: a mezociklus a Terv része lesz a súlycél és az étrend mellett.

## Mi marad ki
Nincs.
