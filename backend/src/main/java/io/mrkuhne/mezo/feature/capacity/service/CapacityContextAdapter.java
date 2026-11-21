package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.config.CapacityProperties;
import io.mrkuhne.mezo.feature.companion.port.CapacityContextPort;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.IsoFields;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * The capacity lines for the companion (chat snapshot + {@code get_capacity}) through the companion-owned
 * {@link CapacityContextPort}, provider side like {@link BoopCapacityAdapter}.
 *
 * <p>Both reads use {@link CapacityDayService#history} (stored or rule scores, never starts the background scoring
 * run): the snapshot assemblers and the tools run inside the callers' transactions, where the scoring runner's
 * unique-violation swallowing is unsafe, and a chat or morning context must never spend the model. Today's unscored
 * events therefore show their rule score here; the Ma page's own read upgrades them in the background. Any failure
 * gives {@code ""}. Both reads suspend the caller's transaction ({@code NOT_SUPPORTED}, read-only): a database fault
 * inside them is swallowed here and must not mark the caller's writing transaction rollback-only.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CapacityContextAdapter implements CapacityContextPort {

    private static final Pattern ISO_WEEK = Pattern.compile("^(\\d{4})-?W(\\d{1,2})$", Pattern.CASE_INSENSITIVE);

    private final CapacityDayService days;
    private final CapacityContextRenderer renderer;
    private final CapacityProperties props;

    @Override
    @Transactional(propagation = Propagation.NOT_SUPPORTED, readOnly = true)
    public String render(UUID owner, LocalDate today) {
        if (!props.enabled()) {
            return "";
        }
        try {
            return renderer.today(days.history(owner, today, today).get(0).day());
        } catch (RuntimeException e) {
            log.warn("Capacity context line skipped: {}", e.toString());
            return "";
        }
    }

    @Override
    @Transactional(propagation = Propagation.NOT_SUPPORTED, readOnly = true)
    public String week(UUID owner, String week) {
        if (!props.enabled()) {
            return "";
        }
        LocalDate monday = monday(week);
        if (monday == null) {
            return "";
        }
        try {
            List<CapacityDay> out = days.history(owner, monday, monday.plusDays(6)).stream()
                .map(CapacityDayService.DayRead::day).toList();
            return renderer.week(out);
        } catch (RuntimeException e) {
            log.warn("Capacity week lines skipped: {}", e.toString());
            return "";
        }
    }

    /** Monday of {@code "2026-W47"} or of the week holding an ISO date; null when neither parses. */
    static LocalDate monday(String week) {
        if (week == null || week.isBlank()) {
            return null;
        }
        String w = week.trim();
        Matcher m = ISO_WEEK.matcher(w);
        try {
            if (m.matches()) {
                return LocalDate.of(Integer.parseInt(m.group(1)), 1, 4)
                    .with(IsoFields.WEEK_OF_WEEK_BASED_YEAR, Integer.parseInt(m.group(2)))
                    .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            }
            return LocalDate.parse(w).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        } catch (java.time.DateTimeException e) {
            return null;
        }
    }
}
