# Karakter — social feed and contextual replies

Approved 2026-09-20 by the owner; driving issue **mezo-njcgs**. Visual authority is the approved `karakter-social-v3.html` prototype in the task visualization directory, using existing Mezo Clay art and Mozaik materials.

## Experience

Karakter opens directly on Üzenőfal, with Rólad and Csapat as the other primary destinations. Technical history remains reachable through Hogyan működik?. Posts use actual expert authors, timestamps, evidence and stored peer reactions. Never fabricate participation, likes or counts. Warm gold/lavender/sage washes, clay persona orbs, compact comment threads and reduced-motion-aware transitions replace the equal-weight navigation-card dashboard. Existing routes and detailed history remain available.

Miből látszik? opens the shared GlassBox with source text, evidence and a contextual reply action. The user cannot create posts. They can reply to any addressable feed source and to claims. Talál / Nem igaz / Pontosítom remain available on claims. Pontosítom uses the durable reply flow.

## Reply and knowledge semantics

A reply has a server-resolved owned source, immutable source-text snapshot, author, timestamp, client idempotency key, processing state and reasoned outcome. The reply is saved before asynchronous evaluation starts. The UI must distinguish saved, processing, failed, clarification needed and completed. Retry processing must not duplicate the reply, observations, memory or claim effects. Unavailable AI leaves the reply safely saved and retryable.

Evaluation is targeted to the original topic and uses existing expert/claim lifecycle and portrait services. It records a reasoned outcome (updated, withdrawn, unchanged or needs clarification) and exposes that response in the same thread. A follow-up user reply includes the earlier conversation. User statements are identifiable as self-report, never recast silently as objective measurements. Reply evidence must reach the existing shared memory/character prompt consumers as well as future conferences. No reply modifies underlying meal, intake, workout or plan records. Invalid/foreign source and reply identifiers return 404. Text and model output are bounded and treated as data.

## Delivery

Contract first, integration tests for ownership, durable save, retries and actual knowledge effects; frontend tests in both modes, browser verification at mobile width. Merge main, push and verify deployment, as explicitly authorized. Existing postless empty/bootstrap experience and all technical details remain usable.
