package io.mrkuhne.mezo.feature.character.service.edition;

import io.mrkuhne.mezo.api.dto.PatternMonitorResponse;
import io.mrkuhne.mezo.feature.character.entity.CharacterConferenceEntity;
import io.mrkuhne.mezo.feature.character.repository.CharacterConferenceRepository;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.PatternMonitorService;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
import io.mrkuhne.mezo.feature.meal.mapper.MealMapper;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.nutrition.service.DailyTargets;
import io.mrkuhne.mezo.feature.proactive.entity.ExperimentEntity;
import io.mrkuhne.mezo.feature.proactive.entity.PredictionEntity;
import io.mrkuhne.mezo.feature.proactive.repository.ExperimentRepository;
import io.mrkuhne.mezo.feature.proactive.repository.PredictionRepository;
import io.mrkuhne.mezo.feature.train.service.WorkoutWindowQueryService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The esti kiadás's read composer (Task 4, spec 2026-09-24 §3): a thin, read-only facade over the
 * source repositories/services (five in H1; meals, fuel targets, workout windows and check-ins since H5) {@link EditionCandidateCollector} folds into edition
 * candidates. Mirrors {@link io.mrkuhne.mezo.feature.character.service.CharacterMetaReads}'s
 * @ConditionalOnProperty / repository-read style — every method is a straight pass-through, no
 * mapping happens here (that is the collector's job), so the collector can be unit-tested against
 * a Mockito double of this class.
 *
 * <p>{@link PatternMonitorService#monitor} is READ-ONLY (live gate diagnostics over cached series —
 * verified by reading it before wiring it in here): it never calls an LLM and never writes a row,
 * unlike the sibling proactive getters the brief forbids (they trigger generation).
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH},
        havingValue = "true")
public class TeamEditionReads {

    /** The daily konzílium's {@code kind} — see {@link CharacterConferenceEntity#getKind()}. */
    static final String KIND_DAILY = "DAILY";

    private final PatternRepository patternRepository;
    private final PatternMonitorService patternMonitorService;
    private final PredictionRepository predictionRepository;
    private final ExperimentRepository experimentRepository;
    private final CharacterConferenceRepository characterConferenceRepository;
    private final MealRepository mealRepository;
    private final MealMapper mealMapper;
    private final FuelDayService fuelDayService;
    private final WorkoutWindowQueryService workoutWindowQueryService;
    private final CheckInRepository checkInRepository;

    @Transactional(readOnly = true)
    public List<PatternEntity> patterns(UUID owner) {
        return patternRepository.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner);
    }

    /** Live gate diagnostics (no write) — see the class javadoc. */
    @Transactional(readOnly = true)
    public PatternMonitorResponse monitor(UUID owner) {
        return patternMonitorService.monitor(owner);
    }

    /** Non-pending predictions whose validity window ends in {@code [from, to]}. */
    @Transactional(readOnly = true)
    public List<PredictionEntity> resolvedPredictions(UUID owner, LocalDate from, LocalDate to) {
        return predictionRepository.findByCreatedByAndValidToBetweenAndDeletedFalse(owner, from, to).stream()
                .filter(p -> !PredictionEntity.STATUS_PENDING.equals(p.getStatus()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ExperimentEntity> activeExperiments(UUID owner) {
        return experimentRepository.findByCreatedByAndStatusOrderByGeneratedAtDesc(
                owner, ExperimentEntity.STATUS_ACTIVE);
    }

    /** The day's DAILY konzílium, if one was generated. */
    @Transactional(readOnly = true)
    public Optional<CharacterConferenceEntity> dailyConference(UUID owner, LocalDate day) {
        return characterConferenceRepository.findByCreatedByAndKindAndWeekStart(owner, KIND_DAILY, day);
    }
    /**
     * H5 (mezo-a9bo7.16): a nap étkezései Falat értékeléséhez — a fetch-join-os napi finderrel
     * (egy lekérdezés, nincs N+1), a kcal a kanonikus {@link MealMapper#contribution} összege
     * (ugyanaz, mint {@code FuelDayService#dayContext}-ben). A {@code MealCoachService} TILOS: LLM-et hív.
     */
    @Transactional(readOnly = true)
    public List<EditionMeal> meals(UUID owner, LocalDate day) {
        return mealRepository.findWithItemsByCreatedByAndMealDateAndDeletedFalseOrderByLoggedAtAsc(owner, day)
                .stream()
                .map(this::editionMeal)
                .toList();
    }

    private EditionMeal editionMeal(MealEntity meal) {
        BigDecimal kcal = BigDecimal.ZERO;
        for (MealItemEntity item : meal.getItems()) {
            kcal = kcal.add(mealMapper.contribution(item).getKcal());
        }
        return new EditionMeal(meal.getLoggedAt(), meal.getScore(), kcal);
    }

    /** H5: a nap kalória-célja — ugyanaz a feloldás, amivel a Fuel nap és a meal-score dolgozik. */
    @Transactional(readOnly = true)
    public DailyTargets targets(UUID owner, LocalDate day) {
        return fuelDayService.dailyTargets(owner, day);
    }

    /** H5: a nap edzés-ablakai (ütemezett + {@code done} jelzés). */
    @Transactional(readOnly = true)
    public List<WorkoutWindowQueryService.Window> windows(UUID owner, LocalDate day) {
        List<WorkoutWindowQueryService.Window> windows = workoutWindowQueryService.windowsFor(owner, day);
        return windows == null ? List.of() : windows;
    }

    /** H5: hány KÜLÖNBÖZŐ napon volt bejelentkezés {@code [from, to]}-ban (egy nap több sora egynek számít). */
    @Transactional(readOnly = true)
    public long checkinDays(UUID owner, LocalDate from, LocalDate to) {
        return checkInRepository.findByCreatedByAndDeletedFalseAndDateBetween(owner, from, to).stream()
                .map(CheckInEntity::getDate)
                .distinct()
                .count();
    }
}
