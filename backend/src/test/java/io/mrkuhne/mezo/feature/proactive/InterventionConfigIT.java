package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** W5.2 (bd mezo-b3pp.19, spec §9.2): the intervention library binds from YAML and covers every
 *  W5.1 flag — a raised flag must never be undeliverable. Every {@link FlagKey} constant now has
 *  a library entry (the S4 {@code logging_gap}/{@code missed_workouts} additions and the S6 batch
 *  B six closed the last gaps). Config + binding only; {@code InterventionService} (candidate
 *  selection) and {@code AnchorResolver} (push anchoring) are the library's consumers, covered by
 *  their own IT/unit suites, not here. */
class InterventionConfigIT extends AbstractIntegrationTest {

    @Autowired CompanionProperties companionProperties;

    /** S6 review fix (bd mezo-d58h.6): this used to hardcode the seven original flags in a
     *  {@code containsExactlyInAnyOrder(...)} literal — exactly the hand-maintained enumeration
     *  this epic keeps getting wrong, and exactly what broke silently the moment S6's six rules
     *  each landed their own library entry without anyone touching this assertion. Now
     *  self-policing, the {@code AdvicePriorityTest.testOrder_shouldCoverEveryLiveFlagKey}
     *  precedent: read the live flag-key set by REFLECTION off {@link FlagKey} (public static
     *  String fields, excluding {@code SOURCE_*}) and require the library's distinct {@code flag}
     *  values to match it EXACTLY — a flag added with no library entry, or a stray literal in the
     *  library with no matching constant, now fails here automatically. */
    @Test
    void libraryBindsCoversEveryFlagAndKeysAreUnique() {
        var lib = companionProperties.interventions();
        assertThat(lib).isNotEmpty();
        assertThat(lib.stream().map(CompanionProperties.Intervention::key))
            .doesNotHaveDuplicates();

        List<String> flagKeys = new ArrayList<>();
        for (Field f : FlagKey.class.getDeclaredFields()) {
            if (Modifier.isPublic(f.getModifiers()) && Modifier.isStatic(f.getModifiers())
                    && f.getType() == String.class && !f.getName().startsWith("SOURCE_")) {
                try {
                    flagKeys.add((String) f.get(null));
                } catch (IllegalAccessException e) {
                    throw new AssertionError(e);
                }
            }
        }
        // Guard against a vacuous pass if reflection ever finds nothing.
        assertThat(flagKeys).isNotEmpty();

        // every live FlagKey has at least one entry — a raised flag must never be undeliverable
        assertThat(lib.stream().map(CompanionProperties.Intervention::flag).distinct())
            .containsExactlyInAnyOrderElementsOf(flagKeys);
    }

    @Test
    void testLibrary_shouldServeEveryRoundOneFlag() {
        assertThat(companionProperties.interventions())
            .extracting(CompanionProperties.Intervention::flag)
            .contains(FlagKey.LOGGING_GAP, FlagKey.MISSED_WORKOUTS);
    }
}
