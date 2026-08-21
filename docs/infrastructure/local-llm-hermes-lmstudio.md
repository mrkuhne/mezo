# Local LLM stack — Hermes agent + LM Studio (M5 Max, 128 GB)

Setup and operating facts for the local-LLM development flow. Decision rationale:
[ADR 0029](../decisions/0029-local-llm-hermes-agent-stack.md); design spec:
[`2026-08-21-hermes-local-llm-workflow-design.md`](../superpowers/specs/2026-08-21-hermes-local-llm-workflow-design.md).
Driver: `mezo-zjtm`. Facts verified 2026-08-21.

## 1. Components & versions

| Component | Version / value |
|---|---|
| LM Studio | ≥0.3.31, mlx-engine **1.11.0 (nax)** selected (`lms runtime ls`) |
| Hermes agent | **v0.20.4**, native install (`~/.hermes/hermes-agent`), Python 3.11; surfaces: TUI (`hermes`), desktop app (`/Applications/Hermes.app`, shares `~/.hermes`), Discord gateway (launchd), web dashboard (`hermes dashboard`, `127.0.0.1:9119`) |
| Work model | `qwen/qwen3.6-35b-a3b` — MLX 8bit (37.8 GB, 3B active): spec/plan writing, implementation, chat (A/B 2026-08-21: 12-min plan, 0 hallucinated files) |
| Review / short-context model | `qwen/qwen3.8-27b` — **MLX 8bit** (29.5 GB): diff review, single-file tasks; thinking runs away past ~60K ctx (2 failed plan runs) |
| Auxiliary model | `google/gemma-4-e4b` (4bit, 6.9 GB): memory query-rewrite only |
| Fallback | `qwen/qwen3.6-27b` MLX 8bit (downloaded, standing by) |
| Phase-2 model (planned) | `qwen/qwen3-coder-next` — on disk at 4bit; **re-download at 6-bit before use** |
| Memory provider | **Hindsight local_embedded** (§7) on a pgvector container `hindsight-pg` (`127.0.0.1:15433`) |
| Server | `http://localhost:1234/v1` (`lms server start --port 1234`) |

Typical RAM with work + chat models loaded: ~75 GB (~60%). `lms ps` shows what is loaded;
JIT loading can silently load a third model if any client asks for it — check after surprises.

## 2. LM Studio settings

Set on the model **before/at load** (GUI load panel; `lms load <key> -c 262144` loads the
*selected* variant only — variant choice (MLX vs GGUF, quant) is a GUI action):

