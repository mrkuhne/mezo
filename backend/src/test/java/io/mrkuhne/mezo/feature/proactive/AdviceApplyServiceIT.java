package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.proactive.entity.AdviceActionKey;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEnvelope;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.feature.proactive.service.AdviceApplyService;
import io.mrkuhne.mezo.feature.proactive.service.AdviceMutationPort;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CompanionMessagePopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Disabled;
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

    /** A card can offer a REAL {@link AdviceActionKey} that has no registered port yet (every key
     *  is real production data before its adapter ships) — that is a wiring bug, not a user error,
     *  so it surfaces as 500 rather than a client-shaped 4xx. */
    @Test
    void testApply_shouldReturn500_whenNoPortIsRegisteredForTheOfferedRealKey() {
        UUID owner = userPopulator.createUser().getId();
        CompanionMessageEntity card = companionMessagePopulator.createAdviceWithActions(
                owner, LocalDate.now(), "some_advice_key", null, "Mezo · javaslat",
                "Sablon-szöveg.", List.of("tény"), List.of("javaslat"),
                List.of(new CompanionMessageEnvelope.Action(
                        AdviceActionKey.LIGHTEN_TOMORROW, "Könnyítsen", Map.of())),
                null, Instant.now());

        assertThatThrownBy(() -> adviceApplyService.apply(owner, card.getId(), AdviceActionKey.LIGHTEN_TOMORROW))
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
     * registered {@link AdviceMutationPort}. This CANNOT pass yet — no real adapter for any of the
     * three keys exists (Tasks 5 and 13 add {@code lighten_tomorrow} and {@code skip_sport_slot};
     * Task 16 adds the third and is the one that turns this test on), and this IT's own {@link
     * CountingMutationPort} deliberately serves a key OUTSIDE {@link AdviceActionKey#ALL} (see
     * {@link #OFFERED_KEY}), so it never counts toward any real key here. Left in place (disabled,
     * not deleted or weakened) as the slice's structural guard against a forgotten adapter —
     * remove {@code @Disabled} in Task 16, once the third adapter lands.
     */
    @Test
    @Disabled("enumeration guard — enable in Task 16 once all three AdviceMutationPort adapters exist")
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
