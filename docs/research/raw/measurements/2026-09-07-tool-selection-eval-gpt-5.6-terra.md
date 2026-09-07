---
title: "Tool-selection eval run — gpt-5.6-terra (42 HU cases)"
type: measurement
source_url: local measurement — ./mvnw test -Dtest=ToolSelectionEvalIT -Dmezo.excludedTestGroups= -Dmezo.test.use-testcontainers=true -Dmezo.eval.model=gpt-5.6-terra
ingested: 2026-09-07
sha256: 9ed51f7f9b392ece556e7b896755894280a28e82e12f4e1209c751986923af1d  # body below this frontmatter
---

<!-- RAW CAPTURE — immutable. Verbatim output of ToolSelectionEvalIT (mezo-ozri.3) with
     reasoning_effort=none on the tool path (the API rejects tools + effort on
     /v1/chat/completions). Do not edit content below; a re-run produces a new capture. -->
# Tool-selection eval — gpt-5.6-terra

| metrika | érték |
|---|---|
| cases | 42 |
| hit (bármely elfogadott tool) | 97.6% (41) |
| exact match | 95.2% (40) |
| critical wrong tool | 0 |
| JSON-érvényes turn | 100.0% |
| hibára futott eset | 0 |
| latency p50 / p95 | 4779 ms / 8092 ms |
| USD / sikeres akció p50 / p95 | $0.004670 / $0.015112 |
| teljes futás költsége | $0.228281 |

## Misses

- [ambiguous-log-plan-today-logged] "Mi volt eddig a mai edzésem?" — expected [get_training_log], got []

## Critical wrong tools

Zero critical wrong tools.
