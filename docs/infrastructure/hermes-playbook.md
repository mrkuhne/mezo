# Hermes playbook — prompts for starting and chaining local-agent sessions

Operator's manual for Daniel. Setup facts live in
[`local-llm-hermes-lmstudio.md`](local-llm-hermes-lmstudio.md); the workflow's why in
[ADR 0029](../decisions/0029-local-llm-hermes-agent-stack.md). Driver: `mezo-zjtm`.

## 0. The five rules (everything below assumes them)

1. **State lives in files, not in the chat.** bd issue → spec (`docs/superpowers/specs/`) →
   plan (`docs/superpowers/plans/`) → commits → PR. Any new session can pick up from these;
   a chat transcript is never the hand-off.
2. **One session = one skill = one purpose.** Start every work session with
   `Using the <skill> skill: …`. Free text without a skill is for chat only — it skips the
   worktree, bd and PR steps (seen in practice).
3. **≤ 2 plan tasks per session.** Frontend tasks balloon context (test output); a local model
   past ~100K tokens slows to a crawl and derails. Hand off, start fresh.
4. **One session per worktree.** Two sessions may run at once only on different branches.
5. **Hermes never merges.** Every work unit ends in a pushed branch + `gh pr create`; Daniel
   reviews and merges (GitHub button or local `--no-ff`).

## 1. Pre-flight (30 seconds)

| Check | Command / place | Expect |
|---|---|---|
| Models loaded | `lms ps` | `qwen/qwen3.6-35b-a3b` + `google/gemma-4-26b-a4b` (aux/memory); `qwen3.8-27b` loads on demand |
| Desktop picker | composer → model | **Qwen3.6 35B A3B** · effort **Medium** (Low for chat) |
| Skills alive | `hermes skills list` (from the repo) | 11 project skills; none missing |
| Main checkout clean | `git -C ~/Applications/Personal/Mezo/mezo status -sb` | `## main…origin/main`, no changes |
| Postgres (backend work) | `cd backend && docker compose up -d` | `backend-postgres-1 Up` |

If a skill is missing → it was quarantined (see troubleshooting) → restart the desktop app.

## 2. Session types and their prompts

Placeholders in `<…>`. Copy the whole block.

### A. Chat / rubber duck / "what is this?" — no skill, effort Low

```
<question in Hungarian or English>. Answer briefly; if you need to look at code, locate it via docs/CODEMAP.md first.
```

### B. Small fix from scratch (no bd issue yet) — `fixing-bugs`, Medium

```
Using the fixing-bugs skill: <what is wrong, where you see it, what it should do>.
```
The skill creates the worktree + bd issue, reproduces with a failing test, fixes minimally,
runs both FE modes / the ITs, pushes and opens the PR. Expect 10–30 min. You review the PR.

### C. New feature from zero — the four-session chain

**C1 · Brainstorm → spec** (`brainstorming`, **Qwen3.8 27B**, Medium — short context, quality over speed)
```
Using the brainstorming skill: I want <one-paragraph idea>. Ask me one question at a time, then propose approaches. When I approve, write the spec to docs/superpowers/specs/<date>-<topic>-design.md and create the bd epic/issue for it (bd create … -t feature). Do not write code.
```
*Your gate:* read the spec file; fix wording yourself or ask for changes; confirm the bd id.

**C2 · Plan** (`writing-plans`, Medium) — fresh session
```
Using the writing-plans skill: write the implementation plan for bd issue <id> from docs/superpowers/specs/<spec-file>.md. Save it as docs/superpowers/plans/<date>-<topic>.md in chunks, commit it on a feat/<topic> branch in a new worktree, push, and open a PR. Do not start implementing.
```
*Your gate:* the plan PR. Check: every spec requirement has a task; no "Actually/Wait" leftovers;
no invented file paths (spot-check 3 against `docs/CODEMAP.md`); SQL is PostgreSQL; the
ritual/sibling-slice dependencies are explicit. Ask for a revision in the PR, or fix it
yourself (Claude is good at this pass). Merge the plan PR.

