package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.service.CharacterExpertCatalog;
import io.mrkuhne.mezo.feature.character.service.CharacterHistoryReads;
import io.mrkuhne.mezo.feature.character.service.ExpertEvidence;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * IT for the monthly bootstrap konzílium's deterministic, no-LLM history reader
 * (Karakter S4, mezo-1gim.6): daily-summary narratives fan out to every expert, a
 * CONFIRMED pattern and a prompt-eligible knowledge fact route via the keyword maps.
 */
@ActiveProfiles("companion-fake")
class CharacterHistoryReadsIT extends ApiIntegrationTest {

    @Autowired private CharacterHistoryReads historyReads;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private KnowledgeFactPopulator knowledgeFactPopulator;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void gatherHistory_emptyHistory_returnsEmptyList() {
        assertThat(historyReads.gatherHistory(ownerId())).isEmpty();
    }

    @Test
    void gatherHistory_seededHistory_buildsPerExpertEvidenceWithRefs() {
        UUID owner = ownerId();
        String narrative = "Jó edzés és rendben tartott makrók, nyugodt este.";
        dailySummaryPopulator.summary(owner, LocalDate.of(2026, 8, 1), narrative);
        dailySummaryPopulator.summary(owner, LocalDate.of(2026, 8, 2));
        dailySummaryPopulator.summary(owner, LocalDate.of(2026, 8, 3));

        patternPopulator.statistical(owner, "sleep-quality~next-day-training-rpe", PatternEntity.STATUS_CONFIRMED);

        knowledgeFactPopulator.fact(owner, "Hétvégén rendszerint többet alszik.", "life", 2);

        List<ExpertEvidence> evidence = historyReads.gatherHistory(owner);

        // every expert that gets evidence is a known catalog key, no duplicates
        assertThat(evidence).isNotEmpty()
                .extracting(ExpertEvidence::expertKey)
                .doesNotHaveDuplicates()
                .allSatisfy(k -> assertThat(CharacterExpertCatalog.byKey(k)).isNotNull());
        // narratives/patterns/facts reach SOMEBODY's lines verbatim (no invented text)
        assertThat(evidence).anySatisfy(e ->
                assertThat(String.join("\n", e.lines())).contains(narrative));
        assertThat(evidence).allSatisfy(e -> {
            assertThat(e.lines()).isNotEmpty();
            assertThat(e.refIds()).isNotNull();
        });

        // the narrative reaches EVERY expert (whole-life prose)
        assertThat(evidence).extracting(ExpertEvidence::expertKey)
                .containsExactlyInAnyOrderElementsOf(
                        CharacterExpertCatalog.EXPERTS.stream().map(CharacterExpertCatalog.Expert::key).toList());

        // the sleep~rpe pattern routes to the Szomnológus (sleep keyword wins first)
        assertThat(evidence).filteredOn(e -> e.expertKey().equals("szomnologus"))
                .singleElement()
                .satisfies(e -> assertThat(String.join("\n", e.lines())).contains("sleep-quality~next-day-training-rpe"));

        // the "life" category fact routes to the Antropológus
        assertThat(evidence).filteredOn(e -> e.expertKey().equals("antropologus"))
                .singleElement()
                .satisfies(e -> assertThat(String.join("\n", e.lines())).contains("Hétvégén rendszerint többet alszik."));
    }

    @Test
    void gatherHistory_moreFactsThanCap_rendersOnlyTheTopCappedFacts() {
        UUID owner = ownerId();
        // 45 prompt-eligible "life" facts, all routing to antropologus — one more than the
        // history reader's cap (40, mirroring KnowledgeFactService.topFactsForPrompt's own bound
        // on this repository method).
        for (int i = 0; i < 45; i++) {
            knowledgeFactPopulator.fact(owner, "Tény #" + i, "life", i);
        }

        List<ExpertEvidence> evidence = historyReads.gatherHistory(owner);

        assertThat(evidence).filteredOn(e -> e.expertKey().equals("antropologus"))
                .singleElement()
                .satisfies(e -> {
                    // capped at 40, not 45
                    assertThat(e.lines()).hasSize(40);
                    // ordering is reinforcement-count desc — the 5 lowest-reinforcement facts
                    // (#0..#4) are the ones dropped by the cap
                    String rendered = String.join("\n", e.lines());
                    assertThat(rendered).contains("Tény #44").doesNotContain("Tény #4\n").doesNotContain("Tény #0");
                });
    }
}
