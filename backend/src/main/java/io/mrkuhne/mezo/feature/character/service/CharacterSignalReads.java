package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.character.detector.DetectorInput;
import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.JournalEntryRepository;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * The single cross-feature read composer for the detector framework (Karakter spec §5, mezo-1gim.3):
 * assembles a 14-day {@link DetectorInput} slice from meal, check-in, weight, and journal data,
 * mirroring the read-only cross-feature repository access pattern used by
 * {@code ContextSnapshotAssembler} (feature/companion).
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class CharacterSignalReads {

    private static final int WINDOW_DAYS = 14;

    private final MealRepository mealRepository;
    private final WeightLogRepository weightLogRepository;
    private final CheckInRepository checkInRepository;
    private final JournalEntryRepository journalEntryRepository;

    public DetectorInput gather(UUID owner, LocalDate day) {
        LocalDate windowStart = day.minusDays(WINDOW_DAYS - 1);

        Set<LocalDate> mealDates = new HashSet<>();
        Map<LocalDate, Integer> checkinCounts = new HashMap<>();
        for (LocalDate d = windowStart; !d.isAfter(day); d = d.plusDays(1)) {
            if (!mealRepository
                    .findByCreatedByAndMealDateAndDeletedFalseOrderByLoggedAtAsc(owner, d)
                    .isEmpty()) {
                mealDates.add(d);
            }
            int count = checkInRepository.findByCreatedByAndDateOrderBySlotTime(owner, d).size();
            checkinCounts.put(d, count);
        }

        List<DetectorInput.WeightPoint> weights = weightLogRepository
                .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(owner, windowStart)
                .stream()
                .map(w -> new DetectorInput.WeightPoint(w.getDate(), w.getWeightKg()))
                .sorted(Comparator.comparing(DetectorInput.WeightPoint::date))
                .toList();

        Map<LocalDate, List<String>> journalTexts = new HashMap<>();
        for (JournalEntryEntity entry : journalEntryRepository
                .findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnDescCreatedAtDesc(
                        owner, windowStart, day)) {
            journalTexts.computeIfAbsent(entry.getOccurredOn(), k -> new ArrayList<>())
                    .add(entry.getText());
        }

        return new DetectorInput(day, mealDates, checkinCounts, weights, journalTexts);
    }
}
