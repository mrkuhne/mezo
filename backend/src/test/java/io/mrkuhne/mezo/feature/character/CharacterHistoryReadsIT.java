package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.service.CharacterExpertCatalog;
import io.mrkuhne.mezo.feature.character.service.CharacterHistoryReads;
import io.mrkuhne.mezo.feature.character.service.ExpertEvidence;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.GraphPopulator;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.WeeklyReviewPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
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
    @Autowired private WeeklyReviewPopulator weeklyReviewPopulator;
    @Autowired private JournalPopulator journalPopulator;
    @Autowired private GraphPopulator graphPopulator;

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
    void gatherHistory_morePatternsThanCap_rendersOnlyTheNewestCappedPatterns() {
        UUID owner = ownerId();
        // 65 CONFIRMED "sleep" patterns, all routing to szomnologus — one more than the history
        // reader's cap (60, final-review Finding M4/M6: patterns were read entirely uncapped).
        // lastDetectedAt is set explicitly (not left to wall-clock ordering) so the "newest N
        // survive the cap" assertion below is deterministic.
        java.time.Instant base = java.time.Instant.parse("2026-01-01T00:00:00Z");
        for (int i = 0; i < 65; i++) {
            io.mrkuhne.mezo.feature.companion.entity.PatternEntity pattern =
                    patternPopulator.statistical(owner, "sleep-" + i, PatternEntity.STATUS_CONFIRMED);
            pattern.setLastDetectedAt(base.plusSeconds(i));
            patternPopulator.save(pattern);
        }

        List<ExpertEvidence> evidence = historyReads.gatherHistory(owner);

        assertThat(evidence).filteredOn(e -> e.expertKey().equals("szomnologus"))
                .singleElement()
                .satisfies(e -> {
                    // capped at 60, not 65
                    assertThat(e.lines()).hasSize(60);
                    // ordering is lastDetectedAt desc — the newest-inserted pattern survives, the
                    // oldest (first inserted) is one of the 5 dropped by the cap
                    String rendered = String.join("\n", e.lines());
                    assertThat(rendered).contains("sleep-64").doesNotContain("sleep-0)");
                });
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

    @Test
    void gatherHistory_weeklyReview_routesToEveryExpert() {
        UUID owner = ownerId();
        weeklyReviewPopulator.weeklyReview(owner, LocalDate.of(2026, 8, 3));

        List<ExpertEvidence> evidence = historyReads.gatherHistory(owner);

        // whole-life prose, like a daily-summary narrative — every expert gets it
        assertThat(evidence).extracting(ExpertEvidence::expertKey)
                .containsExactlyInAnyOrderElementsOf(
                        CharacterExpertCatalog.EXPERTS.stream().map(CharacterExpertCatalog.Expert::key).toList());
        assertThat(evidence).allSatisfy(e -> {
            assertThat(String.join("\n", e.lines())).contains("Teszt heti elemzés.");
            assertThat(e.refIds()).anySatisfy(refId -> assertThat(refId).startsWith("weekly-review:"));
        });
    }

    @Test
    void gatherHistory_journalEntry_routesToPszichologus() {
        UUID owner = ownerId();
        String text = "Ma nehéz nap volt, de este megnyugodtam.";
        journalPopulator.createEntry(owner, LocalDate.of(2026, 8, 5), text, JournalEntryEntity.SOURCE_QUICKINPUT);

        List<ExpertEvidence> evidence = historyReads.gatherHistory(owner);

        assertThat(evidence).filteredOn(e -> e.expertKey().equals("pszichologus"))
                .singleElement()
                .satisfies(e -> {
                    assertThat(String.join("\n", e.lines())).contains(text);
                    assertThat(e.refIds()).anySatisfy(refId -> assertThat(refId).startsWith("journal:"));
                });
    }

    @Test
    void gatherHistory_lifeEvent_routesToAntropologus() {
        UUID owner = ownerId();
        String title = "Elköltözött Budapestre";
        graphPopulator.createNode(owner, GraphNodeEntity.KIND_LIFE_EVENT, title);

        List<ExpertEvidence> evidence = historyReads.gatherHistory(owner);

        assertThat(evidence).filteredOn(e -> e.expertKey().equals("antropologus"))
                .singleElement()
                .satisfies(e -> {
                    assertThat(String.join("\n", e.lines())).contains(title);
                    assertThat(e.refIds()).anySatisfy(refId -> assertThat(refId).startsWith("life-event:"));
                });
    }

    /** S4-review follow-up: the shipped test asserted routing for 2 of ~16 pattern keywords and
     *  1 of 4 fact categories — this parameterizes over EVERY entry in both maps. */
    static Stream<Arguments> patternKeywordRouting() {
        return CharacterHistoryReads.patternKeywordRouting().entrySet().stream()
                .map(e -> Arguments.of(e.getKey(), e.getValue()));
    }

    static Stream<Arguments> factCategoryRouting() {
        return CharacterHistoryReads.factCategoryRouting().entrySet().stream()
                .map(e -> Arguments.of(e.getKey(), e.getValue()));
    }

    @ParameterizedTest(name = "pattern pairKey containing \"{0}\" routes to {1}")
    @MethodSource("patternKeywordRouting")
    void gatherHistory_everyPatternKeyword_routesToExpectedExpert(String keyword, String expectedExpert) {
        UUID owner = ownerId();
        String pairKey = "kw-" + keyword + "-marker";
        patternPopulator.statistical(owner, pairKey, PatternEntity.STATUS_CONFIRMED);

        List<ExpertEvidence> evidence = historyReads.gatherHistory(owner);

        assertThat(evidence).filteredOn(e -> e.expertKey().equals(expectedExpert))
                .as("keyword \"%s\" should route to %s", keyword, expectedExpert)
                .singleElement()
                .satisfies(e -> assertThat(String.join("\n", e.lines())).contains(pairKey));
    }

    @ParameterizedTest(name = "fact category \"{0}\" routes to {1}")
    @MethodSource("factCategoryRouting")
    void gatherHistory_everyFactCategory_routesToExpectedExpert(String category, String expectedExpert) {
        UUID owner = ownerId();
        String factText = "Tény a(z) " + category + " kategóriából.";
        knowledgeFactPopulator.fact(owner, factText, category, 1);

        List<ExpertEvidence> evidence = historyReads.gatherHistory(owner);

        assertThat(evidence).filteredOn(e -> e.expertKey().equals(expectedExpert))
                .as("category \"%s\" should route to %s", category, expectedExpert)
                .singleElement()
                .satisfies(e -> assertThat(String.join("\n", e.lines())).contains(factText));
    }
}
