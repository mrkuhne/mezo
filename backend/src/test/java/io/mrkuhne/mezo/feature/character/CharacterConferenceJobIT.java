package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.entity.CharacterObservationEntity;
import io.mrkuhne.mezo.feature.character.entity.ObservationDimensionKeysEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ObservationSignalsEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterConferenceRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterObservationRepository;
import io.mrkuhne.mezo.feature.character.service.CharacterConferenceJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * CharacterConferenceJob's weekly-pass contract (mezo-1gim.5, spec §6): Case A (job on,
 * companion-fake profile) proves a WEEKLY konzílium row is held for the week that just finished
 * once unconsumed observations exist for it, and that a second run adds no second row
 * (idempotency rides on {@link io.mrkuhne.mezo.feature.character.service.CharacterConferenceService}'s
 * existing-row short-circuit). Case B (the cron switch off) proves the bean does not exist at all
 * — the CharacterObservationJob/DailySummaryJob switch-off twin.
 */
class CharacterConferenceJobIT {

    /** The same derivation {@link CharacterConferenceJob#run()} uses: a Sunday run targets the
     *  week that is ENDING today. Computed identically here so the test never breaks on a
     *  specific day. */
    private static LocalDate targetWeekStart() {
        return LocalDate.now().minusDays(6).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    @Nested
    @ActiveProfiles("companion-fake")
    class Enabled extends AbstractIntegrationTest {

        @Autowired private CharacterConferenceJob job;
        @Autowired private CharacterConferenceRepository conferenceRepository;
        @Autowired private CharacterObservationRepository observationRepository;
        @Autowired private UserPopulator userPopulator;

        @Test
        void testRun_shouldHoldKonziliumForFinishedWeek_whenUnconsumedObservationsExist() {
            UUID owner = userPopulator.createUser().getId();
            LocalDate weekStart = targetWeekStart();
            seedObservation(owner, weekStart.plusDays(1), "3 napja nincs kaja-log.");

            job.run();

            assertThat(conferenceRepository.findByCreatedByAndKindAndWeekStart(owner, "WEEKLY", weekStart))
                    .isPresent();

            job.run();

            List<CharacterConferenceRepository.Summary> summaries =
                    conferenceRepository.findByCreatedByOrderByGeneratedAtDesc(owner);
            assertThat(summaries).hasSize(1);
        }

        private void seedObservation(UUID owner, LocalDate day, String text) {
            CharacterObservationEntity entity = new CharacterObservationEntity();
            entity.setCreatedBy(owner);
            entity.setExpertKey("drill");
            entity.setDimensionKeys(new ObservationDimensionKeysEnvelope(List.of("discipline")));
            entity.setDay(day);
            entity.setText(text);
            entity.setSalience((short) 4);
            entity.setSignals(new ObservationSignalsEnvelope(List.of()));
            observationRepository.save(entity);
        }
    }

    @Nested
    @TestPropertySource(properties = "mezo.techcore.cron.character-conference-job.enabled=false")
    class Disabled extends AbstractIntegrationTest {

        @Autowired private ApplicationContext context;

        @Test
        void testContext_shouldNotContainCharacterConferenceJobBean_whenCronSwitchedOff() {
            assertThat(context.getBeanNamesForType(CharacterConferenceJob.class)).isEmpty();
        }
    }
}
