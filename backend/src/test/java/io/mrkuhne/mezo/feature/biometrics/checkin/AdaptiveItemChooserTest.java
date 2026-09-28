package io.mrkuhne.mezo.feature.biometrics.checkin;

import static io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInItem.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.biometrics.checkin.config.CheckInPlanProperties;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.AdaptiveItemChooser;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.AdaptiveItemChooser.Choice;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.AdaptiveItemChooser.Reason;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInItem;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

/** Pure unit test of the question-of-the-day pick (mezo-ck2, spec §2.3) — no Spring. */
class AdaptiveItemChooserTest {

    private static final List<CheckInItem> CORE = List.of(ENERGY, MOOD, STRESS, BODY, MENTAL);
    private static final Map<String, List<CheckInItem>> PLAN = Map.of(
        "06:30", concat(CORE, List.of(RESTED, SORENESS, PAIN, MOTIVATION)),
        "10:00", concat(CORE, List.of(MOTIVATION, HUNGER)),
        "14:00", concat(CORE, List.of(HUNGER, CRAVING, DIGESTION)),
        "20:00", concat(CORE, List.of(SORENESS, PAIN, CRAVING, DIGESTION, CONNECTION, DAY)));
    private static final Set<CheckInItem> ALL_NON_CORE = Arrays.stream(CheckInItem.values())
        .filter(i -> !i.core()).collect(Collectors.toCollection(() -> EnumSet.noneOf(CheckInItem.class)));

    private final AdaptiveItemChooser chooser = new AdaptiveItemChooser(new CheckInPlanProperties(
        Map.of(), new CheckInPlanProperties.Adaptive(0.2, 14, Map.of(RESTED, "06:30", DAY, "20:00"),
            "Most azt figyeljük, hogyan alakul {item} — erről van a legkevesebb válaszod.",
            "Ma ez a véletlen kérdés — így marad kiegyensúlyozott, amit rólad tanulunk.")));

    @Test
    void testChoose_shouldRespectPoolConstraints_whenDrawnManyTimesPerSlot() {
        Random rng = new Random(42);
        PLAN.forEach((slot, items) -> {
            for (int i = 0; i < 500; i++) {
                CheckInItem pick = chooser.choose(slot, items, Map.of(), ALL_NON_CORE, rng).orElseThrow().item();
                assertThat(pick.core()).as("core never adaptive").isFalse();
                assertThat(items).as("never already in the %s plan", slot).doesNotContain(pick);
                if (pick == RESTED) assertThat(slot).isEqualTo("06:30");
                if (pick == DAY) assertThat(slot).isEqualTo("20:00");
            }
        });
    }

    @Test
    void testPool_shouldListOnlyMeaningfulItems_whenSlotGiven() {
        assertThat(chooser.pool("06:30", PLAN.get("06:30"))).containsExactly(HUNGER, CRAVING, DIGESTION, CONNECTION);
        assertThat(chooser.pool("10:00", PLAN.get("10:00")))
            .containsExactly(SORENESS, PAIN, CRAVING, DIGESTION, CONNECTION);
        assertThat(chooser.pool("14:00", PLAN.get("14:00"))).containsExactly(SORENESS, PAIN, MOTIVATION, CONNECTION);
        assertThat(chooser.pool("20:00", PLAN.get("20:00"))).containsExactly(MOTIVATION, HUNGER);
    }

    @Test
    void testChoose_shouldDrawRandomAboutTwentyPercent_whenSeeded() {
        Random rng = new Random(20260927L);
        int random = 0;
        for (int i = 0; i < 1000; i++) {
            Choice c = chooser.choose("14:00", PLAN.get("14:00"), Map.of(), ALL_NON_CORE, rng).orElseThrow();
            if (c.reason() == Reason.RANDOM) random++;
        }
        assertThat(random / 1000.0).isCloseTo(0.2, within(0.03));
    }

