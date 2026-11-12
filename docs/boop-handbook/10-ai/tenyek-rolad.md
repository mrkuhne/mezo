---
cim: Tények rólad
szint: Funkció
terulet: AI és memória
allapot: Élesben
hol: [Háttérrendszer, AI]
szulo: 00-attekintes
szakasz: [B0]
osszefoglalo: Rövid, megerősített állítások rólad, amiket Boop minden beszélgetésben és szövegben figyelembe vesz.
---

## Mit csinál
Boop tényeket gyűjt rólad, például: „Hétköznap reggel 7 előtt edz.” vagy „A tejterméket nem szereti.” (például). Ezek
**minden** beszélgetésbe és a legtöbb AI-szövegbe bekerülnek, így nem kell újra elmondanod őket.

## Hogyan működik
1. **Jelöltek:** egy beszélgetés után egy olcsó AI-hívás legfeljebb három lehetséges tényt emel ki. Tények jöhetnek
   megerősített mintákból és a heti áttekintésből is.
2. **Megerősítés:** jelöltből csak megerősítés után lesz tény.
3. **Rendrakás:** hétfőnként 07:30-kor egy AI összefésüli az ismétlődő tényeket. Ez 2026-11-11 előtt minden alkalommal
   hibára futott (üres kérdést küldött); a B0 megjavította.
4. Egy tény elnémítható vagy elfelejthető.

## Miért így
A kutatás szerint a chat „emlékezete” valójában főleg ezekből a tényekből állt — olcsó és megbízható módja annak, hogy
Boop ismerjen.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.companion.facts.prompt-cap` | Legfeljebb ennyi tény megy be egy szövegbe | 200 |
| `mezo.companion.fact-merge.cron` | A heti rendrakás ideje | hétfő 07:30 |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `learned_fact` | Tényjelöltek, megerősítésre várva |
| `knowledge_fact` | A megerősített tények (érvényesség, felülírás, elnémítás) |
| `fact_merge_ledger` | A heti összefésülés nyoma |
| `person_fact` | Tények a megemlített emberekről |

## Mi jön még
Tények kezelése Boopban (megnézés, javítás) — nincs még szakaszhoz rendelve.

## Mi marad ki
Boopban ma nincs tény-lista felület; a webes appban kezelhetők.
