package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import io.mrkuhne.mezo.feature.proactive.entity.AdviceActionKey;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEnvelope;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.feature.proactive.service.AdviceApplyService;
import io.mrkuhne.mezo.feature.proactive.service.AdviceMutationPort;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CompanionMessagePopulator;
import io.mrkuhne.mezo.feature.train.entity.WorkoutDayAdjustmentEntity;
import io.mrkuhne.mezo.feature.train.repository.WorkoutDayAdjustmentRepository;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/**
 * S5 (bd mezo-d58h.5, spec §6): the apply seam. {@link AdviceApplyService#apply} is the single
 * place a card's action button becomes a real effect — exactly once, idempotent on a re-tap,
 * refused when the client names a card or a key the rule never offered.
 */
@ActiveProfiles("companion-fake")
@Import(AdviceApplyServiceIT.CountingMutationPortConfiguration.class)
class AdviceApplyServiceIT extends AbstractIntegrationTest {

    @Autowired private AdviceApplyService adviceApplyService;
    @Autowired private CompanionMessagePopulator companionMessagePopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private CompanionMessageRepository companionMessageRepository;
    @Autowired private List<AdviceMutationPort> mutationPorts;
    @Autowired private CountingMutationPort countingMutationPort;
    @Autowired private SleepGoalRepository sleepGoalRepository;
    @Autowired private SleepGoalPopulator sleepGoalPopulator;
    @Autowired private WorkoutDayAdjustmentRepository workoutDayAdjustmentRepository;

    /** Deliberately NOT a member of {@link AdviceActionKey#ALL}. A card's offered actions are
     *  rule-provided test data — nothing requires the keys in a fixture to be real production
     *  keys. Using a real key here (originally {@code SHIFT_SLEEP_ANCHOR}) would have been a time
     *  bomb: the moment that key's real adapter becomes a {@code @Component}, this IT's context
     *  would hold TWO ports for it — the enumeration guard would report {@code count == 2} even
     *  though every real adapter exists (a false alarm that gets a guard deleted rather than
     *  believed), {@code findFirst()} would pick whichever port the injected list happens to
     *  order first (so {@link #countingMutationPort}'s counter could read 0 non-deterministically),
     *  and if the real adapter won, this IT would perform a genuine sleep-goal mutation. */
    private static final String OFFERED_KEY = "test_counting_action";

    @Test
    void testApply_shouldStampAppliedAndRunTheEffectOnce() {
        UUID owner = userPopulator.createUser().getId();
        CompanionMessageEntity card = seedCardWithOfferedAction(owner);
        CompanionMessageEnvelope beforeApply = card.getContent();
        countingMutationPort.reset();

        CompanionMessageEntity updated = adviceApplyService.apply(owner, card.getId(), OFFERED_KEY);

        assertThat(updated.getContent().applied()).isNotNull();
        assertThat(updated.getContent().applied().actionKey()).isEqualTo(OFFERED_KEY);
        assertThat(updated.getContent().applied().at()).isNotNull();
        assertThat(countingMutationPort.invocationCount()).isEqualTo(1);
        // The rebuild in AdviceApplyService.apply copies nine of the envelope's ten components
        // unchanged and only replaces `applied`. facts/suggestions/actions are same-typed
        // adjacent components (List<String>, List<String>, List<Action>) a transposition would
        // compile and pass every other assertion here — so compare the WHOLE envelope (minus
        // applied, stripped back to null on both sides) rather than trust the fields checked
        // above. Verified by mutation: swapping the facts()/suggestions() arguments in the
        // rebuild locally fails this assertion; reverted before commit.
        assertThat(withoutApplied(updated.getContent())).isEqualTo(withoutApplied(beforeApply));
    }

    private CompanionMessageEnvelope withoutApplied(CompanionMessageEnvelope content) {
        return new CompanionMessageEnvelope(content.eyebrow(), content.body(), content.refs(),
                content.interventionKey(), content.setupKey(), content.adviceKey(), content.facts(),
                content.suggestions(), content.actions(), null);
    }

