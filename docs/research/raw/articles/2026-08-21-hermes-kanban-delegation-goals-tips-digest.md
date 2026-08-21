---
title: "Hermes Agent docs digest — kanban, worker lanes, tools, delegation, goals, tips"
type: article
source_url: https://hermes-agent.nousresearch.com/docs/user-guide/features/kanban (+ kanban-tutorial, kanban-worker-lanes, tools, delegation, goals, guides/tips) — agent-read digest
ingested: 2026-08-21
sha256: a0c8a11da5bfd939202a89745c1f961fe97a7791bdf2a4c6d80cf1fb6f18dde6  # body below the frontmatter
---

<!-- RAW SOURCE — immutable. Agent digest (Claude subagent, 2026-08-21) of seven official Hermes docs pages, commissioned for mezo-zjtm. Do not edit content below. -->

## Where the web UI lives
- `hermes kanban init` then `hermes dashboard` → `http://127.0.0.1:9119`. Kanban is a tab in the left nav. Dispatcher runs inside `hermes gateway start` by default (`kanban.dispatch_in_gateway: true`, env `HERMES_KANBAN_DISPATCH_IN_GATEWAY`). Kanban plugin REST routes at `/api/plugins/kanban/...` are unauthenticated by design (localhost-bound). Don't run `hermes dashboard --host 0.0.0.0` on a shared host. No desktop-app kanban UI is mentioned — surfaces are dashboard, CLI, and `/kanban` slash command in chat platforms.

## 1. Kanban
Single-host multi-agent board. Per-board SQLite (`~/.hermes/kanban.db` default; `~/.hermes/kanban/boards/<slug>/kanban.db` named), workspaces dir, dispatcher loop. Multiple boards per install; boards are hard isolation.
Statuses: `triage | todo | ready | running | blocked | review | done | archived`. `todo→ready` when all parent links `done`; `blocked→triage` after `BLOCK_RECURRENCE_LIMIT=2` same-reason re-blocks.
Workspace types (`--workspace`): `scratch` (default, deleted on completion unless artifacts kept), `dir:<abs path>` (preserved), `worktree` / `worktree:<path>` (git worktree under `.worktrees/<id>/`, preserved) + `--branch <name>`.
CLI: `hermes kanban init | create "<title>" [--body --assignee --parent… --tenant --workspace --branch --priority --triage --idempotency-key --max-runtime 30m|2h|1d --max-retries --goal --goal-max-turns --skill… --model --provider --scheduled-at --json] | list | show | assign | reassign | edit | promote | schedule | diagnostics | link | unlink | claim | comment | complete [--result --summary --metadata JSON] | block <id> "<reason>" | unblock | archive | request-review | request-changes | reopen-review | tail | watch [--kinds] | heartbeat | runs | assignees | dispatch [--dry-run --max] | stats | log | notify-subscribe/list/unsubscribe | context | specify | decompose | gc | set-model | swarm "<goal>" --workers --verifier --synthesizer | boards list/create/show/switch/rename/rm`. Board resolution: `--board` > `HERMES_KANBAN_BOARD` > `~/.hermes/kanban/current` > `default`.
Worker tools (active when `HERMES_KANBAN_TASK` set): `kanban_show, kanban_list, kanban_complete(summary, metadata, artifacts), kanban_request_review, kanban_request_changes, kanban_block(reason, kind=dependency|needs_input|capability|transient), kanban_heartbeat, kanban_comment, kanban_attach*, kanban_create, kanban_link, kanban_unblock`.
config.yaml:
```yaml
kanban:
  dispatch_in_gateway: true
  dispatch_interval_seconds: 60
  review_dispatch: true          # false = human-only review
  max_in_progress: N
  max_in_progress_per_profile: N
  auto_promote_children: true
  auto_decompose: true
  auto_decompose_per_tick: 3
  auto_subscribe_on_create: true
  orchestrator_profile: ""
  default_assignee: ""
  done_sub_retention_days: 30
  default_workdir: ~
  failure_limit: 2
  dispatch_stale_timeout_seconds: 14400
  reconcile_orphans: true
dashboard:
  kanban: { default_tenant: , lane_by_profile: true, include_archived_by_default: false, render_markdown: true }
auxiliary:
  kanban_decomposer: <model>
  triage_specifier: <model>
  profile_describer: <model>
```
Dashboard UI: board switcher; `+` on column creates; multi-select; drag-drop; card drawer (description, deps, status actions, comments, run history, event log); triage buttons ⚗ Decompose / ✨ Specify; "Nudge dispatcher"; "Orchestration: Auto/Manual".
Slash: `/kanban list|show|create|comment|unblock|block|dispatch|specify|decompose|complete|stats|watch`.
Limits: 25 MB/attachment; failure_limit 2 → `gave_up`; protocol-violation limit 3; stale reclaim 4 h / no heartbeat 1 h; max_runtime → SIGTERM then SIGKILL. Single-host only.

