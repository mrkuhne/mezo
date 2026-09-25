# Emlékezet S1 — Structured Evidence Wire Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The observation feed serves structured, lossless evidence items (re-read from the original source records) instead of raw persisted label strings; one shared FE evidence block renders them on the card, the today hero and the team feed; button copy becomes "Igen, ez igaz rám" / "Nem, ez nem stimmel" / "Beszéljük meg".

**Architecture:** BE re-reads each canonical evidence ref through the existing `PersonalRecordQuery` catalogue (`ObservationContextService`) and emits a `record`/`tag` item array on `ObservationResponse.evidence`; `pattern_event.evidenceRefs` (LLM grounding) is never rewritten. FE deletes the regex re-parser and keeps only presentation (labels, units, icons) in a module moved to `shared/ui/evidence`, consumed by ObservationCard, NapPersonalInsight and the team feed.

**Tech Stack:** Spring Boot (generated DTOs via openapi-generator from `api/openapi.yml`), OpenAPI contract fragments in `api/feature/companion/companion.yml`, React + TypeScript FE with `openapi-typescript` generated types, Vitest (mock + real mode), Maven ITs.

**Driving bead:** `mezo-d6ivw.1` — commit subjects end with `(mezo-d6ivw.1)`.
**Spec:** `docs/superpowers/specs/2026-09-24-mezo-emlekezete-design.md` — base §S1 + "S1 delta" section (the delta overrides the base's BE-prose idea).

## Global Constraints

- Never rewrite `pattern_event.evidenceRefs` or `pattern.evidence` contents — they double as LLM grounding text. All change is read-time.
- Button copy exactly: `Igen, ez igaz rám` / `Nem, ez nem stimmel` / `Beszéljük meg`. Choice wire values `watch`/`reject`/`talk` unchanged.
- Contract regen after `companion.yml` edits: `cd api/generate && npm run generate:api`, then `cd frontend && pnpm generate:api`. BE DTOs regenerate during the Maven build.
- FE tests both modes with `CI=true`: `VITE_USE_MOCK` unset AND `VITE_USE_MOCK=false` (unset = mock; bare `pnpm test` runs mock twice).
- FE file filters after `--` do NOT scope vitest; run the suite or use `vitest related`-free targeted invocations via `pnpm test` full runs at gate time. During TDD iterate with `CI=true pnpm vitest run <path>` from `frontend/` (this DOES scope; it's the `pnpm test -- <file>` form that doesn't).
- Backend focused tests: `./mvnw test -Dtest=<ClassName>` from repo root's `backend/` dir sibling (`./mvnw` wrapper lives at repo root). Full suite only with `-Dmezo.test.use-testcontainers=true`.
- `node scripts/gen-codemap.mjs` after file moves and after every merge; `node scripts/lint-docs.mjs` clean if docs changed.
- Work in this worktree on branch `feat/emlekezet-s1`; never `cd` to the primary repo.
- Time-relative test fixtures must anchor to the queried day (midnight trap).

## File Structure

- `api/feature/companion/companion.yml` — new `ObservationEvidenceItem` schema; `ObservationResponse.evidence` item type flips.
- `backend/.../companion/reflection/service/ObservationContextService.java` — new `SourceRecord` record + `fetch()` (structured twin of `exists()`).
- `backend/.../companion/reflection/service/ObservationFeedService.java` — evidence item assembly replaces `displayEvidence`.
- `frontend/src/shared/ui/evidence/observationEvidence.ts` — MOVED from `features/today/logic/`, regex parser replaced by wire mapper.
- `frontend/src/shared/ui/evidence/ObservationEvidence.tsx` — MOVED from `features/today/components/`, unchanged rendering minus `truncated`.
- `frontend/src/data/types.ts`, `frontend/src/data/insights/observationsApi.ts`, `frontend/src/data/insights/observations.ts` — domain type, wire mapping, mock fixtures.
- `frontend/src/features/insights/logic/teamFeed.ts`, `.../components/feed/FeedPostCard.tsx` — feed carries + renders structured evidence.
- Copy sweep: `ObservationCard.tsx`, `NapPersonalInsight.tsx`, `FeedTrio.tsx` + six test files.

---

### Task 1: BE — `ObservationContextService.fetch()` (structured source re-read)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/reflection/service/ObservationContextService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ObservationContextServiceIT.java` (extend the existing IT)

**Interfaces:**
- Produces: `public record SourceRecord(String source, String date, String time, Map<String, String> fields, String quote)` and `public Optional<SourceRecord> fetch(UUID userId, String canonicalRef)` — Task 3 consumes both.
- `fetch` returns empty for null/malformed/unknown-source/foreign/non-original refs (same gate as `exists()`); `date` may be null when the record has no derivable occurrence date — callers must treat that as unusable.

- [ ] **Step 1: Write the failing tests** — in `ObservationContextServiceIT`, following the IT's existing fixture style (create a check-in row for the test user with note + metric fields, anchored to the queried day per the midnight trap):

```java
@Test
void fetchReturnsStructuredRecordForCheckIn() {
    // arrange: persist a check_in for user with date=<today>, slot_time="08:00",
    // note="Meglepően jól indult a hét", energy=6, stress=3 (reuse the IT's existing seeding helper)
    var ref = "check_in:" + checkInId;
    var rec = observationContextService.fetch(userId, ref).orElseThrow();
    assertThat(rec.source()).isEqualTo("check_in");
    assertThat(rec.date()).isEqualTo(today.toString());
    assertThat(rec.time()).isEqualTo("08:00");
    assertThat(rec.quote()).isEqualTo("Meglepően jól indult a hét");
    assertThat(rec.fields()).containsEntry("energy", "6").containsEntry("stress", "3");
    assertThat(rec.fields()).doesNotContainKey("note"); // prose lives in quote, not fields
    assertThat(rec.fields()).doesNotContainKey("id");   // OMITTED_FIELDS filtered
}

@Test
void fetchCapsQuoteAt500Chars() {
    // arrange: journal_entry with a 600-char text
    var rec = observationContextService.fetch(userId, "journal_entry:" + journalId).orElseThrow();
    assertThat(rec.quote()).hasSize(500);
}

@Test
void fetchRejectsUnknownAndForeignRefs() {
    assertThat(observationContextService.fetch(userId, null)).isEmpty();
    assertThat(observationContextService.fetch(userId, "nonsense")).isEmpty();
    assertThat(observationContextService.fetch(userId, "person:" + UUID.randomUUID())).isEmpty(); // not in SOURCES
    assertThat(observationContextService.fetch(otherUserId, "check_in:" + checkInId)).isEmpty();  // foreign
}
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && ./mvnw test -Dtest=ObservationContextServiceIT`
Expected: FAIL — `fetch` undefined.

- [ ] **Step 3: Implement** in `ObservationContextService`:

```java
private static final int QUOTE_MAX_CHARS = 500;

public record SourceRecord(String source, String date, String time,
                           Map<String, String> fields, String quote) {
    public SourceRecord { fields = Collections.unmodifiableMap(new LinkedHashMap<>(fields)); }
}

/** Structured re-read of one canonical ref — the display twin of {@link #exists}. Lossless:
 *  the persisted (possibly truncated) label is bypassed; the source record is read again. */
public Optional<SourceRecord> fetch(UUID userId, String canonicalRef) {
    if (canonicalRef == null) return Optional.empty();
    int colon = canonicalRef.indexOf(':');
    if (colon < 1 || !SOURCES.contains(canonicalRef.substring(0, colon))) return Optional.empty();
    UUID id;
    try { id = UUID.fromString(canonicalRef.substring(colon + 1)); }
    catch (IllegalArgumentException e) { return Optional.empty(); }
    String name = canonicalRef.substring(0, colon);
    var source = PersonalRecordSource.named(name);
    return records.read(userId, source, id, null, null, null, null, 0, 1).stream()
            .map(row -> json.readTree(row.content()))
            .filter(data -> original(source, data))
            .findFirst()
            .map(data -> structured(userId, name, source, data));
}

private SourceRecord structured(UUID userId, String name, PersonalRecordSource source, JsonNode data) {
    var fields = new LinkedHashMap<String, String>();
    String quote = null;
    for (var entry : data.properties()) {
        if (OMITTED_FIELDS.contains(entry.getKey()) || entry.getValue().isNull()) continue;
        String value = entry.getValue().isTextual() ? entry.getValue().asText() : entry.getValue().toString();
        if (PROSE_FIELDS.contains(entry.getKey())) {
            if (quote == null && !value.isBlank()) quote = cap(value);
        } else {
            fields.put(entry.getKey(), value.replaceAll("[\\r\\n]+", " "));
        }
    }
    String time = fields.containsKey("time") ? fields.get("time") : fields.get("slot_time");
    return new SourceRecord(name, occurrenceDate(userId, source, data), time, fields, quote);
}

private static String cap(String value) {
    if (value.length() <= QUOTE_MAX_CHARS) return value;
    int end = QUOTE_MAX_CHARS;
    if (Character.isHighSurrogate(value.charAt(end - 1))) end--;
    return value.substring(0, end);
}
```

Note: `hasSize(500)` in the cap test assumes no surrogate at the cut — build the 600-char fixture from plain ASCII.

- [ ] **Step 4: Run to verify pass** — same command, expected PASS.
- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/reflection/service/ObservationContextService.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/ObservationContextServiceIT.java
git commit -m "feat(companion): structured source re-read for evidence display (mezo-d6ivw.1)"
```

---

### Task 2: Contract + BE — structured evidence on `ObservationResponse`

**Files:**
- Modify: `api/feature/companion/companion.yml` (ObservationResponse.evidence + new schema)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/reflection/service/ObservationFeedService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionObservationApiIT.java`
- Regen: `api/openapi.yml` (merge), `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Consumes: `ObservationContextService.fetch(UUID, String)` from Task 1.
- Produces: wire `ObservationResponse.evidence: ObservationEvidenceItem[]` — `{ type: 'record'|'tag', source?, date?, time?, fields?, quote?, ref?, text? }`. Task 3 consumes via regenerated `api.gen.ts`.
- NOTE: after this task the FE does not typecheck until Task 3 lands (branch-internal red, no push to main in between). BE gates stay green.

- [ ] **Step 1: Contract change** in `api/feature/companion/companion.yml` — replace the `evidence` property of `ObservationResponse`:

```yaml
        evidence:
          type: array
          items: { $ref: '#/components/schemas/ObservationEvidenceItem' }
          description: 'Az észrevétel ellenőrzött forrásai strukturáltan (mezo-d6ivw.1) — watching/confirmed kártyán a sor saját bizonyítékai.'
```

and add next to the other schemas (`ObservationRecoveryCandidate.evidence` stays `string[]` — out of scope):

```yaml
    ObservationEvidenceItem:
      type: object
      description: >-
        Egy bizonyíték-elem (mezo-d6ivw.1). `record` = az eredeti forrásrekord olvasáskor
        újraolvasva (veszteségmentes — a tárolt, esetleg csonkolt címke nem a kijelző forrása);
        `tag` = rövid szöveges címke (legacy/statisztikai csatorna). A megjelenítés (magyar név,
        egység, ikon) a FE dolga; a szerver adatot ad.
      required: [type]
      properties:
        type: { type: string, pattern: '^(record|tag)$' }
        source: { type: string, nullable: true, description: 'A forráskatalógus neve (check_in, journal_entry, …) — csak record.' }
        date: { type: string, format: date, nullable: true, description: 'A rekord napja — csak record.' }
        time: { type: string, nullable: true, description: 'A rekord időpontja (HH:mm), ha hordozza — csak record.' }
        fields:
          type: object
          additionalProperties: { type: string }
          nullable: true
          description: 'A rekord saját nem-próza mezői nyersen — csak record.'
        quote: { type: string, nullable: true, description: 'A felhasználó saját szavai (jegyzet/napló), max 500 karakter — csak record.' }
        ref: { type: string, nullable: true, description: 'Kanonikus forráshivatkozás (forrás:uuid) — provenance, csak record.' }
        text: { type: string, nullable: true, description: 'A címke szövege — csak tag.' }
```

- [ ] **Step 2: Regenerate**

```bash
cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api
```

- [ ] **Step 3: Write the failing IT** — extend `CompanionObservationApiIT` (follow its existing grounded-payload round-trip fixtures at the `:377`/`:415` area, which persist a pattern + grounded observation event whose `evidenceRefs` interleave `check_in:<id>` with a label):

```java
@Test
void groundedEvidenceIsServedStructured() {
    // arrange: existing grounded fixture — a check_in row (note + energy/stress/mental) and an
    // observation event with evidenceRefs [ "check_in:"+id, "Check-in · <day> · note=…; energy=6…" ]
    // act: GET /api/companion/observation
    // assert on the fresh card's evidence:
    var item = card.getEvidence().getFirst();
    assertThat(item.getType()).isEqualTo("record");
    assertThat(item.getSource()).isEqualTo("check_in");
    assertThat(item.getDate()).isEqualTo(day.toString());
    assertThat(item.getQuote()).isEqualTo("Meglepően jól indult a hét");
    assertThat(item.getFields()).containsEntry("energy", "6");
    assertThat(item.getRef()).isEqualTo("check_in:" + checkInId);
}

@Test
void legacyEvidenceLabelsBecomeTags() {
    // arrange: legacy (non-grounded) event with evidenceRefs ["4 hála-bejegyzés"]
    var item = card.getEvidence().getFirst();
    assertThat(item.getType()).isEqualTo("tag");
    assertThat(item.getText()).isEqualTo("4 hála-bejegyzés");
}

@Test
void unreadableRefFallsBackToStoredLabel() {
    // arrange: grounded event whose evidenceRefs pair a check_in ref of a DELETED row with its label
    // (persist the row, capture id, delete it; validEventEvidence hides fully-dead cards, so keep
    //  a second LIVE ref on the same event to keep the card visible)
    assertThat(items).anySatisfy(i -> {
        assertThat(i.getType()).isEqualTo("tag");
        assertThat(i.getText()).startsWith("Check-in ·");
    });
}
```

(Adapter note: generated DTO accessors may be `getType()`/`type()` depending on generator config — mirror whatever the existing IT uses for `ObservationResponse`.)

- [ ] **Step 4: Run to verify failure**

Run: `cd backend && ./mvnw test -Dtest=CompanionObservationApiIT`
Expected: FAIL (compile: `evidence(List<String>)` no longer matches; then assertions).

- [ ] **Step 5: Implement** in `ObservationFeedService` — replace `displayEvidence` with an item assembler:

```java
private ObservationEvidenceItem tag(String text) {
    return ObservationEvidenceItem.builder().type("tag").text(text).build();
}

private ObservationEvidenceItem record(String ref, ObservationContextService.SourceRecord rec) {
    return ObservationEvidenceItem.builder().type("record").source(rec.source())
            .date(LocalDate.parse(rec.date())).time(rec.time())
            .fields(rec.fields()).quote(rec.quote()).ref(ref).build();
}

/** Grounded lists: canonical refs re-read losslessly; the stored label that may follow a ref
 *  (event snapshots interleave pairs) is consumed as fallback-only. Topic markers are dropped. */
private List<ObservationEvidenceItem> evidenceItems(UUID userId, List<String> refs) {
    if (refs == null) return List.of();
    var out = new ArrayList<ObservationEvidenceItem>();
    for (int i = 0; i < refs.size(); i++) {
        String ref = refs.get(i);
        if (ref == null || ref.startsWith("observation-topic")) continue;
        if (!canonicalReference(ref)) { out.add(tag(ref)); continue; }
        String next = i + 1 < refs.size() ? refs.get(i + 1) : null;
        String label = next != null && !canonicalReference(next) && !next.startsWith("observation-topic")
                ? next : null;
        if (label != null) i++;
        var fetched = observationContextService.fetch(userId, ref).filter(r -> r.date() != null);
        if (fetched.isPresent()) out.add(record(ref, fetched.get()));
        else if (label != null) out.add(tag(label));
    }
    return out;
}

/** Legacy quick-notice vocabulary (gratitude/chat_day refs, free-text labels) passes through
 *  verbatim as tags — mirrors the old unfiltered read semantics. */
private static List<ObservationEvidenceItem> legacyItems(List<String> refs) { /* refs→tag list, null→List.of() */ }
```

Call sites (signatures need `UUID userId` threaded — `eventCard` and `rowCard` callers already hold it):
- `eventCard`: `.evidence("grounded".equals(payload.channel()) ? evidenceItems(userId, payload.evidenceRefs()) : legacyItems(payload.evidenceRefs()))`
- `rowCard`: `.evidence(evidenceItems(userId, row.getEvidence() == null ? null : row.getEvidence().items()))`

Also update `ObservationRecoveryService`/any other compile break ONLY if it builds `ObservationResponse` (check with the compiler; the recovery *candidate* schema is untouched). `date(...)` builder type may be `LocalDate` or `String` per generator — follow the generated signature.

Known benign limitation (documented in the S1 delta): in row-card provenance lists a free-text legacy label directly following a canonical ref would be consumed as its fallback label; publisher-built row lists contain only refs + topic markers, so this does not occur in practice.

- [ ] **Step 6: Run to verify pass** — `./mvnw test -Dtest=CompanionObservationApiIT,ObservationContextServiceIT`, expected PASS.
- [ ] **Step 7: Commit**

```bash
git add api/ backend/ frontend/src/data/_client/api.gen.ts
git commit -m "feat(api,companion): observation evidence served structured, lossless (mezo-d6ivw.1)"
```

---

### Task 3: FE — mapper replaces parser; shared evidence module; card + hero + mocks

**Files:**
- Move+rewrite: `frontend/src/features/today/logic/observationEvidence.ts` → `frontend/src/shared/ui/evidence/observationEvidence.ts`
- Move: `frontend/src/features/today/components/ObservationEvidence.tsx` → `frontend/src/shared/ui/evidence/ObservationEvidence.tsx`
- Move: `frontend/src/features/today/logic/observationEvidence.test.ts` → `frontend/src/shared/ui/evidence/observationEvidence.test.ts` (rewrite as mapper tests)
- Modify: `frontend/src/data/types.ts` (Observation.evidence), `frontend/src/data/insights/observationsApi.ts` (toObservation), `frontend/src/data/insights/observations.ts` (mock fixtures), `frontend/src/features/today/components/ObservationCard.tsx`, `frontend/src/features/today/components/NapPersonalInsight.tsx`
- Test: the moved mapper test + existing `ObservationCard.test.tsx`, `NapPersonalInsight.test.tsx`, `NapMezoPage.test.tsx`

**Interfaces:**
- Consumes: regenerated `components['schemas']['ObservationEvidenceItem']` from Task 2.
- Produces: `export interface WireEvidence` (structural twin of the generated `ObservationEvidenceItem`, defined in `shared/ui/evidence/observationEvidence.ts` so the shared module stays independent of the API client); `export function mapEvidence(w: WireEvidence): EvidenceItem` in the same module; domain `Observation.evidence: EvidenceItem[]`; `EvidenceList({ evidence: EvidenceItem[], today: string })`. Task 4 consumes all four.

- [ ] **Step 1: Move files** (`git mv`), update every import (`@/features/today/logic/observationEvidence` → `@/shared/ui/evidence/observationEvidence`; `@/features/today/components/ObservationEvidence` → `@/shared/ui/evidence/ObservationEvidence`). Grep to confirm no stale import remains.

- [ ] **Step 2: Rewrite the mapper test** (`observationEvidence.test.ts`) — failing first. Keep the `evidenceBlocks` / `evidenceDayLabel` cases (feed them `EvidenceItem[]` / unchanged), replace `parseEvidence(raw string)` cases with:

```ts
import { mapEvidence } from './observationEvidence'

const wire = (over = {}) => ({
  type: 'record', source: 'check_in', date: '2026-05-21', time: '08:00',
  fields: { energy: '6', stress: '3', state: 'done' },
  quote: 'Meglepően jól indult a hét', ref: 'check_in:abc', ...over,
})

it('maps a check-in record: name, icon, checkin dims, quote; hidden fields dropped', () => {
  const r = mapEvidence(wire())
  expect(r).toMatchObject({ kind: 'record', source: 'Check-in', icon: 't-checkin', title: 'Check-in', date: '2026-05-21', time: '08:00', quote: 'Meglepően jól indult a hét' })
  if (r.kind !== 'record') throw new Error('record expected')
  expect(r.checkin).toEqual({ energy: 6, stress: 3 })
  expect(r.values).toEqual([]) // state is HIDDEN
})

it('maps a sport session: sport name as title, source as subtitle, formatted values', () => {
  const r = mapEvidence(wire({ source: 'sport_session', fields: { sport: 'volleyball', duration_min: '90', rpe: '7' }, quote: undefined }))
  if (r.kind !== 'record') throw new Error('record expected')
  expect(r.subtitle).toBe('Sportnapló')
  expect(r.values).toContainEqual({ value: '90', unit: 'perc' })
  expect(r.values).toContainEqual({ label: 'RPE', value: '7', unit: '/10', hot: true })
})

it('maps unknown source to its raw name with the note icon', () => {
  const r = mapEvidence(wire({ source: 'future_thing', fields: {} }))
  expect(r).toMatchObject({ kind: 'record', source: 'future_thing', icon: 't-note' })
})

it('maps tags and recordless items to tag', () => {
  expect(mapEvidence({ type: 'tag', text: '4 hála-bejegyzés' })).toEqual({ kind: 'tag', text: '4 hála-bejegyzés' })
  expect(mapEvidence(wire({ date: undefined, text: undefined }))).toMatchObject({ kind: 'tag' })
})
```

Run: `cd frontend && CI=true pnpm vitest run src/shared/ui/evidence/observationEvidence.test.ts` — FAIL (`mapEvidence` undefined).

- [ ] **Step 3: Rewrite `observationEvidence.ts`**: delete `RECORD` regex, `fields()`, truncation-repair and `parseEvidence`; drop `truncated` from `EvidenceRecord`; re-key the two source tables by catalogue kind and add `mapEvidence`:

```ts
const SOURCE_ICON: Record<string, Icon3DName> = {
  sport_session: 't-volley', check_in: 't-checkin', journal_entry: 't-journal', gratitude_entry: 't-sprout',
  sleep_log: 't-sleep', run_session_log: 't-run', workout_session: 't-dumbbell',
  exercise: 't-dumbbell', exercise_set: 't-dumbbell', exercise_feedback: 't-dumbbell',
  ai_message: 't-chat', sport_event: 't-calendar', activity_log: 't-steps', ritual_day: 't-chain',
  habit_day: 't-chain', meal: 't-bowl', meal_item: 't-bowl', water_log: 't-water',
  weight_log: 't-weight', daily_intention: 't-ring', intention_focus: 't-ring',
}
/** A szerver a katalógus-nevet küldi — magyar nevet itt kap (a megjelenítés a FE dolga). */
const SOURCE_NAME: Record<string, string> = {
  journal_entry: 'Napló', gratitude_entry: 'Hála', check_in: 'Check-in', ai_message: 'Saját chatüzenet',
  sleep_log: 'Alvás', run_session_log: 'Futás', workout_session: 'Edzés', exercise: 'Gyakorlat',
  exercise_set: 'Gyakorlat', exercise_feedback: 'Gyakorlat', sport_session: 'Sportnapló',
  sport_event: 'Tervezett sportesemény', activity_log: 'Tevékenység', ritual_day: 'Rituálé',
  habit_day: 'Szokás', meal: 'Étkezés', meal_item: 'Étkezés', water_log: 'Víz',
  weight_log: 'Testsúly', daily_intention: 'Napi szándék', intention_focus: 'Szándék',
}

export interface WireEvidence {
  type: string; source?: string | null; date?: string | null; time?: string | null
  fields?: Record<string, string> | null; quote?: string | null; ref?: string | null; text?: string | null
}

export function mapEvidence(w: WireEvidence): EvidenceItem {
  if (w.type !== 'record' || !w.source || !w.date) return { kind: 'tag', text: w.text ?? w.quote ?? '' }
  const f = w.fields ?? {}
  const sport = sportOf(f.sport)
  const values: EvidenceValue[] = []
  const checkin: Partial<Record<CheckinKey, number>> = {}
  for (const [k, v] of Object.entries(f)) {
    if (HIDDEN.has(k) || k.endsWith('_id') || k.endsWith('_at') || v === '') continue
    const dim = CHECKIN_DIMS.find((d) => d.key === k)
    if (dim) { const n = Number(v); if (Number.isFinite(n)) checkin[dim.key] = n; continue }
    if (k === 'kcal') { values.push({ value: `${f.kcal_is_estimate === 'true' ? '~' : ''}${num(v)}`, unit: 'kcal' }); continue }
    const fmt = FIELDS[k]
    values.push(fmt ? fmt(v) : { label: k.replace(/_/g, ' '), value: v })
  }
  const name = SOURCE_NAME[w.source] ?? w.source
  return {
    kind: 'record', source: name,
    icon: sport?.icon ?? SOURCE_ICON[w.source] ?? 't-note',
    title: sport?.name ?? name, subtitle: sport ? name : undefined,
    date: w.date, time: w.time ?? undefined, values,
    checkin: Object.keys(checkin).length ? checkin : undefined,
    quote: w.quote ?? undefined,
  }
}
```

(`PROSE` const and the `PROSE.includes(k)` skip go away — prose arrives separately as `quote`. Keep `FIELDS`, `HIDDEN`, `sportOf`, `evidenceBlocks`, `evidenceDayLabel`, `CHECKIN_DIMS` as-is. `evidenceBlocks(items: EvidenceItem[])` now takes items, not raw strings — delete its internal `raws.map(parseEvidence)`.)

In `ObservationEvidence.tsx`: `EvidenceList({ evidence, today }: { evidence: EvidenceItem[]; today: string })`, and drop `{r.truncated ? '…' : ''}` from the quote line. Update the module header comment (the wire is structured now).

- [ ] **Step 4: Domain + mapping + consumers:**
  - `types.ts`: `Observation.evidence: EvidenceItem[]` (import type from `@/shared/ui/evidence/observationEvidence`).
  - `observationsApi.ts`: `evidence: w.evidence.map(mapEvidence)` in `toObservation`.
  - `ObservationCard.tsx`: remove the `parseEvidence` import; `const records = item.evidence.filter((e) => e.kind === 'record').length`.
  - `NapPersonalInsight.tsx`: replace the `<details>`/`<ul>`/`SafeMarkdown` evidence list with the shared block: `{item.evidence.length > 0 && <details className="nap-personal-evidence"><summary>Miből látom?</summary><EvidenceList evidence={item.evidence} today={localDateString()} /></details>}` (import `localDateString` from `@/shared/lib/dates`).
  - `observations.ts` mock fixtures: keep them mirroring the wire — define items in wire shape and map:

```ts
evidence: ([
  { type: 'record', source: 'journal_entry', date: '2026-05-19',
    fields: {}, quote: 'A hétfők mindig nehezek, egész nap csak vonszoltam magam', ref: 'journal_entry:mock-1' },
  { type: 'record', source: 'check_in', date: '2026-05-21', time: '08:00',
    fields: { energy: '6', stress: '3', body: '7', mental: '7' }, quote: 'Meglepően jól indult a hét', ref: 'check_in:mock-2' },
  { type: 'record', source: 'check_in', date: '2026-05-21', time: '20:00',
    fields: { energy: '5', stress: '2', body: '7', mental: '8' }, ref: 'check_in:mock-3' },
] satisfies WireEvidence[]).map(mapEvidence),
```

Sweep every `evidence:` array in `MOCK_OBSERVATIONS` the same way (translate each old raw string's parts into a wire item; a statistical/legacy label becomes `{ type: 'tag', text: '…' }`).

- [ ] **Step 5: Run FE tests both modes**

```bash
cd frontend && CI=true pnpm vitest run src/shared/ui/evidence src/features/today src/data/insights
CI=true VITE_USE_MOCK=false pnpm vitest run src/shared/ui/evidence src/features/today src/data/insights
```
Expected: PASS (fix any test that asserted raw evidence strings — e.g. `ObservationCard.test.tsx` fixtures now build `EvidenceItem[]` via `mapEvidence` or literals).

- [ ] **Step 6: Typecheck + commit**

```bash
cd frontend && pnpm build
git add -A frontend/src
git commit -m "feat(fe): shared structured evidence block replaces the wire re-parser (mezo-d6ivw.1)"
```

---

### Task 4: FE — team feed renders the shared evidence block

**Files:**
- Modify: `frontend/src/features/insights/logic/teamFeed.ts` (FeedPost + observationPost)
- Modify: `frontend/src/features/insights/components/feed/FeedPostCard.tsx` (PostBody)
- Modify: `frontend/src/styles/prototype.css` (spacing only, if needed)
- Test: `frontend/src/features/insights/logic/teamFeed.test.ts` (or wherever observationPost is covered — grep `observationPost\|teamFeed` in tests), `frontend/src/features/insights/components/feed/FeedPostCard.test.tsx` if present

**Interfaces:**
- Consumes: `EvidenceItem`, `EvidenceList` from `@/shared/ui/evidence/*` (Task 3).
- Produces: `FeedPost.evidence?: EvidenceItem[]`.

- [ ] **Step 1: Failing test** — the observation post no longer dumps evidence into `body`, carries it structurally instead:

```ts
it('observation post keeps evidence out of the prose body', () => {
  const post = /* build via the file's existing helper with an observation whose evidence
                  contains one record item (use mapEvidence on a wire literal) */
  expect(post.body).not.toContain('energia')      // no dumped metrics
  expect(post.evidence).toHaveLength(1)
  expect(post.evidence?.[0].kind).toBe('record')
})
```

Run: `cd frontend && CI=true pnpm vitest run src/features/insights` — FAIL.

- [ ] **Step 2: Implement**
  - `teamFeed.ts` — `FeedPost` gains `/** Strukturált bizonyíték az észrevétel-poszton — a kártyával közös építőkocka rajzolja. */ evidence?: EvidenceItem[]`; in `observationPost`: `body: [o.text, o.question].filter(Boolean).join('\n\n'), evidence: o.evidence.length ? o.evidence : undefined,`.
  - `FeedPostCard.tsx` `PostBody`:

```tsx
export function PostBody({ post }: { post: FeedPost }) {
  return (
    <>
      {post.title && <p className="tf-ptitle">{renderInline(post.title, { boldOnly: true })}</p>}
      <p className="tf-body">{renderInline(post.body, { boldOnly: true })}</p>
      {post.evidence && post.evidence.length > 0 &&
        <EvidenceList evidence={post.evidence} today={localDateString()} />}
    </>
  )
}
```

with imports `EvidenceList` from `@/shared/ui/evidence/ObservationEvidence`, `localDateString` from `@/shared/lib/dates`. If the rows sit tight against the body, add to `prototype.css`: `.tf-post .nap-obs-evid { margin-top: 10px; }` — flat cells on the quiet panel are canon-correct (üveg-in-üveg stays forbidden; the evidence rows are flat).

- [ ] **Step 3: Run + verify** — same vitest command PASS, then both-mode sweep of `src/features/insights`.
- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/insights frontend/src/styles/prototype.css
git commit -m "feat(fe): team feed observation posts render structured evidence (mezo-d6ivw.1)"
```

