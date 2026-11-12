---
cim: Értesítések
szint: Funkció
terulet: Alapok
allapot: Részben kész
hol: [iPhone app, Háttérrendszer]
szulo: 00-attekintes
szakasz: [S3, B1, B3]
osszefoglalo: A Boop a telefonon beütemezett, csendes értesítésekkel szól lefekvés, kitöltés és esti zárás előtt — szerverről küldött értesítés még nincs.
---

## Mit csinál
Három fajta emlékeztető van:

| Emlékeztető | Mikor szól | Állapot |
|---|---|---|
| **Lefekvés** | A lefekvési cél előtt 30 perccel, minden este | Élesben |
| **Kitöltés** (reggel, délben, délután) | 07:30, 12:30, 16:00 — csak ha az adott kitöltés még nincs meg | Ellenőrzés (B3) |
| **Esti zárás** | A lefekvési cél előtt 75 perccel (cél nélkül 21:30) — csak ha a nap még nincs lezárva | Ellenőrzés (B3) |

Az értesítésre koppintva a Boop **egyenesen** a kitöltés első kérdésére vagy az esti zárásra nyit.

## Hogyan működik
- A **lefekvési emlékeztetőt** az Alvás gombbal (vagy a lefekvés kártya „Emlékeztess” gombjával) kapcsolod be. Az
  első koppintás engedélyt kér; ha a lefekvési cél változik, az emlékeztető vele mozdul. Ha az engedélyt
  megtagadod, egy kedves sor megmondja, hol lehet bekapcsolni.
- A **kitöltési és zárási emlékeztetők** a telefonon vannak beütemezve hét napra előre; minden mentés, minden
  app-megnyitás és minden háttérfrissítés újraszámolja őket, így egy kész kitöltés aznap már nem szól.
- Nincs számláló a piros pöttyön, nincs ismétlés, nincs „elmulasztottad” szöveg.
- A telefon már bejelenti az értesítési címét a szervernek, de **a szerver még nem küld semmit**.

## Miért így
A spec (B3, D9 döntés): a telefonon beütemezett értesítés az ingyenes Apple-fiókkal is működik; a szerverről küldött
csak a fizetős fiókkal. A Boop nem lehet nyaggató: ami kimaradt, az egyszerűen nincs ott.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `RitmusReminders.checkInTime` | A három kitöltési emlékeztető időpontja (a kódban rögzítve) | 07:30 · 12:30 · 16:00 |
| `RitmusReminders.closeLead` | Hány perccel a lefekvési cél előtt szól az esti zárás | 75 perc |
| `RitmusReminders.closeFallback` | Esti zárás ideje, ha nincs lefekvési cél | 21:30 |
| `RitmusReminders.horizonDays` | Hány napra előre ütemez | 7 |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `sleep_goal` | A lefekvési cél, amihez az emlékeztetők igazodnak |
| `apns_device` | A telefon értesítési címe (szerverküldéshez, később) |

## Mi jön még
- Válasz az értesítésből az app megnyitása nélkül — fizetős fiókkal.
- Szerverről küldött javaslat-értesítések — B7.
- Az időpontok átállítása a fiók lapon — később.

## Mi marad ki
Jelvények, sorozatok („streak”), bűntudatkeltő szövegek.
