# Hiányzó singleton = 200, nem 404 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `GET /api/medication` és `GET /api/biometrics/profile` ne 404-gyel válaszoljon arra, hogy a tulajdonos nem állította be az adott dolgot — mert az normális állapot, nem hiba.

**Architecture:** A szerződés (`api/openapi.yml`) a hiányt nullable mezőkkel fejezi ki; mindkét oldal ebből generál. A két backend olvasó `orElseThrow(404)` helyett üres payloadot ad. A frontend hookjai MINDKÉT alakot (a régi 404-et és az új üres payloadot) ugyanarra a meglévő üres állapotra képezik, mert a deploy során a két image nem feltétlenül vált egyszerre.

**Tech Stack:** Spring Boot + openapi-generator (`useResponseEntity: false`), React + TypeScript + TanStack Query, JUnit + Testcontainers, Vitest.

**Spec:** [`docs/superpowers/specs/2026-08-31-hianyzo-singleton-nem-404-design.md`](../specs/2026-08-31-hianyzo-singleton-nem-404-design.md)
**bd:** `mezo-5cmq`

## Global Constraints

- Munka-könyvtár: `/Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220`, ág `fix/absent-singleton-not-404`. Soha ne `cd`-zz a fő repóba — az a `main`-en ül.
- `api/openapi.yml` a szerződés EGYETLEN forrása: a backend (`openapi-generator`, `backend/pom.xml`) és a frontend (`pnpm generate:api` → `frontend/src/data/_client/api.gen.ts`) is ebből generál. A generált fájlokat kézzel SOHA ne szerkeszd.
- A backend integrációs suite-ot a **CI** futtatja (ez az autoritatív kapu). Lokálisan CSAK fókuszált teszteket futtass, és Testcontainers-szel: `./mvnw test -Dtest=<OsztályNév> -Dmezo.test.use-testcontainers=true` — a fix-DB mód versenyzik és hamis bukásokat ad.
- Frontend parancsok a `frontend/` alól, `pnpm`-mel. NINCS eslint; a kapuk: `pnpm exec tsc --noEmit -p tsconfig.json`, vitest (mindkét módban, explicit `VITE_USE_MOCK`-kal), `pnpm build`.
- Commit-üzenetek Conventional Commits + a bd id: `fix(api): ... (mezo-5cmq)`.
- A `requireOwned*` 404-ekhez (konkrét id-re szóló tulajdonjog-ellenőrzés) NEM nyúlunk.

---

## Task 1: Szerződés + backend

**Files:**
- Modify: `api/openapi.yml` (`MedicationDayResponse` ~12888. sor; `BiometricProfileResponse` ~11043. sor; a két GET művelet 404-es válaszleírása)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/medication/service/MedicationService.java` (`getDay`, ~54-63. sor)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/profile/service/BiometricProfileService.java` (`getProfile`, ~59-67. sor)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/medication/MedicationApiIT.java`, `backend/src/test/java/io/mrkuhne/mezo/feature/biometrics/profile/BiometricProfileContractIT.java`

**Interfaces:**
- Produces: `GET /api/medication` → 200, body `{ medication: null, cycle: null, recentDoses: [] }`, ha nincs aktív gyógyszer. `GET /api/biometrics/profile` → 200, body `{}`, ha nincs profil. A Task 2 frontendje ezt a két alakot normalizálja.

- [ ] **Step 1: Írd meg a bukó backend teszteket**

Mindkét IT-ben vedd fel a „nincs sor" esetet, és **írd át** azt a meglévő esetet, amelyik ma
404-et vár (a `BiometricProfileContractIT` tartalmaz ilyet — keresd meg `isNotFound`-ra).

A `MedicationApiIT`-be, a fájl saját stílusában (nézd meg a szomszédos teszteket a MockMvc/
RestAssured idiómáért, és azt kövesd):

- `getDay_returnsEmptyPayload_whenOwnerHasNoActiveMedication`: nincs `MedicationPopulator`-ral
  létrehozott sor → a hívás **200**, `medication` és `cycle` `null`, `recentDoses` üres tömb.
- A meglévő „van gyógyszer" eset marad, változatlan elvárással.

A `BiometricProfileContractIT`-be:

- `getProfile_returnsEmptyBody_whenOwnerHasNoProfile`: nincs `BiometricProfilePopulator`-ral
  létrehozott sor → **200**, és a `birthDate` hiányzik/`null`.
- A ma 404-et váró eset átírva erre — a teszt NEVÉT is igazítsd, hogy ne ígérjen 404-et.

- [ ] **Step 2: Futtasd, hogy lásd a bukást**

```bash
cd backend && ./mvnw test -Dtest=MedicationApiIT -Dmezo.test.use-testcontainers=true
```

```bash
cd backend && ./mvnw test -Dtest=BiometricProfileContractIT -Dmezo.test.use-testcontainers=true
```

Expected: az új esetek 404-et kapnak 200 helyett.

- [ ] **Step 3: Írd át a szerződést**

`api/openapi.yml`, `MedicationDayResponse`: a `required` listából vedd ki a `medication`-t és a
`cycle`-t (marad `recentDoses`), és tedd mindkettőt nullable-lé. Az `openapi-generator` a
`$ref` melletti `nullable`-t nem mindig veszi figyelembe — ha a generált Java/TS típus nem lesz
nullable, használd az `allOf`-os formát:

```yaml
        medication:
          nullable: true
          allOf:
            - $ref: '#/components/schemas/MedicationResponse'
