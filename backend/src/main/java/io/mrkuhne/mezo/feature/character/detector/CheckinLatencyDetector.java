package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Check-in latency (round 3, spec §5.10): the median delay between a check-in slot's own nominal
 * time and the moment the row was actually first written.
 *
 * <p>Two source choices are load-bearing and must not be "simplified" later:
 * <ul>
 *   <li>The nominal time comes from {@code slotTime} ON THE ROW, not from {@code notification_schedule}.
 *       That table is replaced wholesale on every save and keeps no history, so using it would
 *       retroactively judge past days against today's schedule.</li>
 *   <li>The actual time comes from {@code createdAt}, not {@code savedAt}: {@code CheckInService.save()}
 *       overwrites {@code savedAt} on every edit, so a check-in corrected a week later would look
 *       like it was filled a week late.</li>
 * </ul>
 *
 * <p>Negative delays are clamped to zero — filling a slot early is punctual, not "minus 40 minutes".
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class CheckinLatencyDetector implements CharacterDetector {

    private static final int MIN_CHECKINS = 6;
    private static final long PONTOS_MAX_MIN = 60;
    private static final long KESES_MAX_MIN = 240;

    @Override
    public String key() {
        return "checkin-latency";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (!DetectorGates.newCheckinData(in)) {
            return List.of();
        }
        String today = state(in, in.day());
        String yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.equals(yesterday)) {
            return List.of();
        }
        String summary = switch (today) {
            case "keses:pontos" -> "A check-ineket jellemzően a saját idősávjuk körül tölti ki.";
            case "keses:keses" -> "A check-inek jellemzően egy-négy órával a saját idősávjuk után készülnek el.";
            default -> "A check-inek jellemzően jóval a saját idősávjuk után, gyakran a nap későbbi részében készülnek el.";
        };
        return List.of(new DetectorSignal(key(), "drill", summary, 3));
    }

    private static String state(DetectorInput in, LocalDate asOf) {
        List<Long> delays = new ArrayList<>();
        for (DetectorInput.CheckinSlotPoint p : in.trend().checkinSlots()) {
            if (!TrailingWindow.inWindow(p.date(), asOf) || p.writtenAt().toLocalDate().isAfter(asOf)) {
                continue;
            }
            LocalTime slot = parseSlot(p.slotTime());
            if (slot == null) {
                continue;   // unparseable label — dropped, never guessed
            }
            long minutes = Duration.between(LocalDateTime.of(p.date(), slot), p.writtenAt()).toMinutes();
            delays.add(Math.max(0, minutes));
        }
        if (delays.size() < MIN_CHECKINS) {
            return null;
        }
        delays.sort(Long::compareTo);
        long median = delays.size() % 2 == 1
                ? delays.get(delays.size() / 2)
                : (delays.get(delays.size() / 2 - 1) + delays.get(delays.size() / 2)) / 2;
        String band = median < PONTOS_MAX_MIN ? "pontos" : median <= KESES_MAX_MIN ? "keses" : "kesoi";
        return "keses:" + band;
    }

    private static LocalTime parseSlot(String slotTime) {
        try {
            return slotTime == null ? null : LocalTime.parse(slotTime);
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
