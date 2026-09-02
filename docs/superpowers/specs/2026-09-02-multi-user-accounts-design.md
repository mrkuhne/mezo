# Multi-user accounts — beta-ready fiókok, meghívó kód, közös katalógusok

- **Dátum:** 2026-09-02
- **Driving issue:** `mezo-qw37` (epic) — szeletek `mezo-qw37.1` … `mezo-qw37.6`
- **Státusz:** design approved in brainstorm, awaiting plan
- **Kapcsolódó:** `docs/features/_platform-auth-security.md`, `docs/superpowers/specs/2026-06-10-phase2-backend-design.md` (Slice A auth), `mezo-5h9`, `mezo-2fc1`, `mezo-ah18.2`

## 1. Cél

A mezo ma egy single-owner PWA: egyetlen fiók, a frontend build-be égetett credentiallal lép be némán. A cél egy **zárt, meghívó-kódos beta**, amiben 5–20 ismerős saját fiókkal használja az appot, minden adata a sajátja, és két katalógus közös: a **gyakorlatok** (definíciók, nem a rekordok) és a **kamra-ételek** (definíciók, nem a készlet/ár/adag).

Nem cél: nyílt regisztráció, email-infra, OAuth, per-user időzóna, LLM-kvóta, mezo-sablonok megosztása userek között.

## 2. Döntések (a brainstorm eredménye)

| Kód | Döntés | Elutasítva |
|---|---|---|
| **A / A1** | Meghívó kód, email + jelszó, a kódot a tulajdonos kézzel adja át. Jelszó-reset = admin ideiglenes jelszót ad. | Magic link (SMTP + PWA link-kattintás gond), nyílt regisztráció, OAuth |
| **Q3a** | Minimál admin UI az appban (`role=OWNER`): meghívók, userek, reset, letiltás. | Csak psql/CLI |
| **M1** | A meglévő HS256 JWT + `CurrentUserId` varrat marad; token localStorage-ban; letiltás per-request státusz-ellenőrzéssel hat. | Session cookie + `csrf.spa()` (SecurityConfig/CORS/SSE/MSW/IT teljes átírás), Keycloak/Authentik |
| **K1** | Közösségi kamra-katalógus: `pantry_catalog` globális (seed + bárki által felvett, szerző jelölve), `pantry_item` per-user állapot. | K2 privát kiegészítések, K3 másolás regisztrációkor |
| **E1** | Közösségi gyakorlat-katalógus: user-felvett gyakorlat mindenkinek látszik; média/szerkesztés szerző vagy OWNER. | E2 privát egyéni gyakorlatok |
| **O2-lite** | Onboarding varázsló: név, születési dátum, nem, súly, magasság. Edzésnapok nem. | O1 üres app, teljes varázsló mezóval |
| **T1** | HU-only beta: `app_user.timezone` oszlop felvéve (`Europe/Budapest`), a kód még nem használja. | Per-user időzóna most (47+ `LocalDate.now()` hely) |
| **L1** | Cron fan-out csak `ACTIVE` + onboardolt userekre, és job-onként "van friss adat" guard az LLM-hívás előtt. Per-user LLM-költség bontás az admin oldalon. | Havi kvóta (L2), semmi (L3) |

## 3. Kiindulási állapot (a recon fő lelete)

Az adatréteg **már multi-user alakú**: mind a ~95 entitás `created_by uuid NOT NULL`-t hordoz (FK `app_user` cascade), minden unique constraint `created_by`-jal kezdődik, a kontrollerek a JWT `sub`-ból oldják fel a usert, és mind a 23 `@Scheduled` job `appUserRepository.findAll()`-on iterál. **Sehova nem kell `user_id` oszlopot felvenni.** A hiányok öt csoportja:

1. **Belépés és fiók-életciklus** — nincs login/regisztráció UI, token csak memóriában, nincs logout/`me`, `app_user`-en nincs role/status/timezone, JWT 30 nap revocation nélkül, `mezo-5h9` (default secret fail-fast) nyitva.
2. **Seedek a tulajdonos emailjére kötve** a prod (`demodata`) profilban: `OwnerSeedData`, `PantryCatalogLoader`, `ProtocolSeedData`, `GamificationDemoData`, `PeopleSeedData`, `GoalReevaluateRunner`.
3. **Katalógusok** — `exercise_catalog` hibrid (`created_by NULL` = master), de `list()` mindenkiét adja és a média bárki sorára írható; `pantry_item` 100% per-user, definíció és állapot egy táblában, négy `on delete restrict` FK mutat rá.
4. **Cross-user szivárgás** — `/api/llm-usage/*` szándékosan szűretlen (minden user hívása és payloadja), `llm_log_history.created_by` nullable; push-endpoint két fiókhoz is köthető.
5. **"Daniel" bedrótozva** ~20 prompt-fájlban + `DANIEL VÁLASZA —` wire-marker + FE statikus profil-seed; időzóna szerver-globális.

