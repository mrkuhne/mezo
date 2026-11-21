package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.service.CapacityCalculator.Capacity;
import io.mrkuhne.mezo.feature.capacity.service.CapacityCalculator.Factor;
import io.mrkuhne.mezo.feature.capacity.service.DemandCalculator.Demand;
import io.mrkuhne.mezo.feature.capacity.service.DemandCalculator.DemandItem;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

/**
 * The "why" line of a day (Boop B7 K1): the two drivers with the strongest effect, worded by rule in Hungarian,
 * from facts the engines already hold - it counts events and names a part of the day, it never invents a number.
 * A factor's weight is how far its multiplier is from 1; a demand group's weight is its units over the capacity.
 */
final class CapacityReasonFacts {

    private CapacityReasonFacts() {
    }

    private record Driver(double weight, String text) {
    }

    static String of(Demand demand, Capacity capacity, ZoneId zone) {
        List<Driver> drivers = new ArrayList<>();
        for (Factor f : capacity.factors()) {
            if (f.effect() != 0) {
                drivers.add(new Driver(Math.abs(1.0 - f.multiplier()), factorText(f)));
            }
        }
        double cap = capacity.units();
        List<DemandItem> meetings = demand.items().stream()
            .filter(i -> ("meeting".equals(i.kind()) || "call".equals(i.kind())) && !i.restores()).toList();
        double meetingUnits = meetings.stream().mapToDouble(DemandItem::units).sum();
        if (!meetings.isEmpty() && meetingUnits > 0 && cap > 0) {
            drivers.add(new Driver(meetingUnits / cap, meetings.size() + " megbeszélés " + daypart(meetings, zone)));
        }
        double trainingUnits = demand.items().stream().filter(i -> "training".equals(i.kind()))
            .mapToDouble(DemandItem::units).sum();
        if (trainingUnits > 0 && cap > 0) {
            drivers.add(new Driver(trainingUnits / cap, "edzés a napban"));
        }
        return drivers.stream().sorted(Comparator.comparingDouble(Driver::weight).reversed()).limit(2)
            .map(Driver::text).collect(Collectors.joining(" · "));
    }

    private static String factorText(Factor f) {
        boolean lowers = f.effect() < 0;
        return switch (f.key()) {
            case "sleep" -> "rövid éjszaka";
            case "rhr" -> "magas nyugalmi pulzus";
            case "hrv" -> "alacsony HRV";
            case "yesterday" -> "terhes tegnap";
            case "fuel" -> "kevés evés tegnap";
            case "recovery" -> "kímélő mód";
            case "checkin" -> lowers ? "alacsony reggeli energia" : "jó reggeli energia";
            default -> f.label().toLowerCase(java.util.Locale.ROOT);
        };
    }

    /** The part of the day most of the meetings start in; the earlier one wins a tie. */
    private static String daypart(List<DemandItem> meetings, ZoneId zone) {
        int morning = 0, afternoon = 0, evening = 0;
        for (DemandItem m : meetings) {
            int hour = m.start().atZone(zone).getHour();
            if (hour < 12) {
                morning++;
            } else if (hour < 18) {
                afternoon++;
            } else {
                evening++;
            }
        }
        if (morning >= afternoon && morning >= evening) {
            return "délelőtt";
        }
        return afternoon >= evening ? "délután" : "este";
    }
}
