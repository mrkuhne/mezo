package io.mrkuhne.mezo.techcore.exception;

import java.util.List;
import lombok.Getter;

@Getter
public class SystemRuntimeErrorException extends RuntimeException {
    private final List<SystemMessage> messages;

    public SystemRuntimeErrorException(SystemMessage message) {
        this(List.of(message));
    }

    public SystemRuntimeErrorException(List<SystemMessage> messages) {
        super(messages.isEmpty() ? "system error" : messages.get(0).getCode());
        this.messages = messages;
    }
}
