package io.mrkuhne.mezo.feature.biometrics.sleep;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.biometrics.sleep.dto.LogSleepRequest;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepLogService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class SleepLogServiceIT extends AbstractIntegrationTest {

    @Autowired private SleepLogService service;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testList_shouldReturnOnlyOwnRows_whenTwoUsersLog() {
        UUID userA = databasePopulator.populateUser("a@test.local");
        UUID userB = databasePopulator.populateUser("b@test.local");
        service.log(userA, new LogSleepRequest(LocalDate.parse("2026-06-01"), "23:10", "06:40", new BigDecimal("7.50"), 8, 1, null));
        service.log(userB, new LogSleepRequest(LocalDate.parse("2026-06-01"), "00:30", "07:00", new BigDecimal("6.50"), 6, 2, null));

        assertThat(service.list(userA)).hasSize(1);
        assertThat(service.list(userB)).hasSize(1);
    }
}
