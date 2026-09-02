# Mezo-kalauz S1 — motor + fejléc „?" + seen-store (Fuel hub kalauzzal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Az első belépéskor automatikusan felugró, a fejléc „?" gombjából újranyitható oldal-kalauz teljes motorja — backend seen-store-ral, localStorage-tükörrel, lapozó sheettel és spotlighttal — egyetlen valós kalauzzal (a Fuel hub) end-to-end bizonyítva.

**Architecture:** Egy `TutorialProvider` ül az `AppLayout`-ban (a `MezoThreadProvider` mintája): route-váltásra a registry-ből keres kalauzt, a per-user `tutorial_progress` (backend, FuelSettings-singleton recept) + localStorage-tükör alapján dönt az auto-felugrásról, és a domain-mentes `KalauzSheet`-et rendereli a meglévő `Sheet` primitívre építve. A fejléc „?" gombja ugyanezt a contextet hívja. Spec: [`docs/superpowers/specs/2026-09-02-mezo-kalauz-tutorial-design.md`](../specs/2026-09-02-mezo-kalauz-tutorial-design.md); prototípus: `docs/design_2.0/prototypes/kalauz.html`.

**Tech Stack:** React 19 + Vite + TanStack Query + react-router (frontend, `@/` alias), Vitest + RTL + MSW (két mód: `VITE_USE_MOCK=true|false`), Playwright visual goldenek; Spring Boot + Liquibase + Hibernate 6 (jsonb) + openapi-generator, JUnit IT-k Testcontainers-móddal; beads (`bd`).

## Global Constraints

- Driving bd issue: az epic `mezo-gb1s`; az S1 saját al-issue-ját a Task 0 hozza létre (`mezo-gb1s.1`). Commit-subject: `feat(...): ... (mezo-gb1s.1)`.
- Branch: a worktree meglévő `claude/in-app-tutorial-system-0f3d62` branche (a prototípus és a spec már rajta van). Soha ne `cd` a fő repóba.
- HU UI-címkék verbatim; companion-hang többes szám első személyben; tiltott szavak a kalauz-szövegben: *kell, muszáj, hiba, elbukik, rossz*; nincs piros; kártya ≤ 2 mondat.
- Nincs inline hex a `prototype.css`-ben: minden szín token (`--mz-*`, `--dv-amber`, `--gradient-cta`, `--surface-card`, `--primary-deep`, `--mz-ink-soft`, `--text-primary`, `--canvas`); ha új `--mz-*` token kell, MINDKÉT `:root` blokkba.
- Érintési cél ≥ 44 px (a `.nap-roundbtn` 40 px — a meglévő fejléc-konvenció, azt követjük), body-szöveg a sheetben ≥ 16 px.
- `.rise` csak `EntranceGroup` (`.mz-play`) alatt animál; minden végtelen animáció `prefers-reduced-motion`-guarded.
- `useDualQuery`: a shell-ben mountoló olvasásnak `realStaleTime: DEFAULT_QUERY_STALE_TIME_MS`.
- Frontend rétegezés: `shared/ui/**` NEM importál `@/data/*`-ból; a `data/hooks.ts` az egyetlen barrel; deep `@/` importok; tesztek colocated.
- Backend: ArchUnit — `controller/service/entity/repository` alcsomagok, controller a generált `<Tag>Api`-t implementálja, nincs field-injection, nincs `@Value`, nincs nyers `RuntimeException`. Új tábla → `ResetDatabase` TRUNCATE-lista. Liquibase fájlnév `{YYYYMMDDHHMM}_{bd-id}_{snake}.sql`, constraint-prefixek `pk_/fk_/uq_/ck_`.
- Contract-first: fragment → `api/generate/merge.yml` → `cd api/generate && npm run generate:api` → `cd frontend && pnpm generate:api`; `api/openapi.yml` és `frontend/src/data/_client/api.gen.ts` commitolva.
- Docs mandate ugyanabban a PR-ben: `docs/features/tutorial.md` (10 szakasz), `docs/features/today.md` fejléc-szakasz, `node scripts/gen-codemap.mjs` → `docs/CODEMAP.md`.
- Kapuk a PR előtt: frontend `VITE_USE_MOCK=true pnpm test` + `VITE_USE_MOCK=false pnpm test` + `pnpm build`; backend `./mvnw clean test -Dmezo.test.use-testcontainers=true` (a fix-DB mód versenyez és hamis hibát ad). CI a hiteles teljes kapu.

---

## Fájl-struktúra

**Létrehoz:**
- `api/feature/tutorial/tutorial-progress.yml` — contract fragment (GET/PUT/DELETE `/api/tutorial/progress`)
- `backend/src/main/resources/db/changelog/1.0.0/script/202609021400_mezo-gb1s.1_create_tutorial_progress.sql`
- `backend/src/main/java/io/mrkuhne/mezo/feature/tutorial/entity/TutorialProgressEntity.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/tutorial/entity/TutorialProgressEntryJson.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/tutorial/repository/TutorialProgressRepository.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/tutorial/service/TutorialProgressService.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/tutorial/controller/TutorialProgressController.java`
- `backend/src/test/java/io/mrkuhne/mezo/feature/tutorial/TutorialProgressApiIT.java`
- `backend/src/test/java/io/mrkuhne/mezo/feature/tutorial/TutorialProgressSwitchOffApiIT.java`
- `frontend/src/data/tutorial/tutorialProgressApi.ts`, `tutorialProgressHooks.ts`, `tutorialProgressHooks.test.ts`
- `frontend/src/shared/lib/tutorialSeen.ts`, `tutorialSeen.test.ts` — localStorage-tükör
- `frontend/src/features/tutorial/registry/types.ts`, `fuel.ts`, `index.ts`, `registry.test.ts`
- `frontend/src/features/tutorial/TutorialProvider.tsx`, `TutorialProvider.test.tsx`
- `frontend/src/shared/ui/kalauz/KalauzSheet.tsx`, `KalauzSheet.test.tsx`
- `docs/features/tutorial.md`

**Módosít:**
- `api/generate/merge.yml` (új fragment sor), `api/openapi.yml` + `frontend/src/data/_client/api.gen.ts` (generált)
- `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`, `backend/src/main/resources/application.yml` (kapcsoló), `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java`, `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java:40`
- `frontend/src/data/types.ts` (típusok), `frontend/src/data/hooks.ts` (barrel), `frontend/src/test/msw/handlers.ts` (handler), `frontend/src/test/setup.ts` (localStorage-ürítés)
- `frontend/src/shared/ui/Sheet.tsx` (két opcionális prop: `onBackdropClick`, `backdropClassName`)
- `frontend/src/styles/prototype.css` (Mozaik-blokk vége: `.kalauz-*` + `.nap-roundbtn.nap-q`)
- `frontend/src/app/AppLayout.tsx` (Provider), `frontend/src/app/AppHeader.tsx` (? gomb), `AppHeader.test.tsx`, `hubHeaders.test.tsx`
- `frontend/src/features/fuel/pages/FuelMaiPage.tsx:132` (anchor attribútum)
- `frontend/tests/visual/visual.spec.ts:97` (seed)
- `docs/features/today.md` (fejléc: öt → hat elem), `docs/CODEMAP.md` (generált)

---

### Task 0: bd al-issue + kiindulás

**Files:** —

- [ ] **Step 1: Al-issue létrehozása**

```bash
bd create "Kalauz S1: motor + fejléc ? + seen-store, Fuel hub kalauzzal" -t feature -p 1 --parent mezo-gb1s -d "Spec: docs/superpowers/specs/2026-09-02-mezo-kalauz-tutorial-design.md §10 S1. Plan: docs/superpowers/plans/2026-09-02-mezo-kalauz-s1-motor.md"
```

Ha a `--parent` flaget a `bd` nem ismeri, `bd create` a flag nélkül, majd `bd dep add <új-id> mezo-gb1s --type parent-child`. Jegyezd fel az id-t (a terv `mezo-gb1s.1`-ként hivatkozik rá; ha más lett, azt írd a commitokba).

- [ ] **Step 2: Claim + branch ellenőrzés**

```bash
bd update mezo-gb1s.1 --claim
git status -sb   # ## claude/in-app-tutorial-system-0f3d62...origin/... — tiszta
```

---

### Task 1: Contract fragment + generálás

**Files:**
- Create: `api/feature/tutorial/tutorial-progress.yml`
- Modify: `api/generate/merge.yml:28` (a `fuel-settings` sor után)
- Generated: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces (Java, generált): `io.mrkuhne.mezo.api.controller.TutorialProgressApi` metódusai `getTutorialProgress()`, `setTutorialProgress(SetTutorialProgressRequest)`, `resetTutorialProgress()`; DTO-k `TutorialProgressResponse { Map<String, TutorialProgressEntry> progress }`, `SetTutorialProgressRequest { Map<String, TutorialProgressEntry> progress }`, `TutorialProgressEntry { Integer version; OffsetDateTime seenAt; OffsetDateTime completedAt; Integer dismissedAtStep }`.
- Produces (TS, generált): `components['schemas']['TutorialProgressResponse' | 'SetTutorialProgressRequest' | 'TutorialProgressEntry']`.

- [ ] **Step 1: Fragment megírása**

```yaml
openapi: 3.0.3
info: { title: mezo tutorial-progress fragment, version: 1.0.0 }
tags:
  - name: TutorialProgress
    description: Per-user "seen" store of the in-app page guides (Mezo-kalauz, mezo-gb1s)
paths:
  /api/tutorial/progress:
    get:
      tags: [TutorialProgress]
      operationId: getTutorialProgress
      summary: The user's guide progress; empty map ghost when nothing seen — never 404 (TutorialProgress)
      responses:
        '200':
          description: The progress map (empty before the first guide is shown)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/TutorialProgressResponse' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
    put:
      tags: [TutorialProgress]
      operationId: setTutorialProgress
      summary: Replace the whole progress map (per-user singleton upsert) (TutorialProgress)
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/SetTutorialProgressRequest' }
      responses:
        '200':
          description: Saved progress
          content:
            application/json:
              schema: { $ref: '#/components/schemas/TutorialProgressResponse' }
        '400':
          description: Validation failure
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
    delete:
      tags: [TutorialProgress]
      operationId: resetTutorialProgress
      summary: Forget every seen guide (Beállítások · Kalauzok újranézése) (TutorialProgress)
      responses:
        '204':
          description: Progress cleared; the next GET returns the empty ghost
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
components:
  schemas:
    TutorialProgressEntry:
      type: object
      required: [version, seenAt]
      properties:
        version:
          type: integer
          minimum: 1
          description: The registry version of the guide that was seen — a bump re-arms the auto-show
        seenAt:
          type: string
          format: date-time
          description: First time the guide appeared (seen = appeared, Appcues modal rule)
        completedAt:
          type: string
          format: date-time
          nullable: true
          description: Set on "Értem, kezdjük" (last card confirmed)
        dismissedAtStep:
          type: integer
          minimum: 0
          nullable: true
          description: Zero-based card index when Kihagyom / ✕ / Escape closed it
    TutorialProgressResponse:
      type: object
      required: [progress]
      properties:
        progress:
          type: object
          additionalProperties: { $ref: '#/components/schemas/TutorialProgressEntry' }
          description: Keyed by guide id from the frontend registry (e.g. `fuel`, `welcome`)
    SetTutorialProgressRequest:
      type: object
      required: [progress]
      properties:
        progress:
          type: object
          additionalProperties: { $ref: '#/components/schemas/TutorialProgressEntry' }
```

- [ ] **Step 2: Regisztrálás a merge-listában**

`api/generate/merge.yml`, a `- inputFile: ../feature/fuel-settings/fuel-settings.yml` sor UTÁN:

```yaml
  - inputFile: ../feature/tutorial/tutorial-progress.yml
```

- [ ] **Step 3: Generálás**

```bash
cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api
```

Expected: `api/openapi.yml` tartalmazza a `/api/tutorial/progress` útvonalat; `grep -n "TutorialProgressEntry" frontend/src/data/_client/api.gen.ts` találatot ad.

- [ ] **Step 4: Commit**

```bash
git add api/feature/tutorial/tutorial-progress.yml api/generate/merge.yml api/openapi.yml frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): tutorial-progress contract — per-user kalauz seen-store (mezo-gb1s.1)"
```

---

### Task 2: Backend — migráció, entitás, service, controller, IT-k

**Files:**
- Create: migráció, `TutorialProgressEntity.java`, `TutorialProgressEntryJson.java`, `TutorialProgressRepository.java`, `TutorialProgressService.java`, `TutorialProgressController.java`, `TutorialProgressApiIT.java`, `TutorialProgressSwitchOffApiIT.java`
- Modify: `1.0.0_master.yml` (vége), `application.yml:254` környéke, `FeaturesConfiguration.java`, `ResetDatabase.java:40`

**Interfaces:**
- Consumes: Task 1 generált `TutorialProgressApi` + DTO-k; `OwnedEntity` (`techcore.persistence`), `CurrentUserId`, `FeaturesConfiguration`, `ApiIntegrationTest` (`getForBody`, `putForBody`, `exchangeForBody`, `ownerAuthHeaders`).
- Produces: `GET/PUT/DELETE /api/tutorial/progress` a Task 3 MSW-handler és a valós mód számára.

- [ ] **Step 1: A bukó IT-k megírása**

`backend/src/test/java/io/mrkuhne/mezo/feature/tutorial/TutorialProgressApiIT.java`:

