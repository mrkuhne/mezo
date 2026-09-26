package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.reflection.entity.EffectLinkEntity;
import io.mrkuhne.mezo.feature.companion.reflection.repository.EffectLinkRepository;
import io.mrkuhne.mezo.feature.people.entity.MentionEntity;
import io.mrkuhne.mezo.feature.people.repository.MentionRepository;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.ProactiveMemoryUseRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.feature.contextual-feed.enabled=true")
class ContextualFeedKindsIT extends AbstractIntegrationTest {
    @Autowired private CompanionMessageGenerator generator;
    @Autowired private AdviceCardService advice;
    @Autowired private UserPopulator users;
    @Autowired private CompanionMessagePopulator messages;
    @Autowired private WeightLogPopulator weights;
    @Autowired private SleepLogPopulator sleeps;
    @Autowired private DailySummaryPopulator summaries;
    @Autowired private PersonPopulator people;
    @Autowired private MentionPopulator mentions;
    @Autowired private SleepGoalPopulator sleepGoals;
    @Autowired private TrainPopulator training;
    @Autowired private WaterLogPopulator water;
    @Autowired private CheckInPopulator checkins;
    @Autowired private FakeCompanionLlm fake;
    @Autowired private EffectLinkRepository effectLinkRepository;
    @Autowired private MentionRepository mentionRepository;
    @Autowired private ProactiveMemoryUseRepository proactiveMemoryUseRepository;

    /** S5 (bd mezo-d6ivw.5) Task 4 — same idiom as {@code ProactiveMemoryBlockIT#effectRow}. */
    private EffectLinkEntity effectRow(UUID owner, String kind, String key, String metric, double delta) {
        EffectLinkEntity e = new EffectLinkEntity();
        e.setCreatedBy(owner);
        e.setSubjectKind(kind);
        e.setSubjectKey(key);
        e.setMetric(metric);
        e.setCliffsDelta(BigDecimal.valueOf(delta).setScale(3));
        e.setMeanDiff(new BigDecimal("1.50"));
        e.setSubjectDays(8);
        e.setComplementDays(20);
        e.setStrengthBand("eros");
        e.setConfidenceTier("kozepes");
        e.setWindowDays(60);
        e.setComputedAt(Instant.now());
        return effectLinkRepository.saveAndFlush(e);
    }

    /** Same idiom as {@code ProactiveMemoryBlockIT#contextMention}. */
    private void contextMention(UUID owner, UUID personId, Instant ts, String contextLabel) {
        MentionEntity m = new MentionEntity();
        m.setCreatedBy(owner);
        m.setPersonId(personId);
        m.setTs(ts);
        m.setSource("chip");
        m.setExcerpt("Teszt említés.");
        m.setContextLabel(contextLabel);
        m.setFlagged(false);
        mentionRepository.saveAndFlush(m);
    }

    /**
     * S5 (bd mezo-d6ivw.5) Task 4: the contextual morning path hands the apropó block to
     * {@code FeedGenerationService} through its {@code facts} argument — no envelope-ref
     * assertion here, refs on the contextual path are the contextual service's own.
     *
     * <p>Morning only ever matches a PLANNED-today or a YESTERDAY signal (never same-day —
     * {@code ProactiveMemoryBlock.candidateTriggers}), so the context mention here is dated
     * yesterday, mirroring {@code ProactiveMemoryBlockIT#yesterdayPersonMatchWithFactFiresMorningApropo}.
     */
    @Test
    void testGenerateMorning_shouldIncludeApropoBlockAndRecordUse_whenYesterdayMatchExists() {
        var user = users.createUser().getId();
        var date = LocalDate.now();
        summaries.summary(user, date.minusDays(1));
        var person = people.createPerson(user, "Anna");
        contextMention(user, person.getId(),
                date.minusDays(1).atStartOfDay(ZoneId.systemDefault()).plusHours(18).toInstant(), "kozos_program");
        effectRow(user, EffectLinkEntity.SUBJECT_EVENT, "kozos_program", EffectLinkEntity.METRIC_STRESS, 0.7);

        CompanionMessageEntity row = generator.generateMorning(user, date);

        assertThat(row).isNotNull();
        assertThat(fake.lastUserMessage()).contains("AKTUÁLIS APROPÓ");
        assertThat(proactiveMemoryUseRepository.findByCreatedByAndUsedOnGreaterThanEqual(user, date))
                .hasSize(1);
    }

