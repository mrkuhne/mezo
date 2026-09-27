package io.mrkuhne.mezo.feature.train.service;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Consumer-owned port (ADR 0012, the {@link AthleteBodyPort} pattern): training readiness
 * (Check-in 2.0, mezo-ck2) reads the day's check-ins, but biometrics → train already exists, so a
 * direct train → biometrics import would close a new slice cycle. Train owns this seam; the
 * biometrics slice provides the adapter. Pure read.
 */
public interface DayCheckInPort {

    /** The user's check-ins of {@code date}, slot-time ascending (empty when none). */
    List<DayCheckIn> checkIns(UUID userId, LocalDate date);

    /**
     * The readiness-relevant answers of one check-in; every value is NULL when not answered.
     *
     * @param slotTime    the slot, {@code HH:mm} (e.g. {@code 06:30})
     * @param painRegions stored {@code PainRegion} names (e.g. {@code VALL}); empty when none
     */
    record DayCheckIn(String slotTime, Integer rested, Integer soreness, Integer motivation,
                      Boolean pain, List<String> painRegions, Integer painIntensity) {}
}
