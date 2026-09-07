---
title: "Blind Hungarian tone A/B — 2 judges x 2 candidates (42 pairs each)"
type: measurement
source_url: local measurement — ./mvnw test -Dtest=ToneJudgeEvalIT -Dmezo.excludedTestGroups= -Dmezo.eval.model=<judge> -Dmezo.eval.baseline=… -Dmezo.eval.candidate=…
ingested: 2026-09-07
sha256: 4118fc719dff51f61cacab5fbc6d14acc92966a80ad47a814a17c76d774c7df0  # body below this frontmatter
---

<!-- RAW CAPTURE — immutable. Verdict tallies logged by ToneJudgeEvalIT (mezo-ozri.3). -->
# Blind Hungarian tone A/B — baseline gemini-2.5-flash

Each row: the same 42 questions' answers, sides seeded-swapped, judged on Hungarian language
quality and tone only (`ToneJudgeEvalIT`, seed 20260907). No ties were awarded by either judge.

| judge | candidate | candidate wins | baseline wins | tie | unparseable |
|---|---|---|---|---|---|
| gemini-2.5-pro | gpt-5.6-luna | 19 | 23 | 0 | 0 |
| gemini-2.5-pro | gpt-5.6-terra | 18 | 24 | 0 | 0 |
| gpt-5.6-terra | gpt-5.6-luna | 25 | 17 | 0 | 0 |
| gpt-5.6-terra | gpt-5.6-terra | 17 | 25 | 0 | 0 |

Neither judge shows a family self-preference: the OpenAI judge picks the Gemini baseline over
gpt-5.6-terra 25-17. The two judges disagree on Luna (45% vs 60% candidate wins), which is the
honest reading of a near-tie.
