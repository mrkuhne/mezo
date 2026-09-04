package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.proactive.entity.AdviceActionKey;
import io.mrkuhne.mezo.feature.train.service.SportSlotSkipService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * {@link AdviceMutationPort} for {@link AdviceActionKey#SKIP_SPORT_SLOT} (S5, bd mezo-d58h.5,
 * spec §6) — the write side of the skip predicate {@link SportSlotSkipService} already exposes to
 * every read path (Tasks 9-12). Like {@link SleepAnchorShiftAdapter}, this adapter — not the
 * service — owns the contract on the loose {@code Map<String, Object>} params a client can supply
 * via whatever the rule wrote onto the card: {@code dayOfWeek} (0-6), {@code time} ({@code
 * HH:mm}), and {@code date} (today-or-later) are all validated here before the service ever sees
 * them.
 *
 * <p>Idempotence (the {@link AdviceMutationPort} contract) is inherited from {@link
 * SportSlotSkipService#skip}'s own existence check — this adapter adds no additional guard of
 * its own. That check is authoritative (not merely advisory) specifically because {@link
 * AdviceApplyService#apply} takes a per-user advisory lock before this adapter is ever reached
 * (see {@link SportSlotSkipService#skip}'s javadoc for the full argument) — a guarantee this
 * adapter relies on but does not itself enforce.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class SportSlotSkipAdapter implements AdviceMutationPort {

    private static final Pattern TIME_PATTERN = Pattern.compile("^([01]\\d|2[0-3]):[0-5]\\d$");

    private final SportSlotSkipService sportSlotSkipService;

    @Override
    public String actionKey() {
        return AdviceActionKey.SKIP_SPORT_SLOT;
    }

    @Override
    public void apply(UUID userId, Map<String, Object> params) {
        int dayOfWeek = boundedDayOfWeek(params);
        String time = validTime(params);
        LocalDate date = todayOrLaterDate(params);
        sportSlotSkipService.skip(userId, dayOfWeek, time, date);
    }

    private int boundedDayOfWeek(Map<String, Object> params) {
        Object raw = params == null ? null : params.get("dayOfWeek");
        if (!(raw instanceof Number number)) {
            throw invalid("dayOfWeek");
        }
        int dayOfWeek = number.intValue();
        if (dayOfWeek < 0 || dayOfWeek > 6) {
            throw outOfRange("dayOfWeek");
        }
        return dayOfWeek;
    }

    private String validTime(Map<String, Object> params) {
        Object raw = params == null ? null : params.get("time");
        if (!(raw instanceof String time) || !TIME_PATTERN.matcher(time).matches()) {
            throw invalid("time");
        }
        return time;
    }

    private LocalDate todayOrLaterDate(Map<String, Object> params) {
        Object raw = params == null ? null : params.get("date");
        if (!(raw instanceof String dateStr)) {
            throw invalid("date");
        }
        LocalDate date;
        try {
            date = LocalDate.parse(dateStr);
        } catch (DateTimeParseException e) {
            throw invalid("date");
        }
        if (date.isBefore(LocalDate.now())) {
            throw outOfRange("date");
        }
        return date;
    }

    private SystemRuntimeErrorException invalid(String param) {
        return new SystemRuntimeErrorException(
                SystemMessage.error("PROACTIVE_ADVICE_ACTION_PARAM_INVALID").params(List.of(param)).build(),
                HttpStatus.BAD_REQUEST);
    }

    private SystemRuntimeErrorException outOfRange(String param) {
        return new SystemRuntimeErrorException(
                SystemMessage.error("PROACTIVE_ADVICE_ACTION_PARAM_OUT_OF_RANGE").params(List.of(param)).build(),
                HttpStatus.BAD_REQUEST);
    }
}
