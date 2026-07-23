package io.mrkuhne.mezo.techcore.exception;

import jakarta.validation.ConstraintViolationException;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.MessageSource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

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
        return ResponseEntity.status(ex.getStatus()).body(ex.getMessages());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<List<SystemMessage>> handleValidation(MethodArgumentNotValidException ex) {
        String traceId = UUID.randomUUID().toString();
        log.warn("Validation failed [traceId={}]", traceId);
        List<SystemMessage> messages = ex.getBindingResult().getFieldErrors().stream()
            .map(fe -> {
                SystemMessage m = SystemMessage.field(validationCode(fe.getCode()), fe.getField()).build();
                m.setExceptionTraceId(traceId);
                m.setMessage(resolve(m));
                return m;
            })
            .toList();
        return ResponseEntity.badRequest().body(messages);
    }

    /**
     * Method-level bean validation (e.g. {@code List<@Valid X>} request bodies) surfaces as
     * {@link ConstraintViolationException} instead of {@link MethodArgumentNotValidException} —
     * map it onto the same FIELD SystemMessage contract. The property path is
     * {@code method.param[i].field}; the leaf segment is the field name.
     */
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<List<SystemMessage>> handleConstraintViolation(ConstraintViolationException ex) {
        String traceId = UUID.randomUUID().toString();
        log.warn("Validation failed [traceId={}]", traceId);
        List<SystemMessage> messages = ex.getConstraintViolations().stream()
            .map(v -> {
                String path = v.getPropertyPath().toString();
                String field = path.substring(path.lastIndexOf('.') + 1);
                String constraint = v.getConstraintDescriptor().getAnnotation().annotationType().getSimpleName();
                SystemMessage m = SystemMessage.field(validationCode(constraint), field).build();
                m.setExceptionTraceId(traceId);
                m.setMessage(resolve(m));
                return m;
            })
            .toList();
        return ResponseEntity.badRequest().body(messages);
    }

    private static String validationCode(String constraint) {
        return switch (constraint == null ? "" : constraint) {
            case "NotBlank", "NotNull" -> "VALIDATION_REQUIRED_FIELD";
            case "Email" -> "VALIDATION_INVALID_EMAIL";
            default -> "VALIDATION_INVALID_VALUE";
        };
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<List<SystemMessage>> handleNotFound(NoResourceFoundException ex) {
        String traceId = UUID.randomUUID().toString();
        log.warn("Resource not found [traceId={}]: {}", traceId, ex.getResourcePath());
        SystemMessage m = SystemMessage.error("RESOURCE_NOT_FOUND").build();
        m.setExceptionTraceId(traceId);
        m.setMessage(resolve(m));
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(List.of(m));
    }

    /**
     * A known route matched by path but not by HTTP method (e.g. a POST to a path that only maps
     * {@code GET}/{@code PUT}/{@code DELETE}) — surface a clean 405 SystemMessage instead of letting
     * it fall through to the generic 500 catch-all. This notably keeps a disabled feature honest:
     * with a {@code @ConditionalOnProperty} controller gone, a request whose path still collides with
     * a sibling path-variable route (e.g. {@code /api/meal/ai-draft} vs {@code /api/meal/{id}})
     * degrades to 405, not a stack-trace-noisy 500.
     */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<List<SystemMessage>> handleMethodNotAllowed(HttpRequestMethodNotSupportedException ex) {
        String traceId = UUID.randomUUID().toString();
        log.warn("Method not allowed [traceId={}]: {}", traceId, ex.getMessage());
        SystemMessage m = SystemMessage.error("METHOD_NOT_ALLOWED").build();
        m.setExceptionTraceId(traceId);
        m.setMessage(resolve(m));
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED).body(List.of(m));
    }

    /**
     * The servlet container's own multipart cap ({@code spring.servlet.multipart.max-file-size},
     * raised to 6 MB for mezo-78rn) tripped during multipart parsing — BEFORE the request reached the
     * {@code MealAiDraftService} size check. Surface the SAME 400 "photo too big" field error the
     * service would have returned, instead of letting it fall through to the generic 500. The
     * app-level {@code mezo.meal-ai-log.max-photo-bytes} (5 MB) sits below this container cap and is
     * the effective, message-bearing limit; this is the safety net for the rare payload that slips
     * past it into the container limit.
     */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<List<SystemMessage>> handleMaxUploadSize(MaxUploadSizeExceededException ex) {
        String traceId = UUID.randomUUID().toString();
        log.warn("Upload too large [traceId={}]: {}", traceId, ex.getMessage());
        SystemMessage m = SystemMessage.field("VALIDATION_INVALID_VALUE", "photo").build();
        m.setExceptionTraceId(traceId);
        m.setMessage(resolve(m));
        return ResponseEntity.badRequest().body(List.of(m));
    }

    /**
     * A {@code @RequestPart(required = true)} multipart part absent from the request (mezo-d8tr:
     * {@code POST /api/pantry-import/photo} with no {@code photo} part) is rejected by Spring
     * BEFORE the controller method runs — surface the same FIELD 400 a present-but-invalid photo
     * would get, instead of falling through to the generic 500 catch-all.
     */
    @ExceptionHandler(MissingServletRequestPartException.class)
    public ResponseEntity<List<SystemMessage>> handleMissingPart(MissingServletRequestPartException ex) {
        String traceId = UUID.randomUUID().toString();
        log.warn("Required multipart part missing [traceId={}]: {}", traceId, ex.getRequestPartName());
        SystemMessage m = SystemMessage.field("VALIDATION_INVALID_VALUE", ex.getRequestPartName()).build();
        m.setExceptionTraceId(traceId);
        m.setMessage(resolve(m));
        return ResponseEntity.badRequest().body(List.of(m));
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
