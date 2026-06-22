package io.mrkuhne.mezo.feature.biometrics.profile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.BiometricProfileResponse;
import io.mrkuhne.mezo.api.dto.BiometricProfileUpsertRequest;
import io.mrkuhne.mezo.feature.biometrics.profile.entity.BiometricProfileEntity;
import io.mrkuhne.mezo.feature.biometrics.profile.repository.BiometricProfileRepository;
import io.mrkuhne.mezo.feature.biometrics.profile.service.BiometricProfileService;
import io.mrkuhne.mezo.feature.goal.engine.service.TdeeBootstrapService;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.TdeeBootstrapJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class BiometricProfileServiceIT extends AbstractIntegrationTest {

    @Autowired private BiometricProfileService service;
    @Autowired private BiometricProfileRepository repository;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private GoalRepository goalRepository;
    @Autowired private TdeeBootstrapService tdeeBootstrapService;

    @Test
    void testUpsertProfile_shouldReplaceNotDuplicate_whenCalledTwice() {
        UUID user = databasePopulator.populateUser("bp@test.local");

        service.upsertProfile(user, req("M").build());
        BiometricProfileResponse second = service.upsertProfile(user, req("F").build());

        assertThat(second.getSex()).isEqualTo(BiometricProfileResponse.SexEnum.F);
        assertThat(repository.findByCreatedByAndDeletedFalse(user)).isPresent();
        // one per owner — upsert, not insert
        assertThat(repository.findAll()).hasSize(1);
    }

    @Test
    void testGetProfile_shouldReturnProfile_whenItExists() {
        UUID user = databasePopulator.populateUser("bp-get@test.local");
        service.upsertProfile(user, req("M").build());

        BiometricProfileResponse response = service.getProfile(user);

        assertThat(response.getSex()).isEqualTo(BiometricProfileResponse.SexEnum.M);
        assertThat(response.getHeightCm()).isEqualByComparingTo(new BigDecimal("180.0"));
        assertThat(response.getBirthDate()).isEqualTo(LocalDate.of(1991, 3, 1));
        assertThat(response.getBodyFatPct()).isEqualByComparingTo(new BigDecimal("15.0"));
    }

    @Test
    void testGetProfile_shouldThrowNotFound_whenNoProfile() {
        UUID user = databasePopulator.populateUser("bp-none@test.local");

        assertThatThrownBy(() -> service.getProfile(user))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }

    @Test
    void testUpsertProfile_shouldPersistActivityLevel_whenProvided() {
        UUID user = databasePopulator.populateUser("bp-pal@test.local");

        BiometricProfileResponse response = service.upsertProfile(user,
            req("M").activityLevel(BiometricProfileUpsertRequest.ActivityLevelEnum.MODERATE).build());

        assertThat(response.getActivityLevel())
            .isEqualTo(BiometricProfileResponse.ActivityLevelEnum.MODERATE);
        assertThat(repository.findByCreatedByAndDeletedFalse(user).orElseThrow().getActivityLevel())
            .isEqualTo("MODERATE");
    }

    @Test
    void testUpsertProfile_shouldLeaveActivityLevelNull_whenOmitted() {
        UUID user = databasePopulator.populateUser("bp-pal-null@test.local");

        BiometricProfileResponse response = service.upsertProfile(user, req("M").build());

        assertThat(response.getActivityLevel()).isNull();
    }

    @Test
    void testGetProfile_shouldDeriveTdeeBootstrap_whenProfileAndWeighInExist() {
        UUID user = databasePopulator.populateUser("bp-tdee@test.local");
        // 84kg / 180cm / 15% bodyfat / MODERATE PAL — derived from this exact pair.
        service.upsertProfile(user,
            req("M").activityLevel(BiometricProfileUpsertRequest.ActivityLevelEnum.MODERATE).build());
        weightLogPopulator.createWeightLog(user, LocalDate.of(2026, 6, 1), new BigDecimal("84.00"));

        BiometricProfileResponse response = service.getProfile(user);

        // Same source of truth: assert the response matches TdeeBootstrapService.compute on the same inputs.
        BiometricProfileEntity profile = repository.findByCreatedByAndDeletedFalse(user).orElseThrow();
        TdeeBootstrapJson expected = tdeeBootstrapService.compute(profile, new BigDecimal("84.00"));
        assertThat(response.getTdeeBootstrap()).isNotNull();
        assertThat(response.getTdeeBootstrap().getBmr()).isEqualByComparingTo(expected.bmr());
        assertThat(response.getTdeeBootstrap().getTdee()).isEqualByComparingTo(expected.tdee());
        assertThat(response.getTdeeBootstrap().getPal()).isEqualByComparingTo(expected.pal());
    }

    @Test
    void testGetProfile_shouldLeaveTdeeBootstrapNull_whenNoWeighIn() {
        UUID user = databasePopulator.populateUser("bp-tdee-noweight@test.local");
        service.upsertProfile(user, req("M").build());

        BiometricProfileResponse response = service.getProfile(user);

        // Profile exists but no weigh-in → TDEE basis is missing → derived bootstrap stays null.
        assertThat(response.getTdeeBootstrap()).isNull();
    }

    @Test
    void testUpsertProfile_shouldRecomputeActiveGoal_whenActiveGoalExists() {
        UUID user = databasePopulator.populateUser("bp-recompute@test.local");
        weightLogPopulator.createWeightLog(user, LocalDate.of(2026, 6, 1), new BigDecimal("84.00"));
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "active");
        // Fresh goal: prescription not yet generated.
        assertThat(goal.getPrescription()).isNull();

        // Upserting the profile gives the engine its inputs → it recomputes the active goal.
        service.upsertProfile(user,
            req("M").activityLevel(BiometricProfileUpsertRequest.ActivityLevelEnum.MODERATE).build());

        GoalEntity recomputed = goalRepository.findById(goal.getId()).orElseThrow();
        assertThat(recomputed.getPrescription()).isNotNull();
        assertThat(recomputed.getTdeeBootstrap()).isNotNull();
    }

    @Test
    void testUpsertProfile_shouldSucceed_whenNoActiveGoal() {
        UUID user = databasePopulator.populateUser("bp-recompute-none@test.local");
        // No active goal — the recompute trigger must be a graceful no-op, never break the save.
        BiometricProfileResponse response = service.upsertProfile(user, req("M").build());

        assertThat(response.getSex()).isEqualTo(BiometricProfileResponse.SexEnum.M);
        assertThat(repository.findByCreatedByAndDeletedFalse(user)).isPresent();
    }

    @Test
    void testActivityLevel_shouldBeRejectedByCheck_whenInvalidValue() {
        UUID user = databasePopulator.populateUser("bp-pal-bad@test.local");
        BiometricProfileEntity e = new BiometricProfileEntity();
        e.setCreatedBy(user);
        e.setSex("M");
        e.setHeightCm(new BigDecimal("180.0"));
        e.setBirthDate(LocalDate.of(1991, 3, 1));
        e.setActivityLevel("ATHLETE"); // not in the CHECK set

        assertThatThrownBy(() -> repository.saveAndFlush(e))
            .hasMessageContaining("ck_biometric_profile_activity_level");
    }

    private static BiometricProfileUpsertRequest.BiometricProfileUpsertRequestBuilder req(String sex) {
        return BiometricProfileUpsertRequest.builder()
            .sex(sex)
            .heightCm(new BigDecimal("180.0"))
            .birthDate(LocalDate.of(1991, 3, 1))
            .bodyFatPct(new BigDecimal("15.0"));
    }
}
