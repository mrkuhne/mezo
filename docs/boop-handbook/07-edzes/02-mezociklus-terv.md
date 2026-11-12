---
cim: Mezociklus-terv és tervgenerátor
szint: Funkció
terulet: Edzés
allapot: Tervezve
hol: [iPhone app, Háttérrendszer, AI]
szulo: 00-attekintes
szakasz: [B5]
osszefoglalo: Néhány kérdés után Boop összerak egy több hetes edzésblokkot, amit átszabhatsz, sablonként elmenthetsz és újraindíthatsz.
---

## Mit csinál
A **Terv** fülön:

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
