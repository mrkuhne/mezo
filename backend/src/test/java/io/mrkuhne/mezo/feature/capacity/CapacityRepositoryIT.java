package io.mrkuhne.mezo.feature.capacity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.capacity.entity.AdjustmentKind;
import io.mrkuhne.mezo.feature.capacity.entity.CalendarEventScoreEntity;
import io.mrkuhne.mezo.feature.capacity.entity.DayAdjustmentEntity;
import io.mrkuhne.mezo.feature.capacity.repository.CalendarEventScoreRepository;
import io.mrkuhne.mezo.feature.capacity.repository.DayAdjustmentRepository;
import io.mrkuhne.mezo.feature.wearable.entity.CalendarEventEntity;
import io.mrkuhne.mezo.feature.wearable.repository.CalendarEventRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

/** Boop B7 K1 (mezo-r36n9.17): the capacity tables — adjustment idempotency key, score keyed by event + input hash. */
@Transactional
class CapacityRepositoryIT extends AbstractIntegrationTest {

    @Autowired private DayAdjustmentRepository adjustments;
    @Autowired private CalendarEventScoreRepository scores;
    @Autowired private CalendarEventRepository events;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void adjustmentClientRefIsUnique() {
        UUID owner = databasePopulator.populateUser("cap1@test.local");
        UUID clientRef = UUID.randomUUID();
        adjustments.saveAndFlush(adjustment(owner, clientRef));

        assertThatThrownBy(() -> adjustments.saveAndFlush(adjustment(owner, clientRef)))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void scoreKeyedByEventAndHash() {
        UUID owner = databasePopulator.populateUser("cap2@test.local");
        CalendarEventEntity ev = new CalendarEventEntity();
        ev.setCreatedBy(owner);
        ev.setExternalId("ek-1|2026-11-23T09:00:00Z");
        ev.setDate(LocalDate.of(2026, 11, 23));
        ev.setTitle("Sync");
        ev.setStartAt(Instant.parse("2026-11-23T09:00:00Z"));
        ev.setEndAt(Instant.parse("2026-11-23T10:00:00Z"));
        ev = events.saveAndFlush(ev);

        scores.saveAndFlush(score(owner, ev.getId(), "hash-a"));
        scores.saveAndFlush(score(owner, ev.getId(), "hash-b"));

        assertThat(scores.findByEventId(ev.getId())).hasSize(2);
        UUID eventId = ev.getId();
        assertThatThrownBy(() -> scores.saveAndFlush(score(owner, eventId, "hash-a")))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    private DayAdjustmentEntity adjustment(UUID owner, UUID clientRef) {
        DayAdjustmentEntity a = new DayAdjustmentEntity();
        a.setCreatedBy(owner);
        a.setDate(LocalDate.of(2026, 11, 23));
        a.setKind(AdjustmentKind.SHORTEN_SESSION.name());
        a.setBundleId(UUID.randomUUID());
        a.setState("active");
        a.setClientRef(clientRef);
        return a;
    }

    private CalendarEventScoreEntity score(UUID owner, UUID eventId, String hash) {
        CalendarEventScoreEntity s = new CalendarEventScoreEntity();
        s.setCreatedBy(owner);
        s.setEventId(eventId);
        s.setInputHash(hash);
        s.setMental((short) 2);
        s.setSocial((short) 1);
        s.setPhysical((short) 0);
        s.setRestores(false);
        s.setKind("meeting");
        s.setConfidence(new BigDecimal("0.80"));
        s.setSource("rule");
        return s;
    }
}