    @Test
    void testChoose_shouldPickThinnestWantedSeries_whenNeedDraw() {
        Map<CheckInItem, Long> counts = Map.of(SORENESS, 9L, PAIN, 3L, MOTIVATION, 1L, CONNECTION, 6L);
        Random rng = new Random(7);
        for (int i = 0; i < 200; i++) {
            Choice c = chooser.choose("14:00", PLAN.get("14:00"), counts, ALL_NON_CORE, rng).orElseThrow();
            if (c.reason() == Reason.NEED) assertThat(c.item()).isEqualTo(MOTIVATION);
        }
        // Only what a consumer waits on counts: with MOTIVATION unwanted, PAIN is the thinnest.
        Set<CheckInItem> wanted = EnumSet.of(SORENESS, PAIN, CONNECTION);
        for (int i = 0; i < 200; i++) {
            Choice c = chooser.choose("14:00", PLAN.get("14:00"), counts, wanted, rng).orElseThrow();
            if (c.reason() == Reason.NEED) assertThat(c.item()).isEqualTo(PAIN);
        }
    }

    @Test
    void testChoose_shouldFallBackToRandom_whenNothingWanted() {
        Random rng = new Random(1);
        for (int i = 0; i < 100; i++) {
            Choice c = chooser.choose("20:00", PLAN.get("20:00"), Map.of(), Set.of(), rng).orElseThrow();
            assertThat(c.reason()).isEqualTo(Reason.RANDOM);
            assertThat(c.item()).isIn(MOTIVATION, HUNGER);
        }
    }

    @Test
    void testChoose_shouldBeStable_whenSameSeed() {
        for (long seed = 0; seed < 50; seed++) {
            Choice a = chooser.choose("06:30", PLAN.get("06:30"), Map.of(HUNGER, 2L), ALL_NON_CORE, new Random(seed)).orElseThrow();
            Choice b = chooser.choose("06:30", PLAN.get("06:30"), Map.of(HUNGER, 2L), ALL_NON_CORE, new Random(seed)).orElseThrow();
            assertThat(b).isEqualTo(a);
        }
    }

    @Test
    void testChoose_shouldReturnEmpty_whenPoolEmpty() {
        List<CheckInItem> everything = List.of(CheckInItem.values());
        assertThat(chooser.choose("20:00", everything, Map.of(), ALL_NON_CORE, new Random(3))).isEmpty();
    }

    @Test
    void testWhy_shouldNameTheItemInHungarian_whenNeed() {
        for (CheckInItem item : ALL_NON_CORE) {
            String why = chooser.why(new Choice(item, Reason.NEED));
            assertThat(why).startsWith("Most azt figyeljük").contains(item.label().toLowerCase()).doesNotContain("{item}");
        }
        assertThat(chooser.why(new Choice(HUNGER, Reason.RANDOM)))
            .isEqualTo("Ma ez a véletlen kérdés — így marad kiegyensúlyozott, amit rólad tanulunk.");
    }

    @Test
    void testChoose_shouldCarrySourceWhy_whenNeedPickHasSpecificReason() {
        Map<CheckInItem, String> wanted = new java.util.EnumMap<>(CheckInItem.class);
        wanted.put(PAIN, "Most azt figyeljük, visszatér-e ugyanott a fájdalom.");
        wanted.put(SORENESS, null);
        Map<CheckInItem, Long> counts = Map.of(SORENESS, 5L, PAIN, 0L);
        Random rng = new Random(11);
        int needDraws = 0;
        for (int i = 0; i < 200; i++) {
            Choice c = chooser.choose("14:00", PLAN.get("14:00"), counts, wanted, rng).orElseThrow();
            if (c.reason() != Reason.NEED) {
                assertThat(chooser.why(c)).startsWith("Ma ez a véletlen kérdés");
                continue;
            }
            needDraws++;
            assertThat(c.item()).isEqualTo(PAIN);
            assertThat(chooser.why(c)).isEqualTo("Most azt figyeljük, visszatér-e ugyanott a fájdalom.");
        }
        assertThat(needDraws).isPositive();
        // A wanted item without a specific sentence keeps the generic one.
        assertThat(chooser.why(new Choice(SORENESS, Reason.NEED, wanted.get(SORENESS))))
            .isEqualTo("Most azt figyeljük, hogyan alakul az izomlázad — erről van a legkevesebb válaszod.");
    }

    private static List<CheckInItem> concat(List<CheckInItem> a, List<CheckInItem> b) {
        return java.util.stream.Stream.concat(a.stream(), b.stream()).toList();
    }
}
