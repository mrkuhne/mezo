---
cim: Kitöltési és zárási emlékeztetők
szint: Kis funkció
terulet: Napló
allapot: Ellenőrzés
hol: [iPhone app]
szulo: 00-attekintes
szakasz: [B3]
osszefoglalo: A telefon csendben szól, ha egy napszak kitöltése vagy az esti zárás még hiányzik — és egy koppintással ott vagy.
---

## Mit csinál
- **Kitöltés**: 07:30 „Reggeli kitöltés”, 12:30 „Déli kitöltés”, 16:00 „Délutáni kitöltés” — szövege: „Mennyi
  energia van benned most? · 6 kérdés, fél perc”. Csak akkor szól, ha az a kitöltés még nincs meg.
- **Esti zárás**: „Zárjuk le a napot” — a lefekvési cél előtt 75 perccel (cél nélkül 21:30), csak ha a nap még nyitott.
- Az értesítésre koppintva a Boop rögtön az első kérdésre / a zárásra nyit.

## Hogyan működik
A telefon hét napra előre ütemezi őket, és minden mentéskor, app-megnyitáskor és háttérfrissítéskor újraszámolja,
így egy kész kitöltés aznap már nem szól. Nincs ismétlés, nincs számláló. A lefekvési emlékeztető külön él (lásd
Alapok · Értesítések).

## Miért így
Az időpontok a spec saját javaslatai, a tulajdonos ellenőrzésére jelölve. Nem nyaggathat: ami kimaradt, az nincs ott.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `RitmusReminders.checkInTime` | A három kitöltési időpont (a kódban rögzítve) | 07:30 · 12:30 · 16:00 |
| `RitmusReminders.closeLead` | Hány perccel a lefekvés előtt szól a zárás | 75 perc |
| `RitmusReminders.closeFallback` | A zárás ideje lefekvési cél nélkül | 21:30 |

## Adattáblák
Nincs — a telefonon élnek.

## Mi jön még
- Időpontok átállítása a fiók lapon — később.
- Válasz közvetlenül az értesítésből — fizetős Apple-fiókkal.

## Mi marad ki
Szerverről küldött kitöltési értesítés a B3-ban.