- Context Length **262144** on every model (Hermes rejects models reporting <64K — the #1 trap).
- Unified KV Cache **on**, Context Checkpoints **32** (KV checkpointing for agent loops; observed
  cache hit rate 84–93% in real sessions).
- K/V cache quantization 8-bit where offered; the MLX panel may not expose it — acceptable,
  the Qwen hybrid architecture's KV is only ~3–7 GB even at 262K.
- Inference defaults: Thinking **on**, Preserve Thinking **on**, sampling per model card
  (3.8: temp 1.0 / top-p 0.95 / top-k 20); **system-prompt field empty** (Hermes sends its own).
- **Reasoning effort is set per session from Hermes** (desktop picker / `--reasoning`) and
  overrides LM Studio's: **Medium** for work, **Low** for chat. **High does not scale**: on a
  ~60–100K-token agent context Qwen3.8 thinks 7→23 min per turn and hits Hermes's stream
  timeout, which then retries the identical request (A/B run 1, 2026-08-21).
- JIT loading: first API request loads the model (~10 s warm); idle TTL 60 min unloads it.
- **Tool-call arguments are NOT streamed** (measured 2026-08-21: reasoning + content stream
  immediately; a `write_file` call's arguments arrive only when complete — 167 s of silence
  for a 120-line file). Consequences: keep file-writing tool calls ≤ ~150 lines (skills do),
  and `agent.local_stream_stale_timeout: 2400` in Hermes so a long write is not killed at 900 s.

## 3. Hermes config (`~/.hermes/config.yaml` + `~/.hermes/.env`)

Applied via `hermes config set`:

```yaml
model:
  default: qwen/qwen3.6-35b-a3b # work model (A/B 2026-08-21); qwen3.8-27b for short-context review
  provider: lmstudio            # built-in provider, base_url http://localhost:1234/v1
  context_length: 262144        # explicit — name-based estimation is unreliable
terminal:
  cwd: /Users/mrkuhne/Applications/Personal/Mezo/mezo   # every surface starts in the repo
  shell_init_files: ["~/.hermes/shell-init.sh"]        # exports ~/.local/bin (bd) + ~/.lmstudio/bin
auxiliary:
  memory_query_rewrite: { provider: lmstudio, model: google/gemma-4-e4b }
  background_review: { provider: auto }                # stays on the main model — it patches skills/memories
memory:
  provider: hindsight
# compression defaults already match the design: threshold 50%, protect_last 20
```

Persona files: `~/.hermes/SOUL.md` (Identity/Style/Defaults/Avoid, ~1 KB; factory copy at
`SOUL.md.factory-backup`) and `~/.hermes/memories/USER.md` (declarative facts about Daniel).
Project-specific rules stay in `AGENTS.md`, procedures in `.agents/skills/`.

Known quirks (v0.20.4): `hermes doctor` shows a **cosmetic** "no API key for lmstudio" ✗
(placeholder auto-injected); there is **no `hermes ping`** (docs drift) — verify with
`hermes doctor` + `hermes -z "Reply OK" --cli`; the desktop app's Electron-spawned backend does
not inherit the login-shell PATH (hence `shell-init.sh`); upstream issues report gateway/`-z`
sessions ignoring `SOUL.md` (#26596/#34852).

## 4. Skills & project wiring

- Repo-local skills at **`.agents/skills/`** (10: five process, five domain — see
  [`.agents/README.md`](../../.agents/README.md)); discovery is trust-gated per machine:
  `hermes skills trust /Users/mrkuhne/Applications/Personal/Mezo/mezo`.
- Orientation protocol (in the skills): `docs/CODEMAP.md` feature block → feature doc §7/§10
  only → listed files once. Budget ≤12 tool calls before writing a plan. Unguided exploration
  cost 45 turns / 50 min on a 27B (A/B run 1) — the map exists because of that.
- **Worktree enforcement (3 layers):** skills start with `/worktree new <topic>` / `hermes -w`
  and verify the branch; `.worktrees/` is gitignored; and a local pre-commit guard rejects
  commits on `main` (snippet versioned at `scripts/git-hooks/pre-commit-no-main.sh` — append it
  to `.git/hooks/pre-commit` outside the beads block; `git merge --no-ff` is unaffected;
  escape hatch `ALLOW_MAIN_COMMIT=1`).
- Hermes project registered: `hermes project create mezo <repo-path> --use` (desktop session
  grouping + worktree/branch conventions).
- Discord: bot `LocalHermesAgent`, gateway under launchd (`hermes gateway status|restart`),
  access restricted via `DISCORD_ALLOWED_USERS`; Discord sessions ship the full toolset
  (~20K tokens of schemas/turn) — trimming tracked in `mezo-zjtm.5`.

## 5. Smoke-test procedure (model swap gate)

Run on any model/quant/engine change, in a throwaway dir (`~/tmp/hermes-smoke`), via the
interactive TUI (one-shot `-z` is fine too now that `terminal.cwd` is set):

1. **Multi-tool:** "Create fizz.py implementing fizzbuzz(n)…, test_fizz.py with 3 pytest
   cases, run tests, fix failures, git init + commit, show git log." Watch: malformed tool
   calls, thinking leaking into output/files, template errors in the LM Studio log,
   context complaints, **and where the files land**.
2. **Spec dialogue:** "Interview me briefly (max 3 questions, one at a time), then write a
   one-page design doc…" Watch: one-question discipline, coherent markdown, no leakage.

PASS → keep model. FAIL → load fallback in LM Studio, `hermes config set model.default …`,
re-run. Record outcome as a bd comment on the driving issue. (2026-08-21: Qwen3.8-27B **PASSED**.)

## 6. Known limits

- Manual model switching (LM Studio GUI for variant selection); acceptable at one agent
  at a time. Desktop model picker lists a "featured" shortlist — `hermes model --refresh`
  (interactive) repopulates the cache so all LM Studio models appear.
- Qwen3.8-27B is one week old — watch for MLX/template fixes in LM Studio updates.
- Escalation rule (from ADR 0029): 2 stalls on a slice or 2 same-cause CI reds → slice
  escalates to Claude; log as bd comment on `mezo-zjtm`.
- ripgrep not installed (no brew on PATH) — Hermes falls back to grep for file search.

## 7. Memory — Hindsight (local embedded)

Why Hindsight over the other providers: the only one documenting an OpenAI-compatible
extraction endpoint (LM Studio), local embeddings + rerank, knowledge-graph recall and
`hindsight_reflect`; see the [research comparison](../research/entities/hermes-agent.md) and
ADR 0029. Built-in MEMORY.md/USER.md stay active alongside.

- Configured by `hermes memory setup` → `~/.hermes/hindsight/config.json`
  (`mode: local_embedded`, `llm_provider: lmstudio`, `llm_model: qwen/qwen3.6-35b-a3b`,
  `bank_id: hermes`, `recall_budget: mid`); `HINDSIGHT_LLM_API_KEY=lm-studio` in `.env`.
- **Database:** the embedded pg0 Postgres is broken on this machine (`libpq` linked against a
  missing Homebrew `openssl@3`), so the daemon uses an external container:
  `docker run -d --name hindsight-pg --restart unless-stopped -p 127.0.0.1:15433:5432
  -e POSTGRES_USER=hindsight -e POSTGRES_PASSWORD=hindsight -e POSTGRES_DB=hindsight
  -v hindsight_pg:/var/lib/postgresql/data pgvector/pgvector:pg16` + `CREATE EXTENSION vector, pg_trgm`;
  wired via **`HINDSIGHT_EMBED_API_DATABASE_URL`** in `~/.hermes/.env` (the `HINDSIGHT_API_…`
  name is *not* read by the embedded daemon manager).
- Daemon: `~/.hermes/hermes-agent/venv/bin/hindsight-embed -p hermes daemon status|logs`,
  API on `127.0.0.1:9177`, log `~/.hindsight/profiles/hermes.log`; retain runs async after a
  turn (`[WORKER_TASK] … stage=llm.lmstudio.retain_ext`).
- **Monitoring:** in chat `hindsight_recall` / `hindsight_reflect`; in SQL
  `docker exec hindsight-pg psql -U hindsight -d hindsight -c "select fact_type, left(text,120), created_at from memory_units order by created_at desc limit 20"`.
- **Control-plane web UI is unusable** (0.7.2/0.8.6/0.9.1 all redirect-loop here — upstream
  vectorize-io/hindsight#1926 regressed); don't spend time on it until a new release.