```java
package io.mrkuhne.mezo.feature.tutorial;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SetTutorialProgressRequest;
import io.mrkuhne.mezo.api.dto.TutorialProgressEntry;
import io.mrkuhne.mezo.api.dto.TutorialProgressResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;

/** HTTP round-trips through the generated {@code TutorialProgressApi} contract (mezo-gb1s.1). */
class TutorialProgressApiIT extends ApiIntegrationTest {

    private static final OffsetDateTime T0 = OffsetDateTime.of(2026, 9, 2, 12, 0, 0, 0, ZoneOffset.UTC);

    private static TutorialProgressEntry seen(int version) {
        return TutorialProgressEntry.builder().version(version).seenAt(T0).build();
    }

    @Test
    void testGetTutorialProgress_shouldReturnEmptyGhost_whenNothingSeen() {
        TutorialProgressResponse r =
            getForBody("/api/tutorial/progress", ownerAuthHeaders(), HttpStatus.OK, TutorialProgressResponse.class);

        assertThat(r.getProgress()).isEmpty();
    }

    @Test
    void testSetTutorialProgress_shouldReplaceWholeMap_whenSavedTwice() {
        HttpHeaders auth = ownerAuthHeaders();
        putForBody("/api/tutorial/progress",
            SetTutorialProgressRequest.builder().progress(Map.of("fuel", seen(1), "welcome", seen(1))).build(),
            auth, HttpStatus.OK, TutorialProgressResponse.class);
        TutorialProgressResponse second = putForBody("/api/tutorial/progress",
            SetTutorialProgressRequest.builder().progress(Map.of("fuel",
                TutorialProgressEntry.builder().version(2).seenAt(T0).completedAt(T0.plusMinutes(1)).build())).build(),
            auth, HttpStatus.OK, TutorialProgressResponse.class);

        // PUT = teljes csere: a welcome kulcs eltűnt, a fuel a 2-es verzióval, completedAt-tal jött vissza
        assertThat(second.getProgress()).containsOnlyKeys("fuel");
        assertThat(second.getProgress().get("fuel").getVersion()).isEqualTo(2);
        assertThat(second.getProgress().get("fuel").getCompletedAt()).isEqualTo(T0.plusMinutes(1));

        TutorialProgressResponse read =
            getForBody("/api/tutorial/progress", auth, HttpStatus.OK, TutorialProgressResponse.class);
        assertThat(read.getProgress()).containsOnlyKeys("fuel");
        assertThat(read.getProgress().get("fuel").getSeenAt()).isEqualTo(T0);
        assertThat(read.getProgress().get("fuel").getDismissedAtStep()).isNull();
    }

    @Test
    void testResetTutorialProgress_shouldReturnEmptyGhost_afterDelete() {
        HttpHeaders auth = ownerAuthHeaders();
        putForBody("/api/tutorial/progress",
            SetTutorialProgressRequest.builder().progress(Map.of("fuel", seen(1))).build(),
            auth, HttpStatus.OK, TutorialProgressResponse.class);

        exchangeForBody("/api/tutorial/progress", HttpMethod.DELETE, null, auth, HttpStatus.NO_CONTENT, Void.class);

        TutorialProgressResponse read =
            getForBody("/api/tutorial/progress", auth, HttpStatus.OK, TutorialProgressResponse.class);
        assertThat(read.getProgress()).isEmpty();

        // reset után az újra-mentés új élő sort hoz (a partial-unique index a soft-deleted sort nem számolja)
        TutorialProgressResponse again = putForBody("/api/tutorial/progress",
            SetTutorialProgressRequest.builder().progress(Map.of("fuel", seen(3))).build(),
            auth, HttpStatus.OK, TutorialProgressResponse.class);
        assertThat(again.getProgress().get("fuel").getVersion()).isEqualTo(3);
    }

    @Test
    void testSetTutorialProgress_shouldReturn400_whenEntryInvalid() {
        SetTutorialProgressRequest bad = SetTutorialProgressRequest.builder()
            .progress(Map.of("fuel", TutorialProgressEntry.builder().version(0).seenAt(T0).build()))
            .build();

        putForBody("/api/tutorial/progress", bad, ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
    }

    @Test
    void testTutorialProgressEndpoints_shouldReturn401_whenNoToken() {
        getForBody("/api/tutorial/progress", null, HttpStatus.UNAUTHORIZED, Void.class);
    }
}
```

Ha az `exchangeForBody` szignatúrája (`ApiIntegrationTest.java:92`) más paraméter-sorrendet vár, igazítsd a híváshoz — a szándék: DELETE `auth` fejléccel, `204` elvárással, body nélkül.

`backend/src/test/java/io/mrkuhne/mezo/feature/tutorial/TutorialProgressSwitchOffApiIT.java`:

```java
package io.mrkuhne.mezo.feature.tutorial;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/** With the tutorial switch OFF, the @ConditionalOnProperty controller is absent -> 404. */
@TestPropertySource(properties = "mezo.feature.tutorial.enabled=false")
class TutorialProgressSwitchOffApiIT extends ApiIntegrationTest {

    @Test
    void testGetTutorialProgress_shouldReturn404_whenTutorialSwitchOff() {
        getForBody("/api/tutorial/progress", ownerAuthHeaders(), HttpStatus.NOT_FOUND, Void.class);
    }
}
```

- [ ] **Step 2: Futtatás — bukik (nincs endpoint)**

```bash
cd backend && ./mvnw test -Dtest='TutorialProgressApiIT,TutorialProgressSwitchOffApiIT' -Dmezo.test.use-testcontainers=true -q 2>&1 | tail -20
```

Expected: fordítási hiba (nincs `TutorialProgressResponse`) VAGY 404 az OK helyett — mindkettő „bukik".

- [ ] **Step 3: Migráció + master + reset-lista + kapcsoló**

`backend/src/main/resources/db/changelog/1.0.0/script/202609021400_mezo-gb1s.1_create_tutorial_progress.sql`:

```sql
-- Mezo-kalauz seen-store (bd mezo-gb1s.1, spec docs/superpowers/specs/2026-09-02-mezo-kalauz-tutorial-design.md §6).
-- Per-user singleton (fuel_settings shape): one live row per owner, the whole guide-progress map as jsonb.
-- Keys are frontend registry ids; the backend stores, never validates them.

create table tutorial_progress (
    id          uuid        not null default gen_random_uuid(),
    created_by  uuid        not null,
    is_deleted  boolean     not null default false,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz,
    progress    jsonb       not null default '{}'::jsonb,
    constraint pk_tutorial_progress_id primary key (id),
    constraint fk_tutorial_progress_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade
);
create unique index uq_tutorial_progress_user on tutorial_progress (created_by) where is_deleted = false;
```

`1.0.0_master.yml` végére:

```yaml
  - changeSet:
      id: "1.0.0:202609021400_mezo-gb1s.1_create_tutorial_progress"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609021400_mezo-gb1s.1_create_tutorial_progress.sql
```

`ResetDatabase.java:40`: a TRUNCATE-listában a `fuel_settings, ` után szúrd be: `tutorial_progress, `.

`FeaturesConfiguration.java` — a `FUEL_SETTINGS_SWITCH` konstans mellé:

```java
    /** Mezo-kalauz seen-store (mezo-gb1s.1). */
    public static final String TUTORIAL_SWITCH = "mezo.feature.tutorial.enabled";
```

`application.yml` — a `fuel-settings:` blokk után, ugyanazon az indentáción:

```yaml
    # Mezo-kalauz seen-store (mezo-gb1s.1): per-user guide-progress singleton.
    tutorial:
      enabled: true
```

- [ ] **Step 4: Lint a migrációra**

```bash
node scripts/lint-liquibase.mjs 2>&1 | tail -3
```

Expected: nincs hiba a `202609021400_mezo-gb1s.1_create_tutorial_progress.sql`-re.

- [ ] **Step 5: Entitás + JSON-elem + repository**

`TutorialProgressEntryJson.java`:

```java
package io.mrkuhne.mezo.feature.tutorial.entity;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One guide's seen-record inside the jsonb map — ISO-8601 strings, the service converts. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TutorialProgressEntryJson {
    private Integer version;
    private String seenAt;
    private String completedAt;
    private Integer dismissedAtStep;
}
```

`TutorialProgressEntity.java`:

```java
package io.mrkuhne.mezo.feature.tutorial.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

/** Mezo-kalauz seen-store — one live row per owner (partial-unique on created_by, fuel_settings shape). */
@Getter
@Setter
@Entity
@Table(name = "tutorial_progress")
@SQLDelete(sql = "update tutorial_progress set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class TutorialProgressEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private Map<String, TutorialProgressEntryJson> progress = new HashMap<>();

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
```

`TutorialProgressRepository.java`:

```java
package io.mrkuhne.mezo.feature.tutorial.repository;

import io.mrkuhne.mezo.feature.tutorial.entity.TutorialProgressEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

// Singleton row per owner (no 'date' base field) => JpaRepository directly, like FuelSettingsRepository.
public interface TutorialProgressRepository extends JpaRepository<TutorialProgressEntity, UUID> {

    Optional<TutorialProgressEntity> findByCreatedByAndDeletedFalse(UUID createdBy);
}
```

- [ ] **Step 6: Service + controller**

`TutorialProgressService.java`:

```java
package io.mrkuhne.mezo.feature.tutorial.service;

import io.mrkuhne.mezo.api.dto.SetTutorialProgressRequest;
import io.mrkuhne.mezo.api.dto.TutorialProgressEntry;
import io.mrkuhne.mezo.api.dto.TutorialProgressResponse;
import io.mrkuhne.mezo.feature.tutorial.entity.TutorialProgressEntity;
import io.mrkuhne.mezo.feature.tutorial.entity.TutorialProgressEntryJson;
import io.mrkuhne.mezo.feature.tutorial.repository.TutorialProgressRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.TUTORIAL_SWITCH, havingValue = "true")
public class TutorialProgressService {

    private final TutorialProgressRepository repository;

    /** Empty-map ghost when nothing was ever seen — never 404. */
    public TutorialProgressResponse getProgress(UUID userId) {
        Map<String, TutorialProgressEntry> out = new LinkedHashMap<>();
        repository.findByCreatedByAndDeletedFalse(userId)
            .ifPresent(e -> e.getProgress().forEach((k, v) -> out.put(k, toDto(v))));
        return TutorialProgressResponse.builder().progress(out).build();
    }

    /** Whole-map replace (the client owns the merge; see spec §6 "Írás-sorrend"). */
    @Transactional
    public TutorialProgressResponse setProgress(UUID userId, SetTutorialProgressRequest req) {
        TutorialProgressEntity row = repository.findByCreatedByAndDeletedFalse(userId)
            .orElseGet(() -> {
                TutorialProgressEntity e = new TutorialProgressEntity();
                e.setCreatedBy(userId); // server-side from principal, never from client
                return e;
            });
        Map<String, TutorialProgressEntryJson> json = new LinkedHashMap<>();
        req.getProgress().forEach((k, v) -> json.put(k, toJson(v)));
        row.setProgress(json);
        repository.save(row);
        return getProgress(userId);
    }

    /** Soft-deletes the live row; the partial-unique index lets the next PUT create a fresh one. */
    @Transactional
    public void resetProgress(UUID userId) {
        repository.findByCreatedByAndDeletedFalse(userId).ifPresent(repository::delete);
    }

    private static TutorialProgressEntryJson toJson(TutorialProgressEntry d) {
        return new TutorialProgressEntryJson(
            d.getVersion(),
            d.getSeenAt().toString(),
            d.getCompletedAt() == null ? null : d.getCompletedAt().toString(),
            d.getDismissedAtStep());
    }

    private static TutorialProgressEntry toDto(TutorialProgressEntryJson j) {
        return TutorialProgressEntry.builder()
            .version(j.getVersion())
            .seenAt(OffsetDateTime.parse(j.getSeenAt()))
            .completedAt(j.getCompletedAt() == null ? null : OffsetDateTime.parse(j.getCompletedAt()))
            .dismissedAtStep(j.getDismissedAtStep())
            .build();
    }
}
```

`TutorialProgressController.java`:

```java
package io.mrkuhne.mezo.feature.tutorial.controller;

import io.mrkuhne.mezo.api.controller.TutorialProgressApi;
import io.mrkuhne.mezo.api.dto.SetTutorialProgressRequest;
import io.mrkuhne.mezo.api.dto.TutorialProgressResponse;
import io.mrkuhne.mezo.feature.tutorial.service.TutorialProgressService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** /api/tutorial/progress surface (mezo-gb1s.1) — mappings come from the generated {@link TutorialProgressApi}. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.TUTORIAL_SWITCH, havingValue = "true")
public class TutorialProgressController implements TutorialProgressApi {

    private final TutorialProgressService service;
    private final CurrentUserId currentUserId;

    @Override
    public TutorialProgressResponse getTutorialProgress() {
        return service.getProgress(currentUserId.get());
    }

    @Override
    public TutorialProgressResponse setTutorialProgress(SetTutorialProgressRequest setTutorialProgressRequest) {
        return service.setProgress(currentUserId.get(), setTutorialProgressRequest);
    }

    @Override
    public void resetTutorialProgress() {
        service.resetProgress(currentUserId.get());
    }
}
```

Ha a generált `TutorialProgressApi.resetTutorialProgress()` visszatérése `ResponseEntity<Void>` (a generátor a 204-re így is dolgozhat), akkor `return ResponseEntity.noContent().build();` — a generált interfész a forrás, ne a terv.

- [ ] **Step 7: IT-k futtatása — zöld**

```bash
cd backend && ./mvnw test -Dtest='TutorialProgressApiIT,TutorialProgressSwitchOffApiIT' -Dmezo.test.use-testcontainers=true -q 2>&1 | tail -20
```