```

`BiometricProfileResponse`: töröld a teljes `required` blokkot (`sex`, `heightCm`, `birthDate`) —
az üres profil payloadja `{}`.

Mindkét GET művelet leírásából töröld a `404`-es választ, és a leírásukban mondd ki, hogy a
hiány 200 + üres payload. A többi művelet `404`-e marad.

- [ ] **Step 4: Írd át a két olvasót**

`MedicationService.getDay` — az `orElseThrow` helyett:

```java
    public MedicationDayResponse getDay(UUID userId) {
        // A „nincs aktív gyógyszer" NORMÁLIS állapot, nem hiba (mezo-5cmq): a 404 minden
        // oldal-mountnál hibaágra vitte a klienst. A hiányt a payload fejezi ki.
        return repository.findFirstByCreatedByAndActiveTrueAndDeletedFalse(userId)
            .map(med -> {
                MedicationCycle cycle = cycleService.derive(userId, med, LocalDate.now(ZoneOffset.UTC));
                List<MedicationDoseEntity> recent = doseRepository
                    .findTop10ByCreatedByAndMedicationIdAndDeletedFalseOrderByAdministeredAtDesc(
                        userId, med.getId());
                return mapper.toDay(med, cycle, recent);
            })
            .orElseGet(MedicationService::emptyDay);
    }
```

Az `emptyDay()` privát statikus helper egy `MedicationDayResponse`-t ad `medication`/`cycle`
nélkül és üres `recentDoses`-szal. A generált DTO setter/builder idiómáját a szomszédos kódból
vedd át — ne találgasd.

`BiometricProfileService.getProfile` — ugyanez: meglévő sorra a mai válasz (a
`deriveTdeeBootstrap`-pel együtt), sor nélkül egy üres `BiometricProfileResponse`. A
`deriveTdeeBootstrap` CSAK meglévő sorra fusson.

Frissítsd mindkét metódus javadocját: ma szó szerint azt állítják, hogy 404-eznek.

- [ ] **Step 5: Futtasd a teszteket**

```bash
cd backend && ./mvnw test -Dtest=MedicationApiIT,MedicationServiceIT,BiometricProfileContractIT -Dmezo.test.use-testcontainers=true
```

Expected: PASS. Ha a `MedicationServiceIT` vagy más osztály 404-et várt a `getDay`-től, azt is
igazítsd — de csak azt, ami a MOST megváltozott viselkedésre vonatkozik.

- [ ] **Step 6: Commit**

```bash
git add api/openapi.yml backend && git commit -m "fix(api): a hiányzó gyógyszer/biometria 200-at ad, nem 404-et (mezo-5cmq)"
```

---

## Task 2: Frontend normalizálás

**Files:**
- Modify: `frontend/src/data/_client/api.gen.ts` (GENERÁLT — csak `pnpm generate:api`-val)
- Modify: `frontend/src/data/fuel/medicationHooks.ts` (`useMedication`, ~40-50. sor)
- Modify: `frontend/src/data/me/biometricHooks.ts` (`useBiometricProfile`, ~19-40. sor)
- Test: `frontend/src/data/fuel/medicationHooks.test.tsx` (ha nincs, hozd létre)

**Interfaces:**
- Consumes: a Task 1 új szerződése.
- Produces: nincs új export — `useMedication()` és `useBiometricProfile()` visszatérési szerződése VÁLTOZATLAN, csak a bemeneti alakok halmaza bővül.

- [ ] **Step 1: Regeneráld a klienstípusokat**

```bash
cd frontend && pnpm generate:api && git diff --stat src/data/_client/api.gen.ts
```

Expected: a `MedicationDayResponse.medication`/`cycle` és a `BiometricProfileResponse` mezői
opcionálissá/nullable-lé válnak. Ha a diff üres, a Task 1 szerződés-változása nem úgy sikerült,
ahogy kell — állj meg és jelezd.

- [ ] **Step 2: Írd meg a bukó teszteket**

`frontend/src/data/fuel/medicationHooks.test.tsx` — a `medicationApi.getDay`-t stubold, és
pinneld MINDKÉT bemeneti alakot ugyanarra a kimenetre:

- az ÚJ alak: a hívás `{ medication: null, cycle: null, recentDoses: [] }`-t ad vissza →
  `useMedication()` a meglévő üres állapotot adja (`medication.id === ''`, `cycle.cycleDay === 0`,
  `doses` üres);
- a RÉGI alak: a hívás 404-es `ApiError`-ral elutasít → ugyanaz az üres állapot, hiba nélkül.

A második eset a deploy-sorrend biztosítéka: amíg a régi backend fut az új frontend alatt, a
képernyőnek működnie kell. A renderHook-idiómát és a real-mód kényszerítését a szomszédos
`data/**/*.test.tsx` fájlokból vedd át.

- [ ] **Step 3: Futtasd, hogy lásd a bukást**

```bash
cd frontend && VITE_USE_MOCK=false pnpm vitest run src/data/fuel/medicationHooks.test.tsx
```

- [ ] **Step 4: Normalizálj a hookban**

`medicationHooks.ts` — a `realFetch` képezze le az új alakot az üres konstansra, és a
`realStaleTime: 0` törlődjön:

```ts
  const { data } = useDualQuery<MedicationDay>({
    queryKey: MEDICATION_KEY,
    mockData: medicationSeed,
    // A backend 200-at ad `medication: null`-lal, ha nincs aktív gyógyszer (mezo-5cmq); a
    // 404-es RÉGI alakot a useDualQuery `realEmpty`-je fogja el, amíg a két image nem vált
    // egyszerre. Mindkét út ugyanide fut ki.
    realFetch: async () => {
      const day = await medicationApi.getDay()
      return day?.medication ? day : MEDICATION_EMPTY
    },
    realEmpty: MEDICATION_EMPTY,
  })
