#!/usr/bin/env bash
# One-time per-clone git setup (mezo-hnkd): defines the 'codemap-ours' merge driver that
# .gitattributes assigns to docs/CODEMAP.md — a merge keeps OUR side of the generated file
# instead of conflicting; regenerate afterwards (node scripts/gen-codemap.mjs) and CI's
# freshness gate guards the result. The config is repo-local and shared by every worktree.
set -euo pipefail
git config merge.codemap-ours.name "keep ours for generated files, then regenerate"
git config merge.codemap-ours.driver true
echo "✓ codemap-ours merge driver configured (docs/CODEMAP.md merges keep ours — regenerate after merging)"