Eszköz-oldal: hét localStorage kulcs nem user-névterezett; a service worker API-választ nem cache-el, PWA-szinten nincs szivárgás.

## 4. Felbontás

Ernyő-spec + hat szelet, mindegyik saját bd issue + `feat/<topic>` branch + self-PR + CI-gate. **A beta-kiadás mind a hat szeletet igényli** (S4 nélkül üres a kamra, S6 nélkül mindenkit Danielnek hív a Mezo).

| Szelet | bd | Függ | Tartalom |
|---|---|---|---|
| S1 Fiók-alap | `mezo-qw37.1` | — | séma, invite, register/me/change-password, token persistence, Login/Register page, 401-kezelés, `mezo-5h9` |
| S2 Onboarding + seed-szétválasztás | `mezo-qw37.2` | S1 | varázsló, személyes seedek `demofixtures`-be, `useProfile` valós |
| S3 Beta admin + LLM-usage | `mezo-qw37.3` | S1 | admin API+UI, LLM-usage owner-gate, per-user bontás, `LlmActorContext` |
| S4 Kamra-katalógus | `mezo-qw37.4` | S1 | `pantry_catalog` + migráció + kereső + AI-illesztés + `recipe.md` |
| S5 Gyakorlat-katalógus | `mezo-qw37.5` | S1 | jogosultság, badge, slug-verseny (`mezo-2fc1`) |
| S6 Persona + cron-higiénia | `mezo-qw37.6` | S3 | `app_user.name` a promptokban, wire-marker, `UserFanOut`, localStorage névterezés, push átkötés, ADR 0034, doc-átírások |

S4–S6 párhuzamosíthatók S1 után; S6 az `LlmActorContext` miatt S3 után.

## 5. S1 — Fiók-adatmodell és auth API

### Séma (egy Liquibase changeset `mezo-qw37.1`)

- `app_user` +
  - `role varchar(16) NOT NULL DEFAULT 'USER'`, `ck_app_user_role (OWNER|USER)`
  - `status varchar(16) NOT NULL DEFAULT 'ACTIVE'`, `ck_app_user_status (ACTIVE|DISABLED)`
  - `timezone varchar(64) NOT NULL DEFAULT 'Europe/Budapest'` (T1: séma kész, kód nem használja)
  - `onboarded_at timestamptz NULL`
  - `must_change_password boolean NOT NULL DEFAULT false`
  - `last_seen_at timestamptz NULL`
  - Backfill: a meglévő owner sor `role='OWNER'`, `onboarded_at=now()`.
- Új `invite`: `id uuid PK`, `code varchar(32)` `uq_invite_code` (12 karakteres olvasható, `MEZO-XXXX-XXXX`, betű/szám, `0/O/1/I` nélkül), `label varchar(120)`, `created_by → app_user`, `created_at`, `expires_at timestamptz NULL`, `used_by → app_user NULL`, `used_at timestamptz NULL`. Egyszer használható.
- `user_profiles` **törlés** (handle/member_since/streak_days — senki nem olvassa; a `name` az `app_user`-en marad). `OwnerSeedData` és `ResetDatabase` ennek megfelelően egyszerűsödik.

### Contract (`api/feature/auth/auth.yml`, tag `Auth`)

| Op | Path | Auth | Kérés → válasz | Hibák |
|---|---|---|---|---|
| `register` | `POST /api/auth/register` | public (`security: []`) | `{inviteCode, email, password(minLength 8), name}` → `TokenResponse` | `AUTH_INVITE_INVALID` 409 (nincs/lejárt/használt), `AUTH_EMAIL_TAKEN` 409 |
| `login` | `POST /api/auth/login` | public | változatlan | + `AUTH_ACCOUNT_DISABLED` 403 |
| `me` | `GET /api/auth/me` | bearer | → `MeResponse{id, email, name, role, onboarded, mustChangePassword, timezone}` | |
| `changePassword` | `POST /api/auth/change-password` | bearer | `{currentPassword, newPassword}` → 204; `must_change_password=false` | `AUTH_LOGIN_INVALID_CREDENTIALS` 401 |
| `completeOnboarding` | `POST /api/auth/onboarding-complete` | bearer | → 204, `onboarded_at=now()` | |

