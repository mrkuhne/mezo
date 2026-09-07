# Konzílium — separating the Szkeptikus's and Mezo's roles (mezo-lghn)

**Status:** design, approved in chat 2026-09-07
**Driving issue:** `mezo-lghn`
**Feature doc to update on landing:** [`docs/features/character.md`](../../features/character.md)

## 1. The problem

In a real konzílium transcript, Mezo's ruling paraphrases the Szkeptikus's argument:

> **Szkeptikus** — Kukázta: "Az álmok tartalmának értelmezése rendkívül szubjektív. […] A
> bizonyíték (két megfigyelés egy napról) elégtelen."
> **Mezo** — Elvetve: "Az álmok tartalmának értelmezése szubjektív. A megfigyelések
> összekapcsolása […] megalapozatlan feltételezés."

This is not a prompt-tone problem. Under the current pipeline a paraphrase is the *correct*
output, for five structural reasons — all of them in code on `main`:

1. **Same decision criterion, stated twice.** `KonziliumVerdictRound.skepticPersona()` briefs the
   Szkeptikus on evidence sufficiency, alternative explanations and over-interpretation.
   `integratorPersona()` then tells Mezo to "csak azt fogadod el, amit a bizonyíték tényleg
   alátámaszt" — the same test. Nothing in Mezo's brief names a job the Szkeptikus is not already
   doing, and nothing tells Mezo it may disagree, or when.
2. **Neither judge can see the dossier.** `KonziliumVerdictRound` has no repository dependencies
   at all — only `CompanionLlm`, `ObjectMapper`, `LlmCallContextHolder`, `PromptPersona`. The
   *proposing* expert gets its own ACTIVE claims as a prompt trailer
   (`KonziliumProposalRound.runExpert`, `includeActiveClaimsTrailer`), so **the proposer is better
   informed than either judge.**
3. **An UP/DOWN/RETIRE target is a raw UUID.** `numberedProposals` renders
   `String.valueOf(p.claimId())` for anything but `NEW`, so neither judge sees which claim is
   being moved, nor its current text or confidence.
4. **The Szkeptikus's contract is binary `KEEP|KILL`.** It therefore pre-empts the accept/reject
   axis, leaving Mezo only the `confidence` number to differ on. The original spec gave Mezo three
   outcomes ("accept with confidence / reject / figyeljük tovább", `2026-08-27-user-character-dossier-design.md`
   §6), and the design prototype's own mock transcript shows the intended value-add — the Szkeptikus
   proposing a *grade* ("három adatpont kevés a »biztos«-hoz"), Mezo ruling on it. The shipped
   binary contract erases that.
5. **`integratorTurn` writes a raw decimal into the transcript** (`ELFOGADVA (0.60) — …`), which
   `KonziliumPage` renders verbatim. `CharacterConfidenceWords`'s own javadoc states the
   invariant this breaks: confidence is never surfaced to the user as a decimal, only as
   `biztos`/`valószínű`/`figyeljük`. (The newer `ConferenceThreadCard` does obey the rule; the
   prose transcript surface does not.)

Since `mezo-xlvr`, Mezo *does* receive one thing the Szkeptikus does not — the cross-talk peer
stances (`peerReactionsBlock`). That is peer opinion about the same evidence, not new evidence,
so it narrows cause 1 without removing it. It also produces an inversion worth naming: **the
adversary now judges on the thinnest information in the room** — the Szkeptikus sees neither the
dossier nor the peer stances.

**Why this is not cosmetic.** `KonziliumPage` promises the user "a fenti a valódi beszélgetés,
ami lezajlott — a felület sosem dramatizálja utólag". A chair turn that only echoes is exactly
the theater the Karakter spec §3 forbids.

## 2. Approach

Split the two roles along the axis the original spec already implies:

- **Szkeptikus = is it true?** Evidence sufficiency, per proposal, judged in isolation. Gains a
  graded verdict so it can say "yes, but not at this strength".
