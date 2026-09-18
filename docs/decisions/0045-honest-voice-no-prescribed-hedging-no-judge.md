# 0045 — The honest voice: no prescribed hedge vocabulary, no LLM judge on the live path

- **Status:** Accepted
- **Date:** 2026-09-18
- **Driver:** `mezo-rj214.7` (S9.8), `mezo-rj214.5`, `mezo-q0p5a`
- **Supersedes:** [ADR 0028](0028-marked-speculation-in-chat.md) (the `[Mit szabad állítani]`
  hedge-vocabulary prescription and the `TurnVerdictCheck` `unmarkedClaim` judge criterion that
  enforced it — both retired from the live path; ADR 0028's underlying insight, that a marked
  hunch should not be punished like an invented fact, is carried forward unchanged, just enforced
  differently: by not teaching hedging as a default rather than by a judge that lets a hedged
  guess through).

## Context

ADR 0028 fixed a real problem — an advisor that punished *any* unsupported claim gave the model no
room to say "I have a hunch" without risking a corrective retry — by doing two things together:
teaching the model example hedge phrases ("tippelek", "gyanítom", "lehet, hogy", "ezt csak sejtem")
in `[Mit szabad állítani]`, and renaming the judge's `ungroundedClaim` criterion to `unmarkedClaim`
so a linguistically hedged claim stopped being a violation by itself.

Two things went wrong with that fix, both surfaced in the month since (ADR 0028 is dated 2026-08-16):

