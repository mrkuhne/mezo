package io.mrkuhne.mezo.feature.notification.service;

import io.mrkuhne.mezo.feature.companion.flags.service.NudgeSendPort;
import io.mrkuhne.mezo.feature.notification.entity.PushLogEntity;
import io.mrkuhne.mezo.feature.notification.repository.PushLogRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Notification-side adapter for the companion-owned {@link NudgeSendPort} (ADR 0012 idiom,
 * mirroring {@code companion.service.DecisionContextAssemblerAdapter}): delegates straight to
 * {@link PushLogRepository}'s bounded range finder. Gated on {@code NOTIFICATION_SWITCH} alone —
 * {@code IgnoredNudgeRule}'s own {@code COMPANION_SWITCH} gate already covers the companion side
 * — so with notification off there is no adapter bean and the rule's {@code
 * ObjectProvider<NudgeSendPort>} degrades to silence rather than a fabricated "nothing was sent".
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.NOTIFICATION_SWITCH, havingValue = "true")
public class NudgeSendPushLogAdapter implements NudgeSendPort {

    private final PushLogRepository pushLogRepository;

    @Override
    public Set<LocalDate> sentDates(UUID userId, String category, LocalDate from, LocalDate to) {
        return pushLogRepository.findByCreatedByAndCategoryAndLogDateBetween(userId, category, from, to)
            .stream()
            .map(PushLogEntity::getLogDate)
            .collect(Collectors.toSet());
    }
}
