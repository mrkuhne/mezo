package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.proactive.entity.AdviceActionKey;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEnvelope.Action;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
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
@RequiredArgsConstructor
public class AdviceActionCatalog {

    /** spec §5: "up to 2 action buttons" per card. */
    public static final int MAX_ACTIONS_PER_CARD = 2;

    private static final String SHIFT_SLEEP_ANCHOR_LABEL = "Horgony −30 perc";

    private final SleepGoalRepository sleepGoalRepository;

    /** The actions offered on a card raised for {@code adviceKey}, for {@code userId}. Never
     *  exceeds {@link #MAX_ACTIONS_PER_CARD}. */
    public List<Action> forCard(UUID userId, String adviceKey) {
        if (FlagKey.SLEEP_DEBT.equals(adviceKey)) {
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
