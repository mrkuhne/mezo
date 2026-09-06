package io.mrkuhne.mezo.feature.companion.flags.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * The catalog is the ONE place a rule is named for the user (spec 2026-09-05 §5). A round-2 rule
 * that lands without an entry here would reach the observer as a bare key, so this test fails the
 * build instead — the {@code AdvicePriorityTest} precedent.
 */
class FlagCatalogTest {

    /** Every {@code FlagKey} constant except the two raise-SOURCE strings. */
    private static List<String> liveFlagKeys() throws IllegalAccessException {
        List<String> keys = new ArrayList<>();
        for (Field f : FlagKey.class.getDeclaredFields()) {
            if (Modifier.isStatic(f.getModifiers()) && f.getType() == String.class
                && !f.getName().startsWith("SOURCE_")) {
                keys.add((String) f.get(null));
            }
        }
        return keys;
    }

    @Test
    void every_live_flag_key_has_a_label_and_a_domain() throws IllegalAccessException {
        List<String> keys = liveFlagKeys();
        // No literal count: the round-2 arrival of protocol_lapse showed a hardcoded 13 only
        // reports the SAME failure this pair of assertions already reports, one round later. The
        // agreement assertion is the real anchor — a reflection helper that silently stopped
        // finding keys would make it fail against a non-empty FlagCatalog.KEYS, and isNotEmpty
        // covers the degenerate case where both sides went empty at once.
        assertThat(keys).isNotEmpty();
        assertThat(FlagCatalog.KEYS).containsExactlyInAnyOrderElementsOf(keys);
        for (String key : keys) {
            assertThat(FlagCatalog.labelOf(key)).as(key).isNotBlank().isNotEqualTo(key);
            assertThat(FlagCatalog.domainOf(key)).as(key).isNotBlank();
        }
    }

    @Test
    void an_unknown_key_falls_back_instead_of_throwing() {
        assertThat(FlagCatalog.labelOf("round_two_rule")).isEqualTo("round_two_rule");
        assertThat(FlagCatalog.domainOf("round_two_rule")).isEqualTo(FlagCatalog.DOMAIN_FALLBACK);
        assertThat(FlagCatalog.labelOf(null)).isNull();
        assertThat(FlagCatalog.domainOf(null)).isEqualTo(FlagCatalog.DOMAIN_FALLBACK);
    }
}