    /** Idempotence is the point (S5): a second apply of the SAME action must run the effect ZERO
     *  additional times and return the ORIGINAL {@code applied.at()} unchanged. The test-only
     *  {@link CountingMutationPort} gives a genuine "the effect ran once" assertion rather than
     *  deferring it — no real {@link AdviceMutationPort} adapter exists yet for ANY key (Tasks
     *  5, 13, 16 add the three real ones). */
    @Test
    void testApply_shouldBeIdempotent_whenTheSameActionIsAppliedTwice() {
        UUID owner = userPopulator.createUser().getId();
        CompanionMessageEntity card = seedCardWithOfferedAction(owner);
        countingMutationPort.reset();

        CompanionMessageEntity first = adviceApplyService.apply(owner, card.getId(), OFFERED_KEY);
        Instant firstAppliedAt = first.getContent().applied().at();

        CompanionMessageEntity second = adviceApplyService.apply(owner, card.getId(), OFFERED_KEY);

        assertThat(second.getContent().applied().at()).isEqualTo(firstAppliedAt);
        assertThat(countingMutationPort.invocationCount())
                .as("the effect must run exactly once across both applies").isEqualTo(1);
    }

    /** The FIRST real {@link AdviceMutationPort} (S5, Task 5, bd mezo-d58h.5) — proves idempotence
     *  end to end through the real {@code shift_sleep_anchor} action rather than only through the
     *  test-only {@link CountingMutationPort}: applying twice must shift the sleep goal's anchor
     *  ONCE, not twice (which would silently double the effect on a re-tap). */
    @Test
    void testApply_shouldShiftTheSleepAnchorOnce_whenTheRealActionIsAppliedTwice() {
        UUID owner = userPopulator.createUser().getId();
        sleepGoalPopulator.goal(owner, 480, "WAKE", "06:45", 15);
        CompanionMessageEntity card = companionMessagePopulator.createAdviceWithActions(
                owner, LocalDate.now(), "some_advice_key", null, "Mezo · javaslat",
                "Sablon-szöveg.", List.of("tény"), List.of("javaslat"),
                List.of(new CompanionMessageEnvelope.Action(
                        AdviceActionKey.SHIFT_SLEEP_ANCHOR, "Tolja el", Map.of("minutes", -30))),
                null, Instant.now());

        adviceApplyService.apply(owner, card.getId(), AdviceActionKey.SHIFT_SLEEP_ANCHOR);
        adviceApplyService.apply(owner, card.getId(), AdviceActionKey.SHIFT_SLEEP_ANCHOR);

        assertThat(sleepGoalRepository.findByCreatedByAndDeletedFalse(owner).orElseThrow().getAnchorTime())
                .isEqualTo("06:15");
    }

    /** The SECOND real {@link AdviceMutationPort} (S5, Task 16, bd mezo-d58h.5) — the missing
     *  {@code delta} param defaults to -1 (spec §6 item 1: "lower ... by one working set"). */
    @Test
    void testApply_shouldWriteDefaultLightenDelta_whenNoDeltaParamIsGiven() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        CompanionMessageEntity card = companionMessagePopulator.createAdviceWithActions(
                owner, LocalDate.now(), "some_advice_key", null, "Mezo · javaslat",
                "Sablon-szöveg.", List.of("tény"), List.of("javaslat"),
                List.of(new CompanionMessageEnvelope.Action(
                        AdviceActionKey.LIGHTEN_TOMORROW, "Könnyítsen", Map.of())),
                null, Instant.now());

        adviceApplyService.apply(owner, card.getId(), AdviceActionKey.LIGHTEN_TOMORROW);

