package io.mrkuhne.mezo.feature.lifegoal.engine;

import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import io.mrkuhne.mezo.feature.needs.entity.NeedsDayEntity;
import io.mrkuhne.mezo.feature.needs.repository.NeedsDayRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * {@code type=needs_ring} forrás — a {@link NeedsDayEntity} {@code source.ring()} által
 * megnevezett gyűrű-mezője. CSAK létező (zárt, nem törölt) napokra ad kulcsot — egy hiányzó nap
 * napzárás nélkül maradt, ami honest no_data, sosem 0.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.LIFEGOAL_SWITCH, havingValue = "true")
public class NeedsRingSignalSource implements SignalSource {

    private final NeedsDayRepository needsDayRepository;

    @Override
    public boolean supports(PillarSourceJson source) {
        return "needs_ring".equals(source.type());
    }

    @Override
    public SignalWindow window(UUID userId, PillarSourceJson source, LocalDate from, LocalDate to) {
        Map<LocalDate, BigDecimal> values = new HashMap<>();
        for (NeedsDayEntity day : needsDayRepository
                .findByCreatedByAndNeedsDateBetweenAndDeletedFalseOrderByNeedsDateAsc(userId, from, to)) {
            values.put(day.getNeedsDate(), BigDecimal.valueOf(ring(source.ring(), day)));
        }
        return SignalWindow.of(values);
    }

    private static int ring(String ring, NeedsDayEntity day) {
        return switch (ring) {
            case "energia" -> day.getEnergia();
            case "hidratacio" -> day.getHidratacio();
            case "pihenes" -> day.getPihenes();
            case "mozgas" -> day.getMozgas();
            case "lelek" -> day.getLelek();
            case "rend" -> day.getRend();
            default -> throw new SystemRuntimeErrorException(
                    SystemMessage.error("LIFE_GOAL_UNKNOWN_NEEDS_RING").build(), HttpStatus.INTERNAL_SERVER_ERROR);
        };
    }
}
