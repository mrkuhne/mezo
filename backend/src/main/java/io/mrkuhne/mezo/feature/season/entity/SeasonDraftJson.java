package io.mrkuhne.mezo.feature.season.entity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * A season as the owner plans it — the contract's {@code SeasonDraft} as a plain record, used both as the
 * domain input of the preview / lifecycle services and as the {@code season.draft} / {@code season_revision.draft}
 * jsonb snapshot. Plain record, no Jackson/Hibernate annotations (the {@code @JdbcTypeCode(SqlTypes.JSON)} on the
 * field serializes it via the app {@code ObjectMapper}). Weekdays are 0 = hétfő .. 6 = vasárnap.
 */
public record SeasonDraftJson(
    String title,
    String trajectory,          // cut | bulk | maintain
    BigDecimal targetWeightKg,  // cut / bulk only
    BigDecimal ratePctPerWeek,  // weekly pace in %BW (alternative to kgPerWeek)
    BigDecimal kgPerWeek,       // weekly pace in kg, unsigned
    LocalDate startDate,
    Integer weeks,
    List<Integer> gymDays,
    String gymTime,
    List<SportSlot> sport,
    SleepAnchor sleepAnchor,
    List<UUID> allowedRecipeIds,
    Block block
) {

    public record SportSlot(Integer dayOfWeek, String time, Integer durationMin, String sport) {
    }

    public record SleepAnchor(String anchor, String time) {
    }

    public record Block(String source, UUID mesocycleId, UUID templateId) {
    }

    /** {@code startDate + weeks*7 - 1} — the season's last day. */
    public LocalDate endDate() {
        return startDate.plusDays(weeks * 7L - 1);
    }

    public List<Integer> gymDaysOrEmpty() {
        return gymDays == null ? List.of() : gymDays;
    }

    public List<SportSlot> sportOrEmpty() {
        return sport == null ? List.of() : sport;
    }

    public List<UUID> allowedOrEmpty() {
        return allowedRecipeIds == null ? List.of() : allowedRecipeIds;
    }
}
