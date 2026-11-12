---
cim: Test kártya (Feelfit mérleg)
szint: Funkció
terulet: Terv
allapot: Tervezve
hol: [iPhone app, Apple Health, Háttérrendszer]
szulo: 00-attekintes
szakasz: [Test]
osszefoglalo: A Feelfit mérleg súlya, testzsírja és sovány testtömege egy kártyán a Tervben, és a friss testzsír pontosítja a kalóriacélt.
---

## Mit csinál
Egy új **„Test”** kártya (vagy szoba) a Terv oldalon, a szokásos szobaváz szerint:

1. **Ítélet-mondat**, például: „A súlyod a terv szerint csökken; a zsírszázalék két hét alatt kicsit lejjebb ment.”
2. **Súlytrend** a cél vízvonalával, alatta halkabban a **testzsír-százalék** és a **sovány testtömeg**.
3. **A mérési napok** mögötte: dátum, kg, zsír%, forrás („Feelfit”).
4. A **BMI** kiszámolva a súlyból és a magasságból.

A kalóriacél „miért?” nézete megmondja, melyik képlettel és melyik mérésből számolt a motor.

## Hogyan működik (terv)
1. A Feelfit a mérés után négy értéket ír az Apple Health-be: súly, testzsír %, BMI, sovány testtömeg. A Boop (B1 óta) a súlyt,
   a testzsírt és a sovány testtömeget már beolvassa — **az adat már folyik, csak nincs megmutatva és nincs felhasználva.**
2. A súlycél-motor ma a profilban tárolt, egyszeri testzsír-értéket használja. A szakasz után a **legfrissebb, legfeljebb 14 napos
   Health-testzsír** megy a nyugalmi anyagcsere képletébe (Katch-McArdle).
3. A testzsír és a sovány testtömeg is háttérfrissítést kap (a fizetős fejlesztői tagsággal), így a reggeli összefoglaló megvárhatja a
   reggeli mérést.
4. Új tábla nem kell; egy kis olvasó-nézet a háttérben és egy iPhone-nézet.

## Miért így
A tulajdonos az **„A”** utat választotta (döntés #7, 2026-11-12): csak azt használjuk, amit az Apple Health hoz. A Feelfit többi
mérése (zsigeri zsír, testvíz, csonttömeg, izomtömeg, anyagcsere-kor) a Feelfit zárt rendszerében marad: nincs nyilvános
adatkapcsolat, a saját Bluetooth-olvasás pedig más számokat adna, mint amit a Feelfit mutat. A Feelfit-export importálása
(„B” út) és a közvetlen Bluetooth („C” út) elvetve.

## Beállítások
Nincs még; a szakasz tervezésekor dől el (például a 14 napos frissességi határ).

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `weight_log` | A Feelfit súlya „Apple Health” forrással |
| `health_sample` | Testzsír % és sovány testtömeg mintái, a forrás nevével („Feelfit”) |
| `biometric_profile` | A profil testzsír-értéke (a mai motor-bemenet, amit a friss Health-érték vált fel) |

## Mi jön még
**Testösszetétel szakasz** (`mezo-r36n9.28`), a B3 után: ötletelés → szimulátoros próba a Test kártyáról → terv → tulajdonosi OK →
építés. A B6 később erre építi a célszerkesztőt.

## Mi marad ki
A Feelfit Health-be nem írt mérései (zsigeri zsír, testvíz, csonttömeg, izomtömeg, fehérje %, anyagcsere-kor); a Feelfit-export
importálása; közvetlen Bluetooth-kapcsolat a mérleggel.
