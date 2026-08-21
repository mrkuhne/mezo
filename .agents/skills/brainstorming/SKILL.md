---
name: brainstorming
description: Use BEFORE designing or building anything new — turns an idea into an approved design spec through short dialogue. Never write code while this skill is active.
---

# Brainstorming → Design Spec

HARD RULE: no code, no file scaffolding, no implementation until the user approves a design.

1. Read the project context first: AGENTS.md, docs/milestones/roadmap.md, and any
   docs/features/<domain>.md the idea touches.
2. Ask clarifying questions ONE AT A TIME (purpose, constraints, success criteria).
   Prefer multiple-choice. Stop asking when you can state the design.
3. Propose 2–3 approaches with trade-offs. Recommend one. Wait for the user's pick.
4. Present the design in short sections (goal, architecture, data flow, error handling,
   testing). Ask after each section if it is right.
5. On approval, write the spec to docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md
   (mirror the format of the newest file already in that directory), commit it.
6. Self-check the spec: no TBD/TODO, no contradictions, no ambiguity. Fix inline.
7. Ask the user to review the spec file. When approved, switch to the writing-plans skill.
