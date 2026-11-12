# Boop kézikönyv — forrás a Notion-tükörhöz

Ez a mappa a **Boop kézikönyv** forrása: magyar, üzleti nyelvű leírás minden fő szekcióról, funkcióról és
kis funkcióról, a hozzájuk tartozó beállításokkal és adattáblákkal. A tulajdonos Notionjában lévő
„Boop” tér **egyirányú tükör**: a Notion ebből a mappából + a bd jegyekből frissül
(`scripts/boop-notion-sync.mjs` + `.claude/skills/boop-notion/SKILL.md`). **A Notionban nem szerkesztünk kézzel**
— ha valami változik, itt írjuk át, és szinkronizálunk.

Epic: `mezo-r36n9` · tükör jegy: `mezo-r36n9.29`.

## Mappák

| Mappa | Terület (Notion `Terület`) |
|---|---|
| `01-alapok/` | Alapok — fiók, telepítés, kinézet, navigáció, értesítések |
| `02-ma/` | Ma — a kezdőlap: reggel, napközben, este |
| `03-naplo/` | Napló — check-in, napi cél, napló, esti zárás története |
| `04-terv/` | Terv — célok, testsúly, Test kártya, étrend + edzésterv |
| `05-alvas/` | Alvás |
| `06-etel/` | Étel |
| `07-edzes/` | Edzés — edzés + Apple Watch |
| `08-adatok/` | Apple Health és adatok — szinkron, naptár, források |
| `09-boop/` | Boop — a beszélgetés |
| `10-ai/` | AI és memória — emlékezet, éjszakai konzílium, javaslatok „miért?” |

Minden mappában egy `00-attekintes.md` (szint: **Fő szekció**), alatta **Funkció** és **Kis funkció** oldalak.

## Egy oldal formátuma

```markdown
---
cim: Reggeli terv                # rövid, magyar, köznyelvi cím
szint: Funkció                   # Fő szekció | Funkció | Kis funkció
terulet: Ma                      # a fenti táblázat egyik Területe
allapot: Élesben                 # Élesben | Részben kész | Ellenőrzés | Tervezve | Kihagyva
hol: [iPhone app, Háttérrendszer]  # iPhone app | Háttérrendszer | Apple Health | Apple Watch | AI | Naptár
szulo: 00-attekintes             # a szülő oldal fájlneve kiterjesztés nélkül (Fő szekciónál üres)
szakasz: [S3, B2]                # mely szakasz(ok) hozták / hozzák: S1 S2 S2.5 S3 B0 B1 B2 B3 B4 B5 B6 B7 B8 Test
osszefoglalo: Egy mondat arról, mit kap a felhasználó.
---

## Mit csinál
Köznyelven, a felhasználó szemszögéből.

## Hogyan működik
Lépésenként, köznyelven: mi történik a telefonon, mi a háttérrendszerben, honnan jön az adat.

## Miért így
A döntés(ek) és az ok. Hivatkozz a Döntések naplóra, ha onnan jön.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.boop.brief.enabled` | Be/ki kapcsolja a reggeli összefoglalót | be |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `boop_brief` | Napi egy reggeli összefoglaló felhasználónként |

## Mi jön még
Tervezett bővítések (melyik szakasz hozza).

## Mi marad ki
Szándékosan kihagyott dolgok és miért.
```

## Szabályok

- **Magyar, köznyelvi** szöveg. A technikai neveket (beállítás-kulcs, tábla, képernyő) **csak** a
  *Beállítások* és *Adattáblák* táblázatban és `kód` formában írjuk, mindig magyar magyarázattal mellette.
- **Semmi személyes egészségadat** — se mért érték, se dátumhoz kötött eredmény. Példák kitalált, de valósághű
  számokkal, jelölve („például”).
- Csak azt írjuk **Élesben**-nek, ami a `main` ágon van és a telefonra telepíthető. Ami épül, az *Ellenőrzés*
  vagy *Tervezve*.
- Hiányzó szekció helyett írd: „Nincs.” — ne hagyd ki a címet.
