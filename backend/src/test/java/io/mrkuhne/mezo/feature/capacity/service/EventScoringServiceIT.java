package io.mrkuhne.mezo.feature.capacity.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.capacity.entity.CapacityEventFeedbackEntity;
import io.mrkuhne.mezo.feature.capacity.entity.FeedbackEffect;
import io.mrkuhne.mezo.feature.capacity.repository.CapacityEventFeedbackRepository;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.wearable.entity.CalendarEventEntity;
import io.mrkuhne.mezo.feature.wearable.repository.CalendarEventRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/** Boop B7 K1 (mezo-r36n9.17): event scoring — cached by input hash, rule fallback, feedback override. */
@ActiveProfiles("companion-fake")
class EventScoringServiceIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 11, 23);

    @Autowired private EventScoringService service;
    @Autowired private FakeCompanionLlm fakeLlm;
    @Autowired private CalendarEventRepository events;
    @Autowired private CapacityEventFeedbackRepository feedback;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private JdbcTemplate jdbc;

    private CalendarEventEntity event(UUID owner, String externalId, String title) {
        CalendarEventEntity ev = new CalendarEventEntity();
        ev.setCreatedBy(owner);
        ev.setExternalId(externalId);
        ev.setDate(DAY);
        ev.setTitle(title);
        ev.setStartAt(Instant.parse("2026-11-23T09:00:00Z"));
        ev.setEndAt(Instant.parse("2026-11-23T10:00:00Z"));
        ev.setAttendeeCount(4);
        ev.setAttendeeNames(List.of("Anna", "Béla"));
        return events.saveAndFlush(ev);
    }

    @Test
    void scoresOnceThenCaches() {
        UUID owner = databasePopulator.populateUser("cap-score1@test.local");
        CalendarEventEntity ev = event(owner, "ek-1|2026-11-23T09:00:00Z", "Heti sync");
        int before = fakeLlm.capacityScoreCallCount();

        EventScore first = service.scoresFor(owner, DAY, DAY).get(ev.getId());
        assertThat(first.source()).isEqualTo("llm");
        assertThat(fakeLlm.capacityScoreCallCount()).isEqualTo(before + 1);

        EventScore second = service.scoresFor(owner, DAY, DAY).get(ev.getId());
        assertThat(second).isEqualTo(first);
        assertThat(fakeLlm.capacityScoreCallCount()).isEqualTo(before + 1);
        // jsonb round trip of the attendee names the hash and prompt rest on
        assertThat(jdbc.queryForObject("select attendee_names::text from calendar_event where id = ?", String.class,
            ev.getId())).contains("Anna").contains("Béla");
        assertThat(events.findById(ev.getId()).orElseThrow().getAttendeeNames()).containsExactly("Anna", "Béla");
    }

    @Test
    void changedTitleRescores() {
        UUID owner = databasePopulator.populateUser("cap-score2@test.local");
        CalendarEventEntity ev = event(owner, "ek-2|2026-11-23T09:00:00Z", "Heti sync");
        service.scoresFor(owner, DAY, DAY);
        int before = fakeLlm.capacityScoreCallCount();

        ev.setTitle("Negyedéves terv");
        events.saveAndFlush(ev);
        service.scoresFor(owner, DAY, DAY);

        assertThat(fakeLlm.capacityScoreCallCount()).isEqualTo(before + 1);
        assertThat(jdbc.queryForObject("select count(*) from calendar_event_score where event_id = ?", Integer.class,
            ev.getId())).isEqualTo(2);
    }

    @Test
    void llmFailureFallsBackToRuleScore() {
        UUID owner = databasePopulator.populateUser("cap-score3@test.local");
        CalendarEventEntity ev = event(owner, "ek-3|2026-11-23T09:00:00Z", "Sync " + FakeCompanionLlm.FAIL_COMPLETE);

        EventScore s = service.scoresFor(owner, DAY, DAY).get(ev.getId());

        assertThat(s.source()).isEqualTo("rule");
        assertThat(s.mental()).isEqualTo(2);
        assertThat(s.social()).isEqualTo(2);
    }

    @Test
    void feedbackFeedsWins() {
        UUID owner = databasePopulator.populateUser("cap-score4@test.local");
        CalendarEventEntity ev = event(owner, "ek-4|2026-11-23T09:00:00Z", "Heti sync");
        CapacityEventFeedbackEntity label = new CapacityEventFeedbackEntity();
        label.setCreatedBy(owner);
        label.setEventKey("ek-4"); // the occurrence part is dropped: one label per recurring event
        label.setEffect(FeedbackEffect.FEEDS.value());
        feedback.saveAndFlush(label);

        EventScore s = service.scoresFor(owner, DAY, DAY).get(ev.getId());

        assertThat(s.restores()).isTrue();
        assertThat(s.mental()).isLessThanOrEqualTo(1);
        assertThat(s.social()).isLessThanOrEqualTo(1);
        assertThat(s.physical()).isLessThanOrEqualTo(1);
    }

    @Test
    void drainsLiftsTheMainComponent() {
        EventScore weak = new EventScore(UUID.randomUUID(), 1, 0, 0, false, "meeting", 0.8, "llm");
        EventScore s = EventScoringService.applyFeedback(weak, FeedbackEffect.DRAINS);
        assertThat(s.mental()).isEqualTo(2);
    }
}
