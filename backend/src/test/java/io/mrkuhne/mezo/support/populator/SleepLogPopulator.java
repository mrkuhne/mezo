package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepHypnogram;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/**
 * Test data factory for the SleepLog aggregate — see
 * docs/references/integration_test_framework.md (one populator per aggregate). Persists via
 * repository {@code saveAndFlush} so DB CHECKs fire. Seeds raw sleep rows for read-side tests
 * (e.g. future Insights) without going through the service write path.
 */
@TestComponent
@RequiredArgsConstructor
public class SleepLogPopulator {

    private final SleepLogRepository sleepLogRepository;

    /** Persists a single sleep log for {@code owner} on {@code date}. */
    public SleepLogEntity createSleepLog(UUID owner, LocalDate date, BigDecimal durationH, Integer quality) {
        SleepLogEntity e = new SleepLogEntity();
        e.setCreatedBy(owner); // ownership set server-side style
        e.setDate(date);
        e.setDurationH(durationH);
        e.setQuality(quality);
        return sleepLogRepository.saveAndFlush(e);
    }

    /** Tracker-grade (screenshot) row — every enrichment field explicit (mezo-dbsr/mezo-fk9a);
     *  nulls allowed so sparse manual rows seed from the same factory (mezo-ohce). */
    public SleepLogEntity createTrackerSleepLog(UUID owner, LocalDate date, String bedtime, String wakeup,
        BigDecimal durationH, Integer quality, Integer awakenings, Integer inBedMin, Integer awakeMin,
        Integer lightMin, Integer remMin, Integer deepMin, Integer sourceQualityPct, String source,
        SleepHypnogram hypnogram, String notes) {
        SleepLogEntity e = new SleepLogEntity();
        e.setCreatedBy(owner);
        e.setDate(date);
        e.setBedtime(bedtime);
        e.setWakeup(wakeup);
        e.setDurationH(durationH);
        e.setQuality(quality);
        e.setAwakenings(awakenings);
        e.setInBedMin(inBedMin);
        e.setAwakeMin(awakeMin);
        e.setLightMin(lightMin);
        e.setRemMin(remMin);
        e.setDeepMin(deepMin);
        e.setSourceQualityPct(sourceQualityPct);
        e.setSource(source);
        e.setHypnogram(hypnogram);
        e.setNotes(notes);
        return sleepLogRepository.saveAndFlush(e);
    }

    /** Teljes alvás-sor a V3.4 extraktor/digest IT-khez — minden mező explicit (mezo-6ha5). */
    public SleepLogEntity createSleepLog(UUID owner, LocalDate date, String bedtime, String wakeup,
        BigDecimal durationH, Integer quality, Integer awakenings, String notes) {
        SleepLogEntity e = new SleepLogEntity();
        e.setCreatedBy(owner);
        e.setDate(date);
        e.setBedtime(bedtime);
        e.setWakeup(wakeup);
        e.setDurationH(durationH);
        e.setQuality(quality);
        e.setAwakenings(awakenings);
        e.setNotes(notes);
        return sleepLogRepository.saveAndFlush(e);
    }

    /** Full sleep log incl. bed/wake clock strings (habit wake-window / bed-on-time tests). */
    public SleepLogEntity createSleepLog(UUID owner, LocalDate date, String bedtime, String wakeup,
        BigDecimal durationH) {
        SleepLogEntity e = new SleepLogEntity();
        e.setCreatedBy(owner);
        e.setDate(date);
        e.setBedtime(bedtime);
        e.setWakeup(wakeup);
        e.setDurationH(durationH);
        e.setQuality(7);
        return sleepLogRepository.saveAndFlush(e);
    }
}
