package io.mrkuhne.mezo.feature.biometrics.profile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.BiometricProfileResponse;
import io.mrkuhne.mezo.api.dto.BiometricProfileUpsertRequest;
import io.mrkuhne.mezo.feature.biometrics.profile.repository.BiometricProfileRepository;
import io.mrkuhne.mezo.feature.biometrics.profile.service.BiometricProfileService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
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

    @Test
    void testUpsertProfile_shouldReplaceNotDuplicate_whenCalledTwice() {
        UUID user = databasePopulator.populateUser("bp@test.local");

        service.upsertProfile(user, req("M"));
        BiometricProfileResponse second = service.upsertProfile(user, req("F"));

        assertThat(second.getSex()).isEqualTo(BiometricProfileResponse.SexEnum.F);
        assertThat(repository.findByCreatedByAndDeletedFalse(user)).isPresent();
        // one per owner — upsert, not insert
        assertThat(repository.findAll()).hasSize(1);
    }

    @Test
    void testGetProfile_shouldReturnProfile_whenItExists() {
        UUID user = databasePopulator.populateUser("bp-get@test.local");
        service.upsertProfile(user, req("M"));

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

    private static BiometricProfileUpsertRequest req(String sex) {
        return BiometricProfileUpsertRequest.builder()
            .sex(sex)
            .heightCm(new BigDecimal("180.0"))
            .birthDate(LocalDate.of(1991, 3, 1))
            .bodyFatPct(new BigDecimal("15.0"))
            .build();
    }
}
