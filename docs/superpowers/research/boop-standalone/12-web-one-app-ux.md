# 12 — One app, one spine: how to make Boop feel like ONE AI app (web research)

Issue `mezo-r36n9.9` · 2026-11-10 · research only · sources are web pages fetched/searched on 2026-11-10.
Vendor claims are marked as such; where a source could not be verified it says so.

## TL;DR (10 lines)

1. The market is converging on **one "Today" surface + a few depth tabs + an AI that lives *inside* the surfaces**, not beside them: Oura's 2025 redesign is Today / Vitals / My Health with "One Big Thing" on Today; Whoop moved from swipe-tabs to one dense scrollable home with Coach pinned in the tab bar.
2. **Chat-only fails; chat-as-fallback works.** Whoop's 2023 Coach was "tacked on" as a text box; Whoop then shipped Daily Outlook / Day in Review (AI-written cards) and made Coach contextual per screen. Wattenberger and Pike argue the same in general.
3. The spine that ties domains together is **time, not data type**: a daily loop (morning plan → live adjust → evening close) like Sunsama's planning/shutdown ritual, Whoop's Outlook → Day in Review, Rosebud/Stoic morning intention → evening reflection.
4. **Plan-as-context** is the strongest cross-domain glue: Runna/Humango re-flow plans when life happens; Rise turns sleep debt into an hour-by-hour energy curve; Visible budgets energy in units. Boop's "units needed vs capacity" (core #7) is exactly this pattern.
5. **One headline + few dials beats many scores.** Oura uses one score at a time; Whoop has three dials; Welltory's 22 HRV metrics are the cautionary tale.
6. **Show the "why" as a causal chain** (sleep → recovery → today's load). Bevel is praised for exactly this; vague AI advice is the #1 complaint about AI coaches.
7. **Logging cost decides whether the loop survives**: MacroFactor counts taps (FLSI) and optimises repeat foods, photo + text, barcode; Workout logging belongs on the watch (Future, Workout Buddy).
8. iOS gives the spine outside the app: **Live Activity = "today is in progress"**, widgets/Smart Stack with RelevanceKit, Controls, App Intents for Siri/Spotlight/snippets, Focus filters.
9. Anti-patterns: feature sprawl (Motion), dashboard overload (Welltory), opaque adaptation (Runna doesn't explain changes), daily rituals that become chores (Sunsama's own critics).
10. **Recommendation:** Boop = one **Ma (Today) timeline** driven by the orb, three phases a day, the plan as visible context, the AI as cards+actions with chat as the "talk to Boop" layer; domains are drill-downs, not apps.

---

## 1. Scope

Question: how do you deliver sleep + nutrition (AI meal eval, diet plans) + training (gym mesocycles, running, in-workout logging) + calendar energy prediction + check-ins/journal + one AI coach with domain sub-agents adjusting the day live, as **one** experience. Covered: Whoop, Oura, Apple (Health/Fitness, Workout Buddy, the Mulberry/Health+ rumour), Bevel, Athlytic, Gentler Streak, Welltory, Rise, Visible, Future, Runna, Humango, MacroFactor, Rosebud, Stoic, Sunsama, Motion, Superhuman, plus general "post-chat" AI UI essays and iOS system surfaces. Fitbod/Ladder/Cronometer/Lose It/Foodvisor/Reflectly were not fetched individually; patterns from them are not claimed here.

## 2. What the strong products do (evidence)

### 2.1 Home: one Today feed vs domain tabs

| Product | Structure | Lesson |
|---|---|---|
| **Oura** (Oct 2025 redesign) | 3 tabs: **Today / Vitals / My Health**. Today surfaces "One Big Thing" — the single most important score or insight right now; color tied to your own biometrics signals state. [9to5google](https://9to5google.com/2025/10/20/oura-app-redesign/), [Android Central](https://www.androidcentral.com/wearables/oura-ring/oura-expands-preventive-health-tools-in-app-seeking-longevity-in-users-lives), [Droid Life](https://www.droid-life.com/2025/11/13/oura-ring-app-gets-big-facelift-ai-gets-more-access-to-your-metrics/) | Tabs are organised by **time horizon** (now / body state / long term), not by data type. |
| **Whoop** (2025) | Moved from swipe-between-tabs to a **dense, scrollable home**; "+" action button centred in the tab bar; Coach pinned to the tab bar corner so it is reachable from any day. Three dials (Sleep/Recovery/Strain) each with a deep-dive page; Weekly Plan on home. [the5krunner](https://the5krunner.com/2025/10/15/whoop-homescreen-gets-a-revamp/), [Whoop: new home screen](https://www.whoop.com/thelocker/the-all-new-whoop-home-screen) | One home, one log button, one AI button — three global affordances, everything else is depth. |
| **Rise** | Intentionally minimal home: last night's sleep, running sleep debt, **today's energy curve**. [Rise review](https://www.risescience.com/blog/rise-app-review), [Sleepopolis](https://sleepopolis.com/?p=117913) | One predictive visual can carry the whole day. |
| **Bevel** | One dashboard for recovery, sleep, strain, stress, nutrition, strength, "Energy Bank", journal; praised for showing how sleep → recovery → strain tolerance connect. [Lifestack review](https://lifestack.ai/blog/bevel-app-review), [Autonomous review](https://www.autonomous.ai/ourblog/bevel-app-review) | All-in-one works when the connections are drawn, not just the tiles. |
| **Gentler Streak** | One concept — the **Activity Path** (are you in / above / below your range) — plus a companion character (Yorhart, "what your heart would say"). Apple Design Award 2024 Social Impact. [Sketch blog](https://sketch.com/blog/gentler-streak), [ADA 2024](https://developer.apple.com/design/awards/2024), [TNW](https://thenextweb.com/news/slovenian-fitness-tracker-won-apple-watch-app-of-the-year-award) | A companion face + one guiding visual = coherence; direct precedent for Boop's orb. |

**Pattern:** every strong product has exactly one "what now" surface. Domain screens exist but are reached *from* it.

### 2.2 The AI as spine: chat vs cards vs proactive

- **Whoop Coach launched (Sept 2023, GPT-4) as a text box on the home screen**; Wareable's reviewer said it felt "a little tacked onto the app"; the CEO promised proactive later. [Wareable](https://www.wareable.com/wearable-tech/whoop-launches-gpt-4-ai-coach), [BusinessWire](https://www.businesswire.com/news/home/20230926899032/en)
- Whoop's evolution: **Daily Outlook** (morning, AI-written, "powered by Coach", plan the day) and **Day in Review** (evening recap to guide the evening routine), and Coach made **contextual** — asking "why did my score dip" from the Recovery screen. One write-up says Outlook replaced "the old chatbot setup" as the main way people meet the AI. Coach now remembers interests. [Whoop: Coach](https://whoop.com/thelocker/introducing-whoop-coach-powered-by-openai), [Gadgets & Wearables](https://gadgetsandwearables.com/?p=16084720), [the5krunner](https://the5krunner.com/2025/10/15/whoop-homescreen-gets-a-revamp/). Community complaints: Outlook ignores stated preferences, feels rule-based. [Whoop community](https://www.community.whoop.com/t/daily-outlook-coach-not-learning-from-my-preferences/15543)
- **Oura Advisor**: entry from the Today tab and *from inside Readiness insight messages* ("dive into your data"); late-2025 access to meals, habits, routines; can build a plan toward a goal. [Oura blog](https://ouraring.com/blog/oura-advisor), [BusinessWire](https://www.businesswire.com/news/home/20250331565896/en/), [Droid Life](https://www.droid-life.com/2025/11/13/oura-ring-app-gets-big-facelift-ai-gets-more-access-to-your-metrics/)
- **Bevel Intelligence**: long-term memory of goals, injuries, preferences; cannot yet write journal entries; insights are statistical correlations with an explicit "correlation is not causation" caveat. Reviews: the dashboard is stronger than the AI coach; vague guidance drove a cancellation. [Bevel help](https://help.bevel.health/en/articles/11586817), [Bevel insights](https://help.bevel.health/en/articles/10437057), [Lifestack](https://lifestack.ai/blog/bevel-app-review)
- **Apple Workout Buddy** (watchOS 26): AI voice in the headphones during the workout, auto-starts with the workout, generated from your history; needs an Apple Intelligence iPhone nearby. AI shows up *in the moment*, not in a chat. [heise](https://heise.de/-10475361), [Engadget](https://www.engadget.com/wearables/how-to-use-workout-buddy-with-apple-watch-and-ios-26-130000922.html), [Tom's Guide](https://www.tomsguide.com/wellness/fitness-trackers/apple-watch-just-got-an-ai-fitness-coach-how-to-enable-workout-buddy-in-watchos-26)
- **Apple Health+ / Project Mulberry**: reported (Gurman, Mar 2025) as a Health app redesign around an AI coach; reported scaled back Feb 2026, features to ship piecemeal. Do not plan around it. [9to5Mac 2025](https://9to5mac.com/2025/03/30/apple-health-doctor-project-mulberry/), [9to5Mac 2026](https://9to5mac.com/2026/02/05/apple-reportedly-scales-back-plans-for-ai-powered-health-coach/)
- General: chat boxes have no affordances and put the burden on the user ([Wattenberger](https://wattenberger.com/thoughts/boo-chatbots)); chat should be a fallback, with AI as "do the obvious thing", summary/synthesis, generative right-click, voice + pointing ([Allen Pike](https://allenpike.com/2025/post-chat-llm-ui)).

**Pattern:** the winning shape is **AI-written cards on the Today surface (proactive) + "ask about this" from any card (contextual) + a chat for open questions (fallback)**. Memory is now table stakes (Whoop, Bevel, Rosebud).

### 2.3 One daily loop

- **Sunsama**: guided morning planning (pull tasks, estimate, place on calendar, warns when overcommitted) and an evening **shutdown** (review done, carry over, reflect), triggered by a notification at a wrap-up time chosen in the morning. Critique: skip a morning and the app becomes "one more thing to ignore". [Sunsama help](https://help.sunsama.com/docs/usage-guides/daily-planning), [changelog: daily shutdown](https://roadmap.sunsama.com/changelog/daily-shutdown), [The Sweet Setup](https://thesweetsetup.com/how-to-startup-and-shutdown-your-day-with-sunsama/), [Asian Efficiency](https://www.asianefficiency.com/schedule-management/sunsama-review/)
- **Whoop**: Daily Outlook (morning) → Day in Review (evening). [Gadgets & Wearables](https://gadgetsandwearables.com/?p=16084720)
- **Rosebud**: morning intention (top priority, worries) → evening Rose/Bud/Thorn with AI follow-up questions; memory across entries (weak on dates). [mylifenote review](https://blog.mylifenote.ai/rosebud-review/) (competitor), [Dataconomy](https://dataconomy.com/?p=103166), [Fast Company](https://www.fastcompany.com/91167593/rosebud-ai-journaling-app-writing-partner)
- **Stoic**: morning preparation → evening reflection; users ask for a faster entry path. [App Store](https://apps.apple.com/us/app/stoic/id1312926037)
- **Rise**: timed nudges along the energy curve ("peak approaching", melatonin window). [Tom's Guide](https://www.tomsguide.com/wellness/sleep-tech/i-didnt-trust-the-rise-app-when-it-told-me-to-wake-up-at-4-45am-but-now-i-fall-asleep-quickly-and-sleep-through-the-night), [Rise](https://www.risescience.com/blog/rise-app-review)

**Pattern:** morning = commit to a plan with the AI; day = the plan nudges and re-flows; evening = close the loop against the morning's intention. The evening close must be short or it dies.

### 2.4 Plan-as-context (the cross-domain glue)

- **Runna**: missed sessions shift later ones; drag-and-drop or "skip" and the plan adjusts; "Not Feeling 100%" adapts for illness/aches/short time then returns you to the plan; pace targets adapt from patterns, not single sessions. Criticism: the algorithm is not explained. [Runna help](https://support.runna.com/en/articles/15012850-how-and-when-to-skip-a-run-managing-missed-sessions-in-your-training-plan), [the5krunner](https://the5krunner.com/2026/09/28/is-runna-ai/), [Tom's Guide](https://www.tomsguide.com/wellness/fitness/im-deep-into-marathon-training-fighting-the-flu-and-runnas-new-not-feeling-100-percent-tool-couldnt-be-more-timely)
- **Humango**: one master calendar of events, the AI builds one connected path and adapts to life events. [Challenge Family](https://challengefamily.com/news/one-season-one-plan-how-humango-is-ending-the-spreadsheet-struggle-for-challenge-family-athletes/)
- **Motion**: auto-reschedules when meetings move and asks "reschedule or extend?" when a task overruns; criticised as opinionated (loss of control) and for sprawling into docs/wikis. [ClickUp review](https://clickup.com/blog/motion-review/), [Morgen](https://www.morgen.so/blog-posts/motion-review) (competitor)
- **Visible**: rest/pacing-first; daily energy budget and "PacePoints" with the band; morning check-in for a stability score. [App Store](https://apps.apple.com/us/app/visible-pacing-for-illness/id1624474919), [Visible help](https://help.makevisible.com/en/articles/13928208-what-is-visible)
- **Athlytic**: exertion target derived from recovery (one number tells you how much to do); a reviewer warns it ignores muscle fatigue. [App Store](https://apps.apple.com/gb/app/id1543571755), [iBikeRun](https://ibikerun.substack.com/p/athlytic-app-review-iosapple-watch)

**Pattern:** a **budget** (energy units, strain target, sleep debt) is the most legible way to show cross-domain reasoning; the active **plan** is the constant frame the AI adjusts against. Ask before moving things (Motion's lesson); explain every change (Runna's gap).

### 2.5 One score vs many; showing the why

- Oura: one prominent score at a time; colour mapped to *your* baseline. Whoop: three dials, each a door to depth. Welltory: 22 HRV metrics (SDNN, RMSSD, pNN50…) called overwhelming by casual users. [Welltory overview](https://www.mobileappdaily.com/product-review/welltory-app), [Thryve: wearable burnout](https://www.thryve.health/blog/wearable-burnout-minimalist-tracking)
- Why-explanations: Whoop's contextual "why did my recovery dip" (sleep consistency + strain); Bevel's causal chain is what reviewers praise; vague AI is what they punish. [Whoop](https://whoop.com/thelocker/introducing-whoop-coach-powered-by-openai), [Lifestack](https://lifestack.ai/blog/bevel-app-review)

### 2.6 Interaction cost of manual logging

- MacroFactor built an index of **taps per task** (search, multi-add, barcode, quick-add) and redesigned until it led; repeat foods remembering the last serving matter most over time. AI photo + optional text, "AI Describe" by text/voice; barcode is still faster for one branded item. [MacroFactor FLSI](https://macrofactor.com/fastest-food-logger/) (vendor), [AI food logging help](https://help.macrofactorapp.com/en/articles/258-ai-food-logging)
- Training logging lives on the wrist: Future trainers rely on the Apple Watch; pause/advance on the watch is called more immediate than the phone. [Garage Gym Reviews](https://www.garagegymreviews.com/future-app-review), [connectthewatts](https://connectthewatts.com/2021/09/27/future-app-review)

### 2.7 "One inbox"

- Superhuman: split inbox reduces "switch cost and mixing cost"; keyboard-first, speed as the feature; ritual reward at zero. [Superhuman blog](https://blog.superhuman.com/inbox-zero-in-7-steps/), [Medium review](https://medium.com/swlh/superhumans-superpowers-a-product-review-6f21535b9a45). Transfer: one queue of things the AI wants from you (a question, a confirm, a log), each clearable in one gesture — not five domain inboxes.

## 3. iOS-native mechanisms that unify an app

| Mechanism | What it gives the spine | Source |
|---|---|---|
| **Live Activities** (Lock Screen, Dynamic Island, Watch Smart Stack) | For ongoing events with frequently changing data or ongoing tasks; should alert only when important. Fits: an active workout, "today in progress" (next block + remaining energy), a fasting/meal window. Max ~8 h active (+ up to 4 h on Lock Screen) — a whole-day activity needs restarting, not one long one. | [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/live-activities), [OneSignal best practices](https://documentation.onesignal.com/docs/live-activities-best-practices), [9to5Mac](https://9to5mac.com/2022/09/26/iphone-14-pro-live-activities-guidelines/) |
| **Widgets + watchOS Smart Stack relevance** | RelevanceKit lets the system surface a widget by date, sleep schedule, fitness state, location (watchOS 26); Smart Stack now hosts Controls, widgets, Live Activities. Morning brief card at wake, workout card at the planned time, wind-down card at bedtime. | [Apple RelevanceKit](https://developer.apple.com/documentation/relevancekit), [WWDC25 334 index](https://nonstrict.eu/wwdcindex/wwdc2025/334/) |
| **App Intents** (Siri, Spotlight, Shortcuts, interactive snippets, Visual Intelligence) | One action vocabulary ("log meal", "check in", "how's my day", "start today's workout") reachable everywhere; snippets show a small interactive view in Siri/Spotlight. WWDC26 reportedly adds on-screen awareness context for Siri (secondary sources). | [WWDC25 275](https://developer.apple.com/videos/play/wwdc2025/275), [WWDC25 281](https://developer.apple.com/videos/play/wwdc2025/281), [MartianCraft WWDC26 recap](https://martiancraft.com/blog/2026/06/wwdc-26-recap-siri-grows-up-apple-intelligence-goes-everywhere-and-agents-move-Into-xcode/) |
| **Controls / interactive widgets** | One-tap check-in or quick log from Control Center / Lock Screen / Action button without opening the app (App Intent-backed). | [WWDC25 334 index](https://nonstrict.eu/wwdcindex/wwdc2025/334/) (controls on watch); general Apple docs |
| **watchOS app + complications** | The in-workout logger, the check-in, and a one-glance "capacity left" complication (Athlytic's complications are its best-reviewed feature). | [App Store Athlytic](https://apps.apple.com/gb/app/id1543571755), [Product Hunt](https://www.producthunt.com/products/athlytic/reviews) |
| **Focus filters** | App can change what it shows in a Focus (e.g. Work Focus hides food nags, Sleep Focus shows only wind-down). | Apple SetFocusFilterIntent docs (not fetched this session) |

**Pattern:** the spine is not only the app; it is the **same three phases rendered on Lock Screen, watch and Siri**. Every system surface should answer "what now" with one line in the orb's voice.

## 4. Anti-patterns to design against

1. **Feature sprawl** — Motion went from AI calendar to docs/wikis/sheets and is criticised for it. [ClickUp](https://clickup.com/blog/motion-review/)
2. **Dashboard overload** — Welltory's 22 metrics; "wearable burnout". [Thryve](https://www.thryve.health/blog/wearable-burnout-minimalist-tracking)
3. **Chat-only / bolted-on AI** — Whoop Coach v1 "tacked on". [Wareable](https://www.wareable.com/wearable-tech/whoop-launches-gpt-4-ai-coach)
4. **Vague AI** — Bevel cancellation for "vague, unhelpful guidance". [Lifestack](https://lifestack.ai/blog/bevel-app-review)
5. **Opaque adaptation** — Runna doesn't say why targets changed. [the5krunner](https://the5krunner.com/2026/09/28/is-runna-ai/)
6. **AI that ignores stated preferences** — Whoop Outlook. [Whoop community](https://www.community.whoop.com/t/daily-outlook-coach-not-learning-from-my-preferences/15543)
7. **Rituals that become chores** — Sunsama critique; Stoic users want faster entry.
8. **Auto-moving without asking** — Motion's "opinionated" critique. [Morgen](https://www.morgen.so/blog-posts/motion-review)
9. **Stale data undermining trust** — Athlytic/Bevel sync lag complaints; show freshness. [iBikeRun](https://ibikerun.substack.com/p/athlytic-app-review-iosapple-watch)
10. **Data-type tabs** (Sleep / Food / Gym / Journal) — the shape that makes it feel like 4–5 apps; nobody strong ships it as the top level anymore (Oura, Whoop both moved away).

## 5. Recommended spine for Boop

Given: Napkelte look (dark glass, painted sky, orb as Boop's face, orb rising as the morning sun), single user, Apple Watch now, ring later, S3 morning brief already shipped.

### 5.1 The daily loop (the spine is time)

| Phase | What happens | Where the AI shows up |
|---|---|---|
| **Reggel (wake → plan)** | Orb rises; one verdict sentence ("Ma 7 egységed van, a naptárad 9-et kér") + the energy curve + today's plan blocks (meals, workout, hard meetings). One action: accept / tweak. Optional intention + quick check-in. | Morning brief = konzílium output rendered as one card stack; "miért?" on every line. (Exists in S3 — extend, don't replace.) |
| **Napközben (live adjust)** | Timeline of the day with "now" marker. Logging (meal photo, workout, check-in) feeds back into the same timeline. When reality diverges the AI proposes a change as a card: "Rövidebb edzés: 35 perc 50 helyett — mert 5 órát aludtál és délután 3 órás meeting jön. [Elfogad] [Nem]". Never auto-moves. | Proactive change cards + Live Activity "Ma" (next block, units left) + watch complication. Workout: in-workout guidance on the watch. |
| **Este (close)** | 60-second close: rate the day vs the morning goal, one journal line (voice OK), what carries to tomorrow; Boop says one sentence about what it learned. Orb sets. | Day-in-review card; memory write. |

### 5.2 Information architecture

- **Tab bar (≤4):** **Ma** (the timeline above — home, 90% of use) · **Terv** (active plans: diet plan, mesocycle, running plan, weight goal — the context the AI works against) · **Napló/Minták** (history, journal, long-term patterns, "what did this recipe do to me") · **Boop** (chat with full context + memory + the konzílium's reasoning on demand). A single global **"+"** (log meal / workout / check-in / note) — Whoop's centred action button.
- **Domains are drill-downs, not tabs:** tapping sleep / food / training / energy in Ma opens that domain's depth page; each depth page has the same skeleton (verdict line, the level, the why, the plan rule in force, "kérdezd Boopot erről").
- **One headline number:** daily **capacity vs demand in units** (core #7) is the one score. Sleep, recovery, food balance, training load are inputs shown as contributors, not peers. (Oura "One Big Thing" + Visible/Rise budget.)
- **One queue:** things Boop needs from you (confirm a change, log the lunch it saw on the calendar, a check-in) appear in one place at the top of Ma, each one-tap clearable (Superhuman).
- **Sub-agents are invisible by default:** one voice (Boop/orb). The domain agents surface only as the "why" ("Alvás és Mozgás egyetért: …"), keeping the konzílium as explanation, not as five characters.

### 5.3 Outside the app (same spine)

- Live Activity during workouts (always) and optionally a "Ma" activity for the waking day split into two ≤8 h activities.
- Lock Screen / Smart Stack widgets with relevance: morning brief at wake, workout at planned time, wind-down at bedtime.
- App Intents: "Boop, mit egyek ebédre?", "log a meal", "how's my day", "start today's workout"; Controls for one-tap check-in.
- Watch: in-workout logger, check-in (snapshot biomarkers at that moment, core #11), units-left complication.
- Notifications only as the three phases + proposed changes; nothing per-domain.

### 5.4 Trade-offs

| Choice | Gain | Cost / risk |
|---|---|---|
| Time-based Ma timeline as home (vs domain tabs) | Feels like one app; matches the daily loop | Deep domain work (planning a mesocycle, building a diet plan) needs a good home in Terv or it feels hidden |
| One headline (units) | Clear, cross-domain by design | The units model must be trustworthy; if it's wrong everything looks wrong — needs freshness + "why" + easy override |
| AI as cards + actions, chat as a tab | Low effort, proactive, explainable | More product design per card type than "just a chat"; card generation must be structured output, not prose |
| Ask-before-change | Trust, owner stays in control | One extra tap per adjustment; if Boop proposes too often it nags — cap proposals per day |
| Invisible sub-agents | One voice, less clutter | Loses some of the "team" charm; keep agent attribution in the why so the konzílium stays legible |
| Evening close | Closes the loop, feeds memory | Ritual fatigue — must be skippable and ≤60 s, with a widget/notification shortcut |
| Live Activity for the whole day | Spine on the Lock Screen | 8 h limit, battery/attention cost; may feel noisy — start with workouts only |

## 6. Open questions

1. Is the units model (core #7) mature enough to be *the* headline, or should Boop launch with a simpler readiness verdict and graduate to units?
2. Where do plan editing flows live (Terv tab vs chat-driven "build me a 4-week plan")? Probably both: chat proposes, Terv shows/edits.
3. How many proactive change cards per day before it nags? Needs a budget and a "ne javasolj ma többet" switch.
4. Watch-first logging scope for v1: workout only, or also check-in and quick food?
5. Which Apple Intelligence features to rely on: Workout Buddy and App Intents need an Apple Intelligence iPhone; free-Apple-ID sideload may limit some capabilities (Live Activity push, widgets are fine) — verify per capability.
