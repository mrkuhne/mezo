# Hiányzó singleton erőforrás: 200 + üres payload, nem 404 — design

- **bd:** `mezo-5cmq`
- **Dátum:** 2026-08-31
- **Érintett felület:** `api/openapi.yml` szerződés + backend `medication` / `biometrics.profile` olvasók + a hozzájuk tartozó frontend hookok

## Probléma

`GET /api/medication` és `GET /api/biometrics/profile` **404-et ad, ha a tulajdonos nem állította
be** az adott dolgot. A backend kódja ezt ki is mondja (`MedicationService.getDay`: *„404 when the
owner has no active medication"*), és a frontend oldali komment ugyanerről: *„a tulajdonos nem
követ gyógyszert, tehát ez a NORMÁLIS állapot"*. Vagyis egy normális állapotot HTTP-hibaként
modellez a rendszer.

Következmények, élesben mérve:

- `useTodayScenario` (`data/today/todayHooks.ts`) meghívja `useMedication`-t, és `useTodayScenario`-t
  hívja az app-váz (`AppLayout`) **és** több oldal is → minden oldal-mount új observert nyit.
- `useMedication` `realStaleTime: 0`-val fut → minden új observer újrakérdez.
- A `QueryProvider` `retry: 1`-gyel fut → **kérésenként két** hálózati kör.

Ezért a felhasználó konzolja végigfut 404-ekkel, ahogy az appban navigál. Funkcionálisan nem
törik el semmi (a `useDualQuery` `realEmpty`-re esik vissza), de:

- felesleges hálózati forgalom minden oldalváltásnál;
- a `useDualQuery` `isError`-je **igazat mond egy hamis kérdésre**: egy képernyő, amely az
  additív `isError` ágra terminális hibaállapotot rajzol, „elromlott"-at mutatna arra, hogy
  „nincs beállítva";
- a frontend nem tudja megkülönböztetni a „nincs beállítva"-t az „elromlott a végpont"-tól —
  ma mindkettő ugyanaz az üres állapot.

## Célállapot

Mindkét olvasó **200-at** ad. A hiányt a payload fejezi ki, nem a státuszkód.

## Döntések

| # | Kérdés | Döntés |
|---|---|---|
| D1 | Hatókör | Mindkét végpont (`medication`, `biometrics/profile`) |
| D2 | A hiány alakja | Nullable mezők a meglévő response-okban — NEM 204 |
| D3 | A `requireOwned*` 404-ek | Változatlanok |
| D4 | Deploy-sorrend | A frontend MINDKÉT alakot elviseli |

**D2 indoklása.** A 204 lenne a szemantikailag legszebb, és a frontend kliense kezelné is
(`data/_client/api.ts`: `if (res.status === 204) return undefined`). A backend viszont
`useResponseEntity: false`-szal generál (`backend/pom.xml`), tehát a kontrollerek csupasz DTO-t
adnak vissza — 204-hez a generátor konfigurációjával kellene szembemenni. A nullable mezős alak
illeszkedik a kódbázishoz, és a body mindig érvényes JSON marad.

**D3 indoklása.** A `MedicationService` többi 404-e (`logDose`, `removeDose`) konkrét id-re
vonatkozó tulajdonjog-ellenőrzés: ott a 404 helyes és marad.

**D4 indoklása.** A deploy két image-et tol ki, és az ArgoCD nem feltétlenül vált egyszerre. Egy
olyan frontend, amely csak a 404-re van felkészítve, de `medication: null`-t kap, a `med.id`
olvasásán elszállna — pontosan az a hibaosztály, amit tegnap éjjel javítottunk. Ezért a hookok
mindkét alakot ugyanarra az üres állapotra képezik.

## Szerződés (`api/openapi.yml`)

**`MedicationDayResponse`** — a `medication` és a `cycle` kikerül a `required` listából és
nullable lesz; a `recentDoses` marad kötelező (hiány esetén üres tömb):

```yaml
    MedicationDayResponse:
      type: object
      required:
        - recentDoses
      properties:
        medication:
          $ref: '#/components/schemas/MedicationResponse'
          nullable: true
        cycle:
          $ref: '#/components/schemas/MedicationCycleResponse'
          nullable: true
        recentDoses: ...
```

**`BiometricProfileResponse`** — a `sex` / `heightCm` / `birthDate` kikerül a `required` listából.
A „nincs beállítva" állapot payloadja `{}`: ez nem hazugság, hanem egy üres profil.

A `GET` műveletek `404`-es válaszleírása törlődik mindkét útvonalról (a `requireOwned*`
végpontokéi maradnak).

## Backend

`MedicationService.getDay`: az `orElseThrow(404)` helyett üres nap-payload, ha nincs aktív sor —
`medication: null`, `cycle: null`, `recentDoses: []`. A ciklus-derivációt csak akkor futtatja, ha
van sor.

`BiometricProfileService.getProfile`: az `orElseThrow(404)` helyett üres `BiometricProfileResponse`,
ha nincs sor. A `deriveTdeeBootstrap` csak meglévő sorra fut.

Más szolgáltatás nem változik.

## Frontend

`data/fuel/medicationHooks.ts` — a `realFetch` normalizál: ha a válasz `medication`-je hiányzik
(új alak) **vagy** a hívás 404-gyel bukik (régi alak), a hook a meglévő `MEDICATION_EMPTY`
konstansra képez. A `realStaleTime: 0` törlődik, hogy a lekérdezés a `QueryProvider` normál
30 s-os `staleTime`-jával fusson — enélkül a felesleges kör megmarad, csak 404 nélkül.

A biometria-hook ugyanígy: hiányzó `birthDate` → `profile: null`, ami a mai szerződése.

## Tesztek

- **Backend IT**, mindkét végpontra: sor nélkül **200** + üres payload; meglévő sorral a mai
  válasz változatlan. A 404-et váró meglévő esetek átírva — ez a viselkedés-változás lényege.
- **Frontend**: a `medicationHooks` normalizálása pinnelve mindkét bemeneti alakra (új `null`-os
  payload ÉS a régi 404-es elutasítás) → ugyanaz az üres állapot.
- A szerződés-változás után `pnpm generate:api` (frontend) és a backend generálás a build része;
  a CI drift-kapuja ellenőrzi.

## Amit ez a spec NEM tartalmaz

- Nem nyúl a `requireOwned*` 404-ekhez, sem más szolgáltatás hibakezeléséhez.
- Nem vezet be 204-et, és nem nyúl a generátor konfigurációjához.
- Nem ír ADR-t a mintáról (a felhasználó kihagyta ebből a körből).
- Nem változtatja a `QueryProvider` globális `retry` politikáját.
