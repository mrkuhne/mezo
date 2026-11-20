---
cim: A terület — Ma és Költés oldal
szint: Funkció
terulet: Pénz
allapot: Élesben
hol: [iPhone app, Háttérrendszer]
szulo: 00-attekintes
szakasz: [Életpanel]
osszefoglalo: Megnyílik a Pénz terület a telefonon — a Ma oldal megmondja, van-e ma dolgod a pénzeddel, a Költés oldal pedig, mennyi maradt a héten, honnan jön ez a szám, mire megy el a pénzed és mire gyűjtesz. Készpénzt pár másodperc alatt rögzítesz, net nélkül is.
---

## Mit csinál
A gyűrű Pénz gömbje most már egy élő oldalt nyit, saját alsó sávval: **Ma · Pénzem · Költés · Gyakorlás · Boop**.
A gömb nem mutat számot — annyira telik meg, amennyi a heti pénzedből még megvan.

- **Ma — „mi a dolgom ma?”** Egy mondat. A legtöbb napon: *„Ma nincs dolgod a pénzeddel.”* Ha mégis van valami,
  akkor csak egy dolog, a gombjával: előbb az ellenőrzésre váró banki üzenetek, aztán egy lezáratlan hónap. Alatta
  két gomb (*Kiadás* · *Befektetnék*) és három szám: mennyi maradt a hétből, mennyi a hónapból hány napra, és
  mennyi jut ma egy napra.
- **Költés — a heti maradék.** Nagyban: például „ezen a héten még 34 500 Ft-od van”, a napi összeggel és a hét
  sávjával. Alatta, soronként, **honnan jön ez a szám**: ami bejön · fix kiadások · amit félreteszel · a
  **gyakorlás** (külön sor) · **az előző hónap hiánya** (külön sor, akkor is, ha nulla) · ami szabadon marad. Aztán
  a hónap állása (elköltve, maradt, a mostani tempód), **mire megy el** kategóriánként, **a mai tételek** az
  ellenőrzésre váró banki üzenetekkel, és **mire gyűjtök** — a céljaid és vásárlási terveid, mindegyiknél hol
  tartasz.
- **Készpénz rögzítése** a *Kiadás* gombbal, a Pénz oldalról vagy a „+” gombról: összeg, kategória, ha akarod egy
  megjegyzés. Ha még nincs számlád a Boopban, az első alkalommal egy érintéssel létrehozza a „Készpénz” számlát.
  Térerő nélkül is működik: a tétel azonnal megjelenik a mai tételek között („küldésre vár”), a heti
  maradék rögtön csökken vele, és amikor újra van net, magától elmegy.
- **Banki üzenetek átnézése:** kategóriát választasz, *Rendben*, és a tétel lekerül a listáról.
- **Hónap lezárása:** a legrégebbi lezáratlan hónap számaival; te döntöd el, mi legyen a maradékkal (átteszed a
  megtakarításba, megtartod) — magától semmi nem történik.
- **Keretek:** a kategóriák havi kerete és hogy mennyit költöttél belőlük.
- **A Terv oldalon** megjelenik egy kártya a heti maradékkal és a napi összeggel.
- A **Pénzem** oldal és a Ma oldal alján a napi hírek a 3. lépésben készültek el (lásd: *A vagyonod és a napi
  hírek*). A **Gyakorlás** oldal őszintén kiírja, hogy még nem készült el — kitalált szám nincs rajta.

## Hogyan működik
Minden szám a háttérrendszer számolásából jön (lásd: *Az adatalap*); a telefon csak összeadja a kategóriákat és a
még el nem küldött készpénzes tételeket. Az oldal megjegyzi az utolsó választ, így net nélkül is megnyílik, és
kiírja, milyen régi az adat. Minden magyarázat egy csendes sor mögött van („Mi történik a hónap végén?”,
„Honnan tudom, van-e dolgod?”), nem a görgetőn. Minden szakaszfejnek saját ikonja van.

Például: ha a héten 80 000 Ft a keret, 45 500 Ft-ot már elköltöttél, és most rögzítesz egy 1 890 Ft-os kávét net
nélkül, a heti maradék azonnal 32 610 Ft-ot mutat.

## Miért így
- A tulajdonos jóváhagyta a látványtervet (2026-11-19): ikon minden szakaszfejen, két gomb minden ítélet alatt, a
  magyarázat egy sor mögött, és a gömbben nincs pontszám.
- A „Ma nincs dolgod” teljes válasz — Boop nem sürget, nem ígér hozamot, és soha nem mondja, hogy adj el valamit.
- A Ma oldal harmadik száma a napi összeg, nem „ennyit tudsz befektetni”: azt a számot a rendszer még nem számolja,
  kitalálni pedig nem szabad. A befektetési javaslatokkal jön.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| Megtakarítási cél (a „honnan jön ez a szám” *Egy sor módosítása* gombja) | havonta mennyit teszel félre | 0 Ft |
| Gyakorlás havi kerete (ugyanott) | a gyakorló kereskedés havi pénze | 20 000 Ft |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `penz_savings_goal` | a céljaid és vásárlási terveid: név, cél vagy vásárlás, mennyi kell, mennyi van meg, mikorra |
| `penz_transaction` | a készpénzes tétel is ide kerül, egy azonosítóval, hogy kétszer soha ne legyen meg |

## Mi jön még
- A Gyakorlás oldal és Boop javaslatai (*Befektetnék*, *Nagyobb összeg*, *Havi stratégia*) — 4. lépés.
- A régi appod adatainak egyszeri átköltöztetése, utána a régi app kikapcsolása.
- A Terv kártyájáról egy érintéssel a Pénz oldalra jutni — amikor a Terv oldal elkészül.

## Mi marad ki
- Időpont a tételek mellett: a bank és a kézi rögzítés csak napot ad.
- Boop vásárlási tanácsa a „mire gyűjtök” soroknál (melyik hónapban, melyik lehetőség) — a javaslatokkal jön.
- Értesítés a pénzedről — nem lesz.
