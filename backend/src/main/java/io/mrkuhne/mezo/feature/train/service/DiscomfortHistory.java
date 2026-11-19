package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.TrainSubstituteProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseDiscomfortEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseDiscomfortRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseFeedbackRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseFeedbackRepository.FeedbackIdentityRow;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * The recent joint-discomfort level of catalogue exercises (mezo-r36n9.66, spec §6.1). Per exercise, over its
 * newest {@code feedbackWindow} after-exercise answers (by identity) and its swap-time records of the last
 * {@code recordWindowDays} days: STRONG if any answer was <em>Erős</em> (3); else MILD if any was <em>Enyhe</em> (2)
 * or any record exists; else NONE. An exercise is matched by catalogue id AND by exact name, so a custom row
 * marked under a catalogue exercise's name still counts for that catalogue twin.
 */
@Component
@RequiredArgsConstructor
public class DiscomfortHistory {

    private static final int MILD_ANSWER = 2;
    private static final int STRONG_ANSWER = 3;

    private final ExerciseFeedbackRepository feedbackRepository;
    private final ExerciseDiscomfortRepository discomfortRepository;
    private final TrainSubstituteProperties properties;

    /** The fold rule: {@code jointPainNewestFirst} are 1..3 answers (1 none, 2 mild, 3 strong). */
    public static PainLevel fold(List<Integer> jointPainNewestFirst, int recordCount, int feedbackWindow) {
        List<Integer> window = jointPainNewestFirst.subList(0, Math.min(feedbackWindow, jointPainNewestFirst.size()));
        if (window.stream().anyMatch(p -> p == STRONG_ANSWER)) {
            return PainLevel.STRONG;
        }
        if (recordCount > 0 || window.stream().anyMatch(p -> p == MILD_ANSWER)) {
            return PainLevel.MILD;
        }
        return PainLevel.NONE;
    }

    @Transactional(readOnly = true)
    public Map<UUID, PainLevel> levels(UUID userId, Collection<ExerciseCatalogEntity> exercises, LocalDate today) {
        Map<String, List<FeedbackIdentityRow>> feedbackByKey = new HashMap<>();
        for (FeedbackIdentityRow r : feedbackRepository.findIdentityFeedbackNewestFirst(userId)) {
            feedbackByKey.computeIfAbsent(ExerciseHistoryResolver.identityKey(r.getCatalogId(), r.getName()),
                k -> new ArrayList<>()).add(r);
        }
        Map<String, Integer> recordsByKey = new HashMap<>();
        for (ExerciseDiscomfortEntity d : discomfortRepository.findByCreatedByAndNotedOnGreaterThanEqual(
                userId, today.minusDays(properties.recordWindowDays()))) {
            recordsByKey.merge(d.getIdentityKey(), 1, Integer::sum);
        }
        Map<UUID, PainLevel> out = new HashMap<>();
        for (ExerciseCatalogEntity ex : exercises) {
            List<String> keys = List.of(
                ExerciseHistoryResolver.identityKey(ex.getId(), ex.getName()),
                ExerciseHistoryResolver.identityKey(null, ex.getName()));
            List<FeedbackIdentityRow> rows = new ArrayList<>();
            int records = 0;
            for (String k : keys) {
                rows.addAll(feedbackByKey.getOrDefault(k, List.of()));
                records += recordsByKey.getOrDefault(k, 0);
            }
            rows.sort(Comparator.comparing(FeedbackIdentityRow::getCreatedAt).reversed());
            out.put(ex.getId(), fold(rows.stream().map(FeedbackIdentityRow::getJointPain).toList(),
                records, properties.feedbackWindow()));
        }
        return out;
    }
}
