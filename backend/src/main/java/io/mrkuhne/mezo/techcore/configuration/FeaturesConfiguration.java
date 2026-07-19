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

    /** Fuel URL-scrape import (mezo-8vum) — LLM extraction; independent of pantry-import (OFF). */
    public static final String PANTRY_SCRAPE_SWITCH = "mezo.feature.pantry-scrape.enabled";

    /** AI meal logging (text/photo -> LLM draft). Independent of the companion chat switch. */
    public static final String MEAL_AI_LOG_SWITCH = "mezo.feature.meal-ai-log.enabled";

    /** Recipe AI template breakdown prose (mezo-bw3y): gates ONLY the LLM prose enrichment — the
     *  deterministic GET /api/recipe/{id}/breakdown envelope stays on regardless. Prose additionally
     *  needs COMPANION_SWITCH (the port adapter lives there). */
    public static final String RECIPE_AI_SCORE_SWITCH = "mezo.feature.recipe-ai-score.enabled";

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

    /** H1 heartbeat window crons — techcore cron zone (schedules: mezo.proactive.heartbeat.*). */
    public static final String HEARTBEAT_JOB_SWITCH = "mezo.techcore.cron.heartbeat-job.enabled";

    /** P1 prediction generation + validation crons — techcore cron zone (schedules: mezo.proactive.prediction.*). */
    public static final String PREDICTION_JOB_SWITCH = "mezo.techcore.cron.prediction-job.enabled";

    /** P2 experiment proposal + outcome crons — techcore cron zone (schedules: mezo.proactive.experiment.*). */
    public static final String EXPERIMENT_JOB_SWITCH = "mezo.techcore.cron.experiment-job.enabled";

    /** Workout challenges daily outcome-eval cron — techcore cron zone (schedule: mezo.proactive.challenge.outcome-cron). */
    public static final String CHALLENGE_JOB_SWITCH = "mezo.techcore.cron.challenge-job.enabled";

    /** Hypertrophy Drive — pre-populated prescribed sets + dynamic weight/rep recommendation. */
    public static final String HYPERTROPHY_DRIVE_SWITCH = "mezo.feature.hypertrophy-drive.enabled";

    /** Fix zárás (closing block) — configured closing exercises (mezo.closing-block) lazily
     *  ensured at the END of every template gym day of the active meso on GET /workouts/today. */
    public static final String CLOSING_BLOCK_SWITCH = "mezo.feature.closing-block.enabled";

    /** Daily quests (gamified growth E1, ADR 0010). Gates the whole /api/quest surface + services. */
    public static final String QUEST_SWITCH = "mezo.feature.quest.enabled";

    /** Daily-quest crons (morning generate backstop + nightly finalize) — techcore cron zone (schedules: mezo.quest.*-cron). */
    public static final String QUEST_JOB_SWITCH = "mezo.techcore.cron.quest-job.enabled";

    /** Activity log (gamified growth E2). Gates the whole /api/activity surface + services;
     *  the AI classifier additionally requires COMPANION_SWITCH (it calls the CompanionLlm port). */
    public static final String ACTIVITY_SWITCH = "mezo.feature.activity.enabled";

    /** E3 quest flavor copy — sub-switch of quest; the LLM rewrites title/why on the MORNING CRON
     *  only (never targets/XP — ADR 0010). Requires COMPANION_SWITCH too (CompanionLlm port). */
    public static final String QUEST_FLAVOR_SWITCH = "mezo.quest.flavor.enabled";

    /** Habit engine (morning/evening routine chains, mezo-d1jb). Gates /api/habit + services. */
    public static final String HABIT_SWITCH = "mezo.feature.habit.enabled";

    /** Nightly habit close cron (end-of-day + next-day metrics) — schedule: mezo.habit.close-cron. */
    public static final String HABIT_JOB_SWITCH = "mezo.techcore.cron.habit-job.enabled";
}
