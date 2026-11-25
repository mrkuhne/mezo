---
cim: Italok — kalória igen, étkezési ablak nem
szint: Funkció
terulet: Étel
allapot: Ellenőrzés
hol: [iPhone app, Háttérrendszer]
szulo: 00-attekintes
szakasz: [Kezdőlap]
osszefoglalo: Az ital (fehérjeturmix, gombakávé zabtejjel) a napi keretbe és a görbébe beszámít, de étkezési ablakot nem foglal és pontot nem kap; a szokásos italaid egy koppintásra.
---

## Mit csinál
Az étkezés rögzítésében és a „Mit rögzítesz?” lapon új **Ital** bejárat van (2026-11-24). Az ital-lapon:

- **Szokásos italaid** chipekben, egy koppintásra — Boop abból tanulja, amit rögzítesz; az első alkalommal beírod
  (például „gombakávé zabtejjel mézzel”), kijavítod az adagokat, és a második alkalomtól pontosan azt hozza.
- **Vagy írd le** / fotózd, és a leírás nélküli bejáratok is ott vannak: **Recept · Kamra · Vonalkód** — a
  turmix-recepted vagy a kamrából a fehérjepor egy koppintással italként megy be.
- **Mikor ittad:** Most · Tegnap · Más időpont, egy hétre visszamenőleg.

Az ital **beszámít a napi keretbe, a makrókba és a nap görbéjébe**, de **étkezési ablakot nem foglal** (a tízórai
tízórai marad), **étkezés-pontot nem kap**, és az Étel gömb száma sem mozdul tőle. Az Étel szoba **Ma** lapján az
ablakok alatt külön **ITALOK** csoport sorolja (név · idő · kalória · fehérje, gyűrű nélkül), a **Hét** lapon a nap
részleteiben „ital” jelet kap. Nulla kalóriás ital (fekete kávé, tea) is rögzíthető. A vízszámlálóba csak a víz
számít.

## Hogyan működik
- A szerveren az ital ugyanolyan étkezés-rekord, csak a rekesze „ital” (a reggeli · ebéd · vacsora · nasi mellett a
  hatodik). A napi terv ablakai sosem igénylik maguknak, az értékelő nem ad rá pontot, a szokásos listában saját
  vödörként jön vissza, és Boop napi szabályai („mi a következő kihagyott étkezés”) sem veszik étkezésnek.
- Net nélkül az ital a telefonon vár, mint az étkezés, és amikor Boop kiszámolja, akkor is ital marad.
- A receptnek és a kamra tételnek nem kell ital-kategória: bármelyik rögzíthető italként.

## Miért így
A tulajdonos 2026-11-24-én kérte: „ugyanúgy van kalória tartalma, de nem étel slotot fogyaszt” — és hogy a
receptek és a kamra tételei italhoz is használhatók legyenek, ne kelljen mindig nulláról felvenni őket. Lásd a
döntést: *Ital: hatodik, pont nélküli vödör*.

## Beállítások
Nincs.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `meal` | Az ital is itt van, a `slot` mezőben „drink” |

## Mi jön még
- Az italból a koffein ideje az „Utolsó koffein” szabályba.
- Ital-szűrő a receptek és a kamra listáin.

## Mi marad ki
Külön ital-tábla: az ital étkezés-rekord egy másik rekeszben.