## 2. Kanban tutorial
Six dashboard columns Triage/Todo/Ready/In Progress/Blocked/Done. `--json | jq -r .id` to chain parents. Child of a `done` parent is created straight into `ready`. `worker_context` passed to a spawned worker contains prior attempts and parents' most-recent completed-run summary+metadata — the structured handoff. Metadata keys seen: `changed_files, decisions, duration_seconds, tokens_used, tests_run, review_iteration, strategy`. Review: downstream review card with impl card as `--parent`, or same-card `request_review → request_changes → request_review → complete`. CI-remediation pattern: `hermes kanban create "Fix CI: …" --assignee backend-dev --parent t_impl --workspace worktree --branch wt/ci-fix-backoff --body "…"`. `hermes kanban watch --kinds completed,gave_up,timed_out`.

## 3. Worker lanes
A lane = assignee string + spawn mechanism + exactly one lifecycle terminator. Default profile lane spawns `hermes -p <assignee> chat -q <prompt>` in the pinned workspace with env `HERMES_KANBAN_TASK, HERMES_KANBAN_DB, HERMES_KANBAN_BOARD, HERMES_KANBAN_WORKSPACES_ROOT, HERMES_KANBAN_WORKSPACE, HERMES_KANBAN_RUN_ID, HERMES_KANBAN_CLAIM_LOCK, HERMES_PROFILE, HERMES_TENANT`; `KANBAN_GUIDANCE` auto-injected. Terminators: `kanban_complete`→done, `kanban_request_review`→review, `kanban_block`→blocked; exit without one → crashed/gave_up/timed_out. Orchestrator profile = `kanban` tools only. Logs `<board-root>/logs/<task_id>.log`. Claim TTL 15 min; `kanban.stranded_threshold_seconds` 30 min → diagnostics escalate.

## 4. Tools & toolsets
Named toolsets: `web, search, terminal, file, browser, vision, image_gen, skills, tts, todo, memory, session_search, cronjob, code_execution, delegation, clarify, homeassistant, messaging, spotify, discord, discord_admin, debugging, safe`, presets `hermes-cli, hermes-telegram, hermes-discord`, dynamic `mcp-<server>`. Per-platform enabling via interactive `hermes tools`; per-session `hermes chat --toolsets "web,terminal"`. YAML shape for per-platform lists lives in `/docs/reference/toolsets-reference` (not read). Terminal backend: `terminal.backend: local|docker|ssh|singularity|modal|daytona|vercel_sandbox`, `cwd, timeout: 180`, container_* keys; `hermes config set terminal.backend docker`.

## 5. Delegation
`delegate_task(goal, context)` or `tasks=[{goal,context},…]`; children get a fresh conversation. Config:
```yaml
delegation:
  max_iterations: 50
  max_concurrent_children: 3
  worktree_isolation: false       # true → branch hermes-subagent/subagent-<id> in .worktrees/
  max_spawn_depth: 1
  orchestrator_enabled: true
  model: "…"  provider: "…"
  base_url: "http://localhost:1234/v1"   # LM Studio example shown verbatim in docs
  api_key: "local-key"
  child_timeout_seconds: 0
```
Leaf children lose `delegate_task, clarify, memory, send_message, cronjob`. Stall monitor 450 s idle / 1200 s in-tool. `/agents` shows the tree; steer/stop actions. Pattern: "frontier planner, inexpensive workers".

## 6. Goals
`/goal <text>`, `/goal draft <text>` (auxiliary writes a completion contract: outcome, verification, constraints, boundaries, stop_when), `/goal show|status|pause|resume|clear`, `/goal wait <pid>`, `/goal gate add <cmd>|list|remove|clear`, `/subgoal`. Config `goals.max_turns: 20`, `auxiliary.goal_judge`. Gates: shell cmds must exit 0, run before the judge, 3 retries, 5-min timeout, skipped if git fingerprint unchanged, failing tail becomes the continuation prompt. Kanban cards: `--goal --goal-max-turns N`.

## 7. Tips (near-verbatim)
Be specific (file, line, error, expected behaviour); provide context up front; put recurring instructions in `AGENTS.md`; let the agent use its tools; use skills for complex workflows. Context files: `AGENTS.md` = project; `~/.hermes/SOUL.md` = personality. Memory = facts, Skills = procedures; "task takes 5+ steps and you'll do it again → ask the agent to create a skill"; memory bounded (~2,200 chars MEMORY.md, ~1,375 USER.md). Performance: keep system prompt stable for cache hits; `/compress`; `delegate_task` for parallel subtasks; `execute_code` for batch ops; frontier model for reasoning, fast model for simple tasks; `/usage`, `/insights`, `hermes prompt-size`. Security: `TERMINAL_ENV=docker` for untrusted code; never `GATEWAY_ALLOW_ALL_USERS=true` — use `DISCORD_ALLOWED_USERS` etc.
