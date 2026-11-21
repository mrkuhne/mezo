package io.mrkuhne.mezo.feature.boop;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.BoopBrief;
import io.mrkuhne.mezo.feature.boop.service.BoopBriefService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

/** Boop B7 K1 Task 6: with {@code mezo.capacity.enabled=false} the brief serves with capacity null. */
@Transactional
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.capacity.enabled=false")
class BoopBriefCapacityOffIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.parse("2026-11-10");
    private static final Instant NOW =
        LocalDateTime.of(DAY, LocalTime.of(8, 30)).atZone(ZoneId.of("Europe/Budapest")).toInstant();

    @Autowired private BoopBriefService service;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void briefWithoutCapacityStillServes() {
        UUID user = databasePopulator.populateUser("brief-capacity-off@test.local");

        BoopBrief b = service.get(user, DAY, NOW);

        assertThat(b.getCapacity()).isNull();
        assertThat(b.getMetrics()).hasSize(5);
        assertThat(b.getEnergy().getHourly()).hasSize(19);
    }
}
