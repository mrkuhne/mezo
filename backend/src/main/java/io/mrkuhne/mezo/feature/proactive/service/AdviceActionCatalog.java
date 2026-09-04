package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.proactive.entity.AdviceActionKey;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEnvelope.Action;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/**
 * Which actions a card OFFERS, given its {@code adviceKey} (S5, bd mezo-d58h.5, spec §6). The
 * counterpart to {@link AdviceApplyService}'s refusal of any action a card did not offer: this is
 * what makes an action offerable at all. {@link AdviceCardService#deliver} calls {@link #forCard}
 * and hands the result to the widened {@code CompanionMessageEnvelope.advice(...)} overload.
 *
 * <p>Round 1 has NO rule that emits actions of its own — {@code joint_overuse} (lighten) and
 * {@code ignored_nudge} (anchor shift) are S6. So this catalog is a small per-{@code adviceKey}
 * mapping with RULE-INDEPENDENT default parameters, not a lookup into anything the firing rule
 * computed. S6 replaces these defaults with payload-derived ones without changing the envelope or
 * the endpoint — this class is exactly the seam that absorbs that later change.
 *
 * <p>Cap: at most two actions per card (spec §5, "up to 2 action buttons") —
 * {@code AdviceActionCatalogTest} asserts every entry stays at or under it, so a future
 * contributor adding a third to one key finds out from a test rather than from a cramped card.
 */
@Service
public class AdviceActionCatalog {

    /** spec §5: "up to 2 action buttons" per card. */
    public static final int MAX_ACTIONS_PER_CARD = 2;

    private static final String SHIFT_SLEEP_ANCHOR_LABEL = "Horgony −30 perc";

    private final SleepGoalRepository sleepGoalRepository;

    /** Every {@link AdviceMutationPort} Spring actually registered, keyed by {@link
     *  AdviceMutationPort#actionKey()} (mezo-d58h.5 review fix). {@link SleepAnchorShiftAdapter}
     *  carries its own {@code @ConditionalOnProperty} gate ({@code SLEEP_GOAL_SWITCH} among
     *  others) that this catalog does not otherwise see — with the switch off but a stale
     *  {@code sleep_goal} row still present, {@link #forCard} would offer {@code
     *  shift_sleep_anchor} with no port to apply it, and {@link AdviceApplyService#apply} would
     *  500 with {@code PROACTIVE_ADVICE_ACTION_PORT_MISSING} for a user who did nothing wrong.
     *  Consulting the actual port registry (rather than re-declaring the same
     *  {@code @ConditionalOnProperty} list here, which would drift the moment either changes)
     *  keeps this catalog honest by construction: it can only ever offer what some registered
     *  port can actually apply. */
    private final Set<String> registeredActionKeys;

    public AdviceActionCatalog(SleepGoalRepository sleepGoalRepository, List<AdviceMutationPort> mutationPorts) {
        this.sleepGoalRepository = sleepGoalRepository;
        this.registeredActionKeys = mutationPorts.stream()
                .map(AdviceMutationPort::actionKey)
                .collect(Collectors.toUnmodifiableSet());
    }

    /** The actions offered on a card raised for {@code adviceKey}, for {@code userId}. Never
     *  exceeds {@link #MAX_ACTIONS_PER_CARD}. */
    public List<Action> forCard(UUID userId, String adviceKey) {
        if (FlagKey.SLEEP_DEBT.equals(adviceKey)) {
            if (!registeredActionKeys.contains(AdviceActionKey.SHIFT_SLEEP_ANCHOR)) {
                return List.of();
            }
            // Read the REPOSITORY, never SleepGoalService/SleepAnchorResolver: both fall back to
            // a config-default ghost, so the missing-row condition is invisible through them (the
            // same trap SetupCheckService.runFor documents and avoids). Card 4 (missing_sleep_goal)
            // is the prerequisite for ever offering a shift here — with no row there is nothing to
            // shift.
            if (sleepGoalRepository.findByCreatedByAndDeletedFalse(userId).isEmpty()) {
                return List.of();
            }
            return List.of(new Action(AdviceActionKey.SHIFT_SLEEP_ANCHOR, SHIFT_SLEEP_ANCHOR_LABEL,
                Map.of("minutes", -30)));
        }
        return List.of();
    }
}
