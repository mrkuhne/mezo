# Sport Schedule Discriminator (mezo-05v6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `sport` discriminator (volleyball | cross | trx) to the weekly sport schedule so recurring TRX/cross slots can be scheduled, multiple sports can share a day, and every surface (editor, Mai agenda, Heti terv) renders them.

**Architecture:** Extend the existing single-table discriminator pattern (already used by `sport_session`) to `sport_schedule_slot`: one new column + contract field, service-side volleyball default. On the FE, the weekly agenda's single `volleyball` field becomes a `sport: VolleyballSession[]` array (the `running[]` pattern), the `SportScheduleSheet` becomes a per-day slot-list editor, and done-state matches logged sessions by **date + sport**.

**Tech Stack:** Spring Boot 4 / Java 21 / Liquibase / MapStruct (backend), OpenAPI contract-first (`api/feature/train/train.yml`), React 19 + TanStack Query + Vitest (frontend).

**Spec:** `docs/superpowers/specs/2026-07-14-sport-schedule-discriminator-design.md`

## Global Constraints

- Branch: `feat/sport-schedule-discriminator` (already exists, spec committed). Conventional commit subjects carry the driving bd id: `feat(api): ... (mezo-05v6)`.
- Contract-first: edit `api/feature/train/train.yml` BEFORE any code; never hand-write boundary DTOs.
- Backend: base package `io.mrkuhne.mezo`; ALWAYS `./mvnw clean ...` (incremental Lombok+MapStruct is flaky); run only **focused** tests locally (`-Dtest=...`) — the full suite is CI's job; `docker compose up -d` (Postgres on :15432) must be running for ITs.
- Never modify released Liquibase changesets; new SQL script only, named `{YYYYMMDDHHMM}_mezo-05v6_{desc}.sql`, registered in `1.0.0_master.yml`; explicit constraint names (`ck_...`).
- Frontend: read `docs/references/frontend_conventions.md` before touching `frontend/src`. Deep absolute `@/*` imports, no new barrels, tests colocated, hooks only from `@/data/hooks`. Mock mode's Phase-1 fixtures must stay byte-identical — new domain fields are **additive optional**.
- FE gate per task: the task's focused tests in BOTH modes (`pnpm test <file>` and `VITE_USE_MOCK=true pnpm test <file>`); full gate (`pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`) in the final task.
- UI copy Hungarian; code/comments/commits English.
- Sport token set everywhere: `volleyball | cross | trx` (matches `ck_sport_session_sport`).

---

### Task 1: API contract — `sport` on the schedule slot DTOs

**Files:**
- Modify: `api/feature/train/train.yml` (schemas `SportScheduleSlotInput` ~line 1811, `SportScheduleSlotResponse` ~line 1840)
- Generated (do not hand-edit): `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Consumes: existing slot schemas (kind/time/durationMin/location/intensityLabel).
- Produces: `SportScheduleSlotInput.sport?: string` (pattern `^(volleyball|cross|trx)$`, optional), `SportScheduleSlotResponse.sport: string` (required). Backend generated DTOs gain `getSport()`; FE `components['schemas'][...]` types gain the field.

- [ ] **Step 1: Add `sport` to `SportScheduleSlotInput`** (NOT in `required` — server defaults to volleyball, mirroring `SportSessionCreateRequest.sport`):

```yaml
        sport:
          type: string
          pattern: '^(volleyball|cross|trx)$'
          description: Sport discriminator; defaults to volleyball server-side when omitted.
```

- [ ] **Step 2: Add `sport` to `SportScheduleSlotResponse`** — plain string like `SportSessionResponse.sport` (no enum ⇒ MapStruct auto-maps, no mapper edit), and add `sport` to the schema's `required` list:

```yaml
        sport:
          type: string
          description: volleyball | cross | trx
```

- [ ] **Step 3: Regenerate both sides**

Run: `cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api`
Expected: `api/openapi.yml` and `frontend/src/data/_client/api.gen.ts` change; `grep -n "sport" frontend/src/data/_client/api.gen.ts | grep -i ScheduleSlot` shows the new field on both schemas.

- [ ] **Step 4: Commit**

```bash
git add api/ frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): sport discriminator on sport schedule slot contract (mezo-05v6)"
```

---

### Task 2: DB migration + entity + service default (backend)

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202607141200_mezo-05v6_sport_schedule_slot_sport.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append changeset)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/SportScheduleSlotEntity.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/SportService.java:86-96` (`replaceSchedule` loop)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/SportContractIT.java`

**Interfaces:**
- Consumes: Task 1's generated `SportScheduleSlotInput.getSport()` / `SportScheduleSlotResponse.getSport()`.
- Produces: `sport_schedule_slot.sport` column (NOT NULL DEFAULT 'volleyball', CHECK); `SportScheduleSlotEntity.getSport()/setSport(String)` with `"volleyball"` field-initializer default (so `TrainSeedData` and `TrainPopulator.createScheduleSlot` need NO change); `PUT /api/train/sport-schedule` round-trips `sport`.

- [ ] **Step 1: Write the failing ITs** — in `SportContractIT.java`, add a 5-arg `slot` helper next to the existing 4-arg one, and two tests:

```java
    private static SportScheduleSlotInput slot(int dayOfWeek, String time, int durationMin, String kind, String sport) {
        return SportScheduleSlotInput.builder()
            .dayOfWeek(dayOfWeek).time(time).durationMin(durationMin).kind(kind).sport(sport).build();
    }

    @Test
    void testReplaceSportSchedule_shouldRoundTripMixedSportsAndDefaultVolleyball_whenMultiSlotDay() {
        HttpHeaders auth = ownerAuthHeaders();

        // Tue TRX noon + Tue volleyball evening on the SAME day, Thu TRX; omitted sport -> volleyball.
        List<SportScheduleSlotResponse> saved = putForList("/api/train/sport-schedule",
            List.of(slot(1, "12:00", 60, "training", "trx"),
                slot(1, "19:00", 90, "training", null),
                slot(3, "12:00", 60, "training", "trx")), auth);

        assertThat(saved).hasSize(3);
        assertThat(saved).extracting(SportScheduleSlotResponse::getDayOfWeek).containsExactly(1, 1, 3);
        assertThat(saved).extracting(SportScheduleSlotResponse::getSport)
            .containsExactly("trx", "volleyball", "trx");

        List<SportScheduleSlotResponse> after =
            getForList("/api/train/sport-schedule", auth, HttpStatus.OK, SportScheduleSlotResponse.class);
        assertThat(after).extracting(SportScheduleSlotResponse::getSport)
            .containsExactly("trx", "volleyball", "trx");
    }

    @Test
    void testReplaceSportSchedule_shouldReturn400InvalidValue_whenSportUnknown() {
        String body = putForBody("/api/train/sport-schedule",
            List.of(slot(0, "18:15", 90, "training", "tennis")),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "sport", "VALIDATION_INVALID_VALUE");
    }
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && ./mvnw clean test -Dtest=SportContractIT`
Expected: FAIL — the two new tests fail (no `sport` column / response `sport` null); pre-existing tests stay green. (If the column doesn't exist yet the round-trip test errors on 500 — also an acceptable failure signal.)

- [ ] **Step 3: Migration SQL** — create `script/202607141200_mezo-05v6_sport_schedule_slot_sport.sql`:

```sql
-- DDL: mezo-05v6 — sport discriminator on the recurring weekly sport schedule slots,
-- so TRX/cross slots can be scheduled alongside volleyball (same token set as
-- ck_sport_session_sport). Existing rows become volleyball via the default.
ALTER TABLE sport_schedule_slot
    ADD COLUMN sport TEXT NOT NULL DEFAULT 'volleyball';
