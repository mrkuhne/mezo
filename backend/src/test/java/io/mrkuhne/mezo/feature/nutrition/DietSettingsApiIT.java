package io.mrkuhne.mezo.feature.nutrition;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.DietSettingsResponse;
import io.mrkuhne.mezo.api.dto.SetDietSettingsRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.goal.service.GoalService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/** HTTP round-trips through the generated {@code DietSettingsApi} contract. */
class DietSettingsApiIT extends ApiIntegrationTest {

    @Autowired private GoalRepository goalRepository;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private BiometricProfilePopulator profilePopulator;
    @Autowired private GoalService goalService;
    @Autowired private OwnerProperties ownerProperties;

    @Test
    void testGetDietSettings_shouldReturnConfigDefaultGhost_whenNoneSet() {
        DietSettingsResponse s =
            getForBody("/api/diet/settings", ownerAuthHeaders(), HttpStatus.OK, DietSettingsResponse.class);

        assertThat(s.getSplitPreset()).isEqualTo(DietSettingsResponse.SplitPresetEnum.BALANCED);
        assertThat(s.getProteinTier()).isEqualTo(DietSettingsResponse.ProteinTierEnum.MODERATE);
        assertThat(s.getWaterMl()).isEqualTo(4000);
        assertThat(s.getFiberG()).isEqualTo(30);
    }

    @Test
    void testSetDietSettings_shouldUpsertSingleRow_whenSavedTwice() {
        HttpHeaders auth = ownerAuthHeaders();
        putForBody("/api/diet/settings",
            SetDietSettingsRequest.builder()
                .splitPreset(SetDietSettingsRequest.SplitPresetEnum.LOW_CARB)
                .proteinTier(SetDietSettingsRequest.ProteinTierEnum.HIGH)
                .waterMl(3500).fiberG(35).build(),
            auth, HttpStatus.OK, DietSettingsResponse.class);
        DietSettingsResponse second = putForBody("/api/diet/settings",
            SetDietSettingsRequest.builder()
                .splitPreset(SetDietSettingsRequest.SplitPresetEnum.CUSTOM)
                .proteinPctX10(300).carbsPctX10(400).fatPctX10(300)
                .proteinTier(SetDietSettingsRequest.ProteinTierEnum.MODERATE)
                .waterMl(4000).fiberG(30).build(),
            auth, HttpStatus.OK, DietSettingsResponse.class);

        assertThat(second.getSplitPreset()).isEqualTo(DietSettingsResponse.SplitPresetEnum.CUSTOM);
        assertThat(second.getFatPctX10()).isEqualTo(300);

        DietSettingsResponse read =
            getForBody("/api/diet/settings", auth, HttpStatus.OK, DietSettingsResponse.class);
        assertThat(read.getSplitPreset()).isEqualTo(DietSettingsResponse.SplitPresetEnum.CUSTOM);
    }

    @Test
    void testSetDietSettings_shouldReturn400_whenCustomSplitDoesNotSumTo1000() {
        SetDietSettingsRequest bad = SetDietSettingsRequest.builder()
            .splitPreset(SetDietSettingsRequest.SplitPresetEnum.CUSTOM)
            .proteinPctX10(300).carbsPctX10(300).fatPctX10(300) // 900 ≠ 1000
            .proteinTier(SetDietSettingsRequest.ProteinTierEnum.MODERATE)
            .waterMl(4000).fiberG(30).build();

        putForBody("/api/diet/settings", bad, ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
    }

    @Test
    void testDietSettingsEndpoints_shouldReturn401_whenNoToken() {
        getForBody("/api/diet/settings", null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testSetDietSettings_shouldReprescribeActiveGoal_withNewSplit() {
        UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
        HttpHeaders auth = ownerAuthHeaders();
        profilePopulator.create(owner);
        GoalEntity goal = goalPopulator.createGoal(owner, "cut", "planned");
        BigDecimal seededWeightKg = goal.getStartWeightKg(); // no weigh-ins => engine falls back to this
        goalService.activateGoal(owner, goal.getId()); // initial recompute (balanced ghost split)

        // Act: switch to low_carb (fat share 0.40).
        putForBody("/api/diet/settings",
            SetDietSettingsRequest.builder()
                .splitPreset(SetDietSettingsRequest.SplitPresetEnum.LOW_CARB)
                .proteinTier(SetDietSettingsRequest.ProteinTierEnum.MODERATE)
                .waterMl(4000).fiberG(30).build(),
            auth, HttpStatus.OK, DietSettingsResponse.class);

        // Assert: the active goal's prescription segments now carry fatG ≈ 0.40×kcal/9 (>= floor).
        GoalEntity reloaded = goalRepository
            .findByCreatedByAndStatusAndDeletedFalse(owner, "active").get(0);
        GoalPrescriptionJson.Segment seg = reloaded.getPrescription().segments().get(0);
        assertThat(seg.fatG())
            .isEqualTo((int) Math.round(
                Math.max(seg.kcal() * 0.40 / 9.0, 0.5 * seededWeightKg.doubleValue())));
    }
}
