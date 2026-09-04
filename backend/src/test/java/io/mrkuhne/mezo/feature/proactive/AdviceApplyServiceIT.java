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

    private static final String OFFERED_KEY = AdviceActionKey.SHIFT_SLEEP_ANCHOR;

    @Test
    void testApply_shouldStampAppliedAndRunTheEffectOnce() {
        UUID owner = userPopulator.createUser().getId();
        CompanionMessageEntity card = seedCardWithOfferedAction(owner);
        countingMutationPort.reset();

        CompanionMessageEntity updated = adviceApplyService.apply(owner, card.getId(), OFFERED_KEY);

        assertThat(updated.getContent().applied()).isNotNull();
        assertThat(updated.getContent().applied().actionKey()).isEqualTo(OFFERED_KEY);
        assertThat(updated.getContent().applied().at()).isNotNull();
        assertThat(countingMutationPort.invocationCount()).isEqualTo(1);
    }

    /** Idempotence is the point (S5): a second apply of the SAME action must run the effect ZERO
     *  additional times and return the ORIGINAL {@code applied.at()} unchanged. The test-only
     *  {@link CountingMutationPort} gives a genuine "the effect ran once" assertion rather than
     *  deferring it — no real adapter exists until Task 5/13/17. */
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
     * registered {@link AdviceMutationPort}. This CANNOT pass yet — the {@code lighten_tomorrow}
     * and {@code skip_sport_slot} adapters do not exist until Tasks 5 and 13, and this IT's own
     * {@link CountingMutationPort} only serves {@code shift_sleep_anchor}. Left in place
     * (disabled, not deleted or weakened) as the slice's structural guard against a forgotten
     * adapter — remove {@code @Disabled} in Task 17, once the third adapter lands.
     */
    @Test
    @Disabled("enumeration guard — enable in Task 17 once all three AdviceMutationPort adapters exist")
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

    /** Test-only port serving {@link AdviceActionKey#SHIFT_SLEEP_ANCHOR}: counts invocations so
     *  the idempotence test can assert the effect ran exactly once, instead of only inspecting
     *  the envelope's own {@code applied} stamp. */
    static class CountingMutationPort implements AdviceMutationPort {
        private final AtomicInteger invocations = new AtomicInteger();

        @Override
        public String actionKey() {
            return AdviceActionKey.SHIFT_SLEEP_ANCHOR;
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