---

### Task 5: Copy — buttons + acks, all surfaces

**Files:**
- Modify: `frontend/src/features/today/components/ObservationCard.tsx` (`chipsFor`, `ackLine`), `frontend/src/features/today/components/NapPersonalInsight.tsx` (3 buttons), `frontend/src/features/insights/components/feed/FeedTrio.tsx` (observation branch), `frontend/src/data/insights/observationsHooks.ts` (doc comment line ~46)
- Test: `ObservationCard.test.tsx`, `NapPersonalInsight.test.tsx`, `NapMezoPage.test.tsx`, `FeedTrio.test.tsx`, `TeamFeedPage.test.tsx`

**Interfaces:** none new — copy only; `watch`/`reject`/`talk` untouched.

- [ ] **Step 1: Update the tests first** — sweep the five test files: every `'Igen, jellemző'` → `'Igen, ez igaz rám'`, `'Nem stimmel'` → `'Nem, ez nem stimmel'` (`'Beszéljük meg'` unchanged; the non-observation FeedTrio variants `'Ez talál'`/`'Nem így érzem'`/`'Elmesélem'` unchanged). Run `CI=true pnpm vitest run` on the five files' dirs — FAIL (buttons not found).
- [ ] **Step 2: Update the components:**
  - `chipsFor`: labels `'Igen, ez igaz rám'`, `'Nem, ez nem stimmel'`, `'Beszéljük meg'`.
  - `ackLine` (consequence-naming, honest about today's behavior — durable memory is S2):
    - watch: `'Megjegyeztem, hogy ez igaz rád. Az összefüggést tovább figyelem.'`
    - reject: `'Értem, ez nem stimmel. Nem hozom fel újra ebben a formában.'`
    - talk: unchanged.
  - `NapPersonalInsight` buttons: same three labels.
  - `FeedTrio` observation branch: `{post.observation ? 'Igen, ez igaz rám' : 'Ez talál'}`, `{post.observation ? 'Nem, ez nem stimmel' : 'Nem így érzem'}` (talk row unchanged).
  - `observationsHooks.ts` doc comment: `(Igen, ez igaz rám / Nem, ez nem stimmel / Beszéljük meg)`.
- [ ] **Step 3: Run both modes on the touched dirs** — PASS.
- [ ] **Step 4: Commit**

```bash
git add frontend/src
git commit -m "feat(fe): observation reply copy — Igen, ez igaz rám / Nem, ez nem stimmel (mezo-d6ivw.1)"
```

---

### Task 6: Gates, docs, codemap

**Files:**
- Modify: `docs/features/today.md`, `docs/features/insights.md`, `docs/features/companion.md` (evidence wire + copy mentions — grep `Igen, jellemző` and `key=value`/`evidence` in all three), `docs/CODEMAP.md` (regenerated)

- [ ] **Step 1: Full FE gates**

```bash
cd frontend && CI=true pnpm test && CI=true VITE_USE_MOCK=false pnpm test && pnpm build
```
Expected: all PASS, twice + build.

- [ ] **Step 2: BE focused gates**

```bash
cd backend && ./mvnw test -Dtest=CompanionObservationApiIT,ObservationContextServiceIT,GroundedHypothesisPipelineIT,ObservationRecoveryApiIT
```
Expected: PASS. (Focused ITs skip ArchUnit; no new BE class was added outside `reflection/service`, so the layer rules hold by construction — the assembler lives inside `ObservationFeedService` and `fetch` inside `ObservationContextService`.)

- [ ] **Step 3: Runtime pass** — `verify` skill on the touched surfaces (observation card on the today page, team feed observation post), dark only, 320px, reduced motion. Confirm: structured rows on the card, evidence rows (not raw text) on the feed post, new button labels, ack lines.

- [ ] **Step 4: Docs + codemap**

```bash
node scripts/gen-codemap.mjs
node scripts/lint-docs.mjs
```
Update the three feature docs where they describe the evidence wire or the old copy; commit.

```bash
git add docs/ && git commit -m "docs: S1 evidence wire + copy in feature docs, codemap (mezo-d6ivw.1)"
```

---

### Task 7: Merge + deploy + close (session driver §5–6)

- [ ] `git pull --rebase origin main` on the branch; re-run quick gates if anything came in.
- [ ] `git checkout --detach origin/main && git merge --no-ff feat/emlekezet-s1` → `node scripts/gen-codemap.mjs` (merge drops CODEMAP entries silently — regenerate and amend if changed) → `git push origin HEAD:main`. Merge subject: `feat(companion): S1 — strukturált bizonyíték-drót + gombfeliratok (mezo-d6ivw.1)`.
- [ ] Watch the `deploy` workflow for the pushed commit until success; a red `ci` outranks everything.
- [ ] Delete `feat/emlekezet-s1`. Append slice lessons to the spec's "Slice lessons" appendix (create on first use). `bd close mezo-d6ivw.1` with a result summary. Session close: `node scripts/check-beads-backup.mjs --fix` + commit, `bd dolt push`, `git push`, clean `git status`. Report to the owner in Hungarian.
