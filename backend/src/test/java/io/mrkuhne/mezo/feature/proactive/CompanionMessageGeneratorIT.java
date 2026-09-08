package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.tools.ToolText;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.feature.proactive.service.CompanionMessageGenerator;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.CompanionMessagePopulator;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.MentionPopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

/**
 * Companion-feed morning-kind generation flow over the fake LLM: the pure-code gather composes
 * the biometrics-free snapshot + facts + past summaries + numbered ref candidates; the
 * {@code [fake-feed-morning:{…}]} sentinel (planted via a check-in note, the {@code
 * [fake-briefing:…]} trick) scripts the strict-JSON answer; no summaries in the window or a
 * broken answer produce NO row (honest absence).
 *
 * <p>mezo-4jux: the candidate block is presence-filtered, so these tests also pin WHICH sources
 * are offered — a source whose snapshot block rendered as {@code nincs adat} must not appear
 * among the candidates, and therefore cannot end up as a provenance chip on the card.
 *
 * <p>Reflexió is switched OFF here (this class asserts nothing about the digest): the class is
 * itself {@code @Transactional}, so {@code ResetDatabase}'s fixture {@code TRUNCATE} never commits
 * for the duration of a test method, and a {@code REQUIRES_NEW} digest read would then wait out its
 * whole {@code DIGEST_TIMEOUT_SECONDS} on that lock before failing soft — 2 seconds burned per test
 * for a digest nobody here checks. {@code ReflectionDigestMorningIT} is the class that covers the
 * digest path (including the timeout/rollback behaviour) with a non-class-transactional fixture.
 *
 * <p>Memória mindenhol S7 (mezo-eq85.7): for the SAME reason, the shared {@code MORNING_BRIEFING}
 * memory policy is switched OFF here too (this class asserts nothing about the memory block
 * either) — a real retrieval spawns retriever tasks on {@code applicationTaskExecutor} that each
 * need their OWN pooled JDBC connection while this class' single test connection sits inside the
 * still-open outer transaction, and 17 tests' worth of that contention turns a sub-second class
 * into a multi-minute one. {@code CompanionMessageGeneratorMemoryIT} (not class-transactional) is
 * what actually covers the memory-block path.
 */
