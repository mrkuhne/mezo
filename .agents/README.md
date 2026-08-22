# Repo-local agent skills (`.agents/skills/`)

Skills for the **Hermes agent** local-LLM workflow (agentskills.io format: one directory
per skill with a `SKILL.md` carrying `name`/`description` frontmatter). The repo is the
source of truth — Hermes discovers `./.agents/skills` natively; never edit copies under
`~/.hermes/`.

**One-time enablement per machine** (project skills are trust-gated):

```bash
hermes skills trust /Users/mrkuhne/Applications/Personal/Mezo/mezo
```

Verify with `hermes skills list` (the eleven mezo skills must appear as project skills).

- **Process skills** (superpowers ports, deliberately short and prescriptive):
  `brainstorming`, `writing-plans`, `executing-plans`, `fixing-bugs` (bug reports / small behaviour fixes: worktree → bd → failing test → minimal fix → PR), `tdd`, `verification-before-completion`.
- **Domain skills** (thin routers to `docs/references/`): `mezo-backend`, `mezo-frontend`,
  `mezo-api-contract`, `mezo-testing`, `mezo-deploy`.

Skill changes are normal bd-tracked work. Wider context: `AGENTS.md` §Hermes Agent
Specifics and `docs/infrastructure/local-llm-hermes-lmstudio.md`.
