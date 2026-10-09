---
name: owner-visible-frontend
description: Use for a mezo frontend change the owner will see, including UI design, clickable prototypes, approval gates, and live release verification.
---

# Owner-visible frontend work

This skill adds the owner's review rhythm to the repo's process and frontend skills. Use the root house rules for communication, Beads, git and production-data boundaries. For code changes, also use the frontend skill and its house references.

## Three approval gates

1. **Design:** brainstorm in Hungarian, one question at a time. Read the relevant feature doc and CODEMAP before proposing approaches. For a new screen or flow, examine relevant prior art and record **Prior art** and **Codebase terrain** in the spec under `docs/superpowers/specs/`. Present the design and wait for the owner's explicit approval for ordinary-sized work.
2. **Clickable prototype:** edit the affected domain's living prototype. Since 2026-10-09 (Folyadék programme, `mezo-n4wf5`) that is `docs/design_2.0/prototypes/vilagos/<domain>.js` inside `docs/design_2.0/prototypes/klinikai-iranyok.html`; the `elo/*.html` files are frozen Üveg snapshots used as parity sources. Follow the Folyadék canon in `docs/design_2.0/README.md` (style bible `docs/design_2.0/2026-10-09-folyadek-style-bible.md`). Show the owner what to click and wait for explicit approval. Iterate visually here.
3. **Implementation plan:** write a checkable plan under `docs/superpowers/plans/`, grounded in the approved spec and prototype. Include the *Kész, ha…* criteria below. Wait for explicit approval.

**Small-change exception:** draft one short spec/plan without a separate early design approval, build and obtain approval of the prototype, then finalize the combined document from that approved prototype and obtain one approval for it before app code. Thus there are two approvals: prototype, then combined spec/plan. An invisible bug fix may skip the prototype.

After the last approval, implement against the approved prototype, run the gates, merge and push per the root house rules, verify deployment and the live result, then report. Do not ask for a second visual review after implementation. If a blocker would change what the owner sees, explain the choice in Hungarian and wait for a decision.

## Prototype and review link

- Preserve one living prototype per domain. Update its existing routes and sheets; for a cross-domain change, update each affected file. Use realistic Hungarian example content, never production rows. New icons go on an **Új ikonok** sheet for approval, then into the shared sprite.
- Serve the HTML over local HTTP and inspect every changed route and sheet in a browser, the console, 320 px width, and the reduced-motion state. `file://` is not an adequate script check.
- Every living prototype uses the shared side panel (`_panel-kit.html`, see the recipe §The side panel): put a new route in its tab group, and **rewrite the single "Legutóbb változott" block** (`data-uj` date, title, one sentence, links) for this change. It is the only "new" marker; never add "új" labels elsewhere in the panel.
- The registry at `docs/design_2.0/prototypes/elo/README.md` records each domain's fixed Claude Artifact URL. Reuse and republish that URL only if a working publishing tool is available. In a Codex session without that tool, open the HTTP preview in the app and give the owner the repository file path plus a local link **only if the owner can access it**. A localhost link alone is not publication. **Say explicitly that the Artifact URL was not updated.** Arrange a usable review route before seeking prototype approval, and resolve whether a different stable publishing route is needed before plan approval; never mark republication complete without evidence.
- **Publish debt (owner, 2026-10-07):** after changing a living prototype run `node docs/design_2.0/prototypes/elo/_link-status.mjs --stamp <domain>` and commit. If you publish to the fixed URL, record it with `--published <domain>`. If you cannot publish, file `bd create "Közzététel elmaradt: <Domain>" -t task -p 1 -l publish-debt` and say so in the hand-off. A session that can publish runs `_link-status.mjs` and `bd list --label publish-debt --status open` at session start and clears the debts before its own work. Full rule: `docs/design_2.0/prototypes/elo/README.md`.
- Once the change ships, keep the living HTML in sync with production and update the registry's sync note. If a publishing route was agreed, publish the final version there too.

## *Kész, ha…* acceptance

Before implementation, record checkable acceptance criteria in the driving Beads issue and plan. Derive them from the approved spec and prototype. Cover:

- Each touched route, screen and sheet; approved icons; empty, loading and error states; 320 px and reduced motion.
- Reverse parity: every existing control, state and data field on the touched screens remains unless the spec intentionally changes it.
- Relevant frontend layout tests, `pnpm build`, and tests in **both explicit modes** with `CI=true`: `VITE_USE_MOCK=true` and `VITE_USE_MOCK=false`. Run focused backend tests if backend code changed. Regenerate/check the CODEMAP and run `node scripts/lint-docs.mjs` with no errors or stale docs for this change.
- Update the affected living feature doc and verify its row in `docs/features/README.md`. When an epic or user-visible feature ships, update the milestone log and in-flight epic status in `docs/milestones/roadmap.md`.
- Merge and push, then confirm the deploy workflow succeeded for that commit and inspect the new version at the production URL in a browser. When the feature involves data, verify the expected production rows with read-only queries. Confirm the living prototype matches the result and any agreed review link was updated.

Check each item with evidence from commands, browser inspection or queries. Do not report completion with an unmet item; name the remaining item plainly in the final Hungarian report.
