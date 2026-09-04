package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Package-private fold shared by {@link MeWeekService} and {@link DayScoreService} (fix round 1,
 * mezo-jcpt.8 review): both services needed the SAME "latest weigh-in per calendar day" rule over
 * the SAME ranged repository query, and the two had drifted into a byte-for-byte copy under
 * different variable names. Both classes live in this one package, so a package-private static
 * helper carries zero cross-feature coupling and zero ArchUnit risk — there was no layering
 * reason to keep the duplicate.
 */
final class WeightByDateSupport {

    private WeightByDateSupport() {
    }

    /** Latest (by {@code createdAt}) weigh-in per calendar day inside {@code [from, to]} — one
     *  ranged query, never a per-day fan-out (mezo-jcpt.6). */
    static Map<LocalDate, WeightLogEntity> latestWeightByDate(
            WeightLogRepository weightLogRepository, UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, WeightLogEntity> byDate = new HashMap<>();
        weightLogRepository.findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, from)
                .stream()
                .filter(w -> !w.getDate().isAfter(to))
                .sorted(Comparator.comparing(WeightLogEntity::getCreatedAt))
                .forEach(w -> byDate.put(w.getDate(), w)); // last write per date wins = most recent createdAt
        return byDate;
    }
}
