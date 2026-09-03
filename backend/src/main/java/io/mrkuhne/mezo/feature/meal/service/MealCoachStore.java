package io.mrkuhne.mezo.feature.meal.service;

import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The transactional half of the meal coach (mezo-mr4n): reads a day fully inside ONE short
 * read-only transaction and writes prose back in another. It exists as its own bean on purpose —
 * {@link MealCoachService} must call the LLM with NO transaction open (a batch would otherwise pin
 * a pooled connection for the whole roundtrip), and a {@code @Transactional} method called from
 * within the same class would bypass the proxy and silently run without one.
 *
 * <p>Reads return detached {@link LoadedMeal} records, not entities: the meal's LAZY items are
 * summed while the session is still open, so nothing can lazy-initialize outside it.
 */
@Service
@RequiredArgsConstructor
class MealCoachStore {

    /** One day-meal, fully materialized: its envelope plus its own macro totals. */
    record LoadedMeal(UUID id, String title, String slot, Instant loggedAt,
                      MealBreakdownJson breakdown,
                      BigDecimal kcal, BigDecimal p, BigDecimal c, BigDecimal f) {
    }

    private final MealRepository mealRepository;

    /** The day's meals in log order, items already summed. */
    @Transactional(readOnly = true)
    List<LoadedMeal> loadDay(UUID userId, LocalDate date) {
        return mealRepository
            .findByCreatedByAndMealDateAndDeletedFalseOrderByLoggedAtAsc(userId, date).stream()
            .map(MealCoachStore::toLoaded)
            .toList();
    }

    /** The owned meal's date — the day a single-meal open belongs to (404 when foreign/missing). */
    @Transactional(readOnly = true)
    LocalDate dateOfOwnedMeal(UUID userId, UUID mealId) {
        return mealRepository.findByIdAndCreatedByAndDeletedFalse(mealId, userId)
            .map(MealEntity::getMealDate)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }

    /**
     * Writes prose into the meal's existing envelope — value, confidence, dimensions and tools are
     * copied verbatim, so a coach run can never move a number. Returns the updated meal, or empty
     * when it vanished / has no envelope to enrich.
     */
    @Transactional
    Optional<LoadedMeal> writeProse(UUID userId, UUID mealId, String summary, String tagline,
        List<MealBreakdownJson.ImproveRow> improve, Map<String, String> dimensionNotes) {
        return mealRepository.findByIdAndCreatedByAndDeletedFalse(mealId, userId)
            .filter(meal -> meal.getBreakdown() != null)
            .map(meal -> {
                MealBreakdownJson det = meal.getBreakdown();
                meal.setBreakdown(new MealBreakdownJson(det.value(), det.confidence(), summary,
                    tagline, mergeDimensionNotes(det.dimensions(), dimensionNotes), improve,
                    det.tools()));
                return toLoaded(mealRepository.saveAndFlush(meal));
            });
    }

    /**
     * Writes each note into the dimension carrying its id; ids the envelope doesn't have are
     * dropped silently. Every other field of the dimension is copied verbatim (mirrors {@link
     * #writeProse}'s "coach never moves a number" contract). A weight-0 ("Nincs adat", degraded)
     * dimension NEVER gets a note, even if the LLM disobeys the prompt rule and sends one — the
     * prompt asks nicely, this is the enforcement, since an untrusted LLM answer cannot be trusted
     * to honor a prose-only instruction.
     */
    static List<MealBreakdownJson.Dimension> mergeDimensionNotes(
        List<MealBreakdownJson.Dimension> dimensions, Map<String, String> notes) {
        if (dimensions == null) {
            return dimensions;
        }
        return dimensions.stream()
            .map(d -> notes != null && notes.containsKey(d.id()) && !isDegraded(d)
                ? withNote(d, notes.get(d.id())) : d)
            .toList();
    }

    private static boolean isDegraded(MealBreakdownJson.Dimension d) {
        return d.weight() == null || d.weight().signum() == 0;
    }

    private static MealBreakdownJson.Dimension withNote(MealBreakdownJson.Dimension d, String note) {
        return new MealBreakdownJson.Dimension(d.id(), d.label(), d.weight(), d.score(), d.detail(),
            d.macro(), d.micros(), d.nova(), d.context(), note);
    }

    private static LoadedMeal toLoaded(MealEntity meal) {
        return new LoadedMeal(meal.getId(), meal.getTitle(), meal.getSlot(), meal.getLoggedAt(),
            meal.getBreakdown(),
            sum(meal, MealItemEntity::getSnapshotKcal), sum(meal, MealItemEntity::getSnapshotProteinG),
            sum(meal, MealItemEntity::getSnapshotCarbsG), sum(meal, MealItemEntity::getSnapshotFatG));
    }

    /** Summed while the persistence context is open — the whole reason reads return records. */
    private static BigDecimal sum(MealEntity meal, Function<MealItemEntity, BigDecimal> field) {
        return meal.getItems().stream()
            .map(field)
            .filter(v -> v != null)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
