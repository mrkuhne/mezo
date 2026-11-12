---
cim: A Terv-csomag (étrend + edzés + súlycél)
szint: Funkció
terulet: Terv
allapot: Tervezve
hol: [iPhone app, Háttérrendszer, AI]
szulo: 00-attekintes
szakasz: [B6]
osszefoglalo: Egy terv N hétre — súlycél, engedélyezett receptek és alapanyagok, csatolt edzésblokk és szabályok —, amit Boop mindenhol figyelembe vesz.
---

## Mit csinál
A B6-ban a Terv oldal szerkesztővé válik. Egy terv:

- **N hétre** szól, kezdő és záró dátummal;
- tartalmazza a **súlycélt**;
- megadja az **engedélyezett recepteket és alapanyagokat** („csak ezek a receptek 4 hétig”);
- **csatolja az edzésblokkot** (mezociklus vagy futóblokk);
- **szabályokat** tartalmaz.

Több terved lehet, egyszerre egy aktív. A Terv mutatja a **tervhűséget** (mennyire tartod), és a terv szabályai bekerülnek
**minden AI-háttérbe**: a beszélgetésbe, a reggeli összefoglalóba, az étkezés-értékelésbe és a javaslatokba.

## Hogyan működik (terv)
1. Ma ilyen „terv” egyáltalán nincs a rendszerben: az étrendi beállítás csak makróarány és fehérjeszint, a súlycélhoz pedig csak
   csatolni lehet egy mezociklust (kalória-hatás nélkül). Az AI a recepteket és a kamrát eszközként látja, de terv-szabályt nem.
2. A B6 új terv-entitást épít, a pontos formát a B6 indító ötletelése dönti el (a kutatás egyik kérdése: új egység legyen, vagy a
   súlycél bővítése).
3. A recept-alapanyag a receptműhelyből jön (az étrend „csak ezekből” része feltételezi, hogy elég recept van).
4. A tervek felállítása ekkor költözik át a webes appból.

## Miért így
A tulajdonos alapkérése, hogy az étrend, az edzés és a súlycél **egy** egység legyen, és az AI „személyi edző + dietetikus”
módon a terv szabályai szerint beszéljen (kutatás 02, 03, 10 — mindhárom „hiányzik”-nak jelölte).

## Beállítások
Nincs még.

## Adattáblák
Nincs még — új tábla(k) a B6-ban. A meglévők, amelyekre épül: `goal`, `goal_plan_link`, `recipe`, `pantry_item`, `mesocycle`,
`running_block`, `diet_settings`.

## Mi jön még
- B6: a terv-csomag, a szerkesztő, a tervhűség, a bevásárlólista (lásd [Bevásárlólista](07-bevasarlolista.md)) és a hatáskövetés
  (lásd [Hatáskövetés](08-hataskovetes.md)).
- B7: az élő javaslatok a terv szabályain belül maradnak.

## Mi marad ki
Életcélok (PERMAH-pillérek, jelkatalógus, „ha–akkor” szabályok) termékként; a „napi cél” a Napló/Ma része lesz.