ALTER TABLE sport_schedule_slot
    ADD CONSTRAINT ck_sport_schedule_slot_sport CHECK (sport IN ('volleyball', 'cross', 'trx'));
```

- [ ] **Step 4: Register it** — append to `1.0.0_master.yml` (after the `mezo-jzca` changeset, same shape):

```yaml
  - changeSet:
      id: "1.0.0:202607141200_mezo-05v6_sport_schedule_slot_sport"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202607141200_mezo-05v6_sport_schedule_slot_sport.sql
```

- [ ] **Step 5: Entity field** — in `SportScheduleSlotEntity.java` after the `kind` field, mirroring the `ExerciseSetEntity.kind` initializer idiom (the initializer keeps `TrainSeedData`/`TrainPopulator` untouched):

```java
    @NotNull
    @Column(nullable = false)
    private String sport = "volleyball"; // 'volleyball' | 'cross' | 'trx' (DB CHECK)
```

Also update the class javadoc's first line: `One recurring weekly sport (volleyball) schedule slot` → `One recurring weekly sport schedule slot (volleyball | cross | trx)`.

- [ ] **Step 6: Service default** — in `SportService.replaceSchedule`, after `s.setKind(in.getKind());`:

```java
            if (in.getSport() != null) s.setSport(in.getSport()); // volleyball|cross|trx; entity defaults volleyball
```

(No `TrainMapper` change: response `sport` is a plain String and MapStruct auto-maps same-name String fields.)

- [ ] **Step 7: Run to verify pass**

Run: `cd backend && ./mvnw clean test -Dtest='SportContractIT,SportServiceIT,TrainSeedDataIT'`
Expected: PASS (all — including the untouched seed/service ITs proving the default covers legacy write paths).

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/resources/db/changelog backend/src/main/java backend/src/test/java
git commit -m "feat(be/train): sport discriminator on sport_schedule_slot (mezo-05v6)"
```

---

### Task 3: FE weekly model — `sport[]` on the agenda, sport-aware row + load tiles

**Files:**
- Create: `frontend/src/features/train/logic/sportKinds.ts`
- Modify: `frontend/src/data/types.ts:18` (`VolleyballSession`), `frontend/src/data/train/trainHooks.ts:127-146` (`toSportSchedule`)
- Modify: `frontend/src/features/train/logic/agenda.ts`, `frontend/src/features/train/logic/weeklyLoad.ts`, `frontend/src/features/train/components/WeeklyDayRow.tsx`, `frontend/src/features/train/components/LoadTiles.tsx`, `frontend/src/features/train/sheets/SportLogSheet.tsx:134-136` (import the shared kinds), `frontend/src/features/train/pages/TrainTodayPage.tsx` (mechanical adaptation only)
- Test: `frontend/src/features/train/logic/agenda.test.ts`, `frontend/src/features/train/logic/weeklyLoad.test.ts`, `frontend/src/features/train/components/WeeklyDayRow.test.tsx`

**Interfaces:**
- Consumes: `SportScheduleSlotResponse.sport` (Task 1).
- Produces: `SportKind`, `SPORT_KINDS`, `SPORT_LABELS`, `SPORT_TAGS`, `SPORT_TITLES`, `sportOf()` from `@/features/train/logic/sportKinds`; `VolleyballSession.sport?: SportKind`; `WeeklyAgendaDay.sport: VolleyballSession[]` (replaces `volleyball: VolleyballSession | null`); `AgendaItem` sport variant `{ kind: 'sport'; timeOfDay: string | null; sport: VolleyballSession }`; `WeeklyDayRow` props `isSportLogged?: (s: VolleyballSession) => boolean` and `onLogSport?: (s: VolleyballSession) => void` (replace `vbLogged`/`onLogVolleyball`); `weeklyLoad` emits one sport tile per active sport kind.

- [ ] **Step 1: Create `sportKinds.ts`** — single home for the kind vocabulary (SportLogSheet currently duplicates it):

```ts
// ============================================================
// Mezo · sportKinds — the shared sport-kind vocabulary (volleyball|cross|trx).
// One home for labels/tags so the log sheet, schedule editor, agenda row and
// heroes render the same names. `sportOf` resolves the optional discriminator
// (absent = volleyball, the Phase-1 mock default).
// ============================================================
export type SportKind = 'volleyball' | 'cross' | 'trx'

export const SPORT_KINDS: SportKind[] = ['volleyball', 'cross', 'trx']
/** Selector-chip labels (log sheet + schedule editor). */
export const SPORT_LABELS: Record<SportKind, string> = { volleyball: 'Röpi', cross: 'Cross', trx: 'TRX' }
/** `.stag`/`.typetag` tag text (weekly rows + heroes). */
export const SPORT_TAGS: Record<SportKind, string> = { volleyball: 'RÖPI', cross: 'CROSS', trx: 'TRX' }
/** Row/hero titles. */
export const SPORT_TITLES: Record<SportKind, string> = { volleyball: 'Volleyball', cross: 'Cross', trx: 'TRX' }
export const SPORT_EMOJI: Record<SportKind, string> = { volleyball: '🏐', cross: '⚡', trx: '🪢' }

export const sportOf = (s: { sport?: SportKind }): SportKind => s.sport ?? 'volleyball'
```

