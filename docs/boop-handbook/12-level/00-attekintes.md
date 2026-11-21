---
cim: Levél
szint: Fő szekció
terulet: Levél
allapot: Ellenőrzés
hol: [iPhone app, Háttérrendszer, AI]
szulo:
szakasz: [Életpanel]
osszefoglalo: A Levél a reggeli postád: Boop naponta kétszer átnézi a leveleidet, a zajt egyetlen összehajtott sorba teszi, és csak azt mutatja, ami megér egy percet — határidőt, csomagot, jó ajánlatot.
---

## Mit csinál
A Levél terület arra van, hogy **ne maradj le a fontos dolgokról**: a számláról, a lefoglalt programról, az
elveszni készülő akcióról, a csomagodról. Két postafiókod van (Gmail és iCloud), és ezekben elvész, ami számít.
Boop naponta kétszer — reggel 8-kor és délután 3-kor — átnézi őket, és a Levél oldalon egy percben átfuthatod az
eredményt.

Két lépésben épül:

- **1. lépés — a reggeli posta** (megépült, ellenőrzés és élesítés vár rá): a levelek átvétele, a négy csoport, a
  pontozás, a tanulás a koppintásaidból, a Fiókok és Szabályok oldal, és a csengetés a Ma oldalon — lásd:
  *A reggeli posta* és *Fiókok és szabályok*.
- **2. lépés — figyelt termékek és árellenőrzés** (tervezve): a *Figyelt* fül, amelyik utánanéz az árnak.

## Hogyan működik
A leveleidet nem a saját postafiókodból olvassa Boop. Egy **külön, csak Boopnak létrehozott Gmail-fiókba**
továbbítod őket (a Gmailedből is, az iCloudodból is), és Boop csak azt az egy fiókot nézi — kizárólag olvasásra:
semmit nem küld, nem töröl, nem mozgat. A bank, a biztosító, a hivatal és az egészségügyi szolgáltatók leveleit
**soha nem olvassa gép**: csak azt látod, hogy ki írt.

## Miért így
A tulajdonos döntése (2026-11-21): hétköznapi Gmail, egy tükörfiók mindkét postafiókhoz, és ő maga állítja be.
Így Boop nem kapja meg a valódi jelszavadat, a kapcsolat egy kattintással megszüntethető, és az Apple jelszóváltása
sem töri el. Az ára: csak az a levél látszik, amelyik a továbbítás beállítása után érkezett.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.mail.enabled` | A levélrész egésze — ki van kapcsolva, amíg nincs élesítve | ki |
| `mezo.techcore.cron.mail-job.enabled` | A naponta kétszeri automatikus átnézés | ki |
| `MEZO_MAIL_SECRET_KEY` | A tárolt alkalmazásjelszó zárolásának kulcsa (titok, nincs a kódban) | — |

## Adattáblák
Lásd: *A reggeli posta*.

## Mi jön még
A *Figyelt* fül és az árellenőrzés (napi 10 ellenőrzés, a döntésed szerint). Később Boop beszélgetésében is
szóba jöhet, ami a leveleidből kiderül.

## Mi marad ki
Levelet küldeni, válaszolni, archiválni vagy törölni — soha. Csatolmányokat letölteni — soha. A továbbítás előtti
régi leveleket olvasni — nem lehet. Harmadik postafiók — nincs.
