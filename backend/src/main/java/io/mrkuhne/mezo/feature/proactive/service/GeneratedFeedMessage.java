package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.FeedGenerationTrace;
import java.util.List;

public record GeneratedFeedMessage(String eyebrow, List<String> body,
        List<CompanionMessageEnvelope.Ref> refs, FeedGenerationTrace trace) {
    public CompanionMessageEnvelope envelope() {
        return new CompanionMessageEnvelope(eyebrow, body, refs).withTrace(trace);
    }
}
