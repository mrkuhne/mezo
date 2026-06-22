package io.mrkuhne.mezo.feature.biometrics.profile;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.BiometricProfileResponse;
import io.mrkuhne.mezo.api.dto.BiometricProfileUpsertRequest;
import io.mrkuhne.mezo.api.dto.LogWeightRequest;
import io.mrkuhne.mezo.api.dto.WeightLogResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/** HTTP round-trips through the GENERATED {@code BiometricProfileApi} contract (api/openapi.yml). */
class BiometricProfileContractIT extends ApiIntegrationTest {

    @Test
    void testGetProfile_shouldReturn404_whenNoneYet() {
        // Service 404s when the owner has no profile row yet.
        getForBody("/api/biometrics/profile", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void testUpsertThenGet_shouldRoundTrip_whenValid() {
        HttpHeaders auth = ownerAuthHeaders();
        BiometricProfileUpsertRequest body = BiometricProfileUpsertRequest.builder()
            .sex("M")
            .heightCm(new BigDecimal("180.0"))
            .birthDate(LocalDate.of(1991, 3, 1))
            .bodyFatPct(new BigDecimal("15.0"))
            .build();

        BiometricProfileResponse upserted =
            putForBody("/api/biometrics/profile", body, auth, HttpStatus.OK, BiometricProfileResponse.class);
        assertThat(upserted.getSex()).isEqualTo(BiometricProfileResponse.SexEnum.M);

        BiometricProfileResponse got =
            getForBody("/api/biometrics/profile", auth, HttpStatus.OK, BiometricProfileResponse.class);
        assertThat(got.getSex()).isEqualTo(BiometricProfileResponse.SexEnum.M);
        assertThat(got.getHeightCm()).isEqualByComparingTo(new BigDecimal("180.0"));
        assertThat(got.getBirthDate()).isEqualTo(LocalDate.of(1991, 3, 1));
        assertThat(got.getBodyFatPct()).isEqualByComparingTo(new BigDecimal("15.0"));
    }

    @Test
    void testGetProfile_shouldCarryDerivedTdeeBootstrap_whenProfileAndWeighInExist() {
        HttpHeaders auth = ownerAuthHeaders();
        BiometricProfileUpsertRequest profile = BiometricProfileUpsertRequest.builder()
            .sex("M")
            .heightCm(new BigDecimal("180.0"))
            .birthDate(LocalDate.of(1991, 3, 1))
            .bodyFatPct(new BigDecimal("15.0"))
            .activityLevel(BiometricProfileUpsertRequest.ActivityLevelEnum.MODERATE)
            .build();
        putForBody("/api/biometrics/profile", profile, auth, HttpStatus.OK, BiometricProfileResponse.class);
        postForBody("/api/biometrics/weight",
            new LogWeightRequest(LocalDate.of(2026, 6, 1), new BigDecimal("84.00"), null),
            auth, HttpStatus.CREATED, WeightLogResponse.class);

        BiometricProfileResponse got =
            getForBody("/api/biometrics/profile", auth, HttpStatus.OK, BiometricProfileResponse.class);

        // Derived (NOT persisted) — present once a profile-and-weigh-in pair exists.
        assertThat(got.getTdeeBootstrap()).isNotNull();
        assertThat(got.getTdeeBootstrap().getBmr()).isPositive();
        assertThat(got.getTdeeBootstrap().getTdee()).isPositive();
    }

    @Test
    void testGetProfile_shouldOmitTdeeBootstrap_whenNoWeighIn() {
        HttpHeaders auth = ownerAuthHeaders();
        BiometricProfileUpsertRequest profile = BiometricProfileUpsertRequest.builder()
            .sex("M")
            .heightCm(new BigDecimal("180.0"))
            .birthDate(LocalDate.of(1991, 3, 1))
            .build();
        putForBody("/api/biometrics/profile", profile, auth, HttpStatus.OK, BiometricProfileResponse.class);

        BiometricProfileResponse got =
            getForBody("/api/biometrics/profile", auth, HttpStatus.OK, BiometricProfileResponse.class);

        // Profile but no weigh-in → derived bootstrap is null.
        assertThat(got.getTdeeBootstrap()).isNull();
    }

    @Test
    void testUpsert_shouldReturn400_whenSexInvalid() {
        // sex carries @NotNull @Pattern("^(M|F)$"); a non-null bad value is a @Pattern violation
        // -> GlobalExceptionHandler default branch -> VALIDATION_INVALID_VALUE (cf. SportContractIT kind).
        BiometricProfileUpsertRequest body = BiometricProfileUpsertRequest.builder()
            .sex("X")
            .heightCm(new BigDecimal("180.0"))
            .birthDate(LocalDate.of(1991, 3, 1))
            .build();

        String resp =
            putForBody("/api/biometrics/profile", body, ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(resp, "sex", "VALIDATION_INVALID_VALUE");
    }
}
