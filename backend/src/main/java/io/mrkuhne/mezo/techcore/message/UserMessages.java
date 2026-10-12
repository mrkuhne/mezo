package io.mrkuhne.mezo.techcore.message;

import io.mrkuhne.mezo.feature.auth.service.UserLanguage;
import io.mrkuhne.mezo.techcore.configuration.MessageSourceConfiguration;
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
 *
 * <p>Domain services use it for every sentence the server writes for a screen (first: Fuel,
 * mezo-n4wf5.5). A composer that renders many texts in one go takes {@link #pinned()} once, so the
 * account language is looked up a single time; a pure service is unit-tested with
 * {@link #fixed(String)}. Pass numbers as already formatted strings — {@code MessageFormat} would
 * otherwise group and localise them, and the Hungarian output must stay exactly what it was.
 */
@Component
@RequiredArgsConstructor
public class UserMessages {

    private final MessageSource source;
    private final UserLanguage language;

    public String text(String key, Object... args) {
        return source.getMessage(key, args, key, locale());
    }

    /** The language {@link #text} renders in right now: {@code "hu"} or {@code "en"}. */
    public String language() {
        return locale().getLanguage();
    }

    /**
     * A view pinned to the language resolved NOW (one account lookup, many texts). Take it at the
     * start of a composer and render everything of that output through it.
     */
    public UserMessages pinned() {
        return new Fixed(source, locale());
    }

    /**
     * A renderer for a known language with no account or request behind it: unit tests of pure
     * services, and jobs that already hold the language. Anything unknown is Hungarian.
     */
    public static UserMessages fixed(String language) {
        return new Fixed(new MessageSourceConfiguration().messageSource(),
            Locale.forLanguageTag(UserLanguage.normalize(language)));
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

    private static final class Fixed extends UserMessages {

        private final Locale locale;

        Fixed(MessageSource source, Locale locale) {
            super(source, null);
            this.locale = locale;
        }

        @Override
        Locale locale() {
            return locale;
        }

        @Override
        public UserMessages pinned() {
            return this;
        }
    }
}
