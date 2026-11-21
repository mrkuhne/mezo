package io.mrkuhne.mezo.feature.capacity;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CapacityEventFeedbackRequest;
import io.mrkuhne.mezo.api.dto.CapacityEventFeedbackRequest.EffectEnum;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.boop.port.BoopCapacityPort;
import io.mrkuhne.mezo.feature.capacity.entity.CapacityEventFeedbackEntity;
import io.mrkuhne.mezo.feature.capacity.repository.CapacityEventFeedbackRepository;
import io.mrkuhne.mezo.feature.wearable.entity.CalendarEventEntity;
import io.mrkuhne.mezo.feature.wearable.repository.CalendarEventRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CalendarEventPopulator;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * Boop B7 K2 Task 9 (mezo-r36n9.17): the owner's label of how an event felt. {@code PUT /api/capacity/event-feedback}
 * stores it (204, no model call), the next day read carries it (the event re-scores through the feedback rules), the
 * demand item carries the event key the phone sends back, and a second label replaces the first.
 */
class CapacityFeedbackIT extends ApiIntegrationTest {

    private static final ZoneId BUD = ZoneId.of("Europe/Budapest");
    /** A device id with '/' and ':' — why the key travels in the body, not the path. */
    private static final String KEY = "cal-ABC/123:x";

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private CalendarEventPopulator calendarPopulator;
    @Autowired private CalendarEventRepository calendarEvents;
    @Autowired private CapacityEventFeedbackRepository feedback;
    @Autowired private BoopCapacityPort capacity;

    private static CapacityEventFeedbackRequest body(String key, EffectEnum effect) {
        CapacityEventFeedbackRequest r = new CapacityEventFeedbackRequest();
        r.setEventKey(key);
        r.setEffect(effect);
        return r;
    }

    private static BoopCapacityPort.Item item(BoopCapacityPort.View v, String label) {
        return v.demand().stream().filter(i -> label.equals(i.label())).findFirst().orElseThrow();
    }

    @Test
    void feedbackRescoresEvent() {
        UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
        LocalDate day = LocalDate.now(BUD);
        CalendarEventEntity e = calendarPopulator.createEvent(owner, day, "Tervezés",
            day.atTime(9, 0).atZone(BUD).toInstant(), day.atTime(12, 0).atZone(BUD).toInstant());
        e.setExternalId(KEY + "|2026-11-23T08:00:00Z");
        e.setAttendeeCount(4);
        calendarEvents.saveAndFlush(e);

        BoopCapacityPort.View before = capacity.read(owner, day);
        BoopCapacityPort.Item b = item(before, "Tervezés");
        assertThat(b.eventKey()).isEqualTo(KEY);       // the occurrence part is stripped
        assertThat(b.level()).isNotEqualTo("tolt");
        assertThat(b.effect()).isNull();               // no label yet

        putForBody("/api/capacity/event-feedback", body(KEY, EffectEnum.FEEDS), ownerAuthHeaders(),
            HttpStatus.NO_CONTENT, String.class);

        BoopCapacityPort.View after = capacity.read(owner, day);
        assertThat(item(after, "Tervezés").level()).isEqualTo("tolt");
        assertThat(item(after, "Tervezés").effect()).isEqualTo("feeds"); // his label travels back to the phone
        assertThat(after.demandUnits()).isLessThan(before.demandUnits());

        // a second label replaces the first (one row per event key)
        putForBody("/api/capacity/event-feedback", body(KEY, EffectEnum.DRAINS), ownerAuthHeaders(),
            HttpStatus.NO_CONTENT, String.class);
        List<CapacityEventFeedbackEntity> rows = feedback.findByCreatedByAndDeletedFalse(owner);
        assertThat(rows).extracting(CapacityEventFeedbackEntity::getEventKey).containsExactly(KEY);
        assertThat(rows).extracting(CapacityEventFeedbackEntity::getEffect).containsExactly("drains");
        BoopCapacityPort.Item relabelled = item(capacity.read(owner, day), "Tervezés");
        assertThat(relabelled.level()).isNotEqualTo("tolt");
        assertThat(relabelled.effect()).isEqualTo("drains");
    }

    @Test
    void badFeedbackIs400AndStoresNothing() {
        UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());

        String bad = putForBody("/api/capacity/event-feedback",
            java.util.Map.of("eventKey", KEY, "effect", "valami"), ownerAuthHeaders(), HttpStatus.BAD_REQUEST,
            String.class);
        assertThat(bad).isNotBlank();
        putForBody("/api/capacity/event-feedback", java.util.Map.of("eventKey", "", "effect", "feeds"),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertThat(feedback.findByCreatedByAndDeletedFalse(owner)).isEmpty();
    }
}
