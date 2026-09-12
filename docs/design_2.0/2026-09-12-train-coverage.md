# Edzés (Train) Titanium — page-specific coverage record (2026-09-12)

Seeded from [TITANIUM_FEATURE_COVERAGE_REGISTER.md](TITANIUM_FEATURE_COVERAGE_REGISTER.md) row
`train` (which stood at `UNKNOWN`), expanded from the 2026-09-12 recon: a CODEMAP-first
investigator sweep of `train` + its 16 neighbour blocks, and a prior-art researcher sweep
(Hevy, Boostcamp, RP Hypertrophy, Strava, NN/g).

Follows the workflow in
[2026-09-10-titanium-production-rebuild-handoff.md](2026-09-10-titanium-production-rebuild-handoff.md)
and the Fuel precedent in [2026-09-11-fuel-coverage.md](2026-09-11-fuel-coverage.md).

## Owner decisions so far

**2026-09-12 — the four tabs.** New destination set: **Mai · Terv · Terhelés · Gyakorlatok**
(replacing the old `Mai · Terhelés · Napló · Tervek`). Options put to the owner were
(A) `… · Gyakorlatok` — the library of exercises, records and medals gets the fourth slot; and
(B) `… · Sport` — sport and running get their own world. **The owner chose A.**

Consequences, all owner-approved by that choice:

- Sport and running are **not** a tab. They appear where they matter: logging on **Mai**,
  scheduling on **Terv**, and shown next to gym volume on **Terhelés**. This matches the only
  well-documented mixed-modality pattern (Strava: unify at capture with a sport picker, keep one
  history, specialise the *screen* and not the *IA slot*) and preserves the existing product rule
  that volleyball is never converted into gym sets.
- Weekly muscle volume lives on **Terhelés**, as a forward-looking control rather than a
  retrospective chart — the field is genuinely split here (log-first apps bury it under a profile;
  autoregulating hypertrophy apps put it next to the plan), and our volume ramp actually drives
  next week's set counts, so it belongs with the decision it changes.
- History (week agenda, finished-workout review, mesocycle reports and comparison) merges into
  **Terhelés**, mirroring how Fuel's *Trendek* carries both the week and the per-day detail.
- No 3D companion on Train pages, matching the Fuel decision of 2026-09-11.

## Prototype status

Built in `prototypes/companion-titanium` (`train-pages.js`, `train-pages.css`, three new clay
muscle symbols in `nap.html`), served from this worktree so the parallel Fuel session is not
disturbed.

| Tab | State |
| --- | --- |
| Mai | Rebuilt in the Titanium language: hero pair + gauge, muscle rings, one dominant start CTA, tomorrow's sport strip, the day's exercises with per-set ticks, sport logging, details fold. Live session overlay unchanged. |
| Terv | Old language; next round. |
| Terhelés | Old language (the existing load page, re-pointed to tab index 2); later round. |
| Gyakorlatok | Old language; later round. |

## Capability rows

The full per-capability table (KEEP / MERGE / MOVE / DEFER / DROP with evidence and preservation
tests) is filled in tab by tab as the owner walks through each page. The recon inventory that
feeds it is in this session's investigator report; the eight capability areas are: today's
workout and live logging · sport and running · load and muscle volume · prescription and
progression engine · history, reviews and reports · mesocycles, templates, plans and custom
workouts · exercise catalogue, records and medals · cross-feature surfaces.

Backend capabilities with no UI today, to be decided individually and never silently dropped:
exercise image upload · in-cycle muscle-focus change · the learned timing profile · sport-slot
skips (today only creatable from the Nap advice card) · collected-but-unshown data (sleep quality
and water in the block report, jump count for volleyball).
