# Slice E — People backend + `usePeople` dual-mode (`mezo-t16y.2`)

> Implementation plan for roadmap §E (`2026-07-04-phase2-completion-roadmap.md`). Session-sized;
> decisions below settle the roadmap's open questions with the lean defaults it suggests.

## Decisions (settled in-slice)

1. **Person CRUD surface v1: seed-only (read-mostly).** No person create/edit endpoint or sheet.
   The 5 persons (IDENT-5 PERMA-R inner circle: Petra, Bence, Ádám, Réka, Márk) are seeded under
   **`@Profile("demodata")`** — deliberate exception to the "demo content → demofixtures" rule,
   because these are the owner's real inner circle (roadmap §E says "persons seeded via demodata"),
   akin to `OwnerSeedData`, not demo fiction. Mention **fixtures** (a demo feed) are opt-in
   **`@Profile("demofixtures")`** per the `GoalSeedData` precedent.
2. **Honest derived stats.** `mentionCount` / `mentionsThisWeek` (rolling 7d) / `lastMentionedAt`
   are **computed server-side from real mention rows**, never seeded statics — the mock's `84` would
   be a lie. Narrative person fields (`knownFacts`, `ties`, `affectTrend`, `notes`, cadence label)
   ARE seeded — owner-curated facts about real people (data, not engine output). A *computed*
   affect trend belongs to the pattern-engine epic.
3. **`affect`/`relationship`/`source` enums → DB CHECK constraints** (house style, mirrors `goal`).
4. **Mentions do NOT feed the companion snapshot** yet (roadmap lean: proactive epic wires it).
5. **`useProfile` stays a static const — recorded, not wired.** No real-mode surface renders the
   identity statics: Today real mode overrides only the meso fields from `useTrain()` (Slice T),
   `FuelStackPage` reads seed consts by decision `mezo-4nu`. Wiring `user_profiles` would add an
   endpoint no view consumes (and it lacks `name`). Revisit when a Profile identity surface returns.
6. **Display labels are FE-derived in real mode.** The contract carries data (`ts`,
   `lastMentionedAt` ISO); `dayLabel`/`timeLabel`/`lastMentionLabel` derive client-side
   (`Ma`/`Tegnap`/HU month-day). Mock keeps its hand-authored labels (byte-parity).
7. **Write path v1 = the sheet:** `source` is server-stamped `chip`, `flagged` false, `ts` now.
   `MentionLogInput { personId, tone, text? }` stays the pinned FE input; `personId` rides the path.

## Contract (`api/feature/people/people.yml`, tag `People`)

- `GET /api/people` → `PeopleResponse { persons: PersonResponse[], mentions: MentionResponse[] }`
  — one bootstrap read (knowledge pattern). Persons ordered mention-count desc then name;
  mentions ts-desc, capped at 50.
- `POST /api/people/{personId}/mentions` — `LogMentionRequest { tone (pattern), text? ≤500 }`
  → 201 `MentionResponse`; 404 on missing/foreign person (no existence leak).

## DB (`202607041030_mezo-t16y.2_create_person_mention.sql`)

- `person`: id/created_by/name/initial/relationship(CK)/relationship_hu/affect_baseline(CK)/
  contact_cadence_label/notes/known_facts text[]/ties text[]/affect_trend integer[]/soft-delete;
  `idx_person_created_by`.
- `mention`: id/created_by/person_id FK→person/ts timestamptz/source(CK)/duration_s/excerpt/
  tone(CK)/tied_to_kind/tied_to_label/flagged/soft-delete; `idx_mention_created_by_ts`.

## Backend (`feature/people/`)

`PersonEntity`+`MentionEntity` (OwnedEntity, `@SQLDelete`/`@SQLRestriction`, `text[]`/`integer[]`
via `@JdbcTypeCode(SqlTypes.ARRAY)`); repositories on `JpaRepository` (person is date-less; mention
orders by `ts`) with bespoke `…CreatedByAndDeletedFalse` finders; `PeopleService` (bootstrap
aggregation + `requireOwned` 404 gate); `PeopleController implements PeopleApi`; `PeopleMapper`
(Instant→OffsetDateTime); `PeopleSeedData` (demodata, idempotent) + `MentionSeedData` (demofixtures).

## Tests

- `PersonPopulator`/`MentionPopulator`; `person, mention` join the `ResetDatabase` TRUNCATE list.
- `PeopleServiceIT`: computed counts, 7d window, ordering, ownership isolation, soft-delete.
- `PeopleContractIT` (`ApiIntegrationTest`): GET round-trip, POST 201 + appears in GET,
  foreign person 404, bad tone 400, 401.

## FE

- `data/me/peopleApi.ts` + `data/me/peopleHooks.ts`: `usePeople()` via `useDualQuery`
  (`['people']`, mock = seed, realEmpty = `{people:[],mentions:[]}`), DTO→domain mappers with
  label derivation; `logMention` mutation (mock: cache prepend as today; real: POST + invalidate).
  Signature `{ people, mentions, logMention }` unchanged. `meHooks.ts` keeps only `useProfile`.
- `PeoplePage` week filter: newest-mention−7d threshold (replaces the hardcoded `'2026-05-18'`;
  same rendered rows in mock after `.slice(0,8)`).
- Tests: `peopleHooks.test.tsx` both modes; existing People view/sheet tests stay green.

## Gates

BE `./mvnw clean test`; FE `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`;
`docs/features/me.md` update + `node scripts/lint-docs.mjs`; milestone row; `--no-ff` merge.
