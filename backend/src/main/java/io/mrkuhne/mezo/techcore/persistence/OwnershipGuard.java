package io.mrkuhne.mezo.techcore.persistence;

import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;

/**
 * The foreign-row == 404 invariant in one place: to a caller, a row owned by someone else is
 * indistinguishable from a missing one (CLAUDE.md ownership rules). Services and the progression
 * signal calculators gate by-id reads through this instead of hand-rolling the filter + throw.
 */
public final class OwnershipGuard {

    private OwnershipGuard() {
    }

    /** Resolves a by-id lookup, treating absent and foreign-owned rows identically as 404. */
    public static <T extends OwnedEntity> T ownedOrThrow(Optional<T> row, UUID createdBy) {
        return row.filter(e -> createdBy.equals(e.getCreatedBy()))
            .orElseThrow(OwnershipGuard::notFound);
    }

    /** The canonical 404: {@code RESOURCE_NOT_FOUND} SystemMessage + HTTP 404. */
    public static SystemRuntimeErrorException notFound() {
        return new SystemRuntimeErrorException(
            SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
    }
}
