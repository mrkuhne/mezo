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

    /** 422 — a well-formed request the rules refuse (the Gyakorlás cap). */
    public static SystemRuntimeErrorException unprocessable(String code) {
        return new SystemRuntimeErrorException(SystemMessage.error(code).build(), HttpStatus.valueOf(422));
    }

    public static SystemRuntimeErrorException tooManyRequests(String code) {
        return new SystemRuntimeErrorException(SystemMessage.error(code).build(), HttpStatus.TOO_MANY_REQUESTS);
    }

    public static SystemRuntimeErrorException field(String field) {
        return new SystemRuntimeErrorException(SystemMessage.field("VALIDATION_INVALID_VALUE", field).build(),
            HttpStatus.BAD_REQUEST);
    }
}