    @Test
    void testGenerateMorning_shouldNotIncludeApropoBlock_whenNothingMatches() {
        var user = users.createUser().getId();
        var date = LocalDate.now();
        summaries.summary(user, date.minusDays(1));

        CompanionMessageEntity row = generator.generateMorning(user, date);

        assertThat(row).isNotNull();
        assertThat(fake.lastUserMessage()).doesNotContain("AKTUÁLIS APROPÓ");
        assertThat(proactiveMemoryUseRepository.findByCreatedByAndUsedOnGreaterThanEqual(user, date)).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"morning", "sleep", "weight", "midday", "evening", "people", "advice", "hydration"})
    void testGenerate_shouldPersistSharedHistoryAndToolTrace_whenKindIsEligible(String kind) {
        var user = users.createUser().getId();
        var date = LocalDate.now();
        var prior = messages.createMessage(user, date.minusDays(1), kind, "Korábban", List.of("PRIOR_CONTEXT"));
        summaries.summary(user, date.minusDays(1));
        weights.createWeightLog(user, date, new BigDecimal("82.4"));
        sleeps.createSleepLog(user, date, new BigDecimal("6.5"), 6);
        var person = people.createPerson(user, "Zita");
        mentions.createMention(user, person.getId(), date.atStartOfDay(ZoneOffset.UTC).toInstant(), "positive");
        sleepGoals.goal(user);
        training.createGymSlot(user, date.getDayOfWeek().getValue() - 1, "18:00");
        water.createWaterLog(user, date, 400);
        checkins.createCheckIn(user, date, "06:30", 4, 2, "[fake-tool:get_weight_log {\"days\":7}]");
        CompanionMessageEntity row = switch (kind) {
            case "morning" -> generator.generateMorning(user, date);
            case "sleep" -> generator.generateSleepReaction(user, date);
            case "weight" -> generator.generateWeightReaction(user, date);
            case "people" -> generator.generatePeopleObservation(user, date);
            case "hydration" -> generator.generateHydrationCheckpoint(user, date, LocalTime.of(15, 0));
            case "advice" -> advice.deliver(user, AdviceCandidate.fromFlag("sleep_debt", "entry", "Tanács",
                    List.of("Kevesebb alvás"), List.of("Figyeld a pihenést"), "Tartalék")).orElseThrow();
            default -> generator.generateWindow(user, date, kind);
        };
        assertThat(row).isNotNull();
        assertThat(row.getContent().trace()).isNotNull();
        assertThat(row.getContent().trace().priorMessageIds()).contains(prior.getId());
        assertThat(row.getContent().trace().toolCalls().calls()).extracting(c -> c.name()).contains("get_weight_log");
        assertThat(fake.lastUserMessage()).contains("PRIOR_CONTEXT");
        if (kind.equals("weight")) assertThat(generator.generateWeightReaction(user, date).getId()).isEqualTo(row.getId());
    }

    @Test
    void testGenerateMorning_shouldWorkWithoutSummary_whenCurrentEventExists() {
        var user = users.createUser().getId();
        var date = LocalDate.now();
        weights.createWeightLog(user, date, new BigDecimal("82.4"));
        assertThat(generator.generateMorning(user, date)).isNotNull();
    }

    @Test
    void testGenerate_shouldKeepFallbackOnlyForDeterministicCards_whenModelResponseIsMalformed() {
        var user = users.createUser().getId();
        var date = LocalDate.now();
        weights.createWeightLog(user, date, new BigDecimal("82.4"));
        checkins.createCheckIn(user, date, "06:30", 4, 2, "[fake-contextual-malformed]");
        assertThat(generator.generateWeightReaction(user, date)).isNull();
        var card = advice.deliver(user, AdviceCandidate.fromFlag("sleep_debt", "entry", "Tanács",
                List.of(), List.of("Pihenés"), "Biztos tartalék")).orElseThrow();
        assertThat(card.getContent().body()).containsExactly("Biztos tartalék");
        assertThat(card.getContent().adviceKey()).isEqualTo("sleep_debt");
        sleepGoals.goal(user);
        training.createGymSlot(user, date.getDayOfWeek().getValue() - 1, "18:00");
        water.createWaterLog(user, date, 400);
        var hydration = generator.generateHydrationCheckpoint(user, date, LocalTime.of(15, 0));
        assertThat(hydration.getContent().body().getFirst()).contains("400", "2000", "4000");
        assertThat(hydration.getContent().trace()).isNotNull();
        assertThat(hydration.getContent().trace().degradedReason()).isEqualTo("hydration_template_fallback");
    }
}
