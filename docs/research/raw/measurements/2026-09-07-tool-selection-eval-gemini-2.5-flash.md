---
title: "Tool-selection eval run — gemini-2.5-flash (42 HU cases)"
type: measurement
source_url: local measurement — ./mvnw test -Dtest=ToolSelectionEvalIT -Dmezo.excludedTestGroups= -Dmezo.test.use-testcontainers=true
ingested: 2026-09-07
sha256: f6bb63e42c04f542fbd44bcd72bf0704f26898710f1d1328eace976d9967ee47  # body below this frontmatter
---

<!-- RAW CAPTURE — immutable. Verbatim output of ToolSelectionEvalIT (mezo-ozri.3), HEAD dbdd7f724.
     Do not edit content below; a re-run produces a new capture. -->
# Tool-selection eval — gemini-2.5-flash

| metrika | érték |
|---|---|
| cases | 42 |
| hit (bármely elfogadott tool) | 88.1% (37) |
| exact match | 88.1% (37) |
| critical wrong tool | 2 |
| JSON-érvényes turn | 97.6% |
| hibára futott eset | 1 |
| latency p50 / p95 | 2880 ms / 6268 ms |
| USD / sikeres akció p50 / p95 | $0.003342 / $0.005586 |
| teljes futás költsége | $0.142846 |

## Misses

- [recipes-1] "Mit rittyenthetnék össze úgy, hogy beleférjek a mai kalóriakeretembe?" — expected [get_recipes], got [get_fuel_log]
- [similar-1] "Szoktam ennyire padlón lenni edzés után, mint most éppen?" — expected [find_similar_past_days], got [get_insights]
- [ambiguous-log-plan-today-logged] "Mi volt eddig a mai edzésem?" — expected [get_training_log], got []
- [ambiguous-log-plan-today-planned] "Mi vár még ma a teremben?" — expected [get_training_plan], got []
- [ambiguous-goal-growth-genuine] "Hogy állok a céljaimmal mostanában?" — expected [get_goal, get_growth], got [get_life_goals]

## Critical wrong tools

- [similar-1] get_insights (domain insights) is outside [memory]
- [ambiguous-goal-growth-genuine] get_life_goals (domain lifegoal) is outside [goal, growth]
