package io.mrkuhne.mezo.feature.ritual;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.ritual.entity.RitualDayEntity;
import io.mrkuhne.mezo.feature.ritual.repository.RitualDayRepository;
import io.mrkuhne.mezo.feature.ritual.service.RitualClosedEvent;
import io.mrkuhne.mezo.feature.ritual.service.RitualService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.RitualPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@code RitualClosedEvent} publication wiring for the W1.2 reflection upsert (mezo-b3pp.2).
 *
 * <p>Service-level, not HTTP: {@code ApplicationEvents} only records what is published on the
 * TEST's own thread, and {@code RitualApiIT} drives Tomcat worker threads, so the publication
 * would go unseen there. The {@code MesocycleCloseReportIT} idiom — call the service directly
 * and assert on the recorded stream.
 *
 * <p>Pins the publication CONTRACT only — that the right sites publish exactly once. What the
 * AFTER_COMMIT consumer then does with the event is {@code RitualReflectionEmbeddingIT}'s job.
 */
@Transactional
@RecordApplicationEvents
class RitualReflectionEventIT extends AbstractIntegrationTest {

    @Autowired private RitualService ritualService;
    @Autowired private UserPopulator userPopulator;
    @Autowired private RitualPopulator ritualPopulator;
    @Autowired private RitualDayRepository ritualDayRepository;
    @Autowired private ApplicationEvents events;

    @Test
    void testSaveReflection_shouldPublishRitualClosedEvent_whenTheDayIsAlreadyClosed() {
        UUID owner = userPopulator.createUser("ritual-evt-a@test.hu").getId();
        RitualDayEntity closed = ritualPopulator.closedDay(owner, LocalDate.now());

        ritualService.saveReflection(owner, LocalDate.now(), "Utólag pontosítom.");

        // exactly one re-embed request, carrying the row whose prose actually changed
        assertThat(events.stream(RitualClosedEvent.class)).singleElement()
            .satisfies(e -> assertThat(e.ritualDayId()).isEqualTo(closed.getId()));
    }

    @Test
    void testSaveReflection_shouldPublishNothing_whenTheDayIsStillOpen() {
        UUID owner = userPopulator.createUser("ritual-evt-b@test.hu").getId();

        ritualService.saveReflection(owner, LocalDate.now(), "Első kör."); // inserts an open row
        ritualService.saveReflection(owner, LocalDate.now(), "Második kör."); // overwrites it

        // nothing is embeddable before the close — the close itself is what publishes
        assertThat(events.stream(RitualClosedEvent.class)).isEmpty();
    }

    @Test
    void testClose_shouldPublishExactlyOnce_whenTheDayIsClosedTwice() {
        UUID owner = userPopulator.createUser("ritual-evt-c@test.hu").getId();
        ritualService.saveReflection(owner, LocalDate.now(), "Zárás előtti próza.");

        ritualService.close(owner, LocalDate.now());
        ritualService.close(owner, LocalDate.now()); // idempotent repeat — nothing new to embed

        // the closing stamp publishes; the repeat finds closed_at set and skips the branch
        assertThat(events.stream(RitualClosedEvent.class)).singleElement()
            .satisfies(e -> assertThat(e.ritualDayId()).isEqualTo(
                ritualDayRepository.findByCreatedByAndRitualDate(owner, LocalDate.now())
                    .orElseThrow().getId()));
    }

    @Test
    void testClose_shouldPublish_whenTheDayWasNeverTouchedBefore() {
        UUID owner = userPopulator.createUser("ritual-evt-d@test.hu").getId();

        // no reflection row exists — close inserts an open row and immediately stamps it, and the
        // publication must still fire exactly once (the listener decides there is nothing to embed)
        ritualService.close(owner, LocalDate.now());

        assertThat(events.stream(RitualClosedEvent.class)).hasSize(1);
    }
}
