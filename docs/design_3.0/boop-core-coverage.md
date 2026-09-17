# Boop funkcionális próba

2026-09-09 · `mezo-88jw.10` · [Megnyitás](http://127.0.0.1:5193/?v=boop#presence/home/today)

A dokumentált alapfunkciók a Boop közös munkaterébe kerültek. A korábbi gazdag tanulmány folyamatkomponensei ugyanazt a mentett állapotot, saját ikonokat, Boop karaktert és history-navigációt használják. Ez a felület kipróbálható mockja; nem a production alkalmazás teljes backendjének vagy minden üzleti szabályának másolata.

## Hol mit próbálj ki?

| Terület | Belépés | Végigjárható folyamatok | Forrás |
| --- | --- | --- | --- |
| Edzés | Mozgás → Terem | Heti napválasztó, edzés indítása, kg/ismétlés/RIR, sorozatok és gyakorlat hozzáadása, pihenő, félretétel/folytatás, lezárás, mentett részletes napló; gyakorlatkatalógus, technikai képek, medálok | [Train](../features/train.md), [részletes lefedés](train-coverage.md) |
| Mezociklus | Terem → Mezociklusok | Építő, szerkeszthető vázlat, aktiválás, blokk/hét/nap/izomnézet; sablon mentése, újrafuttatás; lezárás saját értékeléssel és rögzített riporttal; lezárt blokkok összevetése | [Train](../features/train.md) |
| Sport és futás | Mozgás → Sport / Futás | Sportnaptár, rögzítés, előzmény/részlet; futástervépítés, előnézet, terv/alkalom/napló, regeneráció | [Train](../features/train.md) |
| Étel és score | Táplálás → Napló | Szöveges és fotópélda, kamrából/receptből összeállítás, gramm/adag javítása, mentés/részlet/szerkesztés/törlés; AI score négy lenyitható nézőponttal, újraértékelés állapotpéldával, forrás és chat | [Fuel](../features/fuel.md), [részletes lefedés](fuel-coverage.md) |
| Kamra és receptek | Táplálás → Kamra / Receptek | Alapanyag/érték/készlet szerkesztése, receptek készítése/javítása, főzés, bevásárlólista, napi keret és makrócél | [Fuel](../features/fuel.md) |
| Súly | Életem → Testem | Rögzítés, azonos nap javítása, előzmény szerkesztése/törlése, 7/30 napos trend, testsúlycél | [Me](../features/me.md) |
| Alvás | Életem → Testem | Ébredés napja, lefekvés/ébredés, minőség, tényezők és megjegyzés; mentés, előzmények, szerkesztés/törlés, alváscél | [Me](../features/me.md), [részletes lefedés](personal-coverage.md) |
| Életcélok | Életem → Célok | Létrehozás, életterület és személyes indok, legfeljebb öt szerkeszthető pillér, kézi haladás és visszavonás, aktív/pihenő/elért/archivált állapot | [Életcélok](../features/lifegoal.md) |
| Emberek | Életem → Ma → Emberek | Keresés/szűrés, új személy, adatlap és javítás, kapcsolódás naplózása, események, archiválás; külön rutin- és értesítési nézetek | [Me](../features/me.md), [részletes lefedés](personal-coverage.md) |
| Minták | A közös kép → Minták | Státuszszűrés, bizonyíték/forrás, megerősítés vagy elutasítás, kapcsolódó kísérlet, átjárás a tudástárba; előrejelzések részletei | [Insights](../features/insights.md), [részletes lefedés](mezo-coverage.md) |
| Tudástár | A közös kép → Tudástár | Kategóriák, tény részlete/pontosítása, használhatóság kapcsoló, jelölt elfogadása, saját tény felvétele, eredeti forrás; profil/dimenzió/állítás nézetek | [Insights](../features/insights.md) |

Az asztali oldalsáv **Minden funkció · oldaltérkép** gombja a 103 regisztrált nézetet sorolja fel. A rekordhoz tartozó részleteket elsősorban a listájukból nyisd meg; a térkép azonosító nélküli rekordoldalai üres vagy alapértelmezett nézetet mutathatnak.

## Közös állapot és a mock határa

A helyi `mezo-presence-v1` mentés `full` ága tartja a területi adatokat. A korábbi check-in, napló, hála és chat megmarad migrációkor. A naplózott ételek a napi keretbe számítanak; a sport elmaradásának meglévő tool-példája a részletes étkezési célt is következetesen frissíti. A súlymérések a Testem áttekintését és trendjét, a lezárt edzések az edzésnaplót és napi lenyomatot frissítik. Az étel törlése nem törli a kamrai alapanyagot.

Az LLM, a fotófelismerés, a score, az előrejelzés és a mintafelismerés szimuláció. A score pontjai szemléltetők. A célpillérek haladása kézzel állítható; a production többforrásos célmotorja és 7/28 napos bizonyítékszámítása nem fut. A gyakorlatdemók képi technikai példák, nem streamelt videószolgáltatás. A mezociklusriport helyi pillanatkép; a demóban rögzített edzéseket összesíti. Az edzéshez hozzáadott gyakorlat nem írja át észrevétlenül a mezociklust. A mock nem végez háttértanulást.

## Megvalósítás és ellenőrzés

`CompleteFlow.jsx` köti a négy korábbi flow-t a Boop shellbe, kezeli a terület/fül hozzárendelést és a közös API-t. `complete-model.mjs` kezeli a migrációt, az edzés és mezociklus életciklusát, a célokat és naplótörlést. `CoreExtras.jsx` adja a hiányzó munkafelületeket; `MealScore.jsx` a score demonstrációját. A `complete.css` a meglévő flow-k stílusát az editorial irányhoz illeszti.

Ellenőrzés: 65/65 automatizált teszt, Vite build és `node verify-routes.mjs` (103 nézet, 11 227 minta-/hiányzóazonosítós render). Böngészőben végigpróbálva: ételbevitel és mentett részlet/score; sorozat rögzítése, félretétel, 40 kg megtartásával folytatás és 400 kg összvolumenű napló; súlymentés frissülő trenddel; új életcél/pillér mentése; minta megerősítése és megjelenése a Tudástárban. Ez nem jelenti minden űrlapkombináció kézi végigtesztelését.