- **Mezo = do we write it down, and how?** Dossier integration: duplication, contradiction with
  what we already hold, how far the confidence may move, whether it belongs in a person's
  permanent dossier at all, and whether it is a chapter. Gains the evidence to answer those.

Rejected alternatives: collapsing the two roles into one call (removes the redundancy by
conceding Mezo's chair identity, which Karakter spec IDENT-1 treats as load-bearing); a
proposer-vs-Szkeptikus rebuttal round (strictly larger, and `KonziliumCrossTalkRound` already
delivers a debate layer — this can ride on top later).

## 3. Szkeptikus — graded verdict

Contract becomes:

```json
[{"index":0,"verdict":"KEEP|WEAKEN|KILL","argument":"...","suggestedConfidence":0.0-1.0}]
```

The contract *defines* the grades rather than listing them, so the middle option cannot become a
hedge:

- **KILL** — the evidence does not support the statement at all, or it is over-interpretation.
- **WEAKEN** — there is something here, but not at this strength.
- **KEEP** — the evidence carries the proposed strength.

`suggestedConfidence` is meaningful for `KEEP` and `WEAKEN`, ignored for `KILL`. The persona keeps
its "minden javaslatot megtámadj" framing and its self-audit subject check (that check is an
evidence question: is the subject really the system, not the user).

**The `sensitive` strictness clause moves out** of `skepticPersona()` — see §5. One criterion, one
owner.

Java: `SkepticVerdictDraft` gains `BigDecimal suggestedConfidence`. Defaulting is unchanged in
spirit — an unknown or missing verdict still defaults to `KEEP` for the chair's prompt block,
while `Result.verdicts` continues to emit **only** the indexes the Szkeptikus actually answered
(the `mezo-xlvr` I2 rule: never put a defaulted verdict in its mouth). `WEAKEN` joins `KEEP` and
`KILL` as a shown verdict.

## 4. Mezo — real evidence

`KonziliumVerdictRound` gains `CharacterClaimRepository` and `CharacterDimensionRepository`,
mirroring `KonziliumProposalRound`'s existing fields. Three changes to the Integrátor prompt:

- `numberedProposals` — **fixed for both judges**: for `UP`/`DOWN`/`RETIRE`, render the targeted
  claim's current text and confidence **word** instead of the raw UUID. A claim id that no longer
  resolves renders as an explicit "a célzott állítás nem található" rather than a UUID.
- `skepticVerdictsBlock` — carries `WEAKEN` and the suggested confidence word.
- **new `dossierBlock`** — per touched dimension: the title, then its ACTIVE claims (text +
  confidence word). For the claims a proposal actually targets, additionally the tail of
  `confidence_history` and the `user_feedback` events on that claim.

The dossier block is deterministically bounded by a new `CharacterProperties` value
(`mezo.character.konzilium.max-dossier-claims`, default 80; least-recently-updated claims drop
first), and **the block states when it was truncated** — a silently trimmed prompt would let the
chair conclude "we hold nothing like this" from an absence we created.

All three konzílium paths (weekly, monthly, bootstrap) call this round, so all three gain the
block from one change.

## 5. Mezo — brief, contract, and an enforced guardrail

The brief's load-bearing sentence names the division of labour, which is what gives the chair a
reason to differ rather than defer:

> A bizonyíték elégségességét a Szkeptikus már megítélte — ne bíráld felül újra. Csak ott térj el
> tőle, ahol olyat látsz, amit ő nem láthatott: a dossziét.

Then Mezo's own five questions, in the prompt: do we already hold a claim like this (duplication) ·
does it contradict an ACTIVE claim, and which one should move · how far may the number move given
the confidence history · **do we write this into a permanent dossier about a person, even if it is
true** · is this a standalone, lasting theme (chapter).

Per-ruling contract gains:

| field | meaning |
|---|---|
| `dissent` (bool) | the ruling contradicts the Szkeptikus's verdict; the `reason` must then name what the Szkeptikus could not see |
| `note` (enum, nullable) | `DUPLICATE` · `CONTRADICTS` · `NOT_FOR_DOSSIER` · `REHOME` — the integration ground, when there is one |
| `suggestedDimensionKey` (nullable) | only with `note: REHOME` |

The `reason` instruction changes to: **write only what you add; do not restate the Szkeptikus's
argument.**

**The asymmetric dissent rule is enforced in code, not only in the prompt** —
`docs/features/character.md` already records that some konzílium constraints are prompt-only with
no code gate, and this one guards a `sensitive` claim, so it gets a gate:

- Mezo may reject over a `KEEP` or `WEAKEN` freely (tightening is always the safe direction).
- Mezo may accept over a `KILL` **only when the proposal is not `sensitive`**, and the ruling must
  carry `dissent: true`.
- An accept over a `sensitive` `KILL` is **dropped** — the ruling becomes a rejection — and logged
  at WARN, following the `CharacterConferenceService.warnUnaddressedUserFeedback` idiom.

`toRuling` therefore takes the Szkeptikus's verdict for that index as a parameter. It stays a pure
static function, which is where this rule gets its unit test.

## 6. What the user sees

Two surfaces, and the structured one is now primary.

**`ConferenceDeliberationEnvelope.ChairRuling`** gains `dissent` (boxed `Boolean`) and `note`,
both nullable — a conference persisted before this change deserializes with them absent, which
Jackson reads as `null`, and the frontend treats a null `dissent` as false. No migration.
`DeliberationAssembler` passes them through. `ConferenceThreadCard` then renders the chair step by
what it actually contributed:

- `dissent` → the ruling leads with the disagreement, and the reason names what the Szkeptikus
  missed.
- `note` → a label for the ground (`már tartunk ilyet` · `ellentmond` · `nem dossziéba való` ·
  `máshová tartozik`).
- **neither, and no new confidence information** → the honest short form: **"A Szkeptikus érvét
  elfogadom, nem teszek hozzá."** No paraphrase. "No new confidence information" means either a
  rejection that ratifies a `KILL`, or an acceptance whose confidence word equals the word the
  Szkeptikus suggested.

**`ConferenceSkepticVerdict.verdict`** gains `WEAKEN` to its enum, and the card's `Kukázta`/
`Meghagyta` labels gain a third ("Gyengítette"), plus the suggested confidence word when present.

**The prose transcript** (`skepticTurn` / `integratorTurn`) follows the same rule: a per-proposal
line only when the ruling adds something, otherwise the indexes join one aggregate line
(`P1, P4: a Szkeptikus érvét elfogadom, nem teszek hozzá.`). Confidence is rendered through
`CharacterConfidenceWords` — **this removes the raw decimal** (§1 cause 5). When every ruling is a
plain ratification the turn is a header plus that one line, which is short and true.

## 7. Contract changes

`api/feature/character/character.yml`:

- `ConferenceSkepticVerdict.verdict` enum: `[KEEP, WEAKEN, KILL]`
- `ConferenceSkepticVerdict.suggestedConfidence`: `number`, nullable
- `ConferenceChairRuling.dissent`: `boolean`, nullable
- `ConferenceChairRuling.note`: `string`, nullable, enum `[DUPLICATE, CONTRADICTS, NOT_FOR_DOSSIER, REHOME]`
- `ConferenceChairRuling.suggestedDimensionKey`: `string`, nullable

All additive and nullable, so no consumer breaks. Requires `api.gen.ts` regeneration and will be
checked by CI's contract-drift job.

## 8. Failure semantics

Unchanged, and deliberately so. The `parsed` flag stays the only thing that decides whether a
persona gets a transcript turn; `Result.chairParsed` / `shownRulings()` stay the only thing that
decides whether a ruling may be *shown*; `rulings` stays index-complete for the lifecycle, with a
missing ruling defaulting to rejected. A `WEAKEN` that arrives without `suggestedConfidence` is
treated as a `KEEP` for defaulting purposes but shown as `WEAKEN` — the grade is what the model
said; the number is what it omitted.

## 9. Testing

Extend `KonziliumVerdictRoundIT` (`FakeCompanionLlm` sentinels keyed on `SKEPTIC_MARKER` /
`INTEGRATOR_MARKER` — both answer shapes change, so the existing sentinels need updating) and add
a unit test for `toRuling`:

- a `WEAKEN` + `suggestedConfidence` reaches the Integrátor's prompt block
- an `UP` proposal renders the targeted claim's **current text and confidence word** in both
  prompts, and an unresolvable claim id renders the explicit not-found text
- the dossier block appears, and states truncation when over `max-dossier-claims`
- accept over a **sensitive** `KILL` → ruling dropped to rejected, WARN logged, no claim row
- accept over a **non-sensitive** `KILL` with `dissent` → claim created
- a plain-ratification round → the Mezo turn carries **no** per-proposal echo lines, only the
  aggregate line; the envelope's `ChairRuling` has `dissent=false`, `note=null`
- the persisted transcript contains **no raw decimal** (regex assertion — locks the §1 cause 5
  invariant)
- an already-persisted conference (pre-change envelope JSON) still deserializes and renders

Frontend: `ConferenceThreadCard.test.tsx` gains the `WEAKEN` label, the `dissent`/`note`
renderings, and the "nem teszek hozzá" short form.

Focused local run (backend `-Dtest` matches on the simple class name only, per
`docs/features/character.md`):

```
./mvnw test -Dtest='Konzilium*,ClaimLifecycleIT,*Character*,ArchitectureTest' -Dmezo.test.use-testcontainers=true
```

Frontend: tests in both modes + build. The full backend IT suite runs in CI, not locally.

## 10. Out of scope

- **Mezo cannot set a claim's `sensitive` flag.** It is the natural owner of that axis after §5,
  but writing it would open `ClaimLifecycle` — a separate slice.
- **`REHOME` does not move a claim.** It is a rejection ground plus a suggested dimension, shown
  in the thread. A finding we cannot act on is the theater this spec exists to remove, so the
  honest v1 is: reject, say where it belongs, let the owning expert re-propose there.
- **No proposer-vs-Szkeptikus rebuttal round.** `KonziliumCrossTalkRound` already gives the
  transcript a debate layer; a defence turn for KILLed proposals is a follow-up slice, and it
  builds on this one.
- **The Szkeptikus still does not see the dossier or the peer stances.** Deliberate: its job is
  the proposal against its own evidence, and widening its input would re-merge the two roles this
  spec separates. The inversion noted in §1 is recorded as a known property, not fixed here.

## 11. Files touched

| file | change |
|---|---|
| `backend/.../character/service/KonziliumVerdictRound.java` | both contracts + personas, two repositories, `dossierBlock`, claim-resolving `numberedProposals`, enforced dissent rule in `toRuling`, "only where it adds" transcript builders |
| `backend/.../character/service/DeliberationAssembler.java` | pass `dissent` / `note` / `suggestedDimensionKey` through |
| `backend/.../character/entity/ConferenceDeliberationEnvelope.java` | `ChairRuling` + `SkepticVerdict` new nullable fields |
| `backend/.../character/config/CharacterProperties.java` | `max-dossier-claims` |
| `api/feature/character/character.yml` | §7 |
| `frontend/src/features/character/components/ConferenceThreadCard.tsx` | `WEAKEN` label, dissent/note rendering, short ratification form |
| `frontend/src/data/_client/api.gen.ts` | regenerated |
| `docs/features/character.md` | §3 flow, the role split, the new gotchas (dossier block + truncation, the enforced asymmetry, the removed raw decimal) |
