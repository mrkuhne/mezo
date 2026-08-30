package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.KnowledgeFactResponse;
import io.mrkuhne.mezo.api.dto.PatternResponse;
import io.mrkuhne.mezo.feature.companion.HighlightCitationSource;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactService;
import io.mrkuhne.mezo.feature.companion.service.PatternService;
import io.mrkuhne.mezo.feature.proactive.entity.WeeklyReviewEntity;
import io.mrkuhne.mezo.feature.proactive.entity.WeeklyReviewHighlightsEnvelope.Highlight;
import io.mrkuhne.mezo.feature.proactive.repository.WeeklyReviewRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WeeklyReviewPopulator;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * The highlight-feedback loop (mezo-d20.7.7, handoff §6.4/B) exercised DIRECTLY on the derived
 * signal: what a citation is worth, what it must never be able to do, and how it disappears again.
 * {@code WeeklyReviewGeneratorIT} covers the write side (a generated highlight carries the cited
 * entity's id) and the regenerate round-trip through the fake LLM; here the review rows are built
 * by the populator so the read policy can be pinned down without scripting an answer.
 *
 * <p>No class-level {@code @Transactional} (the house IT rule); isolation comes from
 * {@code ResetDatabase}.
 */
@ActiveProfiles("companion-fake")
class HighlightCitationIT extends AbstractIntegrationTest {

    private static final LocalDate THIS_WEEK = LocalDate.now()
            .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

    @Autowired private HighlightCitationSource citationSource;
    @Autowired private PatternService patternService;
    @Autowired private KnowledgeFactService knowledgeFactService;
    @Autowired private KnowledgeFactRepository knowledgeFactRepository;
    @Autowired private WeeklyReviewRepository weeklyReviewRepository;
    @Autowired private WeeklyReviewPopulator weeklyReviewPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private KnowledgeFactPopulator knowledgeFactPopulator;
    @Autowired private UserPopulator userPopulator;

    private static Highlight pattern(UUID patternId) {
        return new Highlight(Highlight.KIND_PATTERN, "Alvás minta", patternId);
    }

    private static Highlight fact(UUID factId) {
        return new Highlight(Highlight.KIND_FACT, "Egy tény", factId);
    }

    /** The loop's happy path — and, just as importantly, everything it did NOT touch. */
    @Test
    void aCitedPatternAndFactGainTheCitationSignalAndNothingElseMoves() {
        UUID user = userPopulator.createUser("hc-basic@test.local").getId();
        PatternEntity target = patternPopulator.statistical(user);
        KnowledgeFactEntity cited = knowledgeFactPopulator.fact(user, "Reggel jobban edzel.", "train", 0);
        weeklyReviewPopulator.weeklyReview(user, THIS_WEEK, List.of(pattern(target.getId()), fact(cited.getId())));

        PatternResponse pattern = patternService.list(user).stream()
                .filter(p -> p.getId().equals(target.getId())).findFirst().orElseThrow();
        assertThat(pattern.getCitedWeeks()).isEqualTo(1);
        // a citation is the model choosing its own material — it may not become a statistic
        assertThat(pattern.getConfidence()).isNull();
        assertThat(pattern.getStatus()).isEqualTo(PatternEntity.STATUS_PROPOSED);

        KnowledgeFactResponse fact = knowledgeFactService.list(user).stream()
                .filter(f -> f.getId().equals(cited.getId())).findFirst().orElseThrow();
        assertThat(fact.getCitedWeeks()).isEqualTo(1);
        // reinforcementCount keeps meaning "the USER re-stated this" — the model quoting its own
        // knowledge is NOT a re-confirmation (the mezo-d20.7.6 call, held here too)
        assertThat(fact.getReinforcementCount()).isZero();
        assertThat(knowledgeFactRepository.findById(cited.getId()).orElseThrow().getLastReinforcedAt())
                .isNull();
    }

    /** An entity nothing cited reads 0, not null — the signal WAS measurable, it just said zero. */
    @Test
    void anUncitedEntityReadsZero() {
        UUID user = userPopulator.createUser("hc-uncited@test.local").getId();
        PatternEntity target = patternPopulator.statistical(user);

        assertThat(patternService.list(user)).singleElement()
                .satisfies(p -> assertThat(p.getCitedWeeks()).isZero());
        assertThat(citationSource.citedWeeks(user, HighlightCitationSource.KIND_PATTERN))
                .doesNotContainKey(target.getId());
    }

    /** Reversibility: a soft-deleted review's contribution must not linger as an unexplainable
     *  bump — the count is DERIVED from the live rows, so it simply stops being true. */
    @Test
    void aSoftDeletedReviewStopsContributing() {
        UUID user = userPopulator.createUser("hc-deleted@test.local").getId();
        PatternEntity target = patternPopulator.statistical(user);
        WeeklyReviewEntity review =
                weeklyReviewPopulator.weeklyReview(user, THIS_WEEK, List.of(pattern(target.getId())));
        assertThat(citationSource.citedWeeks(user, HighlightCitationSource.KIND_PATTERN))
                .containsEntry(target.getId(), 1);

        weeklyReviewRepository.delete(review); // @SQLDelete — soft

        assertThat(citationSource.citedWeeks(user, HighlightCitationSource.KIND_PATTERN))
                .doesNotContainKey(target.getId());
    }

    /** Two live weeks citing the same pattern are two weeks of evidence. */
    @Test
    void eachLiveWeekCountsOnce() {
        UUID user = userPopulator.createUser("hc-two-weeks@test.local").getId();
        PatternEntity target = patternPopulator.statistical(user);
        weeklyReviewPopulator.weeklyReview(user, THIS_WEEK, List.of(pattern(target.getId())));
        weeklyReviewPopulator.weeklyReview(user, THIS_WEEK.minusWeeks(1), List.of(pattern(target.getId())));

        assertThat(citationSource.citedWeeks(user, HighlightCitationSource.KIND_PATTERN))
                .containsEntry(target.getId(), 2);
    }

    /** ONE week naming the same pattern twice (a confirmed AND a reinforced event in that week are
     *  two candidates over one pattern) is still ONE week of evidence. */
    @Test
    void oneWeekNamingTheSamePatternTwiceCountsOnce() {
        UUID user = userPopulator.createUser("hc-dup@test.local").getId();
        PatternEntity target = patternPopulator.statistical(user);
        weeklyReviewPopulator.weeklyReview(user, THIS_WEEK,
                List.of(pattern(target.getId()), pattern(target.getId())));

        assertThat(citationSource.citedWeeks(user, HighlightCitationSource.KIND_PATTERN))
                .containsEntry(target.getId(), 1);
    }

    /** Older than the trailing window ⇒ the signal has decayed away. */
    @Test
    void aCitationOlderThanTheWindowNoLongerCounts() {
        UUID user = userPopulator.createUser("hc-window@test.local").getId();
        PatternEntity target = patternPopulator.statistical(user);
        weeklyReviewPopulator.weeklyReview(user, THIS_WEEK.minusWeeks(60), List.of(pattern(target.getId())));

        assertThat(citationSource.citedWeeks(user, HighlightCitationSource.KIND_PATTERN))
                .doesNotContainKey(target.getId());
    }

    /** A pre-mezo-d20.7.7 row has no ref; matching it back by label would be a guess, so it
     *  contributes nothing rather than a fuzzy match. */
    @Test
    void aHighlightWithoutARefContributesNothing() {
        UUID user = userPopulator.createUser("hc-legacy@test.local").getId();
        PatternEntity target = patternPopulator.statistical(user);
        weeklyReviewPopulator.weeklyReview(user, THIS_WEEK,
                List.of(new Highlight(Highlight.KIND_PATTERN, target.getTitle(), null)));

        assertThat(citationSource.citedWeeks(user, HighlightCitationSource.KIND_PATTERN)).isEmpty();
    }

    /** A citation of something that has since been deleted resolves to nothing — no exception on
     *  any read path, and no ghost row in the list. */
    @Test
    void aCitationOfADeletedFactBreaksNothing() {
        UUID user = userPopulator.createUser("hc-dangling@test.local").getId();
        KnowledgeFactEntity doomed = knowledgeFactPopulator.fact(user, "Eltűnő tény.", "life", 0);
        weeklyReviewPopulator.weeklyReview(user, THIS_WEEK, List.of(fact(doomed.getId())));

        knowledgeFactRepository.delete(doomed); // @SQLDelete — soft

        assertThat(knowledgeFactService.list(user)).noneSatisfy(f -> assertThat(f.getId()).isEqualTo(doomed.getId()));
        assertThat(knowledgeFactService.renderPromptBlock(user)).doesNotContain("Eltűnő tény.");
        // the dangling ref is still in the jsonb and is simply never matched
        assertThat(citationSource.citedWeeks(user, HighlightCitationSource.KIND_FACT))
                .containsEntry(doomed.getId(), 1);
    }

    // ── fact salience: the citation is a TIE-BREAKER, never a lead term ──────────────────────

    /** Two equally-reinforced facts: the cited one wins even though it is the OLDER one (the
     *  baseline order is reinforcement desc, then newest first). */
    @Test
    void aCitedFactOutranksAnEquallyReinforcedUncitedFactInThePromptBlock() {
        UUID user = userPopulator.createUser("hc-tiebreak@test.local").getId();
        Instant older = Instant.now().minus(10, ChronoUnit.DAYS).truncatedTo(ChronoUnit.MICROS);
        KnowledgeFactEntity cited = knowledgeFactPopulator.factAt(user, "Idézett tény.", "train", older);
        KnowledgeFactEntity fresher = knowledgeFactPopulator.factAt(
                user, "Frissebb tény.", "train", older.plus(1, ChronoUnit.DAYS));

        String before = knowledgeFactService.renderPromptBlock(user);
        assertThat(before.indexOf("Frissebb tény.")).isLessThan(before.indexOf("Idézett tény."));

        weeklyReviewPopulator.weeklyReview(user, THIS_WEEK, List.of(fact(cited.getId())));

        String after = knowledgeFactService.renderPromptBlock(user);
        assertThat(after.indexOf("Idézett tény.")).isLessThan(after.indexOf("Frissebb tény."));
        assertThat(fresher.getReinforcementCount()).isEqualTo(cited.getReinforcementCount());
    }

    /** The ceiling: a citation may only sort what reinforcement has made indistinguishable. Four
     *  cited weeks still lose to one more user re-confirmation. */
    @Test
    void aCitationCannotOutrankRealReinforcement() {
        UUID user = userPopulator.createUser("hc-ceiling@test.local").getId();
        KnowledgeFactEntity cited = knowledgeFactPopulator.fact(user, "Sokat idézett tény.", "train", 1);
        knowledgeFactPopulator.fact(user, "Megerősített tény.", "train", 2);
        for (int week = 0; week < 4; week++) {
            weeklyReviewPopulator.weeklyReview(user, THIS_WEEK.minusWeeks(week), List.of(fact(cited.getId())));
        }

        String block = knowledgeFactService.renderPromptBlock(user);

        assertThat(block.indexOf("Megerősített tény.")).isLessThan(block.indexOf("Sokat idézett tény."));
        assertThat(knowledgeFactService.list(user)).anySatisfy(f -> {
            assertThat(f.getFactText()).isEqualTo("Sokat idézett tény.");
            assertThat(f.getCitedWeeks()).isEqualTo(4);
            assertThat(f.getReinforcementCount()).isEqualTo(1);
        });
    }

    /** Citations are per-user: another user's weekly review never lends salience. */
    @Test
    void anotherUsersCitationDoesNotCount() {
        UUID user = userPopulator.createUser("hc-owner@test.local").getId();
        UUID other = userPopulator.createUser("hc-other@test.local").getId();
        PatternEntity target = patternPopulator.statistical(user);
        weeklyReviewPopulator.weeklyReview(other, THIS_WEEK, List.of(pattern(target.getId())));

        assertThat(citationSource.citedWeeks(user, HighlightCitationSource.KIND_PATTERN)).isEmpty();
        assertThat(patternService.list(user)).singleElement()
                .satisfies(p -> assertThat(p.getCitedWeeks()).isZero());
    }
}
