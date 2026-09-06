package io.mrkuhne.mezo.feature.companion.feedback.service;

import java.util.UUID;

/**
 * A verdict was written (round 2 S5, bd mezo-d58h.7.5). Published by {@link MessageFeedbackService}
 * on every upsert so a consumer can react to WHAT was rated — which the feedback layer itself must
 * not know: it has no idea what a "question card" is, and {@code feature.companion} may never import
 * {@code feature.proactive} to find out. Consumers listen AFTER_COMMIT.
 *
 * <p>Retraction deliberately publishes nothing: "I take my 👍 back" is not a new answer, and the
 * remembered fact stays until the user answers differently. The card is asked once, ever.
 */
public record MessageFeedbackRecordedEvent(UUID userId, String artifactKind, UUID artifactId,
                                           String verdict) {
}
