# S2 Onboarding + seed-szétválasztás (mezo-qw37.2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A freshly registered account lands in a three-step onboarding wizard (name confirm + birth date + sex → height + weight → summary) that writes the existing biometric profile + weight contracts and flips `onboarded`; the Én hub and Beállítások read the real account identity (`name`, `email`, password change, logout); and the four owner-specific seeders (`ProtocolSeedData`, `PeopleSeedData`, `GamificationDemoData`, `GoalReevaluateRunner`) leave the prod `demodata` profile for the opt-in `demofixtures` profile so a new user starts on a clean slate.

**Architecture:** No new contract, no new table. The wizard is one page in `features/auth/pages/` rendered by S1's `AuthGate` on a new `'onboarding'` phase (`onboarded=false`, after `mustChangePassword`), and it commits through one new data hook (`useOnboardingActions`) that sequences `PUT /api/biometrics/profile` → `POST /api/biometrics/weight` → `POST /api/auth/onboarding-complete`. `useProfile()` becomes a real-mode read over `useMe()` (mock mode keeps the static `today.ts` `user`). On the backend the four seeders only change their `@Profile`; the per-user lazy bootstraps that already exist (`HabitCatalogService.ensureCatalog`, `GamificationService.ensureProfile` + null-safe reads) are pinned by a registered-user IT instead of being re-implemented.

**Tech Stack:** Spring Boot 4 (CommandLineRunner + `@Profile`), JUnit 5 + Testcontainers ITs, React 19 + TanStack Query 5 + Vitest + MSW, existing Mozaik/Sheet UI primitives.

**Spec:** `docs/superpowers/specs/2026-09-02-multi-user-accounts-design.md` §6 (consumes §5 = S1). **Depends on S1 (`mezo-qw37.1`) being merged** — this plan uses `MeResponse{id,email,name,role,onboarded,mustChangePassword,timezone}`, `POST /api/auth/onboarding-complete`, `useMe()`/`useAuthActions()`/`ME_QUERY_KEY` (`frontend/src/data/auth/authHooks.ts`), `authApi` (`frontend/src/data/auth/authApi.ts`), `tokenStore` (`frontend/src/data/_client/tokenStore.ts`), `AuthGate` + `authState.ts` (`frontend/src/app/auth/`), `AuthShell`/`ErrorLine`/`fieldStyle` (`frontend/src/features/auth/components/AuthShell.tsx`), `ChangePasswordPage` (`frontend/src/features/auth/pages/`), `authErrorText` (`frontend/src/features/auth/logic/authErrorText.ts`), and the `ApiIntegrationTest.registerUser(label) : RegisteredUser(id, email, headers)` helper.

## Global Constraints

- No contract change in S2: `PUT /api/biometrics/profile` (`api/feature/biometrics-profile/biometrics-profile.yml`: `BiometricProfileUpsertRequest{sex '^(M|F)$', heightCm 50..260, birthDate date}` required trio, `activityLevel` optional → server default `MIXED`), `POST /api/biometrics/weight` (`api/feature/weight/weight.yml`: `LogWeightRequest{date, weightKg (0, 999.99]}` → 201), `POST /api/auth/onboarding-complete` (S1) → 204.
- Backend profiles: `demodata` = **prod** (`k8s/backend/deployment.yaml` `SPRING_PROFILES_ACTIVE=demodata`); `demofixtures` = opt-in demo content, always co-activated with `demodata` (`TrainSeedData` precedent: `@Profile("demofixtures")`, needs the demodata owner). ITs that autowire a fixture bean use `@ActiveProfiles({"demodata", "demofixtures"})` (`TrainSeedDataIT` precedent).
- ArchUnit (`backend/src/test/java/io/mrkuhne/mezo/ArchitectureTest.java`): tests and beans keep their packages; constructor injection only; no class-level `@Transactional`.
- Backend focused gate: `cd backend && ./mvnw test -Dtest='OwnerSeedDataIT,ProtocolSeedDataIT,GoalReevaluateRunnerIT,TrainSeedDataIT,AuthOnboardingIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true`. CI runs the full suite.
- Frontend gate: `cd frontend && VITE_USE_MOCK=true pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build` (unset `VITE_USE_MOCK` = mock — `frontend/src/data/_client/mode.ts`).
- Frontend rules (`AGENTS.md` §Frontend): features import hooks from `@/data/hooks` only; `isMockMode()` is called inside hook/component bodies, never at module scope; dual-mode reads never fall back to the mock seed in real mode; routed leaves are `*Page`, modals `*Sheet` in `sheets/`, pure logic in `logic/`; `shared/ui` stays domain-free; Hungarian UI copy.
- Docs: every touched feature doc updated in the same change; `node scripts/gen-codemap.mjs` regenerates `docs/CODEMAP.md` (never hand-edit); `node scripts/lint-docs.mjs --errors-only` clean.
- Conventional commits carry the bd id: `feat(auth): … (mezo-qw37.2)`. Branch: `feat/multi-user-s2-onboarding-seeds`.

---

## File Structure

**Backend — modify**
- `backend/src/main/java/io/mrkuhne/mezo/feature/fuel/ProtocolSeedData.java` — `@Profile("demofixtures")`, javadoc.
- `backend/src/main/java/io/mrkuhne/mezo/feature/people/PeopleSeedData.java` — same.
- `backend/src/main/java/io/mrkuhne/mezo/feature/gamification/GamificationDemoData.java` — same.
- `backend/src/main/java/io/mrkuhne/mezo/feature/goal/GoalReevaluateRunner.java` — same.
- Tests: `feature/auth/OwnerSeedDataIT.java` (four "bean absent under plain demodata" asserts), `feature/fuel/ProtocolSeedDataIT.java` + `feature/goal/GoalReevaluateRunnerIT.java` (`@ActiveProfiles({"demodata", "demofixtures"})`).

**Backend — create**
- `backend/src/test/java/io/mrkuhne/mezo/feature/auth/AuthOnboardingIT.java` — registered user: lazy bootstraps (gamification ghost profile, habit catalog, empty people) + the wizard's three-call sequence end-to-end.

**Frontend — create**
- `frontend/src/data/auth/onboardingHooks.ts` — `useOnboardingActions()` (the three-call commit, dual-mode).
- `frontend/src/features/auth/logic/onboardingSteps.ts` — contract bounds, clamp, birth-date validation, summary lines (pure).
- `frontend/src/features/auth/components/StepField.tsx` — decimal-capable `NumberStep` sibling with min/max clamp.
- `frontend/src/features/auth/pages/OnboardingPage.tsx` — the 3-step wizard.
- `frontend/src/features/auth/components/ChangePasswordForm.tsx` — the form extracted from S1's `ChangePasswordPage` (shared by page + sheet).
- `frontend/src/features/auth/sheets/ChangePasswordSheet.tsx` — the Beállítások entry.
- Tests next to each file.

**Frontend — modify**
- `frontend/src/app/auth/authState.ts` (+ `'onboarding'`), `frontend/src/app/auth/AuthGate.tsx` (renders `OnboardingPage`).
- `frontend/src/data/me/meHooks.ts` (`useProfile` real mode), `frontend/src/data/hooks.ts` (export `useOnboardingActions`).
- `frontend/src/features/auth/pages/ChangePasswordPage.tsx` (uses `ChangePasswordForm`).
- `frontend/src/features/me/pages/BeallitasokPage.tsx` (+ "Fiók" group), `frontend/src/features/me/pages/EnHubPage.tsx` (no code change expected — `user.name` keeps working; a real-mode test is added).
- `frontend/src/test/msw/handlers.ts` — no new handlers needed (`/api/auth/*` from S1, `/api/biometrics/*` already present); tests capture bodies with `server.use`.

**Docs**
- `docs/features/me.md` §3/§4/§9 (`useProfile` decision reversal, `PeopleSeedData` profile), `docs/features/_platform-auth-security.md` §2 onboarding + §8, `docs/features/fuel.md`, `docs/features/growth.md`, `docs/features/goal-engine.md`, `docs/features/_platform-api-backend.md`, `docs/references/integration_test_framework.md`, `docs/CODEMAP.md` (regenerated).

---

### Task 1: Backend — the four owner seeders move from `demodata` to `demofixtures`

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/fuel/ProtocolSeedData.java:24-35`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/people/PeopleSeedData.java:17-29`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/gamification/GamificationDemoData.java:22-52`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/GoalReevaluateRunner.java:19-35`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/auth/OwnerSeedDataIT.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/fuel/ProtocolSeedDataIT.java`, `backend/src/test/java/io/mrkuhne/mezo/feature/goal/GoalReevaluateRunnerIT.java`

**Interfaces:**
- Consumes: nothing new. `OwnerSeedData` stays `@Profile("demodata") @Order(0)`; `ResetDatabase` already TRUNCATEs `pantry_item`, `protocol`, `person`, `gamification_profile`, `coin_event`, `goal` — so no IT ever depended on the boot-time rows, only the two ITs that call `.run()` explicitly.
- Produces: the guarantee "a plain `demodata` boot creates the owner and nothing else owner-specific" (pinned in `OwnerSeedDataIT`).

- [ ] **Step 1: Write the failing bean-absence test**

Append to `OwnerSeedDataIT.java` (add imports `io.mrkuhne.mezo.feature.fuel.ProtocolSeedData`, `io.mrkuhne.mezo.feature.gamification.GamificationDemoData`, `io.mrkuhne.mezo.feature.goal.GoalReevaluateRunner`, `io.mrkuhne.mezo.feature.people.PeopleSeedData`):

```java
    /**
     * S2 (mezo-qw37.2): the owner-specific seeders are opt-in demo content now. A prod
     * ({@code demodata}) boot must create the owner and nothing else — a registered user's
     * first touch bootstraps their own gamification profile / habit catalog lazily.
     */
    @Test
    void testDemodataProfile_shouldNotRegisterOwnerFixtureSeeds_whenFixturesProfileAbsent() {
        assertThat(applicationContext.getBeanProvider(ProtocolSeedData.class).getIfAvailable()).isNull();
        assertThat(applicationContext.getBeanProvider(PeopleSeedData.class).getIfAvailable()).isNull();
        assertThat(applicationContext.getBeanProvider(GamificationDemoData.class).getIfAvailable()).isNull();
        assertThat(applicationContext.getBeanProvider(GoalReevaluateRunner.class).getIfAvailable()).isNull();
    }
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw test -Dtest='OwnerSeedDataIT' -Dmezo.test.use-testcontainers=true`
Expected: FAIL — the four beans are present under `demodata`.

- [ ] **Step 3: Flip the four `@Profile`s and reword the javadocs**

`ProtocolSeedData.java`: change `@Profile("demodata")` → `@Profile("demofixtures")`. In the class javadoc replace the sentence starting `{@code @Profile("demodata")} is the profile prod runs, so the rows land on the live DB at the next deploy.` with:

```java
 * {@code @Profile("demofixtures")} (S2, mezo-qw37.2): opt-in demo content for the OWNER's account
 * only — a plain {@code demodata} (prod) boot seeds no pantry rows or protocol, so a registered
 * user starts with an empty Kamra/Stack. Run with
 * {@code --spring.profiles.active=demodata,demofixtures} to load it (needs the demodata owner).
