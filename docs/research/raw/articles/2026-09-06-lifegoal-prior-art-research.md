---
title: "Life-goal system — prior art research report (agent web-research)"
type: article
source_url: agent-web-research (Claude subagent, sources cited inline)
ingested: 2026-09-06
sha256: 9fad498f3910a06770caaa720f4376c83aa8d87657af7ef6a261f8ed347331e4  # body below this frontmatter, pre-frontmatter capture
---

<!-- RAW SOURCE — immutable. Agent web-research report (Claude subagent, 2026-09-06),
     commissioned for the life-goal research-wiki ingest (mezo-iizd.13). The source list is
     the one named in docs/superpowers/specs/2026-09-02-lifegoal-system-design.md §2.
     Do not edit content below. -->

# Life-goal system — prior art research report (2026-09-06)

## 1. Goal-modelling products

### Strides
- **What it is:** A personal goal/habit-tracking app (iOS/Android) with a documented help/FAQ site.
- **Mechanism:** The app help documentation describes four tracker archetypes: **Target** and **Average** trackers (numeric entry, e.g. "log a number"), **Habit** trackers (binary yes/no; tapping the checkbox logs "No," swiping left logs "Yes"), and **Milestone** trackers (support attaching notes on each log). A "Bad Habit" variant of the habit tracker inverts the visual convention — its progress bar starts 100% full and green and *shrinks* as the user logs occurrences, with the limit shown in red instead of green. Scheduling is handled via a "Due" setting that supports arbitrary frequencies ("every X days, weeks, months") and specific weekday selection, with skipped/non-applicable days excluded from "perfect day" streak calculations. A "Pace" system computes an expected progress rate from the goal's start/end dates and target value, used to flag whether the user is ahead of or behind schedule.
- **Exact numbers stated:** None beyond the qualitative frequency mechanics above; no specific day-window or streak-length constants are given in the FAQ text itself.
- Source: https://www.stridesapp.com/help/
- Source states it directly (goal-type taxonomy and Due/Pace mechanics are explicit in the FAQ); the "no streak-goal detail" gap is my inference from the absence of text, not a claim in the source.

### Exist.io
- **What it is:** A personal-analytics service that ingests data from many trackers/services (sleep, activity, mood, weather, etc.) and surfaces correlations and insights — explicitly **without a first-class "Goal" object type**.
- **Mechanism:** The core data model (per the API reference) consists of **Attributes** (one value per day, per metric, grouped by category) and derived **Correlations** (a −1..+1 relationship measure between two attributes, computed weekly, with an attached p-value, presented to users as correlation not causation). Instead of user-set target goals, Exist computes weekly **Averages** — described in the API docs as technically **medians** — over the **last 60 days** of data, broken down by day-of-week, and states this "is the basis of our goal system": a day's value is judged against the user's own recent typical (median) behavior for that weekday rather than against an externally set target. The correlation-discovery article explains that Exist first checks same-day correlations between two attributes, and if none is found, checks whether attribute A on day N correlates with attribute B on day N+1 (e.g., "does drinking alcohol tonight affect tomorrow's sleep quality"), i.e. a lag-1 cross-day search. The correlation article contains no further detail on how the median baseline itself is computed or smoothed (e.g. no confirmation of a rolling-window recompute cadence beyond "generated weekly").
- **Exact numbers stated:** 60-day lookback window for Averages; weekly recomputation cadence for both Averages and Correlations; correlation range −1 to +1 with p-values.
- Source: https://developer.exist.io/reference/object_types/ and https://kb.exist.io/article/55-will-exist-find-correlations-across-multiple-days
- Both the "no goal object, medians-as-goals" claim and the 60-day/weekly cadence are stated directly in the object-types reference. The lag-1 (day N vs. day N+1) mechanism is stated directly in the correlations KB article; whether it extends beyond a single day of lag is not stated (their own examples only ever discuss "today vs. tomorrow").

