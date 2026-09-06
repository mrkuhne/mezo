package io.mrkuhne.mezo.feature.nutrition;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.DietSettingsPreviewResponse;
import io.mrkuhne.mezo.api.dto.DietSettingsResponse;
import io.mrkuhne.mezo.api.dto.SetDietSettingsRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.biometrics.profile.entity.BiometricProfileEntity;
import io.mrkuhne.mezo.feature.biometrics.profile.repository.BiometricProfileRepository;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.goal.service.GoalService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
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
    @Autowired private BiometricProfileRepository profileRepository;
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
                .waterMl(3500).fiberG(35).dayTypeShiftKcal(0).build(),
            auth, HttpStatus.OK, DietSettingsResponse.class);
        DietSettingsResponse second = putForBody("/api/diet/settings",
            SetDietSettingsRequest.builder()
                .splitPreset(SetDietSettingsRequest.SplitPresetEnum.CUSTOM)
                .proteinPctX10(300).carbsPctX10(400).fatPctX10(300)
                .proteinTier(SetDietSettingsRequest.ProteinTierEnum.MODERATE)
                .waterMl(4000).fiberG(30).dayTypeShiftKcal(0).build(),
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
            .waterMl(4000).fiberG(30).dayTypeShiftKcal(0).build();

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
                .waterMl(4000).fiberG(30).dayTypeShiftKcal(0).build(),
            auth, HttpStatus.OK, DietSettingsResponse.class);

        // Assert: the active goal's prescription segments now carry fatG ≈ 0.40×kcal/9 (>= floor).
        GoalEntity reloaded = goalRepository
            .findByCreatedByAndStatusAndDeletedFalse(owner, "active").get(0);
        GoalPrescriptionJson.Segment seg = reloaded.getPrescription().segments().get(0);
        assertThat(seg.fatG())
            .isEqualTo((int) Math.round(
                Math.max(seg.kcal() * 0.40 / 9.0, 0.5 * seededWeightKg.doubleValue())));
    }

    // ── draft preview (mezo-u2pd) ───────────────────────────────────────────────────────────────

    private static SetDietSettingsRequest draft(
        SetDietSettingsRequest.SplitPresetEnum preset, SetDietSettingsRequest.ProteinTierEnum tier) {
        return SetDietSettingsRequest.builder()
            .splitPreset(preset).proteinTier(tier)
            .waterMl(4000).fiberG(30).dayTypeShiftKcal(0).build();
    }

    /**
     * An ACTIVE goal whose window actually covers TODAY — the preview projects the segment of
     * today's goal-week, so the populator's fixed 2026-06-01..07-27 window would fall outside it
     * and every projection would degrade to the config fallback.
     */
    private GoalEntity activeGoalCoveringToday(UUID owner) {
        GoalEntity goal = goalPopulator.createGoal(owner, "cut", "planned");
        goal.setStartDate(LocalDate.now().minusWeeks(1));
        goal.setTargetDate(LocalDate.now().plusWeeks(7));
        goalRepository.saveAndFlush(goal);
        goalService.activateGoal(owner, goal.getId());
        return goal;
    }

    /** Today's covering segment of the owner's ACTIVE goal — the one the preview projects. */
    private GoalPrescriptionJson.Segment todaysSegment(UUID owner, GoalEntity goal) {
        GoalEntity reloaded =
            goalRepository.findByCreatedByAndStatusAndDeletedFalse(owner, "active").get(0);
        long week = ChronoUnit.DAYS.between(goal.getStartDate(), LocalDate.now()) / 7 + 1;
        return GoalPrescriptionJson.currentSegment(reloaded.getPrescription(), week);
    }

    @Test
    void testPreviewDietSettings_shouldProjectTheDraftSplit_withoutSavingOrReprescribing() {
        UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
        HttpHeaders auth = ownerAuthHeaders();
        profilePopulator.create(owner);
        GoalEntity goal = activeGoalCoveringToday(owner); // prescribed under the balanced ghost split
        BigDecimal seededWeightKg = goal.getStartWeightKg(); // no weigh-ins => engine falls back to this
        GoalPrescriptionJson.Segment before = todaysSegment(owner, goal);

        DietSettingsPreviewResponse preview = postForBody("/api/diet/settings/preview",
            draft(SetDietSettingsRequest.SplitPresetEnum.LOW_CARB,
                SetDietSettingsRequest.ProteinTierEnum.MODERATE),
            auth, HttpStatus.OK, DietSettingsPreviewResponse.class);

        // The projection is the engine's own low_carb (0.40 fat share) number, floored at 0.5 g/kg —
        // and it MOVED off what the saved balanced split prescribes (the mezo-u2pd bug: it did not).
        assertThat(preview.getSource()).isEqualTo(DietSettingsPreviewResponse.SourceEnum.GOAL);
        assertThat(preview.getFatG()).isEqualTo((int) Math.round(
            Math.max(preview.getKcal() * 0.40 / 9.0, 0.5 * seededWeightKg.doubleValue())));
        assertThat(preview.getFatG()).isNotEqualTo(before.fatG());

        // …and NOTHING moved: the goal keeps its balanced prescription and no row was written.
        assertThat(todaysSegment(owner, goal).fatG()).isEqualTo(before.fatG());
        assertThat(getForBody("/api/diet/settings", auth, HttpStatus.OK, DietSettingsResponse.class)
            .getSplitPreset()).isEqualTo(DietSettingsResponse.SplitPresetEnum.BALANCED);
    }

    @Test
    void testPreviewDietSettings_shouldRaiseProtein_whenTheDraftPicksTheHighTier() {
        UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
        HttpHeaders auth = ownerAuthHeaders();
        // No bf% on purpose: with the populator's 15% the LBM path (3.1 g/kg LBM) wins and the
        // 2.6 g/kg BW cap binds for BOTH tiers, so the tier would be invisible. Unknown bf% is the
        // BW path, which is exactly where moderate (2.0) and high (2.2) differ.
        BiometricProfileEntity profile = profilePopulator.create(owner);
        profile.setBodyFatPct(null);
        profileRepository.saveAndFlush(profile);
        activeGoalCoveringToday(owner);

        DietSettingsPreviewResponse moderate = postForBody("/api/diet/settings/preview",
            draft(SetDietSettingsRequest.SplitPresetEnum.BALANCED,
                SetDietSettingsRequest.ProteinTierEnum.MODERATE),
            auth, HttpStatus.OK, DietSettingsPreviewResponse.class);
        DietSettingsPreviewResponse high = postForBody("/api/diet/settings/preview",
            draft(SetDietSettingsRequest.SplitPresetEnum.BALANCED,
                SetDietSettingsRequest.ProteinTierEnum.HIGH),
            auth, HttpStatus.OK, DietSettingsPreviewResponse.class);

        assertThat(high.getProteinG()).isGreaterThan(moderate.getProteinG());
        assertThat(high.getKcal()).isEqualTo(moderate.getKcal()); // the tier never moves the budget
    }

    @Test
    void testPreviewDietSettings_shouldMatchWhatTheSaveProduces() {
        UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
        HttpHeaders auth = ownerAuthHeaders();
        profilePopulator.create(owner);
        GoalEntity goal = activeGoalCoveringToday(owner);
        SetDietSettingsRequest req = draft(SetDietSettingsRequest.SplitPresetEnum.HIGH_CARB,
            SetDietSettingsRequest.ProteinTierEnum.HIGH);

        DietSettingsPreviewResponse preview = postForBody(
            "/api/diet/settings/preview", req, auth, HttpStatus.OK, DietSettingsPreviewResponse.class);
        putForBody("/api/diet/settings", req, auth, HttpStatus.OK, DietSettingsResponse.class);

        // The whole point of routing the preview through the calculator: no drift from the save.
        GoalPrescriptionJson.Segment saved = todaysSegment(owner, goal);
        assertThat(preview.getKcal()).isEqualTo(saved.kcal());
        assertThat(preview.getProteinG()).isEqualTo(saved.proteinG());
        assertThat(preview.getCarbsG()).isEqualTo(saved.carbsG());
        assertThat(preview.getFatG()).isEqualTo(saved.fatG());
    }

    @Test
    void testPreviewDietSettings_shouldFallBackToConfigTargets_whenNoActiveGoal() {
        DietSettingsPreviewResponse preview = postForBody("/api/diet/settings/preview",
            draft(SetDietSettingsRequest.SplitPresetEnum.LOW_FAT,
                SetDietSettingsRequest.ProteinTierEnum.MODERATE),
            ownerAuthHeaders(), HttpStatus.OK, DietSettingsPreviewResponse.class);

        assertThat(preview.getSource()).isEqualTo(DietSettingsPreviewResponse.SourceEnum.CONFIG);
        assertThat(preview.getKcal()).isPositive();
    }

    @Test
    void testPreviewDietSettings_shouldReturn400_whenCustomSplitDoesNotSumTo1000() {
        SetDietSettingsRequest bad = SetDietSettingsRequest.builder()
            .splitPreset(SetDietSettingsRequest.SplitPresetEnum.CUSTOM)
            .proteinPctX10(300).carbsPctX10(300).fatPctX10(300) // 900 ≠ 1000
            .proteinTier(SetDietSettingsRequest.ProteinTierEnum.MODERATE)
            .waterMl(4000).fiberG(30).dayTypeShiftKcal(0).build();

        postForBody("/api/diet/settings/preview", bad, ownerAuthHeaders(),
            HttpStatus.BAD_REQUEST, String.class);
    }
}