Expected: `Tests run: 6, Failures: 0, Errors: 0`. Ha a `400`-teszt 200-at ad: a generált DTO `@Min(1)` validációja csak `@Valid` alatt fut — ellenőrizd, hogy a generált `TutorialProgressApi` a request-paraméteren viszi a `@Valid`-ot (a fuel-settings ugyanígy működik); ha a beágyazott map-elemekre nem terjed ki, a `SetTutorialProgressRequest.progress` schemára tegyél `minProperties: 0`-t és a validációt a service-ben végezd: `if (v.getVersion() < 1) throw new FieldValidationException(...)` — a projekt kivétel-osztályát a `techcore/exception` csomagból használd (nyers `RuntimeException` tilos, ArchUnit).

- [ ] **Step 8: ArchUnit + teljes backend kapu**

```bash
cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -q 2>&1 | tail -15
```

Expected: BUILD SUCCESS (ArchUnit is fut ebben).

- [ ] **Step 9: Commit**

```bash
git add backend/src/main/resources/db/changelog backend/src/main/resources/application.yml backend/src/main/java/io/mrkuhne/mezo/feature/tutorial backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java backend/src/test/java/io/mrkuhne/mezo/feature/tutorial backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java
git commit -m "feat(tutorial): tutorial_progress per-user seen-store — GET ghost / PUT replace / DELETE reset (mezo-gb1s.1)"
```

---

### Task 3: Frontend adatréteg — típusok, API, hookok, MSW

**Files:**
- Create: `frontend/src/data/tutorial/tutorialProgressApi.ts`, `frontend/src/data/tutorial/tutorialProgressHooks.ts`, `frontend/src/data/tutorial/tutorialProgressHooks.test.ts`
- Modify: `frontend/src/data/types.ts` (a `FuelSettings` interface után), `frontend/src/data/hooks.ts:47` után, `frontend/src/test/msw/handlers.ts:1136` után

**Interfaces:**
- Produces: `TutorialProgressEntry`, `TutorialProgress` típusok; `useTutorialProgress(): { progress: TutorialProgress; isPending: boolean; isError: boolean }`; `useTutorialProgressActions(): { setProgress(p: TutorialProgress): Promise<void>; resetProgress(): Promise<void> }`; `TUTORIAL_PROGRESS_GHOST: TutorialProgress` (= `{}`).

- [ ] **Step 1: Típusok**

`frontend/src/data/types.ts`, a `FuelSettings` interface után:

```ts
/** Mezo-kalauz seen-store (mezo-gb1s): one record per guide id, the whole map is the per-user singleton. */
export interface TutorialProgressEntry {
  version: number
  seenAt: string
  completedAt: string | null
  dismissedAtStep: number | null
}
export type TutorialProgress = Record<string, TutorialProgressEntry>
```

- [ ] **Step 2: A bukó hook-teszt**

`frontend/src/data/tutorial/tutorialProgressHooks.test.ts`:

```ts
import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { API_BASE } from '@/data/_client/api'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'
import { isMockMode } from '@/data/_client/mode'
import { useTutorialProgress, useTutorialProgressActions } from '@/data/tutorial/tutorialProgressHooks'

const ENTRY = { version: 1, seenAt: '2026-09-02T12:00:00.000Z', completedAt: null, dismissedAtStep: null }

test('üres ghost-tal indul, és a PUT után a mentett map jön vissza', async () => {
  const wrapper = makeHookWrapper()
  const { result } = renderHook(() => ({ q: useTutorialProgress(), a: useTutorialProgressActions() }), { wrapper })
  expect(result.current.q.progress).toEqual({})

  await act(async () => { await result.current.a.setProgress({ fuel: ENTRY }) })
  await waitFor(() => expect(result.current.q.progress).toEqual({ fuel: ENTRY }))
})

test('reset után újra üres', async () => {
  const wrapper = makeHookWrapper()
  const { result } = renderHook(() => ({ q: useTutorialProgress(), a: useTutorialProgressActions() }), { wrapper })
  await act(async () => { await result.current.a.setProgress({ fuel: ENTRY }) })
  await waitFor(() => expect(result.current.q.progress).toEqual({ fuel: ENTRY }))
  await act(async () => { await result.current.a.resetProgress() })
  await waitFor(() => expect(result.current.q.progress).toEqual({}))
})

test('valós módban a GET-hiba isError-t ad, a progress marad az üres ghost (sosem dob)', async () => {
  if (isMockMode()) return // mock módban nincs hálózat
  server.use(http.get(`${API_BASE}/api/tutorial/progress`, () => HttpResponse.json([], { status: 500 })))
  const { result } = renderHook(() => useTutorialProgress(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.isError).toBe(true))
  expect(result.current.progress).toEqual({})
})
```

- [ ] **Step 3: Futtatás — bukik**

```bash
cd frontend && VITE_USE_MOCK=false pnpm vitest run src/data/tutorial 2>&1 | tail -8
```

Expected: FAIL — `Cannot find module '@/data/tutorial/tutorialProgressHooks'`.

- [ ] **Step 4: API-kliens + hookok + MSW + barrel**

`frontend/src/data/tutorial/tutorialProgressApi.ts`:

```ts
import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type { TutorialProgress } from '@/data/types'

type TutorialProgressResponse = components['schemas']['TutorialProgressResponse']
type SetTutorialProgressRequest = components['schemas']['SetTutorialProgressRequest']

export const tutorialProgressApi = {
  get: (): Promise<TutorialProgress> =>
    apiFetch<TutorialProgressResponse>('/api/tutorial/progress').then((r) => r.progress as TutorialProgress),
  set: (progress: TutorialProgress): Promise<TutorialProgress> =>
    apiFetch<TutorialProgressResponse>('/api/tutorial/progress', {
      method: 'PUT',
      body: JSON.stringify({ progress } satisfies SetTutorialProgressRequest),
    }).then((r) => r.progress as TutorialProgress),
  reset: (): Promise<void> => apiFetch<void>('/api/tutorial/progress', { method: 'DELETE' }),
}
```

`frontend/src/data/tutorial/tutorialProgressHooks.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { DEFAULT_QUERY_STALE_TIME_MS, useDualQuery } from '@/data/useDualQuery'
import { tutorialProgressApi } from '@/data/tutorial/tutorialProgressApi'
import type { TutorialProgress } from '@/data/types'

/** The backend's empty-map ghost — the honest value in BOTH modes before the first guide is seen. */
export const TUTORIAL_PROGRESS_GHOST: TutorialProgress = {}

const KEY = ['tutorialProgress'] as const

export function useTutorialProgress() {
  const { data, isPending, isError } = useDualQuery<TutorialProgress>({
    queryKey: KEY,
    mockData: TUTORIAL_PROGRESS_GHOST,
    realFetch: tutorialProgressApi.get,
    realEmpty: TUTORIAL_PROGRESS_GHOST,
    // Mounts in the shell (TutorialProvider) — without this the read would be always-stale (mezo-5cmq).
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
  })
  return { progress: data, isPending, isError }
}

export function useTutorialProgressActions() {
  const qc = useQueryClient()
  const mock = isMockMode()
  const set = useMutation({
    mutationFn: async (progress: TutorialProgress) => {
      if (mock) { qc.setQueryData<TutorialProgress>(KEY, progress); return }
      const saved = await tutorialProgressApi.set(progress)
      qc.setQueryData<TutorialProgress>(KEY, saved)
    },
  })
  const reset = useMutation({
    mutationFn: async () => {
      if (mock) { qc.setQueryData<TutorialProgress>(KEY, {}); return }
      await tutorialProgressApi.reset()
      qc.setQueryData<TutorialProgress>(KEY, {})
    },
  })
  return {
    setProgress: (p: TutorialProgress) => set.mutateAsync(p).then(() => undefined),
    resetProgress: () => reset.mutateAsync().then(() => undefined),
  }
}
```

`frontend/src/test/msw/handlers.ts` — a fuel-settings handler-pár UTÁN (in-memory állapot, hogy a PUT→GET kör a hook-tesztben valódi legyen):

```ts
  // Mezo-kalauz seen-store (mezo-gb1s.1) — empty ghost; PUT replaces, DELETE clears. In-memory so a
  // test's PUT is visible to its next GET; `server.resetHandlers()` between tests restores this closure's
  // initial state only if the module is re-evaluated — so tests that care start with an explicit PUT.
  ...(() => {
    let progress: Record<string, unknown> = {}
    return [
      http.get(`${API_BASE}/api/tutorial/progress`, () => HttpResponse.json({ progress })),
      http.put(`${API_BASE}/api/tutorial/progress`, async ({ request }) => {
        progress = ((await request.json()) as { progress: Record<string, unknown> }).progress
        return HttpResponse.json({ progress })
      }),
      http.delete(`${API_BASE}/api/tutorial/progress`, () => { progress = {}; return new HttpResponse(null, { status: 204 }) }),
    ]
  })(),
```

`frontend/src/data/hooks.ts`, a `fuelSettingsHooks` re-export után:

```ts
export { useTutorialProgress, useTutorialProgressActions, TUTORIAL_PROGRESS_GHOST } from '@/data/tutorial/tutorialProgressHooks'
```

- [ ] **Step 5: Futtatás mindkét módban — zöld**

```bash
cd frontend && VITE_USE_MOCK=false pnpm vitest run src/data/tutorial 2>&1 | tail -6 && VITE_USE_MOCK=true pnpm vitest run src/data/tutorial 2>&1 | tail -6
```

Expected: 3 passed (real), 3 passed (mock — a harmadik korán visszatér).

- [ ] **Step 6: dualMode guard**

```bash
cd frontend && VITE_USE_MOCK=false pnpm vitest run src/data/dualMode.guard.test.ts 2>&1 | tail -4
```

Expected: PASS (nincs `data = seed` minta).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/data/types.ts frontend/src/data/hooks.ts frontend/src/data/tutorial frontend/src/test/msw/handlers.ts
git commit -m "feat(fe/data): useTutorialProgress dual-mode hook + MSW seen-store (mezo-gb1s.1)"
```

---

### Task 4: localStorage-tükör (`tutorialSeen.ts`)

**Files:**
- Create: `frontend/src/shared/lib/tutorialSeen.ts`, `frontend/src/shared/lib/tutorialSeen.test.ts`
- Modify: `frontend/src/test/setup.ts:41-47` (localStorage-kulcsok ürítése)

**Interfaces:**
- Produces: `TUTORIAL_SEEN_KEY = 'mezo.kalauz.v1'`; `readLocalProgress(): TutorialProgress`; `writeLocalProgress(p: TutorialProgress): void`; `mergeProgress(server: TutorialProgress, local: TutorialProgress): TutorialProgress` (kulcsonként a KÉSŐBBI `seenAt` nyer; azonos `seenAt` mellett a lokális).
- Megjegyzés: a spec `mezo.kalauz.<userId>` kulcsot ír; a frontendben ma nincs user-id (owner-JWT, egy fiók/eszköz). S1 a `v1` szuffixet használja; a multi-user session a saját user-id-jével prefixeli — ez a doksi §9-be kerül (Task 10).

- [ ] **Step 1: A bukó teszt**

```ts
import { mergeProgress, readLocalProgress, writeLocalProgress, TUTORIAL_SEEN_KEY } from '@/shared/lib/tutorialSeen'

const e = (seenAt: string, version = 1) => ({ version, seenAt, completedAt: null, dismissedAtStep: null })

beforeEach(() => localStorage.clear())

test('üres tárból üres map, hibás JSON-ból is üres map', () => {
  expect(readLocalProgress()).toEqual({})
  localStorage.setItem(TUTORIAL_SEEN_KEY, '{nem json')
  expect(readLocalProgress()).toEqual({})
})

test('write → read körbeér', () => {
  writeLocalProgress({ fuel: e('2026-09-02T12:00:00.000Z') })
  expect(readLocalProgress()).toEqual({ fuel: e('2026-09-02T12:00:00.000Z') })
})

test('merge: unió, kulcsonként a későbbi seenAt nyer, döntetlennél a lokális', () => {
  const server = { fuel: e('2026-09-02T12:00:00.000Z', 1), nap: e('2026-09-01T08:00:00.000Z') }
  const local = { fuel: e('2026-09-02T12:00:00.000Z', 2), me: e('2026-09-02T13:00:00.000Z') }
  expect(mergeProgress(server, local)).toEqual({
    fuel: e('2026-09-02T12:00:00.000Z', 2),
    nap: e('2026-09-01T08:00:00.000Z'),
    me: e('2026-09-02T13:00:00.000Z'),
  })
  const newerServer = { fuel: e('2026-09-03T12:00:00.000Z', 3) }
  expect(mergeProgress(newerServer, local).fuel.version).toBe(3)
})
```

- [ ] **Step 2: Futtatás — bukik**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/shared/lib/tutorialSeen 2>&1 | tail -5
```

Expected: FAIL — modul nem található.

- [ ] **Step 3: Implementáció**

