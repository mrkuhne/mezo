---
cim: Honnan jönnek a javaslatok
szint: Funkció
terulet: AI és memória
allapot: Részben kész
hol: [Háttérrendszer, AI]
szulo: 00-attekintes
szakasz: [B2, B7, B8]
osszefoglalo: A javaslatkártyák és a „miért?” sorok forrása — ma egyetlen szabály, később élő újratervezés és egy napra szabott kis tanács; egyik sem alkalmaz semmit a koppintásod nélkül.
---

## Mit csinál
A kártyák felülete a **Ma › Javaslatkártyák és a „miért?”** oldalon van leírva. Ez az oldal azt írja le, mi **állítja elő**
őket a háttérben, és mi kerül a „miért?” nézetbe.

## Hogyan működik
- **Ma (B2, élesben):** egyetlen forrás van — a reggeli összefoglaló szabálya, ami észreveszi, ha egy megbeszélés túl közel
  ér véget az edzéshez. Ez nem AI-döntés: kód számolja, az AI legfeljebb megfogalmazza a mondatot.
- **A „miért?” ma:** a mögötte lévő tények (megbeszélés vége, edzés kezdete) és csak azok a szakterületi sorok, amelyeket az
  összefoglaló ténylegesen hordoz. Közérzet és Szkeptikus sor még nincs.
- **A közös szabály minden forrásra:** a javaslat csak ajánlat; elfogadásig semmi nem változik, és napi plafon van (ma 3).

## Miért így
Standalone terv (2026-11-11): az AI javasol, a tulajdonos dönt; a szakértők csak a „miért?” mögött szólnak (Döntések
naplója #5). A kutatás szerint ma semmi nem tervezi újra a napot élő adatból — ezt a B7 építi meg.

## Beállítások
Nincs még saját beállítás (a napi plafont a B7 hangolja).

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `boop_brief` | A reggeli összefoglaló, benne az ütközés, amiből ma a javaslat lesz |

## Mi jön még
- **B7 — élő újratervezés:** egy kitöltés, étkezés, befejezett edzés, Health-szinkron vagy naptárváltozás után a háttérrendszer
  újranézi a napot, és kártyát javasol (több/kevesebb étel, rövidebb/hosszabb edzés, más mozgás, időpont-áttolás),
  értesítéssel. A naptárbejegyzéseket AI pontozza (szellemi terhelés, társasági lemerülés, fizikai) — a címek csak a
  tulajdonos külön engedélyével mennek az AI-hoz. A költséget a havi AI-kerethez kell igazítani.
- **B8 — napra szabott kis tanács:** a „miért?” Alvás · Mozgás · Étkezés · Közérzet · Szkeptikus sorait egy kicsi,
  a mai napra figyelő szakterületi egyeztetés adja.

## Mi marad ki
Automatikus változtatás a terven, az étkezésen vagy a naptáron — soha. A naptár csak olvasható.
