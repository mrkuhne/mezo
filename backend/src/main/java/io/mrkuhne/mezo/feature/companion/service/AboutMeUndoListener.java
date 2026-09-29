package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.people.service.PersonFactUndoneEvent;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * mezo-d6ivw.13: a person fact's „Visszavonom" also removes its „Rólam is" copy (owner answer
 * 2026-09-29: both go). People publishes {@link PersonFactUndoneEvent} (it never imports
 * companion); the house listener idiom — AFTER_COMMIT + {@code @Async}, swallow-and-log — keeps a
 * cascade failure from ever breaking the undo itself.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class AboutMeUndoListener {

    private final AboutMeService aboutMeService;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onPersonFactUndone(PersonFactUndoneEvent event) {
        try {
            aboutMeService.remove(event.userId(), event.factId());
        } catch (Exception e) {
            log.warn("About-me copy removal failed for person fact {}", event.factId(), e);
        }
    }
}
