package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;

/**
 * mezo-lb2yb: the WHY of a failed embedding call, for the audit row. A three-week Gemini outage
 * (HTTP 402, prepay credits depleted) went undiagnosed because both adapters wrote
 * {@code error_code = null} for every provider exception. Walks the cause chain, because Spring AI
 * and the SDKs may wrap the provider's own exception.
 */
final class EmbeddingFailure {

    private static final int MAX_DETAIL_CHARS = 500;

    private EmbeddingFailure() {
    }

    /** {@code SystemMessage} code for app-level failures, {@code HTTP_<status>} for provider
     *  rejections, otherwise null (a transport/unknown failure has no code to give). */
    static String code(Throwable failure) {
        for (Throwable t = failure; t != null; t = t.getCause() == t ? null : t.getCause()) {
            if (t instanceof SystemRuntimeErrorException system && !system.getMessages().isEmpty()) {
                SystemMessage first = system.getMessages().get(0);
                return first != null ? first.getCode() : null;
            }
            if (t instanceof com.google.genai.errors.ApiException api) {
                return "HTTP_" + api.code();
            }
            if (t instanceof com.openai.errors.OpenAIServiceException service) {
                return "HTTP_" + service.statusCode();
            }
        }
        return null;
    }

    /** The provider's own message (deepest non-blank one), bounded. */
    static String detail(Throwable failure) {
        String message = null;
        for (Throwable t = failure; t != null; t = t.getCause() == t ? null : t.getCause()) {
            if (t.getMessage() != null && !t.getMessage().isBlank()) {
                message = t.getMessage();
            }
        }
        if (message == null) {
            return null;
        }
        String trimmed = message.strip();
        return trimmed.length() <= MAX_DETAIL_CHARS ? trimmed : trimmed.substring(0, MAX_DETAIL_CHARS);
    }
}