```ts
// ============================================================
// Mezo · tutorialSeen — a kalauz seen-store localStorage-tükre (mezo-gb1s.1).
// A backend (`useTutorialProgress`) az igazság forrása; ez a tükör két dolgot ad:
// azonnali elrejtést (a PUT visszaérkezése előtt) és offline/hiba-esetre a legutóbbi
// ismert állapotot. Ugyanaz a defenzív try/catch-idióma, mint `seenMessages.ts`.
// ============================================================
import type { TutorialProgress } from '@/data/types'

export const TUTORIAL_SEEN_KEY = 'mezo.kalauz.v1'

export function readLocalProgress(): TutorialProgress {
  try {
    const raw = localStorage.getItem(TUTORIAL_SEEN_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as TutorialProgress) : {}
  } catch {
    return {}
  }
}

export function writeLocalProgress(progress: TutorialProgress): void {
  try {
    localStorage.setItem(TUTORIAL_SEEN_KEY, JSON.stringify(progress))
  } catch {
    /* ignore — a tükör kényelem, nem igazság */
  }
}

/** Unió; kulcsonként a KÉSŐBBI seenAt nyer, döntetlennél a lokális (az optimistán frissebb). */
export function mergeProgress(server: TutorialProgress, local: TutorialProgress): TutorialProgress {
  const out: TutorialProgress = { ...server }
  for (const [id, entry] of Object.entries(local)) {
    const s = out[id]
    if (!s || Date.parse(entry.seenAt) >= Date.parse(s.seenAt)) out[id] = entry
  }
  return out
}
```

Egy tiszta lib-modul `@/data/types`-ból csak TÍPUST importál — ez a `shared/lib` rétegben elfogadott (`seenMessages.ts` is így él); futásidejű `@/data/*` import itt sem lehet.

- [ ] **Step 4: Teszt-izoláció a setup-ban**

`frontend/src/test/setup.ts` — a sessionStorage-ürítő `afterEach` UTÁN:

```ts
// Mezo-kalauz seen-store (mezo-gb1s.1): a localStorage tesztek között NEM ürül, egy persistált
// "látva" jel a következő teszt auto-felugrását némítaná — a kalauz-kulcsokat célzottan töröljük.
afterEach(() => {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('mezo.kalauz.')) localStorage.removeItem(k)
  } catch {
    /* ignore */
  }
})
```

A `MemoryStorage` `Object.keys` nem adja vissza a kulcsokat (Map-ben élnek) — használd a `length`/`key(i)` párost:

```ts
afterEach(() => {
  try {
    const doomed: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('mezo.kalauz.')) doomed.push(k)
    }
    doomed.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* ignore */
  }
})
```

(A második változat a helyes; az elsőt ne hagyd a fájlban.)

- [ ] **Step 5: Futtatás — zöld**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/shared/lib/tutorialSeen 2>&1 | tail -5
```

Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/shared/lib/tutorialSeen.ts frontend/src/shared/lib/tutorialSeen.test.ts frontend/src/test/setup.ts
git commit -m "feat(fe): kalauz seen-store localStorage mirror + merge (mezo-gb1s.1)"
```

---

### Task 5: Registry — típusok, `findKalauz`, a Fuel hub kalauza

**Files:**
- Create: `frontend/src/features/tutorial/registry/types.ts`, `frontend/src/features/tutorial/registry/fuel.ts`, `frontend/src/features/tutorial/registry/index.ts`, `frontend/src/features/tutorial/registry/registry.test.ts`

**Interfaces:**
- Produces: `KalauzCard` (unió), `KalauzEntry`, `KalauzTier = 'T1' | 'T2' | 'T3'`; `KALAUZ_REGISTRY: KalauzEntry[]`; `findKalauz(pathname: string): KalauzEntry | null`; `getKalauz(id: string): KalauzEntry | null`.

- [ ] **Step 1: Típusok**

`registry/types.ts`:

```ts
import type { ClayIconName, ClaySpotName } from '@/shared/ui/clay'

export type KalauzTier = 'T1' | 'T2' | 'T3'
export type OrbState = 's-orb' | 's-orb-figyel' | 's-orb-unnepel' | 's-orb-ejszaka'
export type KalauzArt = ClayIconName | ClaySpotName

interface CardBase { title: string; voice: string; orb?: OrbState }
export type KalauzCard =
  | (CardBase & { kind: 'intro'; spot: KalauzArt })
  | (CardBase & { kind: 'fogalom'; spot: KalauzArt; term: string; def: string })
  | (CardBase & { kind: 'hogyan'; spot: KalauzArt; anchor?: string })
  | (CardBase & { kind: 'mikor'; spot: KalauzArt })
  | (CardBase & { kind: 'kapcsolat'; links: { to: string; label: string; icon: ClayIconName; effect?: string }[] })

export interface KalauzEntry {
  /** Stable id — the seen-store key. Never rename once shipped; bump `version` instead. */
  id: string
  /** react-router pattern, matched with `end: true` against the pathname. */
  route: string
  tier: KalauzTier
  version: number
  /** The `KALAUZ · <label>` tag in the sheet head — HU, verbatim tab/page name. */
  label: string
  cards: KalauzCard[]
}
```

- [ ] **Step 2: A Fuel hub kalauza (a prototípus szövege, verbatim)**

`registry/fuel.ts`:

```ts
import type { KalauzEntry } from '@/features/tutorial/registry/types'

export const FUEL_KALAUZ: KalauzEntry[] = [
  {
    id: 'fuel',
    route: '/fuel',
    tier: 'T1',
    version: 1,
    label: 'Fuel',
    cards: [
      {
        kind: 'intro', spot: 'i-fuel', orb: 's-orb',
        title: 'Ez a Fuel.',
        voice: 'Itt követjük, hogy mit eszel. Nem diéta és nem számolgatás — inkább **térkép**: mennyi energia ment be ma, és mennyi fér még.',
      },
      {
        kind: 'fogalom', spot: 's-energia', orb: 's-orb',
        title: 'A napi keret és a makrók.',
        voice: 'A tested minden nap kap egy **keretet** — ennyi energia fér bele. A gyűrű fent mutatja, hol tartunk.',
        term: 'makró',
        def: 'A három „építőanyag": **fehérje** (izom), **szénhidrát** (üzemanyag), **zsír** (hormonok). A kalória ezekből adódik össze.',
      },
      {
        kind: 'hogyan', spot: 'i-reggeli', orb: 's-orb-figyel', anchor: 'fuel-log',
        title: 'Logolni egy koppintás.',
        voice: 'A **+** gombbal vagy a Logolás-csempéből. Elég egy fotó vagy egy mondat — „egy tál zabkása banánnal" — a többit Mezo kitalálja.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Evés után, pár másodperc.',
        voice: 'Nem szükséges tökéletesnek lennie. Ha kimaradt egy étkezés, később is **pótoljuk** — a nap ettől nem lesz kevesebb.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'Nem sziget.',
        voice: 'Edzésnapon több keret jár. A súlyod és az alvásod is innen kap adatot — és a chatben Mezo ebből tud tanácsot adni.',
        links: [
          { to: '/train', label: 'Edzés', icon: 'i-edzes', effect: 'edzésnap → +keret' },
          { to: '/me/weight', label: 'Súly', icon: 'i-suly' },
          { to: '/me/sleep', label: 'Alvás', icon: 'i-alvas' },
          { to: '/mezo/chat', label: 'Mezo chat', icon: 'i-mezo' },
        ],
      },
    ],
  },
]
```

(A „Mikor" kártya a prototípushoz képest átfogalmazva: a tiltott *kell* / *elbukik* szavak nélkül.)

- [ ] **Step 3: A bukó registry-teszt**

`registry/registry.test.ts`:

```ts
import { matchRoutes } from 'react-router-dom'
import { routes } from '@/app/router'
import { KALAUZ_REGISTRY, findKalauz, getKalauz } from '@/features/tutorial/registry'

const FORBIDDEN = /\b(kell|muszáj|hiba|elbukik|rossz)\b/i

test('a /fuel-nek van kalauza, a /fuel/log-nak (még) nincs', () => {
  expect(findKalauz('/fuel')?.id).toBe('fuel')
  expect(findKalauz('/fuel/log')).toBeNull()
  expect(getKalauz('fuel')?.label).toBe('Fuel')
  expect(getKalauz('nincs-ilyen')).toBeNull()
})

test('minden entry route-ja létezik a routerben, az id-k egyediek', () => {
  const ids = new Set<string>()
  for (const e of KALAUZ_REGISTRY) {
    expect(matchRoutes(routes, e.route)).not.toBeNull()
    expect(ids.has(e.id)).toBe(false)
    ids.add(e.id)
    expect(e.version).toBeGreaterThanOrEqual(1)
  }
})

test('hang-lint: nincs tiltott szó, kártyánként legfeljebb 2 mondat, fogalom ≤ 25 szó', () => {
  for (const e of KALAUZ_REGISTRY) for (const c of e.cards) {
    expect(c.voice).not.toMatch(FORBIDDEN)
    expect(c.title).not.toMatch(FORBIDDEN)
    const sentences = c.voice.split(/[.!?…]\s+(?=[A-ZÁÉÍÓÖŐÚÜŰ„])/).length
    expect(sentences).toBeLessThanOrEqual(2)
    if (c.kind === 'fogalom') expect(c.def.split(/\s+/).length).toBeLessThanOrEqual(25)
  }
})
```

- [ ] **Step 4: Futtatás — bukik**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/tutorial/registry 2>&1 | tail -5
```

Expected: FAIL — `@/features/tutorial/registry` nem található.

- [ ] **Step 5: `index.ts`**

```ts
import { matchPath } from 'react-router-dom'
import { FUEL_KALAUZ } from '@/features/tutorial/registry/fuel'
import type { KalauzEntry } from '@/features/tutorial/registry/types'

export type { KalauzCard, KalauzEntry, KalauzTier, OrbState } from '@/features/tutorial/registry/types'

/** Every guide the app knows. Order is irrelevant; ids are the seen-store keys. */
export const KALAUZ_REGISTRY: KalauzEntry[] = [...FUEL_KALAUZ]

export function findKalauz(pathname: string): KalauzEntry | null {
  return KALAUZ_REGISTRY.find((e) => matchPath({ path: e.route, end: true }, pathname) !== null) ?? null
}

export function getKalauz(id: string): KalauzEntry | null {
  return KALAUZ_REGISTRY.find((e) => e.id === id) ?? null
}
```

- [ ] **Step 6: Futtatás — zöld**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/tutorial/registry 2>&1 | tail -5
```

Expected: 3 passed. Ha a hang-lint a „térkép: mennyi…" kettőspontos mondatot 3-nak számolja, a regex a `.` `!` `?` `…` után VÁR nagybetűt — a kettőspont nem választ; ha mégis bukik, a szöveg a hibás, nem a lint: rövidítsd.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/tutorial/registry
git commit -m "feat(tutorial): kalauz registry — típusok, findKalauz, a Fuel hub öt kártyája (mezo-gb1s.1)"
```

---

### Task 6: `KalauzSheet` (shared/ui) + `Sheet` két új propja + CSS

**Files:**
- Create: `frontend/src/shared/ui/kalauz/KalauzSheet.tsx`, `frontend/src/shared/ui/kalauz/KalauzSheet.test.tsx`
- Modify: `frontend/src/shared/ui/Sheet.tsx` (`onBackdropClick?`, `backdropClassName?`), `frontend/src/styles/prototype.css` (a Mozaik-blokk vége, a `.nap-avatar` szabály után — a Mozaik-blokk a Today-blokk ELŐTT marad)

**Interfaces:**
- Consumes: `Sheet`, `ClayIcon`/`ClaySpot`, `SafeMarkdown` (`@/shared/lib/safeMarkdown` — a `**bold**` copy renderelője), `cn`; a Task 5 `KalauzCard`/`KalauzEntry` típusok (típus-import a `features/`-ből a `shared/ui`-ba TILOS a rétegezés miatt → a sheet a saját, strukturálisan azonos `KalauzSheetCard`/`KalauzSheetProps` típusát deklarálja; a Provider adja át az entry `cards`/`label` mezőit).
- Produces: `KalauzSheet({ label, cards, onClose(reason: 'skip' | 'done', step: number), onNavigate(to: string) })`.

- [ ] **Step 1: `Sheet` két opcionális propja**

`Sheet.tsx` — `SheetProps`-ba:

```ts
  /** Peek-mód (Mezo-kalauz): a hátlap koppintása NEM zár, hanem ezt hívja. Alapesetben zár. */
  onBackdropClick?: () => void
  /** Extra osztály a hátlapra (pl. a kalauz átlátszóvá teszi spotlight alatt). */
  backdropClassName?: string
```

A függvény-szignatúra: `export function Sheet({ children, onClose, className, labelledBy, onBackdropClick, backdropClassName }: SheetProps)`; a hátlap:

```tsx
      <div ref={backdropRef} className={cn('sheet-backdrop', backdropClassName)}
        onClick={onBackdropClick ?? requestClose} aria-hidden="true" />
```

Minden meglévő hívó változatlan (mindkét prop opcionális).

- [ ] **Step 2: A bukó KalauzSheet-teszt**

`KalauzSheet.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KalauzSheet, type KalauzSheetCard } from '@/shared/ui/kalauz/KalauzSheet'

const CARDS: KalauzSheetCard[] = [
  { kind: 'intro', spot: 'i-fuel', title: 'Ez a Fuel.', voice: 'Első **kártya**.' },
  { kind: 'fogalom', spot: 's-energia', title: 'Keret.', voice: 'Második.', term: 'makró', def: 'Építőanyag.' },
  { kind: 'hogyan', spot: 'i-reggeli', title: 'Logolás.', voice: 'Harmadik.', anchor: 'fuel-log' },
  { kind: 'kapcsolat', title: 'Nem sziget.', voice: 'Negyedik.', links: [{ to: '/train', label: 'Edzés', icon: 'i-edzes' }] },
]

const setup = (cards = CARDS) => {
  const onClose = vi.fn()
  const onNavigate = vi.fn()
  render(<KalauzSheet label="Fuel" cards={cards} onClose={onClose} onNavigate={onNavigate} />)
  return { onClose, onNavigate, user: userEvent.setup() }
}

