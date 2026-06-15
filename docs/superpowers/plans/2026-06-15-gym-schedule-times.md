# Weekly Gym Times + Time-Ordered Mai Agenda — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user set a recurring weekly gym time per weekday (standalone, persists across mesocycles), and make the **Mai** agenda order each day's sessions by time-of-day with every session's time shown.

**Architecture:** New `GymScheduleSlot` aggregate (weekday→time) mirroring `SportScheduleSlot` but lean (only `dayOfWeek` + `time`). `deriveGymSchedule` joins the active mesocycle's gym days (what) with the gym slots (when) by weekday. A pure `daySessions` helper sorts each day's gym/volleyball/running items by time; both the weekly rows (`WeeklyDayRow`) and today's hero cards (`TrainTodayView`) render in that order.

**Tech Stack:** Spring Boot 4 / Java 21 / Maven / Liquibase / Postgres / MapStruct · React 19 / Vite / TanStack Query / Vitest · OpenAPI contract-first.

**Spec:** `docs/superpowers/specs/2026-06-15-gym-schedule-times-design.md` · **Driving bd:** mezo-auk

**House standards (read before the matching task):** `docs/references/{api_contract_conventions,liquibase_conventions,spring_patterns,integration_test_framework,testing_standards}.md`. Reference implementations to mirror are named per task.

---

## File Structure

**Backend (new):**
- `api/feature/train/train.yml` — add `GymScheduleSlotResponse`/`Input` + `GET/PUT /api/train/gym-schedule` (mirror the `sport-schedule` block).
- `backend/src/main/resources/db/changelog/changesets/{ts}_mezo-auk_create_gym_schedule_slot.sql`
- `backend/.../feature/train/entity/GymScheduleSlotEntity.java`
- `backend/.../feature/train/repository/GymScheduleSlotRepository.java`
- `backend/.../feature/train/service/GymScheduleService.java`
- `backend/.../feature/train/mapper/TrainMapper.java` — add `toGymSlotResponse` (modify)
- `backend/.../feature/train/controller/TrainController.java` — implement `getGymSchedule`/`putGymSchedule` (modify)
- `backend/src/test/.../support/populator/GymSchedulePopulator.java`
- `backend/src/test/.../support/ResetDatabase.java` — add `gym_schedule_slot` to TRUNCATE (modify)
- `backend/src/test/.../feature/train/GymScheduleContractIT.java`

**Frontend (new/modified):**
- `frontend/src/lib/trainApi.ts` — add `gymSchedule()` + `replaceGymSchedule()` + types (modify)
- `frontend/src/data/types.ts` — add `GymScheduleSlot` (modify)
- `frontend/src/data/train.ts` — mock gym slots (modify)
- `frontend/src/data/trainHooks.ts` — fetch slots, `saveGymSchedule`, `deriveGymSchedule(meso, slots)` (modify)
- `frontend/src/features/train/components/GymScheduleSheet.tsx` (new)
- `frontend/src/features/train/views/GymView.tsx` — "Időpontok" entry chip (modify)
- `frontend/src/features/train/agenda.ts` — `daySessions` ordering helper (new)
- `frontend/src/features/train/components/WeeklyDayRow.tsx` — render sorted items + running time (modify)
- `frontend/src/features/train/views/TrainTodayView.tsx` — order today heroes by time (modify)

---

## Task 1: API contract — gym-schedule paths + DTOs

**Files:**
- Modify: `api/feature/train/train.yml`

Mirror the existing `sport-schedule` block. Reference: `train.yml:260-310` (paths) and `:1333-1395` (`SportScheduleSlotInput`/`Response`). The gym DTOs drop the volleyball-only fields — keep only `dayOfWeek` + `time`.

- [ ] **Step 1: Add the two schemas** next to the Sport ones (after `SportScheduleSlotResponse`):

```yaml
    GymScheduleSlotResponse:
      type: object
      required: [id, dayOfWeek, time]
      properties:
        id:
          type: string
          format: uuid
        dayOfWeek:
          type: integer
          minimum: 0
          maximum: 6
          description: "0=Hét .. 6=Vas"
        time:
          type: string
          pattern: '^\d{2}:\d{2}$'
          description: "HH:mm"
    GymScheduleSlotInput:
      type: object
      required: [dayOfWeek, time]
      properties:
        dayOfWeek:
          type: integer
          minimum: 0
          maximum: 6
        time:
          type: string
          pattern: '^\d{2}:\d{2}$'
```

- [ ] **Step 2: Add the path** (mirror `/api/train/sport-schedule`, same `tags: [Train]`, `operationId` `getGymSchedule`/`putGymSchedule`):

