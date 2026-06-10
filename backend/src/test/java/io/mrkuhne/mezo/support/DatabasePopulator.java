package io.mrkuhne.mezo.support;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.auth.repository.UserProfileRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/**
 * Java-based test data provider for integration tests (see testing_standards.md).
 * Per-feature populate methods are added by later tasks (e.g. populateOwner()).
 * Registered into the test context via {@code @Import} on {@link AbstractIntegrationTest},
 * so subclasses can simply {@code @Autowired} it.
 */
@TestComponent
@RequiredArgsConstructor
public class DatabasePopulator {

    private final UserProfileRepository userProfileRepository;
    private final AppUserRepository appUserRepository;

    /**
     * Find-or-create an {@link AppUserEntity} for the given email and return its id.
     * Idempotent per email; the password hash is irrelevant for FK-valid test ownership,
     * so a placeholder string is stored. Used to satisfy the {@code created_by} FK on
     * domain tables in ownership-isolation integration tests.
     */
    public UUID populateUser(String email) {
        return appUserRepository.findByEmail(email)
            .map(AppUserEntity::getId)
            .orElseGet(() -> {
                AppUserEntity user = new AppUserEntity();
                user.setEmail(email);
                user.setName(email);
                user.setPasswordHash("x");
                return appUserRepository.save(user).getId();
            });
    }

    /** Resets owned state between tests; FK order matters (profiles → users). */
    public void clear() {
        userProfileRepository.deleteAll();
        appUserRepository.deleteAll();
    }
}
