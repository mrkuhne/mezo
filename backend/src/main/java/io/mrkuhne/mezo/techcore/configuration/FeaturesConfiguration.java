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

    /** Phase 5 W4.2 (mezo-b3pp.16) nightly feedback-rollup job — techcore cron zone. */
    public static final String FEEDBACK_LEARNING_JOB_SWITCH = "mezo.techcore.cron.feedback-learning-job.enabled";

    /** W5.1 (mezo-b3pp.18): hourly composite-flag sweep; off ⇒ the FlagSweepJob bean does not exist. */
    public static final String FLAG_SWEEP_JOB_SWITCH = "mezo.techcore.cron.flag-sweep-job.enabled";

    /** Phase 5 W4.3 (mezo-b3pp.17) weekly profile assembler job — techcore cron zone. Off ⇒ the
     *  ProfileAssemblerJob bean does not exist, AND the W5.3 quarterly job skips its own phase-2
     *  profile rebuild (it reads this switch by that bean's presence — see {@link
     *  #QUARTERLY_REVIEW_JOB_SWITCH}), so an archived "Rólad tanultam" node stays archived. */
    public static final String PROFILE_ASSEMBLER_JOB_SWITCH = "mezo.techcore.cron.profile-assembler-job.enabled";

    /** V3.2 weekly hypothesis pipeline — techcore cron zone. */
    public static final String HYPOTHESIS_JOB_SWITCH = "mezo.techcore.cron.hypothesis-job.enabled";

    /** Fuel P6 pantry import (OpenFoodFacts lookup + import endpoints). Gates OffClient + PantryImportController. */
    public static final String PANTRY_IMPORT_SWITCH = "mezo.feature.pantry-import.enabled";

    /** Fuel URL-scrape import (mezo-8vum) — LLM extraction; independent of pantry-import (OFF). */
    public static final String PANTRY_SCRAPE_SWITCH = "mezo.feature.pantry-scrape.enabled";

    /** Fuel photo import (mezo-d8tr) — nutrition-label photo -> LLM draft; independent of scrape. */
    public static final String PANTRY_PHOTO_SWITCH = "mezo.feature.pantry-photo.enabled";

    /** AI meal logging (text/photo -> LLM draft). Independent of the companion chat switch. */
    public static final String MEAL_AI_LOG_SWITCH = "mezo.feature.meal-ai-log.enabled";

    /** Recipe AI template breakdown prose (mezo-bw3y): gates ONLY the LLM prose enrichment — the
     *  deterministic GET /api/recipe/{id}/breakdown envelope stays on regardless. Prose additionally
     *  needs COMPANION_SWITCH (the port adapter lives there). */
    public static final String RECIPE_AI_SCORE_SWITCH = "mezo.feature.recipe-ai-score.enabled";

    /** Meal coach verdicts (mezo-mr4n): gates ONLY the LLM prose over a logged meal's score — the
     *  deterministic score and its breakdown stay on regardless. Verdicts additionally need
     *  COMPANION_SWITCH (the MealCoachLlm adapter lives there). */
    public static final String MEAL_COACH_SWITCH = "mezo.feature.meal-coach.enabled";

    /** Proactive layer (mezo-h4wp) — companion-feed + weekly prose + predictions.
     *  Every proactive bean conditions on BOTH this AND COMPANION_SWITCH (the generators call the
     *  CompanionLlm port, whose beans only exist when the companion is on). */
    public static final String PROACTIVE_SWITCH = "mezo.feature.proactive.enabled";

    /** Karakter dossier (mezo-1gim) — dimensions/claims/observations/conferences + reads.
     *  LLM-calling character beans (Slice 2+) additionally require {@link #COMPANION_SWITCH}. */
    public static final String CHARACTER_SWITCH = "mezo.feature.character.enabled";

    /** Companion-feed morning/midday/evening crons (mezo-gst9) — techcore cron zone
     *  (schedules: mezo.proactive.feed.*-cron). */
    public static final String FEED_JOB_SWITCH = "mezo.techcore.cron.feed-job.enabled";

    /** W1 Monday weekly-suggestion job — techcore cron zone (schedule: mezo.proactive.weekly.cron). */
    public static final String WEEKLY_SUGGESTION_JOB_SWITCH = "mezo.techcore.cron.weekly-suggestion-job.enabled";

    /** Monday weekly-review job (mezo-p2tr) — techcore cron zone
     *  (schedule: mezo.proactive.weekly-review.cron); generates the JUST-FINISHED week's review,
     *  unlike the forward-looking {@link #WEEKLY_SUGGESTION_JOB_SWITCH}. */
    public static final String WEEKLY_REVIEW_JOB_SWITCH = "mezo.techcore.cron.weekly-review-job.enabled";

    /** W2 Sunday memoir job — techcore cron zone (schedule: mezo.proactive.memoir.cron). */
    public static final String MEMOIR_JOB_SWITCH = "mezo.techcore.cron.memoir-job.enabled";

    /** P1 prediction generation + validation crons — techcore cron zone (schedules: mezo.proactive.prediction.*). */
    public static final String PREDICTION_JOB_SWITCH = "mezo.techcore.cron.prediction-job.enabled";

    /** P2 experiment proposal + outcome crons — techcore cron zone (schedules: mezo.proactive.experiment.*). */
    public static final String EXPERIMENT_JOB_SWITCH = "mezo.techcore.cron.experiment-job.enabled";

    /** Workout challenges daily outcome-eval cron — techcore cron zone (schedule: mezo.proactive.challenge.outcome-cron). */
    public static final String CHALLENGE_JOB_SWITCH = "mezo.techcore.cron.challenge-job.enabled";

    /** Hypertrophy Drive — pre-populated prescribed sets + dynamic weight/rep recommendation. */
    public static final String HYPERTROPHY_DRIVE_SWITCH = "mezo.feature.hypertrophy-drive.enabled";

    /** Volume progression (Plan 2 Phase A) — weekly per-muscle set-volume rollover + deload/grind logic. */
    public static final String VOLUME_PROGRESSION_SWITCH = "mezo.feature.volume-progression.enabled";

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

    /** AI habit suggester (mezo-n5e9.3, ADR 0019) — gates ONLY the propose-only smart-model
     *  suggestion endpoint; existing habit CRUD/day/summary stays on regardless. {@code
     *  HabitAiService} itself conditions on {@link #HABIT_SWITCH} (same bean lifecycle as the
     *  controller it's wired into); the companion-side adapter additionally needs both this AND
     *  COMPANION_SWITCH (array-AND'ed exactly like STACK_PLACEMENT_LLM_SWITCH/COMPANION_SWITCH);
     *  off/absent on either degrades the endpoint to a clean 503. */
    public static final String HABIT_AI_SUGGEST_SWITCH = "mezo.feature.habit-ai-suggest.enabled";

    /** Daily intention (creed + foci + reflection, mezo-a686). Gates /api/intention + services. */
    public static final String INTENTION_SWITCH = "mezo.feature.intention.enabled";

    /** Napzárás closing ritual (bd mezo-hvmx) — off ⇒ the /api/ritual surface 404s, no ritual beans exist. */
    public static final String RITUAL_SWITCH = "mezo.feature.ritual.enabled";

    /** Sleep goal + day-anchor (mezo-dbsr). Gates /api/sleep/goal + SleepGoalService (the anchor resolver stays on). */
    public static final String SLEEP_GOAL_SWITCH = "mezo.feature.sleep-goal.enabled";

    /** Sleep screenshot ingestion (mezo-66ab) — Sleep Cycle screenshot -> LLM-vision draft. */
    public static final String SLEEP_SHOT_SWITCH = "mezo.feature.sleep-shot.enabled";

    /** Fuel planner settings (mezo-53su) — eating cadence + caffeine cutoff singleton. Gates /api/fuel/settings (the caffeine resolver stays on). */
    public static final String FUEL_SETTINGS_SWITCH = "mezo.feature.fuel-settings.enabled";

    /** Diet preferences (Diet Plan slice 1) — macro split + protein tier + water/fiber singleton.
     *  Gates /api/diet/settings (the DietPreferencesResolver stays on — the engine always resolves). */
    public static final String DIET_SETTINGS_SWITCH = "mezo.feature.diet-settings.enabled";

    /** Stack placement LLM fallback (mezo-vx9v) — gates ONLY the LLM placement fallback for
     *  unknown supplements; the deterministic rule table runs regardless. The adapter bean
     *  additionally needs COMPANION_SWITCH (both condition the same bean, array-AND'ed exactly
     *  like ACTIVITY_SWITCH/COMPANION_SWITCH); off/absent on either degrades placement to the
     *  deterministic 'fallback' zone. */
    public static final String STACK_PLACEMENT_LLM_SWITCH = "mezo.feature.stack-placement-llm.enabled";

    /** Slot-plan AI evaluate endpoint (mezo-7102) — gates ONLY the stateless, auth-gated-only
     *  "judge my split" LLM call over a meal-slot template (nothing persisted). The adapter bean
     *  additionally needs COMPANION_SWITCH (both condition the same bean, array-AND'ed exactly
     *  like STACK_PLACEMENT_LLM_SWITCH/COMPANION_SWITCH); off/absent on either degrades the
     *  endpoint to a clean 503. */
    public static final String SLOT_TEMPLATE_AI_SWITCH = "mezo.feature.slot-template-ai.enabled";

    /** Account gamification ledger (bd mezo-huzd) — coins/streak/titles; off ⇒ /api/gamification 404s,
     *  and the AccountProgressPort adapter is absent (progression awards fire no coin hook). */
    public static final String GAMIFICATION_SWITCH = "mezo.feature.gamification.enabled";

    /** LLM call audit log (bd mezo-2zyu) — off ⇒ the injected LlmCallRecorder is the no-op, so no
     *  adapter can publish an audit event and no llm_log_history row is ever written. */
    public static final String LLM_LOG_SWITCH = "mezo.feature.llm-log.enabled";

    /** mezo-1y3p LLM-log payload retention cron — off ⇒ the LlmLogRetentionJob bean does not exist.
     *  Deliberately independent of {@link #LLM_LOG_SWITCH}: payload already on disk keeps aging
     *  even while recording is off. */
    public static final String LLM_LOG_RETENTION_JOB_SWITCH =
        "mezo.techcore.cron.llm-log-retention-job.enabled";

    /** Push notifications (bd mezo-h4wp.6) — off ⇒ no notification beans, /api/notification/* 404s. */
    public static final String NOTIFICATION_SWITCH = "mezo.feature.notification.enabled";

    /** Per-minute push dispatch job (N2; schedule: mezo.notification.dispatch-cron) — techcore cron zone. */
    public static final String NOTIFICATION_DISPATCH_JOB_SWITCH =
            "mezo.techcore.cron.notification-dispatch-job.enabled";

    /** Meso end-of-run AI evaluation (mezo-meyc.3) — gates {@code MesoReviewGate}, the marker
     *  {@code MesocycleReportService.getReport} reads for {@code aiEvalEnabled}; off ⇒ the FE hides
     *  the AI section and never polls a {@code pending} that will never resolve. The real generator
     *  (companion, task 15) additionally needs COMPANION_SWITCH (it calls the CompanionLlm port). */
    public static final String MESO_REVIEW_SWITCH = "mezo.feature.meso-review.enabled";

    /** Életjel-ring day-close (mezo-dhzk) — off ⇒ the /api/needs surface 404s and no needs beans exist. */
    public static final String NEEDS_SWITCH = "mezo.feature.needs.enabled";

    /** In-app notification feed + bell (bd mezo-gzhp) — off ⇒ no feed beans, /api/notification/feed 404s, producers' emits no-op through AppNotificationEmitter. */
    public static final String NOTIFICATION_FEED_SWITCH = "mezo.feature.notification-feed.enabled";

    /** Phase 5 W1.1 journal (bd mezo-b3pp.1) — off ⇒ the /api/journal surface 404s and no journal
     *  beans exist. */
    public static final String JOURNAL_SWITCH = "mezo.feature.journal.enabled";

    /** Phase 5 W2.1 knowledge graph (bd mezo-b3pp.6) — off ⇒ no graph beans exist, the graph API
     *  404s, and every graph hook elsewhere (W3.1 [Összefüggések] block, W4.2 reinforcement,
     *  RECOVERY profile input) stays silently absent. */
    public static final String KNOWLEDGE_GRAPH_SWITCH = "mezo.feature.knowledge-graph.enabled";

    /** Phase 5 W3.2 (mezo-b3pp.13) consolidation ladder cron (weekly + monthly rungs). */
    public static final String CONSOLIDATION_JOB_SWITCH = "mezo.techcore.cron.consolidation-job.enabled";

    /** Phase 5 W2.5 (mezo-b3pp.10) nightly graph-maintenance job — techcore cron zone. */
    public static final String GRAPH_MAINTENANCE_JOB_SWITCH =
        "mezo.techcore.cron.graph-maintenance-job.enabled";

    /** Phase 5 W5.3 (mezo-b3pp.20) quarterly deep pass — techcore cron zone. Off ⇒ the
     *  QuarterlyReviewJob bean does not exist; no season candidates, no quarterly profile rerun
     *  (the WEEKLY profile job is independent and keeps running).
     *
     *  <p>The other direction holds too, and is NOT symmetric: with this switch ON but {@link
     *  #PROFILE_ASSEMBLER_JOB_SWITCH} OFF, the quarterly job still proposes season candidates
     *  (phase 1) but skips its profile rebuild (phase 2) — it reads that switch by ProfileAssemblerJob
     *  bean presence, so switching the profile off is never silently undone four times a year. */
    public static final String QUARTERLY_REVIEW_JOB_SWITCH =
        "mezo.techcore.cron.quarterly-review-job.enabled";

    /** W5.2 JITAI-lite interventions (bd mezo-b3pp.19) — flag-raise → config-library feed card
     *  (+ optional push). Off ⇒ no InterventionService/listener beans: flags keep logging
     *  (W5.1 is independent), but nothing is ever delivered. Needs COMPANION_SWITCH and
     *  PROACTIVE_SWITCH too (the card is a companion_message row). */
    public static final String INTERVENTION_SWITCH = "mezo.feature.intervention.enabled";
}
