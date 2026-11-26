---
cim: Emlékeztetők és ébresztők
szint: Funkció
terulet: Alapok
allapot: Ellenőrzés
hol: [iPhone app]
szulo: 00-attekintes
szakasz: [B5]
osszefoglalo: Bármire állíthatsz emlékeztetőt, a vitaminhoz igazi ébresztőt, és az edzésben a pihenő végét is jelzi a telefon — zárolt képernyőn is.
---

## Mit csinál
- **Emlékeztetők oldal.** Egy lista bármiről, amit nem akarsz elfelejteni (mint az Apple Emlékeztetők): cím, idő, ismétlés (egyszeri, naponta, a hét bizonyos napjain), és hogy mennyire legyen hangos.
- **Két erősség.** Az **Ébresztő** teljes képernyőn szól, némítón és fókusz módban is. Az **Értesítés** egy hangos, hagyományos értesítés. A vitamin emlékeztetője mindig Ébresztő.
- **Vitamin-emlékeztetés.** A kiegészítők listáján minden sornál van egy „Emlékeztess” kapcsoló: bekapcsolva a vitamin bekerül ugyanebbe a listába, és az ébresztő gombja **„Bevettem”** — ez a mai napba is beírja, hogy bevetted.
- **Kész gombok.** Az értesítésen **Kész** és **10 perc múlva** gomb van, az ébresztőn **Leállítom** és **Kész** (vitaminnál **Bevettem**). Mindez az app megnyitása nélkül működik.
- **Ma oldalon** egy „Emlékeztetők” rész mutatja a mai tételeket, itt is pipálhatod őket. A „+” lapon új, tizedik kapu nyit új emlékeztetőt.
- **Pihenő vége.** Edzés közben, ha a telefon zárolva van, a pihenő végén rezeg és rövid hang szól. Beállítható, hogy ébresztő erősségű legyen.
- **Telepítés lejárta.** Az ingyenes fejlesztői fiókkal telepített app hét nap után nem nyílik meg, és az ébresztők is leállnak vele. A Boop egy nappal előtte, délelőtt tízkor szól: „Holnap lejár a Boop telepítése”.

## Hogyan működik
1. Az emlékeztetők a telefonon vannak, a saját fiókodhoz kötve; net nélkül is működnek.
2. A telefon mindig csak a következő napokat ütemezi be: az ébresztőket hét napra, az értesítéseket három napra előre. Minden indításkor, a háttérből felébredve és szerkesztéskor újra összerakja. Egy épp szóló ébresztőt ez sosem hallgattat el — azt csak te állítod le. Az oldal alján külön látod, meddig vannak beállítva az ébresztők és meddig az értesítések; ha mára több értesítés jutna, mint amennyit az iPhone előre beállít, az oldal szól, és a kimaradó sor mellett ott a „Ma már nem fér több értesítés”.
3. Az ébresztő **csak elnémít**, ha leállítod (gombbal, a lehúzással vagy az oldalsó gombbal is): a tétel nyitva marad. **Csak a Kész / Bevettem gomb számít megtörténtnek.** Így a Boop adata azt jelenti, hogy tényleg megtörtént.
4. A vitamin „Bevettem” jelzése offline is megy: a telefon eltárolja, és amikor van net, elküldi. Ha a szobában korábban bejelölöd, aznap nem szól az ébresztő. Ha a tegnapi értesítést csak reggel nyomod „Kész”-re, az a tegnapi napra számít (a tegnapi időponttal), és a mai ébresztő ugyanúgy szól. Ha egy kiegészítő-csoport megszűnik, az emlékeztetője is törlődik, és az oldal ezt egyszer jelzi; net nélkül vagy üres listánál sosem töröl.
5. Csak a kijelentkezés törli az ébresztőket; ha épp nincs net, minden marad, ahogy volt.
6. A Boop saját emlékeztetőinek (kitöltések, zárás, lefekvés) be/ki kapcsolása vagy idejük átállítása azonnal érvényes.
7. Az első új, hangos emlékeztető mentésekor a telefon engedélyt kér az ébresztőkre és az értesítésekre; máskor nem kérdez.

## Miért így
- Az ébresztő leállítása sosem „kész” — tulajdonosi döntés (2026-11-25), hogy a későbbi vitamin ↔ alvás/forma összevetés valódi adatból dolgozzon.
- A vitamin ébresztő, mert ezt nem szabad elnyomnia a némító kapcsolónak.
- Minden az ingyenes Apple-fiókkal működik; a fizetős még nem aktív, és egy ideig nem is lesz.
- Lásd a Döntések naplót (2026-11-25).

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| Emlékeztető erőssége | Ébresztő vagy Értesítés, emlékeztetőnként | Értesítés (vitaminnál Ébresztő) |
| `Emlékeztess` (kiegészítők) | A vitamint felveszi az emlékeztetők közé | ki |
| Lefekvés-emlékeztető | A beépített lefekvési emlékeztető be/ki | ki |
| `Pihenő vége` | Rezgés és hang, vagy ébresztő erősségű jelzés | rezgés és hang |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `reminders.json` | Az emlékeztetőid listája, fiókonként a telefonon |
| `supplements-taken.json` | Mely vitamincsoportot vetted be melyik napon (14 napig őrzi) |

## Mi jön még
- **Második lépés:** négy widget (Következő, Mai nap, Napközbeni kérdés, zárolt képernyős sor) és az edzéskártya a zárolt képernyőn (Kész · +15 mp · Tovább).
- Az ébresztők éles telefonon való végigpróbálása még hátravan.

## Mi marad ki
- Nincs iCloud-szinkron: az emlékeztetők nem költöznek másik készülékre.
- Nincs helyalapú emlékeztető („amikor odaérek”).
- Az ébresztő képernyőjén nincs szundi — két gomb fér el; a pipálás később az appban, a widgeten vagy a Mából megy.
