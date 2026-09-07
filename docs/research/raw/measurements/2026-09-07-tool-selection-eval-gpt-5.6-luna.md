---
title: "Tool-selection eval run — gpt-5.6-luna (42 HU cases)"
type: measurement
source_url: local measurement — ./mvnw test -Dtest=ToolSelectionEvalIT -Dmezo.excludedTestGroups= -Dmezo.test.use-testcontainers=true -Dmezo.eval.model=gpt-5.6-luna
ingested: 2026-09-07
sha256: 8f6024dbd0f3d2e34e4eaf3fbcfbea9ebcd20adcde91a8793f77d3edb6ae9edb  # body below this frontmatter
---

<!-- RAW CAPTURE — immutable. Verbatim output of ToolSelectionEvalIT (mezo-ozri.3) with
     reasoning_effort=none on the tool path (the API rejects tools + effort on
     /v1/chat/completions). Do not edit content below; a re-run produces a new capture. -->
# Tool-selection eval — gpt-5.6-luna

| metrika | érték |
|---|---|
| cases | 42 |
| hit (bármely elfogadott tool) | 92.9% (39) |
| exact match | 90.5% (38) |
| critical wrong tool | 4 |
| JSON-érvényes turn | 100.0% |
| hibára futott eset | 0 |
| latency p50 / p95 | 4090 ms / 5591 ms |
| USD / sikeres akció p50 / p95 | $0.000465 / $0.000699 |
| teljes futás költsége | $0.022220 |

## Misses

- [similar-1] "Szoktam ennyire padlón lenni edzés után, mint most éppen?" — expected [find_similar_past_days], got [get_insights]
- [similar-2] "Fordult már elő velem, hogy ennyire pörgött bennem a stressz, mint most?" — expected [find_similar_past_days], got [get_insights]
- [ambiguous-goal-growth-genuine] "Hogy állok a céljaimmal mostanában?" — expected [get_goal, get_growth], got [get_life_goals]

## Critical wrong tools

- [goal-1] get_weight_trend (domain biometrics) is outside [goal]
- [similar-1] get_insights (domain insights) is outside [memory]
- [similar-2] get_insights (domain insights) is outside [memory]
- [ambiguous-goal-growth-genuine] get_life_goals (domain lifegoal) is outside [goal, growth]
