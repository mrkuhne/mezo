package io.mrkuhne.mezo.feature.boop;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;

import io.mrkuhne.mezo.api.dto.BoopBrief;
import io.mrkuhne.mezo.api.dto.BoopCapacity;
import io.mrkuhne.mezo.feature.boop.service.BoopBriefService;
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
    @MockitoSpyBean private BoopCapacityAdapter adapter;

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