1. **Teaching hedge vocabulary taught hedging as the safe default**, not just as a tool for
   genuine uncertainty. A model given example hedge phrases and told they are always safe reaches
   for them even when it does not need to — the flatness ADR 0028 was trying to cure ("legyél
   barátságos" being inert, terse data-dumping) had a second failure mode nobody measured at the
   time: over-hedging an answer the model was already right about. The fix ADR 0028 shipped had no
   way to tell "I said the hedge because I meant it" from "I said the hedge because the prompt
   handed me the phrase and it always passes."
2. **The judge that was supposed to enforce the boundary never enforced it reliably.** Measured
   against a 12-case labelled set (documented in `TurnVerdictCheck`'s own javadoc and in
   `docs/features/companion.md` §3), `unmarkedClaim`'s precision topped out at **0.60** even at the
   highest reasoning effort tried — roughly four false positives in ten. Each false positive cost a
   whole extra streamed turn (the corrective re-prompt) and rewrote an already-honest,
   already-grounded answer into a hedged one — the EXACT harm ADR 0028 existed to prevent, just
   moved from "the advisor vetoes every hedge" to "the advisor vetoes 40% of hedges at random."

Meanwhile a real, separate failure shipped through the gap ADR 0028's advisor never covered: in
production the companion answered "Felírtam: taco, fehérjeszelet, banán." — the companion has NO
write tools at all (ArchUnit-enforced; every registered tool is a read) — and the user believed
the food had been logged. It had not: silent data loss (`mezo-q0p5a`). The prompt already forbade
claiming an unperformed action when that shipped, so the failure was structural, not a wording
gap — the fix needed to be a deterministic code-side check, the same kind of instrument
`ClinicalOutputCheck` already was for the Rx-dose rule, not another judge call.

`mezo-rj214.7`'s S9.8 slice also collapsed `CompanionAdvisorChain.review`/`reviewChat` into one
method. That collapse mattered here specifically: before it, production's default
conversation-first path ran `reviewChat` — clinical-only — and never reached the LLM judge at all,
so `unmarkedClaim`'s 0.60 precision was never even the operative number on the path most users
actually hit. Fixing the false-positive rate could not fix that path; the judge simply wasn't
there to fix.

## Decision

**Two changes, made together, replacing what ADR 0028 shipped:**

1. **Neither prompt prescribes hedge vocabulary any more.** `ChatService.SYSTEM_PROMPT`'s
   `[Mit szabad állítani]` block dropped the example hedge phrases; a hunch may still be voiced as
   an opinion when it is genuinely uncertain, but the prompt no longer hands the model a vocabulary
   list that makes hedging the safe default for an already-supported answer. The block's few-shot
   (`[Példa a hangnemre]`) was rewritten to close on an owned opinion instead of a hedge-and-retract
   — the old example modeled exactly the habit being removed. `ConversationTurnService.VOICE`
   (production's own prompt) never prescribed hedge vocabulary and keeps its existing instruction
   not to weaken an already-supported answer with an obligatory guess; it gained the action-claim
   rule in prose (below) to match.
2. **The judge is off every live path.** `CompanionAdvisorChain.runChecks` no longer calls
   `TurnVerdictCheck` at all — the chain is now two deterministic checks, `ClinicalOutputCheck`
   (Rx dose-change) then the new `ActionClaimCheck` (fabricated first-person past-tense action
   claim — the `mezo-q0p5a` backstop: a fixed, accent-folded, whole-word term list with negator
   exclusion, so an honest refusal never fires). `TurnVerdictCheck` stays a `@Component` and an
   offline regression instrument: its own IT (`TurnVerdictCheckIT`) still exercises it, but only
   against `FakeCompanionLlm`'s scripted verdicts (`[fake-violate]`, `[fake-verdict-broken]`) —
   that proves the check is still correctly wired (parses a verdict, fails open on a broken one),
   not that its precision holds. There is no labelled verdict set checked into the repo (only
   memory-eval fixtures live under `backend/src/test/resources/eval/`); the 12-case set and the
   0.60 ceiling below survive only as prose, in this check's own javadoc and in
   `application.yml`. Nothing in production wires the check up either way.
3. **Both prompts state the action-claim rule in prose, matching the code-side backstop.**
   `ActionClaimCheck` exists BECAUSE prose alone failed in production; the prose stays, because a
   deterministic term list also cannot catch every phrasing (a quoted-back claim, a question form)
   and the two are meant to cover different corners together, not to replace each other.
4. **`AdvisorRetry.block` no longer licenses marked guessing.** Its closing rules paragraph names
   the action-claim rule and the Rx-dose rule, both of which a check below actually fires on, plus
   an unmarked-fact reminder that — since neither check enforces it any more — is prose only, not
   a rule any live check backs; it dropped the redundancy-guarding clause the removed
   `redundantQuestion` criterion used to justify. The tone-preservation closing sentence (ADR
   0028's contribution) stays verbatim.
5. **The `[Két mód]`/`[Eszközhasználat]` contradiction is removed by scope, not by rewording.**
   `[Eszközhasználat]` used to carry a blanket "tool nélkül ne találgass" that contradicted
   `[Két mód]`'s own free-conversation branch (general-knowledge chat needs neither tool nor data,
   by design). The rule now lives only inside `[Két mód]`'s data-request branch, where it actually
   applies; `[Eszközhasználat]` keeps only the tool-timing sentence. `[Két mód]` itself is
   unchanged in shape — its free-conversation branch is the explicit permission this whole
   decision's honesty rests on: the model is allowed to talk freely, and it is exactly there that
   an unprescribed, ungoverned hedge or an invented action claim would otherwise have the most
   room to appear unchecked.

**What ADR 0028 got right and this decision keeps.** A marked hunch is still not punished as
harshly as an invented fact — that principle is not reversed. What changes is HOW that boundary is
kept honest: not by teaching a vocabulary that becomes a habit, and not by a judge measured at 40%
wrong, but by simply not making hedging the default and by replacing the one failure mode the
judge was actually catching in production with a deterministic check that never has a
false-positive tax.

**Scope — unchanged from ADR 0028.** This still applies only to the chat surface
(`ChatService`/`ChatStreamService`/`ConversationTurnService` → `CompanionAdvisorChain`). Insights,
the daily summary generator, and any future proactive briefing were out of scope for ADR 0028 and
remain out of scope here.

## Consequences

- **Nothing on the live path mechanically audits an invented concrete NUMBER any more.** The
  judge's `unmarkedClaim` half was the only check that ever tried, and it did so unreliably. That
  rule now rests entirely on the voice prompt plus the answering model having the tool's raw data
  in front of it when it writes a number down. This is the one place `docs/features/companion.md`
  cannot claim mechanical enforcement, stated there deliberately rather than left implicit.
- **`degraded` should fall, not just change shape.** Retries now only fire on a genuine dose-change
  or action-claim hit, not on a 40%-wrong judge call — the `degraded` rate should be a strictly more
  meaningful signal than it was under ADR 0028, and any rise now means one of the two deterministic
  rules is actually firing, not that the judge misjudged again.
- **`redundantQuestion` (never-ask-twice) left with `unmarkedClaim`, not separately.** No
  replacement check covers it; it is now the same kind of honest gap as the invented-number one
  above. And for production's default conversation-first path specifically, this whole decision
  changes nothing observable: that path ran the tool-free `reviewChat` branch before S9.8 too, so
  it never reached the judge either way — the removal only changes behaviour on paths that used
  to run the tool-carrying `review`.
- **A rediscovered need for numeric grounding enforcement is a new decision, not a reopening of
  this one.** If production later shows the honest gap above causing real harm, the fix is a new,
  purpose-built deterministic check (in the spirit of `ActionClaimCheck`) or a differently-scoped
  judge with measured precision above some stated bar — not reinstating `TurnVerdictCheck` as-is,
  whose 0.60 ceiling is now a matter of record.
- **`TurnVerdictCheck`, its IT, and the tool-output-digest payload assembly it carries are not
  deleted.** They remain buildable, testable code — an offline instrument for a future eval pass,
  not dead weight to clean up reflexively. Note what this does and does not preserve: no artifact
  in the repo currently *proves* the 0.60 ceiling — there is no labelled verdict set checked in,
  only the number in prose (this check's javadoc, `application.yml`). Keeping the class preserves
  the WIRING a future re-measurement would need (the judge call, the strict-JSON parse, the
  fail-open path, the payload assembly) — deleting it would mean rebuilding that scaffolding from
  scratch, not losing proof of a number that was never checked in as data.

## Alternatives considered

- **Re-tune the judge instead of removing it** (different reasoning-effort level, a bigger labelled
  set, a stricter prompt). Rejected: `chat: high` was already the level `unmarkedClaim` was
  measured at, and it never cleared 0.60 — the failure looked structural (a judge grading "is this
  a fabricated claim" from prose alone, with no ground truth beyond the context and tool digest it
  was handed) rather than a tuning gap the next increment of effort would close.
- **Keep the judge for CHAT-only turns, since that was its lowest-stakes surface.** Rejected: the
  `review`/`reviewChat` collapse this same slice shipped exists because keeping two chains alive
  for one skippable check was the thing actively hiding the coverage gap that let `mezo-q0p5a`
  ship unfixed on production's default path.
- **Keep the hedge vocabulary but drop only the judge.** Rejected: without a judge enforcing the
  exact boundary, an unpruned example-phrase list is pure risk with no matching enforcement — ADR
  0028's own "one pair, not two independent knobs" consequence applies in reverse here: removing
  the judge without also pruning the vocabulary reopens the over-hedging failure mode with nothing
  left watching it.