        WorkoutDayAdjustmentEntity saved = workoutDayAdjustmentRepository
                .findByCreatedByAndDateAndDeletedFalse(owner, tomorrow).orElseThrow();
        assertThat(saved.getSetDelta()).isEqualTo((short) -1);
    }

    /** Idempotence at the DATA level (S5, Task 16): a second apply for the same tomorrow must
     *  leave exactly one row behind with the ORIGINAL delta — not a second row (the unique index
     *  would reject that anyway) and not a doubled/overwritten delta. Two separate cards are used
     *  so {@link AdviceApplyService#apply}'s own per-card "already applied" short-circuit is not
     *  what is being tested here — the adapter's OWN idempotence (an existing row for the date) is. */
    @Test
    void testApply_shouldNotStackTheLightenDelta_whenAppliedTwiceForTheSameTomorrow() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        CompanionMessageEntity firstCard = companionMessagePopulator.createAdviceWithActions(
                owner, LocalDate.now(), "some_advice_key", null, "Mezo · javaslat",
                "Sablon-szöveg.", List.of("tény"), List.of("javaslat"),
                List.of(new CompanionMessageEnvelope.Action(
                        AdviceActionKey.LIGHTEN_TOMORROW, "Könnyítsen", Map.of("delta", -1))),
                null, Instant.now());
        CompanionMessageEntity secondCard = companionMessagePopulator.createAdviceWithActions(
                owner, LocalDate.now().minusDays(1), "some_advice_key", null, "Mezo · javaslat",
                "Sablon-szöveg.", List.of("tény"), List.of("javaslat"),
                List.of(new CompanionMessageEnvelope.Action(
                        AdviceActionKey.LIGHTEN_TOMORROW, "Könnyítsen", Map.of("delta", -3))),
                null, Instant.now());

        adviceApplyService.apply(owner, firstCard.getId(), AdviceActionKey.LIGHTEN_TOMORROW);
        adviceApplyService.apply(owner, secondCard.getId(), AdviceActionKey.LIGHTEN_TOMORROW);

        List<WorkoutDayAdjustmentEntity> rows = workoutDayAdjustmentRepository
                .findByCreatedByAndDateBetweenAndDeletedFalse(owner, tomorrow, tomorrow);
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getSetDelta()).isEqualTo((short) -1);
    }

    /** The adapter, not the entity's {@code @NotNull} or the schema's CHECK alone, rejects a
     *  delta outside the schema's {@code -3..0} bound — a client-shaped 400, not a DB constraint
     *  violation surfacing as a 500. */
    @Test
    void testApply_shouldReject_whenTheLightenDeltaIsOutOfRange() {
        UUID owner = userPopulator.createUser().getId();
        CompanionMessageEntity card = companionMessagePopulator.createAdviceWithActions(
                owner, LocalDate.now(), "some_advice_key", null, "Mezo · javaslat",
                "Sablon-szöveg.", List.of("tény"), List.of("javaslat"),
                List.of(new CompanionMessageEnvelope.Action(
                        AdviceActionKey.LIGHTEN_TOMORROW, "Könnyítsen", Map.of("delta", -4))),
                null, Instant.now());

        assertThatThrownBy(() -> adviceApplyService.apply(owner, card.getId(), AdviceActionKey.LIGHTEN_TOMORROW))
                .isInstanceOf(SystemRuntimeErrorException.class)
                .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getStatus())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
        assertThat(workoutDayAdjustmentRepository
                .findByCreatedByAndDateAndDeletedFalse(owner, LocalDate.now().plusDays(1))).isEmpty();
    }

    /** A non-numeric {@code delta} (e.g. a string, from a hand-crafted client call against the
     *  loose {@code params} map) must be rejected as a validation error, not let a
     *  {@link ClassCastException} escape and surface as a 500. */
    @Test
    void testApply_shouldReject_whenTheLightenDeltaIsNonNumeric() {
        UUID owner = userPopulator.createUser().getId();
        CompanionMessageEntity card = companionMessagePopulator.createAdviceWithActions(
                owner, LocalDate.now(), "some_advice_key", null, "Mezo · javaslat",
                "Sablon-szöveg.", List.of("tény"), List.of("javaslat"),
                List.of(new CompanionMessageEnvelope.Action(
                        AdviceActionKey.LIGHTEN_TOMORROW, "Könnyítsen", Map.of("delta", "one"))),
                null, Instant.now());

        assertThatThrownBy(() -> adviceApplyService.apply(owner, card.getId(), AdviceActionKey.LIGHTEN_TOMORROW))
                .isInstanceOf(SystemRuntimeErrorException.class)
                .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getStatus())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void testApply_shouldReject_whenTheKeyIsNotOfferedByTheCard() {
        UUID owner = userPopulator.createUser().getId();
        CompanionMessageEntity card = seedCardWithOfferedAction(owner);

        assertThatThrownBy(() -> adviceApplyService.apply(owner, card.getId(), AdviceActionKey.LIGHTEN_TOMORROW))
                .isInstanceOf(SystemRuntimeErrorException.class)
                .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getStatus())
                        .isEqualTo(HttpStatus.CONFLICT));
    }

    /** {@link CompanionMessagePopulator#rawInsertKind} seeds a row of a REAL, non-advice kind
     *  (bypassing the entity's own constraints the way it was built for) so the row is found by
     *  {@code findByIdAndCreatedBy} but rejected by {@link AdviceApplyService#apply}'s own
     *  kind guard — a client cannot invoke apply against, say, a {@code morning} card. */
    @Test
    void testApply_shouldReject_whenTheCardIsNotAnAdviceKindCard() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        companionMessagePopulator.rawInsertKind(owner, today, CompanionMessageEntity.KIND_MORNING);
        UUID cardId = companionMessageRepository
                .findByCreatedByAndMessageDateAndKind(owner, today, CompanionMessageEntity.KIND_MORNING)
                .orElseThrow().getId();

        assertThatThrownBy(() -> adviceApplyService.apply(owner, cardId, OFFERED_KEY))
                .isInstanceOf(SystemRuntimeErrorException.class)
                .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getStatus())
                        .isEqualTo(HttpStatus.CONFLICT));
    }

    /** Deliberately NOT a member of {@link AdviceActionKey#ALL}, for the same reason as {@link
     *  #OFFERED_KEY}. Task 16 gave every real key a registered port, so this scenario ("a card
     *  offers a real key with no adapter") can no longer be built with a real key — the
     *  enumeration guard below is exactly what makes that permanently true. A synthetic key with
     *  no {@code @Component} serving it is the only way left to exercise the port-missing 500
     *  path. */
    private static final String UNPORTED_KEY = "test_unported_action";

    /** A card can offer a key with no registered port — that is a wiring bug, not a user error,
     *  so it surfaces as 500 rather than a client-shaped 4xx. Before Task 16 this used a real
     *  {@link AdviceActionKey} (every key was production data before its adapter shipped); now
     *  that all three have adapters, {@link #UNPORTED_KEY} stands in (see its own javadoc). */
    @Test
    void testApply_shouldReturn500_whenNoPortIsRegisteredForTheOfferedKey() {
        UUID owner = userPopulator.createUser().getId();
        CompanionMessageEntity card = companionMessagePopulator.createAdviceWithActions(
                owner, LocalDate.now(), "some_advice_key", null, "Mezo · javaslat",
                "Sablon-szöveg.", List.of("tény"), List.of("javaslat"),
                List.of(new CompanionMessageEnvelope.Action(UNPORTED_KEY, "Könnyítsen", Map.of())),
                null, Instant.now());

        assertThatThrownBy(() -> adviceApplyService.apply(owner, card.getId(), UNPORTED_KEY))
                .isInstanceOf(SystemRuntimeErrorException.class)
                .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getStatus())
                        .isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR));
    }

    @Test
    void testApply_shouldReturn404_whenTheCardBelongsToAnotherUser() {
        UUID owner = userPopulator.createUser().getId();
        UUID stranger = userPopulator.createUser().getId();
        CompanionMessageEntity card = seedCardWithOfferedAction(owner);

        assertThatThrownBy(() -> adviceApplyService.apply(stranger, card.getId(), OFFERED_KEY))
                .isInstanceOf(SystemRuntimeErrorException.class)
                .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getStatus())
                        .isEqualTo(HttpStatus.NOT_FOUND));
    }

    /** A superseded card is soft-deleted ({@code @SQLRestriction("is_deleted = false")}), so the
     *  owner-scoped finder simply will not find it — a 404, not a 500, exactly as if a more
     *  severe card replaced it before the user tapped. */
    @Test
    void testApply_shouldReturn404_whenTheCardWasSuperseded() {
        UUID owner = userPopulator.createUser().getId();
        CompanionMessageEntity card = seedCardWithOfferedAction(owner);
        UUID cardId = card.getId();
        // A second advice card the same day supersedes the first via soft delete — mirror the
        // DB-level effect of AdviceCardService.deliver's supersession without pulling that
        // service (and its LLM path) into this test: @SQLDelete on the entity turns this into
        // "update companion_message set is_deleted = true where id = ?", the same thing deliver
        // does.
        companionMessageRepository.delete(card);
        companionMessageRepository.flush();

        assertThatThrownBy(() -> adviceApplyService.apply(owner, cardId, OFFERED_KEY))
                .isInstanceOf(SystemRuntimeErrorException.class)
                .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getStatus())
                        .isEqualTo(HttpStatus.NOT_FOUND));
    }

    /**
     * The enumeration guard: every key in {@link AdviceActionKey#ALL} must resolve to exactly one
     * registered {@link AdviceMutationPort}. All three real adapters now exist ({@code
     * SleepAnchorShiftAdapter}, Task 5; {@code SportSlotSkipAdapter}, Task 13; {@code
     * LightenTomorrowAdapter}, Task 16), and this IT's own {@link CountingMutationPort}
     * deliberately serves a key OUTSIDE {@link AdviceActionKey#ALL} (see {@link #OFFERED_KEY}), so
     * it never counts toward any real key here. The slice's structural guard against a forgotten
     * adapter — the direct analogue of S4's reflection test over the severity table.
     */
    @Test
    void testMutationPorts_shouldCoverEveryActionKeyExactlyOnce() {
        for (String key : AdviceActionKey.ALL) {
            long matches = mutationPorts.stream().filter(p -> p.actionKey().equals(key)).count();
            assertThat(matches).as("port count for action key %s", key).isEqualTo(1);
        }
    }

    private CompanionMessageEntity seedCardWithOfferedAction(UUID owner) {
        return companionMessagePopulator.createAdviceWithActions(
                owner, LocalDate.now(), "some_advice_key", null, "Mezo · javaslat",
                "Sablon-szöveg.", List.of("tény"), List.of("javaslat"),
                List.of(new CompanionMessageEnvelope.Action(OFFERED_KEY, "Tolja el", Map.of("minutes", 30))),
                null, Instant.now());
    }

    @TestConfiguration
    static class CountingMutationPortConfiguration {
        @Bean
        CountingMutationPort countingMutationPort() {
            return new CountingMutationPort();
        }
    }

    /** Test-only port serving {@link #OFFERED_KEY} — a key OUTSIDE {@link AdviceActionKey#ALL},
     *  deliberately, so this never collides with a real adapter (see {@link #OFFERED_KEY}'s own
     *  javadoc). Counts invocations so the idempotence test can assert the effect ran exactly
     *  once, instead of only inspecting the envelope's own {@code applied} stamp. */
    static class CountingMutationPort implements AdviceMutationPort {
        private final AtomicInteger invocations = new AtomicInteger();

        @Override
        public String actionKey() {
            return OFFERED_KEY;
        }

        @Override
        public void apply(UUID userId, Map<String, Object> params) {
            invocations.incrementAndGet();
        }

        void reset() {
            invocations.set(0);
        }

        int invocationCount() {
            return invocations.get();
        }
    }
}
