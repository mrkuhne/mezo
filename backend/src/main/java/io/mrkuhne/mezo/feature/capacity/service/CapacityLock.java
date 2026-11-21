package io.mrkuhne.mezo.feature.capacity.service;

import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Serializes the owner's proposal writes (Boop B7 K3, mezo-r36n9.17) — accept, decline, store, regenerate — with a
 * {@code pg_advisory_xact_lock} (the {@code PlannedSkipLock} pattern), so two different proposals accepted at the
 * same moment cannot both claim the same target day, and two first reads of an empty week cannot both store a set.
 * Released by commit or rollback; re-entrant within one transaction.
 */
@Service
@RequiredArgsConstructor
public class CapacityLock {

    private static final long SALT = 0x4d455a4f4b415041L; // "MEZOKAPA"

    private final JdbcTemplate jdbc;

    @Transactional(propagation = Propagation.MANDATORY)
    public void lock(UUID owner) {
        long key = owner.getMostSignificantBits() ^ owner.getLeastSignificantBits() ^ SALT;
        jdbc.execute((ConnectionCallback<Void>) connection -> {
            try (var statement = connection.prepareStatement("select pg_advisory_xact_lock(?)")) {
                statement.setLong(1, key);
                statement.execute();
            }
            return null;
        });
    }
}
