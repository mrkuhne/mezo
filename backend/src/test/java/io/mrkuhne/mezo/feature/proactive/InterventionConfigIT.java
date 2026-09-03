package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** W5.2 (bd mezo-b3pp.19, spec §9.2): the intervention library binds from YAML and covers every
 *  W5.1 flag — a raised flag must never be undeliverable. <b>Exception since S2 (bd
 *  mezo-d58h.2):</b> {@code logging_gap}/{@code missed_workouts} have no library entry until S4 —
 *  {@code InterventionService.deliverForFlag} finds no candidates for either key and returns
 *  {@code Optional.empty()} with an info log line, a deliberate no-op, not a failure (see
 *  proactive.md). This test enumerates the library, not {@code FlagKey}, so it still passes with
 *  those two flags undeliverable; the assertion below intentionally still names only the original
 *  five keys. Config + binding only; {@code InterventionService} (candidate selection) and {@code
 *  AnchorResolver} (push anchoring) are the library's consumers, covered by their own IT/unit
 *  suites, not here. */
class InterventionConfigIT extends AbstractIntegrationTest {

    @Autowired CompanionProperties companionProperties;

    @Test
    void libraryBindsCoversEveryFlagAndKeysAreUnique() {
        var lib = companionProperties.interventions();
        assertThat(lib).isNotEmpty();
        assertThat(lib.stream().map(CompanionProperties.Intervention::key))
            .doesNotHaveDuplicates();
        // every W5.1 flag has at least one entry — a raised flag must never be undeliverable
        assertThat(lib.stream().map(CompanionProperties.Intervention::flag).distinct())
            .containsExactlyInAnyOrder(FlagKey.SUSTAINED_STRESS, FlagKey.SLEEP_DEBT,
                FlagKey.MOMENTUM_AT_RISK, FlagKey.RECOVERY_NEEDED, FlagKey.ALL_HEALTHY);
    }
}
