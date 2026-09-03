# Terv — edzés-szintű záró jegyzet (mezo-d20.8.2.2)

Spec: [`2026-09-01-edzes-jegyzet-design.md`](../specs/2026-09-01-edzes-jegyzet-design.md) ·
Prototípus: `edzes-review.html` (artifact `66f5a4de`)

## S1 — Kontraktus
`api/feature/train/train.yml`:
- `WorkoutNoteRequest { note?: string, maxLength: 1000, nullable }` — az `ExerciseNoteRequest`
  mintájára, egy séma mindkét írási útra.
- `POST /workouts/{id}/finish` += `requestBody: { required: false }` → `WorkoutNoteRequest`,
  += `400`. A body-nélküli hívás változatlanul él (`MesocycleCloseRequest` precedens).
- Új `PUT /workouts/{id}/note` → `WorkoutNoteRequest`, `204/400/401/404`.
- `WorkoutDetailResponse` += `note: { type: string, nullable: true }` (NEM required).
- `cd api/generate && npm run generate:api`; `cd frontend && pnpm generate:api`.
- A `TrainController.finishWorkout` szignatúrája változik → ugyanabban a commitban javítva,
  különben a build bukik.

## S2 — Tárolás
- `backend/src/main/resources/db/changelog/1.0.0/script/202609011200_mezo-d20.8.2.2_workout_session_closing_note.sql`
  — `alter table workout_session add column closing_note text;` + changeSet az `1.0.0_master.yml`
  végén (`id: "1.0.0:202609011200_mezo-d20.8.2.2_workout_session_closing_note"`, `author: daniel.kuhne`).
- `WorkoutSessionEntity` += `@Column(name = "closing_note") private String closingNote;`
  a meglévő `note` MELLÉ (az a terv-napé, ld. spec §3).

## S3 — Backend (TDD)
Tesztek előbb:
- `WorkoutContractIT`: finish jegyzettel perzisztál · finish body nélkül változatlanul működik ·
  **újra-lezárás nem törli** a meglévő jegyzetet · >1000 karakter → 400.
- Új `WorkoutNoteApiIT`: PUT 204 + visszaolvasás · blank → törlés · idegen/ismeretlen → 404 ·
  >1000 → 400.
- `WorkoutDetailContractIT`: `note` a detail válaszban.
Utána:
- `WorkoutService.finishWorkout(userId, id, note)` — **fill-if-empty** (`closeMesocycle:314-336`).
- `WorkoutService.saveClosingNote(userId, id, note)` — last-write-wins, blank → null.
- `getWorkoutDetail` builder += `.note(instance.getClosingNote())`.
- `TrainController` két delegálás; a finish null-toleráns (`req != null ? req.getNote() : null`).
SwitchOffIT **nincs** (a train nem flagelt).

## S4 — Frontend (TDD, mindkét mód)
- `trainApi.finishWorkout(id, body?)` · új `saveWorkoutNote(id, note)`.
- `trainHooks`: a finish mutáció opcionális `note`-ot visz; új `useWorkoutNote()` — mock
  `setQueryData` a detail kulcson, real `PUT` + invalidálás.
- `WorkoutSummary` új propok: `note?: string | null` (closed: olvasó blokk),
  `draftNote`/`onDraftNote` (closing: bekötött mező), `onEditNote?` (review: ✎ / ＋).
  **Mutáció a komponensbe nem kerül** — két hívója van.
- `ActiveWorkoutPage`: a draft az oldalé, `finishAndCelebrate` átadja.
- `WorkoutReviewPage`: `detail.note` + a szerkesztő állapot.
- `prototype.css`: `.wsum-note*` család a prototípus tokenjeivel.
- Mock: `workoutDetailMock` kap jegyzetet, `workoutDetailPrevMock` **nem** (a ＋ út is látszik).
- A két guard-teszt **megfordítva**, nem törölve (`WorkoutSummary.test.tsx:121-132`,
  `WorkoutReviewPage.test.tsx:33-35`).

## S5 — Dokumentáció + goldenek
- `docs/features/train.md` L133/L135 elavult bekezdése javítva (a `mezo-s52z` supersedálva).
- `WorkoutSummary.tsx` fejléc-kommentje újra igaz.
- `docs/CODEMAP.md` regen; vizuális goldenek darwin + linux, a PNG-k **elolvasva**.

## Kapuk
`npx tsc -b` · vitest MINDKÉT módban · `pnpm build` · `lint-docs --errors-only` ·
`gen-codemap --check` · `pnpm test:visual` · backend fókuszált ITk
`-Dmezo.test.use-testcontainers=true`. PR → CI zöld → detached mergetree `--no-ff` → deploy.
