package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.boop.port.BoopCapacityPort;
import io.mrkuhne.mezo.feature.capacity.config.CapacityProperties;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * The adapter of boop's {@link BoopCapacityPort} (ADR 0012: the providing feature implements the consumer's port, so
 * boop stays free of a capacity dependency and no slice cycle through season appears): the day read mapped to the
 * brief's words. Deliberately not
 * {@code @Transactional} (the day read may call the scoring model).
 */
@Component
public class BoopCapacityAdapter implements BoopCapacityPort {

    private static final double SMALL_BELOW = 0.5;
    private static final double MEDIUM_BELOW = 1.5;

    private final CapacityDayService days;
    private final CapacityProperties props;

    public BoopCapacityAdapter(CapacityDayService days, CapacityProperties props) {
        this.days = days;
        this.props = props;
    }

    @Override
    public View read(UUID owner, LocalDate date) {
        if (!props.enabled()) {
            return null;
        }
        CapacityDay d = days.day(owner, date);
        return new View(verdict(d.verdict()), d.ratio(), d.tanulo(), d.labelledDays(), d.calendarKnown(),
            d.demand().units(), d.demand().hourly19(),
            d.demand().items().stream()
                .map(i -> new Item(i.label(), i.kind(), i.start(), level(i.units(), i.restores()))).toList(),
            d.capacity().factors().stream()
                .map(f -> new Factor(f.key(), f.label(), f.valueText(), effect(f.effect()))).toList(),
            d.reasonFacts() == null ? "" : d.reasonFacts());
    }

    static String verdict(String hu) {
        return "túl sok".equals(hu) ? "tulSok" : hu;
    }

    static String level(double units, boolean restores) {
        if (restores) {
            return "tolt";
        }
        return units < SMALL_BELOW ? "kicsi" : units < MEDIUM_BELOW ? "kozepes" : "nagy";
    }

    static String effect(int effect) {
        return effect < 0 ? "rossz" : effect > 0 ? "jo" : "semleges";
    }
}