Regisztráció egy tranzakcióban: `SELECT invite … FOR UPDATE` → validál → `app_user` insert (BCrypt) → invite `used_by/used_at` → JWT. Nincs szerveroldali logout; a letiltás a per-request státusz-ellenőrzésen keresztül hat.

### Backend biztonság

- `SecurityConfig` permitAll: `/api/auth/login`, `/api/auth/register`, `/actuator/health`.
- Új `feature/auth/service/CurrentUser` komponens (a `feature/auth`-ban, nem a `techcore`-ban, mert entitást tölt — auth-tól mindenki függhet, ArchUnit): a `sub`-ból request-scoped cache-elve betölti az `AppUserEntity`-t; `DISABLED` → 403 `AUTH_ACCOUNT_DISABLED`; `requireOwner()` → 403 `AUTH_FORBIDDEN`. `last_seen_at` frissítés legfeljebb 5 percenként. `CurrentUserId` marad a meglévő hívóknak (belül `CurrentUser`-re épül, így a státusz-ellenőrzés minden védett requestre kiterjed).
- `mezo-5h9`: prod profilban default `jwt-secret` vagy owner-jelszó → startup fail-fast.
- `OwnerSeedData` marad, `role='OWNER'`-rel ír.
- Új `SystemMessage` kódok a `messages.properties`-ben: `AUTH_INVITE_INVALID`, `AUTH_EMAIL_TAKEN`, `AUTH_ACCOUNT_DISABLED`, `AUTH_FORBIDDEN`.

### Frontend (S1 rész)

- `frontend/src/data/_client/api.ts`: `token` localStorage-ba (`mezo.auth.token`), boot-kor betöltés. `bootstrapOwnerToken()`, `VITE_OWNER_EMAIL/PASSWORD` (`.env.example`, `Dockerfile`, `deploy.yml`) **törlés**.
- `apiFetch`/`apiSse`: 401 → token törlés + `signedOut`; 403 `AUTH_ACCOUNT_DISABLED` → ugyanez "Fiók letiltva" üzenettel. Egy `authEvents` emitter (module-level), amire a `QueryProvider` feliratkozik.
- `QueryProvider` boot-állapotgép: `pending` → (token? `GET /api/auth/me`) → `signedOut` | `onboarding` | `mustChangePassword` | `ready` | `failed` (a meglévő retry/degraded képernyő marad). Mock módban azonnal `ready`, `me` = statikus mock user.
- Új FE domain `features/auth/`: `LoginPage`, `RegisterPage` — a router-ben az `AppLayout`-on kívül (nincs tab bar/header). Hibák inline a `SystemMessage` kódokból.
- Logout (Beállítások → Fiók): token törlés, `queryClient.clear()`, `signedOut`.
- MSW: `register`, `me`, `change-password`, `onboarding-complete` handlerek.

### Tesztek

- `ApiIntegrationTest.registerUser(label)` helper: owner-tokennel invite → register → Bearer. Ez lesz az ownership-isolation ITk B-user forrása (a `UserPopulator` `password_hash="x"` útja megmarad a nem-HTTP teszteknek).
- `AuthControllerIT`: invite életciklus (jó/lejárt/használt/ismeretlen), email-ütközés, disabled login 403, disabled token védett végponton 403, `me` alak, change-password.
- `ResetDatabase`: `invite` a TRUNCATE-listába; `user_profiles` sor eltávolítása.
- FE: boot-állapotgép egységteszt; Login/Register mindkét módban; vizuális golden.

## 6. S2 — Onboarding és seed-szétválasztás

