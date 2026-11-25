package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.BlockCoverageRequest;
import io.mrkuhne.mezo.api.dto.BlockCoverageResponse;
import io.mrkuhne.mezo.api.dto.CoverageDraftDay;
import io.mrkuhne.mezo.api.dto.CoverageFinding;
import io.mrkuhne.mezo.api.dto.CoverageProposal;
import io.mrkuhne.mezo.api.dto.ExerciseSubstitute;
import io.mrkuhne.mezo.api.dto.ExerciseSubstitutesResponse;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.train.config.TrainStyleProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.service.CoverageRules.Day;
import io.mrkuhne.mezo.feature.train.service.CoverageRules.Finding;
import io.mrkuhne.mezo.feature.train.service.CoverageRules.Row;
import io.mrkuhne.mezo.feature.train.service.ExerciseSubstituteRanker.Candidate;
import io.mrkuhne.mezo.feature.train.service.ExerciseSubstituteRanker.Context;
import io.mrkuhne.mezo.feature.train.service.ExerciseSubstituteRanker.Result;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.persistence.OwnershipGuard;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The block builder's coverage hints (mezo-r36n9.114, spec 2026-11-25-boop-hianyjelzes-design): the phone's draft
 * week → {@link CoverageRules} findings, each with ONE proposed exercise from the add suggestions' machinery
 * ({@link ExerciseSubstituteRanker#rankForGroup} over the catalogue rows of the missing pattern in the group — and the
 * target token where the rule names one — with the gym profile, the discomfort history and the block's goal; rows
 * already in the draft week never), placed on a draft day with the block style's prescription. Tier from the block's
 * stored muscle priorities, the source the plan evaluator reads. Pure read.
 */
@Service
@RequiredArgsConstructor
public class CoverageService {

    private final MesocycleRepository mesocycleRepository;
    private final GymProfileService gymProfileService;
    private final DiscomfortHistory discomfortHistory;
    private final CatalogAttributes catalogAttributes;
    private final TrainStyleProperties styleProps;
    private final SubstituteReads reads;

    @Transactional(readOnly = true)
    public BlockCoverageResponse coverage(AppUserEntity viewer, UUID mesoId, BlockCoverageRequest req) {
        UUID userId = viewer.getId();
        MesocycleEntity block = OwnershipGuard.ownedOrThrow(mesocycleRepository.findById(mesoId), userId);
        if ("archived".equals(block.getStatus())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error(ExerciseTechniqueService.RUN_NOT_EDITABLE).build(), HttpStatus.CONFLICT);
        }
        List<CoverageDraftDay> draft = req.getDays() == null ? List.of()
            : req.getDays().stream().filter(Objects::nonNull).toList();
        List<ExerciseCatalogEntity> all = reads.pool(userId);
        Map<UUID, ExerciseCatalogEntity> byId = all.stream()
            .collect(Collectors.toMap(ExerciseCatalogEntity::getId, Function.identity()));
        List<Day> days = draft.stream().map(d -> new Day(d.getDayIndex(), ids(d).stream().map(byId::get)
            .filter(Objects::nonNull).map(CoverageService::row).toList())).toList();

        List<Finding> findings = CoverageRules.evaluate(days, block.getMusclePriorities());
        if (findings.isEmpty()) {
            return new BlockCoverageResponse().findings(List.of());
        }

        Set<UUID> inWeek = new HashSet<>();
        draft.forEach(d -> inWeek.addAll(ids(d)));
        LocalDate today = LocalDate.now();
        GymAvailability gym = gymProfileService.availability(userId);
        // History only for rows that can ever be proposed
        List<ExerciseCatalogEntity> relevant = all.stream().filter(c -> findings.stream().anyMatch(f -> matches(f, c)))
            .toList();
        Map<UUID, PainLevel> pain = discomfortHistory.levels(userId, relevant, today);
        TrainingStyle style = TrainingStyle.fromWire(block.getTrainingStyle());

        List<CoverageFinding> out = new ArrayList<>();
        for (Finding f : findings) {
            List<ExerciseCatalogEntity> pool = all.stream().filter(c -> matches(f, c)).toList();
            List<String> muscles = f.targetTokens() != null ? f.targetTokens()
                : pool.stream().filter(c -> c.getCreatedBy() == null).map(ExerciseCatalogEntity::getMuscle)
                    .distinct().sorted().toList();
            CoverageFinding item = new CoverageFinding().group(f.group())
                .code(CoverageFinding.CodeEnum.valueOf(f.code().name())).missingPattern(f.missingPattern())
                .muscles(muscles).verdictText(f.code().verdictText()).whyText(f.code().whyText());
            Integer dayIndex = pickDay(draft, days, f.group());
            if (dayIndex != null && !pool.isEmpty()) {
                item.proposal(propose(viewer, block, all, pool, f.group(), dayIndex, draft, inWeek, gym, pain, today,
                    style));
            }
            out.add(item);
        }
        return new BlockCoverageResponse().findings(out);
    }

    /** The top-ranked row of the missing pattern, rendered like an add suggestion; null when none is eligible. */
    private CoverageProposal propose(AppUserEntity viewer, MesocycleEntity block, List<ExerciseCatalogEntity> all,
                                     List<ExerciseCatalogEntity> pool, String group, int dayIndex,
                                     List<CoverageDraftDay> draft, Set<UUID> inWeek, GymAvailability gym,
                                     Map<UUID, PainLevel> pain, LocalDate today, TrainingStyle style) {
        UUID userId = viewer.getId();
        Map<UUID, ExerciseSetEntity> topSets = reads.topSets(userId, pool);
        List<Candidate> candidates = SubstituteReads.candidates(pool, gym, pain, topSets);
        Set<UUID> dayIds = draft.stream().filter(d -> d.getDayIndex() == dayIndex).findFirst()
            .map(d -> Set.copyOf(ids(d))).orElse(Set.of());
        Set<String> painJoints = dayIndex == BlockSuggestionService.weekdayIndex(today)
            ? reads.painJointsToday(userId, today) : Set.of();
        Context ctx = new Context(block.getGoalPreset(), false, painJoints, inWeek, Set.of());
        Result ranked = ExerciseSubstituteRanker.rankForGroup(group, BlockSuggestionService.preferredType(pool, dayIds),
            candidates, ctx);
        if (ranked.suggestions().isEmpty()) {
            return null;
        }
        Result top = new Result(List.of(ranked.suggestions().get(0)), Map.of());
        CatalogAttributes.Lookup stability = style == null ? CatalogAttributes.Lookup.EMPTY
            : catalogAttributes.load(List.of(top.suggestions().get(0).id()));
        ExerciseSubstitutesResponse rendered = reads.response(viewer, all, top,
            SubstituteReads.painJointHu(painJoints, null), topSets,
            c -> BlockSuggestionService.prescription(c, style, stability.stable(c.getId()), styleProps), true);
        ExerciseSubstitute s = rendered.getSuggestions().get(0);
        return new CoverageProposal().exercise(s.getExercise()).reasonText(s.getReasonText()).signals(s.getSignals())
            .lastTopSet(s.getLastTopSet()).prescription(s.getPrescription()).dayIndex(dayIndex);
    }

    /** A catalogue row of the finding's missing pattern in its group (and target token, when the rule names one). */
    private static boolean matches(Finding f, ExerciseCatalogEntity c) {
        return f.missingPattern().equals(c.getPattern()) && f.group().equals(MuscleGroup.of(c.getMuscle()))
            && (f.targetTokens() == null || f.targetTokens().contains(c.getMuscle()));
    }

    /**
     * Among the draft days that already train the group (a primary row, or a secondary of a known-pattern row) the
     * one with the lowest {@code minutesEstimate}; none → the lowest-minutes day of the draft. Null minutes sort
     * last, ties go to the earliest weekday; an empty draft → null.
     */
    static Integer pickDay(List<CoverageDraftDay> draft, List<Day> days, String group) {
        Comparator<CoverageDraftDay> order = Comparator
            .comparing(CoverageDraftDay::getMinutesEstimate, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(CoverageDraftDay::getDayIndex);
        List<CoverageDraftDay> training = new ArrayList<>();
        for (int i = 0; i < draft.size(); i++) {
            if (days.get(i).rows().stream().anyMatch(r -> trains(r, group))) {
                training.add(draft.get(i));
            }
        }
        return (training.isEmpty() ? draft : training).stream().min(order).map(CoverageDraftDay::getDayIndex)
            .orElse(null);
    }

    private static boolean trains(Row r, String group) {
        if (r.muscle() != null && group.equals(MuscleGroup.of(r.muscle()))) {
            return true;
        }
        return r.pattern() != null && r.secondaryMuscles() != null
            && r.secondaryMuscles().stream().anyMatch(s -> group.equals(MuscleGroup.of(s)));
    }

    private static List<UUID> ids(CoverageDraftDay d) {
        return d.getCatalogIds() == null ? List.of() : d.getCatalogIds().stream().filter(Objects::nonNull).toList();
    }

    private static Row row(ExerciseCatalogEntity c) {
        return new Row(c.getMuscle(), c.getPattern(), c.getSecondaryMuscles(), c.getType());
    }
}
