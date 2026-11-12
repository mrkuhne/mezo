---
cim: Az Étel szoba ma (B2 váz)
szint: Funkció
terulet: Étel
allapot: Élesben
hol: [iPhone app, Háttérrendszer]
szulo: 00-attekintes
szakasz: [S3, B2]
osszefoglalo: Ma a Fuel gömbről nyíló egyszerű szoba mutatja, mennyit ettél a célhoz képest, a „+” lapon pedig már ott az Étkezés csempe.
---

## Mit csinál
Ami az iPhone-on ma már megvan az ételből:

- **A reggeli összefoglalóban** szerepel az étel: mennyi kalóriát ettél eddig a napi célhoz képest, és a napi útvonalon
  az étkezések (S3).
- **A Fuel szoba**: a Ma oldalon a Fuel gömbre (vagy a lencsesor sorára, vagy az útvonal egy állomására) koppintva
  megnyílik a szoba ugyanazzal a négy részes vázzal, mint a többi: 1 A szint (szám és felirat), 2 a hét (az ételnél
  még egy őszinte „hamarosan” sor), 3 a napok mögötte, 4 Mit tehetsz.
- **A „+” lap** felső kártyája az „Étkezés” — „Boop kiszámolja, és megmondja, belefér-e” — négy gombbal: Fotó,
  Szöveg, Vonalkód, Recept. Alatta egy szövegmező: „Mondd vagy írd: ebéd, csirke rizzsel…”. Ezek **még csak keretek**:
  koppintásra „hamarosan” üzenet jön.

## Hogyan működik
A telefon a reggeli összefoglalót kéri le a háttérrendszertől. Az összefoglaló az étel-napot a meglévő napi étel-nézetből
veszi (célok, elfogyasztott mennyiség, étkezések), és egy sorba sűríti: „eddig ennyi a célhoz képest”. A telefon ezt
mutatja a gömbön és a szobában. Írni még semmit nem lehet a Boopból — étkezést ma a webes appban rögzítesz, és a Boop
a következő frissítéskor látja.

## Miért így
A B2 szakasz (Gerinc) feladata az új váz volt: Ma · Terv · Napló · Boop + „+”, a szobák közös sablonja és a „+” lap
kerete. A valódi étel-funkciók a B4-ben épülnek, ezért a keret őszintén „hamarosan”-t mond, nem tesz úgy, mintha működne.

## Beállítások
Nincs.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `boop_brief` | A napi reggeli összefoglaló, benne az étel-sor |
| `meal` | Az étkezések, amelyekből az „eddig ennyi” összeadódik |

## Mi jön még
B4: a Fuel szoba helyére a teljes Étel szoba lép a belső fülekkel (Ma · Receptek · Kamra · Hét), és a „+” lap
étkezés-gombjai élesednek.

## Mi marad ki
Nincs.