- `OnboardingPage` (`features/auth/`), `onboarded=false` esetén kényszerített a `ready` előtt. Három lépés: 1) név megerősítés + születési dátum + nem (M/F), 2) magasság (cm) + jelenlegi súly (kg), 3) összefoglaló → `PUT /api/biometric-profile` (meglévő; `sex`, `height_cm`, `birth_date` NOT NULL, ezért egyben megy) + `POST /api/weight` (meglévő, mai dátum) + `POST /api/auth/onboarding-complete`. Nincs új domain-tábla. A NumberStep mezők a contract min/max határaira clampelnek.
- `useProfile()` (`data/me/meHooks.ts`): real módban `GET /api/auth/me`, mock módban a statikus `today.ts` `user`. `EnHubPage` hero ebből.
- `BeallitasokPage` új "Fiók" csoport: név, email, jelszócsere (`ChangePasswordSheet`), kijelentkezés.
- Seedek: `ProtocolSeedData`, `PeopleSeedData`, `GamificationDemoData`, `GoalReevaluateRunner` → `@Profile("demofixtures")` (a tulajdonos fiókjára, opt-in). `OwnerSeedData` marad `demodata`. Gamification-profil és habit-katalógus lusta létrehozása az első érintéskor marad (`HabitCatalogService.ensureCatalog` minta); a `GamificationProfileService`-nél ellenőrizni, hogy a "nincs profil" út is ezt teszi.
- Tesztek: onboarding-complete IT; FE varázsló-teszt mindkét módban; `demofixtures` nélkül induló backend ITk zöldek (a meglévő ITk, amik a protokoll-seedre építenek, `demofixtures`-t kapnak vagy populatorral hozzák létre az adatot).

## 7. S3 — Beta admin és LLM-usage

### Contract (`api/feature/admin/admin.yml`, tag `Admin`, `AdminController`, `merge.yml` bejegyzés)

| Op | Path | Válasz |
|---|---|---|
| `createInvite` | `POST /api/admin/invites` `{label?, expiresInDays?}` | `InviteResponse{id, code, label, createdAt, expiresAt, usedBy?, usedByName?, usedAt?}` |
| `listInvites` | `GET /api/admin/invites` | `InviteResponse[]` (nyitott + felhasznált) |
| `deleteInvite` | `DELETE /api/admin/invites/{id}` | 204; felhasználtra 409 `ADMIN_INVITE_USED` |
| `listUsers` | `GET /api/admin/users` | `AdminUserResponse{id, email, name, role, status, createdAt, onboardedAt, lastSeenAt}[]` |
| `resetPassword` | `POST /api/admin/users/{id}/reset-password` | `{temporaryPassword}` (12 karakter, egyszer látszik), `must_change_password=true` |
| `setStatus` | `POST /api/admin/users/{id}/status` `{status}` | 204; saját magára 409 `ADMIN_SELF_STATUS` |

Mind `CurrentUser.requireOwner()` mögött.

### LLM-usage

- `/api/llm-usage/*` minden végpontja `requireOwner()` mögé.
- Rollup-válaszok `byUser: [{userId, name, calls, tokens, costHuf}]` bontással; `/calls/{id}` owner-only marad.
- `llm_log_history.created_by` nullable **marad**; új `techcore` `LlmActorContext.runAs(userId, Runnable)` ThreadLocal, amit a cron fan-out a per-user iteráció köré tesz, és a `LlmActorResolver` a principal hiányában innen olvas.

### FE

- `features/me/pages/BetaAdminPage.tsx`, Beállítások-sor csak `role=OWNER`-nél. Két fül: **Meghívók** (generálás névvel, lista, másolás, törlés), **Felhasználók** (státusz, utolsó aktivitás, jelszó-reset → ideiglenes jelszó sheetben, letiltás toggle).
- LLM-napló oldal: per-user szűrő chipsor.
- Mock mód: statikus admin-seed (2–3 fiktív user, 2 kód).

### Tesztek

`AdminControllerIT` (USER → 403 mindenhol; invite-lifecycle; reset → régi jelszó 401, ideiglenes 200 + `mustChangePassword=true`; self-status 409), `LlmUsageControllerIT` 403 USER-rel, `LlmActorContext` cron-IT (job-hívás `created_by`-ja a user).

## 8. S4 — Kamra-katalógus szétválasztás (K1)

### Séma

