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
5. Then the flow below, or straight to work for a small fix.

## The flow — superpowers inside the frame (mezo-dl3h3)

1. `superpowers:brainstorming` — step 1 = `brainstorm-recon`; no Visual Companion for Boop (visual iteration is the
   simulator's job).
2. Spec in `docs/superpowers/specs/` → owner OK.
3. Simulator spike → owner OK (only when something visible changes).
4. `superpowers:writing-plans` (with the *Kész, ha…* list) → owner OK. At its execution choice, recommend inline.
5. Execution: inline `superpowers:executing-plans` by default. `superpowers:subagent-driven-development` is opt-in,
   only for a large plan with clearly independent tasks — then every dispatch passes `model: "sonnet"`, no per-task
   reviewer agents unless the plan marks the task risky, and one final fresh-context review on the most capable model.
6. `superpowers:verification-before-completion` — tick every *Kész, ha…* item with evidence.
7. **Lezárás** (below). It replaces `superpowers:finishing-a-development-branch`: if that skill triggers, follow
   lezárás instead — no PR, no discard menu; local `--no-ff` merge per CLAUDE.md §Git Workflow.

Working rules while in the task: subagents on `model: "sonnet"` (most capable only for the final review / hard
design); read narrowly (`sed -n`, `grep`, `tail` on long output); no Notion MCP calls in the main session.

## Lezárás — finish, or hand off

Replaces `superpowers:finishing-a-development-branch` (no options menu, no PR, no discard).

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

## Feladattípusok — the playbook

`playbook.md` (next to this file, Hungarian) holds the per-type flow for Boop: §2 small change, §3 bug, §4 new
screen / UI, §5 long slice (B6/B7/B8-size: slice map, one step per session, handoff template), §6 server feature into
the app, §7 research / refactor, §8 scouting before building, §9 the UX/UI + performance bar, §10 token rules.
At kezdés, pick the type from its §1 table and read **only that section plus §9** (`sed -n` by heading).

**Scouting is mandatory** (playbook §8, `researcher` agent on sonnet, in the background) for: a new screen or
interaction, a new platform technique (widgets, notifications, Watch, HealthKit, background work), a bug that smells
like platform behaviour, and any performance work — not only inside brainstorming.
