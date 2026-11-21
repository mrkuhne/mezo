package io.mrkuhne.mezo.feature.mail.service;

import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import org.springframework.http.HttpStatus;

/** The typed errors of the morning post's REST surface (codes in both message bundles). */
public final class MailErrors {

    public static final String AUTH_FAILED = "MAIL_AUTH_FAILED";
    public static final String RUN_COOLDOWN = "MAIL_RUN_COOLDOWN";
    public static final String NOT_CONNECTED = "MAIL_NOT_CONNECTED";

    private MailErrors() {
    }

    /** 422 — a well-formed request the mail server refused (the password). */
    public static SystemRuntimeErrorException authFailed() {
        return new SystemRuntimeErrorException(SystemMessage.error(AUTH_FAILED).build(),
            HttpStatus.UNPROCESSABLE_ENTITY);
    }

    public static SystemRuntimeErrorException notConnected() {
        return new SystemRuntimeErrorException(SystemMessage.error(NOT_CONNECTED).build(), HttpStatus.CONFLICT);
    }

    public static SystemRuntimeErrorException runCooldown() {
        return new SystemRuntimeErrorException(SystemMessage.error(RUN_COOLDOWN).build(),
            HttpStatus.TOO_MANY_REQUESTS);
    }
}
