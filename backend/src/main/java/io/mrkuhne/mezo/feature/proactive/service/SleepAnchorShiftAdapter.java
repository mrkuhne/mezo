package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepGoalService;
import io.mrkuhne.mezo.feature.proactive.entity.AdviceActionKey;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * {@link AdviceMutationPort} for {@link AdviceActionKey#SHIFT_SLEEP_ANCHOR} (S5, bd mezo-d58h.5,
 * spec §6) — the only side of this port that crosses into {@code feature.biometrics} (a direction
 * that already exists; the reverse would be a new cycle, see {@link AdviceMutationPort}'s javadoc).
 *
 * <p>The {@code params} map is deliberately loose ({@code Map<String, Object>}) because a client
 * can call the apply endpoint with whatever the rule wrote onto the card — so THIS adapter, not
 * {@link SleepGoalService#shiftAnchor}, is where the contract on the {@code minutes} VALUE lives:
 * missing, non-numeric, or outside ±120 minutes is rejected here as a validation error rather than
 * let a {@link ClassCastException} or an oversized shift reach the service.
 *
 * <p>Idempotence (the {@link AdviceMutationPort} contract) is inherited for free from {@link
 * SleepGoalService#shiftAnchor} refusing to run at all without a goal row plus {@link
 * AdviceApplyService#apply} never invoking a port twice for the same card/action — this adapter
 * adds no additional guard of its own.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH,
                FeaturesConfiguration.SLEEP_GOAL_SWITCH},
        havingValue = "true")
public class SleepAnchorShiftAdapter implements AdviceMutationPort {

    private static final int MAX_ABS_MINUTES = 120;

    private final SleepGoalService sleepGoalService;

    @Override
    public String actionKey() {
        return AdviceActionKey.SHIFT_SLEEP_ANCHOR;
    }

    @Override
    public void apply(UUID userId, Map<String, Object> params) {
        int minutes = boundedMinutes(params);
        sleepGoalService.shiftAnchor(userId, minutes);
    }

    private int boundedMinutes(Map<String, Object> params) {
        Object raw = params == null ? null : params.get("minutes");
        if (!(raw instanceof Number number)) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("PROACTIVE_ADVICE_ACTION_PARAM_INVALID")
                            .params(List.of("minutes")).build(),
                    HttpStatus.BAD_REQUEST);
        }
        int minutes = number.intValue();
        if (minutes < -MAX_ABS_MINUTES || minutes > MAX_ABS_MINUTES) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("PROACTIVE_ADVICE_ACTION_PARAM_OUT_OF_RANGE")
                            .params(List.of("minutes")).build(),
                    HttpStatus.BAD_REQUEST);
        }
        return minutes;
    }
}
