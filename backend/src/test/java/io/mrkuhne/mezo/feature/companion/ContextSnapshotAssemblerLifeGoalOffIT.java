package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.service.ContextSnapshotAssembler;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.LifeGoalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

/**
 * mezo-iizd.10: {@code ContextSnapshotAssembler.lifeGoalLine}'s empty branch
 * ({@code snapshot.lifegoal-max-goals = 0} → {@code LifeGoalSnapshotBlock.render} returns
 * {@code ""} → the assembler must not leave a stray blank line where {@code [Célok]} would have
 * sat) — the {@link ContextSnapshotAssemblerPeopleOffIT} precedent. Own IT class on purpose — the
 * {@link TestPropertySource} override forks the Spring context, so it must not share the clean-
 * context class with the rest of {@code ContextSnapshotAssemblerIT}.
 */
@Transactional
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.snapshot.lifegoal-max-goals=0")
class ContextSnapshotAssemblerLifeGoalOffIT extends AbstractIntegrationTest {

    @Autowired private ContextSnapshotAssembler assembler;
    @Autowired private UserPopulator userPopulator;
    @Autowired private LifeGoalPopulator lifeGoalPopulator;

    @Test
    void testRender_shouldOmitCelokBlock_andLeaveNoDoubledNewline_whenLifegoalMaxGoalsIsZero() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        // an active life goal exists — the point is that the CONFIG (not empty data) is what
        // suppresses the block here.
        lifeGoalPopulator.goal(owner, "active");

        String snapshot = assembler.render(owner, today);

        assertThat(snapshot).doesNotContain("[Célok]");
        int cel = snapshot.indexOf("[Cél]");
        int edzes = snapshot.indexOf("[Edzés]");
        assertThat(cel).isPositive();
        assertThat(edzes).isGreaterThan(cel);
        // no doubled newline in the gap where the [Célok] block would have sat between the two
        assertThat(snapshot.substring(cel, edzes)).doesNotContain("\n\n\n").doesNotContain("\n\n");
    }
}