### Apple Fitness/Activity Trends
- **What it is:** A feature of Apple's Fitness/Activity app (introduced iOS 13) that surfaces per-metric up/flat/down trend arrows.
- **Mechanism:** Per the macstories.net writeup, Trends compares a user's **90-day average** against their **365-day (one-year) average** for the same metric, and shows a simple up/down arrow depending on whether the recent (90-day) window is better or worse than the long-run (yearly) baseline. Metrics trending favorably are surfaced under a "Keep it Going" heading; metrics trending unfavorably are surfaced under "Worth a Look." The feature requires **six months of accumulated regular data** for a given metric (the article's specific example is Stand Minutes) before Trends will begin recommending goals off of it. The author also reports the arrows are sensitive to single days: hitting a goal on one day could flip an arrow upward even after a longer decline, and a single subsequent missed workout could flip it back down — implying (the author's own inference, not an Apple-documented mechanic) that the underlying rolling averages recompute daily with limited smoothing.
- **Exact numbers stated:** 90-day short window vs. 365-day long window; 6-month minimum history requirement before recommendations begin.
- Source: https://www.macstories.net/stories/activity-trends-in-ios-13/
- The 90-day/365-day comparison and 6-month minimum are stated directly by the article (quoting or paraphrasing Apple's own framing at the WWDC/feature-launch level as understood by the author); the "single-day volatility" observation and its implied nightly recompute are explicitly the author's own empirical observation/inference, and the article itself notes Apple does not publish the exact calculation.

### WHOOP Journal
- **What it is:** WHOOP's in-app "Journal"/"Behaviors" feature, which lets users log daily lifestyle tags (100+ available) and correlates them against WHOOP's own Recovery score.
- **Mechanism:** Per the5krunner's writeup, the feature works by comparing days where a given behavior/tag was logged ("yes days") against days where it wasn't ("no days"), and reporting how the user's Recovery score differs between the two conditions — framed as "quantifying" the impact of behaviors like alcohol or late caffeine on recovery. WHOOP requires a minimum of **5 logged responses per tag** before it will surface any feedback for that tag. The article's practical advice (from the author, not WHOOP documentation) is to track only 5–10 tags at a time, since daily-logging motivation tends to drop off after about a week.
- **Exact numbers stated:** Minimum 5 responses per tag before feedback is shown; "100+" available tag types. No statistical method (e.g. t-test, effect size) is disclosed by WHOOP per this source — the article explicitly notes "no specific mathematical formulas or statistical significance tests are detailed."
- Source: https://the5krunner.com/2023/04/15/whoop-new-recovery-behaviours/
- The 5-response minimum and the yes-day/no-day comparison framing are stated directly (the author appears to be describing WHOOP's own in-app copy); the 5–10 tag recommendation and the "motivation wanes after a week" claim are the author's own advice/inference, not attributed to WHOOP.

## 2. Wellbeing / goal taxonomies

### PERMA-Profiler
- **What it is:** Butler & Kern (2016), "The PERMA-Profiler: A brief multidimensional measure of flourishing," *International Journal of Wellbeing*, 6(3), 1–48 — a validated self-report wellbeing questionnaire operationalizing Seligman's PERMA model.
- **The five factors:** **P**ositive emotion, **E**ngagement, **R**elationships, **M**eaning, **A**ccomplishment.
- **Instrument structure:** A **23-item** measure: 15 core items (3 per PERMA domain) plus 8 filler items assessing overall wellbeing, negative emotion, loneliness, and physical health.
- **Validation numbers (as reported in the paper, per search-result summaries of the primary text):** Development/refinement across three initial studies totaling **N = 7,188**, followed by eight further validation studies totaling **N = 31,966**, reporting acceptable model fit and internal/cross-time consistency plus convergent and divergent validity for the 5-factor structure. I was not able to extract the exact Cronbach's alpha or CFA fit-index values (CFI/RMSEA) directly from the primary PDF text — WebFetch could only read the PDF's binary/stream layer, not its rendered text, on two attempts (peggykern.org PDF and internationaljournalofwellbeing.org PDF).
- Source: https://www.peggykern.org/uploads/5/6/6/7/56678211/the_perma-profiler_101416.pdf (unreadable as text) and https://internationaljournalofwellbeing.org/index.php/ijow/article/download/526/579/2749 (unreadable as text); factor names, item count, and N figures corroborated via WebSearch summaries citing the same paper (e.g. ResearchGate/Semantic Scholar listings).
- **Labeled as secondary for the N figures and item count** (I could not directly read alpha/fit-index numbers from the primary PDF itself; the 23-item/5-factor/N=7,188+31,966 figures come from search-engine-surfaced summaries of the primary paper, not from text I directly read in the PDF).

### Gallup Wellbeing 5
- **What it is:** Gallup's "Five Essential Elements of Wellbeing" model (Rath & Harter, *Wellbeing: The Five Essential Elements*, 2010; restated on Gallup's workplace site).
- **The five elements:** Career (liking what you do daily), Social (meaningful relationships), Financial (managing your economic life well), Physical (health and energy), Community (liking where you live / engagement with locality).
- **Methodology/scale claim:** Derived from a Gallup study spanning **150+ countries**, described as reaching **over 98% of the world's population**. A headline statistic: **66%** of people are doing well in at least one of the five elements, but only **7%** are thriving in all five simultaneously.
- Source: https://www.gallup.com/workplace/237020/five-essential-elements.aspx
- Directly stated by the source, including the 150-country/98%-of-population and 66%/7% figures.
- **Why rejected as a taxonomy for mezo:** This is a proprietary, licensed vendor construct (Gallup sells assessments and consulting built on it) aimed at population-level workplace/public-health benchmarking, not at an individual fitness-app's day-to-day goal model. Its "Community" and "Financial" dimensions are out of scope for a fitness/training app, and its evidence base is about correlational population wellbeing, not about mechanics for setting or tracking a personal goal.

### Ryff psychological wellbeing
- **What it is:** Carol Ryff's Scales of Psychological Well-Being (1989), a long-standing academic measure of *eudaimonic* wellbeing (as distinct from PERMA's more hedonic/mixed emphasis).
- **The six dimensions:** Autonomy, Environmental Mastery, Personal Growth, Positive Relations with Others, Purpose in Life, Self-Acceptance.
- **Instrument structure:** Available in **84-item** (long), **42-item** (medium), and **18-item** (short) forms, all point Likert-scale format; reported internal-consistency reliabilities in the range **α ≈ .86–.93** across versions/subscales (per positivepsychology.com's summary of the literature).
- Source: https://positivepsychology.com/ryff-scale-psychological-wellbeing/
- Directly stated by this secondary/practitioner source summarizing the peer-reviewed literature — I did not reach Ryff's own 1989 primary paper; this should be treated as a **secondary summary**, not the primary record.
- **Why rejected as a taxonomy for mezo:** It is an abstract, clinically/academically oriented psychological-flourishing model with no built-in mechanism for turning any of its six dimensions into a trackable, quantifiable app goal (e.g., "Purpose in Life" or "Autonomy" have no natural numeric proxy the way "steps" or "1RM" do). It was designed and validated as a research/clinical assessment instrument, not as an end-user goal-setting framework.

## 3. Goal-science evidence

### Goal conflict (Gorges & Grund 2017)
- **Citation:** Gorges, J., & Grund, A. (2017). Aiming at Multiple Goals in Life: An Integrative Approach on Intraindividual Goal Conflict, Goal Facilitation, and Goal Progress. Referenced/hosted at PMC5696770.
- **What it actually is:** This is **not an empirical study with its own effect sizes** — it is a **theoretical/narrative review**. The authors surveyed the literature (systematically screening 161 candidate articles published 1985–2015, narrowing to **35 peer-reviewed studies** meeting inclusion criteria for intraindividual goal conflict between personal goals) and synthesized definitions and methodological approaches; it does **not** report a pooled/meta-analytic effect size or correlation.
- **Definition used:** Goal conflict = "a goal that a person wishes to accomplish interferes with the attainment of at least one other goal that the individual simultaneously wishes to accomplish" (quoting Emmons et al., 1993). The authors distinguish **resource-based conflict** (competing for finite time/energy/money) from **inherent conflict** (goals whose attainment strategies or end-states are logically incompatible).
- **Conclusion:** The field needs to integrate a "structure-like" perspective (goal hierarchies/systems) with a "process-like" perspective (action phases from intention-formation to goal disengagement), and future studies must carefully distinguish "action-relevant" from "non-action-relevant" conflicts to produce comparable results.
- Source: https://pmc.ncbi.nlm.nih.gov/articles/PMC5696770/
- Directly read from the primary text (full text reachable).
- **Fit for mezo:** Useful as a conceptual warning (a life-goal system that lets users set many simultaneous goals should anticipate resource conflicts between them, e.g. a strength goal and a fat-loss goal competing for the same caloric/recovery budget), but it supplies no quantitative parameter to design against — only a taxonomy of conflict types.

### Progress monitoring (Harkin et al. 2016)
- **Citation:** Harkin, B., Webb, T. L., Chang, B. P. I., Prestwich, A., Conner, M., Kellar, I., Benn, Y., & Sheeran, P. (2016). Does monitoring goal progress promote goal attainment? A meta-analysis of the experimental evidence. *Psychological Bulletin*, 142(2), 198–229. (Advance online publication Oct 19, 2015; the 2016 print citation is the one specified in the task.)
- **Scale:** **138 studies**, **N = 19,951** participants, all randomized experiments comparing a progress-monitoring intervention against a no/less-monitoring control, mostly on personal health goals (weight loss, smoking cessation, diet, blood pressure).
- **Effect sizes:** The monitoring interventions increased the *frequency of monitoring* itself with **d+ = 1.98** (95% CI [1.71, 2.24]), and this increased monitoring in turn promoted **goal attainment** with **d+ = 0.40** (95% CI [0.32, 0.48]).
- **Moderator finding (the public/recorded effect):** Moderator analyses found the effect on goal attainment was **larger when progress was physically recorded and/or reported to or made visible to another person** — i.e. writing progress down and/or making it public each independently strengthen the monitoring → attainment link, relative to purely private, unrecorded self-monitoring.
- Source: https://www.apa.org/pubs/journals/releases/bul-bul0000025.pdf (APA press-release PDF, unreadable as text via WebFetch — binary/stream only) and https://pubmed.ncbi.nlm.nih.gov/26479070/ (abstract page blocked by cookie wall). Numbers above were obtained via WebSearch summaries that quote the paper's own abstract/press coverage (EurekAlert press release quoting the authors, and secondary blog coverage).
- **Labeled as secondary**: I was unable to directly read the primary Psychological Bulletin text or its PDF; the k=138/N=19,951/d=1.98/d=0.40 figures and the public/recorded moderator finding come from search-engine-surfaced secondary sources (EurekAlert press release, Silicon Canals summary) that themselves attribute these exact numbers to the paper's abstract.
- **Fit for mezo:** This is the strongest, most directly actionable evidence in this report — it specifically supports building visible, shareable, or otherwise "recorded" progress displays (not just private numeric logs) as a mechanism to raise goal-attainment rates, with a credible, large-sample effect size behind it.

### Implementation intentions (Gollwitzer & Sheeran 2006)
- **Citation:** Gollwitzer, P. M., & Sheeran, P. (2006). Implementation intentions and goal achievement: A meta-analysis of effects and processes. *Advances in Experimental Social Psychology*, 38, 69–119.
- **Scale and effect size:** **94 independent tests**, more than **8,000 participants** total, pooled effect on goal attainment of **Cohen's d = 0.65** (medium-to-large).
- **Mechanism:** Implementation intentions are specific "if-then" plans (e.g., "if situation X arises, then I will perform response Y") formed in service of a goal intention; the meta-analysis finds they reliably outperform mere goal intentions (e.g., "I want to achieve X") at translating intention into actual behavior/outcome.
- Source: https://www.sciencedirect.com/science/chapter/bookseries/abs/pii/S0065260106380021 (primary chapter record, not fetched directly due to paywall/403) — figures corroborated via multiple independent secondary listings (ResearchGate, Semantic Scholar, KOPS/University of Konstanz repository record) that consistently cite the same k=94/N>8,000/d=0.65 figures.
- **Labeled as secondary** for the exact numbers (the primary chapter itself was not directly readable; WebFetch attempts to reach the underlying PDF/abstract returned 403 errors). The d=0.65/k=94/N>8,000 figures are corroborated across several independent secondary sources citing the same primary paper, which increases confidence they are accurate, but they were not verified against the primary text directly.
- **Fit for mezo:** Directly applicable to any "commit to a goal" flow — pairing a goal with a concrete if-then plan (e.g., "if it's Monday after work, then I do leg day") is one of the best-evidenced low-cost interventions in the behavior-change literature, independent of any tracking/monitoring UI.

### SDT goal contents (Niemiec, Ryan & Deci 2009)
- **Citation:** Niemiec, C. P., Ryan, R. M., & Deci, E. L. (2009). The path taken: Consequences of attaining intrinsic and extrinsic aspirations in post-college life. *Journal of Research in Personality*, 43(3), 291–306.
- **Sample and design:** **N = 147** post-college participants retained (from an initial pool of 246, ~90% one-year retention at that N figure per the source), followed longitudinally roughly 1–2 years post-college graduation; predominantly Caucasian (79.9%) students from private northeastern/midwestern US universities.
- **Key statistics (directly stated in the text as read via PMC):**
  - Intrinsic aspiration attainment (e.g. personal growth, relationships, community, health) positively predicted wellbeing (β = .77, p < .01) and negatively predicted ill-being (β = −.66, p < .01).
  - Extrinsic aspiration attainment (e.g. wealth, fame, image) was unrelated to wellbeing (β = .00, ns) but positively related to ill-being (β = .38, p < .01).
  - Longitudinal (change-score) analyses showed the same pattern: change in intrinsic attainment predicted change in wellbeing (β = .63) and ill-being (β = −.59); change in extrinsic attainment showed no comparable relationship.
  - Mediation: change in basic psychological need satisfaction (autonomy/competence/relatedness) mediated the intrinsic-attainment-to-wellbeing link, reducing the direct effect from β = .63 to β = .16 (p < .01) once the mediator was entered.
- Source: https://pmc.ncbi.nlm.nih.gov/articles/PMC2736104/
- Directly read from the primary full text (PMC copy reachable and readable, unlike the PDF at selfdeterminationtheory.org which returned only binary stream data).
- **Fit for mezo:** Strong, primary-source evidence that a life-goal system should weight and frame goals by their *content* (intrinsic: mastery/health/relationships vs. extrinsic: appearance/status/external validation), since attaining extrinsic-type goals shows no wellbeing benefit and actively predicts more ill-being, while intrinsic-type goal attainment predicts both higher wellbeing and lower ill-being.

## 4. Rejected patterns

### Gyroscope single "life score"
- **What it is:** Gyroscope Health's "Health Score" (marketed at various points as a "Life Score"), a single number (e.g., "82") updated on roughly a weekly cadence, aggregating sleep, heart metrics (resting HR, HRV, blood pressure), activity/steps, nutrition, body composition, workout performance, blood/glucose markers, and mood/stress/meditation into one composite figure, explicitly marketed as "the most important number in your life" — positioned by the vendor as more important than a bank balance, credit score, or step count.
- Source: https://gyrosco.pe/
- Directly stated by the source (the vendor's own marketing copy and feature description).
- **Why rejected as a pattern:** A single opaque composite score obscures which underlying behavior actually moved the number, defeating the "implementation intentions" and "visible/recorded progress" mechanisms above — a user cannot form an if-then plan or track a specific recorded metric against a black-box blend of a dozen inputs with vendor-proprietary weighting. It trades interpretability and actionability for a marketing-friendly single KPI, which is the opposite of what the evidence base (Harkin et al.'s emphasis on *specific*, recorded progress; Niemiec et al.'s emphasis on goal *content*) supports.

## 5. Source table

| # | Source | URL | Reached? (full / abstract only / unreachable) |
|---|--------|-----|------------------------------------------------|
| 1 | Strides — help/FAQ | https://www.stridesapp.com/help/ | Full |
| 2a | Exist.io — object types reference | https://developer.exist.io/reference/object_types/ | Full |
| 2b | Exist.io — cross-day correlations KB | https://kb.exist.io/article/55-will-exist-find-correlations-across-multiple-days | Full |
| 3 | Apple Fitness Trends — MacStories iOS 13 writeup | https://www.macstories.net/stories/activity-trends-in-ios-13/ | Full |
| 4 | WHOOP recovery behaviours — the5krunner | https://the5krunner.com/2023/04/15/whoop-new-recovery-behaviours/ | Full |
| 5 | Gorges & Grund 2017 — goal conflict review | https://pmc.ncbi.nlm.nih.gov/articles/PMC5696770/ | Full |
| 6a | Butler & Kern 2016 — PERMA-Profiler (author PDF) | https://www.peggykern.org/uploads/5/6/6/7/56678211/the_perma-profiler_101416.pdf | Unreachable (PDF binary/stream unreadable) |
| 6b | Butler & Kern 2016 — PERMA-Profiler (journal PDF) | https://internationaljournalofwellbeing.org/index.php/ijow/article/download/526/579/2749 | Unreachable (PDF binary/stream unreadable) — item count/factor names/N corroborated via secondary search summaries only |
| 7a | Niemiec, Ryan & Deci 2009 — self-hosted PDF | https://selfdeterminationtheory.org/SDT/documents/2009_Niemiec%20RyanDeci_JRP.pdf | Unreachable (PDF binary/stream unreadable) |
| 7b | Niemiec, Ryan & Deci 2009 — PMC full text | https://pmc.ncbi.nlm.nih.gov/articles/PMC2736104/ | Full |
| 8a | Harkin et al. 2016 — APA press-release PDF | https://www.apa.org/pubs/journals/releases/bul-bul0000025.pdf | Unreachable (PDF binary/stream unreadable) |
| 8b | Harkin et al. 2016 — PubMed abstract | https://pubmed.ncbi.nlm.nih.gov/26479070/ | Unreachable (cookie wall) — key numbers (k=138, N=19,951, d=1.98, d=0.40, public/recorded moderator) obtained via secondary sources (EurekAlert release, Silicon Canals) quoting the abstract |
| 9 | Gollwitzer & Sheeran 2006 — ScienceDirect chapter | https://www.sciencedirect.com/science/chapter/bookseries/abs/pii/S0065260106380021 | Unreachable (403) — figures (k=94, N>8,000, d=0.65) corroborated across multiple independent secondary listings |
| 10a | Gallup — Five Essential Elements | https://www.gallup.com/workplace/237020/five-essential-elements.aspx | Full |
| 10b | Ryff Scales — positivepsychology.com summary | https://positivepsychology.com/ryff-scale-psychological-wellbeing/ | Full (secondary summary, not Ryff's 1989 primary paper) |
| 11 | Gyroscope — Life & Health Tracking | https://gyrosco.pe/ | Full |
