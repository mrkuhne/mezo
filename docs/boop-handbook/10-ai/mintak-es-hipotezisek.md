---
cim: Minták és hipotézisek
szint: Funkció
terulet: AI és memória
allapot: Élesben
hol: [Háttérrendszer, AI]
szulo: 00-attekintes
szakasz: [S3, B8]
osszefoglalo: Éjjel a háttérrendszer összefüggéseket keres az adataidban és AI-val hipotéziseket fogalmaz — ebből lesznek a „Boop észrevette” kártyák.
---

## Mit csinál
A **Ma › Boop észrevette** kártyák (jobbra húzás „Igaz”, balra „Nem rólam szól”) tartalmát ez a gépezet adja. Például:
„Amikor 23 után fekszel, másnap alacsonyabb az energiád.” (például).

## Hogyan működik
1. **Statisztikai minták (éjjel, AI nélkül):** a háttérrendszer kb. 60 mért sor (alvás, edzés, evés, víz, kitöltések…)
   párjai között keres összefüggést, időeltolással is, minimális mintaszám- és egyensúly-feltételekkel.
2. **AI-hipotézisek (éjjel, okos modell):** egy AI javasol, egy második lépés kritizálja, egy harmadik javít — csak a
   kritikán átment hipotézis lesz minta.
3. **Életút:** egy minta „javasolt” → „figyelt” → „megerősített” vagy „elvetett”; a további napok adatai erősítik vagy
   gyengítik.
4. **A te döntésed:** a Boopban adott „Igaz” vagy „Nem rólam szól” visszamegy; a megerősített minta tényként is
   bekerülhet (lásd Tények rólad).

## Miért így
A kód számol (statisztika), az AI hipotézist fogalmaz, de **igaznak csak az számít, amit te megerősítesz**.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.llm-log.budget.throttled-features` | A hipotézis-gyártás a 90%-os költségszint felett szünetel | benne van |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `pattern` | A minták és állapotuk |
| `pattern_event` | A minták életútja, köztük a döntésed |
| `text_signal` | A naplószövegekből AI-val kiolvasott hangulat, energia, feszültség |

## Mi jön még
**B8:** rövid/közép/hosszú távú következtetések a Napló › Minták részen; **B6:** hatáskövetés (egy új étel vagy recept előtt
és után hogyan alakulnak az óra-adatok) — ma ilyen nincs.

## Mi marad ki
A minták részletes statisztikai nézete Boopban.
