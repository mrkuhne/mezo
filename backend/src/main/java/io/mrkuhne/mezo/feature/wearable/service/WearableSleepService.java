package io.mrkuhne.mezo.feature.wearable.service;

import io.mrkuhne.mezo.api.dto.IngestResult;
import io.mrkuhne.mezo.api.dto.SleepNightIn;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepLogSavedEvent;
import io.mrkuhne.mezo.feature.wearable.config.WearableProperties;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Apple Health sleep nights → {@code sleep_log} (Boop S2, mezo-r36n9.2). Idempotent by the client's
 * {@code externalId}: a re-sent night updates its row. A 60-night backfill must not flood the
 * companion, so at most ONE {@link SleepLogSavedEvent} is published per call — for the newest night,
 * only when this call inserted it and it is from today or yesterday.
 */
@Service
@RequiredArgsConstructor
public class WearableSleepService {

    private final SleepLogRepository repository;
    private final WearableProperties properties;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public IngestResult ingest(UUID createdBy, List<SleepNightIn> nights, LocalDate today) {
        WearableBatches.requireAtMost(nights.size(), properties.maxSleepNights());
        Set<String> existing = new HashSet<>(repository.findExistingExternalIds(
            createdBy, nights.stream().map(SleepNightIn::getExternalId).toList()));
        Set<String> seen = new HashSet<>();
        int inserted = 0;
        int updated = 0;
        for (SleepNightIn n : nights) {
            repository.upsertAppleHealthNight(createdBy, n.getExternalId(), n.getDate(), n.getBedtime(),
                n.getWakeup(), n.getDurationH(), positiveOrNull(n.getInBedMin()), n.getAwakeMin(),
                n.getLightMin(), n.getRemMin(), n.getDeepMin(), hypnogramJson(n), n.getSourceApp(), n.getSleepingHr());
            if (existing.contains(n.getExternalId()) || !seen.add(n.getExternalId())) {
                updated++;
            } else {
                inserted++;
            }
        }
        nights.stream().max(Comparator.comparing(SleepNightIn::getDate))
            .filter(newest -> !existing.contains(newest.getExternalId()))
            .filter(newest -> !newest.getDate().isBefore(today.minusDays(1)))
            .ifPresent(newest -> eventPublisher.publishEvent(new SleepLogSavedEvent(createdBy, newest.getDate())));
        return new IngestResult(inserted, updated);
    }

    /** sleep_log.in_bed_min is {@code >= 1}; Health can report 0 for a night without an in-bed sample. */
    private static Integer positiveOrNull(Integer v) {
        return v == null || v < 1 ? null : v;
    }

    private static String hypnogramJson(SleepNightIn n) {
        if (n.getHypnogram() == null) {
            return null;
        }
        // Contract-validated: bucketMin >= 1, stages ^[DLRA]+$ — safe to inline.
        return "{\"bucketMin\":" + n.getHypnogram().getBucketMin()
            + ",\"stages\":\"" + n.getHypnogram().getStages() + "\"}";
    }
}
