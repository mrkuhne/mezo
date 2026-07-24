package io.mrkuhne.mezo.feature.ritual;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.ritual.repository.RitualDayRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.RitualPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** ritual_day DDL + owner-scoped finder + soft-delete round-trip (mezo-hvmx). */
class RitualDayEntityIT extends AbstractIntegrationTest {

    @Autowired private UserPopulator userPopulator;
    @Autowired private RitualPopulator ritualPopulator;
    @Autowired private RitualDayRepository ritualDayRepository;

    @Test
    void testFindByCreatedByAndRitualDate_shouldRoundTrip_whenRowSaved() {
        UUID owner = userPopulator.createUser("ritual-a@test.hu").getId();
        var saved = ritualPopulator.closedDay(owner, LocalDate.now());
        assertThat(ritualDayRepository.findByCreatedByAndRitualDate(owner, LocalDate.now()))
            .hasValueSatisfying(r -> assertThat(r.getId()).isEqualTo(saved.getId()));
    }

    @Test
    void testFindByCreatedByAndRitualDate_shouldHideRow_whenSoftDeleted() {
        UUID owner = userPopulator.createUser("ritual-b@test.hu").getId();
        var saved = ritualPopulator.closedDay(owner, LocalDate.now());
        ritualDayRepository.delete(saved);
        assertThat(ritualDayRepository.findByCreatedByAndRitualDate(owner, LocalDate.now())).isEmpty();
    }
}
