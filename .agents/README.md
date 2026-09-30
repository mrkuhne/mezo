# Repo-local agent skills (`.agents/skills/`)

Shared repo-specific skills in agentskills.io format (one directory per skill with a
`SKILL.md` carrying `name`/`description` frontmatter). The repo is the source of truth.
Codex discovers these skills; Hermes discovers them after the one-time trust step below.
Never edit copies under `~/.hermes/`.

**One-time enablement per machine** (project skills are trust-gated):

```bash
hermes skills trust /Users/mrkuhne/Applications/Personal/Mezo/mezo
```

Verify with `hermes skills list` (the twelve mezo skills must appear as project skills).

- **Process skills** (superpowers ports, deliberately short and prescriptive):
  `brainstorming`, `writing-plans`, `executing-plans`, `fixing-bugs` (bug reports / small behaviour fixes: worktree → bd → failing test → minimal fix → PR), `tdd`, `verification-before-completion`.
- **Domain skills** (thin routers to `docs/references/`): `mezo-backend`, `mezo-frontend`,
  `mezo-api-contract`, `mezo-testing`, `mezo-deploy`.
- **Owner workflow:** `owner-visible-frontend` covers the three approvals, living prototype,
  acceptance evidence and live verification for visible frontend changes. The root house
  rules remain authoritative for git and session completion where older skills differ.

Skill changes are normal bd-tracked work. Wider context: `AGENTS.md` §Hermes Agent
Specifics and `docs/infrastructure/local-llm-hermes-lmstudio.md`.