```yaml
  /api/train/gym-schedule:
    get:
      tags: [Train]
      operationId: getGymSchedule
      responses:
        '200':
          description: Weekly gym time slots
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/GymScheduleSlotResponse'
    put:
      tags: [Train]
      operationId: putGymSchedule
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: '#/components/schemas/GymScheduleSlotInput'
      responses:
        '200':
          description: Replaced gym schedule
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/GymScheduleSlotResponse'
```

- [ ] **Step 3: Merge + regenerate**

Run: `cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api`
Expected: `api/openapi.yml` and `frontend/src/lib/api.gen.ts` updated; the strings `GymScheduleSlotResponse` and `getGymSchedule` now appear in both. Backend Java DTOs regenerate on the next Maven build.

- [ ] **Step 4: Commit**

```bash
git add api/feature/train/train.yml api/openapi.yml frontend/src/lib/api.gen.ts
git commit -m "feat(api): gym-schedule contract (GET/PUT weekly slots) (mezo-auk)"
```

---

## Task 2: Liquibase migration — `gym_schedule_slot`

**Files:**
- Create: `backend/src/main/resources/db/changelog/changesets/{ts}_mezo-auk_create_gym_schedule_slot.sql`
  (`{ts}` = 12-digit UTC `YYYYMMDDHHMM`; register it in the master changelog the same way the
  `sport_schedule_slot` changeset is registered — find it: `grep -rl sport_schedule_slot backend/src/main/resources/db/changelog`.)

Reference the `sport_schedule_slot` changeset for the exact column/constraint idiom. House rule: explicit constraint names, `created_by`/`is_deleted`/`created_at` ownership columns, UUID PK.

