# Feedback API contract-validation cases — Implementation Plan (`mezo-b3pp.24`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** pin the four contract constraints on `/api/companion/feedback` that nothing currently tests, so a contract regression cannot ship green.

**Why it can ship green today.** `CompanionFeedbackApiIT`'s contract-validation coverage is `artifactKind` only (`testPutFeedback_shouldReturn400_whenArtifactKindUnknown`, `testListFeedback_shouldReturn400_whenKindUnknown`). The other four constraints — `verdict`'s pattern, `reason`'s pattern, `ids`' `minItems: 1` and `maxItems: 200` — are enforced entirely by bean-validation annotations on the **generated** `CompanionFeedbackApi` interface. Nobody hand-wrote them, so nobody would notice if a fragment edit dropped one: the endpoint would simply start accepting garbage, and every existing test would still pass.

**Architecture:** four cases in the existing IT. **No production code changes at all** — if this slice ends up touching `src/main`, something has been misdiagnosed.

**Tech Stack:** Java 21 / Spring Boot, Testcontainers ITs over the real HTTP stack (`ApiIntegrationTest`).

## Global Constraints

- **bd id on every commit subject:** `(mezo-b3pp.24)`. Conventional-commit subjects.
- **No production change, no contract change.** Do not touch `backend/src/main/**`, `api/feature/**`, `api/openapi.yml`, `frontend/**`. Do not run the API generators. This slice adds tests and one docs edit.
- **Spec §11:** integration-first. No new table → `support/ResetDatabase.java` and the populators stay untouched.
- **Backend gate:** focused ITs only (`./mvnw clean test -Dtest='...' -Dmezo.test.use-testcontainers=true`, Docker up). Testcontainers mode is mandatory — the default fixed-DB mode races and fakes failures.
- **Docs in the same change:** `docs/features/companion.md` §8 currently lists these four as a KNOWN GAP; they become covered.

## What the contract actually declares (verified against `api/feature/companion-feedback/companion-feedback.yml`)

| Constraint | Where | Fragment line |
|---|---|---|
| `verdict: pattern '^(up\|down)$'` | `PutFeedbackRequest` | :111 |
| `reason: pattern '^(inaccurate\|too_much\|bad_timing\|not_about_me)$'`, nullable | `PutFeedbackRequest` | :112-116 |
| `ids: minItems: 1` | `GET` query param | :25 |
| `ids: maxItems: 200` | `GET` query param | :26 |

**The error code is the same for all four.** `GlobalExceptionHandler.validationCode` (`:78-84`) maps every bean-validation constraint except `NotBlank`/`NotNull`/`Email` onto `VALIDATION_INVALID_VALUE`, so `@Pattern` and `@Size` both land there. Only the FIELD name differs. The two existing cases give the exact idiom:

```java
String body = putForBody("/api/companion/feedback", PutFeedbackRequest.builder()…build(),
    ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
assertHasFieldError(body, "artifactKind", "VALIDATION_INVALID_VALUE");
```

---

### Task 1: The four cases

