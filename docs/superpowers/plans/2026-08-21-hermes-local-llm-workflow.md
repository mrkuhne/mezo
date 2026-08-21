# Hermes Agent + Local LLM Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Human-in-the-loop notice:** Tasks 1–3 configure the user's machine (LM Studio GUI, ~30–60 GB
> model downloads, interactive `hermes setup`). Steps marked **[USER]** need Daniel at the
> keyboard; agent-executable steps are unmarked. Repo work (Tasks 4–8) is normal agent work on
> this branch.

**Goal:** Stand up the Hermes-agent + LM Studio local-LLM development flow for mezo per the approved design spec, through the Phase-1 (spec/plan + chat) A/B measurement gate.

**Architecture:** One Hermes agent (native install, default profile) driving one LM Studio model (Qwen3.8-27B MLX 8-bit, fallback Qwen3.6-27B) at 262K context; roles are repo-versioned skills (agentskills.io), not separate agents; the full mezo house rules (bd, docs, PR+CI) apply via a new agent-agnostic `AGENTS.md`.

**Tech Stack:** LM Studio (mlx-engine ≥1.8.5), Hermes agent v0.20.x, MLX 8-bit quants, agentskills.io skill format.

**Spec:** [`docs/superpowers/specs/2026-08-21-hermes-local-llm-workflow-design.md`](../specs/2026-08-21-hermes-local-llm-workflow-design.md) · **Driver epic:** `mezo-zjtm`

## Global Constraints

- Context length: **262144**, set in LM Studio **before** loading the model (Hermes rejects <64K).
- KV cache: **8-bit**. Weights: **MLX 8-bit** (27B models); Coder-Next later at MLX 6-bit.
- LM Studio server: `http://localhost:1234/v1`; model IDs always taken from `GET /v1/models`, never guessed.
- Sampling (Qwen3.8 thinking): temp 1.0 / top_p 0.95 / top_k 20. (Qwen3.6 coding: temp 0.6 / top_p 0.95 / top_k 20.)
- Skills live in the repo under `agents/hermes/skills/<name>/SKILL.md` (source of truth) and are linked/copied to wherever Hermes discovers them (determined in Task 5 Step 1).
- Skill/doc language: English. Conversation with the user may be Hungarian.
- Repo commits: conventional subjects carrying `(mezo-zjtm)`; docs-only changes still go through the PR + CI gate.
- Claude-fallback rule (applies from Task 8 onward): 2 stalls on one slice OR 2 CI-reds from the same mistake → escalate the slice to Claude; log the escalation as a bd comment on `mezo-zjtm`.

---

### Task 1: bd children + LM Studio models & server

**Files:** none (machine state + bd only)

**Interfaces:**
- Produces: bd children `mezo-zjtm.1`–`.3`; LM Studio serving the primary model on `:1234` with 262144 context; exact model ID string (call it `$MODEL_ID`) for Task 2.

- [ ] **Step 1: Create bd children**

```bash
bd create "Stack setup: LM Studio + Hermes install + smoke-test gate" -t task -p 1 --parent mezo-zjtm
bd create "Repo integration: AGENTS.md + Hermes skills + docs (ADR/infra/research)" -t task -p 1 --parent mezo-zjtm
bd create "Phase 1 A/B: local spec+plan vs Claude on a real slice" -t task -p 1 --parent mezo-zjtm
```

- [ ] **Step 2 [USER]: Update LM Studio, verify engine version**

In LM Studio: Settings → check for updates. Then Developer tab → runtime/engines: confirm **mlx-engine ≥ 1.8.5** (KV-cache checkpointing for agent loops). Also confirm LM Studio app version ≥ 0.3.31.

- [ ] **Step 3 [USER]: Download models (~60 GB total)**

In LM Studio model search (or `lms get`): download **Qwen3.8-27B MLX 8-bit** and **Qwen3.6-27B MLX 8-bit** (fallback — download now, while motivated). Prefer official/mlx-community uploads; avoid 4-bit variants.

- [ ] **Step 4 [USER]: Configure model load settings (BEFORE loading)**

For each of the two models, in the model's load settings: **Context Length = 262144**, **KV Cache Quantization = 8-bit**, Flash Attention on (if exposed). Load **Qwen3.8-27B**. Set sampling defaults per Global Constraints.

