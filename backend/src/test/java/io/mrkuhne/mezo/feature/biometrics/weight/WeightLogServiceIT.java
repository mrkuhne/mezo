package io.mrkuhne.mezo.feature.biometrics.weight;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.biometrics.weight.dto.LogWeightRequest;
import io.mrkuhne.mezo.feature.biometrics.weight.service.WeightLogService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class WeightLogServiceIT extends AbstractIntegrationTest {

    @Autowired private WeightLogService service;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testList_shouldReturnOnlyOwnRows_whenTwoUsersLog() {
        UUID userA = databasePopulator.populateUser("a@test.local");
        UUID userB = databasePopulator.populateUser("b@test.local");
        service.log(userA, new LogWeightRequest(LocalDate.parse("2026-06-01"), new BigDecimal("82.50"), null));
        service.log(userB, new LogWeightRequest(LocalDate.parse("2026-06-01"), new BigDecimal("70.00"), null));

        assertThat(service.list(userA)).hasSize(1)
            .first().extracting("value").isEqualTo(new BigDecimal("82.50"));
        assertThat(service.list(userB)).hasSize(1);
    }
}
