package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.proactive.entity.AdviceActionKey;
import io.mrkuhne.mezo.feature.train.entity.WorkoutDayAdjustmentEntity;
import io.mrkuhne.mezo.feature.train.repository.WorkoutDayAdjustmentRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * {@link AdviceMutationPort} for {@link AdviceActionKey#LIGHTEN_TOMORROW} (S5, bd mezo-d58h.5,
 * spec §6) — writes the read-time overlay row ({@link WorkoutDayAdjustmentEntity}) that {@code
 * WorkoutService.getToday} and the two companion prose paths (Task 15) already apply once a row
 * exists for the date; this adapter is the only writer. Like the sibling adapters, the loose
 * {@code Map<String, Object>} params are bounded HERE, not left to the entity's own
 * {@code @NotNull} or the schema's CHECK alone — a jsonb round-trip can hand back {@code Integer},
 * {@code Long}, {@code Double} or {@code BigDecimal} for a numeric value, so the same
 * {@code instanceof Number} coercion the siblings use applies here too.
 *
 * <p>Idempotence (the {@link AdviceMutationPort} contract) is enforced by THIS adapter, unlike the
 * siblings which inherit it from the target service: the unique index on
 * {@code (created_by, date)} means a second apply for the same tomorrow must be a no-op — neither
 * a duplicate-key violation surfacing as a 500 nor a second decrement stacking atop the first. The
 * existence check below is authoritative for the same reason the sibling adapters' own inherited
 * checks are — {@link AdviceApplyService#apply} holds a per-user advisory lock for the whole
 * transaction before this adapter is ever reached.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class LightenTomorrowAdapter implements AdviceMutationPort {

    /** The default lighten, applied when the card's rule-provided params carry no {@code delta}
     *  (spec 2026-09-03 §6 item 1: "lower tomorrow's gym targets by one working set"). */
    private static final int DEFAULT_DELTA = -1;
    private static final int MIN_DELTA = -3;
    private static final int MAX_DELTA = 0;

    private final WorkoutDayAdjustmentRepository workoutDayAdjustmentRepository;

    @Override
    public String actionKey() {
        return AdviceActionKey.LIGHTEN_TOMORROW;
    }

    @Override
    public void apply(UUID userId, Map<String, Object> params) {
        int delta = boundedDelta(params);
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        if (workoutDayAdjustmentRepository.findByCreatedByAndDateAndDeletedFalse(userId, tomorrow).isPresent()) {
            // A row already exists for tomorrow — no-op, not a second decrement and not a
            // duplicate-key error against the (created_by, date) unique index.
            return;
        }
        WorkoutDayAdjustmentEntity adjustment = new WorkoutDayAdjustmentEntity();
        adjustment.setCreatedBy(userId);
        adjustment.setDate(tomorrow);
        adjustment.setSetDelta((short) delta);
        workoutDayAdjustmentRepository.save(adjustment);
    }

    private int boundedDelta(Map<String, Object> params) {
        Object raw = params == null ? null : params.get("delta");
        if (raw == null) {
            return DEFAULT_DELTA;
        }
        if (!(raw instanceof Number number)) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("PROACTIVE_ADVICE_ACTION_PARAM_INVALID")
                            .params(List.of("delta")).build(),
                    HttpStatus.BAD_REQUEST);
        }
        int delta = number.intValue();
        if (delta < MIN_DELTA || delta > MAX_DELTA) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("PROACTIVE_ADVICE_ACTION_PARAM_OUT_OF_RANGE")
                            .params(List.of("delta")).build(),
                    HttpStatus.BAD_REQUEST);
        }
        return delta;
    }
}
