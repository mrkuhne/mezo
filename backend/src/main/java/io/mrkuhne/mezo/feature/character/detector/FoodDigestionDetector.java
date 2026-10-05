package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInItem;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Food × digestion (Check-in 2.0, mezo-ck2, spec §3.4b) — which meal attribute keeps turning up
 * in the 1–5 hours before a LOW digestion answer ({@code digestion <= 4}, "nehéz, puffadt")?
 *
 * <p>Each digestion answer is a check-in ROW ({@code CheckinSlotPoint.digestion}) timed at its
 * nominal slot ("HH:mm") — the question is "how does your stomach feel NOW", and a backfilled
 * answer is about the slot, not the moment it was typed. The meals logged on the same day
 * {@link #MIN_LAG_H}–{@link #MAX_LAG_H} hours before that time form its window; an answer with no
 * meal in its window is not paired. A window's attributes are its meals' ingredients (the line
 * snapshot names) and their dominant NOVA classes.
 *
 * <p>Whoop guard: silent until there are {@link #MIN_ANSWERS_PER_GROUP} low AND
 * {@link #MIN_ANSWERS_PER_GROUP} OK paired answers. A culprit must precede at least
 * {@link #MIN_CULPRIT_LOW} low answers, and the share of its windows that ended low must be at
 * least {@link #MIN_CULPRIT_LOW_RATE} and {@link #MIN_LIFT} above the overall low rate — a food
 * that is in EVERY meal is not a culprit. The most frequent culprit wins (ties: higher rate, then
 * ingredients before NOVA, then alphabetical).
 *
 * <p>State-change gate over the 8-week series: state = the culprit attribute.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class FoodDigestionDetector implements CharacterDetector {

    static final int LOW_MAX = 4;
    static final int MIN_LAG_H = 1;
    static final int MAX_LAG_H = 5;
    static final int MIN_ANSWERS_PER_GROUP = 5;
    static final int MIN_CULPRIT_LOW = 3;
    static final double MIN_CULPRIT_LOW_RATE = 0.6;
    static final double MIN_LIFT = 0.2;

    private static final String INGREDIENT = "i:";
    private static final String NOVA = "n:";

    @Override
    public String key() {
        return "food-digestion";
    }

    @Override
    public Map<CheckInItem, String> checkInNeeds() {
        return Map.of(CheckInItem.DIGESTION, "Most azt figyeljük, melyik étel után lesz nehezebb a gyomrod.");
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        Finding today = finding(in, in.day());
        Finding yesterday = finding(in, in.day().minusDays(1));
        if (today == null || (yesterday != null && today.attribute().equals(yesterday.attribute()))) {
            return List.of();
        }
        String what = today.attribute().startsWith(INGREDIENT)
                ? "amelyekben „" + today.attribute().substring(INGREDIENT.length()) + "” volt"
                : "amelyekben " + novaLabel(today.attribute().substring(NOVA.length())) + " étel dominált";
        String summary = "Azok után az étkezések után, " + what + ", 1–5 órán belül "
                + (today.lowWith() + today.okWith()) + " alkalomból " + today.lowWith()
                + " esetben nehéznek jelezted a gyomrod (emésztés 4 vagy alatta). Összesen "
                + today.lowTotal() + " nehéz és " + today.okTotal()
                + " rendben lévő jelzésed volt étkezés után. Együttjárás a saját adataidban, nem ételintolerancia-diagnózis.";
        return List.of(new DetectorSignal(key(), "taplalkozo", summary, 3));
    }

    record Finding(String attribute, int lowWith, int okWith, int lowTotal, int okTotal) {}

    static Finding finding(DetectorInput in, LocalDate asOf) {
        Map<LocalDate, List<DetectorInput.MealPoint>> mealsByDate = new HashMap<>();
        for (DetectorInput.MealDayPoint d : in.trend().mealDays()) {
            if (!d.date().isAfter(asOf) && d.meals() != null) {
                mealsByDate.put(d.date(), d.meals());
            }
        }
        Map<String, int[]> counts = new HashMap<>(); // attribute → {low, ok}
        int lowTotal = 0;
        int okTotal = 0;
        for (DetectorInput.CheckinSlotPoint s : in.trend().checkinSlots()) {
            if (s.digestion() == null || s.date().isAfter(asOf)) {
                continue;
            }
            LocalTime at = parse(s.slotTime());
            if (at == null) {
                continue;
            }
            LocalDateTime answer = s.date().atTime(at);
            Set<String> attributes = new LinkedHashSet<>();
            for (DetectorInput.MealPoint m : mealsByDate.getOrDefault(s.date(), List.of())) {
                if (m.loggedAtLocalTime() == null) {
                    continue;
                }
                LocalDateTime eaten = s.date().atTime(m.loggedAtLocalTime());
                if (eaten.isAfter(answer.minusHours(MIN_LAG_H)) || eaten.isBefore(answer.minusHours(MAX_LAG_H))) {
                    continue;
                }
                if (m.itemNames() != null) {
                    for (String name : m.itemNames()) {
                        attributes.add(INGREDIENT + name);
                    }
                }
                if (m.nova() != null) {
                    attributes.add(NOVA + m.nova());
                }
            }
            if (attributes.isEmpty()) {
                continue;
            }
            boolean low = s.digestion() <= LOW_MAX;
            if (low) {
                lowTotal++;
            } else {
                okTotal++;
            }
            for (String a : attributes) {
                counts.computeIfAbsent(a, k -> new int[2])[low ? 0 : 1]++;
            }
        }
        if (lowTotal < MIN_ANSWERS_PER_GROUP || okTotal < MIN_ANSWERS_PER_GROUP) {
            return null;
        }
        double baseRate = (double) lowTotal / (lowTotal + okTotal);
        List<Map.Entry<String, int[]>> culprits = new ArrayList<>();
        for (Map.Entry<String, int[]> e : counts.entrySet()) {
            int lowWith = e.getValue()[0];
            double rate = (double) lowWith / (lowWith + e.getValue()[1]);
            if (lowWith >= MIN_CULPRIT_LOW && rate >= MIN_CULPRIT_LOW_RATE && rate - baseRate >= MIN_LIFT) {
                culprits.add(e);
            }
        }
        if (culprits.isEmpty()) {
            return null;
        }
        culprits.sort((a, b) -> {
            int c = Integer.compare(b.getValue()[0], a.getValue()[0]);
            if (c != 0) {
                return c;
            }
            c = Double.compare(rate(b.getValue()), rate(a.getValue()));
            if (c != 0) {
                return c;
            }
            c = Boolean.compare(b.getKey().startsWith(INGREDIENT), a.getKey().startsWith(INGREDIENT));
            return c != 0 ? c : a.getKey().compareTo(b.getKey());
        });
        Map.Entry<String, int[]> top = culprits.getFirst();
        return new Finding(top.getKey(), top.getValue()[0], top.getValue()[1], lowTotal, okTotal);
    }

    private static double rate(int[] lowOk) {
        return (double) lowOk[0] / (lowOk[0] + lowOk[1]);
    }

    private static String novaLabel(String nova) {
        return switch (nova) {
            case "1" -> "feldolgozatlan (NOVA 1)";
            case "2" -> "konyhai alapanyag (NOVA 2)";
            case "3" -> "feldolgozott (NOVA 3)";
            default -> "ultrafeldolgozott (NOVA 4)";
        };
    }

    private static LocalTime parse(String hhmm) {
        if (hhmm == null) {
            return null;
        }
        try {
            return LocalTime.parse(hhmm.strip());
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
