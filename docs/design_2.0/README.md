# Design 2.0 — index and status

The living visual direction is **Titanium** (dark liquid metal, clay 3D objects, gold-stone
materials, ceremony choreography), evolved from the earlier Mozaik 2.0 tile language. Everything
in this folder is dated; this index says what is current, what is background, and what is
visually superseded — so nobody has to reconstruct the state of the direction from file names.

**Start here for any new design work:**

1. [Production rebuild handoff](2026-09-10-titanium-production-rebuild-handoff.md) — workflow,
   owner contract, delivery gates (+ the paste-ready
   [master prompt](CLAUDE_TITANIUM_REBUILD_PROMPT.md) and the
   [feature coverage register](TITANIUM_FEATURE_COVERAGE_REGISTER.md)).
2. [Ceremony (reward screen) pattern](2026-09-15-ceremony-pattern.md) — the reusable
   celebration screen: triggers, anatomy, gold-stone material, motion spec, glucose step,
   copy rules.
3. The prototypes in [prototypes/companion-titanium](prototypes/companion-titanium/) —
   the source of truth for look and motion (`npm ci && npm run dev` from that directory).

## Current — Titanium canon

| Doc | What it holds |
| --- | --- |
| [2026-09-10 production rebuild handoff](2026-09-10-titanium-production-rebuild-handoff.md) | The workflow and owner contract for carrying Titanium into production |
| [2026-09-15 ceremony pattern](2026-09-15-ceremony-pattern.md) | Reward screens: meal log, supplement blocks, workout close |
| [2026-09-12 fuel titanium handoff](2026-09-12-fuel-titanium-handoff.md) | Fuel pages in the Titanium language |
| [2026-09-10 titanium me/nap deep](2026-09-10-titanium-me-nap-deep.md) | Én + Nap deep pages |
| [2026-09-09 titanium food flow](2026-09-09-titanium-food-flow.md) | Food logging flow (see also the ceremony pattern for the post-save screen) |
| [2026-09-09 titanium workout flow](2026-09-09-titanium-workout-flow.md) | Workout flow |
| [2026-09-09 titanium mezo deep](2026-09-09-titanium-mezo-deep.md) | Mezo domain deep pages |
| [2026-09-09 titanium navigation demo](2026-09-09-titanium-navigation-demo.md) | Navigation model |
| [2026-09-09 nap titanium prototype](2026-09-09-nap-titanium-prototype.md) | The Nap page prototype |
| [2026-09-09 companion titanium motion](2026-09-09-companion-titanium-motion.md) | The Three.js companion motion study |

## Reference — feature inventories (content valid, visuals pre-Titanium)

These audits catalogue what each domain must cover. Their capability lists still drive the
coverage register; ignore their screenshots/visual language.

- [2026-09-11 fuel coverage](2026-09-11-fuel-coverage.md)
- [2026-09-10 nap/mai coverage](2026-09-10-nap-mai-coverage.md)
- [2026-08-27 fuel feature audit](2026-08-27-fuel-feature-audit.md)
- [2026-08-27 én feature audit](2026-08-27-en-feature-audit.md)
- [2026-08-27 heti feature audit](2026-08-27-heti-feature-audit.md)
- [2026-08-27 mezo feature audit](2026-08-27-mezo-feature-audit.md)

## Superseded — Mozaik-era visual direction (kept for history)

The Titanium direction replaced these visually. Do NOT start new design work from them; IA and
feature decisions they record may still be cited, but every visual call defers to Titanium.

- [2026-08-26 UI/IA redesign handoff](2026-08-26-ui-ia-redesign-handoff.md)
- [2026-08-27 fuel design iterations](2026-08-27-fuel-design-iterations.md)
- [2026-08-27 mezo/én design iterations](2026-08-27-mezo-en-design-iterations.md)
- [2026-08-28 heti implementation handoff](2026-08-28-heti-implementation-handoff.md)
- [2026-08-29 fidelity audit findings](2026-08-29-fidelity-audit-findings.md)
- [2026-08-31 karakter design iterations](2026-08-31-karakter-design-iterations.md)
- [2026-09-02 growth design iterations](2026-09-02-growth-design-iterations.md)
- [2026-09-02 rutinépítő design iterations](2026-09-02-rutin-epito-design-iterations.md)
- [2026-09-07 mezo szerkesztő design iterations](2026-09-07-mezo-szerkeszto-design-iterations.md)

Related ADRs: [0033 Mozaik 2.0 tile language](../decisions/0033-mozaik-2-tile-language.md)
(historical), [0040 Titanium personal-day prototype state](../decisions/0040-titanium-personal-day-prototype-state.md),
[0041 feature coverage before Titanium production rebuild](../decisions/0041-feature-coverage-before-titanium-production-rebuild.md).
