---
name: writing-plans
description: Use when an approved design spec exists and implementation must be planned. Produces a bite-sized, checkboxed task plan in docs/superpowers/plans/.
---

# Writing Implementation Plans

Audience: an engineer with zero context. Every task must be executable without asking questions.

1. Read the spec fully. Read every file the spec names.
2. Map the file structure first: which files are created/modified, one responsibility each.
3. Break work into tasks. One task = one testable deliverable + its own commit.
4. Each task lists: Files (exact paths), Interfaces (exact names/signatures consumed and
   produced), then 2–5-minute checkbox steps: write failing test → run it (expect FAIL) →
   minimal implementation → run test (expect PASS) → commit (exact git command).
5. Include REAL code in steps, never "add validation" / "similar to Task N" / TBD.
6. Header must carry: Goal, Architecture (2–3 sentences), Global Constraints (exact
   values from the spec), spec link, driving bd id.
7. Save to docs/superpowers/plans/YYYY-MM-DD-<feature>.md, commit.
8. Self-check against the spec: every requirement maps to a task; types/names consistent
   across tasks. Fix inline, then offer execution.