- Új `pantry_catalog`: `id`, `created_by uuid NULL` (NULL = loader-master; kitöltve = user-felvett, mindenkinek látszik), `kind`, `name`, `brand`, `source`, `category`, `serving_amount/unit`, `kcal`, `protein_g`, `carbs_g`, `fat_g`, `fiber_g`, `sugar_g`, `salt_g`, `saturated_fat_g`, `package_label`, `micros jsonb`, `nova`, `form`, `caffeine`, `is_deleted`, `created_at`, `updated_at`. A `kind`/`source`/`nova` CHECK-ek átköltöznek. `uq_pantry_catalog_natural (lower(name), lower(coalesce(brand,'')))`.
- `pantry_item` **megtartja az id-jét** (a `meal_item`, `recipe_ingredient`, `protocol_item`, `supplement_intake` `on delete restrict` FK-i és a `pantry_import` `set null` FK-ja érintetlen). Marad: `created_by`, `is_deleted`, `created_at`, `updated_at`, `notes`, `price_huf`, `price_unit`, `stock_qty/unit/expires`, `dose`, `protocol`, `timing`, `taken`. Új: `catalog_id → pantry_catalog NOT NULL` (`on delete restrict`). `uq_pantry_item_user_catalog (created_by, catalog_id) where not is_deleted`.
- Migráció (egy changeset, `-- lint-liquibase: allow-insert`): élő `pantry_item` sorokból `pantry_catalog` sor a sor `created_by`-jával, natural-key szerint dedupolva (legkorábbi `created_at` nyer); `catalog_id` visszaírás; definíciós oszlopok eldobása a `pantry_item`-ről. Soft-deleted `pantry_item` sorok is kapnak `catalog_id`-t (a NOT NULL miatt), de a katalógusban nem hoznak létre új sort, ha van natural-key találat; ha nincs, `is_deleted=true` katalógus-sort kapnak.
- `PantryCatalogLoader`: profil-független (`@Order(50)`, mint `ExerciseCatalogLoader`), natural-key szerint upsert `created_by NULL`-lal a `seed/pantry-catalog.json` 146 elemére; **nem** hoz létre `pantry_item`-et.

### Viselkedés

- `GET /api/pantry`: a user saját `pantry_item` sorai a katalógus-mezőkkel joinolva. A `PantryItem` válasz-DTO alakja **változatlan** + `catalogId`, `sharedFrom?: {authorName}` (null, ha saját vagy master), `catalogEditable: boolean`.
- Új `GET /api/pantry/catalog?q=&kind=` → `PantryCatalogEntry[]` (globális keresés, `is_deleted=false`, név/márka ILIKE, max 50).
- Új `POST /api/pantry/items/from-catalog {catalogId}` → `PantryItem` (idempotens: ha már van élő sora, azt adja vissza).
- `createPantryItem`: `catalogId` nélkül katalógus-sort is létrehoz (natural-key ütközésnél a meglévőre köt, nem 409).
- `updatePantryItem`: per-user mezők mindig; definíciós mezők csak szerző vagy OWNER, különben 403 `PANTRY_CATALOG_NOT_EDITABLE`. Törlés csak a `pantry_item`-et soft-deleteli.
- Import/scrape/photo-extract: katalógus-sor (user-szerzős) + kamra-sor.
- `MealAiDraftService` névillesztés és `RecipeWorkshopService` a **katalógusra** illeszt; naplózáskor/recept-mentéskor a hiányzó `pantry_item` automatikusan létrejön a usernek (`from-catalog` szolgáltatás-szinten).
- `CharacterSignalReads` és a többi olvasó (`MealService`, `RecipeService`, `ProtocolService`) a `pantry_item`-en keresztül továbbra is per-user marad.

### FE

- `KamraPage`: katalógus-kereső ("Hozzáadás a közösből"), lista-elemen "közös" badge, ha `sharedFrom` nem null; szerkesztő sheetben a definíciós mezők read-only, ha `catalogEditable=false`.
- `usePantry` mock-seed változatlan alakú (+ új mezők default értékkel). `useDualQuery` szabály tartva.

### Docs

`docs/features/pantry.md` frissül; a hiányzó `docs/features/recipe.md` **megíródik** (érintett feature, AGENTS-szabály). `docs/CODEMAP.md` regenerálás.

### Tesztek

Migrációs IT (két user átfedő ételekkel → egy katalógus-sor, két kamra-sor, `meal_item` FK-k épek); kereső-IT; jogosultsági IT a definíciós szerkesztésre; `from-catalog` idempotencia; `ResetDatabase` a `pantry_catalog` master-sorait (`created_by IS NULL`) megtartja, user-szerzős sorokat törli (mint `exercise_catalog`).

## 9. S5 — Gyakorlat-katalógus (E1)