test('az első kártyával nyílik, a Vissza tiltva, a lépésszám 1 / 4', () => {
  setup()
  expect(screen.getByRole('dialog', { name: 'Kalauz · Fuel' })).toBeInTheDocument()
  expect(screen.getByText('Ez a Fuel.')).toBeInTheDocument()
  expect(screen.getByText('1 / 4')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Előző kártya' })).toBeDisabled()
})

test('Tovább / Vissza / pötty lapoz; az utolsón a CTA „Értem, kezdjük" és a Kihagyom eltűnik', async () => {
  const { user, onClose } = setup()
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  expect(screen.getByText('Keret.')).toBeInTheDocument()
  expect(screen.getByText('makró')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Előző kártya' }))
  expect(screen.getByText('Ez a Fuel.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '4. kártya' }))
  expect(screen.getByText('Nem sziget.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Kihagyom' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Értem, kezdjük' }))
  expect(onClose).toHaveBeenCalledWith('done', 3)
})

test('Kihagyom és Escape a lépésszámmal zár', async () => {
  const { user, onClose } = setup()
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  await user.click(screen.getByRole('button', { name: 'Kihagyom' }))
  expect(onClose).toHaveBeenCalledWith('skip', 1)
})

test('a kapcsolat-chip navigál és zár', async () => {
  const { user, onClose, onNavigate } = setup()
  await user.click(screen.getByRole('button', { name: '4. kártya' }))
  await user.click(screen.getByRole('button', { name: /Edzés/ }))
  expect(onNavigate).toHaveBeenCalledWith('/train')
  expect(onClose).toHaveBeenCalledWith('done', 3)
})

test('„Mutasd meg" csak akkor renderel, ha az anchor a DOM-ban van; peek → bárhova koppintás visszahoz', async () => {
  document.body.insertAdjacentHTML('beforeend', '<div class="phone-screen"><div data-kalauz-anchor="fuel-log">tile</div></div>')
  const { user } = setup()
  await user.click(screen.getByRole('button', { name: '3. kártya' }))
  await user.click(screen.getByRole('button', { name: 'Mutasd meg a képernyőn' }))
  const dialog = screen.getByRole('dialog', { name: 'Kalauz · Fuel' })
  expect(dialog).toHaveClass('is-peek')
  expect(document.querySelector('.kalauz-spot')).not.toBeNull()
  // a hátlap koppintása NEM zár — visszahozza a sheetet
  await user.click(document.querySelector('.sheet-backdrop')!)
  expect(dialog).not.toHaveClass('is-peek')
  expect(document.querySelector('.kalauz-spot')).toBeNull()
  document.querySelector('.phone-screen')!.remove()
})

test('anchor nélkül nincs „Mutasd meg" gomb (honest state)', async () => {
  const { user } = setup()
  await user.click(screen.getByRole('button', { name: '3. kártya' }))
  expect(screen.queryByRole('button', { name: 'Mutasd meg a képernyőn' })).toBeNull()
})
```

- [ ] **Step 3: Futtatás — bukik**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/shared/ui/kalauz 2>&1 | tail -5
```

Expected: FAIL — modul nem található.

- [ ] **Step 4: `KalauzSheet.tsx`**

```tsx
// ============================================================
// Mezo · KalauzSheet — a Mezo-kalauz lapozó sheetje (mezo-gb1s.1, spec §4).
// Domain-mentes: a kártyákat adatként kapja, a seen-állapotról semmit nem tud — azt a
// TutorialProvider intézi az `onClose(reason, step)` alapján. A meglévő `Sheet`-re épül
// (portál a .phone-screen-be, Escape, drag). Peek = a sheet sávvá húzódik, a hátlap
// átlátszó, egy `.kalauz-spot` doboz árnyéka sötétít a horgony-elem KÖRÜL (a horgony maga
// tiszta marad) — így a spotlight nem nyúl az oldal z-indexéhez. Bármilyen koppintás
// (hátlap, horgony, sáv) visszahozza a sheetet; a kalauz peek alatt sosem záródik.
// ============================================================
import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { cn } from '@/shared/lib/cn'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { ClayIcon, ClaySpot, type ClayIconName, type ClaySpotName } from '@/shared/ui/clay'
import { Sheet } from '@/shared/ui/Sheet'

type Art = ClayIconName | ClaySpotName
type Orb = 's-orb' | 's-orb-figyel' | 's-orb-unnepel' | 's-orb-ejszaka'
interface CardBase { title: string; voice: string; orb?: Orb }
export type KalauzSheetCard =
  | (CardBase & { kind: 'intro'; spot: Art })
  | (CardBase & { kind: 'fogalom'; spot: Art; term: string; def: string })
  | (CardBase & { kind: 'hogyan'; spot: Art; anchor?: string })
  | (CardBase & { kind: 'mikor'; spot: Art })
  | (CardBase & { kind: 'kapcsolat'; links: { to: string; label: string; icon: ClayIconName; effect?: string }[] })

export type KalauzCloseReason = 'skip' | 'done'

export interface KalauzSheetProps {
  label: string
  cards: KalauzSheetCard[]
  onClose: (reason: KalauzCloseReason, step: number) => void
  onNavigate: (to: string) => void
}

const QUESTION: Record<KalauzSheetCard['kind'], string> = {
  intro: 'Mi ez?', fogalom: 'Mire jó?', hogyan: 'Hogyan használjuk?', mikor: 'Mikor nézzük?', kapcsolat: 'Mivel függ össze?',
}

const isSpotName = (n: Art): n is ClaySpotName => n.startsWith('s-')

function Art({ name, size }: { name: Art; size: number }) {
  return isSpotName(name) ? <ClaySpot name={name} size={size} className="kalauz-spotart" />
    : <ClayIcon name={name} size={size} className="kalauz-spotart" />
}

interface SpotRect { top: number; left: number; width: number; height: number }

function measureAnchor(anchor: string): SpotRect | null {
  const el = document.querySelector<HTMLElement>(`[data-kalauz-anchor="${anchor}"]`)
  if (!el) return null
  const host = document.querySelector('.phone-screen') ?? document.body
  const r = el.getBoundingClientRect()
  const h = host.getBoundingClientRect()
  return { top: r.top - h.top, left: r.left - h.left, width: r.width, height: r.height }
}

export function KalauzSheet({ label, cards, onClose, onNavigate }: KalauzSheetProps) {
  const [step, setStep] = useState(0)
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]))
  const [peek, setPeek] = useState<SpotRect | null>(null)
  const card = cards[step]
  const last = step === cards.length - 1
  const anchorPresent = card.kind === 'hogyan' && !!card.anchor && measureAnchor(card.anchor) !== null

  const go = useCallback((k: number) => {
    setStep(k)
    setSeen((s) => new Set(s).add(k))
  }, [])
  const unpeek = useCallback(() => setPeek(null), [])

  // Peek alatt a horgony méretét újramérjük görgetésre/átméretezésre — a sáv nem takarhatja.
  useLayoutEffect(() => {
    if (!peek || card.kind !== 'hogyan' || !card.anchor) return
    const anchor = card.anchor
    const re = () => setPeek(measureAnchor(anchor))
    window.addEventListener('resize', re)
    return () => window.removeEventListener('resize', re)
  }, [peek, card])
  useEffect(() => { setPeek(null) }, [step])

  return (
    <Sheet
      onClose={() => onClose('skip', step)}
      className={cn('kalauz-sheet', peek && 'is-peek')}
      labelledBy="kalauz-title"
      onBackdropClick={peek ? unpeek : undefined}
      backdropClassName={peek ? 'kalauz-clear' : undefined}
    >
      {(close) => (
        <>
          <span id="kalauz-title" className="sr-only">Kalauz · {label}</span>
          {peek && card.kind === 'hogyan' && (
            <>
              <div className="kalauz-spot" style={{ top: peek.top, left: peek.left, width: peek.width, height: peek.height }} aria-hidden="true" />
              <div className="kalauz-peekbar" onClick={unpeek}>
                <ClaySpot name="s-orb-figyel" size={34} />
                <span className="kalauz-peektxt"><SafeMarkdown text={card.voice} /> <span className="kalauz-peekhint">Koppints bárhova.</span></span>
                <button type="button" className="kalauz-ghost" onClick={unpeek}>Vissza</button>
              </div>
            </>
          )}
          <div className={cn('kalauz-body', peek && 'is-hidden')} aria-hidden={peek ? true : undefined}>
            <div className="kalauz-top">
              <span className="mz-eyebrow">Kalauz · <b>{label}</b></span>
              <span className="mz-eyebrow kalauz-step">{step + 1} / {cards.length}</span>
              <button type="button" className="kalauz-x" aria-label="Bezárás" onClick={close}>✕</button>
            </div>

            <div className="kalauz-card" key={step}>
              <div className="kalauz-q"><span className="kalauz-n">{step + 1}</span>{QUESTION[card.kind]}</div>
              <div className="kalauz-title">{card.title}</div>
              <div className="kalauz-art">
                <ClaySpot name={card.orb ?? 's-orb'} size={card.kind === 'intro' ? 92 : 70} className="kalauz-orb" />
                {card.kind !== 'kapcsolat' && <Art name={card.spot} size={card.kind === 'intro' ? 76 : 80} />}
              </div>
              <div className="kalauz-voice"><SafeMarkdown text={card.voice} /></div>
              {card.kind === 'fogalom' && (
                <div className="kalauz-fogalom">
                  <div className="kalauz-term">{card.term}</div>
                  <div className="kalauz-def"><SafeMarkdown text={card.def} /></div>
                </div>
              )}
              {card.kind === 'hogyan' && anchorPresent && (
                <button type="button" className="kalauz-show" onClick={() => setPeek(measureAnchor(card.anchor!))}>
                  ◎ Mutasd meg a képernyőn
                </button>
              )}
              {card.kind === 'kapcsolat' && (
                <div className="kalauz-chips">
                  {card.links.map((l) => (
                    <button key={l.to} type="button" className="kalauz-chip"
                      onClick={() => { onNavigate(l.to); onClose('done', step) }}>
                      <ClayIcon name={l.icon} size={19} />{l.label}
                      {l.effect && <span className="kalauz-chip-to"> · {l.effect}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="kalauz-dots" role="tablist" aria-label="Kártyák">
              {cards.map((_, k) => (
                <button key={k} type="button" role="tab" aria-selected={k === step} aria-label={`${k + 1}. kártya`}
                  className={cn('kalauz-dot', k === step && 'on', k !== step && seen.has(k) && 'seen')} onClick={() => go(k)} />
              ))}
            </div>
            <div className="kalauz-foot">
              {!last && <button type="button" className="kalauz-ghost kalauz-link" onClick={close}>Kihagyom</button>}
              <button type="button" className="kalauz-ghost kalauz-back" aria-label="Előző kártya" disabled={step === 0} onClick={() => go(step - 1)}>‹ Vissza</button>
              {last
                ? <button type="button" className="mz-cta kalauz-cta" onClick={() => onClose('done', step)}>Értem, kezdjük</button>
                : <button type="button" className="mz-cta kalauz-cta" onClick={() => go(step + 1)}>Tovább</button>}
            </div>
          </div>
        </>
      )}
    </Sheet>
  )
}
```

Megjegyzések az implementálónak:
- `SafeMarkdown` propjának neve a projektben ellenőrizendő (`frontend/src/shared/lib/safeMarkdown.tsx`) — ha `children`-t vár, úgy hívd. Ha nincs `sr-only` osztály a `prototype.css`-ben, a címet `aria-label`-lel add a `Sheet`-nek: egészítsd ki a `Sheet`-et egy `label?: string` proppal (`aria-label={label}`), és hagyd el az `sr-only` spant — a teszt `getByRole('dialog', { name: 'Kalauz · Fuel' })` mindkettővel megy.
- A `mz-cta` osztálynév — ha a Mozaik-CTA a `prototype.css`-ben más néven él (grep `gradient-cta`), azt használd.
- A `Sheet` `onClose`-a a Kihagyom/✕/Escape/drag útja (`close` = animált `requestClose`) → `onClose('skip', step)`; a CTA és a chip közvetlenül `onClose('done', …)`-t hív (a Provider unmountol; nincs kilépő animáció — elfogadott, a `LevelUpScreen` ugyanígy zár).

- [ ] **Step 5: CSS — a Mozaik-blokk végére (`prototype.css`, a `.nap-avatar` szabály után)**

```css
/* ── Mezo-kalauz (mezo-gb1s.1) — the page-guide sheet; prototype docs/design_2.0/prototypes/kalauz.html ×1.18 ── */
.kalauz-sheet { padding: 4px 16px 16px; border-radius: 30px 30px 0 0; }
.kalauz-sheet.is-peek { animation: none; transform: translateY(calc(100% - 76px)); transition: transform 0.32s cubic-bezier(0.25, 0.8, 0.35, 1); }
.sheet-backdrop.kalauz-clear { background: transparent; backdrop-filter: none; }
.kalauz-spot { position: absolute; z-index: 200; border-radius: 22px; pointer-events: none;
  box-shadow: 0 0 0 3px var(--dv-amber), 0 0 0 9999px rgba(29, 23, 18, 0.42); }
.kalauz-body.is-hidden { visibility: hidden; }
.kalauz-peekbar { position: absolute; left: 16px; right: 16px; top: 10px; height: 56px; display: flex; align-items: center; gap: 10px; }
.kalauz-peektxt { flex: 1; font-size: 13px; font-weight: 300; color: var(--text-primary); }
.kalauz-peekhint { color: var(--mz-ink-soft); }
.kalauz-top { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.kalauz-step { margin-left: auto; font-variant-numeric: tabular-nums; }
.kalauz-x { border: none; background: var(--mz-chipbg); width: 32px; height: 32px; border-radius: 50%; font-size: 14px; color: var(--mz-ink-soft); cursor: pointer; font-family: inherit; }
.kalauz-card { min-height: 340px; padding: 4px 2px 0; animation: kalauz-in 0.32s cubic-bezier(0.22, 0.9, 0.32, 1.1) both; }
@keyframes kalauz-in { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: none; } }
.kalauz-q { font-size: 11px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: var(--primary-deep); }
.kalauz-n { color: var(--mz-ink-soft); margin-right: 7px; font-variant-numeric: tabular-nums; }
.kalauz-title { font-size: 18px; font-weight: 700; letter-spacing: -0.01em; margin-top: 4px; text-wrap: balance; color: var(--text-primary); }
.kalauz-art { display: flex; align-items: flex-end; justify-content: center; gap: 8px; height: 110px; margin: 6px 0 2px; }
.kalauz-orb { animation: kalauz-breathe 4.5s ease-in-out infinite; transform-origin: 50% 90%; }
@keyframes kalauz-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.045); } }
.kalauz-spotart { filter: drop-shadow(0 10px 12px rgba(43, 33, 24, 0.18)); }
.kalauz-voice { font-size: 16px; font-weight: 300; line-height: 1.5; margin-top: 8px; color: var(--text-primary); }
.kalauz-voice strong, .kalauz-def strong { font-weight: 600; }
.kalauz-fogalom { margin-top: 10px; border-radius: 15px; padding: 10px 13px 11px; background: var(--mz-wash-coral, var(--surface-card)); border: 0.5px solid color-mix(in srgb, var(--primary-deep) 22%, transparent); }
.kalauz-term { font-family: "Fraunces", Georgia, serif; font-style: italic; font-size: 16px; color: var(--primary-deep); }
.kalauz-def { font-size: 13px; font-weight: 300; margin-top: 2px; color: var(--text-primary); }
.kalauz-chips { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 11px; }
.kalauz-chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--border-strong); background: var(--surface-card); font-family: inherit; border-radius: 999px; padding: 6px 12px 6px 8px; font-size: 12px; font-weight: 600; color: var(--text-primary); cursor: pointer; min-height: 34px; }
.kalauz-chip-to { color: var(--mz-ink-soft); font-weight: 500; }
.kalauz-show { margin-top: 11px; display: inline-flex; align-items: center; gap: 6px; border: 1px solid color-mix(in srgb, var(--dv-amber) 55%, transparent); background: color-mix(in srgb, var(--dv-amber) 12%, transparent); color: var(--dv-amber-deep, var(--primary-deep)); border-radius: 999px; padding: 7px 13px; font-size: 12px; font-weight: 700; font-family: inherit; cursor: pointer; }
.kalauz-dots { display: flex; justify-content: center; gap: 6px; margin: 8px 0 12px; }
.kalauz-dot { width: 7px; height: 7px; border-radius: 999px; background: var(--border-strong); border: none; padding: 0; cursor: pointer; transition: width 0.25s ease, background 0.25s ease; }
.kalauz-dot.on { width: 21px; background: var(--primary-deep); }
.kalauz-dot.seen { background: color-mix(in srgb, var(--primary-deep) 45%, transparent); }
.kalauz-foot { display: flex; align-items: center; gap: 8px; }
.kalauz-ghost { background: var(--mz-chipbg); color: var(--mz-ink-soft); border: none; font-family: inherit; border-radius: 999px; padding: 9px 14px; font-size: 13px; font-weight: 600; cursor: pointer; min-height: 40px; }
.kalauz-ghost[disabled] { opacity: 0.35; cursor: default; }
.kalauz-link { background: none; padding-left: 4px; }
.kalauz-back { margin-left: auto; }
.kalauz-cta { padding: 10px 22px; min-height: 40px; }
@media (prefers-reduced-motion: reduce) {
  .kalauz-orb, .kalauz-card { animation: none; }
  .kalauz-sheet.is-peek, .kalauz-dot { transition: none; }
}
```

Token-ellenőrzés: `--dv-amber`, `--mz-chipbg`, `--mz-ink-soft`, `--text-primary`, `--primary-deep`, `--surface-card`, `--border-strong` léteznek (grep a `prototype.css`-ben); a `--mz-wash-coral` és `--dv-amber-deep` fallbackkal szerepel — ha nincs, a fallback él. A hátlap-sötétítés `rgba(29,23,18,.42)` és a drop-shadow árnyék: árnyék-értékek, nem szín-tokenek (a Mozaik-szabályok is így írják az árnyékokat).

- [ ] **Step 6: Futtatás — zöld; CSS-struktúra teszt**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/shared/ui/kalauz src/shared/ui/mozaik/prototypeCssStructure.test.ts src/shared/ui/mozaik/mozaikCssTokens.test.ts src/shared/ui/Sheet 2>&1 | tail -8
```

Expected: mind zöld. Ha a `Sheet.test` a hátlap `onClick`-jét pinneli, az alapeset (`onBackdropClick` nélkül) változatlan → továbbra is zöld.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/shared/ui/kalauz frontend/src/shared/ui/Sheet.tsx frontend/src/styles/prototype.css
git commit -m "feat(ui): KalauzSheet — lapozó kalauz-sheet, fogalom-doboz, kapcsolat-chipek, egy-elemes spotlight peek (mezo-gb1s.1)"
```

---

### Task 7: `TutorialProvider` — auto-felugrás, seen-on-open, session-guard, context

**Files:**
- Create: `frontend/src/features/tutorial/TutorialProvider.tsx`, `frontend/src/features/tutorial/TutorialProvider.test.tsx`
- Modify: `frontend/src/app/AppLayout.tsx` (a `MezoThreadProvider` KÖRÉ, a `LevelUpProvider` alatt)

**Interfaces:**
- Consumes: `useTutorialProgress`/`useTutorialProgressActions` (`@/data/hooks`), `readLocalProgress`/`writeLocalProgress`/`mergeProgress`, `findKalauz`/`getKalauz`, `KalauzSheet`.
- Produces: `useTutorial(): TutorialContextValue` ahol
  ```ts
  interface TutorialContextValue {
    /** A route aktuális kalauza (registry-találat), vagy null. */
    current: KalauzEntry | null
    /** Nyitva lévő kalauz id-je, vagy null. */
    openId: string | null
    open(id: string): void
    close(reason: 'skip' | 'done', step: number): void
    isUnseen(id: string): boolean
    resetAll(): Promise<void>
  }
  ```

- [ ] **Step 1: A bukó Provider-teszt**

`TutorialProvider.test.tsx`:

```tsx
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { TutorialProvider, useTutorial } from '@/features/tutorial/TutorialProvider'
import { readLocalProgress, writeLocalProgress } from '@/shared/lib/tutorialSeen'
import { QueryWrapper } from '@/test/queryWrapper'

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  localStorage.clear()
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

function Probe() {
  const t = useTutorial()
  const navigate = useNavigate()
  return (
    <div>
      <span data-testid="current">{t.current?.id ?? '-'}</span>
      <span data-testid="unseen">{String(t.isUnseen('fuel'))}</span>
      <button onClick={() => t.open('fuel')}>nyisd</button>
      <button onClick={() => navigate('/train')}>train</button>
      <button onClick={() => navigate('/fuel')}>fuel</button>
    </div>
  )
}

const renderAt = (path: string) =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[path]}>
        <TutorialProvider>
          <Routes><Route path="*" element={<Probe />} /></Routes>
        </TutorialProvider>
      </MemoryRouter>
    </QueryWrapper>,
  )

const flush = () => act(() => { vi.advanceTimersByTime(700) })

test('/fuel első belépésre a késleltetés után felugrik, és a megjelenéskor már látottnak számít', async () => {
  renderAt('/fuel')
  expect(screen.getByTestId('current')).toHaveTextContent('fuel')
  expect(screen.queryByRole('dialog')).toBeNull()
  flush()
  expect(await screen.findByRole('dialog', { name: 'Kalauz · Fuel' })).toBeInTheDocument()
  expect(screen.getByTestId('unseen')).toHaveTextContent('false')
  expect(readLocalProgress().fuel?.version).toBe(1)
  expect(readLocalProgress().fuel?.completedAt).toBeNull()
})

test('Kihagyom → dismissedAtStep; nem ugrik fel újra ugyanabban a sessionben, sem route-visszatérésre', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/fuel')
  flush()
  await user.click(await screen.findByRole('button', { name: 'Tovább' }))
  await user.click(screen.getByRole('button', { name: 'Kihagyom' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(readLocalProgress().fuel?.dismissedAtStep).toBe(1)
  await user.click(screen.getByRole('button', { name: 'train' }))
  await user.click(screen.getByRole('button', { name: 'fuel' }))
  flush()
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('látott kalauz nem ugrik fel, de a „?" (open) bármikor nyit', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  writeLocalProgress({ fuel: { version: 1, seenAt: '2026-09-01T10:00:00.000Z', completedAt: null, dismissedAtStep: null } })
  renderAt('/fuel')
  flush()
  expect(screen.queryByRole('dialog')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'nyisd' }))
  expect(screen.getByRole('dialog', { name: 'Kalauz · Fuel' })).toBeInTheDocument()
})

test('regi verzió látva → az új verzió újra felugrik', async () => {
  writeLocalProgress({ fuel: { version: 0, seenAt: '2026-09-01T10:00:00.000Z', completedAt: null, dismissedAtStep: null } })
  renderAt('/fuel')
  flush()
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
})

test('kalauz nélküli route-on nincs felugrás és current null', () => {
  renderAt('/train')
  flush()
  expect(screen.getByTestId('current')).toHaveTextContent('-')
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('a kapcsolat-chip navigál, a kalauz completedAt-tal zár', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/fuel')
  flush()
  await screen.findByRole('dialog')
  await user.click(screen.getByRole('button', { name: '5. kártya' }))
  await user.click(screen.getByRole('button', { name: /^Edzés/ }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByTestId('current')).toHaveTextContent('-') // /train-en vagyunk
  expect(readLocalProgress().fuel?.completedAt).not.toBeNull()
})
```

- [ ] **Step 2: Futtatás — bukik**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/tutorial/TutorialProvider 2>&1 | tail -5
```

Expected: FAIL — modul nem található.

- [ ] **Step 3: `TutorialProvider.tsx`**

```tsx
// ============================================================
// Mezo · TutorialProvider — a Mezo-kalauz motorja (mezo-gb1s.1, spec §5–§7).
// Egy példány a shellben (AppLayout, a MezoThreadProvider mintája). Route-váltásra a
// registry-ből keres kalauzt; T1/T2 és nem-látott (verzió szerint) esetén az oldal belépő
// koreográfiája után (AUTO_DELAY_MS, reduced-motion alatt 0) megnyitja. „Látva" = MEGJELENT
// (Appcues modál-szabály): a seenAt a nyitáskor íródik, a Kihagyom/✕/Escape csak
// dismissedAtStep-et, az „Értem, kezdjük" completedAt-ot ad. Session-guard: egy kalauz egy
// app-sessionben legfeljebb egyszer ugrik fel magától (a backend-válasz késése ellen is).
// Írás-sorrend: localStorage + React-state azonnal → PUT a háttérben; PUT-hiba esetén a
// lokális marad az igazság. Beérkező szerver-állapot: merge (későbbi seenAt nyer), és ha a
// lokálisban több van, visszaírjuk — ez a „következő olvasásnál újrapróbál".
// ============================================================
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTutorialProgress, useTutorialProgressActions } from '@/data/hooks'
import type { TutorialProgress } from '@/data/types'
import { mergeProgress, readLocalProgress, writeLocalProgress } from '@/shared/lib/tutorialSeen'
import { KalauzSheet, type KalauzCloseReason } from '@/shared/ui/kalauz/KalauzSheet'
import { findKalauz, getKalauz, type KalauzEntry } from '@/features/tutorial/registry'

export const AUTO_DELAY_MS = 600

export interface TutorialContextValue {
  current: KalauzEntry | null
  openId: string | null
  open: (id: string) => void
  close: (reason: KalauzCloseReason, step: number) => void
  isUnseen: (id: string) => boolean
  resetAll: () => Promise<void>
}

const TutorialContext = createContext<TutorialContextValue | null>(null)

export function useTutorial(): TutorialContextValue {
  const v = useContext(TutorialContext)
  if (v === null) throw new Error('useTutorial: hiányzik a TutorialProvider')
  return v
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function TutorialProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { progress: serverProgress, isPending } = useTutorialProgress()
  const { setProgress, resetProgress } = useTutorialProgressActions()

  const [progress, setLocal] = useState<TutorialProgress>(() => readLocalProgress())
  const [openId, setOpenId] = useState<string | null>(null)
  const autoShown = useRef<Set<string>>(new Set())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // A lokális az igazság a PUT visszaérkezéséig; a szerver-állapot beolvad, a többlet visszaíródik.
  useEffect(() => {
    if (isPending) return
    setLocal((local) => {
      const merged = mergeProgress(serverProgress, local)
      writeLocalProgress(merged)
      const localOnly = Object.keys(merged).some((k) => !(k in serverProgress) || serverProgress[k].seenAt !== merged[k].seenAt)
      if (localOnly) void setProgress(merged).catch(() => undefined)
      return merged
    })
  }, [serverProgress, isPending, setProgress])

  const persist = useCallback((next: TutorialProgress) => {
    setLocal(next)
    writeLocalProgress(next)
    void setProgress(next).catch(() => undefined) // PUT-hiba: a lokális marad; a következő merge újrapróbál
  }, [setProgress])

  const isUnseen = useCallback((id: string) => {
    const e = getKalauz(id)
    if (!e) return false
    const p = progress[id]
    return !p || p.version < e.version
  }, [progress])

  const open = useCallback((id: string) => {
    const e = getKalauz(id)
    if (!e) return
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    setOpenId(id)
    // Látva = megjelent. Frissebb verzió esetén új rekord, completedAt/dismissedAtStep nullázva.
    const prev = progress[id]
    if (!prev || prev.version < e.version) {
      persist({ ...progress, [id]: { version: e.version, seenAt: new Date().toISOString(), completedAt: null, dismissedAtStep: null } })
    }
  }, [progress, persist])

  const close = useCallback((reason: KalauzCloseReason, step: number) => {
    if (openId === null) return
    const prev = progress[openId]
    if (prev) {
      persist({
        ...progress,
        [openId]: reason === 'done'
          ? { ...prev, completedAt: new Date().toISOString() }
          : { ...prev, dismissedAtStep: step },
      })
    }
    setOpenId(null)
  }, [openId, progress, persist])

  const resetAll = useCallback(async () => {
    autoShown.current.clear()
    setLocal({})
    writeLocalProgress({})
    await resetProgress().catch(() => undefined)
  }, [resetProgress])

  const current = useMemo(() => findKalauz(pathname), [pathname])

  // Route-váltás: nyitott kalauz zár (dismissed), és az új route auto-kalauza időzítve nyílik.
  useEffect(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    setOpenId((id) => {
      if (id !== null) {
        const prev = progress[id]
        if (prev && prev.completedAt === null && prev.dismissedAtStep === null) {
          persist({ ...progress, [id]: { ...prev, dismissedAtStep: 0 } })
        }
      }
      return null
    })
    if (!current || current.tier === 'T3') return
    if (autoShown.current.has(current.id) || !isUnseen(current.id)) return
    autoShown.current.add(current.id)
    const id = current.id
    timer.current = setTimeout(() => { timer.current = null; open(id) }, prefersReducedMotion() ? 0 : AUTO_DELAY_MS)
    return () => { if (timer.current) { clearTimeout(timer.current); timer.current = null } }
    // A `progress`/`open`/`isUnseen` szándékosan nincs a függőségek között: a döntés a
    // route-váltás PILLANATÁHOZ kötött, egy közbeni seen-frissítés nem indíthat új időzítőt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, current])

  const value = useMemo<TutorialContextValue>(
    () => ({ current, openId, open, close, isUnseen, resetAll }),
    [current, openId, open, close, isUnseen, resetAll],
  )
  const entry = openId ? getKalauz(openId) : null

  return (
    <TutorialContext.Provider value={value}>
      {children}
      {entry && (
        <KalauzSheet
          label={entry.label}
          cards={entry.cards}
          onClose={close}
          onNavigate={(to) => navigate(to)}
        />
      )}
    </TutorialContext.Provider>
  )
}
```

Ha a projekt ESLint-je az `exhaustive-deps` kikapcsolást nem engedi kommenttel, a `progress`/`open`/`isUnseen` legfrissebb értékét `useRef`-ben tükrözd (`const openRef = useRef(open); openRef.current = open` effekt nélkül) és a route-effekt a ref-eket olvassa — a viselkedés ugyanaz.

- [ ] **Step 4: Mount az `AppLayout`-ban**

`AppLayout.tsx` — import: `import { TutorialProvider } from '@/features/tutorial/TutorialProvider'`; a `MezoThreadProvider` köré (a `LevelUpProvider` alatt, hogy a LevelUp z 250 a kalauz sheet 200/201 fölött maradjon):

```tsx
          <LevelUpProvider>
            {/* Mezo-kalauz motor (mezo-gb1s.1): egy példány, route-váltásra dönt, a sheetet ide
                portálja (.phone-screen). A fejléc „?" gombja és a Beállítások ugyanezt a
                contextet hívja. */}
            <TutorialProvider>
              <MezoThreadProvider>
                …(változatlan)…
              </MezoThreadProvider>
            </TutorialProvider>
            {!hideChrome && <TabBar />}
```

A `TabBar`/`QuickLogFab`/`FloatingReturnLayer` maradnak a Provideren KÍVÜL (nem hívják), a sheet portálja úgyis a `.phone-screen`.

- [ ] **Step 5: Futtatás — zöld (mindkét mód), plus a shell-tesztek**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/tutorial src/app 2>&1 | tail -8 && VITE_USE_MOCK=false pnpm vitest run src/features/tutorial 2>&1 | tail -5
```

Expected: a Provider-tesztek zöldek. A `src/app` tesztek közül a `hubHeaders.test.tsx` `/fuel` esete ELBUKHAT, ha a sheet a `.nap-head button` számlálásba beleszól — nem szól bele (a sheet a `.phone-screen`-be portálódik, nem a `.nap-head`-be), de az AppLayout-ot renderelő teszteknél a `/fuel` most 600 ms után sheetet nyit; fake timer nélkül ez a teszt vége után történik. Ha bármelyik `src/app` teszt a felugrás miatt bukik, a Task 8 rendezi (seed „látva" a shell-tesztek `beforeEach`-ében).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/tutorial/TutorialProvider.tsx frontend/src/features/tutorial/TutorialProvider.test.tsx frontend/src/app/AppLayout.tsx
git commit -m "feat(tutorial): TutorialProvider — auto-felugrás, seen-on-open, session-guard, verzió-bump (mezo-gb1s.1)"
```

---

### Task 8: Fejléc „?" gomb + tesztek frissítése

**Files:**
- Modify: `frontend/src/app/AppHeader.tsx:77-83` (a dátum-eyebrow UTÁN, a napszak-váltó ELŐTT), `frontend/src/styles/prototype.css` (a `.nap-avatar` szabály után), `frontend/src/app/AppHeader.test.tsx:20-25,51-64`, `frontend/src/app/hubHeaders.test.tsx:7-8,30-39`

**Interfaces:**
- Consumes: `useTutorial()` (`current`, `openId`, `open`, `isUnseen`).
- Viselkedés: a „?" CSAK akkor renderel, ha a route-nak van registry-bejegyzése (honest state — nincs halott gomb); arany pont (`.nap-offnow`), ha `current.tier === 'T3' && isUnseen(current.id)`; nyitva → `.is-open`.

- [ ] **Step 1: Tesztek frissítése (előbb — bukjanak)**

`AppHeader.test.tsx` — a `renderAt` a `TutorialProvider`-t is beköti (a shell így teszi), a „négy kontroll" teszt a `/fuel`-ön öt gombot vár, elöl a Kalauzzal; új teszt a „?"-ra; a `beforeEach` a `/fuel` kalauzát látottnak seedeli, hogy a 600 ms-os felugrás ne zavarja a többi tesztet:

```tsx
import { TutorialProvider } from '@/features/tutorial/TutorialProvider'
import { writeLocalProgress } from '@/shared/lib/tutorialSeen'
// …
beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  localStorage.clear()
  // A Fuel hub kalauza (mezo-gb1s.1) 600 ms után magától felugrana — a fejléc-tesztek a
  // fejlécet nézik, ezért látottnak seedeljük; a „?" gomb saját tesztje explicit nyit.
  writeLocalProgress({ fuel: { version: 1, seenAt: '2026-08-30T10:00:00.000Z', completedAt: null, dismissedAtStep: null } })
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 7, 30, 13, 0, 0))
})
// …
const renderAt = (path: string, children?: React.ReactNode) =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[path]}>
        <TutorialProvider>
          <MezoThreadProvider>
            <AppHeader />
            {children}
            <LocationProbe />
          </MezoThreadProvider>
        </TutorialProvider>
      </MemoryRouter>
    </QueryWrapper>,
  )

test('a fejléc a kalauzos /fuel oldalon öt kontrollt visel, elöl a Kalauzzal', async () => {
  const { container } = renderAt('/fuel')
  expect(await screen.findByRole('button', { name: 'Kalauz ehhez az oldalhoz' })).toBeInTheDocument()
  const labels = [...container.querySelectorAll('.nap-head button')].map((b) => b.getAttribute('aria-label'))
  expect(labels[0]).toBe('Kalauz ehhez az oldalhoz')
  expect(labels[1]).toBe('Napszak váltása')
  expect(labels[2]).toMatch(/^Mezo üzenetei/)
  expect(labels[3]).toMatch(/^Értesítések/)
  expect(labels[4]).toBe('Profil')
})

test('kalauz nélküli oldalon nincs „?" gomb — a négy kontroll a régi sorrendben', async () => {
  const { container } = renderAt('/mezo')
  await screen.findByRole('button', { name: 'Napszak váltása' })
  expect(screen.queryByRole('button', { name: 'Kalauz ehhez az oldalhoz' })).toBeNull()
  const labels = [...container.querySelectorAll('.nap-head button')].map((b) => b.getAttribute('aria-label'))
  expect(labels[0]).toBe('Napszak váltása')
  expect(labels[3]).toBe('Profil')
})

test('a „?" megnyitja az oldal kalauzát, és nyitva az is-open osztályt viseli', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/fuel')
  const q = await screen.findByRole('button', { name: 'Kalauz ehhez az oldalhoz' })
  await user.click(q)
  expect(screen.getByRole('dialog', { name: 'Kalauz · Fuel' })).toBeInTheDocument()
  expect(q).toHaveClass('is-open')
})
```

A meglévő `'a fejléc mind a négy kontrollt viseli, ebben a sorrendben'` tesztet töröld (a két új teszt fedi). A többi teszt `/fuel`-ön a `Napszak váltása` nevű gombot keresi név szerint — az index-független, marad.

`hubHeaders.test.tsx`:

```tsx
import { writeLocalProgress } from '@/shared/lib/tutorialSeen'

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  localStorage.clear()
  writeLocalProgress({ fuel: { version: 1, seenAt: '2026-08-30T10:00:00.000Z', completedAt: null, dismissedAtStep: null } })
})
// …
test.each(['/nap', '/train', '/mezo', '/me'])('a %s tab-gyökér fejléce a négy alap-kontrollt viseli', (path) => {
  const { container } = renderAt(path)
  const labels = [...container.querySelectorAll('.nap-head button')].map((b) => b.getAttribute('aria-label'))
  expect(labels[0]).toBe('Napszak váltása')
  expect(labels[1]).toMatch(/^Mezo üzenetei/)
  expect(labels[2]).toMatch(/^Értesítések/)
  expect(labels[3]).toBe('Profil')
})

