---
cim: Széles adatkör az Egészségből
szint: Funkció
terulet: Apple Health és adatok
allapot: Élesben
hol: [iPhone app, Apple Health, Háttérrendszer]
szulo: 00-attekintes
szakasz: [S2, B1]
osszefoglalo: A Boop 23 féle Apple Egészség-adatot olvas — az alvástól a HRV-n át a testzsírig —, napi összesítőként és egyedi mérésként.
---

## Mit csinál
Az első változat csak 6 dolgot olvasott (alvás, lépés, aktív kalória, pulzus, nyugalmi pulzus, edzések).
A B1 óta 23 félét, hogy a Boop pontosabban lássa a pihenésedet és a terhelésedet:

- **Napi összesítők:** lépés, megtett táv, aktív és alap (nyugalmi) kalória, edzésperc, napfényen töltött idő, nyugalmi / átlag / legkisebb / legnagyobb pulzus, séta közbeni átlagpulzus, HRV, légzésszám, véroxigén, csuklóhőmérséklet alvás közben, VO2max, tudatos jelenlét percei.
- **Egyedi mérések:** pulzus (5 perces blokkokban), HRV, légzésszám, véroxigén, csuklóhő, VO2max, pulzus-visszatérés edzés után, séta-pulzus, testsúly, testzsír %, sovány testtömeg, tudatos jelenlét alkalmak, hangulat (State of Mind), légzési zavarok alvás közben.
- **Alvás és edzések:** lásd a saját oldalukat.

Hogy ezek közül mi érkezik ténylegesen, az attól függ, mi ír az Egészségbe (például a jelenlegi óra nem ír HRV-t).

## Hogyan működik
1. A telefon az összeadható adatokat (lépés, kalória, táv) az Apple saját statisztikájával számolja — az Apple a forrás-sorrended szerint szűri a duplázást (pl. telefon + óra lépései nem adódnak össze).
2. Napi egy sort küld a háttérrendszernek ezekkel; egy nap újraküldése az egész sort felülírja.
3. A pontszerű méréseket egyenként küldi, forrással (app neve, eszköz, kézzel beírt-e).
4. A pulzust 5 perces blokkokba sűríti (átlag, minimum, maximum egy sorban), mert egy edzés óránként akár 700 mérést írhat.

## Miért így
- B1 döntés: vegyes tárolás. Napi sor ott, ahol elég az összeg; egyedi minta ott, ahol a pillanat és a forrás számít (check-in pillanatkép, saját alapvonal, törlés).
- 5 perces pulzusblokk: napi legfeljebb ~290 sor, és még pont elég egy pillanatképhez.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.wearable.max-days` | Napi összesítők egy küldésben | 120 |
| `mezo.wearable.max-samples` | Egyedi mérések egy küldésben | 1000 |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `daily_metric` | Napi egy sor: lépés, táv, aktív/alap kalória, edzésperc, pulzusok, HRV, légzés, véroxigén, csuklóhő, VO2max, séta-pulzus, tudatos percek, napfény percek |
| `health_sample` | Egyedi mérés: típus (`metric`), kezdet–vég, érték, mértékegység, forrás app, eszköz, kézzel beírt-e; azonosító az Apple-féle egyedi kulcs |

## Mi jön még
- B3: a check-in pillanatkép ezekből a mérésekből dolgozik.
- B7–B8: HRV és saját alapvonalak a napi kapacitásban és az AI-ban.

## Mi marad ki
- Ha az Egészségben törölsz egy pulzusmérést, az 5 perces blokk nem változik (ismert korlát).
- Mindegyik adat csak olvasás; semmit nem írunk vissza.
