# „Rólam is" — person first, no duplicate chips (mezo-d6ivw.13)

Owner decision 2026-09-29 (option 2, prototype OK: `mezo.html#chat/rolamis`, "mehet az építés").
A chat message about a named person produced both an auto-saved person fact ("Megjegyeztem")
and an owner-fact candidate ("Megjegyezném") with the same content. Folded spec + plan.

## Decisions

1. **Person first.** `FactExtractionService` drops a candidate whose text names an active known
   person (`MentionDetectionService.matchActivePersons` on the candidate text), only when the
   `PersonFactService` bean exists (PEOPLE on) — otherwise nothing owns the content. Silent
   `continue`, code decides. The extraction prompt also says: skip facts about a named person
   (the person memory owns them), and write every candidate in the user's first person
   ("Szeretek…", "Nekem…"), never third person. First word stays `TÉNYKINYERÉS` (fake LLM key).
2. **„Rólam is"** on the chat's person-fact chip: a companion endpoint copies the person fact into
   `knowledge_fact` (new `source = 'person_fact'`, owner/category `mezo`/`life`, text = the person
   fact's text, which already carries the name when it reads as the user's sentence; if the text
   does not contain the person's name, prefix `"<Név>: "`). Link: nullable
   `knowledge_fact.source_person_fact_id` + partial unique index `(created_by,
   source_person_fact_id) where not is_deleted` (idempotent). Publishes
   `KnowledgeFactChangedEvent`.
3. **Tap again** = soft-delete the copy **without** a text veto (not `ForgetService.forgetFact`).
4. **Cascade:** the person fact's „Visszavonom" and the chat forget flow also remove the copy
   (owner answer to Q1: yes, both go).
5. Chip copy as prototyped: „Rólam is" → „Rólad is · kész"; sub-line „<Név> lapján látod" /
   „<Név> lapján és a Tudástár Rólad részében is látod"; toasts „Rólad is megjegyeztem." /
   „Csak <Név> lapján marad.". No new icons.

## Tasks

1. BE filter + prompt (TDD, `FactExtractionServiceIT`).
2. Liquibase changeset: source CHECK drop+add with `person_fact`, `source_person_fact_id` column +
   partial unique index. Entity + `MemoryProvenanceEnvelope.personFact(...)` factory.
3. `PersonFactService.ownedFact(userId, factId)` public read (people port);
   companion `AboutMeService` (or in `KnowledgeFactService`): `copyPersonFact`, `removeCopy`.
4. Contract: `POST/DELETE /api/companion/turn-memory/person-fact/{personFactId}/about-me` (or
   equivalent), `TurnPersonFactResponse.aboutMeFactId` (nullable), `KnowledgeFactProvenance`
   enum + `KnowledgeFactResponse.source` description gain `person_fact`. `generate:api` both.
5. `TurnMemoryService` fills `aboutMeFactId` (batched lookup, non-transactional read).
6. Cascade: `PersonFactService.undo` path (companion side: the undo endpoint used by the chip is
   people-owned → cascade via a companion listener on a new `PersonFactUndoneEvent`, or the FE
   calls both; choose the event, people publishes, companion listens — people must not import
   companion) + `ChatForgetService.forgetItems` KIND_PERSON_FACT removes the copy.
7. FE: `TurnLearned.aboutMeFactId`, `useTurnMemoryActions.toggleAboutMe` (cache patch +
   settled), `MemoryChip` Remembered variant gets the toggle (chat surface only; csapatfal
   unchanged), mock seed + MSW handlers, `FactSource` union + hubCopy/factCopy/roladCopy.
8. Docs: `docs/features/companion.md` (+ fix stale V1.2 chip-polling line), `me.md` note,
   feature index row, milestone entry; living-prototype README date.

## Kész, ha…

- A named-person candidate is not proposed when PEOPLE is on; still proposed when PEOPLE is off (IT).
- Candidates are first person (prompt) — fake-LLM fixture passes; prod check after deploy.
- „Rólam is" creates exactly one knowledge fact (idempotent), tap again soft-deletes it with no veto,
  re-tap re-creates (IT); `KnowledgeFactChangedEvent` published.
- Person-fact undo and chat forget remove the copy (IT).
- Turn memory returns `aboutMeFactId`; chip shows both states; csapatfal chip unchanged (FE tests).
- Tudástár shows `person_fact`-sourced facts without crashing (mapper + FE copy tables).
- Gates: focused ITs + ArchitectureTest + PromptOrderFixtureGearGuardTest (Testcontainers), FE both
  modes (`CI=true`, unset and `VITE_USE_MOCK=false`), `pnpm build`, contract drift clean,
  codemap regenerated, lint-docs 0 errors (pre-existing stale excepted).
- Merged, ci + deploy green, live version checked; prod DB shows the new column/constraint.
- Living prototype matches (already published v3).
