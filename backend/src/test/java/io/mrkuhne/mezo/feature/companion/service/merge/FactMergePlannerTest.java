package io.mrkuhne.mezo.feature.companion.service.merge;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.FactMergeLedgerEntity;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.service.merge.FactMergeJudge.JudgedGroup;
import io.mrkuhne.mezo.feature.companion.service.merge.FactMergePlanner.AutoMerge;
import io.mrkuhne.mezo.feature.companion.service.merge.FactMergePlanner.Plan;
import io.mrkuhne.mezo.feature.companion.service.merge.FactMergePlanner.Proposal;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Task 3 (mezo-d6ivw.10): the fact-merge planner — pure decisions over the judge's raw groups. */
class FactMergePlannerTest {

    private static final Instant NOW = Instant.parse("2026-09-29T10:00:00Z");

    private static KnowledgeFactEntity fact(
            String source, String category, int reinforcement, Instant createdAt, boolean pinned) {
        KnowledgeFactEntity f = new KnowledgeFactEntity();
        f.setId(UUID.randomUUID());
        f.setFactText("tény");
        f.setSource(source);
        f.setCategory(category);
        f.setReinforcementCount(reinforcement);
        f.setCreatedAt(createdAt);
        f.setPinned(pinned);
        return f;
    }

    private static KnowledgeFactEntity chat(String category, int reinforcement, Instant createdAt) {
        return fact(KnowledgeFactEntity.SOURCE_CHAT, category, reinforcement, createdAt, false);
    }

    private static JudgedGroup same(int... members) {
        return new JudgedGroup("same", boxed(members), "");
    }

    private static JudgedGroup combine(String sentence, int... members) {
        return new JudgedGroup("combine", boxed(members), sentence);
    }

    private static List<Integer> boxed(int... members) {
        return java.util.stream.IntStream.of(members).boxed().toList();
    }

    // --- 1: same, two chat facts, same category ---

    @Test
    void sameChatFactsAutoMergeHigherReinforcementSurvives() {
        KnowledgeFactEntity weak = chat("life", 1, NOW);
        KnowledgeFactEntity strong = chat("life", 5, NOW);
        List<KnowledgeFactEntity> facts = List.of(weak, strong);

        List<Plan> plans = FactMergePlanner.plan(facts, List.of(same(1, 2)), Set.of());

        assertThat(plans).hasSize(1);
        AutoMerge merge = (AutoMerge) plans.get(0);
        assertThat(merge.survivor()).isSameAs(strong);
        assertThat(merge.losers()).containsExactly(weak);
        assertThat(merge.memberKey()).isEqualTo(FactMergeLedgerEntity.keyOf(List.of(weak.getId(), strong.getId())));
    }

    @Test
    void sameChatFactsTieBreaksOnOlderCreatedAt() {
        KnowledgeFactEntity older = chat("life", 3, NOW.minusSeconds(3600));
        KnowledgeFactEntity newer = chat("life", 3, NOW);
        List<KnowledgeFactEntity> facts = List.of(newer, older);

        List<Plan> plans = FactMergePlanner.plan(facts, List.of(same(1, 2)), Set.of());

        AutoMerge merge = (AutoMerge) plans.get(0);
        assertThat(merge.survivor()).isSameAs(older);
        assertThat(merge.losers()).containsExactly(newer);
    }

    // --- 2: same, pattern + chat -> pattern survives even with lower reinforcement ---

    @Test
    void samePatternPlusChatPatternSurvivesRegardlessOfReinforcement() {
        KnowledgeFactEntity pattern = fact(KnowledgeFactEntity.SOURCE_PATTERN, "life", 0, NOW, false);
        KnowledgeFactEntity chatFact = chat("life", 9, NOW);
        List<KnowledgeFactEntity> facts = List.of(pattern, chatFact);

        List<Plan> plans = FactMergePlanner.plan(facts, List.of(same(1, 2)), Set.of());

        assertThat(plans).hasSize(1);
        AutoMerge merge = (AutoMerge) plans.get(0);
        assertThat(merge.survivor()).isSameAs(pattern);
        assertThat(merge.losers()).containsExactly(chatFact);
    }

