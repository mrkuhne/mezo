---
cim: Feelfit mérleg — testösszetétel
szint: Funkció
terulet: Apple Health és adatok
allapot: Tervezve
hol: [iPhone app, Apple Health, Háttérrendszer]
szulo: 00-attekintes
szakasz: [Test]
osszefoglalo: A Feelfit mérleg súly-, testzsír- és izomadatai az Apple Egészségen át jönnek, és egy „Test” kártyán jelennek meg a Tervben.
---

## Mit csinál
**Ma már:** a reggeli mérlegelés (súly, testzsír %, sovány testtömeg) a Feelfit appból az Apple Egészségbe,
onnan a Boopba kerül — a súly a súlynaplóba, a többi tárolva, de sehol nem látszik.

**Tervezve (Test szakasz):**
- Egy **„Test” kártya / szoba a Tervben**: súlytrend a célvonallal, testzsír % és sovány tömeg vonala, alatta a mérlegelési napok.
- A legfrissebb (14 napon belüli) testzsír % a kalóriacél számításába megy (pontosabb alapanyagcsere), „miért?” magyarázattal.
- BMI kiszámolva a magasságodból.
- Testzsír és sovány tömeg is a háttérben érkezik (fizetős Apple-fiók után).

## Hogyan működik
1. A Feelfit minden mérés után beírja a négy adatot az Egészségbe (súly, testzsír %, BMI, sovány tömeg).
2. A Boop a súlyt, a testzsírt és a sovány tömeget olvassa (a B1 óta).
3. A Test szakasz ezekből rajzol a Napkelte vázára, és a testzsírt átadja a cél-motornak.

## Miért így
- Tulajdonosi döntés (2026-11-12, „A” változat): csak azt használjuk, amit az Apple Egészség hoz. Nincs Feelfit export-beolvasás és nincs közvetlen Bluetooth-kapcsolat a mérleggel.
- A mérleg maga csak súlyt és ellenállást küld; a többi számot a Feelfit zárt képlete számolja, ezért saját képlettel más számokat mutatnánk, mint a Feelfit app.

## Beállítások
Nincs.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `health_sample` | `body_mass`, `body_fat_pct`, `lean_body_mass` minták, forrás: Feelfit |
| `weight_log` | A súlymérések |

## Mi jön még
- A szakasz a B3 beolvadása után indul: ötletelés → szimulátoros minta → terv → tulajdonosi jóváhagyás → építés (kb. 2–3 nap).

## Mi marad ki
- Viscerális zsír, testvíz, csonttömeg, izomtömeg, anyagcsere-kor: ezeknek nincs Apple Egészség-típusa, így nem jönnek át.
- Feelfit-export beolvasás (később újragondolható, ha az export formátuma kiderül).
