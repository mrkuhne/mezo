package io.mrkuhne.mezo.techcore.message;

import io.mrkuhne.mezo.feature.auth.service.UserLanguage;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.context.MessageSource;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Resolves a message code to text in the language of whoever is being addressed: the acting
 * account's stored language, else the request's {@code Accept-Language} (first two letters),
 * else Hungarian.
 */
@Component
@RequiredArgsConstructor
public class UserMessages {

    private final MessageSource source;
    private final UserLanguage language;

    public String text(String key, Object... args) {
        return source.getMessage(key, args, key, locale());
    }

    Locale locale() {
        UUID actor = LlmActorContext.capture();
        if (actor != null) {
            try {
                return Locale.forLanguageTag(language.of(actor));
            } catch (RuntimeException e) {
                // An error message must still be produced when the very failure being reported
                // is the database: fall back to the default language rather than mask it.
                return Locale.forLanguageTag(UserLanguage.DEFAULT);
            }
        }
        return Locale.forLanguageTag(UserLanguage.normalize(headerLanguage()));
    }

    private static String headerLanguage() {
        if (!(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs)) {
            return null;
        }
        HttpServletRequest request = attrs.getRequest();
        String header = request.getHeader("Accept-Language");
        if (header == null) {
            return null;
        }
        String trimmed = header.trim().toLowerCase(Locale.ROOT);
        return trimmed.length() >= 2 ? trimmed.substring(0, 2) : null;
    }
}