// mezo-gb1s.1: a kalauzos oldalon a „?" a gombsor elején — a többi négy változatlan sorrendben utána.
test('a /fuel fejléce elöl a Kalauz gombot viseli, utána a négy alap-kontrollt', () => {
  const { container } = renderAt('/fuel')
  const labels = [...container.querySelectorAll('.nap-head button')].map((b) => b.getAttribute('aria-label'))
  expect(labels[0]).toBe('Kalauz ehhez az oldalhoz')
  expect(labels.slice(1, 5)).toEqual([
    'Napszak váltása', expect.stringMatching(/^Mezo üzenetei/), expect.stringMatching(/^Értesítések/), 'Profil',
  ])
})
```

(A `test.each` listából a `/fuel` kikerül; a `PONTOSAN egy .nap-head` teszt mind az ötre marad.)

- [ ] **Step 2: Futtatás — bukik**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/app/AppHeader.test.tsx src/app/hubHeaders.test.tsx 2>&1 | tail -8
```

Expected: a „Kalauz" gombot kereső tesztek buknak.

- [ ] **Step 3: A gomb az `AppHeader`-ben**

Import: `import { useTutorial } from '@/features/tutorial/TutorialProvider'`. A komponensben:

```tsx
  const kalauz = useTutorial()
  const qUnseenDot = kalauz.current !== null && kalauz.current.tier === 'T3' && kalauz.isUnseen(kalauz.current.id)
```

