package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.AdaptiveReason;
import io.mrkuhne.mezo.api.dto.CheckInItemId;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInItem;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInNeedSource;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInNeedSource.Need;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInPlanService;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.TestPlanEnvelope;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.ClassUtils;

/**
 * Check-in 2.0 follow-up A: the question of the day's specific need sources — active hypotheses,
 * enabled character detectors, open catalog pairs — against the real config and wiring.
 */
@Transactional
class CheckInNeedSourcesIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.parse("2026-06-15");

    @Autowired private List<CheckInNeedSource> sources;
    @Autowired private CheckInPlanService planService;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testSources_shouldBeOrderedHypothesisDetectorPairFallback_whenInjected() {
        assertThat(sources).extracting(CheckInNeedSourcesIT::name).containsSubsequence(
            "HypothesisCheckInNeedSource", "DetectorCheckInNeedSource", "PairCheckInNeedSource");
        assertThat(sources.stream().filter(CheckInNeedSource::fallback))
            .extracting(CheckInNeedSourcesIT::name).containsExactly("AllNonCoreNeedSource");
    }

    @Test
    void testPairSource_shouldAskPairQuestion_whenPairOpenAndDropIt_whenSettled() {
        UUID user = databasePopulator.populateUser("need@test.local");
        CheckInNeedSource pairs = source("PairCheckInNeedSource");

        assertThat(pairs.needs(user)).contains(new Need(CheckInItem.CONNECTION,
            "Most azt figyeljük: kapcsolódottabbnak érzed magad a társas napokon?"));
        // Only check-in sides are wanted; never a non-check-in metric.
        assertThat(pairs.needs(user)).extracting(Need::item).doesNotContainNull();

        patternPopulator.statistical(user, "social-mentions~checkin-connection", PatternEntity.STATUS_CONFIRMED);
        assertThat(pairs.needs(user)).extracting(Need::item).doesNotContain(CheckInItem.CONNECTION);
    }

    @Test
    void testHypothesisSource_shouldWantPlanSeries_whenHypothesisActiveOnly() {
        UUID user = databasePopulator.populateUser("need@test.local");
        CheckInNeedSource hypotheses = source("HypothesisCheckInNeedSource");
        PatternEntity row = patternPopulator.reflection(user,
            new TestPlanEnvelope("sleep-duration-h", "checkin-hunger", 0, "negative", 7, 3, 42),
            PatternEntity.STATUS_MONITORING);

        assertThat(hypotheses.needs(user)).containsExactly(new Need(CheckInItem.HUNGER,
            "Most egy sejtést tesztelünk: „" + row.getTitle() + "”."));

        row.setStatus(PatternEntity.STATUS_REFUTED);
        patternPopulator.save(row);
        assertThat(hypotheses.needs(user)).isEmpty();
    }

    @Test
    void testDetectorSource_shouldWantDetectorItems_whenDetectorsEnabled() {
        UUID user = databasePopulator.populateUser("need@test.local");
        assertThat(source("DetectorCheckInNeedSource").needs(user)).extracting(Need::item)
            .contains(CheckInItem.CRAVING, CheckInItem.DIGESTION, CheckInItem.SORENESS, CheckInItem.PAIN);
    }

    @Test
    void testPlan_shouldPreferHypothesisWhy_whenHypothesisAndPairWantSameItem() {
        UUID user = databasePopulator.populateUser("need@test.local");
        PatternEntity row = patternPopulator.reflection(user,
            new TestPlanEnvelope("training-monotony", "checkin-motivation", 0, "negative", 7, 3, 42),
            PatternEntity.STATUS_PROPOSED);
        // 14:00 pool = soreness, pain, motivation, connection; motivation is never answered.
        for (int d = 1; d <= 3; d++) {
            checkInPopulator.createCheckIn(user, DAY.minusDays(d), "20:00", e -> {
                e.setSoreness(3);
                e.setPain(false);
                e.setConnection(7);
            });
        }
        int needDraws = 0;
        for (int d = 0; d < 11; d++) {
            var adaptive = planService.plan(user, DAY.plusDays(d), "14:00").getAdaptive();
            if (adaptive.getReason() == AdaptiveReason.NEED) {
                needDraws++;
                assertThat(adaptive.getId()).isEqualTo(CheckInItemId.MOTIVATION);
                assertThat(adaptive.getWhy()).isEqualTo("Most egy sejtést tesztelünk: „" + row.getTitle() + "”.");
            }
        }
        assertThat(needDraws).isPositive();
    }

    private static String name(CheckInNeedSource source) {
        return ClassUtils.getUserClass(source).getSimpleName();
    }

    private CheckInNeedSource source(String simpleName) {
        return sources.stream().filter(s -> name(s).equals(simpleName)).findFirst().orElseThrow();
    }
}
