package io.mrkuhne.mezo.feature.people.service;

import io.mrkuhne.mezo.feature.ritual.entity.RitualDayEntity;
import io.mrkuhne.mezo.feature.ritual.repository.RitualDayRepository;
import io.mrkuhne.mezo.feature.ritual.service.RitualClosedEvent;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * S2 name-match a Napzárás esti reflexiójára (spec §3.2, bd mezo-06o0.1), a {@code
 * MentionDetectionListener} idiómán. Kapuzás: PEOPLE ∧ RITUAL switch — bármelyik off, és a bean
 * nem létezik. {@code RitualClosedEvent} a TX-en BELÜL van publikálva ({@link RitualClosedEvent}
 * javadocja mondja ki), ezért az AFTER_COMMIT fázis kötelező itt is — enélkül egy rollback-elő
 * zárás prózáját is matchelnénk. A {@code detect} blank-guardja lefedi az üresen hagyott/törölt
 * reflexiót (nincs mit matchelni, a hívás no-op). IDENT-3: minden hiba warn + swallow.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.PEOPLE_SWITCH, FeaturesConfiguration.RITUAL_SWITCH},
        havingValue = "true")
public class ReflectionMentionListener {

    private final MentionDetectionService mentionDetectionService;
    private final RitualDayRepository ritualDayRepository;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onRitualClosed(RitualClosedEvent event) {
        try {
            RitualDayEntity day = ritualDayRepository.findById(event.ritualDayId()).orElse(null);
            if (day == null) {
                return;
            }
            mentionDetectionService.detect(day.getCreatedBy(), day.getReflectionText(),
                    "text", "reflection", day.getId(), Instant.now());
        } catch (Exception e) {
            log.warn("Mention detection failed for ritual day {}", event.ritualDayId(), e);
        }
    }
}
