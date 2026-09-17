# Design 2.0 — index and status

> ## ⚠️ 2026-09-17 — direction reversal
>
> The **Titanium** skin (dark liquid metal, shipped ~2026-09-09 → 2026-09-17) was **rejected by
> the owner**. The living visual direction is again the **pre-Titanium design 2.0 world —
> Mozaik 2.0 / Clay**: washed tiles with domain-color washes, poster card anatomy, clay 3D SVG
> icons, polished-stone/gold celebratory surfaces, one-shot entrance choreography.
>
> **Why:** the Titanium look was tried in production for a week and the owner does not want it.
> **What is kept:** every piece of *functionality* built during the Titanium period (the rebuilt
> Fuel surface, GlassBox, BodyMap, the scrolling in-workout UI, the sticky 5-domain navigation,
> the Boop rename…). Only the *skin* rolls back, and it rolls back by forward-fix — nothing is
> `git revert`-ed.
> **How:** epic `mezo-ju4j6`, one area per bead, driven by the `/visszaoltoztetes` session skill.
> Spec: [`docs/superpowers/specs/2026-09-17-boop-visszaoltoztetes-design.md`](../superpowers/specs/2026-09-17-boop-visszaoltoztetes-design.md) ·
> plan: [`docs/superpowers/plans/2026-09-17-boop-visszaoltoztetes.md`](../superpowers/plans/2026-09-17-boop-visszaoltoztetes.md).
>
> **The Titanium docs below are NOT deleted** — they are the parity sources that prove no feature
> is lost. Read them for *what a screen must do*, never for *what it should look like*.

Everything in this folder is dated; this index says what is current, what is background, and what
is visually superseded — so nobody has to reconstruct the state of the direction from file names.

**Start here for any new design work:**

1. [2026-09-17 restored-world style bible](2026-09-17-restored-world-style-bible.md) — the single
   styling reference for all re-dress and new UI work: palette & materials per domain, card
   anatomy, ring/gauge/sparkline treatments, icon material recipe, and the old-world treatment of
   the components that never existed pre-Titanium (GlassBox, BodyMap, in-workout list, TabBar).
2. [Ceremony (reward screen) pattern](2026-09-15-ceremony-pattern.md) — the reusable celebration
   screen: triggers, anatomy, motion spec, glucose step, copy rules. **The pattern stays canon;
   its Titanium skin does not** — celebratory surfaces wear polished-stone/gold material.
3. The Mozaik-era prototypes in [prototypes/](prototypes/) (`*-tab.html`, `*-mely.html` and the
   flow pages) — the source of truth for look and motion. **Not** `prototypes/companion-titanium/`.

## Current — restored Mozaik 2.0 / Clay canon

| Doc | What it holds |
| --- | --- |
| [2026-09-17 restored-world style bible](2026-09-17-restored-world-style-bible.md) | **The** styling reference for the restored world: ground tokens, palette & materials, card anatomy, data graphics, ceremony material, clay icon recipe, the four new-components treatments, and the mined old-world recipes |
| [2026-09-15 ceremony pattern](2026-09-15-ceremony-pattern.md) | Reward screens: meal log, supplement blocks, workout close (pattern only — old-world material) |
| [assets/restored-world/](assets/restored-world/) | Verbatim pre-Titanium `clay-icons.svg` + `clay-spots.svg`, extracted at `8c18f331d` — the icon material reference |
| [2026-08-26 UI/IA redesign handoff](2026-08-26-ui-ia-redesign-handoff.md) | The Mozaik 2.0 tile language and the IA it paints on |
| [2026-08-27 fuel design iterations](2026-08-27-fuel-design-iterations.md) | Fuel screens in the Mozaik language |
| [2026-08-27 mezo/én design iterations](2026-08-27-mezo-en-design-iterations.md) | Mezo + Én screens in the Mozaik language |
| [2026-08-28 heti implementation handoff](2026-08-28-heti-implementation-handoff.md) | Heti/weekly surfaces |
| [2026-08-29 fidelity audit findings](2026-08-29-fidelity-audit-findings.md) | How prototype fidelity is judged in this world |
| [2026-08-31 karakter design iterations](2026-08-31-karakter-design-iterations.md) | Karakter screens |
| [2026-09-02 growth design iterations](2026-09-02-growth-design-iterations.md) | Growth screens |
| [2026-09-02 rutinépítő design iterations](2026-09-02-rutin-epito-design-iterations.md) | Rutinépítő flow |
| [2026-09-07 mezo szerkesztő design iterations](2026-09-07-mezo-szerkeszto-design-iterations.md) | Mezo szerkesztő flow |

## Reference — feature inventories (content valid, use as parity checklists)

These audits catalogue what each domain must cover. Their capability lists drive the reverse
parity checklist of every re-dress bead; ignore their screenshots/visual language.

- [2026-09-11 fuel coverage](2026-09-11-fuel-coverage.md)
- [2026-09-10 nap/mai coverage](2026-09-10-nap-mai-coverage.md)
- [2026-08-27 fuel feature audit](2026-08-27-fuel-feature-audit.md)
- [2026-08-27 én feature audit](2026-08-27-en-feature-audit.md)
- [2026-08-27 heti feature audit](2026-08-27-heti-feature-audit.md)
- [2026-08-27 mezo feature audit](2026-08-27-mezo-feature-audit.md)

## Superseded — Titanium visual direction (kept as history + parity sources)

**Rejected 2026-09-17.** Do NOT start any design work from these and do NOT copy their visuals.
The *feature* decisions and coverage registers they record are still cited — they are how the
rollback proves nothing functional was lost.

| Doc | Still useful for |
| --- | --- |
| [2026-09-10 production rebuild handoff](2026-09-10-titanium-production-rebuild-handoff.md) (+ [master prompt](CLAUDE_TITANIUM_REBUILD_PROMPT.md), [feature coverage register](TITANIUM_FEATURE_COVERAGE_REGISTER.md)) | The old→Titanium coverage register, inverted per area as the reverse parity checklist |
| [2026-09-12 fuel titanium handoff](2026-09-12-fuel-titanium-handoff.md) | What the Fuel pages must still do |
| [2026-09-10 titanium me/nap deep](2026-09-10-titanium-me-nap-deep.md) | Én + Nap deep-page capability list |
| [2026-09-09 titanium food flow](2026-09-09-titanium-food-flow.md) | Food logging flow steps |
| [2026-09-09 titanium workout flow](2026-09-09-titanium-workout-flow.md) | Workout flow steps |
| [2026-09-09 titanium mezo deep](2026-09-09-titanium-mezo-deep.md) | Mezo deep-page capability list |
| [2026-09-09 titanium navigation demo](2026-09-09-titanium-navigation-demo.md) | The navigation model (kept functionally) |
| [2026-09-09 nap titanium prototype](2026-09-09-nap-titanium-prototype.md) | Nap page capability list |
| [2026-09-09 companion titanium motion](2026-09-09-companion-titanium-motion.md) | The Three.js companion motion study (historical) |
| [prototypes/companion-titanium/](prototypes/companion-titanium/) | Historical prototype — do not copy from it |

Related ADRs: [0033 Mozaik 2.0 tile language](../decisions/0033-mozaik-2-tile-language.md)
(**the tile language is live again as of 2026-09-17**),
[0040 Titanium personal-day prototype state](../decisions/0040-titanium-personal-day-prototype-state.md)
(historical), [0041 feature coverage before Titanium production rebuild](../decisions/0041-feature-coverage-before-titanium-production-rebuild.md)
(the coverage baseline the rollback is measured against).
