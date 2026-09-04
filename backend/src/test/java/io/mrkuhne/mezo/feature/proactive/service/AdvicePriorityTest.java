package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * S4 (bd mezo-d58h.4): the spec §4 severity order as an integer rank. Plain unit test — the table
 * is a pure static lookup with no Spring involvement.
 */
class AdvicePriorityTest {

    @Test
    void testRankOf_shouldFollowTheSpecOrder() {
        assertThat(AdvicePriority.rankOf("acute_bad_day"))
            .isLessThan(AdvicePriority.rankOf("load_fuel_mismatch"));
        assertThat(AdvicePriority.rankOf(FlagKey.MISSED_WORKOUTS))
            .isLessThan(AdvicePriority.rankOf(FlagKey.SLEEP_DEBT));
        assertThat(AdvicePriority.rankOf(FlagKey.SLEEP_DEBT))
            .isLessThan(AdvicePriority.rankOf(FlagKey.LOGGING_GAP));
        assertThat(AdvicePriority.rankOf(FlagKey.LOGGING_GAP))
            .isLessThan(AdvicePriority.rankOf("missing_sleep_goal"));
        assertThat(AdvicePriority.rankOf("plan_feasibility"))
            .isLessThan(AdvicePriority.rankOf(FlagKey.RECOVERY_NEEDED));
        assertThat(AdvicePriority.rankOf(FlagKey.ALL_HEALTHY))
            .isEqualTo(AdvicePriority.ORDER.size() - 1);
    }

    @Test
    void testOutranks_shouldBeStrict() {
        assertThat(AdvicePriority.outranks("acute_bad_day", FlagKey.SLEEP_DEBT)).isTrue();
        assertThat(AdvicePriority.outranks(FlagKey.SLEEP_DEBT, "acute_bad_day")).isFalse();
        // A re-raise of the same key must never churn the day's card.
        assertThat(AdvicePriority.outranks(FlagKey.SLEEP_DEBT, FlagKey.SLEEP_DEBT)).isFalse();
    }

    /** An unknown key ranks LAST rather than throwing: an unmapped key must never blow up delivery
     *  inside a listener's catch (the FlagProperties.CooldownHours.forFlag trap, deliberately not
     *  repeated here). It still loses every comparison against a known key. */
    @Test
    void testRankOf_shouldRankAnUnknownKeyLast() {
        assertThat(AdvicePriority.rankOf("brand_new_rule")).isEqualTo(AdvicePriority.ORDER.size());
        assertThat(AdvicePriority.outranks("brand_new_rule", FlagKey.ALL_HEALTHY)).isFalse();
        assertThat(AdvicePriority.outranks(FlagKey.ALL_HEALTHY, "brand_new_rule")).isTrue();
    }

    /** The enumeration guard this epic keeps needing: every LIVE flag key must have a rank, or a
     *  raise silently lands at the bottom of the order. Reads FlagKey by reflection so adding a
     *  constant there fails HERE rather than in production. */
    @Test
    void testOrder_shouldCoverEveryLiveFlagKey() {
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
        assertThat(flagKeys).isNotEmpty();
        assertThat(AdvicePriority.ORDER).containsAll(flagKeys);
    }
}
