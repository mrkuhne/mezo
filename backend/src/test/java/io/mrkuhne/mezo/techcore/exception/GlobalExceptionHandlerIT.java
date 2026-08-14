package io.mrkuhne.mezo.techcore.exception;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/**
 * Framework-exception mapping in {@link GlobalExceptionHandler} (mezo-x0nb).
 *
 * <p>A request parameter Spring cannot CONVERT — a malformed UUID in a path, a non-numeric integer
 * in a query — fails before the controller method runs, with a
 * {@code MethodArgumentTypeMismatchException}. Without a handler for it that lands on the generic
 * {@code Exception} catch-all and answers 500, telling the client the server broke when in fact the
 * request was malformed. Both cases below are reachable from the live API today.
 */
class GlobalExceptionHandlerIT extends ApiIntegrationTest {

    /**
     * The name Spring reports for a failed conversion is the METHOD PARAMETER name, which the
     * OpenAPI generator derives from the contract's parameter name — so the client can map the
     * FIELD error back onto what it sent.
     */
    @Test
    void testGet_shouldReturnBadRequestNamingThePathVariable_whenUuidMalformed() {
        String body = getForBody("/api/llm-usage/calls/not-a-uuid", ownerAuthHeaders(),
            HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "id", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testGet_shouldReturnBadRequestNamingTheQueryParam_whenIntegerNotNumeric() {
        String body = getForBody("/api/llm-usage/calls?period=DAY&limit=nem-szam", ownerAuthHeaders(),
            HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "limit", "VALIDATION_INVALID_VALUE");
    }

    /** A well-formed but unknown id still means "no such row" — the conversion handler must not swallow it. */
    @Test
    void testGet_shouldStillReturnNotFound_whenUuidWellFormedButUnknown() {
        String body = getForBody("/api/llm-usage/calls/" + java.util.UUID.randomUUID(), ownerAuthHeaders(),
            HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "LLM_LOG_CALL_NOT_FOUND");
    }
}
