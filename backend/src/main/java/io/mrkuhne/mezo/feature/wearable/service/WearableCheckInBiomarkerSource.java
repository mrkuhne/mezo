package io.mrkuhne.mezo.feature.wearable.service;

import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInBiomarkerSource;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.wearable.config.WearableProperties;
import io.mrkuhne.mezo.feature.wearable.entity.DailyMetricEntity;
import io.mrkuhne.mezo.feature.wearable.entity.HealthSampleEntity;
import io.mrkuhne.mezo.feature.wearable.repository.DailyMetricRepository;
import io.mrkuhne.mezo.feature.wearable.repository.HealthSampleRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;
import org.springframework.stereotype.Service;

/**
 * The server-side check-in snapshot from B1's Health data (Boop B3, mezo-r36n9.13, spec §7.3) — used when a
 * check-in arrives without the phone's snapshot (the web app):
 * <ul>
 *   <li>heart rate = the mean of the 5-minute {@code heart_rate} buckets starting within ±15 min of the moment,
 *       timed at the latest of them;</li>
 *   <li>HRV = the latest {@code hrv_sdnn} within the 8 h before the moment; "usual" = the median of the 14 days
 *       before it;</li>
 *   <li>steps = that owner-zone day's {@code daily_metric} total, flagged as a day total;</li>
 *   <li>sleep = that day's {@code sleep_log} night (the night that ended that morning), in minutes.</li>
 * </ul>
 * Deliberately not {@code @Transactional}: {@code CheckInService} calls it before its write transaction, and a
 * failure here must never mark any transaction rollback-only.
 */
@Service
public class WearableCheckInBiomarkerSource implements CheckInBiomarkerSource {

    static final String HEART_RATE = "heart_rate";
    static final String HRV_SDNN = "hrv_sdnn";
    static final Duration HR_WINDOW = Duration.ofMinutes(15);
    static final Duration HRV_LATEST_WINDOW = Duration.ofHours(8);
    static final Duration HRV_USUAL_WINDOW = Duration.ofDays(14);

    private final HealthSampleRepository samples;
    private final DailyMetricRepository dailyMetrics;
    private final SleepLogRepository sleepLogs;
    private final ZoneId zone;

    public WearableCheckInBiomarkerSource(HealthSampleRepository samples, DailyMetricRepository dailyMetrics,
                                          SleepLogRepository sleepLogs, WearableProperties properties) {
        this.samples = samples;
        this.dailyMetrics = dailyMetrics;
        this.sleepLogs = sleepLogs;
        this.zone = ZoneId.of(properties.zone());
    }

    @Override
    public Optional<CheckInSnapshotValues> snapshotAt(UUID owner, Instant at) {
        List<HealthSampleEntity> hr = withValue(samples.findWindow(owner, HEART_RATE,
            at.minus(HR_WINDOW), at.plus(HR_WINDOW)));
        Integer hrBpm = hr.isEmpty() ? null
            : (int) Math.round(hr.stream().mapToDouble(HealthSampleEntity::getValue).average().orElseThrow());
        HealthSampleEntity hrLatest = hr.isEmpty() ? null : hr.getLast();

        List<HealthSampleEntity> hrv = withValue(samples.findWindow(owner, HRV_SDNN, at.minus(HRV_USUAL_WINDOW), at));
        HealthSampleEntity hrvLatest = hrv.isEmpty() || hrv.getLast().getStartAt().isBefore(at.minus(HRV_LATEST_WINDOW))
            ? null : hrv.getLast();

        LocalDate day = at.atZone(zone).toLocalDate();
        Integer steps = dailyMetrics.findByCreatedByAndDeletedFalseAndDateBetweenOrderByDate(owner, day, day).stream()
            .map(DailyMetricEntity::getSteps).filter(s -> s != null).findFirst().orElse(null);
        Integer sleepMinutes = sleepLogs.findByCreatedByAndDateAndDeletedFalse(owner, day)
            .map(SleepLogEntity::getDurationH)
            .map(h -> h.multiply(BigDecimal.valueOf(60)).setScale(0, RoundingMode.HALF_UP).intValue())
            .orElse(null);
        String source = Stream.of(hrLatest, hrvLatest).filter(s -> s != null)
            .map(HealthSampleEntity::getSourceBundle).filter(s -> s != null).findFirst().orElse(null);

        CheckInSnapshotValues values = new CheckInSnapshotValues(
            hrBpm, hrLatest == null ? null : hrLatest.getStartAt(),
            hrvLatest == null ? null : hrvLatest.getValue(), hrvLatest == null ? null : hrvLatest.getStartAt(),
            median(hrv), steps, steps == null ? null : Boolean.TRUE, sleepMinutes, source);
        boolean nothing = hrBpm == null && values.hrvMs() == null && values.hrvUsualMs() == null && steps == null
            && sleepMinutes == null;
        return nothing ? Optional.empty() : Optional.of(values);
    }

    private static List<HealthSampleEntity> withValue(List<HealthSampleEntity> rows) {
        return rows.stream().filter(r -> r.getValue() != null).toList();
    }

    private static Double median(List<HealthSampleEntity> rows) {
        if (rows.isEmpty()) {
            return null;
        }
        double[] sorted = rows.stream().mapToDouble(HealthSampleEntity::getValue).sorted().toArray();
        int mid = sorted.length / 2;
        return sorted.length % 2 == 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }
}
