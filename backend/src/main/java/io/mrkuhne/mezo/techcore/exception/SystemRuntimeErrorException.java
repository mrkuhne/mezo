package io.mrkuhne.mezo.techcore.exception;

import java.util.List;
import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public class SystemRuntimeErrorException extends RuntimeException {
    private final List<SystemMessage> messages;
    private final HttpStatus status;

    public SystemRuntimeErrorException(SystemMessage message) {
        this(List.of(message));
    }

    public SystemRuntimeErrorException(List<SystemMessage> messages) {
        this(messages, HttpStatus.BAD_REQUEST);
    }

    public SystemRuntimeErrorException(SystemMessage message, HttpStatus status) {
        this(List.of(message), status);
    }

    public SystemRuntimeErrorException(List<SystemMessage> messages, HttpStatus status) {
        super(messages.isEmpty() ? "system error" : messages.get(0).getCode());
        this.messages = messages;
        this.status = status;
    }
}