```

`biometricHooks.ts` — a `queryFn` real ága a mai 404-kezelése mellett az üres payloadot is
`null`-ra képezze: ha a válasz `birthDate`-je hiányzik, `profile` legyen `null`. A hook
visszatérési típusa (`BiometricProfileResponse | null`) NEM változik.

- [ ] **Step 5: Futtasd a teszteket + típusellenőrzés**

```bash
cd frontend && VITE_USE_MOCK=false pnpm vitest run src/data && pnpm exec tsc --noEmit -p tsconfig.json
```

Expected: PASS. A `tsc` most jelezheti azokat a fogyasztókat, amelyek a `medication`/`cycle`
mezőt nem-nullable-nek hitték — mindegyiket a hook üres konstansa fedi, de ha egy KOMPONENS
közvetlenül a generált típust olvassa, ott is kell a null-tűrés.

- [ ] **Step 6: Teljes frontend kapuk**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build
```

- [ ] **Step 7: Commit**

```bash
git add frontend && git commit -m "fix(fe): a gyógyszer- és biometria-hook mindkét szerződés-alakot elviseli (mezo-5cmq)"
```

---

## Task 3: Doksik, CODEMAP, PR

**Files:**
- Modify: `docs/features/fuel.md`, `docs/features/me.md` (a két végpont viselkedése)
- Modify: `docs/CODEMAP.md` (generált)

- [ ] **Step 1: Frissítsd a doksikat**

```bash
grep -rn "404" docs/features/fuel.md docs/features/me.md docs/features/_platform-api-backend.md | grep -i "medication\|gyógyszer\|biometri\|profile"
```

Minden találatnál: a hiányzó gyógyszer / biometria-profil mostantól **200 + üres payload**, nem
404. Ahol a doksi a frontend „ghost" fallbackjét magyarázza, ott mondd ki, hogy az a régi
szerződés maradványa, és a deploy-átfedés miatt marad meg.

- [ ] **Step 2: CODEMAP + doc-lint**

```bash
node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs --errors-only
```

- [ ] **Step 3: Commit + push + PR**

```bash
git add -A && git commit -m "docs(api): a hiányzó singleton 200-at ad, nem 404-et (mezo-5cmq)"
```

```bash
git push -u origin fix/absent-singleton-not-404
```

```bash
gh pr create --fill --title "fix(api): hiányzó singleton erőforrás 200-at ad, nem 404-et (mezo-5cmq)"
```

- [ ] **Step 4: Várd meg a CI-t**

```bash
gh pr checks --watch
```

Ez a kör backendet érint, tehát a CI teljes integrációs suite-ja az autoritatív kapu — a lokális
fókuszált futtatások NEM helyettesítik.

---

## Ellenőrző lista

- [ ] `GET /api/medication` sor nélkül → 200, `medication: null`
- [ ] `GET /api/biometrics/profile` sor nélkül → 200, `{}`
- [ ] A frontend a régi 404-es alakot IS az üres állapotra képezi
- [ ] A `requireOwned*` 404-ek érintetlenek
- [ ] CI zöld

## Amit ez a terv NEM csinál

- Nem vezet be 204-et, nem nyúl a generátor konfigurációjához.
- Nem változtatja a `QueryProvider` `retry` politikáját.
- Nem merge-el és nem deployol — a PR zöldje után a humán partner dönt.
