package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * S6 (mezo-d6ivw.6) Task A8: a {@code forgotten} row must be listed as CLOSED to the pipeline
 * exactly like a refuted/rejected one — so a reworded duplicate of a forgotten idea still dies
 * at PROPOSE, same package-private-seam idiom as {@link HypothesisClosedContextIT}.
 */
@ActiveProfiles("companion-fake")
class ForgottenClosedHypothesesIT extends AbstractIntegrationTest {

    @Autowired private HypothesisPipelineService pipeline;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void forgottenRow_shouldBeListedAsClosedForThePipeline() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_FORGOTTEN);

        assertThat(pipeline.closedHypotheses(owner)).contains(row.getTitle());
    }
}
