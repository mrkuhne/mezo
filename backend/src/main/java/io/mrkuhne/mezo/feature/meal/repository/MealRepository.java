package io.mrkuhne.mezo.feature.meal.repository;

import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.techcore.persistence.OwnedRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * meal HAS a date (logged_at / meal_date), so this extends the date-ordered {@link OwnedRepository}
 * family (UNLIKE {@code RecipeRepository}, which extends {@code JpaRepository} directly because a
 * recipe has no date). The inherited {@code findAllOwned} is unused here — its JPQL orders by an
 * {@code e.date} field that {@code MealEntity} does not have; callers use the owner+day finder.
 */
public interface MealRepository extends OwnedRepository<MealEntity> {

    List<MealEntity> findByCreatedByAndMealDateAndDeletedFalseOrderByLoggedAtAsc(
        UUID createdBy, LocalDate mealDate);

    Optional<MealEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);
}
