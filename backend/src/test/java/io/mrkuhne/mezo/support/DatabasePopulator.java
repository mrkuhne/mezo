package io.mrkuhne.mezo.support;

import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.auth.repository.UserProfileRepository;
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

    /** Resets owned state between tests; FK order matters (profiles → users). */
    public void clear() {
        userProfileRepository.deleteAll();
        appUserRepository.deleteAll();
    }
}
