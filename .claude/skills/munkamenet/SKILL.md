---
name: munkamenet
description: Session lifecycle for this repo — keeps every session to ONE task so context (and tokens) stay small, and leaves no stranded sessions behind. Three modes - kezdés (start a task in a fresh session with its bd issue, memories and Kész ha list), lezárás (finish - merge, push, Notion via a cheap worker, Hungarian report, archive the session or hand off), takarítás (weekly cleanup of finished / stranded sessions). Use when the owner starts a new piece of work ("csináljuk X-et", "kezdjük", "új feladat"), when a task is done or the session-length guard fires ("zárjuk le", "kész", "add át"), or when he asks to clean up sessions ("takarítás", "mi fut még", "rendet").
---

# Munkamenet — one task, one session (mezo-lwsig, after the token diet mezo-hsc75)

Why: every API call re-reads the whole conversation. Sessions that ran for days averaged ~220k tokens per call and
left ~25 stranded sessions behind. This skill is the flow that prevents both. Talk to the owner in Hungarian
business language (CLAUDE.md §Communication).

Pick the mode from the request: **kezdés** · **lezárás** · **takarítás**. The `session-length-guard` hook may tell you
to switch to **lezárás** mid-task — do that at the next safe point (tests green or work committed), never mid-edit.

## Kezdés — start one task

1. **Is this the right session?** If this session already finished a task, or it is long (guard fired, or you are past
   ~100 turns), do NOT start here: `start_session` (`initiation: "user_asked"`, `context: "fresh"`, worktree) with a
   self-contained brief — the owner's words, the bd id if known, the area — and tell him in one line where it runs.
2. **One bd issue.** Find (`bd search`, `bd ready`) or create the issue; claim it. Boop work goes under epic
   `mezo-r36n9` with its `_jegyek.json` row (edit the source now; the Notion push waits for lezárás).
3. **Memories, narrowly.** `bd memories <keyword>` for the 1–3 areas you will touch. No full list unless unsure.
4. **Kész, ha…** Write the done-checklist into the issue (`bd update <id> --acceptance "..."`), per CLAUDE.md.
5. Then the normal owner gates (brainstorm → spike → plan) or straight to work for a small fix.

Working rules while in the task: subagents on `model: "sonnet"` (most capable only for the final review / hard
design); read narrowly (`sed -n`, `grep`, `tail` on long output); no Notion MCP calls in the main session.

## Lezárás — finish, or hand off

**A. The work is done** (gates green):
1. Merge per CLAUDE.md §Git Workflow (rebase main → `--no-ff` merge → push → delete branch); deploy/install if the
   change needs it.
2. `bd close <id>`; file remaining work as new bd issues (minors under the epic).
3. Product changed → update the sources (`_jegyek.json`, `_kiadasok.json`, `_dontesek.json`, handbook page,
   `_funkciok.json`) and push Notion **once** through a sonnet worker (`boop-notion` skill §2); commit
   `_notion-state.json`.
4. `node scripts/check-beads-backup.mjs --fix` → commit; `git pull --rebase && bd dolt push && git push`.
5. Hungarian report: what he can now do, what was checked, what is not done.
6. **Archive this session**: `archive_session` with `session_id: "self"` — only after the report is written, and
   only if the owner did not ask to keep it open. Say so in the report's last line ("ezt a munkamenetet lezárom").

**B. The work is not done** (guard fired, or the task outgrew the session):
1. Commit and push the branch (never leave work only in the worktree).
2. Write the handoff into the bd issue (`bd update <id> --notes "..."`): branch name, what is done, what is next,
   traps found, exact commands to resume.
3. `start_session` (`context: "fresh"`, `use_worktree: true`, `source_branch` = this branch) whose brief is: "Continue
   bd <id> on branch <branch>; read `bd show <id>` notes first; finish with the munkamenet skill (lezárás)."
4. Tell the owner in one line where it continues, then archive this session (`"self"`).

## Takarítás — weekly cleanup (or on request)

1. `list_sessions` (limit 50) and, for each Mezo worktree, the unmerged work:
   ```bash
   git fetch -q origin && git worktree list --porcelain | awk '/^worktree/{w=$2}/^branch/{print w" "$2}' | \
     while read w b; do echo "$(basename $w) ${b#refs/heads/} unmerged=$(git rev-list --count origin/main..${b#refs/heads/}) dirty=$(git -C "$w" status --porcelain | grep -vc '^??')"; done
   ```
2. Sort every idle session into: **lezárható** (no unmerged commits, nothing dirty), **befejezendő** (unmerged work —
   near done → one message "fejezd be és zárd le a munkamenet skill szerint"; far from done or huge → continue in a
   fresh session from its branch), **vár rád** (waiting on an owner decision).
3. Show the owner one short Hungarian table (session · hol tart · javaslat) and ask once. On his yes, archive the
   lezárható ones. Never archive a coordinating session whose child still has unmerged work (archiving a parent
   takes its idle children with it). Sessions of other projects are not yours — leave them.
4. Report what was archived and what is left; verify the befejezendő branches still exist.
