package io.mrkuhne.mezo.feature.nutrition;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.DietSettingsResponse;
import io.mrkuhne.mezo.api.dto.SetDietSettingsRequest;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.goal.service.GoalService;
import io.mrkuhne.mezo.feature.nutrition.service.DietSettingsService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * The {@code dayTypeShiftKcal} knob still rides the diet-settings singleton (ghost 0, persisted
 * round-trip) but no longer drives a training/rest-day kcal split — retired with the day-type
 * split (mezo-tb3s2, M4): the setting is accepted and ignored, and a save always leaves the
 * recomputed segments split-free.
 */
@Transactional
class DietSettingsDayTypeShiftIT extends AbstractIntegrationTest {

    @Autowired private DietSettingsService service;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private GoalRepository goalRepository;
    @Autowired private GoalService goalService;
    @Autowired private BiometricProfilePopulator profilePopulator;

    @Test
    void ghostServesZeroShiftBeforeFirstSave() {
        DietSettingsResponse ghost = service.getSettings(UUID.randomUUID());
        assertThat(ghost.getDayTypeShiftKcal()).isZero();
    }

    @Test
    void shiftPersistsButLeavesRecomputedSegmentsSplitFree() {
        UUID owner = databasePopulator.populateUser("day-type-shift-owner@test.local");
        profilePopulator.create(owner);
        GoalEntity goal = goalPopulator.createGoal(owner, "cut", "planned");
        goalService.activateGoal(owner, goal.getId()); // initial recompute

        SetDietSettingsRequest req = buildSaveRequestWithDefaults();
        req.setDayTypeShiftKcal(300);
        service.setSettings(owner, req);

        assertThat(service.getSettings(owner).getDayTypeShiftKcal()).isEqualTo(300);

        GoalEntity reloaded = goalRepository
            .findByCreatedByAndStatusAndDeletedFalse(owner, "active").get(0);
        for (GoalPrescriptionJson.Segment seg : reloaded.getPrescription().segments()) {
            assertThat(seg.trainingDayKcal()).isNull();
            assertThat(seg.restDayKcal()).isNull();
        }
    }

    /** Slice 1's required fields, filled with their ghost values — this class is about the shift only. */
    private static SetDietSettingsRequest buildSaveRequestWithDefaults() {
        return SetDietSettingsRequest.builder()
            .splitPreset(SetDietSettingsRequest.SplitPresetEnum.BALANCED)
            .proteinTier(SetDietSettingsRequest.ProteinTierEnum.MODERATE)
            .waterMl(4000)
            .fiberG(30)
            .dayTypeShiftKcal(0)
            .build();
    }
}
