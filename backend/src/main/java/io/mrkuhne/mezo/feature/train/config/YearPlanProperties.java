package io.mrkuhne.mezo.feature.train.config;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Tunables of the Éves terv (mezo-r36n9.113), bound from {@code mezo.year-plan}. {@code kindGroups} maps a block
 * kind (upper|lower) to its landmark groups; {@code pairs} is the allowed two-group focus combinations, each pair
 * within one kind.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.year-plan")
public record YearPlanProperties(
    @Min(1) int yearWeeks,
    @Min(1) int defaultBlockWeeks,
    @Min(1) int defaultConsolidationWeeks,
    @Min(0) int lateToleranceDays,
    @Min(0) int linkWindowDays,
    @NotNull @NotEmpty Map<String, List<String>> kindGroups,
    @NotNull @NotEmpty List<List<String>> pairs) {

    public YearPlanProperties {
        kindGroups = kindGroups == null ? Map.of() : Map.copyOf(kindGroups);
        pairs = pairs == null ? List.of() : pairs.stream().map(List::copyOf).toList();
    }

    /** Each pair holds 2 distinct groups of the same kind (binding fails otherwise). */
    @AssertTrue(message = "every year-plan pair must hold 2 distinct groups of one kind")
    public boolean isPairsValid() {
        return pairs.stream().allMatch(pair -> pair.size() == 2
            && !pair.get(0).equals(pair.get(1))
            && kindGroups.values().stream().anyMatch(g -> g.containsAll(pair)));
    }
}