- [ ] **Step 5 [USER]: Start the local server**

LM Studio Developer tab → Start Server on port **1234** (enable "serve on local network" OFF; default localhost is fine).

- [ ] **Step 6: Verify server + capture `$MODEL_ID`**

```bash
curl -s http://localhost:1234/v1/models | python3 -m json.tool
```

Expected: JSON list containing the loaded Qwen3.8 model. Record its exact `id` — this is `$MODEL_ID` for Task 2. Then verify a completion works and reports the big context:

```bash
curl -s http://localhost:1234/v1/chat/completions -H 'Content-Type: application/json' \
  -d '{"model":"'$MODEL_ID'","messages":[{"role":"user","content":"Reply with exactly: OK"}],"max_tokens":200}'
```

Expected: HTTP 200, assistant content containing "OK".

- [ ] **Step 7: Close bd child 1 partially** — add a bd comment on the "Stack setup" child: models downloaded, server verified, `$MODEL_ID` value. (The child closes after Task 3.)

---

### Task 2: Hermes install + LM Studio provider config

**Files:**
- Modify (machine): `~/.hermes/config.yaml`

**Interfaces:**
- Consumes: `$MODEL_ID` from Task 1.
- Produces: working `hermes` CLI wired to LM Studio; config keys `providers.lmstudio`, `model`, `compression` as below.

- [ ] **Step 1 [USER]: Install Hermes**

```bash
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
hermes --version
```

Expected: v0.20.x or newer.

- [ ] **Step 2 [USER]: Run `hermes setup`, choose the LM Studio provider**

Interactive: pick **LM Studio**, endpoint `http://localhost:1234/v1`, blank API key, model = `$MODEL_ID`. (If setup completes without asking for context length, fix it in Step 3.)

- [ ] **Step 3: Pin the config explicitly**

