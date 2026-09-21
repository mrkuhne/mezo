package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.character.config.CharacterCouncilBudgetProperties;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Independent operational reservation; a failed model cycle must not refund already attempted calls. */
@Service
@RequiredArgsConstructor
public class CharacterCouncilQuotaLedger {
    private final JdbcTemplate jdbc;
    private final CharacterCouncilBudgetProperties properties;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean reserve(UUID owner, LocalDate day, boolean reply) {
        int autonomous = reply ? 0 : 1;
        return jdbc.update("""
                insert into character_council_quota(created_by, day, total_calls, autonomous_calls)
                values (?, ?, 1, ?)
                on conflict (created_by, day) do update set
                  total_calls = character_council_quota.total_calls + 1,
                  autonomous_calls = character_council_quota.autonomous_calls + excluded.autonomous_calls
                where character_council_quota.total_calls < ?
                  and character_council_quota.autonomous_calls + excluded.autonomous_calls <= ?
                """, owner, day, autonomous, properties.totalDailyCalls(), properties.autonomousDailyCalls()) == 1;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void expire(LocalDate today) {
        jdbc.update("delete from character_council_quota where day < ?", today.minusDays(properties.retentionDays()));
    }
}
