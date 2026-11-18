package io.mrkuhne.mezo.feature.train.mapper;

import io.mrkuhne.mezo.api.dto.WeekProposal;
import io.mrkuhne.mezo.api.dto.WeekProposalLine;
import io.mrkuhne.mezo.api.dto.WeekProposalMuscle;
import io.mrkuhne.mezo.api.dto.WeekProposalReason;
import io.mrkuhne.mezo.feature.train.entity.MesoWeekProposalEntity;
import io.mrkuhne.mezo.feature.train.entity.json.WeekProposalGroupJson;
import io.mrkuhne.mezo.feature.train.entity.json.WeekProposalLineJson;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import org.springframework.stereotype.Component;

/**
 * Stored weekly proposal ({@link MesoWeekProposalEntity}, its jsonb lines and per-muscle groups) → the
 * {@code WeekProposal} contract (mezo-r36n9.78). Hand-written: every crossing is a loosely typed jsonb string
 * to a contract enum, and the muscles need the line counts.
 *
 * <ul>
 *   <li>Line {@code from}/{@code to}: a weight line's kg ({@code fromKg}/{@code toKg}), else the integer
 *       sets / reps.</li>
 *   <li>{@code muscles[]}: one per stored group, {@code lineCount} = that group's lines (every kind). A row
 *       stored before S3 has no groups: its muscles are derived from the lines alone — the tier comes from
 *       the run's priorities (passed in), no band, and setsBefore/setsAfter sum only the changed
 *       exercises' set lines (the untouched exercises were never recorded).</li>
 *   <li>Reason codes the contract enum does not know are dropped, never an error.</li>
 * </ul>
 */
@Component
public class WeekProposalMapper {

    private static final Map<String, WeekProposalReason> REASONS = Arrays.stream(WeekProposalReason.values())
        .collect(java.util.stream.Collectors.toMap(WeekProposalReason::getValue, r -> r));

    /**
     * @param mode   the configured weekly-review mode ({@code auto|manual})
     * @param tierOf the run's tier of a muscle group, lower-case — used only for rows without stored groups
     */
    public WeekProposal toDto(MesoWeekProposalEntity entity, String mode, Function<String, String> tierOf) {
        List<WeekProposalLineJson> lines = entity.getLines() == null ? List.of() : entity.getLines();
        return new WeekProposal()
            .id(entity.getId())
            .mesocycleId(entity.getMesocycleId())
            .week(entity.getWeek())
            .kind(WeekProposal.KindEnum.fromValue(entity.getKind()))
            .status(WeekProposal.StatusEnum.fromValue(entity.getStatus()))
            .mode(WeekProposal.ModeEnum.fromValue(mode))
            .createdAt(odt(entity.getCreatedAt()))
            .decidedAt(odt(entity.getDecidedAt()))
            .lines(lines.stream().map(WeekProposalMapper::line).toList())
            .muscles(entity.getGroups() != null
                ? entity.getGroups().stream().map(g -> muscle(g, lines)).toList()
                : derivedMuscles(lines, tierOf));
    }

    private static WeekProposalLine line(WeekProposalLineJson l) {
        boolean weight = "weight".equals(l.kind());
        return new WeekProposalLine()
            .id(l.id())
            .exerciseId(l.exerciseId())
            .exerciseName(l.exerciseName())
            .dayIndex(l.dayIndex())
            .dayName(l.dayName())
            .muscleGroup(l.muscleGroup())
            .kind(WeekProposalLine.KindEnum.fromValue(l.kind()))
            .from(weight ? l.fromKg() : number(l.from()))
            .to(weight ? l.toKg() : number(l.to()))
            .reasons(reasons(l.reasons()))
            .decision(l.decision() == null ? null : WeekProposalLine.DecisionEnum.fromValue(l.decision()));
    }

    private static WeekProposalMuscle muscle(WeekProposalGroupJson g, List<WeekProposalLineJson> lines) {
        return new WeekProposalMuscle()
            .muscle(g.muscle())
            .tier(WeekProposalMuscle.TierEnum.fromValue(g.tier()))
            .bandLow(g.bandLow())
            .bandHigh(g.bandHigh())
            .sportAdjusted(g.sportAdjusted())
            .setsBefore(g.setsBefore())
            .setsAfter(g.setsAfter())
            .lineCount((int) lines.stream().filter(l -> g.muscle().equals(l.muscleGroup())).count())
            .reasons(reasons(g.reasons()));
    }

    /** Pre-S3 rows: one muscle per group that has lines, from the lines alone. */
    private static List<WeekProposalMuscle> derivedMuscles(List<WeekProposalLineJson> lines,
                                                           Function<String, String> tierOf) {
        Map<String, List<WeekProposalLineJson>> byGroup = new LinkedHashMap<>();
        lines.stream().filter(l -> l.muscleGroup() != null)
            .forEach(l -> byGroup.computeIfAbsent(l.muscleGroup(), k -> new java.util.ArrayList<>()).add(l));
        return byGroup.entrySet().stream().map(e -> {
            List<WeekProposalLineJson> setLines = e.getValue().stream()
                .filter(l -> WeekProposalLineJson.KIND_SETS.equals(l.kind())).toList();
            return new WeekProposalMuscle()
                .muscle(e.getKey())
                .tier(WeekProposalMuscle.TierEnum.fromValue(tierOf.apply(e.getKey())))
                .sportAdjusted(false)
                .setsBefore(setLines.stream().map(WeekProposalLineJson::from).filter(Objects::nonNull)
                    .mapToInt(Integer::intValue).sum())
                .setsAfter(setLines.stream().map(WeekProposalLineJson::to).filter(Objects::nonNull)
                    .mapToInt(Integer::intValue).sum())
                .lineCount(e.getValue().size())
                .reasons(reasons(e.getValue().stream()
                    .flatMap(l -> l.reasons() == null ? java.util.stream.Stream.empty() : l.reasons().stream())
                    .distinct().toList()));
        }).toList();
    }

    private static List<WeekProposalReason> reasons(List<String> codes) {
        return codes == null ? List.of()
            : codes.stream().map(REASONS::get).filter(Objects::nonNull).distinct().toList();
    }

    private static BigDecimal number(Integer value) {
        return value == null ? null : BigDecimal.valueOf(value);
    }

    private static OffsetDateTime odt(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }
}
