package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/**
 * Test data factory for {@link AppUserEntity} — see
 * docs/references/integration_test_framework.md (one populator per aggregate,
 * layered overloads from "give me any user" down to full control).
 */
@TestComponent
@RequiredArgsConstructor
public class UserPopulator {

    private final AppUserRepository appUserRepository;

    /** Creates a user with an auto-generated unique email. */
    public AppUserEntity createUser() {
        String unique = UUID.randomUUID().toString().substring(0, 8);
        return createUser("test-" + unique + "@test.local");
    }

    /**
     * Find-or-create by email — idempotent, yields an FK-valid owner for
     * {@code created_by} columns. The password hash is irrelevant for ownership
     * tests, so a placeholder string is stored.
     */
    public AppUserEntity createUser(String email) {
        return appUserRepository.findByEmail(email).orElseGet(() -> {
            AppUserEntity user = new AppUserEntity();
            user.setEmail(email);
            user.setName(email);
            user.setPasswordHash("x");
            return appUserRepository.saveAndFlush(user);
        });
    }
}
