package io.mrkuhne.mezo.feature.auth.service;

import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * The stored interface/AI language of an account ({@code "hu"} or {@code "en"}); Hungarian is
 * the source language and the answer for anything unknown. Takes a user id on purpose — it never
 * reads {@code CurrentUser}, so it is safe on cron and pool threads that re-bound an actor.
 */
@Component
@RequiredArgsConstructor
public class UserLanguage {

    public static final String DEFAULT = "hu";
    public static final Set<String> SUPPORTED = Set.of("hu", "en");

    private final AppUserRepository users;

    /** {@code raw} if supported, else {@link #DEFAULT}. */
    public static String normalize(String raw) {
        return raw != null && SUPPORTED.contains(raw) ? raw : DEFAULT;
    }

    /** The account's language; {@link #DEFAULT} for a null or unknown id. */
    public String of(UUID userId) {
        if (userId == null) {
            return DEFAULT;
        }
        return users.findById(userId).map(u -> normalize(u.getLanguage())).orElse(DEFAULT);
    }

    /** The language of the acting account of this thread (same resolution as the LLM audit actor). */
    public String current() {
        return of(LlmActorContext.capture());
    }
}
