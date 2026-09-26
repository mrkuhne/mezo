# U9b · Rólad — a közös kép (design)

- **Bead:** `mezo-zpxv7` (epic `mezo-me75u`, labels `epic:uvegesites`, `epic:boop-team-feed`)
- **Date:** 2026-09-26 · **Status:** owner-approved design (brainstorm 2026-09-26)
- **Look canon:** `docs/design_2.0/prototypes/uveg-uzenofal.html` `rolad()` (D3, approved) —
  this spec only decides *behaviour and data*; the look is not re-litigated.
- **Amends:** csapatfal spec `2026-09-23-boop-team-feed-design.md` §8 (Rólad content redesign was
  out of scope there; the owner approved it as U9b on 2026-09-25).

## 1. Goal

`/mezo/rolad` becomes the one place where the team's picture of the user lives **and where the
user decides about it**. The Tudástár's approval inbox moves here (csapatfal spec §4 rule 3: one
decision lives in one place); the Tudástár keeps the archive.

## 2. Owner decisions (2026-09-26 brainstorm — do not re-litigate)

| # | Question | Decision |
|---|---|---|
| D1 | Source of the quote | **The highest-confidence non-sensitive character claim** (from `useCharacterOverview` `topClaims` across dimensions; `sensitive` claims are never quoted), attributed to its proposing character. Talál → `useClaimFeedback().submit(id,'TALAL')`; Pontosítom → the existing `CharacterReplyThread` (source `CLAIM`). No claim → honest empty state. No invented sentence (ADR 0049). |
| D2 | „Most ne” | **Two actions:** **Most ne** = real snooze (candidate hidden, re-offered after **14 days**) and a quieter **Nem igaz** = today's reject (terminal). Owner's example: „randizom valakivel — most még nem tudjuk, milyen hatással lesz rám”. |
| D3 | Dimensions (today's Rólad content) | **Behind a door** at the bottom: „A csapat képe rólad, dimenziónként →” to the existing `DimensionsPage` (`/mezo/karakter/dimenziok`). Nothing disappears. |
| D4 | What stays on the Tudástár | Full fact list (search, source, Elhallgattatom switch), Kategóriák, Hogyan működik?. The inbox is replaced by one pointer card „N javaslat vár rád a Rólad oldalon →”. Every producer link that lands on the inbox is repointed to Rólad. |
| D5 | Fact owner tag | **Backend owner field.** The team names the owning character when it proposes a fact; existing facts are backfilled once. Frontend shows `TŐLED` for user-authored sources. |

## 3. The page, top to bottom

1. **Page head** — eyebrow „A KÖZÖS KÉP · AMIT A CSAPAT KIMONDOTT RÓLAD”, h1 „Rólad”, living Boop as today.
2. **Idézet** (glass, rose) — the claim text in quotes; small line „Így fogalmaz most rólad
   <Karakter> · javítható benyomás, nem címke”; chips **Talál** · **Pontosítom**. After Talál:
   visible confirmation (toast + the chip shows the confirmed state). Empty: glass note „Még
   gyűjtjük, amit rólad tudni érdemes — az első kimondott benyomás ide kerül.” Character layer
   off (`overview == null`): the section is omitted (no fake).
3. **Döntésre vár · N JELÖLT** — fact candidates + LIFE_EVENT + SEASON candidates as glass
   decision cards (`TÉNYJELÖLT` / `ÉLETESEMÉNY-JELÖLT` / `ÉVSZAK-JELÖLT`), status row „<Karakter>
   hozta · <relatív nap>” (fact: `owner` + `createdAt`; graph: Mezo + `createdAt`), text, the
   why-it-matters line (fact: `evidence` when present, else the category sentence; graph:
   `CANDIDATE_COPY`). Actions: **Igen, jegyezd meg** (primary) · **Pontosítom** (inline refine —
   fact text; life event title + summary, unchanged semantics) · **Most ne** · **Nem igaz** (quiet
   text button). The conflict checkbox („kapcsold ki a régit”) moves unchanged. Accept afterlife:
   „Bekerült a rólad szóló képbe — a forrásával együtt” (life events keep `LifeEventAcceptedCard`).
   Most ne toast: „Rendben — kb. két hét múlva újra megkérdezzük.” Nem igaz toast: „Nem került be — nem kérdezzük újra.”
   Empty inbox: the section collapses to one quiet line „Nincs döntésre váró javaslat.”
4. **A tények rólad · N AKTÍV** — up to 4 active facts (most recently reinforced first), each
   tagged with its owner (`SZUNYA`/`MOCOR`/`FALAT`/`DERŰ`/`MEZO`, accent from `TEAM`) or `TŐLED`
   (source `manual` or `question`), and the provenance line from `factCopy.ts`. Door: „Mind a N
   tény — kereséssel, forrással és Elhallgattatom-kapcsolóval →” `/mezo/knowledge?view=tenyek`.
5. **Életesemények** — active LIFE_EVENT/SEASON nodes on the lit timeline, newest `occurredOn`
   first; single date (no ranges today — `occurredOn` only); SEASON as quarter via
   `formatCandidateDate`. Empty: section omitted.
6. **„A te kezedben”** note — approved copy verbatim.
7. **Dimensions door** (D3) plus the two existing doors kept as quiet rows: Így beszélj velem,
   Kapcsolatok (today's Rólad links — nothing disappears).

Week context: `?start=YYYY-MM-DD` on `/mezo/rolad` shows the week banner (moved from the Tudástár,
same validation and back link to `/me/week?start=`). Like today, it does not filter: the inbox
shows every open proposal.

## 4. Backend changes

### 4.1 Snooze (D2)
- **Migration** `202609261000_mezo-zpxv7_candidate_snooze.sql`: `learned_fact.snoozed_until
  timestamptz null`; `knowledge_node.snoozed_until timestamptz null`.
- **Contract:** `FactDecisionRequest.decision` pattern `accept|reject|refine|snooze`;
  `GraphCandidateDecisionRequest.decision` `accept|reject|snooze`. Responses unchanged.
- **FactCandidateService.decide:** `snooze` → `snoozedUntil = now + CandidateSnooze.DURATION`
  (14 days, a constant), `userDecision` stays null (non-terminal); may be snoozed again.
  `listPending` excludes rows with `snoozed_until > now()`.
- **LifeEventCandidateService.decide:** `snooze` → same on the node, status stays `candidate`.
  `GraphService.listCandidates` excludes `snoozed_until > now()`.
- Accept/refine/reject clear nothing extra (terminal paths unchanged). Time via `Instant.now()` (the companion idiom).

### 4.2 Fact owner (D5)
- **Migration** (same file): `learned_fact.owner varchar(16)` and `knowledge_fact.owner
  varchar(16)`, CHECK `owner in ('szunya','mocor','falat','deru','mezo')`, NOT NULL after backfill.
  Backfill: category default (`train→mocor`, `fuel→falat`, `health→deru`, `life→mezo`), then
  `health` rows whose text matches a sleep lexicon (`alv|alsz|lefekv|ébred|sleep|bed`, case-
  insensitive) → `szunya`.
- **Producers set it:** `FactExtractionService` prompt JSON gains `"owner":"szunya|mocor|falat|deru|mezo"`;
  `WeeklyLessonService.LessonProposal` gains `owner`; an invalid/missing owner falls back to the
  category default (never rejects the fact). `PatternService`, `QuestionAnswerService`,
  `KnowledgeFactService` (manual) use the category default; promotion inherits the candidate's owner.
  The fake LLM's deterministic answers gain an owner.
- **Contract:** `FactCandidateResponse.owner` and `KnowledgeFactResponse.owner` (enum, required).

## 5. Frontend changes

- `BoopAboutPage` rebuilt per §3 from new components under `features/insights/components/rolad/`
  (`RoladQuote`, `RoladInbox`, `RoladFacts`, `RoladTimeline`); inbox logic moves out of
  `KnowledgeListPage` into a `useRoladInbox` hook (fact + graph candidates, `acceptedEvents`
  state, degraded/404 handling kept separate per layer).
- `FactCandidateCard` / `LifeEventCandidateCard`: add **Most ne** (snooze) + rename Elvet → **Nem
  igaz**; mock branches remove the item on snooze.
- `knowledgeApi.toFactCandidate` widens to keep `createdAt`, `source`, `evidence`, `weekStart`,
  `owner`; `graphApi.toKnowledgeGraphNode` keeps `occurredOn`. `FactSource` gains
  `weekly_review` | `question` (drift fix, `originChipLabel`/`originSentence` cover them).
  Real-mode life-event accept also invalidates `['graph','nodes']` (timeline freshness).
- `KnowledgeBaseView`: inbox blocks removed → pointer card with the pending count; dead
  `profileNode`/`profileLine` props removed.
- Repoint to `/mezo/rolad` (keep `?start=`): `WeekLessonsPage.tsx:19`, `WeekDiscoveries.tsx:127`,
  `weekHighlight.ts:63`, `AppNotificationKind.GRAPH_CANDIDATE` deeplink, `feedMock.ts`. `?fact=`
  links stay on the Tudástár fact list.
- `navModel` / `pageIndex` hints updated; CSS under the page-owned `kr9-rolad` prefix in
  `boop-world.css`, reusing the csapatfal `tf-*` case recipe (no second glass recipe).

## 6. Error, loading, degraded

Each layer keeps its own honest state: companion 404 → inbox/facts sections show the existing
degraded card; graph 404 → life-event parts empty; character off → quote omitted. Pending → ghost
rows; error → retry, before any count is shown.

## 7. Testing

- Backend: TDD unit + IT for snooze (hidden until due, re-listed after, re-snoozable, still
  decidable), owner (extractor parse + fallback, promotion inherits, backfill migration IT),
  contract-drift gate, ArchUnit, codemap.
- Frontend: `BoopAboutPage` tests replace the 3-door pin with the §3 ranking; moved inbox tests
  from `KnowledgeListPage.test.tsx` (fact/conflict, life-event/season, `?start=`, real-mode POST,
  degraded) land on Rólad; Tudástár asserts the pointer; both FE modes; `pnpm build`.
- Reverse parity checklist on the bead: accept, refine, dismiss (Nem igaz), snooze (new),
  conflict checkbox, life-event refine title/summary, week banner `?start=`, accepted card,
  degraded states, dimensions/communication/connections doors.

## 8. Out of scope

A synthesized team-wide summary sentence (D1 option B); life-event date ranges; any change to
the Tudástár fact list itself; light mode.

## Prior art

Researcher report (2026-09-26). No mainstream product ships a *suggest-first* memory inbox —
ChatGPT Memory (https://help.openai.com/en/articles/8590148-memory-faq), Claude memory
(https://claude.com/blog/claudes-memory-works-everywhere-and-you-decide-whats-in-it) and Oura
Advisor (https://support.ouraring.com/hc/en-us/articles/39512345699219-Oura-Advisor) all save
first and review later. **Adopted:** per-fact source + correct-one-at-a-time (Claude), "you said
it" vs "seen in data" provenance and a clear control note (Oura), dated/attributed summary line
(ChatGPT); Google PAIR (https://pair.withgoogle.com/chapter/feedback-controls/) — mutually
exclusive explicit actions, specific acknowledgement, keep control in health; Microsoft HAX G8/G9/
G11 (https://www.microsoft.com/en-us/haxtoolkit/guideline/support-efficient-dismissal/) — easy
dismiss, easy correction, visible "why". The snooze-vs-dismiss split (D2) is our own design
choice; no source defined it. **Rejected:** auto-save and uninspectable background memory, and a
summary that leaves things out (both break the honesty rule).

## Codebase terrain

Investigator report (2026-09-26). Features: **insights** (FE: `BoopAboutPage.tsx`,
`KnowledgeListPage.tsx`, `KnowledgeBaseView.tsx`, `FactCandidateCard.tsx`,
`LifeEventCandidateCard.tsx`, `data/insights/{knowledgeHooks,knowledgeApi,graphHooks,graphApi}.ts`),
**companion** (BE: `FactCandidateService`, `LifeEventCandidateService`, `GraphService.listCandidates`,
`FactExtractionService`, `WeeklyLessonService`; contracts `companion.yml`, `knowledge-graph.yml`),
**character** (`useCharacterOverview`, `useClaimFeedback`, `CharacterReplyThread`, `ClaimTile`
pattern). Patterns: dual-mode hooks with separate 404 semantics per layer; `tf-case` glass
cases; copy in pure tested modules (`factCopy.ts`, `CANDIDATE_COPY`); one character-mapping helper
(`team.ts`, bible rule 69). Traps: reject is terminal (fact decided, node soft-deleted) — hence
the new snooze; no sleep category — hence the owner field; `toFactCandidate` drops who/when;
conflict checkbox is mock-only in real mode (unchanged here); `occurredOn` dropped in the graph
mapper; real-mode accept does not refresh `['graph','nodes']`; `FactSource` drift; rule 3 producer
repoints; `BoopAboutPage.test.tsx` pins the old doors by design; regenerate the codemap after every
merge; focused ITs miss ArchUnit.
