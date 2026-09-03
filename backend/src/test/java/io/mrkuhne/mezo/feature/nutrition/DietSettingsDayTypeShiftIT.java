package io.mrkuhne.mezo.feature.nutrition;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.DietSettingsResponse;
import io.mrkuhne.mezo.api.dto.SetDietSettingsRequest;
import io.mrkuhne.mezo.feature.nutrition.service.DietSettingsService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** Slice 3: the day-type shift knob rides the diet-settings singleton (ghost 0, persisted round-trip). */
@Transactional
class DietSettingsDayTypeShiftIT extends AbstractIntegrationTest {

    @Autowired private DietSettingsService service;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void ghostServesZeroShiftBeforeFirstSave() {
        DietSettingsResponse ghost = service.getSettings(UUID.randomUUID());
        assertThat(ghost.getDayTypeShiftKcal()).isZero();
    }

    @Test
    void shiftRoundTripsThroughSave() {
        UUID owner = databasePopulator.populateUser("day-type-shift-owner@test.local");
        SetDietSettingsRequest req = buildSaveRequestWithDefaults();
        req.setDayTypeShiftKcal(200);
        service.setSettings(owner, req);
        assertThat(service.getSettings(owner).getDayTypeShiftKcal()).isEqualTo(200);
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