    // --- 3: same, two pattern facts -> skipped (a pattern would be a loser) ---

    @Test
    void sameTwoPatternFactsSkipped() {
        KnowledgeFactEntity p1 = fact(KnowledgeFactEntity.SOURCE_PATTERN, "life", 0, NOW, false);
        KnowledgeFactEntity p2 = fact(KnowledgeFactEntity.SOURCE_PATTERN, "life", 0, NOW, false);
        List<KnowledgeFactEntity> facts = List.of(p1, p2);

        List<Plan> plans = FactMergePlanner.plan(facts, List.of(same(1, 2)), Set.of());

        assertThat(plans).isEmpty();
    }

    // --- 4: protected members (person_fact/team_chat/question/pinned) ---

    @Test
    void sameWithPersonFactAsLoserCandidateSkipped() {
        KnowledgeFactEntity personFact = fact(KnowledgeFactEntity.SOURCE_PERSON_FACT, "life", 5, NOW, false);
        KnowledgeFactEntity chatFact = chat("life", 1, NOW);

        List<Plan> plans =
                FactMergePlanner.plan(List.of(personFact, chatFact), List.of(same(1, 2)), Set.of());

        assertThat(plans).isEmpty();
    }

    @Test
    void sameWithTeamChatAsLoserCandidateSkipped() {
        KnowledgeFactEntity teamChat = fact(KnowledgeFactEntity.SOURCE_TEAM_CHAT, "life", 5, NOW, false);
        KnowledgeFactEntity chatFact = chat("life", 1, NOW);

        List<Plan> plans =
                FactMergePlanner.plan(List.of(teamChat, chatFact), List.of(same(1, 2)), Set.of());

        assertThat(plans).isEmpty();
    }

    @Test
    void sameWithPinnedFactAsLoserCandidateSkipped() {
        KnowledgeFactEntity pinned = chat("life", 5, NOW);
        pinned.setPinned(true);
        KnowledgeFactEntity chatFact = chat("life", 1, NOW);

        List<Plan> plans =
                FactMergePlanner.plan(List.of(pinned, chatFact), List.of(same(1, 2)), Set.of());

        assertThat(plans).isEmpty();
    }

    @Test
    void sameQuestionPlusChatSkippedEvenThoughQuestionWouldBeSurvivor() {
        KnowledgeFactEntity question = fact(KnowledgeFactEntity.SOURCE_QUESTION, "life", 0, NOW, false);
        KnowledgeFactEntity chatFact = chat("life", 9, NOW);

        List<Plan> plans =
                FactMergePlanner.plan(List.of(question, chatFact), List.of(same(1, 2)), Set.of());

        assertThat(plans).isEmpty();
    }

    // --- 5: same across categories -> skipped ---

    @Test
    void sameAcrossCategoriesSkipped() {
        KnowledgeFactEntity a = chat("life", 1, NOW);
        KnowledgeFactEntity b = chat("train", 1, NOW);

        List<Plan> plans = FactMergePlanner.plan(List.of(a, b), List.of(same(1, 2)), Set.of());

        assertThat(plans).isEmpty();
    }

    // --- 6: combine of mergeable sources -> Proposal ---

    @Test
    void combineOfMergeableSourcesProducesProposal() {
        KnowledgeFactEntity chatFact = chat("fuel", 1, NOW);
        KnowledgeFactEntity weeklyReview = fact(KnowledgeFactEntity.SOURCE_WEEKLY_REVIEW, "fuel", 1, NOW, false);
        KnowledgeFactEntity manual = fact(KnowledgeFactEntity.SOURCE_MANUAL, "fuel", 1, NOW, false);
        List<KnowledgeFactEntity> facts = List.of(chatFact, weeklyReview, manual);
        String sentence = "Késő esti evés után nálad gyakran nehezebb az elalvás.";

        List<Plan> plans = FactMergePlanner.plan(facts, List.of(combine(sentence, 1, 2, 3)), Set.of());

        assertThat(plans).hasSize(1);
        Proposal proposal = (Proposal) plans.get(0);
        assertThat(proposal.members()).containsExactly(chatFact, weeklyReview, manual);
        assertThat(proposal.sentence()).isEqualTo(sentence);
        assertThat(proposal.category()).isEqualTo("fuel");
    }

