---
name: writing-plans
description: Use when an approved design spec exists and implementation must be planned. Produces a bite-sized, checkboxed task plan in docs/superpowers/plans/.
---

# Writing Implementation Plans

Audience: an engineer with zero context. Every task must be executable without asking questions.

## Orientation budget (do this FIRST, stay inside it)

Target ≤ 12 tool calls and ≤ 40K tokens of reading before you write. Never read a whole
feature doc or a whole large file "to be safe".

1. Find the feature block in docs/CODEMAP.md — replace the placeholder with the real feature
   name, e.g. `grep -n "^### journal" docs/CODEMAP.md` (NOT the literal text `### <feature>`),
   then read ONLY that block (read_file with offset = that line, limit 40). It tells you every
   package, table, endpoint, hook, surface, test. FE surfaces of a domain may live under another
   feature block (e.g. journal UI under `me`).
2. The spec: only the sections the bd issue names.
3. The feature doc, e.g. docs/features/journal.md: `grep -n "^## " docs/features/journal.md`
   for the heading line numbers, then read ONLY §7 "How to extend it" and §10 "Key files"
   (read_file offset = the §7 line, limit = lines until the next heading). Never page through
   the whole doc.
4. The newest sibling plan in docs/superpowers/plans/ — skim its headings only (`grep -n "^#"`)
   to mirror the format.
5. Open a listed source file only when a task's code depends on its exact signatures; each
   file once; prefer `grep -n` for a signature over reading the file.
6. `bd show` the issue and every issue it depends on — an unmerged dependency becomes an
   explicit "deferred" section, never silent.

## Writing the plan

Decide, THEN write. Work out a decision in your reasoning, and write only the final decision
into the plan. Never leave "Actually…", "Wait —", "Let me reconsider", "Decision revised" or
competing options in the document; if you change your mind, rewrite the section. A plan with
two decisions in it is not executable.

1. Map the file structure first: which files are created/modified, one responsibility each.
2. Break work into tasks. One task = one testable deliverable + its own commit.
3. Each task lists: Files (exact paths), Interfaces (exact names/signatures consumed and
   produced), then 2–5-minute checkbox steps: write failing test → run it (expect FAIL) →
   minimal implementation → run test (expect PASS) → commit (exact git command).
4. Include REAL code in steps, never "add validation" / "similar to Task N" / TBD.
5. If a step would be >5 mechanical tool calls (bulk renames, many files), plan an
   `execute_code` script for it instead of hand steps.
6. Header must carry: Goal, Architecture (2–3 sentences), Global Constraints (exact
   values from the spec), spec link, driving bd id.
7. Save to docs/superpowers/plans/YYYY-MM-DD-<feature>.md — **in chunks**: first `write_file`
   with the header + Global Constraints + the task headings only, then append one task at a
   time with `patch` (each call ≤ ~150 lines). LM Studio buffers a tool call's arguments until
   the call is complete, so a single 1 000-line write is 15+ minutes of silence and trips the
   stream watchdog. Then commit.
8. Self-check against the spec: every requirement maps to a task; types/names consistent
   across tasks. Fix inline, then offer execution.
