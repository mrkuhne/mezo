---
name: tdd
description: Use whenever writing any implementation code — enforces red/green/refactor. The test exists and fails BEFORE the implementation exists.
---

# TDD

1. RED: write the smallest test that fails for the right reason. Run it. See it fail.
   If it passes immediately, the test is wrong — fix the test first.
2. GREEN: write the minimal code to pass. No extra features. Run the test. See it pass.
3. REFACTOR: clean up only with green tests. Re-run after every refactor.
4. Backend: integration-first (@SpringBootTest + Testcontainers), AssertJ, naming
   test{Method}_should{Result}_when{Condition} — see mezo-testing skill.
   Frontend: vitest, colocated, run in BOTH modes (default and VITE_USE_MOCK=true).
5. Never delete or weaken a failing test to make the suite pass. Never mark a task done
   with red tests.