    /** Drift guard (spec S9 delta): a merged sentence is written from ORIGINALS only — a fact
     *  that is itself a merge result never feeds a new {@code combine} rewrite. */
    @Test
    void combineWithMergeSourcedMemberSkipped() {
        KnowledgeFactEntity chatFact = chat("fuel", 1, NOW);
        KnowledgeFactEntity merged = fact(KnowledgeFactEntity.SOURCE_MERGE, "fuel", 1, NOW, false);

        List<Plan> plans = FactMergePlanner.plan(
                List.of(chatFact, merged), List.of(combine("mondat", 1, 2)), Set.of());

        assertThat(plans).isEmpty();
    }

    /** ...but an exact repeat of a merge result may still be folded into it ({@code same}). */
    @Test
    void sameWithMergeSourcedMemberStillAutoMerges() {
        KnowledgeFactEntity chatFact = chat("fuel", 1, NOW);
        KnowledgeFactEntity merged = fact(KnowledgeFactEntity.SOURCE_MERGE, "fuel", 4, NOW, false);

        List<Plan> plans = FactMergePlanner.plan(
                List.of(chatFact, merged), List.of(same(1, 2)), Set.of());

        assertThat(plans).hasSize(1);
        AutoMerge merge = (AutoMerge) plans.get(0);
        assertThat(merge.survivor()).isSameAs(merged);
        assertThat(merge.losers()).containsExactly(chatFact);
    }

    @Test
    void combineAcrossCategoriesSkipped() {
        KnowledgeFactEntity a = chat("fuel", 1, NOW);
        KnowledgeFactEntity b = chat("train", 1, NOW);

        List<Plan> plans = FactMergePlanner.plan(List.of(a, b), List.of(combine("mondat", 1, 2)), Set.of());

        assertThat(plans).isEmpty();
    }

    // --- 7: combine containing a pattern fact -> skipped ---

    @Test
    void combineWithPatternMemberSkipped() {
        KnowledgeFactEntity pattern = fact(KnowledgeFactEntity.SOURCE_PATTERN, "life", 1, NOW, false);
        KnowledgeFactEntity chatFact = chat("life", 1, NOW);

        List<Plan> plans =
                FactMergePlanner.plan(List.of(pattern, chatFact), List.of(combine("mondat", 1, 2)), Set.of());

        assertThat(plans).isEmpty();
    }

    // --- 8: group whose keyOf(members) is blocked -> skipped ---

    @Test
    void blockedMemberKeySkipped() {
        KnowledgeFactEntity a = chat("life", 1, NOW);
        KnowledgeFactEntity b = chat("life", 2, NOW);
        String key = FactMergeLedgerEntity.keyOf(List.of(a.getId(), b.getId()));

        List<Plan> plans = FactMergePlanner.plan(List.of(a, b), List.of(same(1, 2)), Set.of(key));

        assertThat(plans).isEmpty();
    }

    // --- 9: a fact already used by an earlier plan in this run -> later group skipped ---

    @Test
    void factAlreadyUsedInThisRunSkipsLaterGroup() {
        KnowledgeFactEntity a = chat("life", 1, NOW);
        KnowledgeFactEntity b = chat("life", 2, NOW);
        KnowledgeFactEntity c = chat("life", 3, NOW);
        List<KnowledgeFactEntity> facts = List.of(a, b, c);

        List<Plan> plans = FactMergePlanner.plan(
                facts, List.of(same(1, 2), same(2, 3)), Set.of());

        assertThat(plans).hasSize(1);
        AutoMerge merge = (AutoMerge) plans.get(0);
        assertThat(merge.survivor()).isSameAs(b);
        assertThat(merge.losers()).containsExactly(a);
    }
}