- [ ] **Step 1: Write the changeset** (adjust the `--changeset` author/id line to match the file's siblings):

```sql
--liquibase formatted sql
--changeset mezo:202606151500_mezo-auk_create_gym_schedule_slot
CREATE TABLE gym_schedule_slot (
    id          uuid        NOT NULL DEFAULT gen_random_uuid(),
    created_by  uuid        NOT NULL,
    is_deleted  boolean     NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now(),
    day_of_week integer     NOT NULL,
    time        varchar(5)  NOT NULL,
    CONSTRAINT pk_gym_schedule_slot PRIMARY KEY (id),
    CONSTRAINT fk_gym_schedule_slot_created_by FOREIGN KEY (created_by) REFERENCES app_user (id) ON DELETE CASCADE,
    CONSTRAINT ck_gym_schedule_slot_day_of_week CHECK (day_of_week BETWEEN 0 AND 6),
    CONSTRAINT uq_gym_schedule_slot_created_by_day_of_week UNIQUE (created_by, day_of_week)
);
CREATE INDEX idx_gym_schedule_slot_created_by ON gym_schedule_slot (created_by);
```

> Verify the FK target table name (`app_user`) and the ownership column set against the
> `sport_schedule_slot` changeset — copy whatever it does exactly so the two tables match.

- [ ] **Step 2: Verify it applies** — start the app once (or run an IT). With Testcontainers:

Run: `cd backend && ./mvnw -q clean test -Dtest=SportContractIT -Dmezo.test.use-testcontainers=true`
Expected: BUILD SUCCESS (Liquibase applies all changesets including the new one on the fresh container).

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/resources/db/changelog
git commit -m "feat(db): gym_schedule_slot table (mezo-auk)"
```

---

## Task 3: Entity + Repository

**Files:**
- Create: `backend/.../feature/train/entity/GymScheduleSlotEntity.java`
- Create: `backend/.../feature/train/repository/GymScheduleSlotRepository.java`

Mirror `SportScheduleSlotEntity.java` (extends `OwnedEntity`, `@SQLDelete`/`@SQLRestriction` come from the superclass) and `SportScheduleSlotRepository.java`, **dropping** `durationMin`, `kind`, `location`, `intensityLabel`.

- [ ] **Step 1: Write the entity** (copy `SportScheduleSlotEntity`'s annotations/imports; keep only these two domain fields):

```java
@Entity
@Table(name = "gym_schedule_slot")
@Getter
@Setter
public class GymScheduleSlotEntity extends OwnedEntity {

    @NotNull
    @Column(name = "day_of_week", nullable = false)
    private Integer dayOfWeek; // 0=Hét .. 6=Vas (DB CHECK)

    @NotNull
    @Column(nullable = false, length = 5)
    private String time; // HH:mm
}
```

> Match the exact class-level annotations of `SportScheduleSlotEntity` (it may also carry
> `@SQLDelete`/`@SQLRestriction`/`@Id`-in-superclass). Copy them verbatim; only the table name and
> the field set differ.

- [ ] **Step 2: Write the repository:**

```java
public interface GymScheduleSlotRepository extends JpaRepository<GymScheduleSlotEntity, UUID> {

    List<GymScheduleSlotEntity> findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(UUID createdBy);
}
```

- [ ] **Step 3: Compile**

Run: `cd backend && ./mvnw -q clean compile`
Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/GymScheduleSlotEntity.java backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/GymScheduleSlotRepository.java
git commit -m "feat(train): GymScheduleSlot entity + repository (mezo-auk)"
```

---

## Task 4: Test infra — populator + ResetDatabase

**Files:**
- Create: `backend/src/test/.../support/populator/GymSchedulePopulator.java`
- Modify: `backend/src/test/.../support/ResetDatabase.java`

- [ ] **Step 1: Add `gym_schedule_slot` to the TRUNCATE list** (`ResetDatabase.java:39-41`):

```java
"TRUNCATE TABLE weight_log, sleep_log, check_in, "
    + "gym_schedule_slot, sport_schedule_slot, sport_session, run_session_log, running_block CASCADE"
```
(Insert `gym_schedule_slot, ` — keep every existing table.)

- [ ] **Step 2: Write the populator** (mirror `RunningPopulator` style — `@TestComponent`, `saveAndFlush`):

```java
@TestComponent
@RequiredArgsConstructor
public class GymSchedulePopulator {

    private final GymScheduleSlotRepository repository;

    public GymScheduleSlotEntity createSlot(UUID createdBy, int dayOfWeek, String time) {
        GymScheduleSlotEntity e = new GymScheduleSlotEntity();
        e.setCreatedBy(createdBy);
        e.setDayOfWeek(dayOfWeek);
        e.setTime(time);
        return repository.saveAndFlush(e);
    }
}
```

- [ ] **Step 3: Register the populator** if the test harness `@Import`s populators explicitly
  (it does — see `AbstractIntegrationTest` `@Import({...})`). Add `GymSchedulePopulator.class` to that list **only if** sibling populators are imported there; otherwise it is `@Autowired` per-IT (mirror how `RunningPopulator` is wired in `RunningContractIT`).

- [ ] **Step 4: Compile tests**

Run: `cd backend && ./mvnw -q clean test-compile`
Expected: BUILD SUCCESS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/test
git commit -m "test(train): GymSchedulePopulator + reset truncate (mezo-auk)"
```

---

## Task 5: GymScheduleService (TDD via contract IT seam) + Mapper

**Files:**
- Create: `backend/.../feature/train/service/GymScheduleService.java`
- Modify: `backend/.../feature/train/mapper/TrainMapper.java`
- Create: `backend/src/test/.../feature/train/GymScheduleContractIT.java`

Service mirrors `SportService.getSchedule`/`replaceSchedule` (`SportService.java:55-81`): full-replace = delete owner's current slots then insert. Mapper adds `toGymSlotResponse` (MapStruct auto-maps `id`/`dayOfWeek`/`time`).

- [ ] **Step 1: Write the failing IT** (`ApiIntegrationTest`, mirror `SportContractIT`):

```java
class GymScheduleContractIT extends ApiIntegrationTest {

    private static final String SCHEDULE = "/api/train/gym-schedule";

    @Test
    void testGetGymSchedule_shouldReturnEmpty_whenNoneSet() {
        var slots = getForList(SCHEDULE, ownerAuthHeaders(), HttpStatus.OK, GymScheduleSlotResponse.class);
        assertThat(slots).isEmpty();
    }

    @Test
    void testPutGymSchedule_shouldReplaceAll_andReturnOrdered() {
        HttpHeaders auth = ownerAuthHeaders();
        var body = List.of(
            GymScheduleSlotInput.builder().dayOfWeek(3).time("18:30").build(),
            GymScheduleSlotInput.builder().dayOfWeek(1).time("18:30").build());
        var put = putForBody(SCHEDULE, body, auth, HttpStatus.OK,
            new ParameterizedTypeReference<List<GymScheduleSlotResponse>>() {});
        assertThat(put).extracting(GymScheduleSlotResponse::getDayOfWeek).containsExactly(1, 3);

        // PUT again replaces (no accumulation)
        putForBody(SCHEDULE, List.of(GymScheduleSlotInput.builder().dayOfWeek(5).time("09:00").build()),
            auth, HttpStatus.OK, new ParameterizedTypeReference<List<GymScheduleSlotResponse>>() {});
        var after = getForList(SCHEDULE, auth, HttpStatus.OK, GymScheduleSlotResponse.class);
        assertThat(after).singleElement()
            .satisfies(s -> { assertThat(s.getDayOfWeek()).isEqualTo(5); assertThat(s.getTime()).isEqualTo("09:00"); });
    }
}
```

> Use whichever PUT helper `SportContractIT` uses for a list body (`putForBody` with a
> `ParameterizedTypeReference`, or a `putForList` helper). Match its exact signature.

- [ ] **Step 2: Run it — verify it fails**

Run: `cd backend && ./mvnw -q clean test -Dtest=GymScheduleContractIT -Dmezo.test.use-testcontainers=true`
Expected: FAIL/ERROR — `getGymSchedule`/`putGymSchedule` not implemented on the controller (404 or unimplemented).

- [ ] **Step 3: Add the mapper method** (`TrainMapper.java`, beside `toSlotResponse`):

```java
SportScheduleSlotResponse toSlotResponse(SportScheduleSlotEntity entity);
GymScheduleSlotResponse toGymSlotResponse(GymScheduleSlotEntity entity); // <- add
```
(Add the `import io.mrkuhne.mezo.api.dto.GymScheduleSlotResponse;` and the entity import.)

- [ ] **Step 4: Write the service** (mirror `SportService.replaceSchedule`):

```java
@Service
@RequiredArgsConstructor
public class GymScheduleService {

    private final GymScheduleSlotRepository slotRepository;
    private final TrainMapper mapper;

    public List<GymScheduleSlotResponse> getSchedule(UUID createdBy) {
        return slotRepository.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(createdBy)
            .stream().map(mapper::toGymSlotResponse).toList();
    }

    @Transactional
    public List<GymScheduleSlotResponse> replaceSchedule(UUID createdBy, List<GymScheduleSlotInput> inputs) {
        slotRepository.deleteAll(
            slotRepository.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(createdBy));
        List<GymScheduleSlotEntity> fresh = new ArrayList<>(inputs.size());
        for (GymScheduleSlotInput in : inputs) {
            GymScheduleSlotEntity s = new GymScheduleSlotEntity();
            s.setCreatedBy(createdBy);
            s.setDayOfWeek(in.getDayOfWeek());
            s.setTime(in.getTime());
            fresh.add(slotRepository.save(s));
        }
        fresh.sort(Comparator.comparing(GymScheduleSlotEntity::getDayOfWeek)
            .thenComparing(GymScheduleSlotEntity::getTime));
        return fresh.stream().map(mapper::toGymSlotResponse).toList();
    }
}
```

- [ ] **Step 5: Wire the controller** (`TrainController.java`, mirror `getSportSchedule`/`putSportSchedule` at `:94-100`). Inject `GymScheduleService gymScheduleService` via the constructor (already `@RequiredArgsConstructor`), then:

```java
@Override
public List<GymScheduleSlotResponse> getGymSchedule() {
    return gymScheduleService.getSchedule(currentUserId.get());
}

@Override
public List<GymScheduleSlotResponse> putGymSchedule(List<GymScheduleSlotInput> gymScheduleSlotInput) {
    return gymScheduleService.replaceSchedule(currentUserId.get(), gymScheduleSlotInput);
}
```
(Confirm the generated method names/param names from the regenerated `TrainApi` interface.)

- [ ] **Step 6: Run the IT — verify it passes**

Run: `cd backend && ./mvnw -q clean test -Dtest=GymScheduleContractIT -Dmezo.test.use-testcontainers=true`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add backend/src/main backend/src/test/java/io/mrkuhne/mezo/feature/train/GymScheduleContractIT.java
git commit -m "feat(train): gym-schedule service+controller, replace-all weekly slots (mezo-auk)"
```

---

## Task 6: Frontend client + type

**Files:**
- Modify: `frontend/src/lib/trainApi.ts`
- Modify: `frontend/src/data/types.ts`

- [ ] **Step 1: Add the generated-type re-exports + client methods** (`trainApi.ts`, mirror `sportSchedule`/`replaceSportSchedule` at `:57-60`):

```ts
export type GymScheduleSlotInput = components['schemas']['GymScheduleSlotInput']
export type GymScheduleSlotResponse = components['schemas']['GymScheduleSlotResponse']
```
and inside the `trainApi` object:
```ts
  gymSchedule: (): Promise<GymScheduleSlotResponse[]> =>
    apiFetch<GymScheduleSlotResponse[]>('/api/train/gym-schedule'),
  replaceGymSchedule: (body: GymScheduleSlotInput[]): Promise<GymScheduleSlotResponse[]> =>
    apiFetch<GymScheduleSlotResponse[]>('/api/train/gym-schedule', { method: 'PUT', body: JSON.stringify(body) }),
```

- [ ] **Step 2: Add the domain type** (`types.ts`, near `GymScheduleDay`):

```ts
export interface GymScheduleSlot { dayOfWeek: number; time: string }
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && pnpm build`
Expected: build OK (types resolve; `api.gen.ts` already has the schemas from Task 1).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/trainApi.ts frontend/src/data/types.ts
git commit -m "feat(train-fe): gym-schedule API client + GymScheduleSlot type (mezo-auk)"
```

---

## Task 7: deriveGymSchedule join (TDD)

**Files:**
- Modify: `frontend/src/data/trainHooks.ts:62-74` (`deriveGymSchedule`)
- Test: `frontend/src/data/trainHooks.deriveGym.test.ts` (new)

Change the signature to take the gym slots and fill `time` from the weekday-matching slot instead of the hardcoded `null`. `DAY_ORDER` is index 0=Hét..6=Vas (matches `GymScheduleSlot.dayOfWeek`).

- [ ] **Step 1: Write the failing test:**

```ts
import { expect, test } from 'vitest'
import { deriveGymSchedule } from './trainHooks'
import type { Mesocycle } from './types'

const meso = (days: { day: string; exerciseCount: number; type: string }[]) =>
  ({ days } as unknown as Mesocycle)

test('deriveGymSchedule fills a gym day time from the matching weekday slot', () => {
  // Kedd (index 1) has a gym day + a 18:30 slot
  const sched = deriveGymSchedule(
    meso([{ day: 'Kedd', exerciseCount: 4, type: 'Plyo Power' }]),
    [{ dayOfWeek: 1, time: '18:30' }],
  )
  const kedd = sched!.weeklyTimes.find((w) => w.day === 'Kedd')!
  expect(kedd.active).toBe(true)
  expect(kedd.time).toBe('18:30')
})

test('deriveGymSchedule leaves time null when no slot matches the gym day', () => {
  const sched = deriveGymSchedule(meso([{ day: 'Kedd', exerciseCount: 4, type: 'Plyo Power' }]), [])
  expect(sched!.weeklyTimes.find((w) => w.day === 'Kedd')!.time).toBeNull()
})

test('deriveGymSchedule ignores a slot whose weekday has no gym day', () => {
  const sched = deriveGymSchedule(meso([{ day: 'Kedd', exerciseCount: 4, type: 'Plyo Power' }]),
    [{ dayOfWeek: 2, time: '07:00' }]) // Sze slot, no Sze gym day
  expect(sched!.weeklyTimes.find((w) => w.day === 'Sze')!.active).toBe(false)
})
```

- [ ] **Step 2: Run it — verify it fails**

Run: `cd frontend && pnpm test -- src/data/trainHooks.deriveGym.test.ts`
Expected: FAIL — `deriveGymSchedule` is not exported / wrong arity.

- [ ] **Step 3: Implement** — export the function and add the slot join (`trainHooks.ts`):

```ts
export function deriveGymSchedule(meso: Mesocycle | null, slots: GymScheduleSlot[] = []): GymSchedule | null {
  const days = meso?.days
  if (!days?.length) return null
  const todayLabel = DAY_ORDER[(new Date().getDay() + 6) % 7]
  const timeFor = (dayLabel: string): string | null => {
    const idx = DAY_ORDER.indexOf(dayLabel)
    return slots.find((s) => s.dayOfWeek === idx)?.time ?? null
  }
  return {
    weeklyTimes: DAY_ORDER.map((d) => {
      const md = days.find((x) => x.day === d && x.exerciseCount > 0)
      return md
        ? { day: d, type: md.type, time: timeFor(d), duration: null, active: true, today: d === todayLabel }
        : { day: d, type: null, time: null, duration: null, active: false }
    }),
  }
}
```
Add `import type { GymScheduleSlot } from './types'` (or extend the existing types import).

- [ ] **Step 4: Run — verify it passes**

Run: `cd frontend && pnpm test -- src/data/trainHooks.deriveGym.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data/trainHooks.ts frontend/src/data/trainHooks.deriveGym.test.ts
git commit -m "feat(train-fe): deriveGymSchedule joins weekday gym slots (mezo-auk)"
```

---

## Task 8: Hook wiring — fetch slots + saveGymSchedule + mock

**Files:**
- Modify: `frontend/src/data/trainHooks.ts` (query + mutation + pass slots into `deriveGymSchedule`)
- Modify: `frontend/src/data/train.ts` (mock slots constant)

Mirror the sport-schedule query (`trainHooks.ts:217-220`) and `sportScheduleMutation` (`:301-304`).

- [ ] **Step 1: Add a mock constant** (`train.ts`):

```ts
export const gymScheduleMock: { dayOfWeek: number; time: string }[] = [
  { dayOfWeek: 1, time: '18:30' }, // Kedd
  { dayOfWeek: 3, time: '18:30' }, // Csü
]
```

- [ ] **Step 2: Add the query + mutation + thread slots in** (`trainHooks.ts`): a `['train','gymSchedule']` query (`mock ? gymScheduleMock : trainApi.gymSchedule()` mapped to `GymScheduleSlot[]`), then `gymSchedule: mock ? trainGymSchedule : deriveGymSchedule(realActiveMeso, gymSlots)` at `:360`, and a `saveGymSchedule(slots, opts)` mutation mirroring `saveSportSchedule` (real → `trainApi.replaceGymSchedule` + invalidate `['train','gymSchedule']`; mock → no-op resolve). Add `saveGymSchedule` to the hook's return type interface beside `saveSportSchedule:194`.

- [ ] **Step 3: Typecheck + existing tests**

Run: `cd frontend && pnpm build && pnpm test -- src/data`
Expected: build OK; data tests pass (both modes covered later in Task 12).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/data/trainHooks.ts frontend/src/data/train.ts
git commit -m "feat(train-fe): fetch gym slots + saveGymSchedule, wire into gymSchedule (mezo-auk)"
```

---

## Task 9: GymScheduleSheet + GymView entry (TDD)

**Files:**
- Create: `frontend/src/features/train/components/GymScheduleSheet.tsx`
- Modify: `frontend/src/features/train/views/GymView.tsx`
- Test: `frontend/src/features/train/components/GymScheduleSheet.test.tsx` (new)

Mirror `SportScheduleSheet.tsx` (a `Sheet` with one row per weekday). Gym needs only a **time** input per weekday (a `type="time"` input, font-size ≥16px). An empty time = no slot for that day. On save, build `GymScheduleSlotInput[]` from the rows with a time and call `saveGymSchedule`.

- [ ] **Step 1: Write the failing test:**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { GymScheduleSheet } from './GymScheduleSheet'

test('saves a slot per weekday that has a time', async () => {
  const onSave = vi.fn()
  render(<GymScheduleSheet slots={[]} onClose={() => {}} onSave={onSave} />)
  // set Kedd (index 1) to 18:30
  const inputs = screen.getAllByLabelText(/időpont/i)
  await userEvent.type(inputs[1], '18:30')
  await userEvent.click(screen.getByRole('button', { name: /mentés/i }))
  expect(onSave).toHaveBeenCalledWith([{ dayOfWeek: 1, time: '18:30' }])
})
```

- [ ] **Step 2: Run — verify it fails**

Run: `cd frontend && pnpm test -- src/features/train/components/GymScheduleSheet.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `GymScheduleSheet`** — props `{ slots: GymScheduleSlot[]; onClose: () => void; onSave: (slots: GymScheduleSlotInput[]) => void }`. Render a `Sheet` titled "Heti gym-időpontok" with 7 rows (`DAY_LABELS`/`DAY_ORDER`), each a `<input type="time" aria-label={`${day} időpont`} style={{ fontSize: 16 }}>` seeded from the matching slot. Save maps rows with a non-empty time → `{ dayOfWeek: index, time }`, calls `onSave`, then `onClose`. (Mirror `SportScheduleSheet`'s Sheet usage + footer Mentés button.)

- [ ] **Step 4: Run — verify it passes**

Run: `cd frontend && pnpm test -- src/features/train/components/GymScheduleSheet.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire the entry in `GymView`** — a header chip "Időpontok" that opens the sheet, fed `gymSlots` + `saveGymSchedule` from `useTrain()`. (Mirror how `SportView` opens `SportScheduleSheet`.) Add `gymSlots`/`saveGymSchedule` to `useTrain()`'s return if not already exposed.

- [ ] **Step 6: Build + test**

Run: `cd frontend && pnpm build && pnpm test -- src/features/train`
Expected: build OK; tests pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/train/components/GymScheduleSheet.tsx frontend/src/features/train/components/GymScheduleSheet.test.tsx frontend/src/features/train/views/GymView.tsx
git commit -m "feat(train-fe): GymScheduleSheet weekly time editor + GymView entry (mezo-auk)"
```

---

## Task 10: `daySessions` time-ordering helper (TDD)

**Files:**
- Create: `frontend/src/features/train/agenda.ts`
- Test: `frontend/src/features/train/agenda.test.ts` (new)

A pure helper that flattens a day's `{gym, volleyball, running[]}` into typed items with a `timeOfDay`, sorted ascending with `null`/`''` last.

- [ ] **Step 1: Write the failing test:**

```ts
import { expect, test } from 'vitest'
import { daySessions } from './agenda'
import type { WeeklyAgendaDay } from './components/WeeklyDayRow'

const day = (over: Partial<WeeklyAgendaDay>): WeeklyAgendaDay =>
  ({ day: 'Kedd', gym: null, volleyball: null, running: [], isToday: false, ...over })

test('orders gym/volleyball/running by time, untimed last', () => {
  const items = daySessions(day({
    gym: { day: 'Kedd', active: true, time: '18:30', duration: null, type: 'Plyo Power' } as never,
    running: [{ key: 'tue-sprint', timeOfDay: '08:00', label: 'Sprint', kind: 'sprint' } as never],
    volleyball: { day: 'Kedd', time: null, duration: 90 } as never, // untimed
  }))
  expect(items.map((i) => i.kind)).toEqual(['running', 'gym', 'volleyball'])
  expect(items[0].timeOfDay).toBe('08:00')
})
```

- [ ] **Step 2: Run — verify it fails**

Run: `cd frontend && pnpm test -- src/features/train/agenda.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement:**

```ts
import type { WeeklyAgendaDay } from './components/WeeklyDayRow'
import type { GymScheduleDay, VolleyballSession } from '@/data/types'
import type { RunPrescribedSession } from '@/lib/runningApi'

export type AgendaItem =
  | { kind: 'gym'; timeOfDay: string | null; gym: GymScheduleDay }
  | { kind: 'volleyball'; timeOfDay: string | null; volleyball: VolleyballSession }
  | { kind: 'running'; timeOfDay: string | null; running: RunPrescribedSession }

/** A day's sessions, ordered by time-of-day; untimed (null/'') sort last, then by modality. */
export function daySessions(day: WeeklyAgendaDay): AgendaItem[] {
  const items: AgendaItem[] = []
  if (day.gym) items.push({ kind: 'gym', timeOfDay: day.gym.time ?? null, gym: day.gym })
  if (day.volleyball) items.push({ kind: 'volleyball', timeOfDay: day.volleyball.time ?? null, volleyball: day.volleyball })
  for (const r of day.running) items.push({ kind: 'running', timeOfDay: r.timeOfDay ?? null, running: r })
  const key = (t: string | null) => (t && t.length ? t : '99:99')
  return items.map((it, i) => ({ it, i }))
    .sort((a, b) => key(a.it.timeOfDay).localeCompare(key(b.it.timeOfDay)) || a.i - b.i)
    .map(({ it }) => it)
}
```

- [ ] **Step 4: Run — verify it passes**

Run: `cd frontend && pnpm test -- src/features/train/agenda.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/agenda.ts frontend/src/features/train/agenda.test.ts
git commit -m "feat(train-fe): daySessions time-ordering helper (mezo-auk)"
```

---

## Task 11: WeeklyDayRow renders sorted items + running time (TDD)

**Files:**
- Modify: `frontend/src/features/train/components/WeeklyDayRow.tsx`
- Test: `frontend/src/features/train/components/WeeklyDayRow.test.tsx` (new)

Replace the fixed gym→volleyball→running JSX with a single `.map(daySessions(agenda))` that renders each item by `kind`. The running branch now shows `running.timeOfDay` (mirroring the gym `· {time}` and volleyball `· {time}` markup).

- [ ] **Step 1: Write the failing test:**

```tsx
import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { WeeklyDayRow } from './WeeklyDayRow'

test('renders the morning run before the evening gym and shows the run time', () => {
  render(<WeeklyDayRow
    agenda={{
      day: 'Kedd', isToday: false,
      gym: { day: 'Kedd', active: true, time: '18:30', duration: null, type: 'Plyo Power' } as never,
      volleyball: null,
      running: [{ key: 'tue-sprint', timeOfDay: '08:00', label: 'Sprint-intervallum', kind: 'sprint', rpeTarget: { min: 9, max: 10 } } as never],
    }}
    onStartGym={() => {}} onLogVolleyball={() => {}} />)
  const buttons = screen.getAllByRole('button')
  // first session button is the 08:00 run
  expect(within(buttons[0]).getByText('Sprint-intervallum')).toBeInTheDocument()
  expect(within(buttons[0]).getByText(/08:00/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run — verify it fails**

Run: `cd frontend && pnpm test -- src/features/train/components/WeeklyDayRow.test.tsx`
Expected: FAIL — run order/time not rendered (current code renders gym first, no run time).

- [ ] **Step 3: Refactor `WeeklyDayRow`** — keep the day-label column + container. Replace the three fixed blocks with `daySessions(agenda).map((item, idx, arr) => …)`, rendering by `item.kind` (reuse the existing gym/volleyball/running button markup, now driven by `item.gym`/`item.volleyball`/`item.running`). For the running branch add the time:

```tsx
<div className="row gap-xs" style={{ alignItems: 'center' }}>
  <span style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>{item.running.label}</span>
  {item.running.timeOfDay && (
    <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>· {item.running.timeOfDay}</span>
  )}
</div>
```
Bottom-border = `idx < arr.length - 1`. Click handlers unchanged (gym→onStartGym, volleyball→onLogVolleyball, running→onLogRun) and only active when `isToday`.

- [ ] **Step 4: Run — verify it passes**

Run: `cd frontend && pnpm test -- src/features/train/components/WeeklyDayRow.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/components/WeeklyDayRow.tsx frontend/src/features/train/components/WeeklyDayRow.test.tsx
git commit -m "feat(train-fe): WeeklyDayRow time-ordered items + running time (mezo-auk)"
```

---

## Task 12: TrainTodayView orders today's hero cards by time + full-suite green

**Files:**
- Modify: `frontend/src/features/train/views/TrainTodayView.tsx`
- Test: `frontend/src/features/train/views/TrainTodayView.test.tsx` (extend existing)

Today's three hero blocks (gym hero, volleyball hero, running heroes) currently render in fixed order. Build the same `daySessions(today)` ordering and render the heroes in that sequence so a morning run hero appears above an evening gym hero.

- [ ] **Step 1: Extend the test** — with `today` having a gym at 18:30 and a run at 08:00, assert the run hero (`Futás · ma`) appears before the gym hero in the DOM (compare `compareDocumentPosition` or query order). (Match the existing test file's render/mock setup.)

- [ ] **Step 2: Run — verify it fails**

Run: `cd frontend && pnpm test -- src/features/train/views/TrainTodayView.test.tsx`
Expected: FAIL — gym hero precedes run hero.

- [ ] **Step 3: Refactor the hero section** — compute `daySessions(today)` (when `today` exists), and render the matching hero card per item in order. Keep each hero's existing markup; drive its presence/position from the sorted items (gym hero still also requires `workout`). The "rest day" and weekly-timeline sections are unchanged.

- [ ] **Step 4: Run — verify it passes**

Run: `cd frontend && pnpm test -- src/features/train/views/TrainTodayView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full frontend suites (both modes) + build**

Run:
```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: build OK; both runs green.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/train/views/TrainTodayView.tsx frontend/src/features/train/views/TrainTodayView.test.tsx
git commit -m "feat(train-fe): order today's hero cards by time-of-day (mezo-auk)"
```

---

## Task 13: Docs + full verification + merge/deploy

**Files:**
- Modify: `docs/features/train.md`, `docs/features/_platform-api-backend.md`, `docs/features/_platform-data-layer.md`

- [ ] **Step 1: Update `docs/features/train.md`** — document the `GymScheduleSlot` aggregate (weekday→time, `GET/PUT /api/train/gym-schedule`), the `deriveGymSchedule(meso, slots)` join, the `GymScheduleSheet` editor + GymView entry, and the Mai agenda time-ordering (`daySessions`, running time shown). Note the X-vs-Y decision → spec link.

- [ ] **Step 2: Update the platform docs** — `_platform-api-backend.md` (new endpoint + the `gym_schedule_slot` table in the persistence list), `_platform-data-layer.md` (the gym-schedule query/mutation in the train hook, like the sport-schedule one).

- [ ] **Step 3: Doc lint**

Run: `node scripts/lint-docs.mjs`
Expected: `result: PASS`.

- [ ] **Step 4: Full backend suite (testcontainers)**

Run: `cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true`
Expected: BUILD SUCCESS, 0 failures.

- [ ] **Step 5: Commit docs**

```bash
git add docs
git commit -m "docs(train): gym schedule slot + time-ordered agenda (mezo-auk)"
```

- [ ] **Step 6: Merge + close + push (deploy)**

```bash
git add -A && git commit -q -m "chore(bd): sync" || true
git checkout main && git pull --rebase
git merge --no-ff feat/gym-schedule-times -m "Merge feat/gym-schedule-times: weekly gym times + time-ordered Mai agenda (mezo-auk)"
git branch -d feat/gym-schedule-times
bd close mezo-auk
git add -A && git commit -q -m "chore(bd): close mezo-auk" || true
git pull --rebase && bd dolt push && git push
git status   # MUST show up to date with origin
```
(Resolve any `.beads/issues.jsonl` rebase conflict with `bd export -o .beads/issues.jsonl` then `git rebase --continue`.) The push triggers the no-test CI pipeline → builds FE+BE images → ArgoCD deploys.

---

## Self-Review

**Spec coverage:** ✅ gym slot aggregate (T1-5), persists across mesocycles (standalone table), lean weekday→time (T2-3), join (T7), editor+entry (T9), agenda ordering both rows & heroes (T10-12), running time shown (T11), untimed-last (T10), tests both modes + IT (throughout), docs (T13). Out-of-scope items (gym duration, per-week overrides) intentionally untouched.

**Placeholder scan:** Mirror-instructions ("match `SportScheduleSheet`") point at named, existing reference files with the exact deltas given — the executor reads the source. New logic (migration, contract, `deriveGymSchedule`, `daySessions`, `WeeklyDayRow` running branch, all tests) is complete code.

**Type consistency:** `GymScheduleSlot {dayOfWeek,time}` (FE) ↔ `GymScheduleSlotInput/Response {dayOfWeek,time}` (contract) ↔ `GymScheduleSlotEntity {dayOfWeek,time}` (BE). `deriveGymSchedule(meso, slots)` arity matches its caller (T8) and test (T7). `daySessions` `AgendaItem` union consumed identically in T11/T12. `saveGymSchedule(slots, opts)` mirrors `saveSportSchedule`.
