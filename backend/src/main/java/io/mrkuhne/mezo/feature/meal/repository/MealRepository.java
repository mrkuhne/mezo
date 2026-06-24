package io.mrkuhne.mezo.feature.meal.repository;

import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.techcore.persistence.OwnedRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * meal HAS a date (logged_at / meal_date), so this extends the date-ordered {@link OwnedRepository}
 * family (UNLIKE {@code RecipeRepository}, which extends {@code JpaRepository} directly because a
 * recipe has no date). Callers use the owner+day finder; {@code findAllOwned} is unused here.
 *
 * <p>{@code findAllOwned} is OVERRIDDEN: the inherited JPQL orders by an {@code e.date} field that
 * {@code MealEntity} does not have (it carries {@code mealDate} / {@code loggedAt} instead). Spring
 * Boot 4 / Hibernate 7 validate repository queries EAGERLY at context startup, so the inherited
 * {@code order by e.date} would fail bean creation even though nothing calls it — the override gives
 * the family contract a {@code MealEntity}-valid query (ordered by day, then logged instant).
 */
public interface MealRepository extends OwnedRepository<MealEntity> {

    @Override
    @Query("select e from MealEntity e where e.createdBy = :createdBy and e.deleted = false "
        + "order by e.mealDate asc, e.loggedAt asc")
    List<MealEntity> findAllOwned(@Param("createdBy") UUID createdBy);

    List<MealEntity> findByCreatedByAndMealDateAndDeletedFalseOrderByLoggedAtAsc(
        UUID createdBy, LocalDate mealDate);

    Optional<MealEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);
}
