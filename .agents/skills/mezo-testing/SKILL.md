---
name: mezo-testing
description: Use before writing or changing any backend test — integration-first house standard.
---

# mezo Backend Testing

READ FIRST: docs/references/testing_standards.md AND docs/references/integration_test_framework.md.

Hard gates: integration-first (@SpringBootTest + Testcontainers Postgres) · extend
AbstractIntegrationTest (service-level) or ApiIntegrationTest (HTTP-level) · data via
*Populator factories only · new domain table → ResetDatabase TRUNCATE list · naming
test{Method}_should{Result}_when{Condition} · AssertJ only · NO mocks/@MockBean/H2 in ITs.
Run: cd backend && ./mvnw clean test (compose up first; CI uses Testcontainers mode).
