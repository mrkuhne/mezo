package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import org.springframework.http.HttpStatus;

/** Block length rule: 4–8 weeks for a normal block, 1–3 only for a year-plan consolidation block. */
public final class MesoWeeksGuard {

    private MesoWeeksGuard() {}

    public static void check(int weeks, boolean consolidation) {
        boolean ok = consolidation ? weeks >= 1 && weeks <= 3 : weeks >= 4 && weeks <= 8;
        if (!ok) {
            throw new SystemRuntimeErrorException(SystemMessage.error("TRAIN_MESO_WEEKS_RANGE").build(), HttpStatus.BAD_REQUEST);
        }
    }
}
