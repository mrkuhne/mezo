# Local LLM stack — Hermes agent + LM Studio (M5 Max, 128 GB)

Setup and operating facts for the local-LLM development flow. Decision rationale:
[ADR 0029](../decisions/0029-local-llm-hermes-agent-stack.md); design spec:
[`2026-08-21-hermes-local-llm-workflow-design.md`](../superpowers/specs/2026-08-21-hermes-local-llm-workflow-design.md).
Driver: `mezo-zjtm`. Facts verified 2026-08-21.

## 1. Components & versions

| Component | Version / value |
|---|---|
| LM Studio | ≥0.3.31, mlx-engine **1.11.0 (nax)** selected (`lms runtime ls`) |
| Hermes agent | **v0.20.4**, native install (`~/.hermes/hermes-agent`), Python 3.11 |
| Primary model | `qwen/qwen3.8-27b` — **MLX 8bit variant** (29.53 GB) |
| Fallback model | `qwen/qwen3.6-27b` — MLX 8bit (29.53 GB, downloaded, standing by) |
| Phase-2 model (planned) | `qwen/qwen3-coder-next` — on disk at 4bit (44.86 GB); **re-download at 6-bit before use** (4-bit hurts tool-calling) |
| Server | `http://localhost:1234/v1` (`lms server start --port 1234`) |

## 2. LM Studio settings

Set on the model **before/at load** (GUI load panel, or `lms load qwen/qwen3.8-27b -c 262144`;
note the CLI loads the *selected* variant — variant choice is a GUI action):

- Context Length **262144** (Hermes rejects models reporting <64K — the #1 setup trap).
- Unified KV Cache **on**, Context Checkpoints **32** (KV checkpointing for agent loops).
- K/V cache quantization 8-bit where offered; MLX panel may not expose it — acceptable,
  the Qwen hybrid architecture's KV is only ~3–7 GB even at 262K.
- Inference: Reasoning Effort **Medium** (raise per-session for hard design work),
  Thinking **on**, Preserve Thinking **on**, temp 1.0 / top-p 0.95 / top-k 20,
  **system prompt field empty** (Hermes sends its own; personality belongs in `~/.hermes/SOUL.md`).
- JIT loading: first API request loads the model (~10 s warm); idle TTL 60 min unloads it.

## 3. Hermes config (`~/.hermes/config.yaml`)

Applied via `hermes config set`:

```yaml
model:
  default: qwen/qwen3.8-27b     # switch to qwen/qwen3.6-27b to fall back
  provider: lmstudio            # built-in provider, base_url http://localhost:1234/v1
  context_length: 262144        # explicit — name-based estimation is unreliable
# compression defaults already match the design: threshold 50%, protect_last 20
```

Known quirks (v0.20.4): `hermes doctor` shows a **cosmetic** "no API key for lmstudio"
✗ (the code auto-injects a placeholder — see `hermes_cli/auth.py`); there is **no
`hermes ping`** (docs drift) — verify with `hermes doctor` + `hermes -z "Reply OK" --cli`;
config migrated with `hermes config migrate` after install.

## 4. Skills & project wiring

- Repo-local skills at **`.agents/skills/`** (10: five process, five domain — see
  [`.agents/README.md`](../../.agents/README.md)); discovery is trust-gated per machine:
  `hermes skills trust /Users/mrkuhne/Applications/Personal/Mezo/mezo`.
- Hermes project registered: `hermes project create mezo <repo-path> --use` (anchors
  desktop grouping + worktree/branch conventions).
- **Workspace rule:** interactive TUI sessions start in the caller's cwd ✓; one-shot
  `hermes -z` **always starts its shell in `$HOME`** (v0.20.4) — run agent work from the
  interactive TUI started inside the repo (rule also stated in `AGENTS.md`).

## 5. Smoke-test procedure (model swap gate)

Run on any model/quant/engine change, in a throwaway dir (`~/tmp/hermes-smoke`):

1. **Multi-tool:** "Create fizz.py implementing fizzbuzz(n)…, test_fizz.py with 3 pytest
   cases, run tests, fix failures, git init + commit, show git log." Watch: malformed tool
   calls, thinking leaking into output/files, template errors in the LM Studio log,
   context complaints, **and where the files land** (workspace bug).
2. **Spec dialogue:** "Interview me briefly (max 3 questions, one at a time), then write a
   one-page design doc…" Watch: one-question discipline, coherent markdown, no leakage.

PASS → keep model. FAIL → load fallback in LM Studio, `hermes config set model.default …`,
re-run. Record outcome as a bd comment on the driving issue. (2026-08-21: Qwen3.8-27B
**PASSED**; `-z` workspace bug found and worked around.)

## 6. Known limits

- Manual model switching (LM Studio GUI for variant selection); acceptable at one agent
  at a time.
- Qwen3.8-27B is one week old — watch for MLX/template fixes in LM Studio updates.
- Escalation rule (from ADR 0029): 2 stalls on a slice or 2 same-cause CI reds → slice
  escalates to Claude; log as bd comment on `mezo-zjtm`.
- ripgrep not installed (no brew on PATH) — Hermes falls back to grep for file search.
