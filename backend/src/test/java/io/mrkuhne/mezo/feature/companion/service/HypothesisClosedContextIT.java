package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.TestPlanEnvelope;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * S2 (mezo-d6ivw.2): refuted/rejected hypotheses never resurface — {@code closedHypotheses}
 * feeds a "LEZÁRT SEJTÉSEK" section into {@code nightlyContext} so PROPOSE and CRITIQUE both see
 * the settled NOs, same package-private-seam idiom as {@link HypothesisGatherContextIT}.
 */
@Transactional
@ActiveProfiles("companion-fake")
class HypothesisClosedContextIT extends AbstractIntegrationTest {

    @Autowired private HypothesisPipelineService pipelineService;
    @Autowired private UserPopulator userPopulator;
    @Autowired private PatternPopulator patternPopulator;

    private static TestPlanEnvelope plan() {
        return new TestPlanEnvelope("people:anna", "sleep-duration-h", 1,
                TestPlanEnvelope.DIRECTION_POSITIVE, 8, 3, 30);
    }

    /** A distinct plan (own {@code pair_key}) so a still-open row can coexist with the closed
     *  one under the same owner without tripping {@code uq_pattern_created_by_kind_pair_key}. */
    private static TestPlanEnvelope otherPlan() {
        return new TestPlanEnvelope("people:bela", "sleep-duration-h", 1,
                TestPlanEnvelope.DIRECTION_POSITIVE, 8, 3, 30);
    }

    @Test
    void testClosedHypotheses_shouldListRefutedAndRejectedTitles() {
        UUID owner = userPopulator.createUser().getId();
        patternPopulator.reflection(owner, plan(), PatternEntity.STATUS_REFUTED); // title from populator
        PatternEntity rejected = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_REJECTED);
        patternPopulator.reflection(owner, otherPlan(), PatternEntity.STATUS_MONITORING);

        String closed = pipelineService.closedHypotheses(owner);

        assertThat(closed).contains(rejected.getTitle());
        assertThat(closed.lines()).hasSize(2); // the monitoring row is NOT closed
    }

    @Test
    void testNightlyContext_shouldCarryClosedSection_whenARowWasRefuted() {
        UUID owner = userPopulator.createUser().getId();
        patternPopulator.reflection(owner, plan(), PatternEntity.STATUS_REFUTED);

        String context = pipelineService.nightlyContext(owner);

        assertThat(context).contains("LEZÁRT SEJTÉSEK");
    }
}
