package io.mrkuhne.mezo.feature.auth;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.fuel.ProtocolSeedData;
import io.mrkuhne.mezo.feature.gamification.GamificationDemoData;
import io.mrkuhne.mezo.feature.goal.GoalReevaluateRunner;
import io.mrkuhne.mezo.feature.people.PeopleSeedData;
import io.mrkuhne.mezo.feature.train.TrainSeedData;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("demodata")
class OwnerSeedDataIT extends AbstractIntegrationTest {

    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerSeedData ownerSeedData;
    @Autowired private ApplicationContext applicationContext;

    @Test
    void testSeed_shouldCreateOwnerOnce_whenProfileActive() {
        long count = appUserRepository.count();
        assertThat(count).isEqualTo(1);
        assertThat(appUserRepository.findByEmail("owner@mezo.local")).isPresent();
    }

    @Test
    void testSeed_shouldRemainSingleOwner_whenRunAgain() {
        ownerSeedData.run();
        assertThat(appUserRepository.count()).isEqualTo(1);
    }

    @Test
    void testDemodataProfile_shouldNotRegisterTrainSeed_whenFixturesProfileAbsent() {
        assertThat(applicationContext.getBeanProvider(TrainSeedData.class).getIfAvailable()).isNull();
    }

    /**
     * S2 (mezo-qw37.2): the owner-specific seeders are opt-in demo content now. A prod
     * ({@code demodata}) boot must create the owner and nothing else — a registered user's
     * first touch bootstraps their own gamification profile / habit catalog lazily.
     */
    @Test
    void testDemodataProfile_shouldNotRegisterOwnerFixtureSeeds_whenFixturesProfileAbsent() {
        assertThat(applicationContext.getBeanProvider(ProtocolSeedData.class).getIfAvailable()).isNull();
        assertThat(applicationContext.getBeanProvider(PeopleSeedData.class).getIfAvailable()).isNull();
        assertThat(applicationContext.getBeanProvider(GamificationDemoData.class).getIfAvailable()).isNull();
        assertThat(applicationContext.getBeanProvider(GoalReevaluateRunner.class).getIfAvailable()).isNull();
    }

    @Test
    void testSeed_shouldMarkOwnerRoleAndOnboarded_whenSeeded() {
        AppUserEntity owner = appUserRepository.findByEmail("owner@mezo.local").orElseThrow();
        assertThat(owner.getRole()).isEqualTo(AppUserEntity.UserRole.OWNER);
        assertThat(owner.getStatus()).isEqualTo(AppUserEntity.UserStatus.ACTIVE);
        assertThat(owner.getOnboardedAt()).isNotNull();
        assertThat(owner.getTimezone()).isEqualTo("Europe/Budapest");
    }
}
