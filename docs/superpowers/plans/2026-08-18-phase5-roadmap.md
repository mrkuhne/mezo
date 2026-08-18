# Phase 5 roadmap — slice order & session briefs (mezo-b3pp)

- **Design of record:** [`2026-08-18-phase5-deep-memory-personalization-design.md`](../specs/2026-08-18-phase5-deep-memory-personalization-design.md).
  Every slice row below points into that spec; read §1–§4 + the slice's § before starting.
- **Supersedes** the lost `2026-07-31-phase5-roadmap.md` (never committed).
- One bd slice = one session = one `feat/<topic>` branch = one self-PR (house git workflow).

## Execution order (decided 2026-08-18 — value-first, graph gated)

| # | bd | Slice | Spec § | Depends on (post-adjustment) |
|---|----|-------|--------|------------------------------|
| 1 | `mezo-b3pp.15` | W4.1 Feedback capture on all AI surfaces | §8.1 | — |
| 2 | `mezo-b3pp.1` | W1.1 Journal entity + embed pipeline | §5.1 | — |
| 3 | `mezo-b3pp.2` | W1.2 Evening prose reflection (Napzárás) | §5.2 | .1 |
| 4 | `mezo-b3pp.3` | W1.3 Gratitude entries | §5.3 | .2 |
| 5 | `mezo-b3pp.4` | W1.4 Decision journal + review loop | §5.4 | .1 |
| 6 | `mezo-b3pp.5` | W1.5 Note-embedding catch-up | §5.5 | .1 |
| 7 | `mezo-b3pp.16` | W4.2 Feedback learning — **rollup layer** | §8.2 | .15 |
| 8 | `mezo-b3pp.12` | W3.1 Prompt assembly v2 — always-on recall | §7.1 | .1 (richer with .2–.5) |
| ★ | *(new gate task)* | **Graph gate decision** | §10 | .12 shipped + lived-with |
| 9–14 | `.6 → .7 → {.8, .9, .10} → .11` | W2 graph (only if gate = build) + W4.2 reinforcement layer | §6 | gate |
| 15 | `mezo-b3pp.13` | W3.2 Consolidation ladder | §7.2 | .12 |
| 16 | `mezo-b3pp.14` | W3.3 Recall tuning pass | §7.3 | .13 |
| 17 | `mezo-b3pp.17` | W4.3 Pragmatic profile node + injection | §8.3 | .16 |
| 18 | `mezo-b3pp.18` | W5.1 Composite flag evaluator | §9.1 | — |
| 19 | `mezo-b3pp.19` | W5.2 Event-driven interventions | §9.2 | .18, .15 |
| 20 | `mezo-b3pp.20` | W5.3 Quarterly deep pass | §9.3 | .13, .17 |

Notes:
- W5.1 has no hard dependency and can interleave earlier if an idle slot appears; W5.2 must wait
  for W4.1 (the „Segített?" chip) and benefits from W4.2 weighting.
- The gate's outcome **B (defer)** leaves `.6–.11` open in bd and the order simply skips to 15;
  every graph hook in shipped slices is switch-guarded off.

## Per-session checklist (every slice)

1. `bd update <id> --claim`; branch `feat/<topic>` from origin/main.
2. Read spec §1–§4 + the slice §; re-verify the §3 file anchors that the slice touches.
3. Write the implementation plan (superpowers:writing-plans) → execute (subagent-driven or inline).
4. Gates: focused backend ITs (`./mvnw clean test -Dtest=...`), FE `pnpm build` + both test modes;
   contract regen when the API changed.
5. Docs in the same change (spec §11 lists which); `node scripts/lint-docs.mjs`.
6. Self-PR → CI green → local `--no-ff` merge → push → `bd close` → `bd dolt push`.
