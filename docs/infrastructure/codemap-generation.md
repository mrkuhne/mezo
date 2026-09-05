# Codebase map generation (`docs/CODEMAP.md`)

How the agent orientation index is produced, what it is allowed to contain, and how CI keeps
it honest.

> **TL;DR** — `docs/CODEMAP.md` is **generated**, never hand-edited. Regenerate with
> `node scripts/gen-codemap.mjs`; CI fails the `lint` job if regenerating would change the
> file. It answers **WHERE** things live; **HOW** they work stays in `docs/features/*.md`.

## Why it exists

Agents were spending most of a session's budget *finding* things. The trigger for this tooling
was a Hermes run that burned ~45 exploration turns (~50 min) just orienting itself before it
could start planning (`mezo-zjtm.3`). The map collapses that into a single read: one block per
feature naming its backend package, tables, endpoints, hooks, UI surfaces and tests, plus the
feature doc to read next.

The house rule that follows from it is in [`AGENTS.md`](../../AGENTS.md) and in both domain
skills (`.agents/skills/mezo-{backend,frontend}/SKILL.md`): **locate via `docs/CODEMAP.md`,
then read the matching `docs/features/<x>.md` §10 — do not grep the tree to orient.**

## What it may contain

| | |
|---|---|
| **In scope (WHERE)** | Directory and package paths, class names, `@Table` names, contract fragment paths, method + path endpoint lines, hook names, file lists, IT/populator names, doc links |
| **Out of scope (HOW)** | Behaviour, data flow, rationale, recipes, contracts-in-prose — all of that belongs in `docs/features/<x>.md` §1–§9, which every block links to |

Consequence: the map never needs a human edit, because everything in it is mechanically
derivable. If you find yourself wanting to explain something in `CODEMAP.md`, the sentence
belongs in the feature doc instead.

## How the generator works

`scripts/gen-codemap.mjs` (~330 lines, zero dependencies — `node:fs`/`node:path`/`node:child_process`
only). No LLM is involved; extraction is convention + regex, so the output is deterministic.

**Feature keys** are the union of the directory names under
`backend/src/main/java/io/mrkuhne/mezo/feature/`, `frontend/src/data/` and
`frontend/src/features/`. The backend/contract naming space is domain-shaped (`meal`, `pantry`,
`biometrics`) and the frontend space is tab-shaped (`fuel`, `me`, `today`); the map does not
force them together — a block simply states which spaces it exists in.

**Two bindings do the cross-space work, so there is no alias table to maintain:**

1. **Contract fragment → feature.** Every operation in `api/feature/<x>/<x>.yml` carries
   `tags: [Foo]`, and exactly one backend controller `implements FooApi`. That controller's
   package *is* the owning feature. This is what folds `biometrics-profile`, `checkin`,
   `sleep`, `sleep-goal`, `sleep-shot` and `weight` into the `biometrics` block.
2. **Feature doc → feature.** A doc binds when one of its `key_files:` frontmatter paths sits
   inside one of the feature's own paths. So `goal-engine.md` binds to `goal` and `train`
   without either name matching.

Anything that binds to nothing (an orphan fragment, a doc whose `key_files` straddle
everything, a feature with no doc at all) is reported in the **Unaligned** section rather than
silently dropped — that section is a worklist, not noise.

Other conventions it relies on: `feature/<x>/{entity,service,controller,repository,mapper,config,event}/`
sub-packages (anything else at that level is reported as a sub-feature); `@Table(name = "…")`
on mapped entities (an `entity/` class without one is an embedded json/value type and is listed
under *other*); the `data/hooks.ts` re-export barrel as the source of hook names;
`features/<x>/{pages,sheets,components,logic}/`; `*IT.java` for integration tests;
`*Populator` types referenced from a feature's tests.

## Determinism and the freshness gate

The file has two halves split by a `<!-- CODEMAP:BODY -->` marker:

- the **header** is a fixed literal (deterministic since mezo-hnkd — it used to stamp the date
  and short commit, which made every regeneration differ and merge-conflict);
- the **body** is a pure function of the tree (every list sorted).

`--check` validates the **whole file** against `renderHeader() + body`, and a plain run rewrites
whenever the whole file differs. It reports what is wrong, in this order: merge-conflict markers →
missing `CODEMAP:BODY` marker → stale body → hand-edited header.

> **It used to compare the body only** — and that made both gates blind to a corrupted header.
> Unresolved `<<<<<<< HEAD / ======= / >>>>>>> origin/main` markers reached `main` **twice**
> inside the header (PR #287, and commit `6ecb76fa2` on the mezo-b3pp.29 branch): with the body
> current, `gen-codemap.mjs` printed *"already current — left untouched"* and did not rewrite the
> file, `--check` passed, and so did CI's `lint` job. The local gate and the CI gate were green
> while unresolved conflict markers sat on `main` (mezo-ag1b, mezo-miw6).

Because that failure mode is not specific to CODEMAP — most files here have no generator gate at
all — `scripts/lint-conflict-markers.mjs` scans **every tracked text file** for git's markers and
is a separate `lint` step. (It lives in CI rather than in a pre-commit hook on purpose: the local
hooks are beads-managed, untracked, and bypassable with `--no-verify`; CI is the authoritative
gate per ADR 0007.)

```bash
node scripts/gen-codemap.mjs           # regenerate; writes only if the whole file changed
node scripts/gen-codemap.mjs --check   # exit 1 on stale body, edited header, or conflict markers
node scripts/lint-conflict-markers.mjs # exit 1 on conflict markers in ANY tracked text file
node --test scripts/gen-codemap.test.mjs   # fixture-tree tests for the generator itself
```

All four run in the `lint` job of
[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml), alongside `lint-docs.mjs` and
`lint-liquibase.mjs`.

## When you have to touch it

- **Added/moved/renamed code** → run `node scripts/gen-codemap.mjs` and commit the result in
  the same change. (CI will tell you if you forgot.)
- **Added a new convention** (a new sub-package kind, a new source tree, a new binding) → teach
  the generator, add a case to `scripts/gen-codemap.test.mjs` first, then regenerate.
- **The map got something wrong** → that is a generator bug or a convention violation in the
  code. Fix one of those. Never fix the symptom in `CODEMAP.md`.

## Related

- [`docs/features/README.md`](../features/README.md) — the four doc families and which to read when
- [`docs/README.md`](../README.md) — the full `docs/` taxonomy
- [`docs/infrastructure/local-dev-testing.md`](local-dev-testing.md) — the local vs CI gate split