- [ ] **Step 2: Domain type + mapping** — `types.ts:18` add the additive optional field (import nothing; inline the union to keep `data/` free of `features/` imports):

```ts
export interface VolleyballSession { day: string; time: string; duration: number; court: string; intensity: string; role: string; sport?: 'volleyball' | 'cross' | 'trx'; today?: boolean; flex?: boolean }
```

In `trainHooks.ts` `toSportSchedule`, add to the mapped session object (after `role:`):

```ts
        sport: (s.sport as VolleyballSession['sport']) ?? 'volleyball',
```

- [ ] **Step 3: Update `agenda.test.ts` fixtures to the new shape + add a multi-sport case** (this is the failing-test step for the model change) — replace `volleyball: null` with `sport: []` in the `day` helper, `volleyball: {...}` with `sport: [{...}]` in the first test, expected kinds `'volleyball'` → `'sport'`, and add:

```ts
test('a multi-sport day flattens every sport slot, ordered by time', () => {
  const items = daySessions(day({
    sport: [
      { day: 'Kedd', time: '19:00', duration: 90, sport: 'volleyball' } as never,
      { day: 'Kedd', time: '12:00', duration: 60, sport: 'trx' } as never,
    ],
  }))
  expect(items.map((i) => i.kind)).toEqual(['sport', 'sport'])
  expect(items.map((i) => i.timeOfDay)).toEqual(['12:00', '19:00'])
})
```

