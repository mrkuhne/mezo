package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.HypothesisPipelineService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * V3.2 pipeline e2e over the fake LLM: the {@code [fake-hypotheses:…]} sentinel rides a
 * populator-seeded daily-summary narrative into the weekly context; per-hypothesis
 * {@code [fake-critique:…]}/{@code [fake-revise:…]} markers (planted in the scripted titles)
 * steer keep / discard / revise — all LLM/network-free.
 */
@Transactional
@ActiveProfiles("companion-fake")
class HypothesisPipelineServiceIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.now().minusDays(1);

    @Autowired private HypothesisPipelineService pipeline;
    @Autowired private PatternRepository patternRepository;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private UserPopulator userPopulator;

    private void seedContext(UUID owner, String hypothesesJson) {
        dailySummaryPopulator.summary(owner, DAY,
                "Tegnap kemény nap volt. [fake-hypotheses:" + hypothesesJson + "]");
    }

    @Test
    void testRun_shouldPersistSurvivor_whenCritiqueAboveKeepThreshold() {
        UUID owner = userPopulator.createUser().getId();
        // no critique sentinel → the fake's default GOOD critique (0.8 each → score 0.8 ≥ 0.75)
        seedContext(owner, """
                [{"title":"Reta-hét eleji alváshiány rontja a pénteki volument",\
                "mechanism":"A ciklus eleji étvágytalanság alváshiánnyal társulva csökkenti a heti volument.",\
                "category":"physiology"}]""");

        int persisted = pipeline.run(owner);

        assertThat(persisted).isEqualTo(1);
        List<PatternEntity> rows = patternRepository.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner);
        assertThat(rows).hasSize(1);
        PatternEntity row = rows.getFirst();
        assertThat(row.getKind()).isEqualTo(PatternEntity.KIND_AI_HYPOTHESIS);
        assertThat(row.getStatus()).isEqualTo(PatternEntity.STATUS_PROPOSED);
        assertThat(row.getConfidence().doubleValue()).isCloseTo(0.8, within(1e-9));
        assertThat(row.getCritique().statistical()).isEqualTo(0.8);
        assertThat(row.getCritique().reasoning()).isEqualTo("rendben");
        assertThat(row.getPairKey()).startsWith("hyp-");
        assertThat(row.getR()).isNull();
        assertThat(row.getN()).isNull();
    }

    @Test
    void testRun_shouldDiscard_whenCritiqueBelowReviseThreshold() {
        UUID owner = userPopulator.createUser().getId();
        seedContext(owner, """
                [{"title":"Gyenge sejtés [fake-critique:{\\"statistical\\":0.2,\\"confounders\\":0.2,\\"l3align\\":0.2,\\"actionability\\":0.2,\\"reasoning\\":\\"nincs alap\\"}]",\
                "mechanism":"M","category":"trigger"}]""");

        assertThat(pipeline.run(owner)).isZero();
        assertThat(patternRepository.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner)).isEmpty();
    }

    @Test
    void testRun_shouldReviseOnceAndKeep_whenBorderlineCritique() {
        UUID owner = userPopulator.createUser().getId();
        // first critique 0.6 (borderline) → revise sentinel yields a clean title → default 0.8 → kept
        seedContext(owner, """
                [{"title":"Határeset [fake-critique:{\\"statistical\\":0.6,\\"confounders\\":0.6,\\"l3align\\":0.6,\\"actionability\\":0.6,\\"reasoning\\":\\"szukiteni\\"}]\
                 [fake-revise:{\\"title\\":\\"Szukitett hipotezis\\",\\"mechanism\\":\\"M2\\",\\"category\\":\\"trigger\\"}]",\
                "mechanism":"M","category":"trigger"}]""");

        int persisted = pipeline.run(owner);

        assertThat(persisted).isEqualTo(1);
        List<PatternEntity> rows = patternRepository.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner);
        assertThat(rows).hasSize(1);
        assertThat(rows.getFirst().getTitle()).isEqualTo("Szukitett hipotezis");
    }

    @Test
    void testRun_shouldSkipKnownHypothesis_whenSameKeyRejected() {
        UUID owner = userPopulator.createUser().getId();
        String title = "Ismert hipotézis";
        PatternEntity rejected = new PatternEntity();
        rejected.setCreatedBy(owner);
        rejected.setKind(PatternEntity.KIND_AI_HYPOTHESIS);
        rejected.setPairKey(HypothesisPipelineService.hypothesisKey(title));
        rejected.setCategory("trigger");
        rejected.setCategoryLabel("Trigger");
        rejected.setTitle(title);
        rejected.setEvidence(new io.mrkuhne.mezo.feature.companion.entity.PatternEvidenceEnvelope(List.of()));
        rejected.setStatus(PatternEntity.STATUS_REJECTED);
        patternRepository.saveAndFlush(rejected);
        seedContext(owner, """
                [{"title":"Ismert hipotézis","mechanism":"M","category":"trigger"}]""");

        assertThat(pipeline.run(owner)).isZero();
        assertThat(patternRepository.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner)).hasSize(1);
    }

    @Test
    void testRun_shouldSkipCategorylessProposal_whenSiblingIsValid() {
        UUID owner = userPopulator.createUser().getId();
        // a category-less proposal is valid-looking LLM output — it must not abort the round
        seedContext(owner, """
                [{"title":"Kategória nélküli","mechanism":"M"},\
                {"title":"Ép hipotézis","mechanism":"M","category":"trigger"}]""");

        assertThat(pipeline.run(owner)).isEqualTo(1);
        List<PatternEntity> rows = patternRepository.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner);
        assertThat(rows).hasSize(1);
        assertThat(rows.getFirst().getTitle()).isEqualTo("Ép hipotézis");
    }

    @Test
    void testRun_shouldSurviveBrokenProposalJson_whenAnswerNotParseable() {
        UUID owner = userPopulator.createUser().getId();
        dailySummaryPopulator.summary(owner, DAY, "Nap. [fake-hypotheses:[ez-nem-json]]");

        assertThat(pipeline.run(owner)).isZero();
        assertThat(patternRepository.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner)).isEmpty();
    }

    @Test
    void testRun_shouldCapProposals_whenMoreThanMaxPerRun() {
        UUID owner = userPopulator.createUser().getId();
        seedContext(owner, """
                [{"title":"H1","mechanism":"M","category":"trigger"},\
                {"title":"H2","mechanism":"M","category":"trigger"},\
                {"title":"H3","mechanism":"M","category":"trigger"},\
                {"title":"H4","mechanism":"M","category":"trigger"}]""");

        // max-per-run: 3 — the 4th proposal is never judged
        assertThat(pipeline.run(owner)).isEqualTo(3);
    }

    @Test
    void testRun_shouldDoNothing_whenNoNarrativeContext() {
        UUID owner = userPopulator.createUser().getId();

        assertThat(pipeline.run(owner)).isZero();
    }
}