**Files:**
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/feedback/CompanionFeedbackApiIT.java`

**Interfaces:** none produced — this task adds tests only.

- [ ] **Step 1: Read the file end to end first**

Read the whole IT before writing. Match its harness exactly: it extends `ApiIntegrationTest`, is deliberately **not** `@Transactional`, uses `ownerAuthHeaders()`, `putForBody(...)` / `getForBody(...)`, `assertHasFieldError(...)`, and the `testX_shouldY_whenZ` naming. Put the new PUT cases next to `testPutFeedback_shouldReturn400_whenArtifactKindUnknown` and the new GET cases next to `testListFeedback_shouldReturn400_whenKindUnknown`, so each sits with its sibling.

- [ ] **Step 2: Write the two PUT cases**

```java
    @Test
    void testPutFeedback_shouldReturn400_whenVerdictUnknown() {
        String body = putForBody("/api/companion/feedback",
            PutFeedbackRequest.builder()
                .artifactKind(MessageFeedbackEntity.KIND_CHAT_MESSAGE)
                .artifactId(UUID.randomUUID())
                .verdict("sideways")
                .build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "verdict", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testPutFeedback_shouldReturn400_whenReasonUnknown() {
        String body = putForBody("/api/companion/feedback",
            PutFeedbackRequest.builder()
                .artifactKind(MessageFeedbackEntity.KIND_CHAT_MESSAGE)
                .artifactId(UUID.randomUUID())
                .verdict(MessageFeedbackEntity.VERDICT_DOWN)
                .reason("because_i_said_so")
                .build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "reason", "VALIDATION_INVALID_VALUE");
    }
```

The reason case deliberately pairs an unknown reason with `down` — the LEGAL verdict for a reason. Pairing it with `up` would fail on the service-level reason/verdict guard instead (already covered elsewhere in this file), and the test would pass for the wrong reason, proving nothing about the pattern.

Check the real constant name for the down verdict before writing (`MessageFeedbackEntity.VERDICT_DOWN` is the expected name — verify it, do not assume).

- [ ] **Step 3: Write the >200 case**

```java
    @Test
    void testListFeedback_shouldReturn400_whenMoreThanTheContractMaximumIdsRequested() {
        String ids = java.util.stream.Stream.generate(() -> UUID.randomUUID().toString())
            .limit(201)
            .collect(java.util.stream.Collectors.joining(","));

        String body = getForBody("/api/companion/feedback?kind=" + MessageFeedbackEntity.KIND_CHAT_MESSAGE
            + "&ids=" + ids, ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "ids", "VALIDATION_INVALID_VALUE");
    }
```

Use proper imports rather than fully-qualified names inline — the fully-qualified form above is only to show which types are meant.

**Beware the header limit while writing this one.** 201 uuids is ~7.4 KB of query string — the very thing `mezo-b3pp.23` fixed on the client side. The SERVER still has Tomcat's 8 KB default, so this request may be rejected by Tomcat *before* bean validation ever runs, giving a bare 400 with **no** `SystemMessageList` body and failing `assertHasFieldError`. If that happens:
- Do **not** raise the server's header limit to make the test pass — that changes production behaviour and is out of scope.
- Report it. The honest options are (a) assert only the 400 status with a comment explaining that Tomcat rejects it before validation, or (b) drop the case and say the constraint is unreachable over HTTP at that size. Pick (a) if the status is genuinely 400 either way, and say clearly in your report which path the request actually took — that distinction is the whole value of the test.

- [ ] **Step 4: Write the empty-ids case — and find out what actually happens first**

`minItems: 1` is the constraint, but **how an empty list reaches the controller is not obvious**, and getting this wrong makes the test assert the wrong thing:
- `?ids=` (present but empty) may bind to a single empty string, which then fails **uuid conversion** → `MethodArgumentTypeMismatchException` → a different handler → possibly a different code.
- Omitting `ids` entirely is a **missing required parameter**, a different error again.
- Only a genuinely empty collection reaches the `@Size(min = 1)` check.

So: **probe first, assert second.** Write the case for `?ids=` (the form a client would actually produce), run it, and look at the real response body. Then assert what genuinely happens — status and, if there is a `SystemMessageList` body, its actual field and code. Name the test after the real behaviour. If the empty-string form does NOT reach `@Size`, say so in your report and add a comment in the test recording which layer rejected it; that is a true and useful pin either way.

Do not force the assertion to `("ids", "VALIDATION_INVALID_VALUE")` if that is not what comes back.

- [ ] **Step 5: Run the ITs**

```bash
cd backend && ./mvnw clean test -Dtest='CompanionFeedbackApiIT' -Dmezo.test.use-testcontainers=true
```
Expected: the whole class green, including the pre-existing cases. Report the actual response body you observed for Steps 3 and 4 — those two are the ones where reality may differ from the contract's intent.

- [ ] **Step 6: Commit**

```bash
git add backend/src/test/java/io/mrkuhne/mezo/feature/companion/feedback/CompanionFeedbackApiIT.java
git commit -m "test(companion): pin the feedback contract's verdict/reason/ids constraints (mezo-b3pp.24)"
```

---

### Task 2: Docs + gates

**Files:**
- Modify: `docs/features/companion.md` — §8 lists these four as a known gap; bump `updated:`.

- [ ] **Step 1: Close the documented gap**

Grep `docs/features/companion.md` for the known-gap wording (it names the four missing cases and cites `mezo-b3pp.24`). Replace it with what now exists: name the four new tests, and state the one fact that makes them worth having — all four constraints live on the **generated** `CompanionFeedbackApi`'s bean-validation annotations, so without these cases a fragment edit that dropped one would ship green.

Record honestly whatever Task 1 discovered about the two awkward cases:
- if the >200 request is rejected by **Tomcat's 8 KB header limit** before bean validation, say so — it is a genuinely interesting interaction with `mezo-b3pp.23`, and it means the `maxItems: 200` constraint is partly unreachable over HTTP;
- if the empty-`ids` form is rejected by **uuid conversion** rather than `@Size(min = 1)`, say which layer actually answers.

Do not write that the constraints are "covered" in a way Task 1's findings contradict.

- [ ] **Step 2: Lint the docs**

```bash
node scripts/lint-docs.mjs 2>&1 | tail -5
```
No NEW findings versus the pre-edit baseline (capture it by running the linter once before editing — the repo carries unrelated pre-existing stale docs).

- [ ] **Step 3: Focused backend gate**

```bash
cd backend && ./mvnw clean test -Dtest='CompanionFeedbackApiIT,CompanionFeedbackSwitchOffIT,MessageFeedbackPersistenceIT' -Dmezo.test.use-testcontainers=true
node scripts/gen-codemap.mjs --check
```
No frontend gate — this slice touches no TypeScript. `gen-codemap --check` should pass untouched (no new source directory); if it fails, regenerate and include it.

- [ ] **Step 4: Commit**

```bash
git add docs/features/companion.md
git commit -m "docs(features): companion — the feedback contract-validation gap is closed (mezo-b3pp.24)"
```

---

## Self-Review

- **bd coverage.** All four named cases: unknown verdict (Task 1 Step 2), unknown reason (Step 2), empty ids (Step 4), >200 ids (Step 3). The bd's own reasoning — "enforced by the generated API's bean-validation annotations rather than hand-written code, so a contract regression would ship green" — is what Task 2 records in the docs.
- **What this plan adds beyond the bd:** two traps the bd does not anticipate. The >200 case may never reach bean validation because 201 uuids exceed Tomcat's 8 KB header limit — the same wall `mezo-b3pp.23` just fixed on the client side, now met from the server side. And an empty `ids` query param probably fails uuid conversion rather than `@Size(min = 1)`. Both are told to be probed empirically and reported honestly rather than asserted blind, because a test that passes for the wrong reason is worse than no test.
- **Placeholders.** The two PUT cases are literal. The two GET cases are literal in shape but deliberately conditional in their assertion, because the true behaviour must be observed first — the plan says exactly what to observe and what to do with each outcome.
- **Scope.** No `src/main` file appears anywhere in this plan. If the implementer needs one, the diagnosis is wrong and they should stop and report.
