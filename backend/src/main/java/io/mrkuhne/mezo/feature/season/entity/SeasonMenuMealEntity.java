package io.mrkuhne.mezo.feature.season.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * One planned meal of a menu week: the day's {@code ordinal}-th window of {@code slot} (the Étel day plan's own window
 * identity), a recipe scaled to the window's budget, or — when no allowed recipe fits — an ingredient tip in
 * {@code name} with no recipe.
 */
@Getter
@Setter
@Entity
@Table(name = "season_menu_meal")
@SQLDelete(sql = "update season_menu_meal set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class SeasonMenuMealEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "week_id", nullable = false)
    private UUID weekId;

    @Column(name = "meal_date", nullable = false)
    private LocalDate mealDate;

    /** edzesnap | sport | edzes_sport | pihenonap — the day's kind when the meal was planned. */
    @Column(name = "day_kind", nullable = false, length = 12)
    private String dayKind = "pihenonap";

    /** The sport's own name on a sport day (e.g. "röplabda"). */
    @Column(name = "sport_name", length = 40)
    private String sportName;

    /** breakfast | lunch | dinner | snack. */
    @Column(name = "slot", nullable = false, length = 10)
    private String slot;

    @JdbcTypeCode(SqlTypes.SMALLINT)
    @Column(name = "ordinal", nullable = false)
    private Integer ordinal = 1;

    /** The window's clock time, owner-zone minutes since midnight (the day's order). */
    @JdbcTypeCode(SqlTypes.SMALLINT)
    @Column(name = "at_min", nullable = false)
    private Integer atMin = 0;

    @Column(name = "label", nullable = false, length = 60)
    private String label;

    @Column(name = "pre_session", nullable = false)
    private boolean preSession;

    @Column(name = "recipe_id")
    private UUID recipeId;

    @Column(name = "name", nullable = false, length = 200)
    private String name;

    @Column(name = "servings", precision = 4, scale = 2)
    private BigDecimal servings;

    @Column(name = "kcal", nullable = false)
    private Integer kcal;

    /** The window's own kcal budget the portion was scaled to (a swap scales the new recipe to it). */
    @Column(name = "budget_kcal", nullable = false)
    private Integer budgetKcal;

    @Column(name = "protein_g")
    private Integer proteinG;

    /** He chose this one himself (a swap): a re-fit keeps the recipe and only re-scales it. */
    @Column(name = "locked", nullable = false)
    private boolean locked;

    /** A mid-week re-fit moved this meal. */
    @Column(name = "changed", nullable = false)
    private boolean changed;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
