package io.mrkuhne.mezo.support;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;
import org.springframework.transaction.annotation.Transactional;

/**
 * Wipes every test-created row between tests while preserving master data
 * (the demodata-seeded owner and their profile) — see
 * docs/references/integration_test_framework.md.
 *
 * <p>Runs from {@link AbstractIntegrationTest}'s {@code @BeforeEach}, so every test
 * starts from a known-clean state regardless of what earlier test classes committed
 * to the fixed {@code mezo_test} database.
 *
 * <p><b>Growth rule:</b> every new owned domain table (Slice B+) MUST be added to the
 * TRUNCATE list here in the same change that creates it.
 *
 * <p><b>exercise_catalog is a hybrid table</b> (since mezo-52zg): master rows (created_by null)
 * are loader-owned and must NOT join the TRUNCATE list; only the user-authored rows
 * (created_by set) are deleted here so the startup ExerciseCatalogLoader's content survives.
 */
@TestComponent
@RequiredArgsConstructor
public class ResetDatabase {

    /** JPA-managed shared EntityManager — the one allowed exception to constructor injection. */
    @PersistenceContext
    private EntityManager entityManager;

    private final OwnerProperties ownerProperties;

    @Transactional
    public void resetExceptMasterData() {
        // TRUNCATE CASCADE handles FK dependencies between owned domain tables.
        entityManager.createNativeQuery(
            "TRUNCATE TABLE llm_log_history, gamification_profile, push_subscription, notification_pref, push_log, notification_schedule, app_notification, coin_event, owned_title, needs_day, ritual_day, intention_creed, intention_focus, daily_intention, habit_day, habit_def, habit_chain, activity_log, daily_quest, challenge, diagnosis, experiment, prediction, weekly_review, weekly_score, memoir, weekly_suggestion, companion_message, pattern_event, pattern, daily_summary, period_summary, memory_embedding, message_feedback, feedback_rollup, companion_flag_log, knowledge_node, knowledge_edge, learned_fact, knowledge_fact, ai_message, ai_conversation, supplement_intake, protocol_item, protocol, water_log, medication_dose, medication, meal_item, meal, recipe_ingredient, recipe, pantry_import, pantry_item, weight_log, sleep_log, sleep_goal, fuel_settings, tutorial_progress, "
                + "meal_slot_template, check_in, journal_entry, decision_entry, gratitude_entry, "
                + "exercise_feedback, exercise_set, exercise, workout_session, muscle_group_volume_log, mesocycle, "
                + "meso_template, mesocycle_report, "
                + "gym_schedule_slot, sport_schedule_slot, sport_event, sport_session, run_session_log, running_block, "
                + "skill_progress, level_up_event, perk_unlock, "
                + "life_goal_pillar_day, life_goal_pillar, life_goal, "
                + "goal_plan_link, goal, biometric_profile, "
                + "character_run, character_portrait_revision, character_conference, character_observation, character_claim, character_dimension, "
                + "mention, person CASCADE").executeUpdate();
        // Master data (demodata owner + their profile) survives; everything else goes.
        entityManager.createNativeQuery(
                "DELETE FROM user_profiles WHERE created_by NOT IN "
                    + "(SELECT id FROM app_user WHERE email = :ownerEmail)")
            .setParameter("ownerEmail", ownerProperties.ownerEmail())
            .executeUpdate();
        entityManager.createNativeQuery("DELETE FROM app_user WHERE email <> :ownerEmail")
            .setParameter("ownerEmail", ownerProperties.ownerEmail())
            .executeUpdate();
        // User-authored catalog rows go; master content (created_by null) survives for the loader.
        entityManager.createNativeQuery("DELETE FROM exercise_catalog WHERE created_by IS NOT NULL").executeUpdate();
    }
}
