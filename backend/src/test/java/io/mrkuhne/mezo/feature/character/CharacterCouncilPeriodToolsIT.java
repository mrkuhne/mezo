package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.service.CharacterCouncilEvidenceTools;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@ActiveProfiles("companion-fake")
@Transactional
class CharacterCouncilPeriodToolsIT extends AbstractIntegrationTest {
    @Autowired private CharacterCouncilEvidenceTools tools;
    @Autowired private DatabasePopulator users;
    @Autowired private SleepLogPopulator sleep;
    @Autowired private ObjectMapper json;

    @Test
    void testCompare_shouldCalculateOnlyRecordedOwnedNights_whenCoverageIsSparse() {
        var owner = users.populateUser("council-period@test.local");
        var foreign = users.populateUser("council-period-foreign@test.local");
        sleep.createSleepLog(owner, LocalDate.of(2026, 9, 1), new BigDecimal("5"), 3);
        sleep.createSleepLog(owner, LocalDate.of(2026, 9, 7), new BigDecimal("7"), 3);
        sleep.createSleepLog(foreign, LocalDate.of(2026, 9, 2), new BigDecimal("12"), 3);
        var session = tools.open(owner);
        var callback = session.callbacks().stream().filter(tool -> tool.getToolDefinition().name()
                .equals("compare_council_periods")).findFirst().orElseThrow();
        var result = json.readTree(callback.call("{\"from\":\"2026-09-01\",\"to\":\"2026-09-07\","
                + "\"baselineFrom\":\"2026-08-25\",\"baselineTo\":\"2026-08-31\"}", new ToolContext(session.context())));
        assertThat(result.path("current").path("calendarDays").asInt()).isEqualTo(7);
        assertThat(result.path("current").path("sleepLoggedDays").asInt()).isEqualTo(2);
        assertThat(result.path("current").path("meanSleepHours").decimalValue()).isEqualByComparingTo("6.00");
        assertThat(result.path("baseline").path("meanSleepHours").isNull()).isTrue();
        assertThat(result.path("baseline").path("sleepLoggedDays").asInt()).isZero();
        assertThat(session.successfulToolNames(0)).containsExactly("compare_council_periods");
    }
}
