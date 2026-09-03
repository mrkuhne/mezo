package io.mrkuhne.mezo.feature.auth.service;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The ONE place prompt templates get their user name (S6, mezo-qw37.6). Templates stay
 * {@code static final} and carry {@link #NAME_TOKEN}; each prompt site calls
 * {@link #render(UUID, String)} once, right before its LLM call. Lives in feature/auth because
 * every feature may depend on auth and auth on no other feature (ArchUnit slice rule).
 */
@Service
@RequiredArgsConstructor
public class PromptPersona {

    /** The literal every prompt template uses for the user's name. */
    public static final String NAME_TOKEN = "{{NÉV}}";

    /** Transcript role label for the user's turns (chat history, embeddings, extraction) —
     *  neutral on purpose, the same precedent as the {@code FELHASZNÁLÓ VÁLASZA —} wire marker:
     *  stored rows must not vary with a display name. */
    public static final String USER_TURN_LABEL = "Felhasználó: ";

    private final AppUserRepository appUserRepository;

    @Transactional(readOnly = true)
    public PersonaContext forUser(UUID userId) {
        if (userId == null) {
            return PersonaContext.FALLBACK;
        }
        return appUserRepository.findById(userId)
                .map(AppUserEntity::getName)
                .map(PersonaContext::of)
                .orElse(PersonaContext.FALLBACK);
    }

    public String render(UUID userId, String template) {
        return fill(forUser(userId), template);
    }

    public static String fill(PersonaContext persona, String template) {
        return template.replace(NAME_TOKEN, persona.userName());
    }
}
