package io.mrkuhne.mezo.feature.companion.reflection;

import static org.assertj.core.api.Assertions.assertThat;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.HypothesisPipelineService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.ObjectMapper;

@ActiveProfiles("companion-fake")
class GroundedHypothesisPipelineIT extends AbstractIntegrationTest {
    @Autowired private HypothesisPipelineService pipeline;
    @Autowired private io.mrkuhne.mezo.feature.companion.config.CompanionProperties companionProperties;
    @Autowired private io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm fakeLlm;
    @Autowired private io.mrkuhne.mezo.feature.companion.reflection.service.ObservationFeedService feed;
    @Autowired private PatternRepository patterns;
    @Autowired private PatternEventRepository events;
    @Autowired private UserPopulator users;
    @Autowired private JournalPopulator journals;
    @Autowired private DailySummaryPopulator summaries;
    @Autowired private ObjectMapper mapper;
    @Autowired private io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunRepository retrievals;
    @Autowired private io.mrkuhne.mezo.feature.journal.repository.JournalEntryRepository journalRepository;
    @Autowired private io.mrkuhne.mezo.support.populator.PatternPopulator patternPopulator;
    @Autowired private io.mrkuhne.mezo.support.populator.PatternEventPopulator eventPopulator;
    @Autowired private io.mrkuhne.mezo.feature.companion.reflection.config.ReflectionProperties properties;

