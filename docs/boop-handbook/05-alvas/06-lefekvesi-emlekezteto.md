---
cim: Lefekvési emlékeztető
szint: Funkció
terulet: Alvás
allapot: Élesben
hol: [iPhone app, Háttérrendszer]
szulo: 00-attekintes
szakasz: [S3]
osszefoglalo: Egy koppintással minden este szól a telefon fél órával a lefekvési célod előtt.
---

## Mit csinál
Az Alvás gömb gombjával (vagy a lefekvés-kártya „Emlékeztess” gombjával) bekapcsolod az esti emlékeztetőt.
Ettől kezdve minden este, a lefekvési célod előtt 30 perccel jön egy értesítés (például ha a cél 23:00, akkor
22:30-kor: „Emlékeztetlek 22:30-kor”). Újra koppintva kikapcsolod. Az alvás útvonalán megjelenik a „Lefekvés” állomás a célidővel.

## Hogyan működik
1. Az első koppintáskor a telefon engedélyt kér az értesítésekhez.
2. A lefekvési cél a háttérrendszer alváscéljából jön (célidő + ébredési vagy lefekvési horgony; ezt jelenleg a webes appban állítod be).
3. A telefon egy ismétlődő, helyi értesítést ütemez cél − 30 percre; ha a cél változik, az emlékeztető vele mozdul.
4. Kímélő módban az állomás neve „Korai lefekvés”; ha nincs alváscél, 22:00-ra kerül.
5. Ha nem engedted az értesítéseket, az emlékeztető kikapcsolva marad, és egy rövid sor megmutatja, hol kapcsolhatod be (Beállítások).

## Miért így
- Helyi értesítés, ezért nem kell hozzá szerveres push, és az ingyenes Apple-fiókkal is működik.
- Fél óra elég a levezetésre, de nem túl korán szól.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.feature.sleep-goal.enabled` | Az alváscél funkció be/ki (ebből jön a lefekvési cél) | be |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `sleep_goal` | Célidő (perc), horgony (ébredés vagy lefekvés), a horgony időpontja, rendszerességi sáv |

## Mi jön még
- Az alváscél beállítása a Boopból egyik szakaszban sincs még kimondva (a terveket a B6 hozza át a webről).

## Mi marad ki
- Okos, adatokból számolt lefekvési javaslat nincs: a cél a te beállításodból jön (lefekvés = ébredés − célidő).
