package io.mrkuhne.mezo.techcore.security;

import io.mrkuhne.mezo.feature.auth.service.CurrentUser;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * The owner key for every controller — the JWT subject, validated against the account row
 * (status check + last-seen stamp) by {@link CurrentUser}. Kept as the existing seam so no
 * controller changes; new code that needs the entity or {@code requireOwner()} injects
 * {@link CurrentUser} directly.
 */
@Component
@RequiredArgsConstructor
public class CurrentUserId {
    private final CurrentUser currentUser;

    public UUID get() {
        return currentUser.id();
    }
}
