package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import org.springframework.http.HttpStatus;

/** The typed errors of Boop Pénz (codes in both message bundles). */
public final class PenzErrors {

    private PenzErrors() {
    }

    public static SystemRuntimeErrorException notFound(String code) {
        return new SystemRuntimeErrorException(SystemMessage.error(code).build(), HttpStatus.NOT_FOUND);
    }

    public static SystemRuntimeErrorException conflict(String code) {
        return new SystemRuntimeErrorException(SystemMessage.error(code).build(), HttpStatus.CONFLICT);
    }

    public static SystemRuntimeErrorException badRequest(String code) {
        return new SystemRuntimeErrorException(SystemMessage.error(code).build(), HttpStatus.BAD_REQUEST);
    }

    public static SystemRuntimeErrorException field(String field) {
        return new SystemRuntimeErrorException(SystemMessage.field("VALIDATION_INVALID_VALUE", field).build(),
            HttpStatus.BAD_REQUEST);
    }

    /** A declared endpoint whose computation lands in a later phase of L4 (the allowance engine). */
    public static SystemRuntimeErrorException notImplemented() {
        return new SystemRuntimeErrorException(SystemMessage.error("PENZ_NOT_IMPLEMENTED").build(),
            HttpStatus.NOT_IMPLEMENTED);
    }
}
