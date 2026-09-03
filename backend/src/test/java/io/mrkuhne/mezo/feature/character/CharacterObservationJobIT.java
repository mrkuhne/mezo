package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.entity.CharacterObservationEntity;
import io.mrkuhne.mezo.feature.character.repository.CharacterObservationRepository;
import io.mrkuhne.mezo.feature.character.service.CharacterObservationJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.data.domain.Pageable;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * CharacterObservationJob's nightly-pass contract (mezo-1gim.3, spec §6): Case A (job on,
 * companion-fake profile) proves the catch-up window heals every finished day that has signals
 * and that a second run writes nothing new (idempotency rides on the service's exists-check).
 * Case B (the cron switch off) proves the bean does not exist at all — the DailySummaryJob/
 * MemoirJob switch-off twin ({@link io.mrkuhne.mezo.feature.proactive.MemoirJobSwitchOffIT}).
 */
class CharacterObservationJobIT {

    @Nested
    @ActiveProfiles("companion-fake")
    class Enabled extends AbstractIntegrationTest {

        @Autowired private CharacterObservationJob job;
        @Autowired private CharacterObservationRepository observationRepository;
        @Autowired private UserPopulator userPopulator;

        @Test
        void testRun_shouldWriteObservationsForYesterdayAndCatchUpWindow_whenSignalsFire() {
            UUID owner = userPopulator.createUser().getId();
            LocalDate yesterday = LocalDate.now().minusDays(1);
            // nothing seeded for the owner -> logging-gap + journal-silence fire (drill) for
            // every finished day in the window, including the catch-up days before yesterday

            job.run();

            assertThat(observationRepository.findByCreatedByOrderByDayDescCreatedAtDesc(owner, Pageable.unpaged()))
                    .extracting(CharacterObservationEntity::getDay)
                    .containsExactlyInAnyOrder(yesterday, yesterday.minusDays(1), yesterday.minusDays(2));

            job.run();

            assertThat(observationRepository.findByCreatedByOrderByDayDescCreatedAtDesc(owner, Pageable.unpaged()))
                    .extracting(CharacterObservationEntity::getDay)
                    .containsExactlyInAnyOrder(yesterday, yesterday.minusDays(1), yesterday.minusDays(2));
        }
    }

    @Nested
    @TestPropertySource(properties = "mezo.techcore.cron.character-observation-job.enabled=false")
    class Disabled extends AbstractIntegrationTest {

        @Autowired private ApplicationContext context;

        @Test
        void testContext_shouldNotContainCharacterObservationJobBean_whenCronSwitchedOff() {
            assertThat(context.getBeanNamesForType(CharacterObservationJob.class)).isEmpty();
        }
    }
}
