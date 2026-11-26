# Beads (bd) — compact session prime

> Compact on purpose (mezo-hsc75): the default prime injected all ~145 persistent memories
> (~100 KB, re-read on every turn of every session). They are still there — **search them**.

## Memories — look before you touch an area
- `bd memories <keyword>` — search persistent memories (e.g. `bd memories liquibase`, `bd memories ios`,
  `bd memories deploy`, `bd memories notion`). Do this at the start of work on any area.
- `bd memories` — the full list with one-line summaries (~6k tokens); only when unsure what to search.
- `bd remember "insight"` / `bd remember --key <key> "new content"` — save or update. Never MEMORY.md files.

## Core rules
- bd for ALL task tracking (`bd create`, `bd ready`, `bd close`) — no TodoWrite/TaskCreate/markdown TODOs.
- Create the bd issue BEFORE writing code; claim it when starting.
- Git workflow, session completion and the docs/Notion duties: see `AGENTS.md` and `CLAUDE.md`.
- Never `bd edit` (opens an editor and blocks).

## Essential commands
- `bd ready` · `bd list --status=open|in_progress` · `bd show <id>` · `bd search <query>`
- `bd create --title="..." --description="why + what" --type=task|bug|feature --priority=0-4 [--parent=<id>] [--acceptance="..."]`
- `bd update <id> --claim` · `bd update <id> --notes/--acceptance/--design "..."` · `bd label add <id> <label>`
- `bd close <id1> <id2> ... [--reason="..."]` · `bd dep add <issue> <depends-on>` · `bd blocked`
- `bd dolt push` — push the tracker (part of session completion)
