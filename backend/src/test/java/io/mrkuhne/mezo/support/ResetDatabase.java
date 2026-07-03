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
 * <p><b>exercise_catalog is master data</b> (content, no created_by) — it must NOT join the
 * TRUNCATE list; the startup ExerciseCatalogLoader owns it.
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
            "TRUNCATE TABLE pattern, daily_summary, memory_embedding, learned_fact, knowledge_fact, ai_message, ai_conversation, supplement_intake, protocol_item, protocol, water_log, medication_dose, medication, meal_item, meal, recipe_ingredient, recipe, pantry_item, weight_log, sleep_log, check_in, "
                + "exercise_feedback, exercise_set, exercise, workout_session, muscle_group_volume_log, mesocycle, "
                + "gym_schedule_slot, sport_schedule_slot, sport_session, run_session_log, running_block, "
                + "skill_progress, level_up_event, perk_unlock, "
                + "goal_plan_link, goal, biometric_profile CASCADE").executeUpdate();
        // Master data (demodata owner + their profile) survives; everything else goes.
        entityManager.createNativeQuery(
                "DELETE FROM user_profiles WHERE created_by NOT IN "
                    + "(SELECT id FROM app_user WHERE email = :ownerEmail)")
            .setParameter("ownerEmail", ownerProperties.ownerEmail())
            .executeUpdate();
        entityManager.createNativeQuery("DELETE FROM app_user WHERE email <> :ownerEmail")
            .setParameter("ownerEmail", ownerProperties.ownerEmail())
            .executeUpdate();
    }
}