- `ExerciseCatalogService.list()` marad "mindenki mindent lát"; a válasz + `authoredByMe: boolean`, `authorName?: string`. FE: "közös" badge idegen sorokon.
- Jogosultsági mátrix (a tervezéskor pontosítva): master sor **tartalma** senkinek nem szerkeszthető, OWNER-nek sem (409 `CATALOG_MASTER_READONLY` marad — a loader minden indításkor felülírná, és egy soft-deletelt master sor a loader slug-upsertjét törné); master sor **médiája** csak OWNER; user-sor tartalma és médiája szerző vagy OWNER; idegen USER → 403 `EXERCISE_CATALOG_NOT_EDITABLE` (a katalógus publikus, a 404 hazudna). A válasz `editable` (tartalom) és `mediaEditable` flageket hordoz. Törlés soft-delete (`is_deleted` + `@SQLDelete` már létezik `mezo-52zg` óta, nincs új changeset).
- Slug-verseny: `uniqueSlug` check-then-insert helyett `DataIntegrityViolationException`-re suffix-újrapróba (max 3). `mezo-2fc1` bezárul.
- Tesztek: jogosultsági IT (USER master-médiára 403, saját sorra 200, idegen user-sorra 403, OWNER mindenre 200), párhuzamos slug-IT.

## 10. S6 — Persona és cron-higiénia

### Persona

- `PersonaContext{userName}` rekord a `feature/auth`-ban (mindenki függhet auth-tól, auth senkitől — ArchUnit); `ChatService.assembleSystemPrompt`, a proactive generátorok (`CompanionMessageGenerator`, `WeeklyReviewGenerator`, `MemoirGenerator`, `PredictionGenerator`, `ExperimentProposalGenerator`, `ChallengeGenerator`, `WeeklySuggestionGenerator`, `PeriodSummaryService`, `MesoReviewGenerator`, `QuarterlyReviewService`, `DiagnosisRecipe`), a character körök (`CharacterExpertCatalog`, `PortraitWriter`, `KonziliumVerdictRound`, `KonziliumProposalRound`, `ProfileAssembler`, `TurnVerdictCheck`), `FactExtractionService`, `RecipeWorkshopService` a literális "Daniel" helyett a nevet kapják. Első körben ragozás nélküli megszólítás; egyetlen `PromptPersona` helper.
- Wire-marker: `DANIEL VÁLASZA —` → `FELHASZNÁLÓ VÁLASZA —` BE-oldalon; FE `TranscriptTurn` mindkét prefixet parse-olja (tárolt konferencia-szövegek kompatibilitása).
- FE statikus `user` seed (`today.ts`) csak mock módban.

### Cron-higiénia (L1)

- `feature/auth/service/UserFanOut.activeUsers()` → `status='ACTIVE' AND onboarded_at IS NOT NULL`; mind a 23 job ezt hívja `findAll()` helyett, `LlmActorContext.runAs(user)` körrel.
- Job-onként "van-e friss adat az ablakban" guard az LLM-hívás előtt, ahol ma hiányzik (olcsó `existsByCreatedByAndDateAfter`-jellegű ellenőrzés).
- `SchedulingConfiguration` pool marad 1.

### Eszköz-higiénia

- localStorage kulcsok user-névterezése: `mezo.msgseen.*`, `mezo.needsnudge.*`, `mezo-night-wake:*`, `mezo-sleep-escal-snooze`, `mezo-morning-training-snooze`, sessionStorage `mezo-tab:*` → `mezo.<userId>.…`; `mezo-theme` eszköz-szintű marad.
- Push: `POST /api/notification/subscribe` ugyanazt az `endpoint`-ot más user alól átköti (egy böngésző = egy fiók).

### Docs

- `_platform-auth-security.md` teljes átírás (single-owner → multi-user); `liquibase_conventions.md` §"Every domain table is owner-scoped" pontosítás (katalógus-táblák kivétel); `integration_test_framework.md` "no role matrix" → OWNER/USER mátrix; `AGENTS.md` §Auth/ownership; `me.md` §9/§10 döntés-visszavonás; `security_conventions.md` (`mezo-ah18.2`) ide olvad; új ADR **0034** "Multi-user account model" (felbontás + döntés-tábla). `docs/CODEMAP.md` regenerálás minden szeletben.

## 11. Hibakezelés és határesetek

