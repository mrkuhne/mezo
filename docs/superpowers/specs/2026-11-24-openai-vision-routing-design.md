# Képes elemzések átállítása OpenAI-ra

- **Dátum:** 2026-11-24
- **Driving issue:** `mezo-h38eq`
- **Státusz:** approved by owner, 2026-11-24
- **Kapcsolódó:** [OpenAI migráció](2026-09-06-openai-migration-design.md), [Companion](../../features/companion.md), [Boop](../../features/boop-ios.md)

## Cél

A Boop minden képes AI-elemzése újra működjön a már finanszírozott OpenAI-fiókon. A 2026-11-24-i ételfotós kérések a Gemini Developer API `402 prepayment credits are depleted` válaszán álltak meg, még az ételvázlat létrehozása előtt. A 2026-09-06-i OpenAI-migráció a képeket egy későbbi összehasonlításig Geminin hagyta; a tulajdonos most az összes képes hívás OpenAI-ra váltását választotta.

## Hatókör és adatút

- A szerver `VISION` hívásai az aktív OpenAI adapterhez és annak olcsó `gpt-5.6-luna` modelljéhez kerülnek. Ez az ételfotót, receptfotót, kamracímkét és alvásképet együtt érinti, valamint minden más, ugyanilyen képes hívást.
- A `TRANSCRIBE` hanghívások és a Gemini embedding útvonalak Geminin maradnak. A szöveges hívások, az iPhone felület és a REST-szerződés nem változnak.
- A kép továbbra is csak a kérés idejére kerül a modellhez; a jelenlegi képtárolási és naplózási szabályok maradnak. A napló a szolgáltatót, modellt, képszámot és méretet rögzíti, a képbájtokat nem.
- Az OpenAI képfeldolgozás a jelenlegi Chat Completions útvonalon támogatott: [GPT-5.6 Luna modell](https://developers.openai.com/api/docs/models/gpt-5.6-luna), [képbemenet útmutató](https://developers.openai.com/api/docs/guides/images-vision?api-mode=chat).

## Hiba és költség

Sikertelen OpenAI-hívásnál a meglévő hibaút lép életbe; a hívás nem tér vissza automatikusan a kimerült Gemini-kerethez. A kép input tokenként számlázódik az OpenAI-nál; a már létező felhasználói költségkorlát és hívásnapló továbbra is érvényes. A korábbi Gemini-válaszok formájától eltérő eredményt a meglévő, szerveroldali vázlatellenőrzők kezelnek.

## Ellenőrzés és kiadás

1. A beállítás útvonalát célzott teszt védje: `VISION` OpenAI, `TRANSCRIBE` Gemini, a kért képes modell `gpt-5.6-luna`.
2. Valós OpenAI-kulccsal, személyes adat nélküli mintaképekkel az étel, recept, kamracímke és alváskép válaszformáját ellenőrizzük. A próba nem ment el valós felhasználói ételsort.
3. A helyi szerverkapuk után a főágat egy `--no-ff` merge és push juttatja az automatikus telepítésre. Az éles hívásnaplóban ellenőrizzük, hogy az új képes hívás OpenAI modellt használt.
4. Az iPhone-on az ételfotó elemzés és a mentés kipróbálható a jelenlegi appal; új apptelepítés nincs.
