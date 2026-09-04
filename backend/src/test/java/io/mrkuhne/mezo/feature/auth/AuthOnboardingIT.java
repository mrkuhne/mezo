package io.mrkuhne.mezo.feature.auth;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.BiometricProfileResponse;
import io.mrkuhne.mezo.api.dto.BiometricProfileUpsertRequest;
import io.mrkuhne.mezo.api.dto.GamificationProfileResponse;
import io.mrkuhne.mezo.api.dto.HabitDayResponse;
import io.mrkuhne.mezo.api.dto.LogWeightRequest;
import io.mrkuhne.mezo.api.dto.MeResponse;
import io.mrkuhne.mezo.api.dto.PeopleResponse;
import io.mrkuhne.mezo.api.dto.WeightLogResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/**
 * S2 (mezo-qw37.2): a freshly registered USER lands on a clean slate — no owner fixtures — and
 * the surfaces that used to lean on the demodata seeders bootstrap themselves lazily per user
 * (gamification ghost profile, habit catalog import). The second test walks the OnboardingPage's
 * exact three-call sequence against the real contracts.
 */
class AuthOnboardingIT extends ApiIntegrationTest {

    @Test
    void testFreshUser_shouldGetLazyBootstrapsAndNoOwnerFixtures_whenFirstTouch() {
        RegisteredUser anna = registerUser("Anna");

        GamificationProfileResponse gam = getForBody("/api/gamification/profile",
            anna.headers(), HttpStatus.OK, GamificationProfileResponse.class);
        assertThat(gam.getCoins()).isZero();
        assertThat(gam.getStreakDays()).isZero();
        assertThat(gam.getLevel()).isEqualTo(1);
        assertThat(gam.getEquippedTitleKey()).isEqualTo("ujonc");

        HabitDayResponse day = getForBody("/api/habit/day/" + LocalDate.now(),
            anna.headers(), HttpStatus.OK, HabitDayResponse.class);
        // HabitCatalogService.ensureCatalog imported the seed JSON for Anna, not for the owner only.
        assertThat(day.getHabits()).hasSize(15);

        PeopleResponse people = getForBody("/api/people", anna.headers(), HttpStatus.OK, PeopleResponse.class);
        assertThat(people.getPersons()).isEmpty(); // PeopleSeedData is demofixtures-only now

        BiometricProfileResponse profile = getForBody("/api/biometrics/profile",
            anna.headers(), HttpStatus.OK, BiometricProfileResponse.class);
        assertThat(profile.getBirthDate()).isNull(); // the honest "not set up" 200 (mezo-5cmq)
    }

    @Test
    void testOnboardingSequence_shouldLandProfileWeightAndFlag_whenWizardOrder() {
        RegisteredUser bela = registerUser("Bela");
        assertThat(getForBody("/api/auth/me", bela.headers(), HttpStatus.OK, MeResponse.class).getOnboarded()).isFalse();

        // 1) PUT profile — sex/heightCm/birthDate are the NOT NULL trio, so they go together.
        // The wizard sends activityLevel=MIXED explicitly: `activity_level` is nullable and the
        // server does NOT default it — a null is merely *interpreted* as MIXED downstream
        // (GoalEngineProperties.Neat.forLevel), so the column and the response would stay null.
        putForBody("/api/biometrics/profile",
            BiometricProfileUpsertRequest.builder()
                .sex("M").heightCm(new BigDecimal("181")).birthDate(LocalDate.of(1993, 5, 14))
                .activityLevel(BiometricProfileUpsertRequest.ActivityLevelEnum.MIXED)
                .build(),
            bela.headers(), HttpStatus.OK, BiometricProfileResponse.class);
        // 2) POST today's weigh-in.
        postForBody("/api/biometrics/weight",
            new LogWeightRequest(LocalDate.now(), new BigDecimal("84.5"), null),
            bela.headers(), HttpStatus.CREATED, WeightLogResponse.class);
        // 3) Flag the account onboarded.
        postForBody("/api/auth/onboarding-complete", null, bela.headers(), HttpStatus.NO_CONTENT, Void.class);

        MeResponse me = getForBody("/api/auth/me", bela.headers(), HttpStatus.OK, MeResponse.class);
        assertThat(me.getOnboarded()).isTrue();

        List<WeightLogResponse> log = getForList("/api/biometrics/weight", bela.headers(), HttpStatus.OK, WeightLogResponse.class);
        assertThat(log).hasSize(1);
        assertThat(log.getFirst().getValue()).isEqualByComparingTo(new BigDecimal("84.5"));

        BiometricProfileResponse profile = getForBody("/api/biometrics/profile",
            bela.headers(), HttpStatus.OK, BiometricProfileResponse.class);
        assertThat(profile.getHeightCm()).isEqualByComparingTo(new BigDecimal("181"));
        assertThat(profile.getActivityLevel()).isEqualTo(BiometricProfileResponse.ActivityLevelEnum.MIXED);
        assertThat(profile.getTdeeBootstrap()).isNotNull(); // profile + latest weigh-in pair → derived base TDEE
    }
}
