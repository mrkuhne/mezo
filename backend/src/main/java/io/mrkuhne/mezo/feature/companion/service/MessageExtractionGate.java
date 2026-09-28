package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * S8 (mezo-d6ivw.12): closes the "forget lands, then the in-flight extraction of the same turn
 * saves anyway" race. Called by BOTH post-turn extractors inside their saving transaction, right
 * before the save. The forget marks the message with an UPDATE (row lock held to its commit);
 * {@code FOR SHARE} here waits for that commit and then reads {@code true}. If the extraction
 * locked first, the forget's UPDATE waits for the extraction to commit, and the forget's reads —
 * which run after its UPDATE — see the freshly saved facts and forget them too.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MessageExtractionGate {

    private final AiMessageRepository messageRepository;

    @Transactional(propagation = Propagation.MANDATORY)
    public boolean isBlocked(UUID userMessageId) {
        return userMessageId != null && messageRepository.lockExtractionBlocked(userMessageId).orElse(false);
    }
}