A JSX-ben a `<div className="nap-head-grow">…</div>` UTÁN, a napszak-váltó `nap-dpwrap` ELŐTT:

```tsx
      {/* Mezo-kalauz (mezo-gb1s.1): az oldal kalauza — csak ott, ahol van (honest state).
          A gombsor BAL szélén, minden oldalon ugyanott; arany pont = T3 oldal még nem látott
          kalauzzal (T1/T2 magától felugrik, ott a pont fölösleges). */}
      {kalauz.current && (
        <button type="button" className={cn('nap-roundbtn', 'nap-q', kalauz.openId === kalauz.current.id && 'is-open')}
          aria-label="Kalauz ehhez az oldalhoz" aria-haspopup="dialog"
          onClick={() => { setDpOpen(false); setNtfOpen(false); kalauz.open(kalauz.current!.id) }}>
          <span className="nap-q-glyph" aria-hidden="true">?</span>
          {qUnseenDot && <span className="nap-offnow" aria-hidden="true" />}
        </button>
      )}
```

A fájl fejkommentjének sorrend-sora: `dátum-eyebrow · [kalauz ?] · napszakváltó · Mezo-üzenetek · értesítések · profil orb`.

CSS (`prototype.css`, a `.nap-avatar` után):

```css
/* Mezo-kalauz „?" (mezo-gb1s.1) — Fraunces-dőlt kérdőjel, coral; nyitva coral wash. */
.nap-q .nap-q-glyph { font-family: "Fraunces", Georgia, serif; font-style: italic; font-size: 19px; font-weight: 500; color: var(--primary-deep); line-height: 1; }
.nap-q.is-open { background: color-mix(in srgb, var(--primary-base) 14%, transparent); }
```

