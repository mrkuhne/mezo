package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.service.ContextSnapshotAssembler;
import io.mrkuhne.mezo.feature.season.SeasonFixture;
import io.mrkuhne.mezo.feature.season.service.SeasonService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/** Boop B6 Évad S2 (mezo-r36n9.16): the season block rides right after the goal block in both snapshot variants. */
@Transactional
@ActiveProfiles("companion-fake")
@Import(SeasonFixture.class)
class ContextSnapshotSeasonIT extends AbstractIntegrationTest {

    @Autowired private ContextSnapshotAssembler assembler;
    @Autowired private SeasonService seasonService;
    @Autowired private SeasonFixture fixture;
    @Autowired private EntityManager em;

    @Test
    void snapshotIncludesSeasonBlockOnce() {
        UUID owner = fixture.owner("snapshot-season@test.local");
        LocalDate today = LocalDate.now();
        assertThat(assembler.render(owner, today)).doesNotContain("[Évad]");

        seasonService.activate(owner, seasonService.create(owner, SeasonFixture.draft()).getId());
        em.flush();

        for (String snapshot : List.of(assembler.render(owner, today), assembler.renderWithoutBiometrics(owner, today))) {
            List<String> lines = snapshot.lines().toList();
            int goal = indexOf(lines, "[Cél] ");
            int first = indexOf(lines, "[Évad] ");
            assertThat(first).isEqualTo(goal + 1);
            assertThat(lines.stream().filter(l -> l.startsWith("[Évad] ") && l.contains("Őszi évad · ")).count())
                .isEqualTo(1);
            assertThat(lines.stream().filter(l -> l.contains("NOVA ≤")).count()).isEqualTo(1);
        }
    }

    private static int indexOf(List<String> lines, String prefix) {
        for (int i = 0; i < lines.size(); i++) {
            if (lines.get(i).startsWith(prefix)) {
                return i;
            }
        }
        return -1;
    }
}
