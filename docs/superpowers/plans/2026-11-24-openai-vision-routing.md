# OpenAI képes útvonal — megvalósítási terv

- **Cél:** minden képes elemzés az OpenAI `gpt-5.6-luna` modelljén fusson; a hangátírás maradjon Geminin.
- **Architektúra:** az `OpenAiCompanionLlm` már képes a képes hívást az aktív OpenAI modellhez küldeni, ha a `VISION` kivétel hiányzik a `per-call-kind` beállításból. A közös beállítás átváltja az étel, recept, kamracímke és alváskép útvonalat, API- vagy iPhone-változás nélkül.
- **Driving issue:** `mezo-h38eq`
- **Jóváhagyott terv:** [2026-11-24-openai-vision-routing-design.md](../specs/2026-11-24-openai-vision-routing-design.md)

## Korlátok

- A `TRANSCRIBE: gemini` sor, az embedding és minden szöveges modellút marad.
- Éles adatbázisba csak olvasunk. Az éles ellenőrzés nem hoz létre ételsort vagy más felhasználói adatot.
- A fotók tartalma nem kerül naplóba vagy dokumentációba.
- A változás egy konfigurációs sor eltávolítása; külön, azt megismétlő automata teszt helyett valódi képes hívások és a meglévő útvonaltesztek bizonyítják.

## 1. döntés és élő dokumentáció

- [x] Az ADR-ben rögzítjük a korábbi Gemini-kivétel feloldását, a hang/embedding kivételeket és a visszaállítás módját.
- [x] A Companion, Boop, Fuel és telepítési dokumentáció érintett mondatai a jelenlegi képes útvonalat írják le.
- [x] `node scripts/lint-docs.mjs` sikeres; commit: `docs(vision): record OpenAI image routing decision (mezo-h38eq)`.

## 2. konfiguráció és helyi bizonyítás

- [x] A `backend/src/main/resources/application.yml` fájlban a `mezo.companion.llm.per-call-kind.VISION` kivétel eltűnik; `TRANSCRIBE: gemini` marad. A kapcsoló szövege az új működést mondja ki.
- [x] Az OpenAI `gpt-5.6-luna` képességét a gyártói dokumentáció és személyes adat nélküli minta képes hívások igazolják.
- [x] Célzott backend kapuk: `OpenAiProviderWiringIT`, `LlmModelRoutingIT`, `MealAiDraftApiIT`, a recept-, kamra- és alváskép API tesztjei, valamint `CompanionPropertiesIT` és a teljes futás egyetlen, átmeneti hibájának külön `ProactiveApiIT` próbája. A teljes 9180 tesztes futás kétszer megtörtént: először a régi Gemini-elvárás bukott (javítva), másodszor egy független HTTP kapcsolatmegszakadás; ezért teljes zöld állítást nem teszünk.
- [x] A kód és dokumentáció együtt commitolva: `fix(vision): route image analysis to OpenAI (mezo-h38eq)`.

## 3. kiadás és éles ellenőrzés

- [ ] Tracker backup: `node scripts/check-beads-backup.mjs --fix`, commit.
- [ ] Friss `origin/main` után a feature ág `--no-ff` merge-e a leválasztott főági HEAD-re, majd `git push origin HEAD:main` és `bd dolt push`.
- [ ] A backend telepítése és egészsége ellenőrzött. A képes hívásnapló a következő személyes adat nélküli próbakérésnél OpenAI modellt mutat; az iPhone ételfotó elemzését élőben ellenőrizzük, ha a tulajdonos fotót készít.
- [ ] `bd close mezo-h38eq`, új tracker backup és push, a branch törlése, rövid átadás.
