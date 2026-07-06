package io.mrkuhne.mezo.techcore.configuration;

import lombok.AccessLevel;
import lombok.NoArgsConstructor;

/** Central registry of feature-switch property keys (consumed via @ConditionalOnProperty). */
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public class FeaturesConfiguration {

    /** Gamified progression (post-workout level-up + XP). First production feature switch. */
    public static final String PROGRESSION_SWITCH = "mezo.feature.progression.enabled";

    /** Phase-3 companion (LLM chat + AI memory). Gates every CompanionLlm bean (ADR 0008). */
    public static final String COMPANION_SWITCH = "mezo.feature.companion.enabled";

    /** V1.2 post-turn fact extraction — sub-switch of companion; gates ONLY the async listener. */
    public static final String COMPANION_EXTRACTION_SWITCH = "mezo.companion.extraction.enabled";

    /** V1.3 advisor chain (clinical + verdict + retry/degraded) — sub-switch of companion. */
    public static final String COMPANION_ADVISORS_SWITCH = "mezo.companion.advisors.enabled";

    /** V2.2 post-turn chat embedding — sub-switch of companion; gates ONLY the async listener. */
    public static final String COMPANION_EMBED_TURNS_SWITCH = "mezo.companion.embedding.embed-chat-turns";

    /** V2.2 nightly daily-summary job (the app's first cron) — techcore cron zone. */
    public static final String DAILY_SUMMARY_JOB_SWITCH = "mezo.techcore.cron.daily-summary-job.enabled";

    /** V3.1 nightly statistical pattern-detection job — techcore cron zone. */
    public static final String PATTERN_DETECTION_JOB_SWITCH = "mezo.techcore.cron.pattern-detection-job.enabled";

    /** V3.2 weekly hypothesis pipeline — techcore cron zone. */
    public static final String HYPOTHESIS_JOB_SWITCH = "mezo.techcore.cron.hypothesis-job.enabled";

    /** Fuel P6 pantry import (OpenFoodFacts lookup + import endpoints). Gates OffClient + PantryImportController. */
    public static final String PANTRY_IMPORT_SWITCH = "mezo.feature.pantry-import.enabled";

    /** Proactive layer (mezo-h4wp) — generated briefing + weekly prose + heartbeat + predictions.
     *  Every proactive bean conditions on BOTH this AND COMPANION_SWITCH (the generators call the
     *  CompanionLlm port, whose beans only exist when the companion is on). */
    public static final String PROACTIVE_SWITCH = "mezo.feature.proactive.enabled";

    /** B1.2 dawn briefing pre-generation job — techcore cron zone (schedule: mezo.proactive.briefing.cron). */
    public static final String BRIEFING_JOB_SWITCH = "mezo.techcore.cron.briefing-job.enabled";

    /** W1 Monday weekly-suggestion job — techcore cron zone (schedule: mezo.proactive.weekly.cron). */
    public static final String WEEKLY_SUGGESTION_JOB_SWITCH = "mezo.techcore.cron.weekly-suggestion-job.enabled";

    /** W2 Sunday memoir job — techcore cron zone (schedule: mezo.proactive.memoir.cron). */
    public static final String MEMOIR_JOB_SWITCH = "mezo.techcore.cron.memoir-job.enabled";
}
