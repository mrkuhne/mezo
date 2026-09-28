package io.mrkuhne.mezo.feature.train.service;

import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Serializes planned-skip upsert/undo for one owner (Kihagyás S1, mezo-q4xt2.1) — the same
 * {@code pg_advisory_xact_lock} pattern as {@code CharacterMutationLock}, held BEFORE the
 * existence lookup in {@code PlannedSkipService#upsert} so two quick double-taps of the same
 * target resolve to one row rather than a race on the unique index.
 */
@Service
@RequiredArgsConstructor
public class PlannedSkipLock {
    private final JdbcTemplate jdbc;

    @Transactional(propagation = Propagation.MANDATORY)
    public void lock(UUID owner) {
        long key = owner.getMostSignificantBits() ^ owner.getLeastSignificantBits() ^ 0x4d455a4f534b4950L;
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
