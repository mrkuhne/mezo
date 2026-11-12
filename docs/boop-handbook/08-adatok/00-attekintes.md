---
cim: Apple Health és adatok
szint: Fő szekció
terulet: Apple Health és adatok
allapot: Élesben
hol: [iPhone app, Apple Health, Naptár, Háttérrendszer]
szulo:
szakasz: [S2, B1]
osszefoglalo: A Boop magától behúzza az Apple Egészség méréseit és az iPhone naptárát, így semmit nem kell kézzel beírnod ahhoz, hogy reggel tudja, milyen napod lesz.
---

## Mit csinál
Ez a Boop „csővezetéke”. Egyszer összekötöd az Apple Egészséggel és a naptárral, és onnantól a telefon
magától viszi fel az adatokat a háttérrendszerre: alvás, lépés, kalória, pulzus, HRV, testsúly, edzések,
naptáresemények és még sok más. Minden más rész (Ma, Alvás, Forma, Boop szavai) ebből dolgozik.

## Hogyan működik
1. **Összekötés:** engedélyt adsz az Egészség és a naptár olvasására; a telefon behúzza az elmúlt 60 napot.
2. **Frissítés:** minden megnyitáskor (és — a fizetős Apple-fiók után — a háttérben is) csak az újat küldi.
3. **Tárolás:** napi összesítők (lépés, kalória, nyugalmi pulzus…) egy napi sorba, az egyedi mérések (pulzus 5 perces blokkokban, HRV, testsúly, testzsír…) külön mintaként, a forrás nevével.
4. **Tisztaság:** amit az Egészségben törölsz, az a szerveren is törlődik; egy dátumra egy éjszaka; egy edzés nem számít duplán.
5. **Egy fiók:** minden az eredeti (webes) fiókodba kerül.

Az oldalak: *Összekötés és 60 napos visszatöltés* · *Széles adatkör* · *Frissítés nyitáskor és a háttérben* ·
*Források és eszközök* · *Törlések követése* · *Naptár* · *Edzések az Egészségből* · *Testsúly az Egészségből* ·
*Feelfit mérleg* · *Fiók-összevonás* · *Check-in pillanatkép*.

## Miért így
- Tulajdonosi döntések (2026-11-11): egy fiók, egy történet; fizetős Apple fejlesztői fiók a háttérben érkező adatokért.
- Az Apple Egészség már összegyűjti az óra, a mérleg és az appok adatait — nem kell mindegyikhez külön kapcsolat.
- Vegyes tárolás: az összeadható dolgokat (lépés) az Apple maga összesíti duplázás nélkül; a pontszerű méréseket forrással együtt tesszük el, hogy később pillanatképet és saját átlagot lehessen számolni.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.wearable.zone` | Melyik időzóna szerint vágjuk a napokat | Europe/Budapest |
| `mezo.wearable.max-days` | Legfeljebb ennyi napi összesítő egy küldésben | 120 |
| `mezo.wearable.max-samples` | Legfeljebb ennyi egyedi mérés egy küldésben | 1000 |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `daily_metric` | Napi összesítő: lépés, kalória, pulzus, távolság, HRV stb. — napi egy sor |
| `health_sample` | Egyedi mérések forrással: pulzusblokkok, HRV, véroxigén, testsúly, testzsír stb. |
| `sleep_log` | Éjszakák (lásd Alvás szekció) |
| `wearable_workout` | Az Egészségből jött edzések |
| `calendar_event` | A naptáresemények, 60 nap visszamenőleg |
| `weight_log` | Testsúlymérések (kézi és Egészségből) |

## Mi jön még
- **Fizetős Apple-fiók (kb. 2026-11-25):** a háttérben érkező adatok és a törlések ellenőrzése a telefonon.
- **B3 (Ellenőrzés):** pillanatkép a check-in mellé.
- **Test szakasz:** a Feelfit mérleg testzsír- és izomadatainak megjelenítése a Tervben.
- **B5:** Apple Watch edzés élő pulzussal.

## Mi marad ki — amit NEM olvasunk
- **Semmit nem írunk vissza** az Apple Egészségbe; a naptárba sem.
- Nem olvassuk: ciklus- és tünetkövetés, étkezési/makró adatok, vízfogyasztás, futás részletes mérései (sebesség, pulzuszónák, útvonal), BMI (magasságból számolható).
- A Feelfit mérleg csak az Apple Egészségen át jön: viscerális zsír, testvíz, csonttömeg, izomtömeg nem érhető el.
- Nincs közvetlen kapcsolat gyártói felhőkkel (Huawei, Oura, Feelfit) — minden az Apple Egészségen keresztül jön.
- Naptáresemények címét soha nem küldjük a mesterséges intelligenciának.