    @Test
    void testRun_shouldPublishGroundedLowScoreQuestionOnce_whenSourceBelongsToOwner() {
        UUID owner = users.createUser().getId();
        var journal = journals.createEntry(owner, LocalDate.now().minusDays(2), "Munka után kimerültem.", "quickinput");
        seed(owner, "journal_entry:" + journal.getId(), false);
        assertThat(pipeline.run(owner, null)).isEqualTo(1);
        var row = patterns.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner).getFirst();
        assertThat(row.getConfidence().doubleValue()).isLessThan(0.55);
        assertThat(row.getBelief()).isNull();
        assertThat(row.getEvidence().items()).contains("journal_entry:" + journal.getId());
        assertThat(events.findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(owner, row.getId()))
                .singleElement().satisfies(e -> {
                    assertThat(e.getKind()).isEqualTo(PatternEventEntity.KIND_OBSERVATION);
                    assertThat(e.getPayload().text()).contains("Nálad is így van?");
                    assertThat(e.getPayload().evidenceRefs()).anyMatch(s -> s.contains(LocalDate.now().minusDays(2).toString()));
                });
        assertThat(pipeline.run(owner, null)).isZero();
        assertThat(events.findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(owner, row.getId())).hasSize(1);
    }

    @Test
    void testRun_shouldRejectForeignSource_whenCritiqueClaimsGrounding() {
        UUID owner = users.createUser().getId();
        var foreign = journals.createEntry(users.createUser().getId(), LocalDate.now().minusDays(2), "Munka után kimerültem.", "quickinput");
        seed(owner, "journal_entry:" + foreign.getId(), false);
        assertThat(pipeline.run(owner, null)).isZero();
        assertThat(patterns.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner)).isEmpty();
    }

    @Test
    void testRun_shouldRejectContradiction_whenSourcesAreReal() {
        UUID owner = users.createUser().getId();
        var journal = journals.createEntry(owner, LocalDate.now().minusDays(2), "Munka után kimerültem.", "quickinput");
        seed(owner, "journal_entry:" + journal.getId(), true);
        assertThat(pipeline.run(owner, null)).isZero();
    }

    @Test
    void testRun_shouldKeepRejectedThreadClosed_whenSameTopicIsProposedAgain() {
        UUID owner = users.createUser().getId();
        var journal = journals.createEntry(owner, LocalDate.now().minusDays(2), "Munka után kimerültem.", "quickinput");
        seed(owner, "journal_entry:" + journal.getId(), false);
        assertThat(pipeline.run(owner, null)).isEqualTo(1);
        var row = patterns.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner).getFirst();
        row.setStatus("rejected");
        patterns.saveAndFlush(row);
        assertThat(pipeline.run(owner, null)).isZero();
        assertThat(patterns.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner)).hasSize(1);
        assertThat(events.findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(owner, row.getId())).hasSize(1);
    }

    @Test
    void testPreview_shouldNotPersistAndApplyShouldRevalidate_whenEvidenceWasDeleted() {
        UUID owner = users.createUser().getId();
        var journal = journals.createEntry(owner, LocalDate.now().minusDays(2), "Munka után kimerültem.", "quickinput");
        seed(owner, "journal_entry:" + journal.getId(), false);
        var candidates = pipeline.preview(owner, null);
        assertThat(candidates).hasSize(1);
        assertThat(patterns.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner)).isEmpty();
        assertThat(pipeline.apply(users.createUser().getId(), candidates.getFirst())).isFalse();
        journalRepository.delete(journal);
        assertThat(pipeline.apply(owner, candidates.getFirst())).isFalse();
        assertThat(patterns.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner)).isEmpty();
    }

    @Test
    void testApply_shouldUseExactlyPreviewedCandidateOnce_whenSourcesAreUnchanged() {
        UUID owner = users.createUser().getId();
        var journal = journals.createEntry(owner, LocalDate.now().minusDays(2), "Munka után kimerültem.", "quickinput");
        seed(owner, "journal_entry:" + journal.getId(), false);
        var candidate = pipeline.preview(owner, null).getFirst();
        assertThat(pipeline.apply(owner, candidate)).isTrue();
        assertThat(pipeline.apply(owner, candidate)).isFalse();
        var row = patterns.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner).getFirst();
        assertThat(events.findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(owner, row.getId()))
                .singleElement().satisfies(e -> assertThat(e.getPayload().text())
                        .isEqualTo(candidate.hypothesis().observation() + "\n\n" + candidate.hypothesis().question()));
    }

    @Test
    void testRun_shouldStorePendingObservation_whenDailyBudgetIsFull() {
        UUID owner = users.createUser().getId();
        var journal = journals.createEntry(owner, LocalDate.now().minusDays(2), "Munka után kimerültem.", "quickinput");
        seed(owner, "journal_entry:" + journal.getId(), false);
        var budgetRow = patternPopulator.statistical(owner);
        for (int i = 0; i < properties.notice().maxPerDay(); i++) {
            eventPopulator.observation(owner, budgetRow.getId(), "Korábbi", List.of(), true, java.time.Instant.now());
        }
        assertThat(pipeline.run(owner, null)).isEqualTo(1);
        var row = patterns.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner).stream()
                .filter(r -> !r.getId().equals(budgetRow.getId())).findFirst().orElseThrow();
        assertThat(events.findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(owner, row.getId()))
                .singleElement().satisfies(e -> {
                    assertThat(e.getPayload().surfaced()).isFalse();
                    assertThat(e.getPayload().channel()).isEqualTo("grounded");
                });
    }

    @Test
    void testRun_shouldUseRevisedPlan_whenGroundedProposalNamesAnOwnedOpenHypothesis() {
        UUID owner = users.createUser().getId();
        var journal = journals.createEntry(owner, LocalDate.now().minusDays(2), "Munka után kimerültem.", "quickinput");
        var old = patternPopulator.reflection(owner,
                new io.mrkuhne.mezo.feature.companion.entity.TestPlanEnvelope(
                    "sleep-duration-h", "checkin-energy", 0, "positive", 8, 3, 60), "monitoring");
        String json = proposal("journal_entry:" + journal.getId(), false, Map.of(
                "revisesHypothesisKey", old.getHypothesisKey(),
                "revisedTestPlan", Map.of("seriesA", "sleep-duration-h", "seriesB", "checkin-energy",
                        "lagDays", 1, "expectedDirection", "positive")));
        summaries.summary(owner, LocalDate.now().minusDays(1), "[fake-hypotheses:" + json + "]");
        assertThat(pipeline.run(owner, null)).isEqualTo(1);
        var created = patterns.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner).stream()
                .filter(r -> !r.getId().equals(old.getId())).findFirst().orElseThrow();
        assertThat(created.getTestPlan()).isNotNull();
        assertThat(created.getTestPlan().lagDays()).isEqualTo(1);
        assertThat(events.findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(owner, old.getId()))
                .singleElement().satisfies(e -> assertThat(e.getKind()).isEqualTo(PatternEventEntity.KIND_REVISED));
    }

    @Test
    void testRun_shouldUseDirectSources_whenDailySummaryDoesNotExist() {
        UUID owner = users.createUser().getId();
        var journal = journals.createEntry(owner, LocalDate.now().minusDays(2), "Munka után kimerültem.", "quickinput");
        String json = proposal("journal_entry:" + journal.getId(), false, Map.of());
        assertThat(pipeline.preview(owner, "[fake-hypotheses:" + json + "]")).hasSize(1);
    }

    @Test
    void testPreview_shouldUseRecoveryCapWithoutChangingNightlyCap_whenMoreCandidatesAreAvailable() {
        UUID owner = users.createUser().getId();
        var journal = journals.createEntry(owner, LocalDate.now().minusDays(2), "Munka után kimerültem.", "quickinput");
        String objects = java.util.stream.IntStream.range(0, 3).mapToObj(i -> {
            String one = proposal("journal_entry:" + journal.getId(), false, Map.of("topicKey", "topic-" + i));
            return one.substring(1, one.length() - 1);
        }).collect(java.util.stream.Collectors.joining(","));
        String context = "[fake-hypotheses:[" + objects + "]]";
        assertThat(pipeline.preview(owner, context)).hasSize(properties.propose().maxPerNight());
        assertThat(pipeline.preview(owner, context, 3)).hasSize(3);
    }

    @Test
    void testRun_shouldBoundMemoryQueryButKeepOriginalProposalEvidence_whenFallbackSourcesAreLong() {
        UUID owner = users.createUser().getId();
        UUID first = null;
        for (int i = 0; i < 6; i++) {
            var entry = journals.createEntry(owner, LocalDate.now().minusDays(i + 2L),
                    "LONG_SOURCE_" + i + " Munka után " + "elfáradtam ".repeat(50), "quickinput");
            if (first == null) first = entry.getId();
        }
        seed(owner, "journal_entry:" + first, false);
        int previousMessages = fakeLlm.userMessages().size();
        pipeline.run(owner, null);
        assertThat(retrievals.findAll().stream().filter(r -> owner.equals(r.getCreatedBy())
                && "REFLECTION".equals(r.getConsumerPolicy())).toList())
                .singleElement().satisfies(r -> assertThat(r.getRawQuery())
                        .hasSizeLessThanOrEqualTo(companionProperties.embedding().embedMaxChars()));
        assertThat(fakeLlm.userMessages().subList(previousMessages, fakeLlm.userMessages().size()))
                .anySatisfy(prompt -> {
                    assertThat(prompt.length()).isGreaterThan(companionProperties.embedding().embedMaxChars());
                    assertThat(prompt).contains("LONG_SOURCE_0", "LONG_SOURCE_1", "LONG_SOURCE_2",
                            "LONG_SOURCE_3", "LONG_SOURCE_4", "LONG_SOURCE_5");
                });
    }

    @Test
    void testRun_shouldSearchRelatedMemoriesWithoutArtificialDateBounds_whenYesterdayHasNoTextSignal() {
        UUID owner = users.createUser().getId();
        var journal = journals.createEntry(owner, LocalDate.now().minusDays(2), "Munka után kimerültem.", "quickinput");
        seed(owner, "journal_entry:" + journal.getId(), false);
        pipeline.run(owner, null);
        assertThat(retrievals.findAll().stream().filter(r -> owner.equals(r.getCreatedBy())
                && "REFLECTION".equals(r.getConsumerPolicy())).toList())
                .singleElement().satisfies(r -> {
                    assertThat(r.getRawQuery()).contains("Munka után kimerültem");
                    assertThat(r.getRawQuery()).doesNotContain(LocalDate.now().minusDays(2).toString());
                });
    }

    @Test
    void testApply_shouldRefreshSameTopicAndPruneDeletedProvenance_whenNewEvidenceArrives() {
        UUID owner = users.createUser().getId();
        var old = journals.createEntry(owner, LocalDate.now().minusDays(2), "Munka után kimerültem.", "quickinput");
        String first = proposal("journal_entry:" + old.getId(), false, Map.of());
        var original = pipeline.preview(owner, "[fake-hypotheses:" + first + "]").getFirst();
        assertThat(pipeline.apply(owner, original)).isTrue();
        var row = patterns.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner).getFirst();
        journalRepository.delete(old);
        var fresh = journals.createEntry(owner, LocalDate.now().minusDays(1), "Munka után megint elfáradtam.", "quickinput");
        String revised = proposal("journal_entry:" + fresh.getId(), false, Map.of("topicKey", "energy_work"));
        var candidate = pipeline.preview(owner, "[fake-hypotheses:" + revised + "]").getFirst();
        assertThat(pipeline.apply(owner, candidate)).isFalse(); // merged, not a second card
        assertThat(patterns.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner)).hasSize(1);
        var updated = patterns.findByIdAndCreatedByAndDeletedFalse(row.getId(), owner).orElseThrow();
        assertThat(updated.getEvidence().items()).contains("journal_entry:" + fresh.getId())
                .doesNotContain("journal_entry:" + old.getId());
        assertThat(events.findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(owner, row.getId())).hasSize(1);
    }

    @Test
    void testApply_shouldKeepCanonicalEvidencePerEvent_whenAnsweredThreadGetsNewSources() {
        UUID owner = users.createUser().getId();
        var old = journals.createEntry(owner, LocalDate.now().minusDays(2), "Munka után kimerültem.", "quickinput");
        String first = proposal("journal_entry:" + old.getId(), false, Map.of());
        assertThat(pipeline.apply(owner, pipeline.preview(owner, "[fake-hypotheses:" + first + "]").getFirst())).isTrue();
        var row = patterns.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner).getFirst();
        eventPopulator.userReply(owner, row.getId(), "chip", "watch", "Igen, jellemző.");
        journalRepository.delete(old);
        var fresh = journals.createEntry(owner, LocalDate.now().minusDays(1), "Munka után megint elfáradtam.", "quickinput");
        String next = proposal("journal_entry:" + fresh.getId(), false, Map.of());
        assertThat(pipeline.apply(owner, pipeline.preview(owner, "[fake-hypotheses:" + next + "]").getFirst())).isTrue();
        var observations = events.findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(owner, row.getId())
                .stream().filter(e -> PatternEventEntity.KIND_OBSERVATION.equals(e.getKind())).toList();
        assertThat(observations).hasSize(2);
        assertThat(observations.getFirst().getPayload().evidenceRefs()).contains("journal_entry:" + old.getId())
                .doesNotContain("journal_entry:" + fresh.getId());
        assertThat(observations.getLast().getPayload().evidenceRefs()).contains("journal_entry:" + fresh.getId())
                .doesNotContain("journal_entry:" + old.getId());
        assertThat(patterns.findByIdAndCreatedByAndDeletedFalse(row.getId(), owner).orElseThrow().getEvidence().items())
                .doesNotContain("journal_entry:" + old.getId());
    }

    @Test
    void testForDay_shouldSuppressDeletedHistoricalEvidence_whenThreadHasANewValidObservation() {
        UUID owner = users.createUser().getId();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        var old = journals.createEntry(owner, yesterday.minusDays(1), "Munka után kimerültem.", "quickinput");
        String first = proposal("journal_entry:" + old.getId(), false, Map.of());
        assertThat(pipeline.apply(owner, pipeline.preview(owner, "[fake-hypotheses:" + first + "]").getFirst())).isTrue();
        var row = patterns.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner).getFirst();
        var firstEvent = events.findFirstByCreatedByAndPatternIdAndKindAndDeletedFalseOrderByOccurredAtDesc(
                owner, row.getId(), PatternEventEntity.KIND_OBSERVATION).orElseThrow();
        var originalAt = yesterday.atTime(10, 0).atZone(java.time.ZoneId.systemDefault()).toInstant();
        firstEvent.setOccurredAt(originalAt);
        events.saveAndFlush(firstEvent);
        eventPopulator.userReply(owner, row.getId(), "chip", "watch", "Igen, jellemző.", originalAt.plusSeconds(60));
        assertThat(feed.forDay(owner, yesterday)).hasSize(1);
        journalRepository.delete(old);
        var fresh = journals.createEntry(owner, yesterday, "Munka után megint elfáradtam.", "quickinput");
        String next = proposal("journal_entry:" + fresh.getId(), false, Map.of());
        assertThat(pipeline.apply(owner, pipeline.preview(owner, "[fake-hypotheses:" + next + "]").getFirst())).isTrue();
        assertThat(feed.forDay(owner, yesterday)).isEmpty();
        assertThat(feed.forDay(owner, LocalDate.now())).singleElement().satisfies(card -> {
            assertThat(card.getEvidence()).anyMatch(label -> label.contains("Munka után megint elfáradtam"));
            assertThat(card.getEvidence()).noneMatch(label -> label.matches("[a-z_]+:[0-9a-fA-F-]{36}"));
        });
    }

    private void seed(UUID owner, String ref, boolean contradicted) {
        summaries.summary(owner, LocalDate.now().minusDays(1), "Nap. [fake-hypotheses:" + proposal(ref, contradicted, Map.of()) + "]");
    }

    private String proposal(String ref, boolean contradicted, Map<String, Object> extra) {
        String critique = mapper.writeValueAsString(Map.of("statistical", .1, "confounders", .2,
                "l3align", .4, "actionability", .8, "grounded", true, "contradicted", contradicted,
                "actionable", true, "reasoning", "Konkrét napló, ellenőrizendő kérdés."));
        var fields = new java.util.HashMap<String, Object>(Map.of("title", "Munka és energia [fake-critique:" + critique + "]",
                "mechanism", "Lehetséges kapcsolat", "category", "trigger", "observation", "Munka után kimerültséget írtál.",
                "question", "Nálad is így van?", "evidenceRefs", List.of(ref), "topicKey", "work-energy"));
        fields.putAll(extra);
        return mapper.writeValueAsString(List.of(fields));
    }
}
