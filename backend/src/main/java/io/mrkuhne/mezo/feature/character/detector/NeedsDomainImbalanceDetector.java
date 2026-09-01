package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.ToIntFunction;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Needs domain imbalance (round 3, spec §5.12): which of the six Életjel domains stays low while the
 * others are green.
 *
 * <p>The signal is the CONTRAST, not the absolute level: a uniformly hard fortnight is not an
 * imbalance, so a domain counts as weak only when at least {@link #MIN_STRONG_DOMAINS} others are
 * comfortably green. The green line is the domain's own configured threshold, carried in
 * {@code NeedsContext} because a detector may not read configuration.
 *
 * <p>The domain map's iteration order follows the Életjel ring's own order (energia, hidratáció,
 * pihenés, mozgás, lélek, rend) — that order is the requirement, so it is built with an explicit
 * {@link LinkedHashMap} insertion order rather than left to chance.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class NeedsDomainImbalanceDetector implements CharacterDetector {

    private static final int MIN_NEEDS_DAYS = 7;
    private static final double WEAK_SHARE = 0.40;
    private static final double STRONG_SHARE = 0.70;
    private static final int MIN_STRONG_DOMAINS = 3;

    private static final Map<String, ToIntFunction<DetectorInput.NeedsDayPoint>> DOMAINS = buildDomains();

    private static Map<String, ToIntFunction<DetectorInput.NeedsDayPoint>> buildDomains() {
        Map<String, ToIntFunction<DetectorInput.NeedsDayPoint>> domains = new LinkedHashMap<>();
        domains.put("energia", DetectorInput.NeedsDayPoint::energia);
        domains.put("hidratáció", DetectorInput.NeedsDayPoint::hidratacio);
        domains.put("pihenés", DetectorInput.NeedsDayPoint::pihenes);
        domains.put("mozgás", DetectorInput.NeedsDayPoint::mozgas);
        domains.put("lélek", DetectorInput.NeedsDayPoint::lelek);
        domains.put("rend", DetectorInput.NeedsDayPoint::rend);
        return domains;
    }

    @Override
    public String key() {
        return "needs-domain-imbalance";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (in.trend().needs() == null) {
            return List.of();
        }
        String today = state(in, in.day());
        String yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.equals(yesterday)) {
            return List.of();
        }
        String summary = "gyenge:nincs".equals(today)
                ? "Az Életjel-területek kiegyensúlyozottak: nincs olyan, amelyik tartósan lemaradna a többitől."
                : "Az Életjel-területek közül tartósan lemarad a többitől: "
                        + today.substring("gyenge:".length()).replace(",", ", ") + ".";
        int salience = "gyenge:nincs".equals(today) ? 2 : 4;
        return List.of(new DetectorSignal(key(), "pszichologus", summary, salience));
    }

    private static String state(DetectorInput in, LocalDate asOf) {
        List<DetectorInput.NeedsDayPoint> window = new ArrayList<>();
        for (DetectorInput.NeedsDayPoint d : in.trend().needs().days()) {
            if (TrailingWindow.inWindow(d.date(), asOf)) {
                window.add(d);
            }
        }
        if (window.size() < MIN_NEEDS_DAYS) {
            return null;
        }
        int threshold = in.trend().needs().greenThreshold();
        Map<String, Double> shares = new LinkedHashMap<>();
        for (Map.Entry<String, ToIntFunction<DetectorInput.NeedsDayPoint>> e : DOMAINS.entrySet()) {
            int green = 0;
            for (DetectorInput.NeedsDayPoint d : window) {
                if (e.getValue().applyAsInt(d) >= threshold) {
                    green++;
                }
            }
            shares.put(e.getKey(), (double) green / window.size());
        }
        long strong = shares.values().stream().filter(s -> s >= STRONG_SHARE).count();
        List<String> weak = new ArrayList<>();
        if (strong >= MIN_STRONG_DOMAINS) {
            for (Map.Entry<String, Double> e : shares.entrySet()) {
                if (e.getValue() < WEAK_SHARE) {
                    weak.add(e.getKey());
                }
            }
        }
        return weak.isEmpty() ? "gyenge:nincs" : "gyenge:" + String.join(",", weak);
    }
}
