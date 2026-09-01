package io.mrkuhne.mezo.feature.meal.repository;

import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.techcore.persistence.OwnedRepository;
import java.math.BigDecimal;
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

    /** Weekly review {@code stale} probe (mezo-p2tr): the most recently CREATED meal inside the
     *  week — compared against the review's {@code generatedAt}, not its own {@code mealDate}. */
    Optional<MealEntity> findFirstByCreatedByAndDeletedFalseAndMealDateBetweenOrderByCreatedAtDesc(
            UUID createdBy, LocalDate from, LocalDate to);

    /** The deterministic scores (mezo-yta) of the SCORED meals in a closed day window — the Fuel
     *  week's "AI-atlag" (mezo-d20.7.2). Projects the scalar instead of the aggregate: no item
     *  walk, and pre-scoring / unscored rows are filtered out in SQL so an empty list genuinely
     *  means "nothing to average" (the endpoint then returns null, not 0). */
    @Query("select e.score from MealEntity e where e.createdBy = :createdBy and e.deleted = false "
        + "and e.mealDate between :from and :to and e.score is not null")
    List<BigDecimal> findScoresBetween(@Param("createdBy") UUID createdBy,
        @Param("from") LocalDate from, @Param("to") LocalDate to);

    /**
     * Meals with their item lines in {@code [from, to]}, one query, no N+1 (Karakter round 2 —
     * the character read layer needs every day's macro/NOVA aggregate over an 8-week window).
     * {@code distinct} is required because the fetch join multiplies the meal row per item.
     */
    @Query("select distinct m from MealEntity m left join fetch m.items "
        + "where m.createdBy = :createdBy and m.deleted = false "
        + "and m.mealDate between :from and :to order by m.mealDate asc, m.loggedAt asc")
    List<MealEntity> findWithItemsBetween(@Param("createdBy") UUID createdBy,
                                          @Param("from") LocalDate from,
                                          @Param("to") LocalDate to);
}
