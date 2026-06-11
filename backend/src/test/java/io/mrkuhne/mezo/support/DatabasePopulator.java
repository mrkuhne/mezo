package io.mrkuhne.mezo.support;

import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/**
 * Facade over the per-aggregate {@code *Populator} factories (see
 * docs/references/integration_test_framework.md). Tests may autowire either this
 * facade or the individual populators directly.
 */
@TestComponent
@RequiredArgsConstructor
public class DatabasePopulator {

    private final UserPopulator userPopulator;

    /**
     * Find-or-create an app user for the given email and return its id. Used to
     * satisfy the {@code created_by} FK on domain tables in ownership-isolation tests.
     */
    public UUID populateUser(String email) {
        return userPopulator.createUser(email).getId();
    }
}
