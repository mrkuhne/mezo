package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.entity.FeedbackEffect;
import io.mrkuhne.mezo.feature.capacity.repository.CapacityEventFeedbackRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The owner's label of how a calendar event felt (Boop B7 K2, mezo-r36n9.17): Merít · Semleges · Feltölt on the day
 * page. Only stores it — no model call. {@link EventScoringService} applies the label at read time, so the next day
 * read re-scores the event and the brief's input hash (which covers each demand item's level) changes with it.
 */
@Service
public class EventFeedbackService {

    static final int MAX_KEY = 200;

    private final CapacityEventFeedbackRepository feedback;

    public EventFeedbackService(CapacityEventFeedbackRepository feedback) {
        this.feedback = feedback;
    }

    /** Stores or replaces the label; a blank or over-long key, or an unknown effect, is a 400. */
    @Transactional
    public void label(UUID owner, String eventKey, String effect) {
        if (eventKey == null || eventKey.isBlank() || eventKey.length() > MAX_KEY) {
            throw invalid("eventKey");
        }
        FeedbackEffect e = FeedbackEffect.of(effect).orElseThrow(() -> invalid("effect"));
        // stored as sent: the key is the brief's own demand-item eventKey (already without the occurrence); stripping
        // again would cut a device id that itself contains '|'
        feedback.upsert(owner, eventKey, e.value());
    }

    private static SystemRuntimeErrorException invalid(String field) {
        return new SystemRuntimeErrorException(SystemMessage.field("VALIDATION_INVALID_VALUE", field).build(),
            HttpStatus.BAD_REQUEST);
    }
}
