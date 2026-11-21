package io.mrkuhne.mezo.feature.boop.port;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * The owner's day capacity for the Boop morning brief (Boop B7 K1) — consumer-owned port (ADR 0012); the adapter
 * lives in the capacity feature ({@code BoopCapacityAdapter}), so boop stays a leaf. The read never calls the scoring
 * model (stored or rule scores only).
 */
public interface BoopCapacityPort {

    /** The day's capacity; {@code null} when the capacity feature is off. A failure surfaces as an exception. */
    View read(UUID owner, LocalDate date);

    /**
     * @param verdict      laza | rendben | szoros | tulSok
     * @param demandUnits  the day's total demand, in load units
     * @param hourly19     demand units per hour 06:00..24:00 (19 values) — bends the energy curve
     * @param reasonFacts  the rule-built Hungarian reason line (may be empty)
     */
    record View(String verdict, double ratio, boolean tanulo, int labelledDays, boolean calendarKnown,
                double demandUnits, double[] hourly19, List<Item> demand, List<Factor> factors,
                String reasonFacts) {}

    /** level: kicsi | kozepes | nagy | tolt. */
    record Item(String label, String kind, Instant start, String level) {}

    /** effect: jo | semleges | rossz. */
    record Factor(String key, String label, String value, String effect) {}
}
