---
name: brainstorming
description: Use BEFORE designing or building anything new — turns an idea into an approved design spec through short dialogue. Never write code while this skill is active.
---

# Brainstorming → Design Spec

HARD RULE: no code, no file scaffolding, no implementation until the user approves a design.

1. Orient cheaply: the house-rules doc (AGENTS, repo root), docs/milestones/roadmap.md, the `### <feature>` block(s) in
   docs/CODEMAP.md the idea touches, and ONLY §1 + §9 of the matching docs/features/<x>.md
   (grep the headings, read with offset/limit). Budget: ≤ 8 tool calls before the first question.
2. If the idea touches existing code or a bug, your FIRST question asks for the concrete
   anchors you are missing: exact file paths, the error text, the expected vs actual behaviour.
   Never guess them.
3. Ask clarifying questions ONE AT A TIME (purpose, constraints, success criteria).
   Prefer multiple-choice. Stop asking when you can state the design.
4. Propose 2–3 approaches with trade-offs. Recommend one. Wait for the user's pick.
5. Present the design in short sections (goal, architecture, data flow, error handling,
   testing). Ask after each section if it is right.
6. On approval, write the spec to docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md
   (mirror the format of the newest file already in that directory), commit it.
7. Self-check the spec: no TBD/TODO, no contradictions, no ambiguity. Fix inline.
8. Ask the user to review the spec file. When approved, switch to the writing-plans skill.
