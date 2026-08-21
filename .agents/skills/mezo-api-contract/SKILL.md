---
name: mezo-api-contract
description: Use before adding/changing any REST endpoint or FE↔BE DTO — the OpenAPI contract comes first, code second.
---

# mezo API Contract Work

READ FIRST: docs/references/api_contract_conventions.md.

Flow (in order): 1) edit api/feature/<name>/<name>.yml · 2) cd api/generate && npm run
generate:api · 3) frontend types: cd frontend && pnpm generate:api · 4) backend implements the
generated <Tag>Api interface with api.dto models (regenerates in ./mvnw generate-sources).
Never hand-write a boundary DTO; frontend request bodies use `satisfies` on generated types.
