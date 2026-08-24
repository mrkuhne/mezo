# --- mezo: refuse direct commits on main (house rule: feat/<topic> branch + self-PR + --no-ff merge) ---
# Installed by appending to .git/hooks/pre-commit (outside the beads-managed block).
# `git merge --no-ff` on main does NOT run pre-commit, so the merge flow is unaffected.
# Escape hatch for a deliberate exception: ALLOW_MAIN_COMMIT=1 git commit ...
_mezo_branch=$(git symbolic-ref --quiet --short HEAD 2>/dev/null)
if [ "$_mezo_branch" = "main" ] && [ -z "$ALLOW_MAIN_COMMIT" ]; then
  echo "✗ Direct commits on main are blocked. Create a worktree/branch first:" >&2
  echo "    git worktree add .worktrees/<topic> -b feat/<topic>   (Hermes: /worktree new <topic> or hermes -w)" >&2
  echo "  Deliberate exception: ALLOW_MAIN_COMMIT=1 git commit ..." >&2
  exit 1
fi
# --- end mezo guard ---