```

`PeopleSeedData.java`: change `@Profile("demodata")` → `@Profile("demofixtures")`. Replace the whole class javadoc with:

```java
/**
 * Seeds the owner's IDENT-5 PERMA-R inner circle (5 persons). Until S2 (mezo-qw37.2) this ran
 * under plain {@code demodata} as a deliberate exception (v1 had no person-create UI); with
 * multi-user accounts the owner's real people must not appear in every new account, so it is
 * opt-in {@code demofixtures} content now — {@code POST /api/people} is the live write path.
 * Mention-derived stats are NOT seeded — they are computed from live mention rows. Idempotent:
 * no-op if any person exists. Needs the demodata owner ({@code demodata,demofixtures}).
 */
```

`GamificationDemoData.java`: change `@Profile("demodata")` → `@Profile("demofixtures")`. In the javadoc replace `no-op on a non-demodata boot` with `no-op without the demodata owner`, and replace `last among the plain-{@code demodata}\n * seeders` with `last among the {@code demofixtures} seeders (S2, mezo-qw37.2: opt-in — a registered user gets their\n * profile lazily from {@code GamificationService#ensureProfile} on the first purchase/award, and reads\n * are null-safe ghost zeros before that)`. Keep `@Order(135)`.

`GoalReevaluateRunner.java`: change `@Profile("demodata")` → `@Profile("demofixtures")`. Replace the sentence `{@code @Profile("demodata")} — the prod-active profile — so the bean only exists in a\n * demodata context; integration tests annotate {@code @ActiveProfiles("demodata")} and call the no-arg\n * {@link #run()} overload.` with:

```java
 * {@code @Profile("demofixtures")} (S2, mezo-qw37.2) — the reconciliation only ever concerned the
 * owner's pre-NEAT-migration goal and is done on the live DB; it stays available as an opt-in
 * fixture runner. Integration tests annotate {@code @ActiveProfiles({"demodata", "demofixtures"})}
 * and call the no-arg {@link #run()} overload.
```

- [ ] **Step 4: Re-profile the two ITs that autowire the moved beans**

`ProtocolSeedDataIT.java`: add `import org.springframework.test.context.ActiveProfiles;` and annotate the class:

```java
/** The demofixtures protocol seeder (S2: opt-in, no longer a prod seed): two real stim products
 *  by-name-idempotently + two engine-placed living-protocol occurrences, only when the owner has
 *  no active protocol yet — an existing active protocol is never touched (spec D6). */
@ActiveProfiles({"demodata", "demofixtures"})
class ProtocolSeedDataIT extends ApiIntegrationTest {
```

(`ApiIntegrationTest` carries `@ActiveProfiles("demodata")`; the subclass annotation replaces it, hence both names.)

`GoalReevaluateRunnerIT.java`: change `@ActiveProfiles("demodata")` → `@ActiveProfiles({"demodata", "demofixtures"})` and in the javadoc replace `The runner is {@code @Profile("demodata")}, so the bean only exists under that profile — hence\n * {@code @ActiveProfiles("demodata")}.` with `The runner is {@code @Profile("demofixtures")} (S2), so the bean only exists with both profiles\n * — hence {@code @ActiveProfiles({"demodata", "demofixtures"})}.`

- [ ] **Step 5: Run the focused seed gate**

Run: `cd backend && ./mvnw test -Dtest='OwnerSeedDataIT,ProtocolSeedDataIT,GoalReevaluateRunnerIT,TrainSeedDataIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true`
Expected: PASS (the two re-profiled ITs boot a `demodata,demofixtures` context — the same cached context `TrainSeedDataIT` uses).

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/fuel/ProtocolSeedData.java backend/src/main/java/io/mrkuhne/mezo/feature/people/PeopleSeedData.java backend/src/main/java/io/mrkuhne/mezo/feature/gamification/GamificationDemoData.java backend/src/main/java/io/mrkuhne/mezo/feature/goal/GoalReevaluateRunner.java backend/src/test/java/io/mrkuhne/mezo/feature/auth/OwnerSeedDataIT.java backend/src/test/java/io/mrkuhne/mezo/feature/fuel/ProtocolSeedDataIT.java backend/src/test/java/io/mrkuhne/mezo/feature/goal/GoalReevaluateRunnerIT.java
git commit -m "refactor(seed): owner-specific seeders move from demodata to opt-in demofixtures (mezo-qw37.2)"
```

---

### Task 2: Backend — registered-user bootstrap + onboarding sequence IT

**Files:**
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/auth/AuthOnboardingIT.java`

**Interfaces:**
- Consumes: `ApiIntegrationTest.registerUser(String) : RegisteredUser(id, email, headers)` (S1 Task 6); generated DTOs `MeResponse`, `BiometricProfileUpsertRequest` (Lombok builder — `BiometricsContractIT` precedent), `BiometricProfileResponse`, `LogWeightRequest(LocalDate, BigDecimal, String)` (all-args constructor — `WeightLogServiceIT` precedent), `WeightLogResponse`, `GamificationProfileResponse`, `HabitDayResponse`, `PeopleResponse`.
- Produces: the pinned guarantee that a fresh USER gets lazy per-user bootstraps (`GamificationService.toProfileResponse` ghost zeros + `TitleCatalog.DEFAULT_TITLE_KEY = "ujonc"`, `HabitCatalogService.ensureCatalog` → 15 defs) and no owner fixtures, and that the wizard's exact call order works end-to-end.

- [ ] **Step 1: Write the IT**

```java
package io.mrkuhne.mezo.feature.auth;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.BiometricProfileResponse;
import io.mrkuhne.mezo.api.dto.BiometricProfileUpsertRequest;
import io.mrkuhne.mezo.api.dto.GamificationProfileResponse;
import io.mrkuhne.mezo.api.dto.HabitDayResponse;
import io.mrkuhne.mezo.api.dto.LogWeightRequest;
import io.mrkuhne.mezo.api.dto.MeResponse;
import io.mrkuhne.mezo.api.dto.PeopleResponse;
import io.mrkuhne.mezo.api.dto.WeightLogResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/**
 * S2 (mezo-qw37.2): a freshly registered USER lands on a clean slate — no owner fixtures — and
 * the surfaces that used to lean on the demodata seeders bootstrap themselves lazily per user
 * (gamification ghost profile, habit catalog import). The second test walks the OnboardingPage's
 * exact three-call sequence against the real contracts.
 */
class AuthOnboardingIT extends ApiIntegrationTest {

    @Test
    void testFreshUser_shouldGetLazyBootstrapsAndNoOwnerFixtures_whenFirstTouch() {
        RegisteredUser anna = registerUser("Anna");

        GamificationProfileResponse gam = getForBody("/api/gamification/profile",
            anna.headers(), HttpStatus.OK, GamificationProfileResponse.class);
        assertThat(gam.getCoins()).isZero();
        assertThat(gam.getStreakDays()).isZero();
        assertThat(gam.getLevel()).isEqualTo(1);
        assertThat(gam.getEquippedTitleKey()).isEqualTo("ujonc");

        HabitDayResponse day = getForBody("/api/habit/day/" + LocalDate.now(),
            anna.headers(), HttpStatus.OK, HabitDayResponse.class);
        assertThat(day.getHabits()).hasSize(15); // HabitCatalogService.ensureCatalog imported the seed JSON for Anna

        PeopleResponse people = getForBody("/api/people", anna.headers(), HttpStatus.OK, PeopleResponse.class);
        assertThat(people.getPersons()).isEmpty(); // PeopleSeedData is demofixtures-only now

        BiometricProfileResponse profile = getForBody("/api/biometrics/profile",
            anna.headers(), HttpStatus.OK, BiometricProfileResponse.class);
        assertThat(profile.getBirthDate()).isNull(); // the honest "not set up" 200 (mezo-5cmq)
    }

    @Test
    void testOnboardingSequence_shouldLandProfileWeightAndFlag_whenWizardOrder() {
        RegisteredUser bela = registerUser("Béla");
        assertThat(getForBody("/api/auth/me", bela.headers(), HttpStatus.OK, MeResponse.class).getOnboarded()).isFalse();

        // 1) PUT profile — sex/heightCm/birthDate are the NOT NULL trio, so they go together.
        putForBody("/api/biometrics/profile",
            BiometricProfileUpsertRequest.builder()
                .sex("M").heightCm(new BigDecimal("181")).birthDate(LocalDate.of(1993, 5, 14))
                .build(),
            bela.headers(), HttpStatus.OK, BiometricProfileResponse.class);
        // 2) POST today's weigh-in.
        postForBody("/api/biometrics/weight",
            new LogWeightRequest(LocalDate.now(), new BigDecimal("84.5"), null),
            bela.headers(), HttpStatus.CREATED, WeightLogResponse.class);
        // 3) Flag the account onboarded.
        postForBody("/api/auth/onboarding-complete", null, bela.headers(), HttpStatus.NO_CONTENT, Void.class);

        MeResponse me = getForBody("/api/auth/me", bela.headers(), HttpStatus.OK, MeResponse.class);
        assertThat(me.getOnboarded()).isTrue();

        BiometricProfileResponse profile = getForBody("/api/biometrics/profile",
            bela.headers(), HttpStatus.OK, BiometricProfileResponse.class);
        assertThat(profile.getHeightCm()).isEqualByComparingTo(new BigDecimal("181"));
        assertThat(profile.getActivityLevel()).isNotNull(); // server default MIXED when the wizard sends none
        assertThat(profile.getTdeeBootstrap()).isNotNull(); // profile + latest weigh-in pair → derived base TDEE

        List<WeightLogResponse> log = getForList("/api/biometrics/weight", bela.headers(), HttpStatus.OK, WeightLogResponse.class);
        assertThat(log).hasSize(1);
        assertThat(log.getFirst().getValue()).isEqualByComparingTo(new BigDecimal("84.5"));
    }
}
```

(If the generated `BiometricProfileResponse.getActivityLevel()` is an enum, the `isNotNull()` assert still compiles; if `getValue()` is a `Double`, replace the last assert with `isEqualTo(84.5)` — check `target/generated-sources` after the first build.)

- [ ] **Step 2: Run it**

Run: `cd backend && ./mvnw test -Dtest='AuthOnboardingIT' -Dmezo.test.use-testcontainers=true`
Expected: PASS on the first run — this IT pins existing behaviour after Task 1 (it fails only if Task 1 was not applied: `people.getPersons()` would still be empty because `ResetDatabase` truncates `person`, so the real proof of Task 1 is `OwnerSeedDataIT`; this test documents the user-facing consequence). If `equippedTitleKey` comes back null instead of `"ujonc"`, the response mapper diverged from `GamificationService.toProfileResponse` — fix the mapper, not the test.

- [ ] **Step 3: Commit**

```bash
git add backend/src/test/java/io/mrkuhne/mezo/feature/auth/AuthOnboardingIT.java
git commit -m "test(auth): registered user gets lazy bootstraps + the onboarding call sequence works end-to-end (mezo-qw37.2)"
```

---

### Task 3: Frontend — `useOnboardingActions()` data hook

**Files:**
- Create: `frontend/src/data/auth/onboardingHooks.ts`
- Modify: `frontend/src/data/hooks.ts`
- Test: `frontend/src/data/auth/onboardingHooks.test.tsx`

**Interfaces:**
- Consumes: `authApi.completeOnboarding()` (S1), `ME_QUERY_KEY` (S1), `biometricProfileApi.upsert(BiometricProfileUpsertRequest)` (`frontend/src/data/me/biometricProfileApi.ts`), `weightApi.log(WeightLogInput)` (`frontend/src/data/me/biometricsApi.ts`; `WeightLogInput = { date: string; weightKg: number; note?: string }`), `localDateString()` (`frontend/src/shared/lib/dates.ts`), `isMockMode()`.
- Produces: `export interface OnboardingInput { sex: 'M' | 'F'; heightCm: number; birthDate: string; weightKg: number }`; `useOnboardingActions() : { complete: (input: OnboardingInput) => Promise<void>; pending: boolean }`. Exported from `@/data/hooks`.

- [ ] **Step 1: Write the failing hook test**

`onboardingHooks.test.tsx`:

```tsx
import { renderHook, act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'
import { API_BASE, setToken } from '@/data/_client/api'
import { useOnboardingActions } from '@/data/auth/onboardingHooks'
import { localDateString } from '@/shared/lib/dates'

afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

function captureCalls() {
  const calls: { url: string; body: unknown }[] = []
  server.use(
    http.put(`${API_BASE}/api/biometrics/profile`, async ({ request }) => {
      calls.push({ url: 'profile', body: await request.json() })
      return HttpResponse.json({ sex: 'F', heightCm: 168, birthDate: '1994-02-11', activityLevel: 'MIXED', tdeeBootstrap: null })
    }),
    http.post(`${API_BASE}/api/biometrics/weight`, async ({ request }) => {
      calls.push({ url: 'weight', body: await request.json() })
      return HttpResponse.json({ id: 'w9', date: localDateString(), value: 61.5, note: null }, { status: 201 })
    }),
    http.post(`${API_BASE}/api/auth/onboarding-complete`, () => {
      calls.push({ url: 'complete', body: null })
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return calls
}

test('real mode: complete() runs profile → weight → onboarding-complete in that order with the contract bodies', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  const calls = captureCalls()
  const { result } = renderHook(() => useOnboardingActions(), { wrapper: makeHookWrapper() })
  await act(() => result.current.complete({ sex: 'F', heightCm: 168, birthDate: '1994-02-11', weightKg: 61.5 }))
  expect(calls.map((c) => c.url)).toEqual(['profile', 'weight', 'complete'])
  expect(calls[0].body).toEqual({ sex: 'F', heightCm: 168, birthDate: '1994-02-11', activityLevel: 'MIXED' })
  expect(calls[1].body).toEqual({ date: localDateString(), weightKg: 61.5 })
  await waitFor(() => expect(result.current.pending).toBe(false))
})

test('real mode: a failing profile PUT rejects before the weight is logged', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  const calls = captureCalls()
  server.use(http.put(`${API_BASE}/api/biometrics/profile`, () =>
    HttpResponse.json([{ code: 'VALIDATION_INVALID_VALUE', message: 'x', fieldName: 'heightCm' }], { status: 400 })))
  const { result } = renderHook(() => useOnboardingActions(), { wrapper: makeHookWrapper() })
  await expect(result.current.complete({ sex: 'M', heightCm: 10, birthDate: '1994-02-11', weightKg: 61.5 })).rejects.toBeDefined()
  expect(calls).toEqual([])
})

test('mock mode: complete() resolves without touching the network', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const calls = captureCalls()
  const { result } = renderHook(() => useOnboardingActions(), { wrapper: makeHookWrapper() })
  await act(() => result.current.complete({ sex: 'M', heightCm: 181, birthDate: '1993-05-14', weightKg: 84.5 }))
  expect(calls).toEqual([])
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && VITE_USE_MOCK=false pnpm test src/data/auth/onboardingHooks`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `onboardingHooks.ts`**

```ts
import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { authApi } from '@/data/auth/authApi'
import { ME_QUERY_KEY } from '@/data/auth/authHooks'
import { biometricProfileApi } from '@/data/me/biometricProfileApi'
import { weightApi } from '@/data/me/biometricsApi'
import { localDateString } from '@/shared/lib/dates'

/** What the OnboardingPage collects — exactly the NOT NULL trio of the biometric profile + today's weigh-in. */
export interface OnboardingInput {
  sex: 'M' | 'F'
  heightCm: number
  birthDate: string // YYYY-MM-DD
  weightKg: number
}

/**
 * The onboarding commit (S2, mezo-qw37.2): PUT /api/biometrics/profile → POST /api/biometrics/weight
 * (today) → POST /api/auth/onboarding-complete, in that order, then invalidate everything the three
 * writes touch. No new contract: the wizard reuses the biometrics + weight endpoints verbatim.
 * A retry after a partial failure re-runs all three — the profile PUT is an upsert, the flag is
 * idempotent, and a second same-day weigh-in row only nudges the EWMA trend.
 * Mock mode resolves without network (the static seeds already describe an onboarded owner).
 */
export function useOnboardingActions() {
  const qc = useQueryClient()
  const mock = isMockMode()
  const [pending, setPending] = useState(false)

  const complete = useCallback(async (input: OnboardingInput): Promise<void> => {
    if (mock) return
    setPending(true)
    try {
      await biometricProfileApi.upsert({
        sex: input.sex, heightCm: input.heightCm, birthDate: input.birthDate, activityLevel: 'MIXED',
      })
      await weightApi.log({ date: localDateString(), weightKg: input.weightKg })
      await authApi.completeOnboarding()
      await Promise.all([
        qc.invalidateQueries({ queryKey: ME_QUERY_KEY }),
        qc.invalidateQueries({ queryKey: ['biometricProfile'] }),
        qc.invalidateQueries({ queryKey: ['weightLog'] }),
        qc.invalidateQueries({ queryKey: ['weightTrend'] }),
        qc.invalidateQueries({ queryKey: ['goals'] }),
      ])
    } finally {
      setPending(false)
    }
  }, [mock, qc])

  return { complete, pending }
}
```

Add to `frontend/src/data/hooks.ts` right after the S1 auth export line:

```ts
export { useOnboardingActions } from '@/data/auth/onboardingHooks'
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && VITE_USE_MOCK=false pnpm test src/data/auth/onboardingHooks && VITE_USE_MOCK=true pnpm test src/data/auth/onboardingHooks`
Expected: PASS in both modes.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data/auth/onboardingHooks.ts frontend/src/data/auth/onboardingHooks.test.tsx frontend/src/data/hooks.ts
git commit -m "feat(fe): useOnboardingActions — profile → weight → onboarding-complete commit hook (mezo-qw37.2)"
```

---

### Task 4: Frontend — `onboardingSteps.ts`, `StepField`, `OnboardingPage`

**Files:**
- Create: `frontend/src/features/auth/logic/onboardingSteps.ts`, `frontend/src/features/auth/components/StepField.tsx`, `frontend/src/features/auth/pages/OnboardingPage.tsx`
- Test: `frontend/src/features/auth/logic/onboardingSteps.test.ts`, `frontend/src/features/auth/pages/OnboardingPage.test.tsx`

**Interfaces:**
- Consumes: `useOnboardingActions` (Task 3, via `@/data/hooks`), `AuthShell`/`ErrorLine`/`fieldStyle` (S1), `authErrorText` (S1), `Stepper` (`frontend/src/shared/ui/Stepper.tsx`: `{ title, step, total, stepLabel? }`), `Icon` (`frontend/src/shared/ui/Icon.tsx`, names `minus`/`plus`), `useEditableNumber` (`frontend/src/features/train/logic/useEditableNumber.ts`: `{ value, onChange, min?, max?, integer? }` → input props with clamp-on-blur), `hu1` (`frontend/src/shared/lib/huNum.ts`), `localDateString()`.
- Produces: `OnboardingPage({ name: string; onSuccess: () => void | Promise<void> })`; `StepField({ label, val, step, min, max, unit, integer?, onChange })`; pure `HEIGHT_CM`, `WEIGHT_KG`, `BIRTH_DATE_MIN`, `clamp`, `birthDateValid`, `summaryLines`, `OnboardingDraft`.

- [ ] **Step 1: Write the failing pure-logic test**

`onboardingSteps.test.ts`:

```ts
import { BIRTH_DATE_MIN, HEIGHT_CM, WEIGHT_KG, birthDateValid, clamp, summaryLines } from '@/features/auth/logic/onboardingSteps'

test('bounds mirror the contracts (heightCm 50..260, weightKg inside (0, 999.99])', () => {
  expect(HEIGHT_CM).toMatchObject({ min: 50, max: 260 })
  expect(WEIGHT_KG).toMatchObject({ min: 1, max: 999.9 })
  expect(clamp(999, HEIGHT_CM.min, HEIGHT_CM.max)).toBe(260)
  expect(clamp(0, WEIGHT_KG.min, WEIGHT_KG.max)).toBe(1)
  expect(clamp(72.5, WEIGHT_KG.min, WEIGHT_KG.max)).toBe(72.5)
})

test('a birth date must be set, after the floor and before today', () => {
  expect(birthDateValid('', '2026-09-02')).toBe(false)
  expect(birthDateValid('1899-12-31', '2026-09-02')).toBe(false)
  expect(birthDateValid('2026-09-02', '2026-09-02')).toBe(false)
  expect(birthDateValid('1993-05-14', '2026-09-02')).toBe(true)
  expect(BIRTH_DATE_MIN).toBe('1900-01-01')
})

test('the summary lists name, birth date, sex, height and weight in Hungarian', () => {
  expect(summaryLines('Béla', { sex: 'M', birthDate: '1993-05-14', heightCm: 181, weightKg: 84.5 })).toEqual([
    'Név: Béla', 'Születési dátum: 1993-05-14', 'Nem: Férfi', 'Magasság: 181 cm', 'Súly: 84,5 kg',
  ])
  expect(summaryLines('Anna', { sex: 'F', birthDate: '1994-02-11', heightCm: 168, weightKg: 61 })[2]).toBe('Nem: Nő')
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test src/features/auth/logic/onboardingSteps`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `onboardingSteps.ts`**

```ts
import { hu1 } from '@/shared/lib/huNum'

/** BiometricProfileUpsertRequest.heightCm — `minimum: 50, maximum: 260` (api/feature/biometrics-profile). */
export const HEIGHT_CM = { min: 50, max: 260, step: 1, initial: 175 } as const
/** LogWeightRequest.weightKg — `exclusiveMinimum 0, maximum 999.99` (api/feature/weight); 1-decimal UI. */
export const WEIGHT_KG = { min: 1, max: 999.9, step: 0.5, initial: 75 } as const
export const BIRTH_DATE_MIN = '1900-01-01'

export interface OnboardingDraft {
  sex: 'M' | 'F'
  birthDate: string // YYYY-MM-DD, '' until picked
  heightCm: number
  weightKg: number
}

export const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n))

/** ISO dates compare lexicographically == chronologically (DatePicker's rule). */
export function birthDateValid(iso: string, todayIso: string): boolean {
  return iso.length === 10 && iso >= BIRTH_DATE_MIN && iso < todayIso
}

export const SEX_LABEL: Record<'M' | 'F', string> = { M: 'Férfi', F: 'Nő' }

export function summaryLines(name: string, d: OnboardingDraft): string[] {
  return [
    `Név: ${name}`,
    `Születési dátum: ${d.birthDate}`,
    `Nem: ${SEX_LABEL[d.sex]}`,
    `Magasság: ${d.heightCm} cm`,
    `Súly: ${hu1(d.weightKg)} kg`,
  ]
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test src/features/auth/logic/onboardingSteps`
Expected: PASS.

- [ ] **Step 5: Implement `StepField.tsx`**

```tsx
import { Icon } from '@/shared/ui/Icon'
import { hu1 } from '@/shared/lib/huNum'
import { useEditableNumber } from '@/features/train/logic/useEditableNumber'
import { clamp } from '@/features/auth/logic/onboardingSteps'

/**
 * The Train sheets' NumberStep (label + big value + 44px ± buttons on `.stepper`), re-cut for the
 * onboarding wizard: decimal-capable (weight) and ALWAYS clamped to the contract bounds — both the
 * ± buttons and the tap-to-edit display (`useEditableNumber` clamps on blur) — so the payload can
 * never earn a 400. `useEditableNumber` is domain-free and lives in train/logic for historical
 * reasons; importing it beats a third copy.
 */
export function StepField({ label, val, step, min, max, unit, integer = false, onChange }: {
  label: string
  val: number
  step: number
  min: number
  max: number
  unit: string
  integer?: boolean
  onChange: (next: number) => void
}) {
  const editable = useEditableNumber({ value: val, onChange, min, max, integer })
  const shown = integer ? String(val) : hu1(val)
  return (
    <div className="col gap-sm">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="label-mono">{label}</span>
        <span style={{ fontFamily: 'var(--ff-display)', fontSize: 22, fontWeight: 600, lineHeight: 1 }}>
          {shown} <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)' }}>{unit}</span>
        </span>
      </div>
      <div className="stepper rad-12">
        <button type="button" aria-label={`${label} csökkentése`}
          onClick={() => onChange(clamp(+(val - step).toFixed(1), min, max))}>
          <Icon name="minus" size={14} />
        </button>
        <input
          {...editable}
          aria-label={label}
          className="stepper-display"
          style={{ border: 'none', background: 'transparent', width: '100%', minWidth: 0, padding: 0 }}
        />
        <button type="button" aria-label={`${label} növelése`}
          onClick={() => onChange(clamp(+(val + step).toFixed(1), min, max))}>
          <Icon name="plus" size={14} />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Write the failing `OnboardingPage` test**

`OnboardingPage.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE, setToken } from '@/data/_client/api'
import { QueryWrapper } from '@/test/queryWrapper'
import { OnboardingPage } from '@/features/auth/pages/OnboardingPage'
import { localDateString } from '@/shared/lib/dates'

afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

function captureCalls() {
  const calls: { url: string; body: unknown }[] = []
  server.use(
    http.put(`${API_BASE}/api/biometrics/profile`, async ({ request }) => {
      calls.push({ url: 'profile', body: await request.json() })
      return HttpResponse.json({ sex: 'M', heightCm: 181, birthDate: '1993-05-14', activityLevel: 'MIXED', tdeeBootstrap: null })
    }),
    http.post(`${API_BASE}/api/biometrics/weight`, async ({ request }) => {
      calls.push({ url: 'weight', body: await request.json() })
      return HttpResponse.json({ id: 'w9', date: localDateString(), value: 84.5, note: null }, { status: 201 })
    }),
    http.post(`${API_BASE}/api/auth/onboarding-complete`, () => {
      calls.push({ url: 'complete', body: null })
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return calls
}

const renderPage = (onSuccess = vi.fn()) => {
  render(<QueryWrapper><OnboardingPage name="Béla" onSuccess={onSuccess} /></QueryWrapper>)
  return onSuccess
}

async function walkToSummary() {
  // step 1: sex + birth date
  await userEvent.click(screen.getByRole('button', { name: 'Férfi' }))
  await userEvent.type(screen.getByLabelText('Születési dátum'), '1993-05-14')
  await userEvent.click(screen.getByRole('button', { name: 'Tovább' }))
  // step 2: height 175→181 (+6), weight 75→84.5 (type)
  for (let i = 0; i < 6; i++) await userEvent.click(screen.getByRole('button', { name: 'Magasság növelése' }))
  const weight = screen.getByLabelText('Súly')
  await userEvent.clear(weight)
  await userEvent.type(weight, '84,5')
  await userEvent.tab()
  await userEvent.click(screen.getByRole('button', { name: 'Tovább' }))
}

test('real mode: the three steps commit profile → weight → onboarding-complete and call onSuccess', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  const calls = captureCalls()
  const onSuccess = renderPage()
  expect(screen.getByRole('heading', { name: 'Első lépések' })).toBeInTheDocument()
  expect(screen.getByText('Szia, Béla!')).toBeInTheDocument()
  await walkToSummary()
  expect(screen.getByText('Magasság: 181 cm')).toBeInTheDocument()
  expect(screen.getByText('Súly: 84,5 kg')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Kezdjük' }))
  await waitFor(() => expect(onSuccess).toHaveBeenCalled())
  expect(calls.map((c) => c.url)).toEqual(['profile', 'weight', 'complete'])
  expect(calls[0].body).toEqual({ sex: 'M', heightCm: 181, birthDate: '1993-05-14', activityLevel: 'MIXED' })
  expect(calls[1].body).toEqual({ date: localDateString(), weightKg: 84.5 })
})

test('Tovább stays disabled until a valid birth date is picked', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  renderPage()
  expect(screen.getByRole('button', { name: 'Tovább' })).toBeDisabled()
  await userEvent.type(screen.getByLabelText('Születési dátum'), '1993-05-14')
  expect(screen.getByRole('button', { name: 'Tovább' })).toBeEnabled()
})

test('typed values clamp to the contract bounds on blur', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  renderPage()
  await userEvent.type(screen.getByLabelText('Születési dátum'), '1993-05-14')
  await userEvent.click(screen.getByRole('button', { name: 'Tovább' }))
  const height = screen.getByLabelText('Magasság')
  await userEvent.clear(height)
  await userEvent.type(height, '999')
  await userEvent.tab()
  expect(height).toHaveValue('260')
  const weight = screen.getByLabelText('Súly')
  await userEvent.clear(weight)
  await userEvent.type(weight, '0')
  await userEvent.tab()
  expect(weight).toHaveValue('1')
})

test('a server error on commit stays inline and keeps the summary', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  captureCalls()
  server.use(http.put(`${API_BASE}/api/biometrics/profile`, () => HttpResponse.error()))
  const onSuccess = renderPage()
  await walkToSummary()
  await userEvent.click(screen.getByRole('button', { name: 'Kezdjük' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Nem sikerült kapcsolódni. Próbáld újra.')
  expect(onSuccess).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Kezdjük' })).toBeEnabled()
})

test('mock mode: the wizard completes without the network', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const calls = captureCalls()
  const onSuccess = renderPage()
  await walkToSummary()
  await userEvent.click(screen.getByRole('button', { name: 'Kezdjük' }))
  await waitFor(() => expect(onSuccess).toHaveBeenCalled())
  expect(calls).toEqual([])
})
```

- [ ] **Step 7: Implement `OnboardingPage.tsx`**

```tsx
import { useState } from 'react'
import { useOnboardingActions } from '@/data/hooks'
import { Stepper } from '@/shared/ui/Stepper'
import { localDateString } from '@/shared/lib/dates'
import { AuthShell, ErrorLine, fieldStyle } from '@/features/auth/components/AuthShell'
import { StepField } from '@/features/auth/components/StepField'
import { authErrorText } from '@/features/auth/logic/authErrorText'
import {
  BIRTH_DATE_MIN, HEIGHT_CM, SEX_LABEL, WEIGHT_KG, birthDateValid, summaryLines, type OnboardingDraft,
} from '@/features/auth/logic/onboardingSteps'

const STEP_LABEL = ['Rólad', 'Testméretek', 'Összefoglaló'] as const

/**
 * Onboarding wizard (S2, mezo-qw37.2) — rendered by AuthGate on the `onboarding` phase, outside
 * the router (no app chrome), so a fresh account cannot reach the app before the biometric
 * profile the goal engine needs exists. Three steps: 1) name confirm + birth date + sex,
 * 2) height + current weight, 3) summary → useOnboardingActions().complete. The name is read-only:
 * it was typed at registration and S1 has no name-edit endpoint.
 */
export function OnboardingPage({ name, onSuccess }: { name: string; onSuccess: () => void | Promise<void> }) {
  const { complete, pending } = useOnboardingActions()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [draft, setDraft] = useState<OnboardingDraft>({
    sex: 'M', birthDate: '', heightCm: HEIGHT_CM.initial, weightKg: WEIGHT_KG.initial,
  })
  const [error, setError] = useState<string | undefined>()
  const today = localDateString()

  const commit = async () => {
    setError(undefined)
    try {
      await complete({ sex: draft.sex, heightCm: draft.heightCm, birthDate: draft.birthDate, weightKg: draft.weightKg })
      await onSuccess()
    } catch (err) {
      setError(authErrorText(err))
    }
  }

  const nav = (back: (() => void) | null, next: { label: string; onClick: () => void; disabled?: boolean }) => (
    <div className="row gap-sm" style={{ marginTop: 8 }}>
      {back && <button type="button" className="cta-ghost flex-1" onClick={back}>Vissza</button>}
      <button type="submit" className="cta-primary flex-1" disabled={next.disabled} onClick={next.onClick} style={{ padding: '12px 0' }}>
        {next.label}
      </button>
    </div>
  )

  return (
    <AuthShell title="Első lépések">
      <Stepper title="Beállítás" step={step} total={3} stepLabel={STEP_LABEL[step - 1]} />

      {step === 1 && (
        <form className="col gap-md" onSubmit={(e) => { e.preventDefault(); setStep(2) }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Szia, {name}!</p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #6E6257)' }}>
            Ezekből számol a Mezo — később a Beállításokban módosíthatod.
          </p>
          <div className="col gap-xs">
            <span style={{ fontSize: 13 }}>Nem</span>
            <div className="row gap-xs">
              {(['M', 'F'] as const).map((s) => (
                <button key={s} type="button" aria-pressed={draft.sex === s} className="flex-1 rad-12"
                  onClick={() => setDraft((d) => ({ ...d, sex: s }))}
                  style={{
                    padding: '12px 0', fontSize: 14, fontWeight: 600,
                    background: draft.sex === s ? 'color-mix(in srgb, var(--lav-deep) 12%, transparent)' : 'var(--surface-2, #FFFFFF)',
                    border: `1px solid ${draft.sex === s ? 'var(--lav-deep)' : 'var(--border-subtle, #E5DED2)'}`,
                    color: draft.sex === s ? 'var(--lav-deep)' : 'inherit',
                  }}>
                  {SEX_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
          <label className="col gap-xs">Születési dátum
            <input type="date" required min={BIRTH_DATE_MIN} max={today} value={draft.birthDate}
              onChange={(e) => setDraft((d) => ({ ...d, birthDate: e.target.value }))} style={fieldStyle} />
          </label>
          {nav(null, { label: 'Tovább', onClick: () => {}, disabled: !birthDateValid(draft.birthDate, today) })}
        </form>
      )}

      {step === 2 && (
        <form className="col gap-md" onSubmit={(e) => { e.preventDefault(); setStep(3) }}>
          <StepField label="Magasság" unit="cm" val={draft.heightCm} step={HEIGHT_CM.step} min={HEIGHT_CM.min} max={HEIGHT_CM.max} integer
            onChange={(n) => setDraft((d) => ({ ...d, heightCm: n }))} />
          <StepField label="Súly" unit="kg" val={draft.weightKg} step={WEIGHT_KG.step} min={WEIGHT_KG.min} max={WEIGHT_KG.max}
            onChange={(n) => setDraft((d) => ({ ...d, weightKg: n }))} />
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary, #6E6257)' }}>A súly mai bejegyzésként kerül a naplóba.</p>
          {nav(() => setStep(1), { label: 'Tovább', onClick: () => {} })}
        </form>
      )}

      {step === 3 && (
        <form className="col gap-md" onSubmit={(e) => { e.preventDefault(); void commit() }}>
          <ul className="col gap-xs" style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
            {summaryLines(name, draft).map((line) => <li key={line}>{line}</li>)}
          </ul>
          <ErrorLine text={error} />
          {nav(() => setStep(2), { label: 'Kezdjük', onClick: () => {}, disabled: pending })}
        </form>
      )}
    </AuthShell>
  )
}
```

(The "Tovább"/"Kezdjük" buttons are `type="submit"` — the `<form onSubmit>` advances the step, so Enter works too; `onClick: () => {}` is deliberate.)

- [ ] **Step 8: Run the page tests in both modes**

Run: `cd frontend && VITE_USE_MOCK=false pnpm test src/features/auth/pages/OnboardingPage src/features/auth/logic && VITE_USE_MOCK=true pnpm test src/features/auth/pages/OnboardingPage src/features/auth/logic`
Expected: PASS. If `toHaveValue('260')` fails because `useEditableNumber` renders `String(value)` only after blur commits, assert with `await waitFor(() => expect(height).toHaveValue('260'))`.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/features/auth/logic/onboardingSteps.ts frontend/src/features/auth/logic/onboardingSteps.test.ts frontend/src/features/auth/components/StepField.tsx frontend/src/features/auth/pages/OnboardingPage.tsx frontend/src/features/auth/pages/OnboardingPage.test.tsx
git commit -m "feat(fe): OnboardingPage — 3-step wizard on the biometrics + weight contracts (mezo-qw37.2)"
```

---

### Task 5: Frontend — `'onboarding'` phase in `authState.ts` + `AuthGate`

**Files:**
- Modify: `frontend/src/app/auth/authState.ts`, `frontend/src/app/auth/AuthGate.tsx`
- Test: `frontend/src/app/auth/authState.test.ts`, `frontend/src/app/auth/AuthGate.test.tsx`

**Interfaces:**
- Consumes: S1's `AuthPhase`, `deriveFromMe(me: MeResponse)`, `AuthGate` (phases `pending | signedOut | mustChangePassword | ready | failed`, `onAuthenticated` re-fetches `me` and re-derives), `client.setQueryData(ME_QUERY_KEY, me)`; `OnboardingPage` (Task 4).
- Produces: `type AuthPhase = 'pending' | 'signedOut' | 'mustChangePassword' | 'onboarding' | 'ready' | 'failed'`; `deriveFromMe`: `mustChangePassword` → `'mustChangePassword'`, else `!onboarded` → `'onboarding'`, else `'ready'`.

- [ ] **Step 1: Add the failing state test**

Append to `authState.test.ts`:

```ts
test('a not-yet-onboarded user goes to the wizard (after the password gate)', () => {
  expect(deriveFromMe({ ...me, onboarded: false })).toBe('onboarding')
  expect(deriveFromMe({ ...me, onboarded: false, mustChangePassword: true })).toBe('mustChangePassword')
})
```

Delete the S1 comment line `(onboarded: false maps to 'ready' in S1 — …)` under the tests if it was carried into the file.

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test src/app/auth/authState`
Expected: FAIL — `'ready'` returned.

- [ ] **Step 3: Implement**

`authState.ts`:

```ts
export type AuthPhase = 'pending' | 'signedOut' | 'mustChangePassword' | 'onboarding' | 'ready' | 'failed'

/** Boot decision from a successful /api/auth/me. Password reset outranks onboarding (S2). */
export function deriveFromMe(me: MeResponse): AuthPhase {
  if (me.mustChangePassword) return 'mustChangePassword'
  if (!me.onboarded) return 'onboarding'
  return 'ready'
}
```

- [ ] **Step 4: Add the failing gate test**

Append to `AuthGate.test.tsx`:

```tsx
test('onboarded=false → wizard; completing it re-reads me and lands in the app', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  let onboarded = false
  server.use(
    http.get(`${API_BASE}/api/auth/me`, () => HttpResponse.json({
      id: '1', email: 'bela@test.local', name: 'Béla', role: 'USER', onboarded, mustChangePassword: false, timezone: 'Europe/Budapest',
    })),
    http.post(`${API_BASE}/api/auth/onboarding-complete`, () => { onboarded = true; return new HttpResponse(null, { status: 204 }) }),
  )
  setToken('t')
  renderGate()
  expect(await screen.findByRole('heading', { name: 'Első lépések' })).toBeInTheDocument()
  expect(screen.getByText('Szia, Béla!')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Férfi' }))
  await userEvent.type(screen.getByLabelText('Születési dátum'), '1993-05-14')
  await userEvent.click(screen.getByRole('button', { name: 'Tovább' }))
  await userEvent.click(screen.getByRole('button', { name: 'Tovább' }))
  await userEvent.click(screen.getByRole('button', { name: 'Kezdjük' }))
  expect(await screen.findByText('APP')).toBeInTheDocument()
})

test('must-change-password outranks onboarding', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.get(`${API_BASE}/api/auth/me`, () => HttpResponse.json({
    id: '1', email: 'a@b.c', name: 'A', role: 'USER', onboarded: false, mustChangePassword: true, timezone: 'Europe/Budapest',
  })))
  setToken('t')
  renderGate()
  expect(await screen.findByRole('heading', { name: 'Új jelszó' })).toBeInTheDocument()
})
```

(The default MSW `PUT /api/biometrics/profile` and `POST /api/biometrics/weight` handlers already answer the wizard's first two calls.)

- [ ] **Step 5: Wire `AuthGate.tsx`**

Add the imports:

```tsx
import type { MeResponse } from '@/data/auth/authApi'
import { OnboardingPage } from '@/features/auth/pages/OnboardingPage'
```

Insert before `if (phase === 'failed') {`:

```tsx
  if (phase === 'onboarding') {
    const meName = client.getQueryData<MeResponse>(ME_QUERY_KEY)?.name ?? ''
    return <OnboardingPage name={meName} onSuccess={onAuthenticated} />
  }
```

(`onAuthenticated` already re-fetches `me`, stores it and re-derives — after `onboarding-complete` it lands on `'ready'`.) Update the gate's doc comment phase list to `pending → signedOut | mustChangePassword | onboarding | ready | failed`.

- [ ] **Step 6: Run the gate tests in both modes**

Run: `cd frontend && VITE_USE_MOCK=false pnpm test src/app/auth && VITE_USE_MOCK=true pnpm test src/app/auth`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/auth
git commit -m "feat(fe): AuthGate onboarding phase — onboarded=false renders the wizard before the app (mezo-qw37.2)"
```

---

### Task 6: Frontend — `useProfile()` reads the real account name

**Files:**
- Modify: `frontend/src/data/me/meHooks.ts`
- Test: `frontend/src/data/me/profileHooks.test.tsx` (new file — the existing `meHooks.test.tsx` covers weight/sleep/people and stays untouched)
- Modify: `frontend/src/features/me/pages/EnHubPage.test.tsx` (one real-mode test)

**Interfaces:**
- Consumes: `useMe()` (S1: mock → `mockMe` via `initialData`; real → `GET /api/auth/me`, enabled only with a token), static `user` (`frontend/src/data/today/today.ts`).
- Produces: `export interface ProfileIdentity { name: string }`; `useProfile() : { user: ProfileIdentity; isPending: boolean }`. `EnHubPage` (`const { user } = useProfile()` → `user.name`) keeps compiling unchanged.

- [ ] **Step 1: Write the failing hook test**

`profileHooks.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react'
import { makeHookWrapper } from '@/test/queryWrapper'
import { setToken } from '@/data/_client/api'
import { useProfile } from '@/data/me/meHooks'

afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

test('mock mode: the static today.ts identity, synchronously', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const { result } = renderHook(() => useProfile(), { wrapper: makeHookWrapper() })
  expect(result.current.user.name).toBe('Daniel')
  expect(result.current.isPending).toBe(false)
})

test('real mode: the name comes from /api/auth/me — empty (never the mock) while unresolved', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  const { result } = renderHook(() => useProfile(), { wrapper: makeHookWrapper() })
  expect(result.current.user.name).toBe('')
  expect(result.current.isPending).toBe(true)
  await waitFor(() => expect(result.current.user.name).toBe('Owner'))
  expect(result.current.isPending).toBe(false)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && VITE_USE_MOCK=false pnpm test src/data/me/profileHooks`
Expected: FAIL — real mode returns `'Daniel'`.

- [ ] **Step 3: Rewrite `meHooks.ts`**

```ts
import { isMockMode } from '@/data/_client/mode'
import { useMe } from '@/data/auth/authHooks'
import { user } from '@/data/today/today'

export interface ProfileIdentity { name: string }

/**
 * The signed-in identity for the Én hub hero (S2, mezo-qw37.2 — REVERSES the Slice-E "user stays a
 * static const" decision, me.md §9). Real mode: `name` from GET /api/auth/me (S1's `useMe`), an empty
 * string while unresolved — never the mock seed (the dual-mode read invariant). Mock mode: the static
 * `user` of data/today/today.ts, synchronously, so the mock surface and its goldens are untouched.
 */
export function useProfile(): { user: ProfileIdentity; isPending: boolean } {
  const mock = isMockMode()
  const me = useMe()
  if (mock) return { user: { name: user.name }, isPending: false }
  return { user: { name: me.data?.name ?? '' }, isPending: me.data == null }
}
```

- [ ] **Step 4: Add the real-mode hub test**

Append to `EnHubPage.test.tsx` (imports to add: `import { setToken } from '@/data/_client/api'`):

```tsx
test('real mode: the identity hero shows the account name from /api/auth/me', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  renderHub()
  await waitFor(() => expect(document.querySelector('.enh-nm')).toHaveTextContent('Owner'))
  expect(document.querySelector('.enh-idring i')).toHaveTextContent('O')
  vi.unstubAllEnvs()
  setToken(null)
})
```

(Add `waitFor` to the `@testing-library/react` import. The file's `vi.mock('@/data/hooks')` leaves `useProfile` on the real implementation; the other real-mode reads hit the existing MSW handlers, as they already do when the suite runs with `VITE_USE_MOCK=false`.)

- [ ] **Step 5: Run in both modes**

Run: `cd frontend && VITE_USE_MOCK=false pnpm test src/data/me/profileHooks src/features/me/pages/EnHubPage && VITE_USE_MOCK=true pnpm test src/data/me/profileHooks src/features/me/pages/EnHubPage`
Expected: PASS. If `useMe` in the S1 implementation only *enables* the query when `tokenStore.get() != null`, `setToken('t')` must also write the store — use `tokenStore.set('t')` from `@/data/_client/tokenStore` in both tests if the real-mode name never resolves.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/data/me/meHooks.ts frontend/src/data/me/profileHooks.test.tsx frontend/src/features/me/pages/EnHubPage.test.tsx
git commit -m "feat(fe): useProfile reads the account name from /api/auth/me in real mode (mezo-qw37.2)"
```

---

### Task 7: Frontend — Beállítások "Fiók" group (name, email, jelszócsere sheet, kijelentkezés)

**Files:**
- Create: `frontend/src/features/auth/components/ChangePasswordForm.tsx`, `frontend/src/features/auth/sheets/ChangePasswordSheet.tsx`
- Modify: `frontend/src/features/auth/pages/ChangePasswordPage.tsx`, `frontend/src/features/me/pages/BeallitasokPage.tsx`
- Test: `frontend/src/features/auth/sheets/ChangePasswordSheet.test.tsx`, `frontend/src/features/me/pages/BeallitasokPage.test.tsx`

**Interfaces:**
- Consumes: S1 `ChangePasswordPage({ forced?, onSuccess, onCancel? })` (labels `Jelenlegi jelszó`, `Új jelszó (min. 8 karakter)`, `Új jelszó még egyszer`, button `Jelszó mentése`, notice `Ideiglenes jelszóval léptél be — válassz egy sajátot.`), `useAuthActions().{changePassword, logout}`, `useMe()`, `Sheet` (`frontend/src/shared/ui/Sheet.tsx`, children-as-function `close`), `Icon` (`x`), `SECTION_LABEL`, `tokenStore`.
- Produces: `ChangePasswordForm({ onSuccess })`; `ChangePasswordSheet({ onClose })`; `BeallitasokPage` "Fiók" group. **Decision:** the S1 page is a full-height `AuthShell` and cannot nest in a `Sheet`; the form is extracted so page and sheet share one implementation (S1's page tests keep passing — labels unchanged).

- [ ] **Step 1: Extract `ChangePasswordForm.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { useAuthActions } from '@/data/hooks'
import { ErrorLine, fieldStyle } from '@/features/auth/components/AuthShell'
import { authErrorText } from '@/features/auth/logic/authErrorText'

/** The change-password fields + submit — shared by the forced ChangePasswordPage (AuthGate) and the
 *  voluntary ChangePasswordSheet (Beállítások → Fiók). Client-side checks: min 8, confirmation match. */
export function ChangePasswordForm({ onSuccess }: { onSuccess: () => void | Promise<void> }) {
  const { changePassword } = useAuthActions()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (next.length < 8) { setError('A jelszó legalább 8 karakter legyen.'); return }
    if (next !== again) { setError('A két új jelszó nem egyezik.'); return }
    setBusy(true); setError(undefined)
    try { await changePassword({ currentPassword: current, newPassword: next }); await onSuccess() }
    catch (err) { setError(authErrorText(err)) }
    finally { setBusy(false) }
  }

  return (
    <form className="col gap-md" onSubmit={submit}>
      <label className="col gap-xs">Jelenlegi jelszó
        <input type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} style={fieldStyle} />
      </label>
      <label className="col gap-xs">Új jelszó (min. 8 karakter)
        <input type="password" autoComplete="new-password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} style={fieldStyle} />
      </label>
      <label className="col gap-xs">Új jelszó még egyszer
        <input type="password" autoComplete="new-password" required value={again} onChange={(e) => setAgain(e.target.value)} style={fieldStyle} />
      </label>
      <ErrorLine text={error} />
      <button type="submit" className="cta-primary" disabled={busy} style={{ padding: '12px 0' }}>Jelszó mentése</button>
    </form>
  )
}
```

Rewrite `ChangePasswordPage.tsx` to use it:

```tsx
import { useAuthActions } from '@/data/hooks'
import { AuthShell } from '@/features/auth/components/AuthShell'
import { ChangePasswordForm } from '@/features/auth/components/ChangePasswordForm'

/** Forced (must_change_password after an admin reset) or voluntary full-page variant; the
 *  Beállítások entry is ChangePasswordSheet (S2), which shares ChangePasswordForm. */
export function ChangePasswordPage({ forced = false, onSuccess, onCancel }: { forced?: boolean; onSuccess: () => void | Promise<void>; onCancel?: () => void }) {
  const { logout } = useAuthActions()
  const footer = forced
    ? <button type="button" onClick={logout} style={{ textDecoration: 'underline' }}>Kijelentkezés</button>
    : onCancel && <button type="button" onClick={onCancel} style={{ textDecoration: 'underline' }}>Mégse</button>

  return (
    <AuthShell title="Új jelszó" footer={footer}>
      {forced && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #6E6257)', textAlign: 'center' }}>Ideiglenes jelszóval léptél be — válassz egy sajátot.</p>}
      <ChangePasswordForm onSuccess={onSuccess} />
    </AuthShell>
  )
}
```

Run: `cd frontend && VITE_USE_MOCK=false pnpm test src/features/auth/pages/ChangePasswordPage`
Expected: S1's three page tests still PASS (pure extraction).

- [ ] **Step 2: Write the failing sheet test**

`ChangePasswordSheet.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setToken } from '@/data/_client/api'
import { QueryWrapper } from '@/test/queryWrapper'
import { ChangePasswordSheet } from '@/features/auth/sheets/ChangePasswordSheet'

beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'false'); setToken('t') })
afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

test('renders the form in a dialog and closes on success', async () => {
  const onClose = vi.fn()
  render(<QueryWrapper><ChangePasswordSheet onClose={onClose} /></QueryWrapper>)
  expect(screen.getByRole('dialog', { name: 'Új jelszó' })).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Jelenlegi jelszó'), 'regi-jelszo-1')
  await userEvent.type(screen.getByLabelText('Új jelszó (min. 8 karakter)'), 'uj-jelszo-2026')
  await userEvent.type(screen.getByLabelText('Új jelszó még egyszer'), 'uj-jelszo-2026')
  await userEvent.click(screen.getByRole('button', { name: 'Jelszó mentése' }))
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})

test('the X chip closes without saving', async () => {
  const onClose = vi.fn()
  render(<QueryWrapper><ChangePasswordSheet onClose={onClose} /></QueryWrapper>)
  await userEvent.click(screen.getByRole('button', { name: 'Bezárás' }))
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})
```

- [ ] **Step 3: Implement `ChangePasswordSheet.tsx`**

```tsx
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { ChangePasswordForm } from '@/features/auth/components/ChangePasswordForm'

/** Voluntary password change from Beállítások → Fiók (S2, mezo-qw37.2). The BiometricSheet
 *  header idiom (eyebrow + h-display title + X chip); success closes with the sheet's own motion. */
export function ChangePasswordSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet onClose={onClose} labelledBy="change-password-title">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div className="col">
              <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>Fiók</span>
              <div id="change-password-title" className="h-display size-md" style={{ marginTop: 4 }}>Új jelszó</div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>
          <ChangePasswordForm onSuccess={close} />
        </div>
      )}
    </Sheet>
  )
}
```

Run: `cd frontend && VITE_USE_MOCK=false pnpm test src/features/auth/sheets`
Expected: PASS (under jsdom `Sheet`'s exit falls back to its timer — `waitFor` covers it).

- [ ] **Step 4: Write the failing Beállítások tests**

Append to `BeallitasokPage.test.tsx` (add imports `import { setToken } from '@/data/_client/api'` and `import { tokenStore } from '@/data/_client/tokenStore'`; keep the file's mock-mode `beforeEach`):

```tsx
test('a Fiók csoport a nevet és az e-mailt mutatja, a jelszócsere sheetet nyit', async () => {
  renderPage()
  expect(await screen.findByText('Fiók')).toBeInTheDocument()
  expect(screen.getByText('Daniel')).toBeInTheDocument()
  expect(screen.getByText('daniel@mezo.local')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Jelszó módosítása' }))
  expect(await screen.findByRole('dialog', { name: 'Új jelszó' })).toBeInTheDocument()
})

test('mock módban nincs Kijelentkezés sor (nincs mögötte munkamenet)', async () => {
  renderPage()
  await screen.findByText('Fiók')
  expect(screen.queryByRole('button', { name: 'Kijelentkezés' })).not.toBeInTheDocument()
})

test('valós módban a Kijelentkezés törli a tokent', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t'); tokenStore.set('t')
  renderPage()
  expect(await screen.findByText('Owner')).toBeInTheDocument()
  expect(screen.getByText('owner@mezo.local')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Kijelentkezés' }))
  expect(tokenStore.get()).toBeNull()
  setToken(null)
})
```

- [ ] **Step 5: Add the "Fiók" group to `BeallitasokPage.tsx`**

Imports to add:

```tsx
import { useState } from 'react'
import { isMockMode } from '@/data/_client/mode'
import { useAuthActions, useLlmUsageSummary, useMe, useNotificationPrefs } from '@/data/hooks'
import { ChangePasswordSheet } from '@/features/auth/sheets/ChangePasswordSheet'
```

(replace the existing `useLlmUsageSummary, useNotificationPrefs` import line). Inside the component, after `const { mode, setMode } = useTheme()`:

```tsx
  // Fiók (S2, mezo-qw37.2): identity from /api/auth/me (mock: the static owner), password change
  // in a sheet, logout. Logout only exists where a session does — mock mode has no token and
  // AuthGate short-circuits to the app there, so the row is hidden rather than dead.
  const { data: me } = useMe()
  const { logout } = useAuthActions()
  const [sheet, setSheet] = useState<'password' | null>(null)
  const canLogout = !isMockMode()
```

Change the hero line to `sub="téma · fiók · értesítések · AI-napló"`. Insert this block between the `Téma` block and the `Felületek` block, and bump `Felületek`'s `'--d'` from `80ms` to `160ms`:

```tsx
          <div className="col gap-sm rise" style={{ '--d': '80ms' } as React.CSSProperties}>
            <span style={SECTION_LABEL}>Fiók</span>
            <div className="card col" style={{ padding: 14, gap: 2 }}>
              <span>{me?.name ?? '—'}</span>
              <span style={SECTION_LABEL}>{me?.email ?? '—'}</span>
            </div>
            <button type="button" className="card row" aria-label="Jelszó módosítása" onClick={() => setSheet('password')}
              style={{ justifyContent: 'space-between', padding: 14, gap: 12, textAlign: 'left' }}>
              <span>Jelszó módosítása</span>
              <span aria-hidden="true" style={{ color: 'var(--text-tertiary)' }}>›</span>
            </button>
            {canLogout && (
              <button type="button" className="card row" aria-label="Kijelentkezés" onClick={logout}
                style={{ justifyContent: 'space-between', padding: 14, gap: 12, textAlign: 'left', color: 'var(--coral-deep)' }}>
                <span>Kijelentkezés</span>
              </button>
            )}
          </div>
```

And before the closing `</MozaikPage>`:

```tsx
      {sheet === 'password' && <ChangePasswordSheet onClose={() => setSheet(null)} />}
```

- [ ] **Step 6: Run the Beállítások tests in both modes**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test src/features/me/pages/BeallitasokPage && VITE_USE_MOCK=false pnpm test src/features/me/pages/BeallitasokPage`
Expected: PASS in both (the file's `beforeEach` pins mock mode; the real-mode test re-stubs inside its body, which wins).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/auth/components/ChangePasswordForm.tsx frontend/src/features/auth/sheets frontend/src/features/auth/pages/ChangePasswordPage.tsx frontend/src/features/me/pages/BeallitasokPage.tsx frontend/src/features/me/pages/BeallitasokPage.test.tsx
git commit -m "feat(fe): Beállítások Fiók csoport — név, e-mail, jelszócsere sheet, kijelentkezés (mezo-qw37.2)"
```

---

### Task 8: Full gates, docs, CODEMAP, push, PR

**Files:**
- Modify: `docs/features/me.md` (§3 line ~289 + ~383, §4 line ~376, §9 line ~591), `docs/features/_platform-auth-security.md` (§2, §8), `docs/features/fuel.md` (~178), `docs/features/growth.md` (~64), `docs/features/goal-engine.md` (~86, ~202), `docs/features/_platform-api-backend.md` (~58, ~234), `docs/references/integration_test_framework.md` (§"Two Base Classes"), `docs/CODEMAP.md` (regenerated)

- [ ] **Step 1: Frontend full gate**

Run:
```bash
cd frontend && VITE_USE_MOCK=true pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build
```
Expected: both suites green, build succeeds. Likely breakage: `src/data/dualMode.guard.test.ts` — it scans hooks for the leaky `const { data = mock }` pattern; `meHooks.ts` uses `me.data?.name ?? ''` (an empty string, not the seed), which is the sanctioned shape. If the guard still flags the file, read its allowlist and add `meHooks.ts` with a one-line reason.

- [ ] **Step 2: Backend focused gate**

Run:
```bash
cd backend && ./mvnw test -Dtest='OwnerSeedDataIT,ProtocolSeedDataIT,GoalReevaluateRunnerIT,TrainSeedDataIT,AuthOnboardingIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true
```
Expected: PASS. The full suite (incl. every `@ActiveProfiles("demodata")` context that no longer boots the four seeders) runs in CI.

- [ ] **Step 3: Docs — decision reversal and profile moves**

`docs/features/me.md` (frontmatter `updated: 2026-09-02`):
- §3, the paragraph starting `**Profile (static — recorded decision):**` → replace with:
  ```markdown
  **Profile (real since S2, `mezo-qw37.2`):** `useProfile()` (`data/me/meHooks.ts`) returns `{ user: { name }, isPending }` — real mode reads `name` from `useMe()` (`GET /api/auth/me`, S1 `mezo-qw37.1`), an empty string while unresolved (never the seed); mock mode keeps the static `user` of `data/today/today.ts`. The Slice-E "static const" decision is **reversed** (§9). `EnHubPage`'s identity hero is its only consumer.
  ```
- §3, the sentence starting `` `useProfile()` re-exports the same `user: UserMeta` object defined in `data/today/today.ts` `` up to `(§9).` → replace with: `` `useProfile()` is a real-mode read since S2 (`name` ← `/api/auth/me`; the `today.ts` `user` const is mock-only now), and `EnHubPage` is its only consumer. ``
- §4 mock-data paragraph: `the 5 persons are ALSO seeded server-side by `PeopleSeedData`, so mock and a fresh demodata deploy agree` → `the 5 persons are ALSO seeded server-side by `PeopleSeedData` — **`@Profile("demofixtures")` since S2 (`mezo-qw37.2`)**, so a plain `demodata` deploy starts every account with an empty Emberek and `POST /api/people` is the live write path`.
- §9, the bullet starting `- **`useProfile` decision (Slice E, parked since 2026-06-10 §5; …` → replace with:
  ```markdown
  - **`useProfile` decision — REVERSED by S2 (`mezo-qw37.2`, 2026-09-02):** the Slice-E "`user` stays a static const" ruling (revisited `mezo-8141`, carrier moved `mezo-k7rn` → `mezo-d20.6.1`) was conditioned on "revisit when a backend profile identity surface exists" — S1 (`mezo-qw37.1`) created it (`GET /api/auth/me`, `app_user.name`), so `useProfile()` now reads the account name in real mode and `EnHubPage` renders the signed-in user, not Daniel. The static `user` survives only as the mock-mode seed. Onboarding of a fresh account (birth date, sex, height, weight) lives in `features/auth/pages/OnboardingPage.tsx` on the existing biometrics + weight contracts — see `_platform-auth-security.md` §2.
  ```
- §10 key files: add `frontend/src/data/auth/onboardingHooks.ts — useOnboardingActions (S2)` under "Frontend — data layer".

`docs/features/_platform-auth-security.md` (S1 already rewrote §1–§3; `updated: 2026-09-02`):
- §2: after the `AuthGate` phases bullet add:
  ```markdown
  - **Onboarding (S2, `mezo-qw37.2`):** `me.onboarded=false` (and no forced password change) → `AuthGate` renders `features/auth/pages/OnboardingPage.tsx` instead of the app: 1) name confirm (read-only — typed at registration) + születési dátum + nem, 2) magasság + jelenlegi súly (`StepField`, clamped to the contract bounds), 3) összefoglaló → `useOnboardingActions().complete` = `PUT /api/biometrics/profile` → `POST /api/biometrics/weight` (today) → `POST /api/auth/onboarding-complete`, then `me` is re-read and the phase becomes `ready`. No new contract or table. The owner row is backfilled `onboarded_at` by S1, so the founder never sees the wizard. Beállítások → **Fiók** shows name/e-mail, opens `ChangePasswordSheet`, and offers **Kijelentkezés** (real mode only — mock mode has no session).
  ```
- §8: the `OwnerSeedDataIT` bullet → `… ; `TrainSeedData`, `ProtocolSeedData`, `PeopleSeedData`, `GamificationDemoData`, `GoalReevaluateRunner` beans absent unless `demofixtures` (S2 moved the last four out of prod).` Add a bullet: `` `feature/auth/AuthOnboardingIT` — a registered USER gets lazy per-user bootstraps (gamification ghost profile `ujonc`/0 coins, 15 habit defs) and no owner fixtures; the wizard's three-call sequence flips `onboarded`. ``

`docs/features/fuel.md` (~178): `(`@Profile("demodata")`, `@Order(65)` — after `PantryCatalogLoader` at 60)` → `(`@Profile("demofixtures")` since S2 `mezo-qw37.2` — opt-in owner fixture, no longer a prod seed; `@Order(65)` — after `PantryCatalogLoader` at 60)`.

`docs/features/growth.md` (~64) and `docs/features/_platform-api-backend.md` (~234): `**Demodata seed** (`GamificationDemoData`, `@Profile("demodata")`` → `**Demofixtures seed** (`GamificationDemoData`, `@Profile("demofixtures")` since S2 `mezo-qw37.2` — a registered user's profile row is created lazily by `GamificationService.ensureProfile` on the first award/purchase; reads are ghost zeros before that`. `_platform-api-backend.md` (~58) People row: `persons seed-only v1 (demodata; demo feed `demofixtures`)` → `persons `demofixtures`-only since S2 (`POST /api/people` is the write path for every account)`.

`docs/features/goal-engine.md` (~86): `a `CommandLineRunner`, `@Profile("demodata")` (the prod-active profile), `@Order(200)`` → `a `CommandLineRunner`, `@Profile("demofixtures")` (opt-in since S2 `mezo-qw37.2` — the owner's pre-NEAT reconciliation is done on the live DB), `@Order(200)``; (~202) `the `@Profile("demodata")` startup runner` → `the `@Profile("demofixtures")` (S2) startup runner`.

`docs/references/integration_test_framework.md`, §"Two Base Classes", append a bullet:
```markdown
- Beans under `@Profile("demofixtures")` (`TrainSeedData`, `RunningSeedData`, `GoalSeedData`, `MentionSeedData`, and since S2 `ProtocolSeedData`/`PeopleSeedData`/`GamificationDemoData`/`GoalReevaluateRunner`) do NOT exist in the default `demodata` context — an IT that autowires one annotates `@ActiveProfiles({"demodata", "demofixtures"})` (its own cached context) and calls the runner's no-arg `run()` after the per-test reset.
```

Run:
```bash
node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs --errors-only && node scripts/lint-liquibase.mjs
```
Expected: all PASS; `docs/CODEMAP.md` picks up `AuthOnboardingIT`, `onboardingHooks.ts`, `OnboardingPage.tsx`, `ChangePasswordSheet.tsx`, `StepField.tsx`.

- [ ] **Step 4: Commit docs**

```bash
git add docs/features/me.md docs/features/_platform-auth-security.md docs/features/fuel.md docs/features/growth.md docs/features/goal-engine.md docs/features/_platform-api-backend.md docs/references/integration_test_framework.md docs/CODEMAP.md
git commit -m "docs(auth): onboarding + useProfile reversal + demofixtures seed moves, CODEMAP regen (mezo-qw37.2)"
```

- [ ] **Step 5: Push, open the self-PR, wait for CI**

```bash
git push -u origin feat/multi-user-s2-onboarding-seeds
gh pr create --title "feat(auth): S2 onboarding wizard, real useProfile, Fiók settings, seeds → demofixtures (mezo-qw37.2)" --body "$(cat <<'EOF'
S2 of the multi-user epic (mezo-qw37): OnboardingPage (birth date/sex → height/weight → summary) on the existing biometrics + weight contracts, AuthGate `onboarding` phase, `useProfile` reads `/api/auth/me`, Beállítások Fiók group (name, e-mail, ChangePasswordSheet, Kijelentkezés), and ProtocolSeedData / PeopleSeedData / GamificationDemoData / GoalReevaluateRunner move from prod `demodata` to opt-in `demofixtures`. Spec: docs/superpowers/specs/2026-09-02-multi-user-accounts-design.md §6.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
gh pr checks --watch
```
Expected: CI green (full backend IT suite — every `demodata` context now boots without the four seeders — FE both modes, lint, contract drift). Then the house merge recipe (`git pull --rebase` on main, `--no-ff` merge, push main), `bd close mezo-qw37.2`, `bd dolt push`.

---

## Self-Review

**Spec coverage (§6):** `OnboardingPage` in `features/auth/`, forced before `ready` when `onboarded=false` → Tasks 4–5; three steps with name confirm + birth date + sex / height + weight / summary → Task 4; `PUT /api/biometrics/profile` with the NOT NULL trio in one call + `POST /api/biometrics/weight` (today) + `POST /api/auth/onboarding-complete` → Task 3 (hook) + Task 2 (backend proof of the sequence); no new domain table → none added; NumberStep-style fields clamped to contract min/max → Task 4 (`StepField` + `onboardingSteps.ts` bounds, tested); `useProfile()` real mode from `/api/auth/me`, mock keeps the static `today.ts` `user`, `EnHubPage` hero from it → Task 6; `BeallitasokPage` "Fiók" group (name, email, password change, logout) → Task 7 (`ChangePasswordSheet` decision recorded there); seeders → `demofixtures`, `OwnerSeedData` stays `demodata` → Task 1; lazy per-user bootstrap kept/verified (`HabitCatalogService.ensureCatalog`, `GamificationService.ensureProfile` + null-safe reads — no code fix needed, the "no profile" read path already returns ghost zeros + `ujonc`) → Task 2 pins it; tests: onboarding IT (Task 2), FE wizard in both modes (Tasks 3–5), ITs green without `demofixtures` (Task 1 re-profiles the two dependent ITs; nothing else read the boot rows because `ResetDatabase` truncates them); docs: `me.md` §9/§10 reversal, `_platform-auth-security.md` onboarding paragraph, CODEMAP regen → Task 8. Mock mode unaffected: `AuthGate` short-circuits to `ready` in mock (S1), `useOnboardingActions` no-ops, `useProfile` keeps the static seed, the Kijelentkezés row is hidden.

**Spec ambiguities resolved:** (1) "név megerősítés" is a read-only confirmation — S1 has no name-edit endpoint, so the wizard shows the registration name instead of an editable field. (2) The spec path `PUT /api/biometric-profile` is the existing `PUT /api/biometrics/profile`; `POST /api/weight` is `POST /api/biometrics/weight`. (3) `activityLevel` is not asked (spec lists five fields); the hook sends `MIXED` explicitly, matching the server default, so the payload is self-describing. (4) The weight stepper clamps to `[1, 999.9]` — inside the contract's `(0, 999.99]` with the 1-decimal rounding `useEditableNumber` applies; height clamps to the exact contract `[50, 260]`.

**Placeholder scan:** none — every step carries the full code; the two "if the generated getter type differs" notes are verification instructions on generated DTOs, not gaps.

**Type consistency:** `OnboardingInput{sex, heightCm, birthDate, weightKg}` (Task 3) is what `OnboardingPage.commit` passes (Task 4); `useOnboardingActions() → { complete, pending }` used identically in Tasks 3–4; `OnboardingPage({ name, onSuccess })` matches `AuthGate`'s render (Task 5); `AuthPhase` gains `'onboarding'` in `authState.ts` and `AuthGate.tsx` branches on the same literal; `useProfile() → { user: ProfileIdentity{name}, isPending }` matches `EnHubPage`'s `const { user } = useProfile(); user.name`; `ChangePasswordForm({ onSuccess })` is consumed by both `ChangePasswordPage` and `ChangePasswordSheet({ onClose })`; UI strings asserted in tests match the copy (`Első lépések`, `Szia, Béla!`, `Férfi`/`Nő`, `Születési dátum`, `Magasság`/`Súly` (+ ` növelése`/` csökkentése`), `Tovább`, `Vissza`, `Kezdjük`, `Fiók`, `Jelszó módosítása`, `Kijelentkezés`, `Új jelszó`, `Bezárás`, `Jelszó mentése`, `Nem sikerült kapcsolódni. Próbáld újra.`); backend test class names `OwnerSeedDataIT`, `ProtocolSeedDataIT`, `GoalReevaluateRunnerIT`, `AuthOnboardingIT` match the focused gate pattern.
