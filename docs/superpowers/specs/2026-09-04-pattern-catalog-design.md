# Minták — állapotfüles katalógus és univerzális részletnézet

- **Dátum:** 2026-09-04
- **bd issue:** `mezo-szqy`
- **Státusz:** vizuális irány jóváhagyva, implementálható
- **Elfogadott prototípus:** a beszélgetésben jóváhagyott „A — állapotfüles katalógus”

## Miért változtatunk

A Minták oldal jelenleg dashboard, döntési inbox és teljes katalógus egyszerre. A hat
életciklus-cella csak számláló, miközben minden nem üres csoport teljes tartalma egymás alatt
megjelenik. A 29 „még gyűlik” elem önmagában hosszú oldalt okoz, a doménszűrő pedig a
motor-kártya végén elvész és emojikat használ.

A megerősített AI-hipotézisek azért nem nyithatók meg, mert nincs hozzájuk katalógusban
konfigurált statisztikai monitor-pár. A lista ezt korábban halott link elleni védelemként sima
`div`-ként renderelte, a részletoldal pedig kizárólag a pár-végpont 404-ét látta. Maga a mentett
`Pattern` viszont már rendelkezésre áll a meglévő listavégponton.

## Jóváhagyott irány

A 3×2 életciklus-rács megmarad a motor-kártyában, de számlálóból valódi állapotválasztóvá válik.
Egyszerre pontosan egy életciklus-csoport tartalma látszik. Az induló nézet a „Döntésre vár”, ha
van ilyen minta; különben az első nem üres csoport.

A production felület nem másolja be a standalone prototípus vizuális CSS-ét. Megtartja a
jelenlegi `MozaikPage`/`PageHead`/`PageBody`, Design 2.0 token, `ClayIcon`, `Icon`,
`PatternDecisionCard` és életciklus-csempe nyelvet. A prototípus az elrendezést és az
interakciót rögzíti.

## Katalógus-interakció

- A hat állapotcella natív `button`, látható kiválasztott állapottal és `aria-pressed` értékkel.
- A kiválasztott állapot címe, darabszáma és rövid magyarázata a lista felett látszik.
- A „Szűrés” gomb egy meglévő house `Sheet` komponenst nyit.
- A sheetben egyetlen témaszűrő választható: Mind, Alvás, Edzés, Táplálkozás, Mentális és társas,
  Test, Egyéb. A megjelenítés `ClayIcon`/`Icon`, nem emoji.
- A statisztikai pár témája a kimeneti (`metricBDomain`) domén. Monitor-pár nélküli hipotézis az
  „Egyéb” csoportba kerül; nem tűnik el a szűrésből.
- Rendezés: „Áttöréshez legközelebb” megtartja a motor életciklus-sorrendjét;
  „Téma szerint” domén, majd magyar cím szerint rendez.
- Oldalanként legfeljebb 5 elem jelenik meg. A lapozó csak több oldal esetén látszik, és szűrő-
  vagy állapotváltáskor visszaáll az első oldalra.
- A döntésre váró elemek megtartják a jelenlegi `PatternDecisionCard` felületet; a többi állapot
  megtartja a jelenlegi Design 2.0 csempéket. A változás a kiválasztás és lapozás, nem új
  kártyadesign.
- Az Adat-egészség külön, alapból csukott diagnosztikai blokk marad a katalógus alatt.

## Minden mentett minta részletnézete

A részlet route továbbra is `/mezo/patterns/:pairKey`.

- Ha a pár-végpont részletet ad, a jelenlegi statisztikai story flow változatlan marad.
- Ha a pár-végpont 404-et ad, de `usePatterns()` talál azonos `pairKey`-ű mentett mintát, a lap
  minta-alapú részletet renderel.
- A minta-alapú részlet a mentett cím, kategória, állapot, mechanizmus és evidence adatokból épül.
  Nem talál ki grafikont, napokat vagy statisztikai diagnosztikát.
- Megerősített állapotban egyértelműen közli, hogy a társ tudásként használja. Javasolt állapotban
  a meglévő három döntési művelet elérhető marad.
- Csak akkor jelenik meg „Nincs ilyen minta”, ha sem pár-részlet, sem mentett minta nincs.
- A detail-végpont valódi 500/network hibája továbbra is retry állapot; ezt nem fedjük el
  egyszerűsített mintaoldallal.

## Adat és backend

Nincs új endpoint, DTO, migráció vagy backend-módosítás. A meglévő
`GET /api/companion/pattern` már tartalmazza az univerzális részlethez szükséges mezőket. A
`GET /api/companion/pattern/pair/{pairKey}` továbbra is a konfigurált statisztikai párok gazdag,
nap- és eseményalapú részletét szolgálja.

## Ellenőrzés

- Tiszta logikai tesztek: induló állapot, domén-hozzárendelés, témaszűrés, téma szerinti rendezés,
  ötös lapozás.
- `PatternsPage` mindkét módban: állapotváltás, egyszerre egy csoport, ikonos filter sheet,
  lapozás, szűrő-reset, minden mentett mintán élő részletlink.
- `PatternDetailPage` mindkét módban: pár-backed flow változatlan; 404 + mentett AI-hipotézis
  minta-alapú részletet ad; valóban ismeretlen kulcs marad 404 állapot.
- Kapuk: `pnpm build`, `pnpm test`, `VITE_USE_MOCK=true pnpm test`, docs lint és CODEMAP check.