- Lejárt token offline PWA-ban: az app a cache-elt shellt mutatja, az első request 401 → login; a be nem küldött adat (nincs perzisztált draft) elveszik — elfogadott beta-korlát.
- Letiltott user: a következő request 403 → kijelentkeztetés "Fiók letiltva" üzenettel; a cron kihagyja.
- Meghívó versenyhelyzet: `FOR UPDATE` lock, a második regisztráció `AUTH_INVITE_INVALID`.
- Kamra natural-key ütközés két user párhuzamos felvitelénél: unique index + ütközéskor a meglévőre kötés.
- Owner önletiltás/önreset: 409.
- JWT-secret rotáció mindenkit kijelentkeztet (login-képernyő, nincs adatvesztés).

## 12. Tesztelési stratégia

- Backend: minden szelet fókuszált ITk `-Dmezo.test.use-testcontainers=true`-val + `ArchitectureTest`; a CI (`ci.yml`) a teljes suite. Ownership-isolation: minden új végpontra B-user 404/403 teszt a `registerUser` helperrel.
- Frontend: `pnpm test` és `VITE_USE_MOCK=false pnpm test` (unset = mock!), vizuális goldenek az új oldalakra, `dualMode.guard` marad.
- Kézi: `verify` skill recept + egy második fiók végigvitele (kód → regisztráció → onboarding → naplózás → admin-lista → letiltás → 403).

## 13. Prior art

Kutató-jelentés (5 forrás), szűrve:

