# Companion Tool Conventions

> Every companion read tool lives under `feature/companion/tools/` (`TrainTools`, `BiometricsTools`,
> `FuelTools`, `GoalTools`, `MedicationTools`, `MemoryTools`, `GrowthTools`, `PracticeTools`,
> `InsightsTools`) and is wired ONCE, in `CompanionToolRegistry` — the ArchUnit rule
> `companion_tools_are_internal_sphere_only` guards that every tool only reads our own features.
> This doc codifies the `@Tool(description = …)` house rule every one of those already follows;
> read it before adding or editing a `@Tool`. The system prompt's `[Eszköz-útmutató]` routing hint
> (`ChatService.SYSTEM_PROMPT`) is the model-facing mirror of this rule — keep both in sync when a
> tool is added, renamed, or gets a new `scope`.

## Why this matters

With ~15 tools registered on every turn, tool SELECTION is the bottleneck, not tool
implementation — a vague or overlapping description makes the model guess wrong (call nothing,
call the wrong tool, or call the right tool with a made-up scope). The description is the ONLY
signal the model has; it must do the routing work a docstring usually doesn't have to.

## The rule

Every `@Tool` description MUST have all four of the following, in this order:

1. **One-sentence responsibility, narrow.** What this tool covers and nothing else. If two tools
   could plausibly answer the same question, the descriptions must make the boundary explicit
   (e.g. `get_training_log` = PAST sessions vs. `get_training_plan` = SCHEDULED ahead — both
   descriptions say so in caps).
2. **Enumerated `scope`/param values**, each with what it returns and its default. Never "various
   views" — spell out every accepted value (`scope=sleep (alapértelmezés), sleep-goal, checkins`).
   A model cannot invoke a scope it was never told exists.
3. **An explicit `Használd, amikor …` trigger clause.** Name the question shapes that should
   fire this tool, in the user's own words/register where possible ("PR-ról, rekordról, 'meg
   tudom-e dönteni'"). This clause is what the routing hint in the system prompt distills further
   — the two must agree.
4. **Describe ONLY what is actually rendered — no overclaim.** If a `scope` is declared but not
   yet implemented, say so in the description itself (don't just omit it and hope). If a value
   (e.g. carbs/fat) is deliberately excluded from a summary tool, state the exclusion rather than
   staying silent — silence reads as "ask me and I'll have it."

## GOOD example

Real code, `MedicationTools.java` — all four rules present, tight and unambiguous:

```java
@Tool(name = "get_medication", description = "Gyógyszer: retatrutid-ciklus vagy általános "
        + "gyógyszer-áttekintés. scope=reta (alapértelmezés) — az aktív gyógyszer retatrutid-ciklusállása: "
        + "hányadik nap, fázis, utolsó dózis, következő esedékes nap, utolsó dózisok. scope=all — az "
        + "aktív gyógyszer általános adatai: név, hatóanyag, adagolási rend, alapdózis, ciklusállás "
        + "(ha van már rögzített dózis), utolsó dózisok. Használd, amikor a user a gyógyszeréről / a "
        + "retatrutid-ciklusáról kérdez. scope: reta (alapértelmezés), all.")
```

Another real example worth studying, `InsightsTools.java` — because it shows rule 4 (no
overclaim) handling a PARTIALLY implemented tool: the description names the deferred scopes
explicitly instead of quietly omitting them, so the model never routes a "mit jósolsz" question
into a tool that can't answer it yet:

```java
@Tool(name = "get_insights", description = "Amit a rendszer ÉSZREVETT rólad. Használd, amikor a "
        + "user azt kérdezi 'mit vettél észre rólam', mik a mintáim/összefüggéseim, vagy mit "
        + "jósolsz. scope=patterns (alapértelmezés, jelenleg az egyetlen élő scope) — a "
        + "MEGERŐSÍTETT statisztikai/AI minták listája: cím, mechanizmus (irány/erősség, ha "
        + "van), bizonyíték (r/n/p, ha van). scope=predictions és scope=experiments még nem "
        + "elérhetők ezen a tool-on. scope: patterns (alapértelmezés), predictions, experiments.")
```

## BAD example

A description that would compile and register fine, but breaks all four rules:

```java
// DON'T — vague scope, no trigger clause, and it overclaims a field the tool doesn't return.
@Tool(name = "get_meds", description = "Gyógyszeradatok lekérése különböző nézetekben, "
        + "beleértve a mellékhatásokat is.")
public String getMeds(@ToolParam(required = false) String view, ToolContext ctx) { ... }
```

What's wrong, line by line:

- **No enumerated values** — `"különböző nézetekben"` never says what `view` accepts, so the
  model cannot pass a valid one (rule 2).
  **No trigger clause** — nothing tells the model WHEN to reach for this over another tool
  (rule 3).
- **Overclaim** — `"beleértve a mellékhatásokat is"` promises side-effect data the method never
  returns (rule 4); the first time a user asks about side effects the model will call this tool,
  get nothing useful, and either hallucinate or dead-end.
- The name (`get_meds`) also drifts from the registered tool name convention (`get_<noun>`,
  matched 1:1 to the domain word used in the trigger clause) — pick the name a Hungarian question
  would map to, not an abbreviation.

## Where this is enforced / how to add a tool

- New tool → new `@Tool` method in the matching `feature/companion/tools/*Tools.java` class →
  registered in `CompanionToolRegistry.callbacks()` (the only assembly point) → every call is
  wrapped in `RecordingToolCallback` for the per-turn audit + budget
  (`mezo.companion.tools.max-calls-per-turn`), never bypassable.
- `@ToolParam(required = false, description = …)` on every optional parameter needs the same
  enumerated-values treatment as the top-level description (see `scope`/`kind`/`range` params
  above).
- After adding or changing a tool, add or update its line in the `[Eszköz-útmutató]` block in
  `ChatService.SYSTEM_PROMPT` — that block is the terse, model-facing summary of exactly the same
  routing decision this doc governs at the description level. Keep the two consistent; a tool
  documented here but missing from the routing hint is half-shipped.
