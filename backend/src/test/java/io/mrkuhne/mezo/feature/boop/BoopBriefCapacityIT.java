package io.mrkuhne.mezo.feature.boop;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;

import io.mrkuhne.mezo.api.dto.BoopBrief;
import io.mrkuhne.mezo.api.dto.BoopCapacity;
import io.mrkuhne.mezo.api.dto.BoopCapacityDemandItem;
import io.mrkuhne.mezo.feature.boop.service.BoopBriefService;
import io.mrkuhne.mezo.feature.capacity.entity.CapacityEventFeedbackEntity;
import io.mrkuhne.mezo.feature.capacity.repository.CapacityEventFeedbackRepository;
import io.mrkuhne.mezo.feature.wearable.entity.CalendarEventEntity;
import io.mrkuhne.mezo.feature.wearable.repository.CalendarEventRepository;
import io.mrkuhne.mezo.support.populator.CalendarEventPopulator;
import io.mrkuhne.mezo.feature.capacity.service.BoopCapacityAdapter;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.annotation.Transactional;

/** Boop B7 K1 Task 6 (mezo-r36n9.17): the brief's capacity block, and the brief serving without it when the
 *  capacity read fails. */
@Transactional
@ActiveProfiles("companion-fake")
class BoopBriefCapacityIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.parse("2026-11-10");
    private static final Instant NOW =
        LocalDateTime.of(DAY, LocalTime.of(8, 30)).atZone(ZoneId.of("Europe/Budapest")).toInstant();

    @Autowired private BoopBriefService service;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private CalendarEventPopulator calendarPopulator;
    @Autowired private CalendarEventRepository calendarEvents;
    @Autowired private CapacityEventFeedbackRepository feedback;
    @MockitoSpyBean private BoopCapacityAdapter adapter;

    @Test
    void demandItemCarriesHisLabelAfterARelaunch() {
        // K2 final fix: the label lives on the server, so a fresh brief read (a relaunch) still shows it
        UUID user = databasePopulator.populateUser("brief-capacity-label@test.local");
        ZoneId bud = ZoneId.of("Europe/Budapest");
        CalendarEventEntity labelled = calendarPopulator.createEvent(user, DAY, "Tervezés",
            DAY.atTime(9, 0).atZone(bud).toInstant(), DAY.atTime(10, 0).atZone(bud).toInstant());
        labelled.setExternalId("cal-label|2026-11-10T08:00:00Z");
        calendarEvents.saveAndFlush(labelled);
        CalendarEventEntity other = calendarPopulator.createEvent(user, DAY, "Ebéd",
            DAY.atTime(12, 0).atZone(bud).toInstant(), DAY.atTime(13, 0).atZone(bud).toInstant());
        other.setExternalId("cal-other|2026-11-10T11:00:00Z");
        calendarEvents.saveAndFlush(other);
        CapacityEventFeedbackEntity f = new CapacityEventFeedbackEntity();
        f.setCreatedBy(user);
        f.setEventKey("cal-label");
        f.setEffect("neutral");
        feedback.saveAndFlush(f);

        BoopBrief b = service.get(user, DAY, NOW);

        assertThat(b.getCapacity().getDemand())
            .filteredOn(i -> "Tervezés".equals(i.getLabel())).singleElement()
            .extracting(BoopCapacityDemandItem::getEffect).isEqualTo(BoopCapacityDemandItem.EffectEnum.NEUTRAL);
        assertThat(b.getCapacity().getDemand())
            .filteredOn(i -> "Ebéd".equals(i.getLabel())).singleElement()
            .extracting(BoopCapacityDemandItem::getEffect).isNull();
    }

    @Test
    void briefCarriesCapacityBlock() {
        UUID user = databasePopulator.populateUser("brief-capacity@test.local");

        BoopBrief b = service.get(user, DAY, NOW);

        BoopCapacity c = b.getCapacity();
        assertThat(c).isNotNull();
        assertThat(c.getVerdict()).isIn((Object[]) BoopCapacity.VerdictEnum.values());
        assertThat(c.getReason()).isNotNull();
        assertThat(c.getCalendarKnown()).isFalse(); // no calendar rows: the verdict says it does not know
        assertThat(c.getTanulo()).isTrue();         // no history of his own yet
        assertThat(c.getFactors()).allSatisfy(f -> {
            assertThat(f.getLabel()).isNotBlank();
            assertThat(f.getEffect()).isNotNull();
        });
        assertThat(b.getEnergy().getHourly()).hasSize(19);
    }

    @Test
    void briefWithoutCapacityStillServes() {
        UUID user = databasePopulator.populateUser("brief-capacity-fail@test.local");
        try {
            doThrow(new IllegalStateException("capacity down")).when(adapter).read(any(), any());

            BoopBrief b = service.get(user, DAY, NOW);

            assertThat(b.getCapacity()).isNull();
            assertThat(b.getMetrics()).hasSize(5);
            assertThat(b.getEnergy().getHourly()).hasSize(19);
        } finally {
            Mockito.reset(adapter);
        }
    }
}
