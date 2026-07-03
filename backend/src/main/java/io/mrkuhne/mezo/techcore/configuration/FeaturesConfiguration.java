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
}
