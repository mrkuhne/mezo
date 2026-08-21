package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.companion.feedback.entity.MessageFeedbackEntity;
import io.mrkuhne.mezo.feature.companion.feedback.repository.MessageFeedbackRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for {@link MessageFeedbackEntity} — persists via {@code saveAndFlush}
 *  so DB CHECKs fire. */
@TestComponent
@RequiredArgsConstructor
public class FeedbackPopulator {

    private final MessageFeedbackRepository repository;

    public MessageFeedbackEntity createVerdict(UUID owner, String kind, UUID artifactId, String verdict, String reason) {
        MessageFeedbackEntity e = new MessageFeedbackEntity();
        e.setCreatedBy(owner);
        e.setArtifactKind(kind);
        e.setArtifactId(artifactId);
        e.setVerdict(verdict);
        e.setReason(reason);
        return repository.saveAndFlush(e);
    }
}
