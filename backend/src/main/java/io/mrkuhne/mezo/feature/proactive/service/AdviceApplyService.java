package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEnvelope;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The apply seam (S5, bd mezo-d58h.5, spec §6): turns "the user tapped a button on an advice
 * card" into "an effect happened, exactly once". {@link AdviceMutationPort} keeps this class from
 * importing any feature slice for the effect itself — Spring injects every registered port as a
 * {@code List}, and {@link #apply} dispatches by key.
 *
 * <p><b>Advisory lock, quoted from {@code CompanionMessageRepository.lockForDelivery}'s javadoc:</b>
 * "no writer may acquire a {@code companion_message} row lock (or any lock this advisory lock
 * could itself be waiting behind) before this lock is taken in the same transaction, or the two
 * would form a lock-ordering cycle." {@link #apply} writes a {@code companion_message} row (the
 * {@code applied} stamp), so {@code lockForDelivery} is called before the owner-scoped read, before
 * anything else this method itself does — exactly like {@link AdviceCardService#deliver}. This
 * is not ceremony: dropping it would let {@code AdviceCardService.deliver} and {@link #apply} take
 * their respective row/advisory locks in opposite orders on two concurrent transactions for the
 * same user, which is how a lock-ordering cycle (a Postgres deadlock) gets built. As
 * {@code lockForDelivery}'s own javadoc stresses, "first in the method" is not itself the
 * invariant — {@code first in the TRANSACTION} is. {@link #apply} today opens its own
 * {@code @Transactional} boundary, so the two coincide; a future caller (the Task 6 controller, or
 * anything else) must NOT wrap this call inside an outer transaction that itself writes or locks a
 * {@code companion_message} row before {@link #apply} runs, or that write becomes the thing that
 * precedes this lock and the invariant breaks silently.
 *
 * <p><b>Idempotence is the point.</b> A second apply of the SAME action on the SAME card must run
 * the port's effect zero additional times and return the original {@code applied.at()} unchanged
 * — checked BEFORE dispatch, not after, so the port never even sees the redundant call. Applying a
 * DIFFERENT action to a card that already has one applied is refused as a conflict: one action per
 * card, ever.
 */
@Slf4j
@Service
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class AdviceApplyService {

    private final CompanionMessageRepository companionMessageRepository;
    private final List<AdviceMutationPort> mutationPorts;

    /** Constructor DI (no field injection) — and the one place {@link AdviceMutationPort}'s
     *  "exactly one port per key" promise is actually enforced: a duplicate registration fails
     *  Spring context startup here rather than silently picking an arbitrary port at call time. */
    public AdviceApplyService(CompanionMessageRepository companionMessageRepository,
            List<AdviceMutationPort> mutationPorts) {
        this.companionMessageRepository = companionMessageRepository;
        this.mutationPorts = mutationPorts;
        List<String> duplicateKeys = mutationPorts.stream()
                .collect(Collectors.groupingBy(AdviceMutationPort::actionKey, Collectors.counting()))
                .entrySet().stream()
                .filter(e -> e.getValue() > 1)
                .map(Map.Entry::getKey)
                .toList();
        if (!duplicateKeys.isEmpty()) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("PROACTIVE_ADVICE_ACTION_PORT_AMBIGUOUS")
                            .params(duplicateKeys).build(),
                    HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Transactional
    public CompanionMessageEntity apply(UUID userId, UUID cardId, String actionKey) {
        // First statement in this method AND (today) in the transaction it opens: see the
        // advisory-lock invariant quoted above and in CompanionMessageRepository.lockForDelivery's
        // own javadoc — no companion_message row lock before this, ever, in the same transaction.
        companionMessageRepository.lockForDelivery(userId);

        CompanionMessageEntity card = companionMessageRepository.findByIdAndCreatedBy(cardId, userId)
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("PROACTIVE_ADVICE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));

        if (!CompanionMessageEntity.KIND_ADVICE.equals(card.getKind())) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("PROACTIVE_ADVICE_NOT_ADVICE_CARD").build(), HttpStatus.CONFLICT);
        }

        CompanionMessageEnvelope content = card.getContent();
        CompanionMessageEnvelope.Action offered = findOffered(content, actionKey)
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("PROACTIVE_ADVICE_ACTION_NOT_OFFERED").build(), HttpStatus.CONFLICT));

        CompanionMessageEnvelope.Applied applied = content.applied();
        if (applied != null) {
            if (applied.actionKey().equals(actionKey)) {
                log.info("Advice action {} already applied to card {} for user {} — idempotent no-op",
                        actionKey, cardId, userId);
                return card;
            }
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("PROACTIVE_ADVICE_ACTION_CONFLICT").build(), HttpStatus.CONFLICT);
        }

        AdviceMutationPort port = mutationPorts.stream()
                .filter(p -> p.actionKey().equals(actionKey))
                .findFirst()
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("PROACTIVE_ADVICE_ACTION_PORT_MISSING")
                                .params(List.of(actionKey)).build(),
                        HttpStatus.INTERNAL_SERVER_ERROR));
        port.apply(userId, offered.params());

        CompanionMessageEnvelope.Applied stamp =
                new CompanionMessageEnvelope.Applied(actionKey, Instant.now().truncatedTo(ChronoUnit.MICROS));
        card.setContent(new CompanionMessageEnvelope(content.eyebrow(), content.body(), content.refs(),
                content.interventionKey(), content.setupKey(), content.adviceKey(), content.facts(),
                content.suggestions(), content.actions(), stamp));

        CompanionMessageEntity saved = companionMessageRepository.saveAndFlush(card);
        log.info("Advice action {} applied to card {} for user {}", actionKey, cardId, userId);
        return saved;
    }

    private Optional<CompanionMessageEnvelope.Action> findOffered(CompanionMessageEnvelope content, String actionKey) {
        if (content.actions() == null) {
            return Optional.empty();
        }
        return content.actions().stream().filter(a -> a.key().equals(actionKey)).findFirst();
    }
}
