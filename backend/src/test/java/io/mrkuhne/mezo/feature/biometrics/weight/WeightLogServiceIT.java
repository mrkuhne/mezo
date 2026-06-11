package io.mrkuhne.mezo.feature.biometrics.weight;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.LogWeightRequest;
import io.mrkuhne.mezo.api.dto.WeightLogResponse;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.service.WeightLogService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class WeightLogServiceIT extends AbstractIntegrationTest {

    @Autowired private WeightLogService service;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private WeightLogRepository weightLogRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

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

    @Test
    void testFindAllOwned_shouldExcludeSoftDeletedRows_whenRowDeleted() {
        UUID user = databasePopulator.populateUser("a@test.local");
        // Insert out of date order to prove findAllOwned returns date-ascending (Fix 1).
        service.log(user, new LogWeightRequest(LocalDate.parse("2026-06-03"), new BigDecimal("82.30"), null));
        var first = service.log(user, new LogWeightRequest(LocalDate.parse("2026-06-01"), new BigDecimal("82.50"), null));
        var second = service.log(user, new LogWeightRequest(LocalDate.parse("2026-06-02"), new BigDecimal("82.10"), null));
        var removed = service.list(user).stream()
            .filter(r -> r.getDate().equals(LocalDate.parse("2026-06-03"))).findFirst().orElseThrow();

        weightLogRepository.deleteById(removed.getId()); // @SQLDelete → UPDATE is_deleted = true
        weightLogRepository.flush();

        List<WeightLogResponse> remaining = service.list(user);
        // Soft-deleted row vanishes from findAllOwned; siblings remain, ordered date-ascending.
        assertThat(remaining).hasSize(2);
        assertThat(remaining).extracting(WeightLogResponse::getId).containsExactly(first.getId(), second.getId());
        assertThat(remaining).extracting(WeightLogResponse::getDate)
            .containsExactly(LocalDate.parse("2026-06-01"), LocalDate.parse("2026-06-02"));
        // Physical row still exists, only flagged — soft delete, not a DELETE.
        Long softDeleted = jdbcTemplate.queryForObject(
            "select count(*) from weight_log where is_deleted = true", Long.class);
        assertThat(softDeleted).isEqualTo(1L);
    }
}
