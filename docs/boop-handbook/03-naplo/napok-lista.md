---
cim: A napok (Napló lista)
szint: Funkció
terulet: Napló
allapot: Ellenőrzés
hol: [iPhone app, Háttérrendszer]
szulo: 00-attekintes
szakasz: [B2, B3]
osszefoglalo: A Nap szoba „Napok” füle (a régi Napló hely) az elmúlt 14 napodat mutatja — értékelés, cél, energiavonal, a napló első sora —, a mai és az előző hat nap mindig ott van; a nap lapján pótolható a kimaradt check-in, az edzés és a zárás, és ott vannak a nap naplósorai.
---

## Mit csinál
A Nap szoba **Napok** fülén (a Nap gömbre koppintva nyílik; alatta sáv: Ma · Napok · Boop; 2026-11-28 óta ez a régi Napló hely) **„A NAPOK”**: az elmúlt 14 nap üvegsorokban, a legújabb felül. Egy sor: a dátum (például „Tegnap ·
szerda · nov. 11.”), az értékelés szava, a cél és eredménye, egy mini energiavonal a pöttyökkel, és a napló első
sora idézőjelben. Koppintásra a nap **„A MAI NAPOD”** összegzése és energiagörbéje nyílik.

A **mai és az előző hat nap mindig ott van** (2026-11-24): az üres nap egy sorral („Erről a napról még nincs semmi.”),
hogy a pótlásai megtalálhatók legyenek; a régebbi napok csak akkor, ha van bennük valami. Alatta **„MINTÁK”**: „Amint
elég napod összegyűlik, itt látod, mi hat mire.” (még keret).

**A nap lapján — PÓTLÁS** (2026-11-24): a három pillanat jelekkel (reggel ✓ · dél – · délután ✓), és ami hiányzik, arra
egy-egy gomb: „Check-in pótlása: dél”, „Edzés pótlása: Pull Day” (ha arra a hétköznapra van tervnap és nincs kész
edzés), „Lezárom a napot” (ha nincs zárás). A mai nap lapján csak a már elmúlt, kimaradt check-in pillanatok
pótolhatók (reggel 10 óra után, dél fél 3 után); a mai zárás és a mai edzés az esti folyamaté és a lejátszóé. Egy
hétre visszamenőleg. Mentés után a lap marad, a blokk frissül — két dolgot egymás után is pótolhatsz.

**A NAP SORAI:** a nap naplósorai (amit a gyors rögzítésből vagy az esti zárásból írtál, arra a napra), így a
visszamenőleg írt sor is látszik ott, ahova tetted.

## Hogyan működik
A lista a szerver zárási rekordjaiból és a kitöltésekből épül, kiegészítve azzal, amit a telefon még nem küldött el
(ezeknél egy kis felhő jelzi). A webes appban lezárt nap is megjelenik.

## Miért így
A B2 csak egy keretet tett a Napló helyre. A B3 egy minimális listát ad, hogy legyen hova visszanézni; a teljes
böngésző és a minták később jönnek.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.dayclose.max-range-days` | A lista legfeljebb ennyi napot kérhet le egyszerre | 92 |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `day_close` | A zárások |
| `check_in` | A kitöltések (a mini energiavonalhoz) |
| `journal_entry` | A napló szövege |

## Mi jön még
- Napló · Minták: rövid, közép és hosszú távú következtetések, hatáskövetés — B8.
- 14 napnál régebbi napok lapozása — később.
- Halk „utólag” jel a később beírt check-inen és záráson (a szervernek egy második időpontot kell tárolnia).

## Mi marad ki
Nincs.
