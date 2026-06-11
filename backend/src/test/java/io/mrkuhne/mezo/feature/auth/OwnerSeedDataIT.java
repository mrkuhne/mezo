package io.mrkuhne.mezo.feature.auth;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
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
}