- **Adoptálva — shared schema + `user_id` + app-rétegű szűrés** (PlanetScale, [approaches-to-tenancy-in-postgres](https://planetscale.com/blog/approaches-to-tenancy-in-postgres)): a kis app ajánlott alapja; a mezo már ezt csinálja (`created_by` + `OwnedRepository`/`OwnershipGuard`). A csapda ("elfelejtett WHERE") ellen: repository-szignatúra konvenció + cross-user IT minden új végpontra.
- **Adoptálva — katalógus + per-user history Hevy-mintára** ([Hevy OpenAPI mirror](https://raw.githubusercontent.com/chrisdoc/hevy-mcp/main/openapi-spec.json)): a sablon global és ownerless, a user-felvett `is_custom`/szerzős, minden teljesítmény-adat a per-user set-sorokon. A mezo `exercise_catalog` + `exercise_set` már így áll; a `pantry_catalog` ugyanezt kapja.
- **Adoptálva — add/backfill/constrain migráció** (Citus, [transitioning](https://docs.citusdata.com/en/v7.2/migration/transitioning.html)): egy tranzakció, nullable → backfill → NOT NULL → constraint. A `pantry_catalog` migráció ezt követi.
- **Elutasítva — Hibernate `@TenantId`** (Callista, [part 8](https://callistaenterprise.se/blogg/teknik/2023/05/22/multi-tenancy-with-spring-boot-part8/)): nem fedi a `findById`/native query utakat bizonyíthatóan, és a globális katalógus-táblákra nem alkalmazható; a meglévő explicit szűrés egyszerűbb.
- **Elutasítva — Postgres RLS** (Callista, [part 6](https://callistaenterprise.se/blogg/teknik/2020/10/24/multi-tenancy-with-spring-boot-part6/)): két DB-role, datasource-proxy, `SET` per tranzakció, csendes üres eredmény hibamód. <20 usernél aránytalan; backstopként később újranézhető.
- **Elutasítva — session cookie + one-time-token magic link** (Spring Security ref, [onetimetoken](https://docs.spring.io/spring-security/reference/servlet/authentication/onetimetoken.html), [csrf](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html)): biztonságilag szebb, de SMTP-infra + a teljes auth-stack (SecurityConfig, CORS, `apiSse`, MSW, ~250 IT) átírása nulla beta-értékért. Keycloak/Authentik ugyanezért.

## 14. Codebase terrain

Investigator-jelentés, szűrve. A 95 entitás teljes inventárja megerősítette: minden domain-tábla `created_by NOT NULL`-os és minden unique constraint `created_by`-jal kezdődik; a három globális unique (`app_user.email`, `exercise_catalog.slug`, `memory_embedding (kind, ref_id)`) multi-user alatt is helyes. A lényeg:

- **Identity spine:** `techcore/security/SecurityConfig.java:37-49` (permitAll lista), `CurrentUserId.java:13-21` (egyetlen principal-varrat), `techcore/persistence/{OwnedEntity,OwnedRepository,OwnershipGuard}.java`, `feature/auth/service/AuthService.java:29-49`, `feature/auth/OwnerSeedData.java` (`demodata` = prod!), `feature/auth/entity/AppUserEntity.java` (id, email, password_hash, name, created_at), `api/feature/auth/auth.yml` (egy op), `application.yml:56-66`, `messages.properties:2-7`.
- **FE boot:** `data/_client/api.ts:19-20` (module-level token), `data/_client/auth.ts:7-16` (`bootstrapOwnerToken`), `app/providers/QueryProvider.tsx:9-100` (boot-gate + retry), `app/router.tsx:125-227` (egy root, nincs auth route), `app/AppLayout.tsx:24,43-66` (`useScheduleSnapshotWriter` mount-kor PUT-ol — auth után, per user), `data/_client/mode.ts:7` (unset = mock), `data/me/meHooks.ts:16` + `data/today/today.ts:17-22` (statikus user), `test/msw/handlers.ts:177`, `vite.config.ts:13-45` (SW nem cache-el API-t), `.env.example`, `Dockerfile:4-5`, `deploy.yml:86-89`.
- **Seed/cron:** `PantryCatalogLoader.java:26-75`, `ProtocolSeedData.java:57`, `GamificationDemoData.java:70`, `PeopleSeedData.java:46`, `GoalReevaluateRunner.java:57` (owner-email kötés); 23 job `findAll()`-lal (`DailySummaryJob.java:56`, `WeeklyReviewJob.java:39`, `NotificationDispatchJob.java:89`, `QuestJob.java:41,62`, `HabitJob.java:32`, `Character*Job`); `SchedulingConfiguration.java:13` pool 1; `HabitCatalogService.java:47-85` a lusta-bootstrap precedens.
- **Katalógusok:** `202606121400_mezo-7ot_exercise_catalog.sql` + `202607082000_mezo-52zg_catalog_write.sql` (hibrid, globális slug), `ExerciseCatalogService.java:32-35,71-73,118-125`, `ExerciseCatalogLoader.java:29,76`, `ExerciseRecordService.java:48-55` (rekordok olvasáskor derivált); `202606221200_mezo-9xu_create_pantry_item.sql` (+ `zza`, `bka`, `8vum`, `d8tr`), `PantryItemEntity.java`, `PantryItemRepository.java:12-14`, FK-fogyasztók `MealService.java:214,410,422`, `RecipeService.java:95,238`, `RecipeWorkshopService.java:80,111`, `ProtocolService.java:209,275,306`, `MealAiDraftService.java:97`, `CharacterSignalReads.java:397`, `flags.ts` `SHOW_PANTRY_STOCK`.
- **Szivárgás:** `LlmLogRepository.java:25,56`, `LlmUsageController.java:20`, `LlmUsageService.java:132`, `LlmActorResolver.java:22-33`; push `uq (created_by, endpoint)`.
- **Persona:** `ChatService.java:66-146`, `CompanionMessageGenerator.java:71,74,94`, `KonziliumProposalRound.java:368` (wire-marker), `frontend/src/features/character/components/TranscriptTurn.tsx:8-33`, + a §10-ben felsorolt generátorok.
- **Tesztinfra:** `support/ApiIntegrationTest.java:40,51-55` (`ownerAuthHeaders`), `support/ResetDatabase.java:38-59` (TRUNCATE 91 tábla + owner-megőrzés + master-sor kivétel), `support/populator/UserPopulator.java:20-38`, `ArchitectureTest.java`.
- **Csapdák:** ArchUnit (auth-ra mindenki függhet, auth senkire; `@RestController` generált `*Api`-t implementál; nincs class-level `@Transactional`); CI `gen-codemap --check` + OpenAPI-drift + `lint-liquibase` (INSERT tilos, escape hatch-csel); `VITE_USE_MOCK` unset = mock; `demodata` = prod; pantry FK-k `restrict`; ADR-számütközés — következő szabad **0034**.
- **Staleness a docsban:** `_platform-auth-security.md` §2/§9 (`mezo-aus` már zárt, retry él), §4 (`NotificationDispatchJob` él), §7 (multi-user lista alulbecsült); `liquibase_conventions.md:158`, `integration_test_framework.md:124`, `AGENTS.md:159`, `me.md` §9/§10.