@Transactional
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
    "mezo.companion.reflection.enabled=false",
    "mezo.companion.memory-platform.policies.morning-briefing.enabled=false"
})
class CompanionMessageGeneratorIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 7, 6);

    @Autowired private CompanionMessageGenerator companionMessageGenerator;
    @Autowired private CompanionMessageRepository companionMessageRepository;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private CompanionMessagePopulator companionMessagePopulator;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private PersonPopulator personPopulator;
    @Autowired private MentionPopulator mentionPopulator;
    @Autowired private FakeCompanionLlm fakeLlm;

    @Test
    void testGenerateMorning_shouldPersistEnvelope_whenNarrativeWindowHasSummaries() {
        UUID user = userPopulator.createUser("morning-gen@test.local").getId();
        dailySummaryPopulator.summary(user, DAY.minusDays(1), "Tegnap pihenőnap volt.");
        // mezo-4jux: the Goal candidate is offered only because the [Cél] block actually renders a
        // goal — without this row the snapshot says "nincs adat" and index 0 is a different source.
        goalPopulator.createGoal(user, "active");
        // the check-in note rides into the snapshot's [Regeneráció] block -> the fake sees it
        checkInPopulator.createCheckIn(user, DAY, "06:30", 4, 2,
                "[fake-feed-morning:{\"eyebrow\":\"Jó reggelt\",\"body\":[\"Mai terv.\"],\"refIndexes\":[0]}]");

        CompanionMessageEntity message = companionMessageGenerator.generateMorning(user, DAY);

        assertThat(message).isNotNull();
        assertThat(message.getKind()).isEqualTo(CompanionMessageEntity.KIND_MORNING);
        assertThat(message.getContent().eyebrow()).isEqualTo("Jó reggelt");
        assertThat(message.getContent().body()).containsExactly("Mai terv.");
        assertThat(message.getContent().refs()).extracting("kind").containsExactly("Goal");
        assertThat(message.getContent().refs()).extracting("label").containsExactly("cél");
        assertThat(message.getGeneratedAt()).isNotNull();
    }

    @Test
    void testGenerateMorning_shouldReturnNull_whenNoSummariesInWindow() {
        UUID user = userPopulator.createUser("morning-empty@test.local").getId();

        assertThat(companionMessageGenerator.generateMorning(user, DAY)).isNull();
        assertThat(companionMessageRepository.count()).isZero();
    }

    @Test
    void testGenerateMorning_shouldReturnExistingRow_whenCalledTwice() {
        UUID user = userPopulator.createUser("morning-idem@test.local").getId();
        dailySummaryPopulator.summary(user, DAY.minusDays(1), "Tegnap úszás volt.");
        checkInPopulator.createCheckIn(user, DAY, "06:30", 4, 2,
                "[fake-feed-morning:{\"eyebrow\":\"Jó reggelt\",\"body\":[\"Mai terv.\"],\"refIndexes\":[]}]");

        CompanionMessageEntity first = companionMessageGenerator.generateMorning(user, DAY);
        CompanionMessageEntity second = companionMessageGenerator.generateMorning(user, DAY);

        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(companionMessageRepository.count()).isEqualTo(1);
    }

    /**
     * mezo-4jux: the defect that shipped — the card's body said no medication was recorded while
     * its "Amire épült" row still showed a "Gyógyszer ×1" chip. The snapshot's honest absence and
     * the candidate list are asserted TOGETHER: the payload must state {@code [Gyógyszer] nincs
     * adat} and, precisely because it does, must not offer {@code [Medication]} as a candidate.
     * The four out-of-range indexes also exercise the second belt ({@code resolveRefs}) — a model
     * answering a stale index must resolve to nothing, not to a neighbouring candidate.
     */
    @Test
    void testGenerateMorning_shouldNotOfferASourceThatRenderedAsAbsent() {
        UUID user = userPopulator.createUser("morning-absent-source@test.local").getId();
        dailySummaryPopulator.summary(user, DAY.minusDays(1), "Tegnap pihenőnap volt.");
        // no goal, no mesocycle, no medication for this user — only the fuel day renders
        checkInPopulator.createCheckIn(user, DAY, "06:30", 4, 2,
                "[fake-feed-morning:{\"eyebrow\":\"Jó reggelt\",\"body\":[\"Mai terv.\"],"
                        + "\"refIndexes\":[0,1,2,3]}]");

        CompanionMessageEntity message = companionMessageGenerator.generateMorning(user, DAY);

        assertThat(fakeLlm.lastUserMessage())
                .contains("[Gyógyszer] " + ToolText.NO_DATA)
                .doesNotContain("[Medication]")
                .doesNotContain("[Goal]")
                .doesNotContain("[Workout]");
        assertThat(message).isNotNull();
        assertThat(message.getContent().refs())
                .extracting("kind", "label")
                .containsExactly(
                        tuple("FuelDay", "mai üzemanyag"),
                        tuple("Memory", DAY.minusDays(1).toString()));
    }

    @Test
    void testGenerateSleepReaction_shouldPersistEnvelope_whenFreshSleepLogExists() {
        UUID user = userPopulator.createUser("sleep-gen@test.local").getId();
        sleepLogPopulator.createSleepLog(user, DAY, new BigDecimal("7.50"), 4);
        checkInPopulator.createCheckIn(user, DAY, "06:30", 4, 2,
                "[fake-feed-sleep:{\"eyebrow\":\"Jó alvás\",\"body\":[\"Pihenten kelsz.\"],\"refIndexes\":[0]}]");

        CompanionMessageEntity message = companionMessageGenerator.generateSleepReaction(user, DAY);

        assertThat(message).isNotNull();
        assertThat(message.getKind()).isEqualTo(CompanionMessageEntity.KIND_SLEEP);
        assertThat(message.getContent().eyebrow()).isEqualTo("Jó alvás");
        assertThat(message.getContent().body()).containsExactly("Pihenten kelsz.");
        assertThat(message.getContent().refs()).extracting("kind").containsExactly("Sleep");
        assertThat(message.getGeneratedAt()).isNotNull();
    }

    @Test
    void testGenerateSleepReaction_shouldReturnNull_whenNoFreshSleepLog() {
        UUID user = userPopulator.createUser("sleep-stale@test.local").getId();
        sleepLogPopulator.createSleepLog(user, DAY.minusDays(2), new BigDecimal("7.00"), 4);

        assertThat(companionMessageGenerator.generateSleepReaction(user, DAY)).isNull();
        assertThat(companionMessageRepository.count()).isZero();
    }

    @Test
    void testGenerateWeightReaction_shouldPersistEnvelope_whenTodayWeighInExists() {
        UUID user = userPopulator.createUser("weight-gen@test.local").getId();
        weightLogPopulator.createWeightLog(user, DAY, new BigDecimal("82.40"));
        checkInPopulator.createCheckIn(user, DAY, "06:30", 4, 2,
                "[fake-feed-weight:{\"eyebrow\":\"Mérés kész\",\"body\":[\"Stabil úton vagy.\"],\"refIndexes\":[0]}]");

        CompanionMessageEntity message = companionMessageGenerator.generateWeightReaction(user, DAY);

        assertThat(message).isNotNull();
        assertThat(message.getKind()).isEqualTo(CompanionMessageEntity.KIND_WEIGHT);
        assertThat(message.getContent().eyebrow()).isEqualTo("Mérés kész");
        assertThat(message.getContent().body()).containsExactly("Stabil úton vagy.");
        assertThat(message.getContent().refs()).extracting("kind").containsExactly("WeightTrend");
        assertThat(message.getGeneratedAt()).isNotNull();
    }

    @Test
    void testGenerateWeightReaction_shouldReturnNull_whenNoTodayWeighIn() {
        UUID user = userPopulator.createUser("weight-stale@test.local").getId();
        weightLogPopulator.createWeightLog(user, DAY.minusDays(1), new BigDecimal("82.40"));

        assertThat(companionMessageGenerator.generateWeightReaction(user, DAY)).isNull();
        assertThat(companionMessageRepository.count()).isZero();
    }

    @Test
    void testGenerateSleepReaction_shouldReturnExistingRow_whenCalledTwice() {
        UUID user = userPopulator.createUser("sleep-idem@test.local").getId();
        sleepLogPopulator.createSleepLog(user, DAY, new BigDecimal("7.50"), 4);
        checkInPopulator.createCheckIn(user, DAY, "06:30", 4, 2,
                "[fake-feed-sleep:{\"eyebrow\":\"Jó alvás\",\"body\":[\"Pihenten kelsz.\"],\"refIndexes\":[]}]");

        CompanionMessageEntity first = companionMessageGenerator.generateSleepReaction(user, DAY);
        CompanionMessageEntity second = companionMessageGenerator.generateSleepReaction(user, DAY);

        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(companionMessageRepository.count()).isEqualTo(1);
    }

    @Test
    void testGenerateSleepReaction_shouldIncludeEarlierMessagesBlock_whenMorningExists() {
        UUID user = userPopulator.createUser("sleep-earlier@test.local").getId();
        companionMessagePopulator.createMessage(user, DAY, CompanionMessageEntity.KIND_MORNING,
                "Jó reggelt", java.util.List.of("Mai terv."));
        sleepLogPopulator.createSleepLog(user, DAY, new BigDecimal("7.50"), 4);
        checkInPopulator.createCheckIn(user, DAY, "06:30", 4, 2,
                "[fake-feed-sleep:{\"eyebrow\":\"Jó alvás\",\"body\":[\"Pihenten kelsz.\"],\"refIndexes\":[]}]");

        CompanionMessageEntity message = companionMessageGenerator.generateSleepReaction(user, DAY);

        assertThat(message).isNotNull();
        assertThat(message.getKind()).isEqualTo(CompanionMessageEntity.KIND_SLEEP);
    }

    /**
     * mezo-b6zt: the quality denominator is the CONTRACT's 10 ({@code api/feature/sleep/sleep.yml},
     * {@code SleepLogRequest.quality}: 1..10) and what the FE selector offers. The "/5" that stood
     * here made a quality of 8 reach the prompt as the impossible "8/5", and the model echoed
     * "a minőségét 8/5-re értékelted" back to the user.
     */
    @Test
    void testGenerateSleepReaction_shouldRenderSleepQualityAgainstTheContractScale() {
        UUID user = userPopulator.createUser("sleep-quality@test.local").getId();
        sleepLogPopulator.createSleepLog(user, DAY, new BigDecimal("7.50"), 8);
        checkInPopulator.createCheckIn(user, DAY, "06:30", 4, 2,
                "[fake-feed-sleep:{\"eyebrow\":\"Jó alvás\",\"body\":[\"Pihenten kelsz.\"],\"refIndexes\":[]}]");

        assertThat(companionMessageGenerator.generateSleepReaction(user, DAY)).isNotNull();

        // Scoped to the generator's OWN block: the snapshot's [Regeneráció] line renders the same
        // quality and is owned by ContextSnapshotAssembler, so asserting on the whole payload would
        // make this test speak for a file it does not test.
        // The "10" is spelled out on purpose: it is the CONTRACT's own bound, so this test still
        // fails if the shared ceiling constant itself is ever changed to something else.
        assertThat(tail(fakeLlm.lastUserMessage(), "MOST RÖGZÍTETT ALVÁS"))
                .contains("minőség 8/10")
                .doesNotContain("8/5");
    }

    /**
     * mezo-a64t: the measurement, the EWMA trend value and the weekly rate are the figures the
     * model QUOTES BACK, so they render Hungarian (decimal comma) at the precision of the quantity.
     * The card read "A mai mérésed 83.3 kg volt … a heti súlytrended (83.694 kg) alatt van, ami
     * heti -0.244 kg-os csökkenést mutat": decimal points inside Hungarian prose, plus a raw EWMA
     * at gram precision.
     */
    @Test
    void testGenerateWeightReaction_shouldRenderQuotedFiguresWithHungarianDecimals() {
        UUID user = userPopulator.createUser("weight-figures@test.local").getId();
        weightLogPopulator.createWeightLog(user, DAY, new BigDecimal("83.30"));
        checkInPopulator.createCheckIn(user, DAY, "06:30", 4, 2,
                "[fake-feed-weight:{\"eyebrow\":\"Mérés kész\",\"body\":[\"Stabil úton vagy.\"],\"refIndexes\":[]}]");

        assertThat(companionMessageGenerator.generateWeightReaction(user, DAY)).isNotNull();

        assertThat(tail(fakeLlm.lastUserMessage(), "MOST RÖGZÍTETT MÉRÉS"))
                .contains("83,3 kg")
                .contains("trendérték (EWMA, simított): 83,3 kg")
                // a single weigh-in defines no slope yet — 0 still has to render as a HU rate
                .contains("heti 0,00 kg")
                .doesNotContain("83.3")
                .doesNotContain("83,300");
    }

    /** Everything from {@code marker} on — the generator's own gather block, without the snapshot
     *  that precedes it (whose rendering other classes own). */
    private static String tail(String payload, String marker) {
        int at = payload.indexOf(marker);
        assertThat(at).isNotNegative();
        return payload.substring(at);
    }

    @Test
    void testGenerateWindow_shouldPersistEnvelope_whenMiddayAndSummariesExist() {
        UUID user = userPopulator.createUser("midday-gen@test.local").getId();
        dailySummaryPopulator.summary(user, DAY.minusDays(1), "Tegnap pihenőnap volt.");
        checkInPopulator.createCheckIn(user, DAY, "12:00", 3, 2,
                "[fake-heartbeat:Tarts egy kis szünetet delente.]");

        CompanionMessageEntity message =
                companionMessageGenerator.generateWindow(user, DAY, CompanionMessageEntity.KIND_MIDDAY);

        assertThat(message).isNotNull();
        assertThat(message.getKind()).isEqualTo(CompanionMessageEntity.KIND_MIDDAY);
        assertThat(message.getContent().eyebrow()).isEqualTo("Napközi jegyzet");
        assertThat(message.getContent().body()).containsExactly("Tarts egy kis szünetet delente.");
        assertThat(message.getContent().refs()).isEmpty();
        assertThat(message.getGeneratedAt()).isNotNull();
    }

    @Test
    void testGenerateWindow_shouldPersistEnvelope_whenEveningAndSummariesExist() {
        UUID user = userPopulator.createUser("evening-gen@test.local").getId();
        dailySummaryPopulator.summary(user, DAY.minusDays(1), "Tegnap pihenőnap volt.");
        checkInPopulator.createCheckIn(user, DAY, "20:00", 3, 2,
                "[fake-heartbeat:Szép napot zártál.]");

        CompanionMessageEntity message =
                companionMessageGenerator.generateWindow(user, DAY, CompanionMessageEntity.KIND_EVENING);

        assertThat(message).isNotNull();
        assertThat(message.getKind()).isEqualTo(CompanionMessageEntity.KIND_EVENING);
        assertThat(message.getContent().eyebrow()).isEqualTo("Napzárás");
        assertThat(message.getContent().body()).containsExactly("Szép napot zártál.");
        assertThat(message.getContent().refs()).isEmpty();
        assertThat(message.getGeneratedAt()).isNotNull();
    }

    @Test
    void testGenerateWindow_shouldReturnNull_whenAnswerBlank() {
        UUID user = userPopulator.createUser("midday-blank@test.local").getId();
        dailySummaryPopulator.summary(user, DAY.minusDays(1), "Tegnap pihenőnap volt.");
        checkInPopulator.createCheckIn(user, DAY, "12:00", 3, 2, "[fake-heartbeat:]");

        assertThat(companionMessageGenerator.generateWindow(user, DAY, CompanionMessageEntity.KIND_MIDDAY))
                .isNull();
        assertThat(companionMessageRepository.count()).isZero();
    }

    @Test
    void testGenerateWindow_shouldReturnNull_whenNoSummariesInWindow() {
        UUID user = userPopulator.createUser("midday-empty@test.local").getId();

        assertThat(companionMessageGenerator.generateWindow(user, DAY, CompanionMessageEntity.KIND_MIDDAY))
                .isNull();
        assertThat(companionMessageRepository.count()).isZero();
    }

    @Test
    void testGenerateWindow_shouldReturnExistingRow_whenCalledTwice() {
        UUID user = userPopulator.createUser("midday-idem@test.local").getId();
        dailySummaryPopulator.summary(user, DAY.minusDays(1), "Tegnap úszás volt.");
        checkInPopulator.createCheckIn(user, DAY, "12:00", 3, 2,
                "[fake-heartbeat:Tarts egy kis szünetet delente.]");

        CompanionMessageEntity first =
                companionMessageGenerator.generateWindow(user, DAY, CompanionMessageEntity.KIND_MIDDAY);
        CompanionMessageEntity second =
                companionMessageGenerator.generateWindow(user, DAY, CompanionMessageEntity.KIND_MIDDAY);

        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(companionMessageRepository.count()).isEqualTo(1);
    }

    @Test
    void testGenerateWindow_shouldPersistToolRefs_whenMiddayRunsGetGoal() {
        UUID user = userPopulator.createUser("midday-refs@test.local").getId();
        dailySummaryPopulator.summary(user, DAY.minusDays(1), "Tegnap pihenőnap volt.");
        goalPopulator.createGoal(user, "active");
        // the [fake-tool:…] sentinel sits OUTSIDE the heartbeat bracket (Locked decision 3)
        checkInPopulator.createCheckIn(user, DAY, "12:00", 3, 2,
                "[fake-heartbeat:Napközi teszt.] [fake-tool:get_goal]");

        CompanionMessageEntity message =
                companionMessageGenerator.generateWindow(user, DAY, CompanionMessageEntity.KIND_MIDDAY);

        assertThat(message).isNotNull();
        assertThat(message.getContent().body()).containsExactly("Napközi teszt.");
        assertThat(message.getContent().refs())
                .extracting("kind", "label")
                .containsExactly(tuple("Goal", "Nyári cut"));
    }

    @Test
    void testGenerateWindow_shouldPersistToolRefs_whenEveningRunsGetGoal() {
        UUID user = userPopulator.createUser("evening-refs@test.local").getId();
        dailySummaryPopulator.summary(user, DAY.minusDays(1), "Tegnap pihenőnap volt.");
        goalPopulator.createGoal(user, "active");
        checkInPopulator.createCheckIn(user, DAY, "20:00", 3, 2,
                "[fake-heartbeat:Esti teszt.] [fake-tool:get_goal]");

        CompanionMessageEntity message =
                companionMessageGenerator.generateWindow(user, DAY, CompanionMessageEntity.KIND_EVENING);

        assertThat(message).isNotNull();
        assertThat(message.getContent().body()).containsExactly("Esti teszt.");
        assertThat(message.getContent().refs())
                .extracting("kind", "label")
                .containsExactly(tuple("Goal", "Nyári cut"));
    }

    @Test
    void generatePeopleObservation_shouldPersistMessage_fromTheWeeksPeopleData() {
        UUID user = userPopulator.createUser("people-gen@test.local").getId();
        var person = personPopulator.createPerson(user, "Zita");
        // two tone-scored mentions THIS week (DAY's own Monday-anchored week) — the data gate needs
        // at least one, and the trend calculator needs a tone+ts pair to read a direction from.
        // The payload is code-aggregated (name/count/direction/reason), not a raw mention echo, so
        // there is no sentinel-planting channel here — the un-scripted people branch already answers
        // valid minimal JSON (FakeCompanionLlm's default for PEOPLE_MARKER_MIRROR).
        mentionPopulator.createMention(user, person.getId(),
                DAY.atStartOfDay(ZoneOffset.UTC).toInstant(), "positive");
        mentionPopulator.createMention(user, person.getId(),
                DAY.atStartOfDay(ZoneOffset.UTC).toInstant().plusSeconds(3600), "positive");

        CompanionMessageEntity message = companionMessageGenerator.generatePeopleObservation(user, DAY);

        assertThat(message).isNotNull();
        assertThat(message.getKind()).isEqualTo(CompanionMessageEntity.KIND_PEOPLE);
        assertThat(message.getContent().eyebrow()).isNotBlank();
        assertThat(message.getContent().body()).isNotEmpty();
        assertThat(message.getGeneratedAt()).isNotNull();
    }

    @Test
    void generatePeopleObservation_shouldReturnNull_whenNoMentionThisWeek() {
        UUID user = userPopulator.createUser("people-empty@test.local").getId();
        var person = personPopulator.createPerson(user, "Zita");
        // a mention exists, but it is two weeks OLD — outside DAY's own Monday-anchored window.
        mentionPopulator.createMention(user, person.getId(),
                DAY.minusWeeks(2).atStartOfDay(ZoneOffset.UTC).toInstant(), "positive");

        assertThat(companionMessageGenerator.generatePeopleObservation(user, DAY)).isNull();
        assertThat(companionMessageRepository.count()).isZero();
    }

    @Test
    void generatePeopleObservation_shouldBeIdempotent() {
        UUID user = userPopulator.createUser("people-idem@test.local").getId();
        var person = personPopulator.createPerson(user, "Zita");
        mentionPopulator.createMention(user, person.getId(),
                DAY.atStartOfDay(ZoneOffset.UTC).toInstant(), "negative");

        CompanionMessageEntity first = companionMessageGenerator.generatePeopleObservation(user, DAY);
        CompanionMessageEntity second = companionMessageGenerator.generatePeopleObservation(user, DAY);

        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(companionMessageRepository.count()).isEqualTo(1);
    }
}
