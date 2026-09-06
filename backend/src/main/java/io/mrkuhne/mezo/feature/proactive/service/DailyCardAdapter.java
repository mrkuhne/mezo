package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.flags.service.DailyCardPort;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Supplies {@link DailyCardPort} from the {@code companion_message} table. Reads the LIVE row
 *  only — the repository's {@code @SQLRestriction} already hides a superseded card, which is the
 *  right answer: a superseded card never won the day. */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.PROACTIVE_SWITCH, havingValue = "true")
public class DailyCardAdapter implements DailyCardPort {

    private final CompanionMessageRepository companionMessageRepository;

    @Override
    @Transactional(readOnly = true)
    public Optional<DeliveredCard> forDay(UUID userId, LocalDate date) {
        return companionMessageRepository
            .findByCreatedByAndMessageDateAndKind(userId, date, CompanionMessageEntity.KIND_ADVICE)
            .map(row -> new DeliveredCard(row.getId(), row.getContent().adviceKey()));
    }
}