- [ ] **Step 4: Futtatás — zöld, mindkét mód, teljes `src/app`**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/app 2>&1 | tail -6 && VITE_USE_MOCK=false pnpm vitest run src/app 2>&1 | tail -6
```

Expected: zöld. Ha más `src/app` teszt (pl. `AppLayout`/router-teszt `/fuel`-t renderel) a felugrás miatt bukik: ugyanaz a `writeLocalProgress` seed a `beforeEach`-ébe.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/AppHeader.tsx frontend/src/app/AppHeader.test.tsx frontend/src/app/hubHeaders.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(header): kalauz „?" gomb a gombsor elején, T3 arany pont (mezo-gb1s.1)"
```

---

### Task 9: Fuel hub horgony + visual goldenek + teljes frontend kapu

**Files:**
- Modify: `frontend/src/features/fuel/pages/FuelMaiPage.tsx:132`, `frontend/tests/visual/visual.spec.ts:97`

- [ ] **Step 1: Horgony a Logolás hős-csempén**

`FuelMaiPage.tsx:132` — a wrapper div-re:

```tsx
        <div className="rise" style={{ '--d': '70ms' } as React.CSSProperties} data-kalauz-anchor="fuel-log">
```

- [ ] **Step 2: Golden init-script seed**

`visual.spec.ts:97` — a `mezo-theme` seed mellé a „minden látva" állapot (a kulcs és a forma a `tutorialSeen.ts`-ből, verbatim; Playwright kontextusban nem importálható, ezért literál):

```ts
        await page.addInitScript((t) => {
          localStorage.setItem('mezo-theme', t)
          // Mezo-kalauz (mezo-gb1s.1): a first-visit sheet minden goldenbe beleugrana — látottnak seedeljük.
          localStorage.setItem('mezo.kalauz.v1', JSON.stringify({
            fuel: { version: 1, seenAt: '2026-05-21T13:00:00.000Z', completedAt: null, dismissedAtStep: null },
          }))
        }, theme)
```

A `fuel-light.png`/`fuel-dark.png` golden a „?" gomb miatt VÁLTOZIK — ez várt; a Linux-baseline-t az `update-visual-baselines.yml` workflow frissíti a PR-en (lásd `docs/infrastructure/local-dev-testing.md`). A többi golden változatlan marad (ott nincs kalauz → nincs gomb).

- [ ] **Step 3: Fuel-oldali tesztek + teljes frontend kapu**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test 2>&1 | tail -6 && VITE_USE_MOCK=false pnpm test 2>&1 | tail -6 && pnpm build 2>&1 | tail -3
```

Expected: mindkét mód zöld, build OK. Ha egy Fuel-hub teszt (`FuelMaiPage.test.tsx`) az `AppLayout`-ot rendereli és 600 ms után felugró sheetet lát: seed a `beforeEach`-ben (`writeLocalProgress`), ahogy a Task 8.

- [ ] **Step 4: Futásidejű ellenőrzés mock módban**

A `verify` skill receptje szerint (build + launch + drive): `/fuel` első betöltés → 600 ms után a `Kalauz · Fuel` sheet; Tovább ×2 → „Mutasd meg" → a Logolás-csempe körül arany gyűrű, a sheet sáv; koppintás bárhova → sheet vissza; Kihagyom → zár; oldal-újratöltés → nem ugrik fel; „?" → nyit. Egy screenshot a peek-állapotról a PR-leírásba.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel/pages/FuelMaiPage.tsx frontend/tests/visual/visual.spec.ts
git commit -m "feat(fuel): kalauz-horgony a Logolás csempén + golden seed (mezo-gb1s.1)"
```

---

### Task 10: Dokumentáció, CODEMAP, PR

**Files:**
- Create: `docs/features/tutorial.md`
- Modify: `docs/features/today.md` (a „Five elements, left to right" bekezdés), `docs/CODEMAP.md` (generált)

- [ ] **Step 1: `docs/features/tutorial.md`** — a 10-szakaszos sablon (`docs/features/README.md` §5) szerint, angolul, HU címkék verbatim. Frontmatter:

```markdown
---
title: Mezo-kalauz (in-app page guides)
type: feature
status: mixed
updated: 2026-09-02
tags: [tutorial, onboarding, frontend, backend]
key_files:
  - frontend/src/features/tutorial
  - frontend/src/shared/ui/kalauz
  - frontend/src/shared/lib/tutorialSeen.ts
  - frontend/src/data/tutorial
  - backend/src/main/java/io/mrkuhne/mezo/feature/tutorial
  - api/feature/tutorial/tutorial-progress.yml
related: [today, fuel, _platform-design-system, _platform-data-layer, _platform-auth-security]
---
```

Tartalmi kötelezők szakaszonként: §1 a spec linkje + státusz (S1: egy kalauz, `fuel`; T0/T2/T3 a következő szeletek, bd `mezo-gb1s`); §2 a felugrás, a „?", a peek, a Kihagyom/Értem különbség; §3 a `TutorialProvider → registry → useTutorialProgress ⇄ tutorialSeen → KalauzSheet` folyam + az írás-sorrend; §4 a `tutorial_progress` tábla, a 3 endpoint, a `TutorialProgressEntry` alak; §5 seams: `AppHeader` (a „?"), `AppLayout` (mount), Fuel (`data-kalauz-anchor="fuel-log"`), auth (`created_by` seam — a multi-user session cseréli; a localStorage-kulcs `mezo.kalauz.v1` user-id nélkül, ez a multi-user szelet dolga); §6 `useTutorial()` + `useTutorialProgress()`; §7 „új kalauz felvétele" recept (registry-fájl + `KALAUZ_REGISTRY` + horgony + hang-lint); §8 a tesztek listája + a golden-seed + a `setup.ts` kulcs-ürítés; §9 döntések (D1–D11 hivatkozás a specre), gotchák (seen = megjelent; `.is-peek` `animation: none` — a `sheet-rise` `both` fill különben felülírja a transformot; a „?" csak registry-találatnál renderel; a header-tesztek index szerint); §10 kulcsfájlok.

- [ ] **Step 2: `today.md` fejléc-szakasz**

A „Five elements, left to right:" bekezdés → „Six elements (the guide button only where the route has a guide), left to right:", és a lista ELÉ új 1. pont:

```markdown
1. **Kalauz „?"** — `.nap-roundbtn.nap-q`, rendered **only when the route has a registry entry** (`findKalauz(pathname)`, `frontend/src/features/tutorial/registry`), always the first button so the daypart switch's presence never shifts it. Opens the page's guide through `useTutorial().open(id)`; carries the `.nap-offnow` amber dot when the route is a T3 guide not yet seen. See [`tutorial.md`](tutorial.md).
```

(A többi pont sorszáma 2–6-ra tolódik.)

- [ ] **Step 3: CODEMAP + docs-lint**

```bash
node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check && node scripts/lint-docs.mjs --errors-only 2>&1 | tail -4
```

Expected: `--check` csendes; lint `✗ 0 error`. A CODEMAP-ban megjelenik a `tutorial` feature-blokk a `tutorial.md`-hez kötve.

- [ ] **Step 4: Commit + push + PR**

```bash
git add docs/features/tutorial.md docs/features/today.md docs/CODEMAP.md
git commit -m "docs(tutorial): Mezo-kalauz feature doc, fejléc hat eleme, CODEMAP (mezo-gb1s.1)"
git pull --rebase && bd dolt push && git push
gh pr create --title "feat(tutorial): Mezo-kalauz S1 — motor + fejléc ? + seen-store, a Fuel hub kalauzával (mezo-gb1s.1)" --body-file - <<'EOF'
## Mi ez
A Mezo-kalauz (spec `docs/superpowers/specs/2026-09-02-mezo-kalauz-tutorial-design.md`) első szelete: per-user seen-store (`tutorial_progress`, GET ghost / PUT replace / DELETE reset), `TutorialProvider` a shellben (auto-felugrás T1/T2-n, seen = megjelent, session-guard, verzió-bump), `KalauzSheet` (öt kártya-típus, fogalom-doboz, kapcsolat-chipek, egy-elemes spotlight peek), fejléc „?" gomb, és az egyetlen valós kalauz: a Fuel hub.

## Kalauz-szöveg (review-ra)
| # | Kérdés | Cím | Szöveg |
|---|---|---|---|
| 1 | Mi ez? | Ez a Fuel. | Itt követjük, hogy mit eszel. Nem diéta és nem számolgatás — inkább térkép: mennyi energia ment be ma, és mennyi fér még. |
| 2 | Mire jó? | A napi keret és a makrók. | A tested minden nap kap egy keretet — ennyi energia fér bele. A gyűrű fent mutatja, hol tartunk. · makró: A három „építőanyag": fehérje (izom), szénhidrát (üzemanyag), zsír (hormonok). A kalória ezekből adódik össze. |
| 3 | Hogyan? | Logolni egy koppintás. | A + gombbal vagy a Logolás-csempéből. Elég egy fotó vagy egy mondat — „egy tál zabkása banánnal" — a többit Mezo kitalálja. |
| 4 | Mikor? | Evés után, pár másodperc. | Nem szükséges tökéletesnek lennie. Ha kimaradt egy étkezés, később is pótoljuk — a nap ettől nem lesz kevesebb. |
| 5 | Mivel függ össze? | Nem sziget. | Edzésnapon több keret jár. A súlyod és az alvásod is innen kap adatot — és a chatben Mezo ebből tud tanácsot adni. |

## Kapuk
- FE: `VITE_USE_MOCK=true pnpm test` ✅ · `VITE_USE_MOCK=false pnpm test` ✅ · `pnpm build` ✅
- BE: `./mvnw clean test -Dmezo.test.use-testcontainers=true` ✅ (ArchUnit is)
- Golden: `fuel-{light,dark}.png` változik a „?" gomb miatt → baseline-frissítés a workflow-val.

## Nyitott (spec §13)
1. Napszak-váltó minden oldalon (kód) vs Nap-only (design) — a kalauz-szöveg a designt mondja.
2. localStorage-kulcs user-id nélkül (`mezo.kalauz.v1`) — a multi-user szelet prefixeli.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

- [ ] **Step 5: CI zöld → lokális `--no-ff` merge → push → branch törlés → bd close**

```bash
gh pr checks --watch
git checkout main && git pull --rebase && git merge --no-ff claude/in-app-tutorial-system-0f3d62 -m "Merge claude/in-app-tutorial-system-0f3d62: Mezo-kalauz S1 — motor + fejléc ? + seen-store (mezo-gb1s.1)" && git push && git branch -d claude/in-app-tutorial-system-0f3d62 && git push origin --delete claude/in-app-tutorial-system-0f3d62
bd close mezo-gb1s.1 --reason "S1 merged: motor + ? + seen-store, Fuel hub kalauz"
bd dolt push
```

Worktree-ben: a `main`-re váltás a fő checkoutban él — a merge-lépést a fő repóból futtasd (ez az egyetlen eset, amikor a fő checkout kell), vagy `git -C <főrepó> …`-val. Utána a következő szelet (S2: első indítás + hubok) új branchet kap.

---

## Self-review (a spec ellen)

- **§4 UX-nyelv** → Task 6 (anatómia, öt kártya-típus, peek, Vissza/Tovább, pöttyök), Task 8 („?" állapotok: alap / arany pont / nyitva). A T0 welcome nem S1 (S2).
- **§5 architektúra** → Task 5 (registry), Task 6 (KalauzSheet, `shared/ui`, nem importál `@/data`), Task 7 (Provider, AppLayout-mount, context API a spec szerinti névvel: `current, open, close, isUnseen, resetAll` + `openId`), Task 8 (fejléc). A chrome-mentes oldalak mini „?"-ja S3 (az aktív edzés kalauza ott jön).
- **§6 adatmodell/API** → Task 1–3 (GET ghost / PUT replace / DELETE; jsonb; FuelSettings-recept; `realStaleTime`; MSW). Írás-sorrend és PUT/GET-hiba kezelés → Task 7 (`persist`, merge-effekt).
- **§7 trigger** → Task 7: 1–3, 5–7 tesztelve (késleltetés, seen-on-open, dismissed/completed, session-guard, verzió-bump, route-váltás zár); 4 (T0) S2.
- **§8 tartalom** → Task 5 (típusos kártyák, Fuel registry, hang-lint). `fogalmak.ts` közös szótár S2-ben jön, amikor a második fogalom megjelenik (YAGNI most).
- **§9 tesztelés** → Task 3–9 + golden seed + `setup.ts` ürítés + header-index tesztek + docs (Task 10).
- **Típus-konzisztencia:** `KalauzSheetCard` (shared) ≡ `KalauzCard` (features) szerkezetileg — a Provider `entry.cards`-ot ad át, a TS strukturális típusolása miatt fordul. `onClose(reason, step)` mindenhol `('skip'|'done', number)`. A hook-nevek (`useTutorialProgress`, `useTutorialProgressActions`, `setProgress`, `resetProgress`) a Task 3 és 7 között egyeznek. A seen-kulcs `mezo.kalauz.v1` a Task 4, a `setup.ts` prefix-ürítés és a golden seed között egyezik.
- **Placeholder-ellenőrzés:** nincs TBD/TODO; a két „ha a generátor mást ad" megjegyzés (Task 2 Step 6/7, Task 6 Step 4) konkrét alternatívát ad, nem nyitott kérdést.
