package io.mrkuhne.mezo.feature.biometrics.sleep.service;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepHypnogram;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import java.math.BigDecimal;

/**
 * The one-night-per-date merge rule (Boop B1, mezo-r36n9.11) — pure, no I/O, used by both writers
 * (Apple Health ingest and the web/screenshot log). <b>Sensor fields</b> (bed/wake, duration, stages,
 * hypnogram, in-bed, sleeping HR, source app, external id) belong to Apple Health; <b>subjective
 * fields</b> (quality, source quality %, awakenings, note) belong to a manual/screenshot entry.
 */
public final class SleepNightMerge {

    public static final String APPLE_HEALTH = "apple_health";
    public static final String MANUAL = "manual";

    private SleepNightMerge() {
    }

    /** The sensor side of a night as the phone assembled it. */
    public record HealthNight(String externalId, String bedtime, String wakeup, BigDecimal durationH,
                              Integer inBedMin, Integer awakeMin, Integer lightMin, Integer remMin,
                              Integer deepMin, SleepHypnogram hypnogram, String sourceApp, Integer sleepingHr) {
    }

    /** A manual / screenshot-confirm entry; every field is optional. */
    public record Entry(String bedtime, String wakeup, BigDecimal durationH, Integer quality, Integer awakenings,
                        String note, Integer inBedMin, Integer awakeMin, Integer lightMin, Integer remMin,
                        Integer deepMin, Integer sourceQualityPct, SleepHypnogram hypnogram, String source) {
    }

    /**
     * A Health night lands on {@code row}. A row that is already a Health night is overwritten
     * wholesale (re-sync); a manual/screenshot row takes every sensor value Health has and keeps its own
     * where Health has none. The subjective fields are never touched.
     */
    public static void applyHealth(SleepLogEntity row, HealthNight n) {
        boolean wholesale = APPLE_HEALTH.equals(row.getSource());
        row.setBedtime(pick(wholesale, n.bedtime(), row.getBedtime()));
        row.setWakeup(pick(wholesale, n.wakeup(), row.getWakeup()));
        row.setDurationH(pick(wholesale, n.durationH(), row.getDurationH()));
        row.setInBedMin(pick(wholesale, n.inBedMin(), row.getInBedMin()));
        row.setAwakeMin(pick(wholesale, n.awakeMin(), row.getAwakeMin()));
        row.setLightMin(pick(wholesale, n.lightMin(), row.getLightMin()));
        row.setRemMin(pick(wholesale, n.remMin(), row.getRemMin()));
        row.setDeepMin(pick(wholesale, n.deepMin(), row.getDeepMin()));
        row.setHypnogram(pick(wholesale, n.hypnogram(), row.getHypnogram()));
        row.setSleepingHr(pick(wholesale, n.sleepingHr(), row.getSleepingHr()));
        row.setSourceApp(pick(wholesale, n.sourceApp(), row.getSourceApp()));
        row.setExternalId(n.externalId());
        row.setSource(APPLE_HEALTH);
    }

    /**
     * A manual / screenshot entry lands on an existing live row. On a Health row only the subjective
     * fields (non-null ones) are applied — the sensor times and stages stay. On a manual/screenshot row
     * the newer entry replaces every field it provides, in place.
     */
    public static void applyEntry(SleepLogEntity row, Entry e) {
        applySubjective(row, e);
        if (APPLE_HEALTH.equals(row.getSource())) {
            return;
        }
        row.setBedtime(orKeep(e.bedtime(), row.getBedtime()));
        row.setWakeup(orKeep(e.wakeup(), row.getWakeup()));
        row.setDurationH(orKeep(e.durationH(), row.getDurationH()));
        row.setInBedMin(orKeep(e.inBedMin(), row.getInBedMin()));
        row.setAwakeMin(orKeep(e.awakeMin(), row.getAwakeMin()));
        row.setLightMin(orKeep(e.lightMin(), row.getLightMin()));
        row.setRemMin(orKeep(e.remMin(), row.getRemMin()));
        row.setDeepMin(orKeep(e.deepMin(), row.getDeepMin()));
        row.setHypnogram(orKeep(e.hypnogram(), row.getHypnogram()));
        row.setSource(orKeep(e.source(), row.getSource()));
    }

    /** True when the row carries something only a person could have entered. */
    public static boolean hasSubjective(SleepLogEntity row) {
        return row.getQuality() != null || row.getSourceQualityPct() != null || row.getAwakenings() != null;
    }

    /**
     * A Health night vanished from the phone but its row carries subjective values: keep bed/wake/duration
     * and the subjective fields as a manual row; drop everything the sensor contributed.
     */
    public static void demoteToManual(SleepLogEntity row) {
        row.setSource(MANUAL);
        row.setExternalId(null);
        row.setInBedMin(null);
        row.setAwakeMin(null);
        row.setLightMin(null);
        row.setRemMin(null);
        row.setDeepMin(null);
        row.setHypnogram(null);
        row.setSourceApp(null);
        row.setSleepingHr(null);
    }

    private static void applySubjective(SleepLogEntity row, Entry e) {
        row.setQuality(orKeep(e.quality(), row.getQuality()));
        row.setSourceQualityPct(orKeep(e.sourceQualityPct(), row.getSourceQualityPct()));
        row.setAwakenings(orKeep(e.awakenings(), row.getAwakenings()));
        row.setNotes(orKeep(e.note(), row.getNotes()));
    }

    private static <T> T orKeep(T incoming, T existing) {
        return incoming != null ? incoming : existing;
    }

    private static <T> T pick(boolean wholesale, T health, T existing) {
        return wholesale ? health : orKeep(health, existing);
    }
}
