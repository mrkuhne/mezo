---
cim: Hangbevitel
szint: Funkció
terulet: Boop
allapot: Ellenőrzés
hol: [iPhone app, Háttérrendszer, AI]
szulo: 00-attekintes
szakasz: [B3]
osszefoglalo: Boopnak beszélhetsz — a chatben a mikrofon kitölti a kérdést, este a napló egy koppintással felmondható.
---

## Mit csinál
- **A chatben:** a mikrofon gomb lenyomása után beszélsz, és a felismert szöveg bekerül az írómezőbe.
- **Esti zárás, „Mesélj”:** egy koppintás a beszédhez, egy a leállításhoz; „Leírom…”, aztán megjelenik a szöveg. Gépelni is
  lehet ugyanoda („Vagy írd be…”).
- **Kitöltés után:** egy opcionális mondat hanggal vagy gépelve.

## Hogyan működik
1. A telefon felveszi a hangot.
2. Ha az iPhone tud **magyarul a készüléken** felismerni, ott helyben lesz belőle szöveg — net nélkül is.
3. Ha nem, a felvétel a telefonon vár, és amikor van net, a háttérrendszer leíratja szöveggé egy AI-val (a beszédet a
   Google Gemini írja le), majd a szöveg naplóbejegyzésként mentődik.
4. A hangfelvétel a sikeres leírás után törlődik, és máshová nem megy.
- Ha nincs net és helyi felismerés sem, a chat mikrofonja halványan jelzi, hogy most nem elérhető.

## Miért így
B3 tervezés, D7: a napló esti, beszélt műfaj legyen, mert gépelni fárasztó. D1: utazás közben sincs adatvesztés.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.companion.llm.per-call-kind.TRANSCRIBE` | Melyik AI-szolgáltató írja le a hangot | gemini |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `journal_entry` | Az esti beszélt szöveg (egyetlen helyen tárolva, Boop forrásjellel) |
| `llm_log_history` | A leírató hívás naplója és költsége |

## Mi jön még
Siri-parancsok („rögzítsd: ebéd…”) a későbbi szakaszokban, amikor az első igényli.

## Mi marad ki
A hangfelvétel megőrzése — szándékosan törlődik a leírás után.
