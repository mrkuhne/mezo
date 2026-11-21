package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;

/** Caps how many muscles may carry the Hangsúly (emphasize) tier at once; pure. */
public final class PriorityGuard {

    private PriorityGuard() {}

    /** @param normalizedPriorities the sparse map after {@link PriorityTier#normalize}; 400 above {@code max} emphasize entries. */
    public static void checkEmphasizeCap(Map<String, String> normalizedPriorities, int max) {
        long emphasized = normalizedPriorities.values().stream().filter("emphasize"::equals).count();
        if (emphasized > max) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("TRAIN_MESO_EMPHASIZE_CAP").params(List.of(String.valueOf(max))).build(), HttpStatus.BAD_REQUEST);
        }
    }
}
