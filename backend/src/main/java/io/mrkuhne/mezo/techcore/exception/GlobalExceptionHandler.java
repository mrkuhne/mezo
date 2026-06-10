package io.mrkuhne.mezo.techcore.exception;

import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.MessageSource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
@RequiredArgsConstructor
public class GlobalExceptionHandler {

    private final MessageSource messageSource;

    @ExceptionHandler(SystemRuntimeErrorException.class)
    public ResponseEntity<List<SystemMessage>> handle(SystemRuntimeErrorException ex) {
        String traceId = UUID.randomUUID().toString();
        log.error("Error [traceId={}]: {}", traceId, ex.getMessage(), ex);
        ex.getMessages().forEach(m -> {
            m.setExceptionTraceId(traceId);
            m.setMessage(resolve(m));
        });
        return ResponseEntity.badRequest().body(ex.getMessages());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<List<SystemMessage>> handleUnexpected(Exception ex) {
        String traceId = UUID.randomUUID().toString();
        log.error("Unhandled [traceId={}]", traceId, ex);
        SystemMessage m = SystemMessage.error("INTERNAL_ERROR").build();
        m.setExceptionTraceId(traceId);
        m.setMessage(resolve(m));
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(List.of(m));
    }

    private String resolve(SystemMessage m) {
        Object[] params = m.getParams() == null ? new Object[0] : m.getParams().toArray();
        return messageSource.getMessage(m.getCode(), params, m.getCode(), Locale.ENGLISH);
    }
}
