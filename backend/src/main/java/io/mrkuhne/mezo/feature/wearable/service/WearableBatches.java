package io.mrkuhne.mezo.feature.wearable.service;

import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import org.springframework.http.HttpStatus;

/** Shared batch-cap check of the wearable ingestion endpoints. */
final class WearableBatches {

    private WearableBatches() {
    }

    static void requireAtMost(int size, int max) {
        if (size > max) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("WEARABLE_BATCH_TOO_LARGE").build(), HttpStatus.BAD_REQUEST);
        }
    }
}
