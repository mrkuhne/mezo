package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Serializes character mutations for one owner without locking the shared app_user FK row. */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class CharacterMutationLock {
    private final JdbcTemplate jdbc;

    @Transactional(propagation = Propagation.MANDATORY)
    public void lock(UUID owner) {
        long key = owner.getMostSignificantBits() ^ owner.getLeastSignificantBits() ^ 0x4d455a4f43484152L;
        // PostgreSQL transaction advisory locks have no JPA equivalent. Use the transaction's
        // bound connection and let commit/rollback release it, including exceptional paths.
        jdbc.execute((ConnectionCallback<Void>) connection -> {
            try (var statement = connection.prepareStatement("select pg_advisory_xact_lock(?)")) {
                statement.setLong(1, key);
                statement.execute();
            }
            return null;
        });
    }
}
