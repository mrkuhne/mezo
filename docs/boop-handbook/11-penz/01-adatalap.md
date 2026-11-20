---
cim: Az adatalap — a heti maradék kiszámolása
szint: Funkció
terulet: Pénz
allapot: Élesben
hol: [Háttérrendszer, AI]
szulo: 00-attekintes
szakasz: [Életpanel]
osszefoglalo: A pénzed bekerül a Boopba, és Boop kiszámolja, mennyi maradt a héten és ma — a banki üzenetekből magától elkapja a költéseket, a gyakorlópénz külön sor, és Boop nem mondhat ki olyan összeget, amit nem tud alátámasztani.
---

## Mit csinál
Ez a Pénz terület alapja, képernyő nélkül. Négy dolgot ad:

- **A heti maradék ki van számolva.** Boop tudja, mennyi a hónap szabad pénze, ebből mennyi jut erre a hétre, mennyit
  költöttél már, és mennyi jut még egy napra. Például: ha a héten még 35 000 Ft maradt és szerda van, akkor a hét
  hátralévő öt napjára napi 7 000 Ft jut.
- **A banki SMS magától, biztonságosan beérkezik.** A telefonod egy parancsikonnal továbbküldi a bank üzenetét;
  Boop kiolvassa belőle az összeget, a boltot és a dátumot, és felveszi tételnek „átnézendő” jelzéssel.
- **A gyakorlópénz külön sor.** A gyakorló kereskedésre szánt havi keret (alapból 20 000 Ft) úgy jön le a szabad
  pénzből, mint egy fix kiadás — így látod, hogy a gyakorlás mennyibe kerül, és nem keveredik a napi költéssel.
- **Az őr, amely megállítja Boopot.** Ha Boop egy mondatban olyan összeget írna, amit a számolás nem adott ki,
  a mondat nem jut el hozzád úgy.

## Hogyan működik
**A számolás, soronként.** A hónap szabad pénze: a rendszeres bevétel + az egyszeri bevétel − a fix kiadások − a
megtakarítási cél − a gyakorlópénz − a hónapban befektetett összeg − az előző hónap hiánya. Ebből jön le a napi
költés, és ami marad, az a hónap maradéka. Mind a tíz sor külön látszik majd, hogy minden szám visszakövethető
legyen. Például: 600 000 Ft bevételből 250 000 Ft fix kiadás, 100 000 Ft megtakarítás és 20 000 Ft gyakorlás után
230 000 Ft a szabad pénz.

**A hét.** A hét hétfőn kezdődik. A hét kerete a hónap még el nem költött pénzének arányos része a hét napjaira; ha
a hét átnyúlik a következő hónapba, mindkét hónapból a saját részét kapja.

**Az előző hónap hiánya.** Csak akkor számít, ha az előző hónapot le is zártad — a hónapokat a legrégebbivel
kezdve lehet lezárni. Zárásnál a maradékot átteheted a megtakarítási számládra, vagy hagyhatod.

**Az ismétlődő tételek** (fizetés, lakbér, előfizetések) maguktól tétellé válnak az esedékes napon, amikor Boop
legközelebb ránéz a pénzedre.

**A devizás tételek.** Egy euróban vagy dollárban fizetett tétel forintértékét Boop az aznapi hivatalos európai
árfolyamon számolja ki egyszer, és elmenti. Egy későbbi árfolyam soha nem írja át a múltat. Ha az árfolyamszolgáltató
épp nem elérhető, legfeljebb egy héttel korábbi árfolyamot használ; ha az sincs, a rögzítés később sikerül.

**A banki SMS útja.** A parancsikon egy saját kulccsal küld — ez a kulcs csak erre az egy dologra jó, másra nem.
Egy kulccsal percenként legfeljebb 20, naponta legfeljebb 500 üzenet jöhet. Ugyanaz az üzenet kétszer soha nem lesz
két tétel. Ami nem pénzről szól (például egy belépési kód), azt Boop eldobja, a szövegét nem tartja meg. Az összeget
Boop csak akkor fogadja el, ha betű szerint benne van az üzenetben.

## Miért így
- A tulajdonos döntése: a gyakorlás saját sor legyen, és a hónapzárás hiánya vigye át a következő hónapra.
- Boop soha nem talál ki számot: minden összeg a háttérrendszer számolásából jön, a mesterséges intelligencia csak
  elmondja.
- A banki SMS-kulcs külön kulcs, nem a belépésed: ha a telefonod parancsikonja rossz kezekbe kerülne, az csak SMS-t
  tudna beküldeni, a pénzügyeidet nem látja.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `practice_monthly_minor` | a havi gyakorlópénz (fillérben) | 20 000 Ft |
| `savings_target_minor` | a havi megtakarítási cél (fillérben) | 0 Ft |
| `mezo.penz.fx-fallback-days` | hány napos régi árfolyam használható, ha a szolgáltató nem elérhető | 7 nap |
| `mezo.penz.sms-per-minute` / `sms-per-day` | hány banki üzenet jöhet egy kulccsal percenként / naponta | 20 / 500 |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `penz_settings` | a pénzügyi beállításaid (megtakarítási cél, gyakorlópénz, időzóna) |
| `penz_account` | a számláid (melyik az alap, melyikre megy a megtakarítás, melyik bank küldi az SMS-t) |
| `penz_category` | a költési és bevételi kategóriák (15 magyar alapkategória) |
| `penz_transaction` | minden tétel, eredeti pénznemben és forintban |
| `penz_recurring_rule` | az ismétlődő bevételek és fix kiadások |
| `penz_month_close` | a lezárt hónapok maradéka vagy hiánya |
| `penz_fx_rate` | a már lekért árfolyamok, napra (közös, nem személyes) |
| `penz_sms_message` | a beérkezett banki üzenetek és mi lett velük |
| `penz_api_key` | a parancsikon kulcsa (csak egy ujjlenyomata, maga a kulcs nem) |

## Mi jön még
- (A Pénz oldal a telefonon, a „mire gyűjtök” rész és a keretek elkészültek — lásd: *A terület*.)

## Mi marad ki
- Egy SMS-ben jött befektetési vásárlás összepárosítása a rögzített vásárlással — a 3. lépés hozza.
- Értesítés pénzügyekről — nem lesz.
