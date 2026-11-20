package io.mrkuhne.mezo.feature.train.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Tunables of the hypertrophy plan generator (mezo-meso-plan). Bound from {@code mezo.meso-plan}.
 * The split catalogue ({@code splits}, per training-day count) is configurable; every catalogued split must keep
 * each trained group ≥2×/week and ≤ session-cap sets/session, enforced by {@code SplitCatalogTest} over the
 * shipped yml (binding only checks shape: known types, one type per training day).
 *
 * <p>{@code defaultTrainingStyle} (mezo-r36n9.115): the training style a generated block carries, whose
 * style row then stamps every exercise (rep range, reserve, rest) instead of the rep / RIR frames here;
 * blank or absent = the unstyled block of before.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.meso-plan")
public record MesoPlanProperties(
    @Min(1) @Max(4) int maxExercisesPerGroupPerDay,
    @Min(1) @Max(30) int compoundRepMin,
    @Min(1) @Max(30) int compoundRepMax,
    @Min(1) @Max(30) int isolationRepMin,
    @Min(1) @Max(30) int isolationRepMax,
    @Min(0) @Max(5) int targetRir,
    @Min(0) @Max(5) int compoundWarmup,
    @Min(0) @Max(5) int isolationWarmup,
    @Pattern(regexp = "^\\s*(balanced|volume|heavy|allout)?\\s*$") String defaultTrainingStyle,
    Map<Integer, List<@Valid Split>> splits) {

    /** Day types a split may use (the skeleton's group table keys). */
    public static final Set<String> SPLIT_TYPES = Set.of("Full", "Upper", "Lower", "Push", "Pull", "Legs");

    /**
     * One catalogued split for a training-day count: stable {@code key}, Hungarian {@code label}, and the day
     * {@code types} in week order. Binding fails on an unknown type (an @AssertTrue check); the
     * length-equals-day-count rule is checked by the enclosing record.
     */
    public record Split(@NotBlank String key, @NotBlank String label, @NotEmpty List<String> types) {
        public Split {
            if (types != null) types = List.copyOf(types);
        }

        @AssertTrue(message = "split types must be Full|Upper|Lower|Push|Pull|Legs")
        public boolean isTypesKnown() {
            return types == null || SPLIT_TYPES.containsAll(types);
        }
    }

    public MesoPlanProperties {
        splits = splits == null ? Map.of() : Map.copyOf(splits);
    }

    /** Every catalogued split has exactly one type per training day of its count. */
    @AssertTrue(message = "a split's type count must equal the training-day count it is catalogued under")
    public boolean isSplitLengthsMatchDayCount() {
        return splits.entrySet().stream().allMatch(e ->
            e.getValue().stream().allMatch(sp -> sp.types() == null || sp.types().size() == e.getKey()));
    }

    /** The configured default style's wire value, or null when blank / absent (unstyled). */
    public String defaultTrainingStyleOrNull() {
        return defaultTrainingStyle == null || defaultTrainingStyle.isBlank() ? null : defaultTrainingStyle.strip();
    }
}
