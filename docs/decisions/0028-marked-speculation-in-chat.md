# 0028 — Marked speculation is allowed in chat; the advisor punishes the missing marker, not the guess

- **Status:** Accepted
- **Date:** 2026-08-16
- **Driver:** `mezo-q71s`

## Context

The companion chat read as generic and terminal-like rather than conversational. A 2026-08-15
session review (design spec
[`2026-08-16-companion-conversational-tone-design.md`](../superpowers/specs/2026-08-16-companion-conversational-tone-design.md))
traced four symptoms Daniel confirmed as live, one of which was structural rather than stylistic:
the post-response advisor chain (`CompanionAdvisorChain` →
[`companion.md`](../features/companion.md) §3 "The advisor chain") ran a `TurnVerdictCheck` whose
`ungroundedClaim` criterion punished **any** unsupported concrete claim, with no way for the model
to distinguish "I invented a number" from "I have a hunch and said so." A model that cannot voice
a hedge without risking a corrective retry (`AdvisorRetry.block` → `degraded = true`) has no
structural room left for opinion or curiosity — exactly the flatness the chat was suffering from.
The fix could not be prompt-only: the persona prompt already discouraged terse data-dumping before
this change, and the advisor still overruled it every time a guess showed up unmarked as anything
but "confident."

## Decision

**On the chat surface, linguistically marked speculation is allowed; an unmarked claim is not.**

- The `SYSTEM_PROMPT`'s `[Mit szabad állítani]` block
  (`backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java:72-77`) tells
  the model it may voice a hunch or hypothesis if it hedges it linguistically ("tippelek", "erős a
  gyanúm", "lehet, hogy", "ezt csak sejtem") — but a concrete number, date, or past fact may only be
  stated when it traces to the context, a tool call, or Daniel's own message, **hedged or not**.
  Inventing a number is prohibited even with a hedge attached; the hedge licenses uncertainty about
  an interpretation, never a fabricated fact.
- The advisor's enforcement half is the same rename: `TurnVerdictCheck`'s judge criterion
  `ungroundedClaim` became **`unmarkedClaim`**
  (`backend/src/main/java/io/mrkuhne/mezo/feature/companion/advisor/TurnVerdictCheck.java:37-44`),
  and `AdvisorViolation`'s check-name literal `"grounding"` became `"unmarked"`
  (`backend/src/main/java/io/mrkuhne/mezo/feature/companion/advisor/AdvisorViolation.java:3`). The
  judge prompt now asks explicitly whether the claim is stated *confidently, without a marker* —
  a linguistically hedged claim is no longer a violation by itself; an invented concrete number is
  a violation regardless of hedging.
- `AdvisorRetry.block` — the corrective re-prompt a violating answer receives before it ships
  `degraded = true` — gained a closing sentence instructing the model to keep its conversational
  tone through the retry, so the fix targets only the flagged problem instead of flattening the
  whole answer a second time
  (`backend/src/main/java/io/mrkuhne/mezo/feature/companion/advisor/AdvisorRetry.java:19-25`).
- The `[Mit szabad állítani]` prompt block and the `unmarkedClaim` advisor criterion are **one
  pair, not two independent knobs**: the prompt grants the license, the advisor enforces its exact
  boundary. Changing one without the other reopens either the original flatness (advisor stricter
  than the prompt promises) or an unmarked-fabrication hole (advisor looser than the prompt allows).

**Scope — explicit.** This decision applies **only to the chat surface**
(`ChatService`/`ChatStreamService` → `CompanionAdvisorChain` → `TurnVerdictCheck`). Insights
(pattern/hypothesis cards), the daily summary generator, and any future proactive briefing keep
their existing grounding discipline unchanged — those surfaces are read-only narrative generated
without a human in the loop to catch an overconfident guess in real time, which is a materially
different risk than a chat turn Daniel can immediately push back on. Extending marked-speculation
license to a non-chat surface is a separate decision, to be made if and when that surface's own
needs raise the question.

## Consequences

- **The chat's tone can become more opinionated and speculative** — the model is now structurally
  permitted to say "tippelem, hogy az alvás a különbség" instead of only reporting numbers. This is
  the intended effect of the whole `mezo-q71s` change, of which this ADR covers the advisor half.
- **More "tippelek"-style sentences will appear in answers**, including some where the underlying
  guess is wrong. That is an accepted trade — a wrong but honestly hedged guess is a materially
  different failure than a fabricated fact stated as certain, and the persona prompt's example pair
  (`companion.md` §3 "Prompt assembly") exists to calibrate what "marked" looks like.
- **The `degraded` rate is the regression signal to watch** (per the design spec §9 measurement
  plan) — a rise would mean the boundary between "hedged guess" and "invented fact" is being missed
  either in the prompt's instruction or the judge's own interpretation, not that speculation itself
  should be walked back.
- **A future non-chat AI surface that wants the same license needs its own decision**, not an
  assumed extension of this one — the scope note above is deliberate, not an oversight.
- **The `[Mit szabad állítani]` prompt block and the `unmarkedClaim` check must be edited together.**
  Any future change to either side should re-read this ADR first; drifting them apart silently
  reintroduces the original bug (advisor vetoing what the persona now explicitly invites).

## Alternatives considered

- **A separate "flatness" advisor dimension that rewards speculative or opinionated answers.**
  Rejected in the design spec (§2): the advisor is structurally a veto gate — it can only ever
  produce a corrective retry, and a retry itself flattens the answer it's correcting. Encouragement
  belongs in the persona prompt, which has no such structural ceiling; the advisor's job stays
  "don't work against the conversation," not "push it toward a style."
- **Keep `ungroundedClaim` and route hedged claims around it with a separate allow-list of hedge
  phrases inside `TurnVerdictCheck`'s parsing logic.** Rejected: this would duplicate the marking
  rule in two places (the persona prompt's example phrases and a second, code-side phrase list)
  that would inevitably drift; asking the judge model itself to recognize a linguistic hedge is
  both simpler and matches how the persona prompt already describes the rule to the *chat* model.
- **Apply the same license to every AI-generated surface at once** (Insights, daily summary,
  proactive briefing). Rejected for this change: those surfaces were out of scope for the
  session-review findings that motivated `mezo-q71s`, and their read-only, no-immediate-pushback
  nature is different enough from live chat that extending the policy needs its own review, not a
  side effect of a chat-only fix.