Edit `~/.hermes/config.yaml` so these keys are present (merge, don't clobber unrelated keys — exact key names may differ slightly by version; consult `hermes config --help` / docs if a key is rejected):

```yaml
providers:
  lmstudio:
    type: openai
    base_url: "http://localhost:1234/v1"
    api_key: ""
model:
  provider: lmstudio
  model: "$MODEL_ID"          # literal value from Task 1 Step 6
  context_length: 262144
compression:
  threshold: 0.50
  protect_last_n: 20
```

Point the compression/auxiliary summarizer at the same `lmstudio` provider if the config asks for one.

- [ ] **Step 4: Verify connectivity**

```bash
hermes ping
```

Expected: success against LM Studio, context reported as 262144 (or at minimum ≥64K, with no "context too small" rejection). If Hermes reports a tiny context, the LM Studio load setting from Task 1 Step 4 didn't stick — reload the model there first.

- [ ] **Step 5: bd comment** on the "Stack setup" child: Hermes version, ping output summary.

---

### Task 3: Smoke-test gate (Qwen3.8 keep-or-fallback decision)

**Files:** none (throwaway dir outside the repo)

**Interfaces:**
- Consumes: working Hermes from Task 2.
- Produces: a **decision** — primary model stays Qwen3.8-27B or falls back to Qwen3.6-27B — recorded as a bd comment; `$MODEL_ID` possibly updated.

- [ ] **Step 1: Multi-tool smoke task**

In a throwaway directory (`mkdir -p ~/tmp/hermes-smoke && cd ~/tmp/hermes-smoke`), start `hermes` and give it exactly this prompt:

> Create a file `fizz.py` implementing fizzbuzz(n) returning a list of strings, a `test_fizz.py` with 3 pytest cases, run the tests with the shell, fix any failure, then `git init`, commit the two files, and show me `git log --oneline`.

Watch for the four failure signatures from the spec §3a: (1) malformed/failed tool calls anywhere in the loop, (2) thinking blocks leaking into replies or files, (3) template/parse errors in the LM Studio server log, (4) context complaints.

- [ ] **Step 2: Spec-dialogue smoke test**

New Hermes session, prompt:

> Interview me briefly (max 3 questions, one at a time), then write a one-page design doc in markdown for a CLI tool that renames photo files by EXIF date. Save it as design.md.

Watch for: keeps the one-question-at-a-time discipline ≥ once, produces coherent structured markdown, no thinking leakage.

- [ ] **Step 3: Decide + record**

PASS (both steps clean or with only cosmetic issues) → Qwen3.8 stays primary. FAIL → in LM Studio load Qwen3.6-27B MLX 8-bit (settings per Task 1 Step 4), update `model.model` in `~/.hermes/config.yaml`, re-run Step 1 to confirm the fallback is clean.
Record the outcome + observations as a bd comment; **close the "Stack setup" child**.

---

### Task 4: `AGENTS.md` + `CLAUDE.md` split (single source for house rules)

**Files:**
- Create: `AGENTS.md` (repo root)
- Modify: `CLAUDE.md` (repo root)

**Interfaces:**
- Produces: `AGENTS.md` as the agent-agnostic house-rules core (Hermes reads it natively; Claude reaches it via a mandatory pointer in `CLAUDE.md`).

- [ ] **Step 1: Write `AGENTS.md`**

Move (not copy) the agent-agnostic core out of `CLAUDE.md`, preserving wording verbatim except where a Claude-specific term appears. Structure:

1. `# House Rules for AI Agents (all harnesses)` — one intro line.
2. **Beads Issue Tracker** section — verbatim from CLAUDE.md, with the line "do NOT use TodoWrite, TaskCreate, or markdown TODO lists" generalized to "do NOT use any harness-local todo/task tool or markdown TODO lists".
3. **Git Workflow** section — verbatim.
4. **Session Completion** section — verbatim.
5. **Documentation (`docs/`) — MANDATORY** section — verbatim, except: the `knowledge-base` skill is Claude-side, so reword its mentions to "the knowledge-base workflow (`docs/research/SCHEMA.md` + `node scripts/lint-docs.mjs`; Claude sessions: the `knowledge-base` skill)".
6. **Architecture Overview** — verbatim.
7. **Build & Test** — verbatim (all three code blocks + ports paragraph).
8. **Frontend Development Conventions** — verbatim.
9. **Backend Development Conventions** — verbatim, including the reference table and project-specific adaptations.
10. New final section **Hermes agent specifics**:

```markdown
## Hermes Agent Specifics

- Skills live in `agents/hermes/skills/` (repo = source of truth). Process skills:
  `brainstorming`, `writing-plans`, `executing-plans`, `tdd`,
  `verification-before-completion`. Domain skills: `mezo-backend`, `mezo-frontend`,
  `mezo-api-contract`, `mezo-testing`, `mezo-deploy`. Invoke the process skill FIRST
  (it tells you when to pull a domain skill).
- Work in a git worktree (Hermes worktree mode) on a `feat/<topic>` branch; never on main.
- Escalation rule: if you stall twice on the same slice, or CI goes red twice from the
  same mistake, STOP and report — the slice escalates to Claude. Log it as a bd comment.
```

- [ ] **Step 2: Trim `CLAUDE.md`**

Replace each moved section with nothing; at the top (after the title) insert:

```markdown
> **Core house rules live in [`AGENTS.md`](AGENTS.md)** — beads, git workflow, session
> completion, docs mandate, architecture, build & test, frontend/backend conventions.
> Reading it is MANDATORY at session start; everything there applies to Claude sessions.
```

Keep in `CLAUDE.md` only what is Claude-specific today: nothing else currently qualifies except this pointer — if in doubt about a fragment, it goes to `AGENTS.md`.

- [ ] **Step 3: Verify no content was lost**

```bash
git diff --stat CLAUDE.md; wc -l CLAUDE.md AGENTS.md
```

Expected: `AGENTS.md` ≈ old CLAUDE.md length; combined content covers every old section (eyeball the diff — every deleted CLAUDE.md line must appear in AGENTS.md or be a deliberate reword listed in Step 1).

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md CLAUDE.md
git commit -m "docs(agents): split agent-agnostic house rules into AGENTS.md (mezo-zjtm)"
```

---

### Task 5: Process skills (the superpowers ports)

**Files:**
- Create: `agents/hermes/skills/brainstorming/SKILL.md`, `agents/hermes/skills/writing-plans/SKILL.md`, `agents/hermes/skills/executing-plans/SKILL.md`, `agents/hermes/skills/tdd/SKILL.md`, `agents/hermes/skills/verification-before-completion/SKILL.md`
- Create: `agents/hermes/README.md` (how skills are wired into Hermes)

**Interfaces:**
- Produces: five process skills discoverable by Hermes; the wiring mechanism documented in `agents/hermes/README.md` and reused by Task 6.

- [ ] **Step 1: Discover Hermes's skill directory**

Run `hermes skills list` (or consult https://hermes-agent.nousresearch.com/docs on skills) to find where project-local skills are discovered. Preference order: (a) a project-local dir Hermes scans natively → symlink `agents/hermes/skills` there; (b) only `~/.hermes/skills/` global → symlink each skill dir: `ln -s "$(pwd)/agents/hermes/skills/"* ~/.hermes/skills/`. Record the chosen mechanism in `agents/hermes/README.md` (short: where Hermes looks, the symlink command, "repo is source of truth — never edit skills in ~/.hermes directly").

- [ ] **Step 2: Write the five skills** — exact content below; agentskills.io format (dir + `SKILL.md` with `name`/`description` frontmatter). These are deliberately shorter and more prescriptive than the superpowers originals — a 27B follows short imperative checklists far better than long essays.

`brainstorming/SKILL.md`:

```markdown
---
name: brainstorming
description: Use BEFORE designing or building anything new — turns an idea into an approved design spec through short dialogue. Never write code while this skill is active.
---

# Brainstorming → Design Spec

HARD RULE: no code, no file scaffolding, no implementation until the user approves a design.

1. Read the project context first: AGENTS.md, docs/milestones/roadmap.md, and any
   docs/features/<domain>.md the idea touches.
2. Ask clarifying questions ONE AT A TIME (purpose, constraints, success criteria).
   Prefer multiple-choice. Stop asking when you can state the design.
3. Propose 2–3 approaches with trade-offs. Recommend one. Wait for the user's pick.
4. Present the design in short sections (goal, architecture, data flow, error handling,
   testing). Ask after each section if it is right.
5. On approval, write the spec to docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md
   (mirror the format of the newest file already in that directory), commit it.
6. Self-check the spec: no TBD/TODO, no contradictions, no ambiguity. Fix inline.
7. Ask the user to review the spec file. When approved, switch to the writing-plans skill.
```

`writing-plans/SKILL.md`:

```markdown
---
name: writing-plans
description: Use when an approved design spec exists and implementation must be planned. Produces a bite-sized, checkboxed task plan in docs/superpowers/plans/.
---

# Writing Implementation Plans

Audience: an engineer with zero context. Every task must be executable without asking questions.

1. Read the spec fully. Read every file the spec names.
2. Map the file structure first: which files are created/modified, one responsibility each.
3. Break work into tasks. One task = one testable deliverable + its own commit.
4. Each task lists: Files (exact paths), Interfaces (exact names/signatures consumed and
   produced), then 2–5-minute checkbox steps: write failing test → run it (expect FAIL) →
   minimal implementation → run test (expect PASS) → commit (exact git command).
5. Include REAL code in steps, never "add validation" / "similar to Task N" / TBD.
6. Header must carry: Goal, Architecture (2–3 sentences), Global Constraints (exact
   values from the spec), spec link, driving bd id.
7. Save to docs/superpowers/plans/YYYY-MM-DD-<feature>.md, commit.
8. Self-check against the spec: every requirement maps to a task; types/names consistent
   across tasks. Fix inline, then offer execution.
```

`executing-plans/SKILL.md`:

```markdown
---
name: executing-plans
description: Use when a checkboxed implementation plan exists. Executes it task by task with verification gates and per-task commits.
---

# Executing Plans

1. Work in a git worktree on a feat/<topic> branch, never on main.
2. Load the plan file. Execute ONE task at a time, steps in order, checking off boxes
   in the plan file as you go.
3. Follow steps EXACTLY. If a step conflicts with reality (file moved, API differs),
   STOP the task, state the conflict, and ask before improvising.
4. Run every verification command a step names; paste the actual output before claiming
   the step done. A test that was expected to fail MUST be seen failing first.
5. Commit exactly where the plan says. Never batch multiple tasks into one commit.
6. ESCALATION RULE: two stalls on the same task, or the same failure twice → stop,
   summarize the blocker, log a bd comment. Do not thrash.
7. After the last task: run the full local gates from AGENTS.md (Build & Test section),
   then follow the Git Workflow (push → self-PR → CI green).
```

`tdd/SKILL.md`:

```markdown
---
name: tdd
description: Use whenever writing any implementation code — enforces red/green/refactor. The test exists and fails BEFORE the implementation exists.
---

# TDD

1. RED: write the smallest test that fails for the right reason. Run it. See it fail.
   If it passes immediately, the test is wrong — fix the test first.
2. GREEN: write the minimal code to pass. No extra features. Run the test. See it pass.
3. REFACTOR: clean up only with green tests. Re-run after every refactor.
4. Backend: integration-first (@SpringBootTest + Testcontainers), AssertJ, naming
   test{Method}_should{Result}_when{Condition} — see mezo-testing skill.
   Frontend: vitest, colocated, run in BOTH modes (default and VITE_USE_MOCK=true).
5. Never delete or weaken a failing test to make the suite pass. Never mark a task done
   with red tests.
```

`verification-before-completion/SKILL.md`:

```markdown
---
name: verification-before-completion
description: Use before claiming ANY work finished, fixed, or passing — evidence before assertions, always.
---

# Verification Before Completion

1. Never say "done/fixed/passing" without having just run the proving command.
2. Minimum gates (from AGENTS.md): backend change → cd backend && ./mvnw clean test;
   frontend change → cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test;
   docs change → node scripts/lint-docs.mjs.
3. Paste the command's tail output (summary lines) with the claim.
4. If a gate fails: report the failure honestly, do NOT rationalize it as unrelated
   without proof (git stash the change, re-run, compare).
5. Work is complete only when: gates green + bd issue updated + docs/ obligations met
   (feature doc touched if behavior changed) + pushed per Git Workflow.
```

- [ ] **Step 3: Wire + verify discovery**

Apply the mechanism from Step 1, then run `hermes skills list` (or start `hermes` and ask "what skills do you have?"). Expected: all five listed.

- [ ] **Step 4: Functional check** — in a Hermes session in the repo: "Using the brainstorming skill, help me design a trivial script." Expected: it announces the skill, asks one question at a time, refuses to code.

- [ ] **Step 5: Commit**

```bash
git add agents/hermes
git commit -m "feat(agents): hermes process skills — superpowers ports (mezo-zjtm)"
```

---

### Task 6: Domain skills (thin pointers to `docs/references/`)

**Files:**
- Create: `agents/hermes/skills/mezo-backend/SKILL.md`, `.../mezo-frontend/SKILL.md`, `.../mezo-api-contract/SKILL.md`, `.../mezo-testing/SKILL.md`, `.../mezo-deploy/SKILL.md`

**Interfaces:**
- Consumes: wiring mechanism from Task 5 Step 1.

- [ ] **Step 1: Write the five skills.** Shared shape: frontmatter + "READ FIRST" list + hard gates. Exact contents:

`mezo-backend/SKILL.md`:

```markdown
---
name: mezo-backend
description: Use before touching ANY backend code (Java, Spring, JPA, Liquibase, DTO, backend test) — routes you to the mandatory house references.
---

# mezo Backend Work

READ FIRST (docs/references/): the row(s) of the table in AGENTS.md §Backend Development
Conventions that match what you touch — java_package_structure, spring_patterns,
error_handling, liquibase_conventions, configuration_conventions, api_contract_conventions,
companion_tool_conventions. Follow them exactly; they override instinct.

Hard gates: UUID PKs · constructor injection only · no @Value · SystemRuntimeErrorException
+ SystemMessage for errors · seed data in Java @Profile("demodata"), never SQL · soft delete
via @SQLRestriction · changeset naming {YYYYMMDDHHMM}_{bd-id}_{desc} · ALWAYS ./mvnw clean.
Contract-first: edit api/feature/<name>/<name>.yml BEFORE code; never hand-write boundary DTOs.
```

`mezo-frontend/SKILL.md`:

```markdown
---
name: mezo-frontend
description: Use before touching ANY frontend/src code (pages, components, sheets, hooks, data layer, FE tests) — routes you to the mandatory house references.
---

# mezo Frontend Work

READ FIRST: docs/references/frontend_conventions.md (full file), and the feature's
docs/features/<domain>.md if one exists.

Hard gates: four layers (app/ features/ shared/ data/) · routed = *Section or *Page, modals =
*Sheet, never *Screen/*View · hooks imported from @/data/hooks ONLY · dual-mode reads via
useDualQuery · @/* absolute imports, no barrels except data/hooks.ts · shared/ui is domain-free.
Gate: pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test — BOTH modes green.
```

`mezo-api-contract/SKILL.md`:

```markdown
---
name: mezo-api-contract
description: Use before adding/changing any REST endpoint or FE↔BE DTO — the OpenAPI contract comes first, code second.
---

# mezo API Contract Work

READ FIRST: docs/references/api_contract_conventions.md.

Flow (in order): 1) edit api/feature/<name>/<name>.yml · 2) cd api/generate && npm run
generate:api · 3) frontend types: cd frontend && pnpm generate:api · 4) backend implements the
generated <Tag>Api interface with api.dto models (regenerates in ./mvnw generate-sources).
Never hand-write a boundary DTO; frontend request bodies use `satisfies` on generated types.
```

`mezo-testing/SKILL.md`:

```markdown
---
name: mezo-testing
description: Use before writing or changing any backend test — integration-first house standard.
---

# mezo Backend Testing

READ FIRST: docs/references/testing_standards.md AND docs/references/integration_test_framework.md.

Hard gates: integration-first (@SpringBootTest + Testcontainers Postgres) · extend
AbstractIntegrationTest (service-level) or ApiIntegrationTest (HTTP-level) · data via
*Populator factories only · new domain table → ResetDatabase TRUNCATE list · naming
test{Method}_should{Result}_when{Condition} · AssertJ only · NO mocks/@MockBean/H2 in ITs.
Run: cd backend && ./mvnw clean test (compose up first; CI uses Testcontainers mode).
```

`mezo-deploy/SKILL.md`:

```markdown
---
name: mezo-deploy
description: Use before any deployment / infra / hosting / k8s / ArgoCD / CI work.
---

# mezo Deployment & Infra

READ FIRST: docs/infrastructure/deployment-k3s-argocd.md AND
docs/decisions/0001-deploy-on-k3s-argocd-learning-track.md. For CI specifics:
docs/infrastructure/local-dev-testing.md (why the self-PR CI gate exists).

Hard gates: infra changes get a docs/infrastructure/ doc update in the same change ·
direction changes get an ADR · never bypass the PR + CI-green gate.
```

- [ ] **Step 2: Verify discovery** — `hermes skills list` shows all ten skills (5+5).

- [ ] **Step 3: Commit**

```bash
git add agents/hermes/skills
git commit -m "feat(agents): hermes domain skills — thin pointers to house references (mezo-zjtm)"
```

---

### Task 7: Docs — ADR, infrastructure doc, research ingestion

**Files:**
- Create: `docs/decisions/0029-local-llm-hermes-agent-stack.md`
- Create: `docs/infrastructure/local-llm-hermes-lmstudio.md`
- Create: research pages under `docs/research/` (per SCHEMA; raw sources already committed at `docs/research/raw/articles/2026-08-21-hermes-agent-deep-research.md` and `2026-08-21-local-llm-landscape-m5max-deep-research.md`)
- Modify: `docs/research/index.md`, `docs/research/log.md`

**Interfaces:**
- Consumes: smoke-test outcome (Task 3), skill wiring mechanism (Task 5).

- [ ] **Step 1: Write the ADR** (`0029-local-llm-hermes-agent-stack.md`, house ADR format per `docs/README.md`). Content requirements — decision: Hermes agent (native, one profile) + LM Studio (MLX, 8-bit weights, 8-bit KV, 262144 ctx) + Qwen3.8-27B primary / Qwen3.6-27B fallback (state the actual smoke-test outcome) / Qwen3-Coder-Next planned for Phase 2; roles as repo-versioned skills, not agents; full house rules incl. CI gate; staged rollout with A/B gates and the Claude-escalation rule. Alternatives considered (with the reason rejected): Hermes 4 70B model (outdated, slow dense 70B), MiniMax-M2.7 (forces 4-bit, ~15 tok/s), per-role model matrix (maintenance cost, process > model), Docker-first Hermes (needless friction; terminal-backend sandboxing available later), GGUF/llama.cpp (M5 Neural Accelerators favor MLX). Link the spec and the two raw research files.

- [ ] **Step 2: Write the infrastructure doc** (`local-llm-hermes-lmstudio.md`). Sections: (1) components + versions (LM Studio/mlx-engine, Hermes, models with exact `$MODEL_ID`s); (2) LM Studio settings (context 262144 BEFORE load, KV 8-bit, port 1234, sampling per model); (3) Hermes config — the actual `~/.hermes/config.yaml` keys as applied; (4) skill wiring — mechanism from Task 5 Step 1, symlink commands; (5) smoke-test procedure (the two prompts from Task 3, failure signatures, fallback switch steps); (6) known limits (manual model switch, 1-week-old model caveat, escalation rule pointer).

- [ ] **Step 3: Ingest the two raw research reports** per `docs/research/SCHEMA.md` (read it first): create/extend entity pages (`hermes-agent`, `lm-studio`, `qwen3.8-27b` or a `qwen-3x-model-line` entity per schema's granularity rules, `mlx`), a comparison page (`local-coding-models-128gb-m5max-2026`), register both raws in `index.md` + `log.md` with SHA256 per schema. Keep pages <200 lines.

- [ ] **Step 4: Lint + fix**

```bash
node scripts/lint-docs.mjs
```

Expected: no NEW findings from these files (3 stale feature docs + 4 warnings pre-date this branch and stay out of scope).

- [ ] **Step 5: Commit; close bd child 2**

```bash
git add docs
git commit -m "docs: ADR 0029 + infra doc + research ingestion for local-LLM stack (mezo-zjtm)"
```

---

### Task 8: Phase-1 A/B measurement (local vs Claude on a real slice)

**Files:**
- Create: `docs/superpowers/plans/<date>-<slice>-LOCAL.md` (the local flow's output; suffix marks provenance)
- Modify: bd comments on `mezo-zjtm`

**Interfaces:**
- Consumes: full stack from Tasks 1–7.
- Produces: go/no-go decision for Phase 2, recorded on `mezo-zjtm`.

- [ ] **Step 1: Pick the slice.** Default: `mezo-b3pp.3` (W1.3 Gratitude entries) if still open — small, self-contained, spec already exists (phase5 design §W1.3). Otherwise the next unimplemented slice in the phase5 spec §10 execution order.

- [ ] **Step 2 [USER]: Local run.** In a Hermes session (repo, worktree): "Using the writing-plans skill, write the implementation plan for <slice> from docs/superpowers/specs/2026-08-18-phase5-deep-memory-personalization-design.md §<section>." Save output as the `-LOCAL.md` plan file. Note wall-clock time and any interventions needed.

- [ ] **Step 3: Claude run.** A Claude session writes the same plan (normal flow, normal filename), WITHOUT looking at the local output.

- [ ] **Step 4: Compare + score.** Evaluate the local plan against the Claude plan on: (a) spec coverage — every §W1.3 requirement has a task; (b) house-rule fidelity — TDD steps, correct file paths/layers, contract-first if API touched, bd/docs steps present; (c) executability — no placeholders, exact commands; (d) hallucinated files/APIs (count them). **Acceptance bar (spec §8): the local plan is at most one editing pass from usable** — i.e., fixable by edits to <25% of tasks with no structural rework.

- [ ] **Step 5: Record + decide.** bd comment on `mezo-zjtm` with scores, verdict, and decision: PASS → Phase 2 unlocked (Coder-Next implementation trial, next plan); FAIL → iterate skills/model (file a follow-up bd task naming the top failure mode). Close bd child 3. The Claude-written plan (Step 3) is the one actually executed for the slice either way — the A/B costs no real work.

---

### Task 9: Finish the branch

- [ ] **Step 1:** Run repo gates: `node scripts/lint-docs.mjs` (docs-only branch — no backend/frontend code changed; if that changed, run those gates too).
- [ ] **Step 2:** Follow AGENTS.md Git Workflow: `bd dolt push`, `git push`, open self-PR, wait CI green, local `--no-ff` merge to main after `git pull --rebase`, push, delete branch.
- [ ] **Step 3:** bd: close remaining children, add hand-off comment on `mezo-zjtm` (what's live, what Phase 2 needs).