**C3…Cn · Execute in stages** (`executing-plans`, Medium) — fresh session per stage, ≤ 2 tasks
```
Using the executing-plans skill: execute Task <n> and Task <n+1> of docs/superpowers/plans/<plan-file>.md (bd issue <id>). <STATE LINE — see §3>. Register the plan's gates with /goal gate add first. Then STOP and report the actual test output. Do not start Task <n+2>. Do not install software; if something is missing, stop and report.
```
*Your gate between stages:* `git diff main...feat/<topic>` (or the desktop's Review panel) — look
for the house idioms (soft delete via `@SQLDelete`, `@/data/hooks` imports, contract-first);
run the focused tests yourself if in doubt. The last stage ends with the PR.

**C-final · Review the PR** — you (or Claude). If the Hermes session reported deviations
from the plan, read those first.

### D. Continue an unfinished stage — `executing-plans`, fresh session
```
Using the executing-plans skill: continue bd issue <id> from docs/superpowers/plans/<plan-file>.md. <STATE LINE>. Tasks <done list> are committed; Task <k> is partially done in the working tree — verify it against the plan, finish it, commit, then <next task or STOP>. Report the actual test output.
```

### E. Review a diff or a PR — Qwen3.8-27B, Medium, short context
```
Review the diff of <branch or PR URL> against docs/superpowers/plans/<plan-file>.md and the house rules. List: deviations from the plan, violations of docs/references/* conventions, missing tests, and anything you would not merge. Do not change files.
```

### F. Docs-only touch — `verification-before-completion` + domain skill
```
Using the mezo-<backend|frontend> skill and the verification-before-completion skill, in a new worktree: update docs/features/<x>.md §<n> to describe <change>, run node scripts/lint-docs.mjs, commit, push, open a PR.
```

## 3. The STATE LINE (how sessions chain)

Every continuation prompt carries one line that tells the fresh session where the world is.
Template:

```
State: worktree /Users/mrkuhne/Applications/Personal/Mezo/mezo/.worktrees/<topic> on branch feat/<topic> (use it, do not create another); Tasks <list> committed and verified; <uncommitted WIP if any>; Postgres is running.
```

Where it comes from: the **previous session's final report** (the skills end with one) or
`git -C <worktree> log --oneline -5` + `git status --short`. If the previous session died
mid-task, run those two commands yourself and write the line from them — never trust a chat
summary you cannot see in git.

Worktree paths: `hermes -w` / `/worktree new <topic>` create `.worktrees/<topic>` under the
repo. If a session instead checked out a branch in the main repo (happens without a skill),
stop it: move the work with `git stash` → `git worktree add .worktrees/<topic> <branch>` →
`stash pop` there, and put the main checkout back on `main`.

## 4. Model and effort per session (as of 2026-08-23)

| Session | Model | Effort / thinking | Why |
|---|---|---|---|
| B fix · C2 plan · C3 execute · D continue · F docs | **Qwen3.6 35B A3B** | Medium | 3B active → fast tool loops; shipped W1.3 with 0 escalations; 12-min plan |
| A chat, rubber duck | Qwen3.6 35B A3B | Low | fast enough; Gemma 26B A4B (thinking off) is a valid alternative for conversation |
| C1 brainstorm → spec | **Qwen3.8 27B** (loads on demand) | Medium | short context, few tool calls, quality matters — the smartest dense model earns its keep here |
| E review · one hard question | Qwen3.8 27B (loads on demand) | Medium | one diff, one answer; never long agent loops (tool-call buffering + thinking runaway) |
| Hindsight memory extraction | **Gemma 4 26B A4B** | thinking OFF | 9 s per retain, 3 causal facts — Qwen3.8 quality at E4B speed; thinking models jam the pipeline |
| Titles, vision, memory query rewrite | Gemma 4 26B A4B | thinking OFF | never on the work model — aux retries starved real sessions |

Resident in RAM: 35B A3B (38 GB) + Gemma 26B A4B (28 GB) ≈ 66 GB; Qwen3.8 loads in ~10 s
when a session picks it and unloads after an hour idle. Three rules behind the table: **MoE
for agent loops** · **thinking only for short, decision-shaped work** · **auxiliary tasks never
on the work model and never on a thinking model**.

## 5. What you check, when

- **After C1:** the spec reads like a decision document, not a brainstorm transcript.
- **After C2:** plan PR — coverage, no placeholders, real paths, deferred dependencies named.
- **Between stages:** the diff; the reported test counts match what `git log` shows; the
  agent did not improvise on a plan conflict without saying so.
- **At the PR:** CI green; PR body lists deviations; bd issue updated; feature doc touched if
  behaviour changed; `node scripts/gen-codemap.mjs --check` clean.
- **Once a week:** `hermes worktree prune`; `lms ps` for stray loaded models; memory hygiene
  (`~/.hermes/memories/MEMORY.md` — delete stale lines; Hindsight via psql, see setup doc §7).

## 6. Troubleshooting (symptom → cause → fix)

| Symptom | Cause | Fix |
|---|---|---|
| "skill X is quarantined" / skill missing from list | skill text mentions a harness config file literally; desktop backend caches the verdict | reword (see setup doc §4), restart the desktop app |
| "Connection dropped mid tool-call; reconnecting…" | a huge single `write_file` (LM Studio buffers tool-call args) or >100K context | stop; fresh session; skills already chunk writes; keep ≤ 2 tasks |
| `bd`/`java` "not installed", agent wants to download something | agent shell lacks PATH | `~/.hermes/shell-init.sh`; never let it install — say "stop and report" |
| Session works in the main repo, footer shows `main` | started without a skill | stop, move work to a worktree (§3) |
| Everything slow, `lms ps` shows GENERATING for minutes | another session or aux retry storm on the 35B | check `~/.lmstudio/server-logs`; aux must be on Gemma E4B |
| "Client disconnected" bursts in LM Studio log | aux timeouts retrying | same as above |
| Two models loaded you did not ask for | JIT load from a stale config/session | `lms unload <key>` |
| PR shows "no checks" | PR is CONFLICTING (main moved) | merge `origin/main` into the branch (resolve), push |