Run: `cd frontend && pnpm test src/features/train/logic/agenda.test.ts`
Expected: FAIL (compile/type errors — `sport` field doesn't exist yet).

- [ ] **Step 4: Rewrite `agenda.ts`** — the `AgendaItem` sport variant + array flattening:

```ts
export type AgendaItem =
  | { kind: 'gym'; timeOfDay: string | null; gym: GymScheduleDay }
  | { kind: 'sport'; timeOfDay: string | null; sport: VolleyballSession }
  | { kind: 'running'; timeOfDay: string | null; running: RunPrescribedSession }

/** A day's sessions, ordered by time-of-day; untimed (null/'') sort last, then by modality. */
export function daySessions(day: WeeklyAgendaDay): AgendaItem[] {
  const items: AgendaItem[] = []
  if (day.gym) items.push({ kind: 'gym', timeOfDay: day.gym.time ?? null, gym: day.gym })
  for (const s of day.sport) items.push({ kind: 'sport', timeOfDay: s.time ?? null, sport: s })
  for (const r of day.running) items.push({ kind: 'running', timeOfDay: r.timeOfDay ?? null, running: r })
  const key = (t: string | null) => (t && t.length ? t : '99:99')
  return items.map((it, i) => ({ it, i }))
    .sort((a, b) => key(a.it.timeOfDay).localeCompare(key(b.it.timeOfDay)) || a.i - b.i)
    .map(({ it }) => it)
}
```

Update the header comment's `gym/volleyball/running` mentions to `gym/sport/running`.

- [ ] **Step 5: `WeeklyDayRow.tsx`** — interface + props + sport branch:

```ts
export interface WeeklyAgendaDay {
  day: string
  /** ISO date of this row's day in the current week — used by the parent to derive done-state. */
  date?: string
  gym: GymScheduleDay | null
  /** This day's recurring sport slots (volleyball/cross/trx) — a day can hold several. */
  sport: VolleyballSession[]
  running: RunPrescribedSession[]
  isToday: boolean
}

interface WeeklyDayRowProps {
  agenda: WeeklyAgendaDay
  /** This day's gym workout has a logged set ⇒ show the done chip (today or a past day). */
  gymLogged?: boolean
  /** This slot's sport has a logged session on this date ⇒ show the done chip. */
  isSportLogged?: (s: VolleyballSession) => boolean
  /** This day's prescribed run (by key) has a logged session ⇒ show the done chip. */
  isRunLogged?: (key: string) => boolean
  onStartGym: () => void
  onLogSport?: (s: VolleyballSession) => void
  onLogRun?: (s: RunPrescribedSession) => void
}
```

The sport branch (replaces the `item.kind === 'volleyball'` block; import `sportOf`, `SPORT_TAGS`, `SPORT_TITLES` from `@/features/train/logic/sportKinds`):

```tsx
          if (item.kind === 'sport') {
            const s = item.sport
            const k = sportOf(s)
            const logged = Boolean(isSportLogged?.(s))
            const meta = [s.time, `${s.duration}p`, s.role, s.intensity].filter(Boolean).join(' · ')
            return (
              <button key={`sport-${k}-${s.time}`} type="button" className="s" onClick={isToday ? () => onLogSport?.(s) : undefined}>
                <span className="stag stag-sport">{SPORT_TAGS[k]}</span>
                {isToday ? <b>{SPORT_TITLES[k]}</b> : SPORT_TITLES[k]}
                <span className="meta">{meta}</span>
                {(logged || isToday) && (
                  <span className={logged ? 'done-chip' : cn('log-chip', 'stag-sport')}>
                    {logged ? 'kész' : 'log'}
                  </span>
                )}
              </button>
            )
          }
```

- [ ] **Step 6: `weeklyLoad.ts`** — one tile per active sport kind (import `SPORT_KINDS`, `sportOf`, `SPORT_EMOJI`, `SportKind` from sportKinds); replace the `vbDays` block:

```ts
const SPORT_TILE_LABELS: Record<SportKind, string> = { volleyball: 'Röplabda', cross: 'Cross', trx: 'TRX' }

  for (const k of SPORT_KINDS) {
    const slots = agenda.flatMap((a) => a.sport).filter((s) => sportOf(s) === k)
    if (!slots.length) continue
    const total = slots.reduce((x, s) => x + (s.duration ?? 0), 0)
    tiles.push({
      kind: 'sport', label: SPORT_TILE_LABELS[k], icon: SPORT_EMOJI[k],
      value: total ? `${slots.length}× · ${hoursHu(total)}` : `${slots.length}×`,
    })
  }
```

Change the signature's `Pick<..., 'gym' | 'volleyball' | 'running'>` to `'gym' | 'sport' | 'running'`. In `LoadTiles.tsx` change `key={t.kind}` → `key={t.label}` (two sport tiles may now coexist).

- [ ] **Step 7: `SportLogSheet.tsx`** — delete its local `SportKind`/`KIND_LABELS`/`SPORT_KINDS` (lines 134-136) and import them: `import { SPORT_KINDS, SPORT_LABELS, type SportKind } from '@/features/train/logic/sportKinds'`; rename `KIND_LABELS[...]` usages to `SPORT_LABELS[...]`.

- [ ] **Step 8: `TrainTodayPage.tsx` mechanical adaptation** (behavior-preserving; the multi-sport heroes come in Task 5). In the agenda build:

```ts
  const agenda: WeeklyAgendaDay[] = DAY_ORDER.map((d, i) => {
    const g = gymTimes.find((x) => x.day === d)
    const v = vbSessions.filter((x) => x.day === d)
    return {
      day: d,
      date: weekDateIso(i),
      gym: g && g.active ? g : null,
      sport: v,
      running: runSessionsForDay(activeRunningBlock, DAY_ORDER.indexOf(d)),
      isToday: Boolean(g?.today || v.some((x) => x.today)),
    }
  })
```

Then: `orderedToday`'s `volleyball: today?.volleyball ?? null` → `sport: today?.sport ?? []`; `sessionCount` filter `a.volleyball` → `a.sport.length`; the hero branch `if (item.kind === 'volleyball')` → `if (item.kind === 'sport')` with `const vb = item.sport` and key `hero-vb` → `` key={`hero-sport-${vb.time}`} ``; the rest-day condition `!today?.volleyball` → `!today?.sport.length`; the `WeeklyDayRow` props `vbLogged={vbDoneOn(a.date)}` → `isSportLogged={() => vbDoneOn(a.date)}` and `onLogVolleyball={() => setVbLogOpen(true)}` → `onLogSport={() => setVbLogOpen(true)}`.

- [ ] **Step 9: Update remaining test fixtures** — in `weeklyLoad.test.ts` and `WeeklyDayRow.test.tsx`, mechanically replace `volleyball: <session>` with `sport: [<session>]` and `volleyball: null` with `sport: []`; in `WeeklyDayRow.test.tsx` replace `vbLogged`/`onLogVolleyball` props with `isSportLogged={() => ...}`/`onLogSport`. Add one new weeklyLoad case:

```ts
test('mixed sports produce one tile per kind', () => {
  const tiles = weeklyLoad([
    { gym: null, running: [], sport: [{ duration: 60, sport: 'trx' } as never, { duration: 90 } as never] },
    { gym: null, running: [], sport: [{ duration: 60, sport: 'trx' } as never] },
  ])
  expect(tiles.map((t) => t.label)).toEqual(['Röplabda', 'TRX'])
  expect(tiles.find((t) => t.label === 'TRX')!.value).toBe('2× · 2h')
})
```

- [ ] **Step 10: Run the task's tests in both modes**

Run (from `frontend/`):
`pnpm test src/features/train/logic src/features/train/components/WeeklyDayRow.test.tsx src/features/train/components/LoadTiles.test.tsx src/features/train/pages/TrainTodayPage.test.tsx src/features/train/sheets/SportLogSheet.test.tsx`
and the same with `VITE_USE_MOCK=true pnpm test ...`
Expected: PASS both (TrainTodayPage still renders identically — every mock/real fixture is volleyball).

- [ ] **Step 11: Commit**

```bash
git add frontend/src
git commit -m "feat(fe/train): multi-sport weekly agenda model (mezo-05v6)"
```

---

### Task 4: `SportScheduleSheet` — per-day slot-list editor with sport selector

**Files:**
- Modify: `frontend/src/features/train/sheets/SportScheduleSheet.tsx` (rewrite the draft model + day body)
- Test: `frontend/src/features/train/sheets/SportScheduleSheet.test.tsx` (rewrite)

**Interfaces:**
- Consumes: `SPORT_KINDS`/`SPORT_LABELS`/`sportOf`/`SportKind` (Task 3), `SportScheduleSlotInput.sport` (Task 1). Component props are UNCHANGED (`initial: VolleyballSession[]`, `onSave?: (slots: SportScheduleSlotInput[]) => void`, `onClose`).
- Produces: saved payloads now always carry `sport`; non-volleyball slots always carry `kind: 'training'`.

- [ ] **Step 1: Rewrite the tests first.** Keep the file's five scenarios but port them to the slot-list model, and add TRX/multi-slot coverage. Full new test file:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SportScheduleSheet } from '@/features/train/sheets/SportScheduleSheet'
import type { VolleyballSession } from '@/data/types'

const initial: VolleyballSession[] = [
  { day: 'Hét', time: '18:15', duration: 90, court: 'BVSC csarnok', intensity: 'közepes', role: 'edzés' },
  { day: 'Szo', time: '10:00', duration: 120, court: 'Kőbánya Sport', intensity: 'magas', role: 'meccs/scrim' },
]

test('prefills slots from the current schedule and saves the slot list with sport', async () => {
  const onSave = vi.fn()
  const onClose = vi.fn()
  render(<SportScheduleSheet initial={initial} onSave={onSave} onClose={onClose} />)

  expect(screen.getByRole('heading', { name: 'Heti rend' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave).toHaveBeenCalledWith([
    { dayOfWeek: 0, time: '18:15', durationMin: 90, sport: 'volleyball', kind: 'training', location: 'BVSC csarnok', intensityLabel: 'közepes' },
    { dayOfWeek: 5, time: '10:00', durationMin: 120, sport: 'volleyball', kind: 'match', location: 'Kőbánya Sport', intensityLabel: 'magas' },
  ])
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})

test('adding a slot appends it with defaults; a second add on the same day is allowed', async () => {
  const onSave = vi.fn()
  render(<SportScheduleSheet initial={[]} onSave={onSave} onClose={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Kedd sport hozzáadása' }))
  await userEvent.click(screen.getByRole('button', { name: 'Kedd sport hozzáadása' }))
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave).toHaveBeenCalledWith([
    { dayOfWeek: 1, time: '18:00', durationMin: 90, sport: 'volleyball', kind: 'training' },
    { dayOfWeek: 1, time: '18:00', durationMin: 90, sport: 'volleyball', kind: 'training' },
  ])
})

test('switching a slot to TRX hides the kind toggle and saves sport trx / kind training', async () => {
  const onSave = vi.fn()
  render(<SportScheduleSheet initial={[]} onSave={onSave} onClose={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Kedd sport hozzáadása' }))
  await userEvent.click(screen.getByRole('button', { name: 'Kedd 1. TRX' }))
  expect(screen.queryByRole('button', { name: 'Kedd 1. meccs' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave).toHaveBeenCalledWith([
    { dayOfWeek: 1, time: '18:00', durationMin: 90, sport: 'trx', kind: 'training' },
  ])
})

test('removing a slot drops it from the saved list', async () => {
  const onSave = vi.fn()
  render(<SportScheduleSheet initial={initial} onSave={onSave} onClose={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Hétfő 1. slot törlése' }))
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave.mock.calls[0][0]).toHaveLength(1)
  expect(onSave.mock.calls[0][0][0].dayOfWeek).toBe(5)
})

test('slot duration clamps to the contract ceiling (360)', async () => {
  const onSave = vi.fn()
  render(
    <SportScheduleSheet
      initial={[{ day: 'Hét', time: '18:15', duration: 360, court: '', intensity: '', role: 'edzés' }]}
      onSave={onSave}
      onClose={vi.fn()}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Hossz · perc növelése' }))
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave.mock.calls[0][0][0].durationMin).toBe(360)
})

test('kind toggle switches a volleyball slot to match', async () => {
  const onSave = vi.fn()
  render(<SportScheduleSheet initial={[initial[0]]} onSave={onSave} onClose={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Hétfő 1. meccs' }))
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave.mock.calls[0][0][0].kind).toBe('match')
})

test('a TRX slot prefills its sport from the schedule', async () => {
  const onSave = vi.fn()
  render(
    <SportScheduleSheet
      initial={[{ day: 'Ked', time: '12:00', duration: 60, court: 'Life1 Corvin', intensity: '', role: 'edzés', sport: 'trx' }]}
      onSave={onSave}
      onClose={vi.fn()}
    />,
  )
  expect(screen.getByRole('button', { name: 'Kedd 1. TRX' })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave.mock.calls[0][0][0]).toMatchObject({ sport: 'trx', location: 'Life1 Corvin' })
})
```

NOTE: `DAY_ORDER` entries are the short labels (`Hét`, `Ked`, ...) while the add-button labels below use the long day names via `DAY_LABELS` — check `frontend/src/data/train/train.ts` for both exports; the aria-labels in the component (Step 2) must use `DAY_LABELS[day]` (`Kedd`) to match these tests, and keep the existing `NumberStep` aria-label (`Hossz · perc növelése`) untouched.

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && pnpm test src/features/train/sheets/SportScheduleSheet.test.tsx`
Expected: FAIL (old day-toggle UI has no `sport hozzáadása` / slot buttons).

- [ ] **Step 3: Rewrite the component.** Replace `DayDraft`/`emptyDraft`/`draftsFrom` and the day-editor body:

```tsx
import { SPORT_KINDS, SPORT_LABELS, sportOf, type SportKind } from '@/features/train/logic/sportKinds'
import { DAY_LABELS, DAY_ORDER } from '@/data/train/train'

interface SlotDraft {
  sport: SportKind
  time: string
  durationMin: number
  kind: 'training' | 'match'
  location: string
  intensityLabel: string
}

const newSlot = (): SlotDraft =>
  ({ sport: 'volleyball', time: '18:00', durationMin: 90, kind: 'training', location: '', intensityLabel: '' })

// Groups the mapped schedule per weekday (role 'meccs*' <-> kind 'match') — exact for
// real-mode data, best-effort for the Phase-1 mock fixture. A day holds 0..n slots.
function draftsFrom(sessions: VolleyballSession[]): SlotDraft[][] {
  return DAY_ORDER.map((d) =>
    sessions.filter((x) => x.day === d).map((s) => ({
      sport: sportOf(s), time: s.time, durationMin: s.duration,
      kind: s.role.startsWith('meccs') ? 'match' as const : 'training' as const,
      location: s.court, intensityLabel: s.intensity,
    })))
}
```

State + save + per-slot patch helpers inside the component:

```tsx
  const [days, setDays] = useState<SlotDraft[][]>(() => draftsFrom(initial))
  const patch = (di: number, si: number, p: Partial<SlotDraft>) =>
    setDays((ds) => ds.map((slots, j) => (j === di ? slots.map((s, k) => (k === si ? { ...s, ...p } : s)) : slots)))
  const addSlot = (di: number) => setDays((ds) => ds.map((slots, j) => (j === di ? [...slots, newSlot()] : slots)))
  const removeSlot = (di: number, si: number) =>
    setDays((ds) => ds.map((slots, j) => (j === di ? slots.filter((_, k) => k !== si) : slots)))

  const save = () => {
    onSave?.(days.flatMap((slots, i) => slots.map((d) => ({
      dayOfWeek: i, time: d.time, durationMin: d.durationMin,
      sport: d.sport, kind: d.sport === 'volleyball' ? d.kind : 'training',
      ...(d.location.trim() ? { location: d.location.trim() } : {}),
      ...(d.intensityLabel.trim() ? { intensityLabel: d.intensityLabel.trim() } : {}),
    }))))
  }
```

Day body (replaces the `DAY_ORDER.map` card content; keep the surrounding `Sheet`/header/footer and `inputStyle` as-is). Every aria-label uses `DAY_LABELS[day]` + the 1-based slot index:

```tsx
            {DAY_ORDER.map((day, di) => (
              <div key={day} className="card notch-4" style={{ padding: 10 }}>
                <span
                  className="label-mono"
                  style={{ color: days[di].length ? 'var(--cat-tendency)' : 'var(--text-tertiary)' }}
                >
                  {day}
                </span>
                <div className="col gap-sm mt-sm">
                  {days[di].map((d, si) => {
                    const slotName = `${DAY_LABELS[day]} ${si + 1}.`
                    return (
                      <div key={si} className="card notch-4" style={{ padding: 10, background: 'var(--surface-2)' }}>
                        <div className="row gap-xs" role="group" aria-label={`${slotName} sport`}>
                          {SPORT_KINDS.map((k) => (
                            <button
                              key={k}
                              type="button"
                              className="chip notch-4 flex-1"
                              aria-pressed={d.sport === k}
                              aria-label={`${slotName} ${SPORT_LABELS[k]}`}
                              onClick={() => patch(di, si, { sport: k, ...(k !== 'volleyball' ? { kind: 'training' as const } : {}) })}
                              style={{
                                padding: '6px 8px', fontSize: 9,
                                color: d.sport === k ? 'var(--cat-tendency)' : 'var(--text-tertiary)',
                                borderColor: d.sport === k
                                  ? 'color-mix(in srgb, var(--cat-tendency) 40%, transparent)'
                                  : 'var(--border-subtle)',
                              }}
                            >
                              {SPORT_LABELS[k]}
                            </button>
                          ))}
                          <button
                            type="button"
                            className="chip notch-4"
                            aria-label={`${slotName} slot törlése`}
                            onClick={() => removeSlot(di, si)}
                            style={{ padding: '6px 8px' }}
                          >
                            <Icon name="x" size={10} />
                          </button>
                        </div>
                        <div className="col gap-sm mt-md">
                          <div className="row gap-sm">
                            <input
                              type="time"
                              aria-label={`${slotName} idő`}
                              value={d.time}
                              onChange={(e) => patch(di, si, { time: e.target.value })}
                              style={{ ...inputStyle, width: 110 }}
                            />
                            {d.sport === 'volleyball' && (
                              <>
                                <button
                                  type="button"
                                  className="chip notch-4 flex-1"
                                  aria-pressed={d.kind === 'training'}
                                  aria-label={`${slotName} edzés`}
                                  onClick={() => patch(di, si, { kind: 'training' })}
                                  style={{ fontSize: 9, color: d.kind === 'training' ? 'var(--cat-tendency)' : 'var(--text-tertiary)' }}
                                >
                                  edzés
                                </button>
                                <button
                                  type="button"
                                  className="chip notch-4 flex-1"
                                  aria-pressed={d.kind === 'match'}
                                  aria-label={`${slotName} meccs`}
                                  onClick={() => patch(di, si, { kind: 'match' })}
                                  style={{ fontSize: 9, color: d.kind === 'match' ? 'var(--cat-tendency)' : 'var(--text-tertiary)' }}
                                >
                                  meccs
                                </button>
                              </>
                            )}
                          </div>
                          <NumberStep
                            label="Hossz · perc"
                            val={d.durationMin}
                            step={15}
                            min={15}
                            max={360}
                            onChange={(v) => patch(di, si, { durationMin: v })}
                          />
                          <input
                            aria-label={`${slotName} helyszín`}
                            placeholder="Helyszín"
                            value={d.location}
                            onChange={(e) => patch(di, si, { location: e.target.value })}
                            style={inputStyle}
                          />
                          <input
                            aria-label={`${slotName} intenzitás`}
                            placeholder="Intenzitás · pl. közepes"
                            value={d.intensityLabel}
                            onChange={(e) => patch(di, si, { intensityLabel: e.target.value })}
                            style={inputStyle}
                          />
                        </div>
                      </div>
                    )
                  })}
                  <button
                    type="button"
                    className="chip notch-4"
                    aria-label={`${DAY_LABELS[day]} sport hozzáadása`}
                    onClick={() => addSlot(di)}
                    style={{ padding: '8px 10px', fontSize: 9, color: 'var(--text-secondary)' }}
                  >
                    + Sport hozzáadása
                  </button>
                </div>
              </div>
            ))}
```

Update the file-header comment (`One slot max per day...` → `Per-day slot lists (a day holds 0..n slots, each with a sport discriminator); non-volleyball slots always save kind 'training'.`). If the duration-stepper test finds two `Hossz · perc növelése` buttons ambiguous with multiple slots, it won't — that test renders a single slot.

- [ ] **Step 4: Run to verify pass, both modes**

Run: `cd frontend && pnpm test src/features/train/sheets/SportScheduleSheet.test.tsx && VITE_USE_MOCK=true pnpm test src/features/train/sheets/SportScheduleSheet.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/sheets
git commit -m "feat(fe/train): per-day multi-slot sport schedule editor (mezo-05v6)"
```

---

### Task 5: Mai agenda — per-sport heroes, date+sport done-state, log prefill

**Files:**
- Modify: `frontend/src/features/train/sheets/SportLogSheet.tsx` (add `initialSport` prop)
- Modify: `frontend/src/features/train/pages/TrainTodayPage.tsx`
- Test: `frontend/src/features/train/pages/TrainTodayPage.test.tsx`, `frontend/src/features/train/sheets/SportLogSheet.test.tsx`

**Interfaces:**
- Consumes: Task 3's `sportOf`/`SPORT_TAGS`/`SPORT_TITLES`/`SPORT_EMOJI`/`SportKind`, `WeeklyDayRow`'s `isSportLogged`/`onLogSport`.
- Produces: `SportLogSheet` prop `initialSport?: SportKind` (default `'volleyball'`); TrainTodayPage renders one hero per sport slot and matches done-state by date+sport.

- [ ] **Step 1: `SportLogSheet` prop** — signature and state:

```tsx
export function SportLogSheet({ onClose, onSave, initialSport }: {
  onClose: () => void
  onSave?: (input: SportSessionCreateRequest, done: () => void) => void
  /** Pre-selects the kind (a schedule slot's log CTA passes its sport). */
  initialSport?: SportKind
}) {
  const [kind, setKind] = useState<SportKind>(initialSport ?? 'volleyball')
```

Add a test to `SportLogSheet.test.tsx` (follow the file's existing render helper):

```tsx
test('initialSport preselects the kind', () => {
  render(<SportLogSheet initialSport="trx" onClose={vi.fn()} />)
  expect(screen.getByText('Sport log · TRX')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'TRX' })).toHaveAttribute('aria-pressed', 'true')
})
```

(If the existing file wraps renders in a provider, reuse that wrapper.)

- [ ] **Step 2: Write the failing TrainTodayPage test** — real-mode, modeled on the file's existing `server.use(...)` idiom (reuse its `realMeso` + the empty-`/today` handler shape from the rest-day test):

```tsx
test('real mode: a TRX slot renders its own hero, sport-matched done-state, and preselects the log sheet', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const dow = (new Date().getDay() + 6) % 7
  const otherDay = DAY_ORDER[(dow + 1) % 7]
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([realMeso(otherDay)])),
    // A volleyball session logged TODAY must NOT mark the TRX slot done (date+sport matching).
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([
      { id: 'ss-1', sport: 'volleyball', date: localDateString(), time: '19:00', duration: 90, rpe: 7 },
    ])),
    http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([
      { id: 'sl-1', dayOfWeek: dow, time: '12:00', durationMin: 60, kind: 'training', sport: 'trx', location: 'Life1 Corvin' },
    ])),
    http.get(`${API_BASE}/api/train/workouts/today`, () =>
      HttpResponse.json({ templateSessionId: null, dayLabel: todayLabel(), title: '', durationEst: 0, exercises: [], openWorkout: null })),
  )
  renderView()
  // TRX hero with its own tag + title, NOT done (the logged session is volleyball)
  expect(await screen.findByText('TRX · 12:00')).toBeInTheDocument()
  expect(screen.getByText('🪢 TRX')).toBeInTheDocument()
  const cta = screen.getByRole('button', { name: /Logold a session-t/ })
  // The log sheet opens preselected to TRX
  fireEvent.click(cta)
  expect(screen.getByText('Sport log · TRX')).toBeInTheDocument()
})
```

Run: `cd frontend && pnpm test src/features/train/pages/TrainTodayPage.test.tsx`
Expected: FAIL (`TRX · 12:00` not found — the hero still renders `Volleyball · {time}` and done-state matching is volleyball-only).

- [ ] **Step 3: Rework TrainTodayPage's sport pieces.** Imports: add `import { sportOf, SPORT_EMOJI, SPORT_TAGS, SPORT_TITLES, type SportKind } from '@/features/train/logic/sportKinds'`. Replace the `vbLogOpen` state with `const [sportLogSport, setSportLogSport] = useState<SportKind | null>(null)`. Replace the volleyball logged-signal block (`loggedVb`/`vbDoneOn`) with:

```ts
  const todayHu = huMonthDayDow(localDateString())
  // A slot's done-state matches a logged session by DATE **and** SPORT — a mixed day
  // (TRX noon + volleyball evening) must flip each slot independently.
  const loggedSportToday = (k: SportKind) =>
    sport.sessions.find((s) => s.sport === k && s.date === todayHu) ?? null
  const sportDoneOn = (iso: string | undefined, k: SportKind) =>
    Boolean(iso) && sport.sessions.some((s) => s.sport === k && s.date === huMonthDayDow(iso!))
```

The sport hero branch (replaces the whole `item.kind === 'sport'` block from Task 3; per-sport tag/title, volleyball keeps the váll summary line, cross/TRX get a rounds-free one):

```tsx
        if (item.kind === 'sport') {
          const vb = item.sport
          const k = sportOf(vb)
          const logged = loggedSportToday(k)
          return (
            <div key={`hero-sport-${k}-${vb.time}`} style={{ padding: '0 24px 12px' }}>
              <div className="np-eventrow">
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="col">
                    <div className="np-eventrow-head">
                      <span className="typetag typetag-sport">{SPORT_EMOJI[k]} {SPORT_TAGS[k]}</span>
                      <Display size="sm">{SPORT_TITLES[k]} · {vb.time}</Display>
                    </div>
                    <span className="label-mono text-tertiary mt-sm" style={{ fontSize: 10 }}>
                      {[vb.court, `${vb.duration}p`, vb.role].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <span
                    className="chip notch-4"
                    style={{
                      fontSize: 9, display: 'inline-flex', alignItems: 'center', gap: 4,
                      color: logged ? 'var(--success)' : 'var(--tag-sport)',
                      borderColor: `color-mix(in srgb, ${logged ? 'var(--success)' : 'var(--tag-sport)'} 40%, transparent)`,
                    }}
                  >
                    {logged ? <><Icon name="check" size={10} /> Kész</> : 'MA'}
                  </span>
                </div>
                {logged ? (
                  <button
                    type="button"
                    onClick={() => setSportLogSport(k)}
                    className="row notch-4 mt-md"
                    style={{
                      width: '100%', justifyContent: 'center', gap: 6, padding: '10px 12px',
                      background: 'rgba(52, 211, 153, 0.08)',
                      border: '1px solid color-mix(in srgb, var(--success) 35%, transparent)',
                      color: 'var(--success)', fontSize: 11, fontFamily: 'var(--ff-mono)',
                    }}
                  >
                    <Icon name="check" size={12} />
                    <span>
                      {k === 'volleyball'
                        ? `Logolva · RPE ${logged.rpe} · ${logged.duration}p · váll ${logged.shoulderStrain ?? '–'}`
                        : `Logolva · RPE ${logged.rpe} · ${logged.duration}p`}
                    </span>
                  </button>
                ) : (
                  <CtaGhost
                    className="notch-4 mt-md"
                    onClick={() => setSportLogSport(k)}
                    style={{ borderColor: 'color-mix(in srgb, var(--tag-sport) 40%, transparent)', color: 'var(--tag-sport)' }}
                  >
                    <Icon name="plus" size={12} /> Logold a session-t
                  </CtaGhost>
                )}
              </div>
            </div>
          )
        }
```

WeeklyDayRow wiring:

```tsx
              isSportLogged={(s) => sportDoneOn(a.date, sportOf(s))}
              onLogSport={(s) => setSportLogSport(sportOf(s))}
```

Sheet mount (replaces the `vbLogOpen` block):

```tsx
      {sportLogSport && (
        <SportLogSheet
          initialSport={sportLogSport}
          onClose={() => setSportLogSport(null)}
          onSave={(body, done) => logSportSession(body, { onSuccess: (r) => showLevelUp(r?.levelUp), onSettled: done })}
        />
      )}
```

Bottom-note copy: `A gym a mesociklus szerint, a volleyball recurring · független.` → `A gym a mesociklus szerint, a sport (röpi/cross/TRX) recurring · független.` — and update the existing test's `/A gym a mesociklus szerint/` assertion only if it pinned the full sentence (the substring regex still matches).

- [ ] **Step 4: Run TrainTodayPage + SportLogSheet tests, both modes**

Run: `cd frontend && pnpm test src/features/train/pages/TrainTodayPage.test.tsx src/features/train/sheets/SportLogSheet.test.tsx && VITE_USE_MOCK=true pnpm test src/features/train/pages/TrainTodayPage.test.tsx src/features/train/sheets/SportLogSheet.test.tsx`
Expected: PASS (mock tests unchanged — the mock schedule is all-volleyball, `hero-vb` behaviors map 1:1 onto the volleyball hero).

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(fe/train): per-sport agenda heroes + date+sport done-state (mezo-05v6)"
```

---

### Task 6: SportPage `Heti terv` — multiple slots per day with sport tags

**Files:**
- Modify: `frontend/src/features/train/pages/SportPage.tsx` (`SportWeekView`, ~line 233)
- Test: `frontend/src/features/train/pages/SportPage.test.tsx`

**Interfaces:**
- Consumes: `VolleyballSession.sport?` + `sportOf`/`SPORT_TAGS` (Task 3).
- Produces: the week view renders every slot of a day (stacked inside the day card), each tagged with its sport; hero copy `Heti ritmus · Xh court` → `Heti ritmus · Xh` (mixed hours are no longer all court time).

- [ ] **Step 1: Write the failing test** — follow SportPage.test.tsx's existing real-mode `server.use` idiom (it has schedule-driven tests; reuse its handlers/wrapper):

```tsx
test('real mode: a day with TRX + volleyball slots renders both rows with sport tags', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([
      { id: 'sl-1', dayOfWeek: 1, time: '12:00', durationMin: 60, kind: 'training', sport: 'trx', location: 'Life1 Corvin' },
      { id: 'sl-2', dayOfWeek: 1, time: '19:00', durationMin: 90, kind: 'training', sport: 'volleyball', location: 'BVSC csarnok' },
    ])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
  )
  renderView() // the file's existing render helper; navigate to the Heti terv segment if not default
  expect(await screen.findByText('12:00')).toBeInTheDocument()
  expect(screen.getByText('19:00')).toBeInTheDocument()
  expect(screen.getByText('TRX')).toBeInTheDocument()
  expect(screen.getByText(/Heti ritmus · 2,5h/)).toBeInTheDocument()
})
```

(Adapt the render/segment-switch mechanics to the file's existing tests — it already tests `SportWeekView` content; the assertions above are the contract.)

Run: `cd frontend && pnpm test src/features/train/pages/SportPage.test.tsx`
Expected: FAIL — only one row per day renders (`sessions.find`), no TRX tag.

- [ ] **Step 2: Rework `SportWeekView`'s day loop.** Replace `const session = schedule.sessions.find((s) => s.day === d)` with a list; render one time/duration line per slot inside the same day card, non-volleyball slots get a small sport tag. Keep the card/istoday styling; the inner session block becomes:

```tsx
          const daySlots = schedule.sessions.filter((s) => s.day === d)
          const isToday = daySlots.some((s) => s.today)
```

and where the single `session ? (...)` body rendered time/duration/chips, map instead (import `sportOf`, `SPORT_TAGS` from `@/features/train/logic/sportKinds`):

```tsx
                {daySlots.length ? (
                  <div className="col flex-1 gap-sm">
                    {daySlots.map((session, i) => (
                      <div key={`${session.time}-${i}`} className="row gap-sm" style={{ alignItems: 'center' }}>
                        {sportOf(session) !== 'volleyball' && (
                          <span className="stag stag-sport">{SPORT_TAGS[sportOf(session)]}</span>
                        )}
                        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{session.time}</span>
                        <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--text-tertiary)' }}>
                          · {session.duration}p
                        </span>
                        {/* keep the existing MA chip + role/location spans here, per-slot */}
                      </div>
                    ))}
                  </div>
                ) : (
                  /* keep the existing empty-day rendering */
                )}
```

Port the rest of the original single-session markup (role/location/MA chip) into the per-slot row — same elements, just inside the map. Change the header eyebrow `Heti ritmus · {schedule.weeklyHours}h court` → `Heti ritmus · {schedule.weeklyHours}h` and fix any existing test that asserted the `court` suffix.

- [ ] **Step 3: Run SportPage tests, both modes**

Run: `cd frontend && pnpm test src/features/train/pages/SportPage.test.tsx && VITE_USE_MOCK=true pnpm test src/features/train/pages/SportPage.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/train/pages
git commit -m "feat(fe/train): multi-slot sport week view with sport tags (mezo-05v6)"
```

---

### Task 7: Docs, full gates, ship

**Files:**
- Modify: `docs/features/train.md` (§1 summary, §2 `Mai` + `Sport` sections, §4 "Sport / volleyball · cross · TRX" tables/DTOs)
- No code changes.

**Interfaces:** none — documentation + verification + merge.

- [ ] **Step 1: Update `docs/features/train.md`** (overwrite in place, no changelog):
  - §1/§2 `Mai`: the weekly agenda's volleyball column is now **sport slots** (0..n per day, volleyball/cross/TRX), heroes render per slot, done-state matches **date + sport**, the log CTA pre-selects the slot's sport.
  - §2 `Sport`: `Heti terv` renders multiple slots per day with sport tags; `SportScheduleSheet` is a per-day slot-list editor (sport selector per slot; training|match is volleyball-only).
  - §4 sport section: `sport_schedule_slot` gains `sport` (`ck_sport_schedule_slot_sport` CHECK volleyball|cross|trx, default volleyball; migration `202607141200_mezo-05v6_sport_schedule_slot_sport.sql`); `SportScheduleSlotInput.sport?` (server-defaults volleyball) / `SportScheduleSlotResponse.sport`; note the 🟣 "recurring Tue/Thu TRX" gap is now closed.

- [ ] **Step 2: Lint the docs**

Run: `node scripts/lint-docs.mjs`
Expected: exit 0, no staleness flag on `train.md`.

- [ ] **Step 3: Full frontend gate**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: build OK, ALL tests green in both modes.

- [ ] **Step 4: Focused backend gate**

Run: `cd backend && ./mvnw clean test -Dtest='SportContractIT,SportServiceIT,TrainSeedDataIT'`
Expected: PASS. (The full backend suite runs in CI — do not run it locally.)

- [ ] **Step 5: Commit docs + push + self-PR**

```bash
git add docs/features/train.md
git commit -m "docs(train): sport discriminator on the weekly schedule (mezo-05v6)"
git push -u origin feat/sport-schedule-discriminator
gh pr create --fill --title "feat(train): sport discriminator on the weekly sport schedule (mezo-05v6)"
```

- [ ] **Step 6: Wait for CI green, then merge locally with `--no-ff`**

```bash
gh pr checks --watch
git checkout main && git pull --rebase
git merge --no-ff feat/sport-schedule-discriminator
git push
git branch -d feat/sport-schedule-discriminator && git push origin --delete feat/sport-schedule-discriminator
```

- [ ] **Step 7: Close the bd issue + session close**

```bash
bd close mezo-05v6
git pull --rebase && bd dolt push && git push
git status   # MUST show "up to date with origin"
```
