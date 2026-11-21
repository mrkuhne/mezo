package io.mrkuhne.mezo.feature.companion.tools;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.service.ContextSnapshotAssembler;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.feature.companion.port.CapacityContextPort;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.CalendarEventPopulator;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import java.time.LocalDate;
import java.time.temporal.IsoFields;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/** Boop B7 K2 (mezo-r36n9.17): get_capacity and the snapshot line, over a real (empty-calendar) owner. */
@Transactional
@ActiveProfiles("companion-fake")
@Import(CapacityToolsIT.PinnedClockConfig.class)
class CapacityToolsIT extends AbstractIntegrationTest {

    /** 00:30 Budapest on the 22nd is still the 21st in UTC: a server-zone "today" would read the wrong day. */
    private static final LocalDate OWNER_DAY = LocalDate.of(2026, 11, 22);
    private static final ZoneId BUD = ZoneId.of("Europe/Budapest");

    @TestConfiguration
    static class PinnedClockConfig {
        @Bean
        Clock capacityToolsClock() {
            return Clock.fixed(OWNER_DAY.atTime(0, 30).atZone(BUD).toInstant(), BUD);
        }
    }

    @Autowired private CapacityContextPort port;
    @Autowired private CalendarEventPopulator calendarPopulator;
    @Autowired private CapacityTools tools;
    @Autowired private ContextSnapshotAssembler assembler;
    @Autowired private DatabasePopulator databasePopulator;

    private static ToolContext ctx(UUID userId) {
        return new ToolContext(Map.of(ToolContexts.USER_ID, userId, ToolContexts.AUDIT, new ToolCallAudit(6, 10)));
    }

    @Test
    void todayLineAndWeekLines() {
        UUID owner = databasePopulator.populateUser("cap-tool@test.local");

        String today = tools.getCapacity(null, ctx(owner));
        assertThat(today).startsWith("[Kapacitás] ma: ").contains("tanuló");

        LocalDate d = LocalDate.now();
        String week = d.get(IsoFields.WEEK_BASED_YEAR) + "-W" + String.format("%02d", d.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR));
        String lines = tools.getCapacity(week, ctx(owner));
        assertThat(lines.lines().toList()).hasSize(7);
        assertThat(lines.lines().findFirst().orElseThrow()).startsWith("[Kapacitás] hétfő");
        assertThat(tools.getCapacity(d.toString(), ctx(owner)).lines().count()).isEqualTo(7);
    }

    @Test
    void noArgumentIsTheOwnersDayNotTheServers() {
        UUID owner = databasePopulator.populateUser("cap-tool-zone@test.local");
        calendarPopulator.createEvent(owner, OWNER_DAY, "Tervezés",
            Instant.parse("2026-11-22T07:00:00Z"), Instant.parse("2026-11-22T11:00:00Z"));

        String out = tools.getCapacity(null, ctx(owner));

        assertThat(out).isEqualTo(port.render(owner, OWNER_DAY));
        assertThat(out).isNotEqualTo(port.render(owner, OWNER_DAY.minusDays(1)));
    }

    @Test
    void invalidWeekSaysNoData() {
        UUID owner = databasePopulator.populateUser("cap-tool-bad@test.local");

        assertThat(tools.getCapacity("nem-het", ctx(owner))).isEqualTo("Kapacitás: nincs adat");
    }

    @Test
    void snapshotCarriesTheLineInBothVariants() {
        UUID owner = databasePopulator.populateUser("cap-snap@test.local");
        LocalDate today = LocalDate.now();

        assertThat(assembler.render(owner, today)).contains("[Kapacitás] ma: ");
        assertThat(assembler.renderWithoutBiometrics(owner, today)).contains("[Kapacitás] ma: ");
    }
}
