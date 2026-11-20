package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.BlockExerciseSuggestionsRequest;
import io.mrkuhne.mezo.api.dto.BlockSuggestionOutgoing;
import io.mrkuhne.mezo.api.dto.ExerciseSubstitutesResponse;
import io.mrkuhne.mezo.api.dto.MuscleEvaluation;
import io.mrkuhne.mezo.api.dto.SuggestionPrescription;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.train.config.TrainStyleProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.json.GymExerciseJson;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.service.ExerciseSubstituteRanker.Candidate;
import io.mrkuhne.mezo.feature.train.service.ExerciseSubstituteRanker.Context;
import io.mrkuhne.mezo.feature.train.service.ExerciseSubstituteRanker.Ranked;
import io.mrkuhne.mezo.feature.train.service.ExerciseSubstituteRanker.Result;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.persistence.OwnershipGuard;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The block day editor's add/swap suggestions (mezo-r36n9.116, spec 2026-11-20 §6.3): the workout swap's
 * {@link ExerciseSubstituteRanker} fed from a block's draft day instead of a running workout. The block's goal,
 * the gym profile and the discomfort history always apply; today's check-in pain only when the edited day is
 * today's weekday; nobody is "sore now" while planning. {@code replace} ranks alternatives to the outgoing row;
 * {@code add} ranks every catalogue row of the chosen coarse group ({@link ExerciseSubstituteRanker#rankForGroup}). Muscles
 * under their weekly band (the run evaluation's own numbers) are explained, never reordered. Each suggestion
 * carries the block style's prescription, computed read-only with {@link StyleStamper}. Pure read.
 */
@Service
@RequiredArgsConstructor
public class BlockSuggestionService {

    static final String REQUEST_INVALID = "TRAIN_SUGGESTIONS_REQUEST_INVALID";

    /** The base a new row starts from before the style stamps it (the builder's 3 × 8–12 · 2 tartalék). */
    private static final int BASE_SETS = 3;
    private static final int BASE_REP_MIN = 8;
    private static final int BASE_REP_MAX = 12;
    private static final int BASE_RIR = 2;

    private final MesocycleRepository mesocycleRepository;
    private final GymProfileService gymProfileService;
    private final DiscomfortHistory discomfortHistory;
    private final MesoPlanEvaluateService mesoPlanEvaluateService;
    private final CatalogAttributes catalogAttributes;
    private final TrainStyleProperties styleProps;
    private final SubstituteReads reads;

    @Transactional(readOnly = true)
    public ExerciseSubstitutesResponse suggestions(AppUserEntity viewer, UUID mesoId,
                                                   BlockExerciseSuggestionsRequest req) {
        UUID userId = viewer.getId();
        MesocycleEntity block = OwnershipGuard.ownedOrThrow(mesocycleRepository.findById(mesoId), userId);
        if ("archived".equals(block.getStatus())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error(ExerciseTechniqueService.RUN_NOT_EDITABLE).build(), HttpStatus.CONFLICT);
        }
        boolean replace = req.getMode() == BlockExerciseSuggestionsRequest.ModeEnum.REPLACE;
        if (replace ? req.getOutgoing() == null : req.getMuscle() == null || req.getMuscle().isBlank()) {
            throw new SystemRuntimeErrorException(SystemMessage.error(REQUEST_INVALID).build(), HttpStatus.BAD_REQUEST);
        }
        LocalDate today = LocalDate.now();
        Set<UUID> inDay = req.getDayCatalogIds() == null ? Set.of()
            : req.getDayCatalogIds().stream().filter(Objects::nonNull).collect(Collectors.toSet());

        List<ExerciseCatalogEntity> all = reads.pool(userId);
        String group = replace ? null : req.getMuscle().strip();
        // Add: the chosen group's rows only — the suggestions and the full list filtered to that muscle.
        List<ExerciseCatalogEntity> pool = replace ? all
            : all.stream().filter(c -> group.equals(MuscleGroup.of(c.getMuscle()))).toList();
        Candidate out = replace ? replaceOut(all, req.getOutgoing()) : null;

        // History only for rows that can ever rank: the outgoing muscle's body region, or the whole group.
        String region = replace ? ExerciseSubstituteRanker.region(out.muscle()) : null;
        List<ExerciseCatalogEntity> relevant = !replace ? pool : pool.stream()
            .filter(c -> Objects.equals(region, ExerciseSubstituteRanker.region(c.getMuscle())))
            .toList();
        GymAvailability gym = gymProfileService.availability(userId);
        Map<UUID, PainLevel> pain = discomfortHistory.levels(userId, pool, today);
        Map<UUID, ExerciseSetEntity> topSets = reads.topSets(userId, relevant);
        List<Candidate> candidates = SubstituteReads.candidates(pool, gym, pain, topSets);

        boolean editsToday = req.getDayIndex() != null && req.getDayIndex() == weekdayIndex(today);
        Set<String> painJoints = editsToday ? reads.painJointsToday(userId, today) : Set.of();
        Context ctx = new Context(block.getGoalPreset(), false, painJoints, inDay, underBandGroups(userId, mesoId));
        Result result = replace ? ExerciseSubstituteRanker.rank(out, candidates, ctx)
            : ExerciseSubstituteRanker.rankForGroup(group, preferredType(pool, inDay), candidates, ctx);

        TrainingStyle style = TrainingStyle.fromWire(block.getTrainingStyle());
        CatalogAttributes.Lookup stability = style == null ? CatalogAttributes.Lookup.EMPTY
            : catalogAttributes.load(result.suggestions().stream().map(Ranked::id).toList());
        return reads.response(viewer, pool, result, SubstituteReads.painJointHu(painJoints, out == null ? null : out.joints()), topSets,
            c -> prescription(c, style, stability.stable(c.getId()), styleProps));
    }

    /** 0 = Monday (Hét) … 6 = Sunday (Vas), the request's {@code dayIndex}. */
    static int weekdayIndex(LocalDate date) {
        return date.getDayOfWeek().getValue() - 1;
    }

    /** The catalogue row of the outgoing exercise; without one (custom / unknown id) a custom candidate. */
    private static Candidate replaceOut(List<ExerciseCatalogEntity> pool, BlockSuggestionOutgoing o) {
        ExerciseCatalogEntity row = o.getCatalogId() == null ? null
            : pool.stream().filter(c -> c.getId().equals(o.getCatalogId())).findFirst().orElse(null);
        return row != null
            ? SubstituteReads.candidate(row, true, PainLevel.NONE, false)
            : new Candidate(null, o.getMuscle(), o.getType(), null, null, null, null, null, null, null, null,
                true, true, PainLevel.NONE, false);
    }

    /** An add fills the slot with a compound unless the day already has a compound of the group ({@code pool}). */
    static String preferredType(List<ExerciseCatalogEntity> pool, Set<UUID> inDay) {
        return pool.stream().anyMatch(c -> inDay.contains(c.getId()) && "compound".equals(c.getType()))
            ? "isolation" : "compound";
    }

    /** Coarse groups whose weekly sets in the stored block are below their band's low end (the run evaluation). */
    private Set<String> underBandGroups(UUID userId, UUID mesoId) {
        Set<String> out = new HashSet<>();
        for (MuscleEvaluation m : mesoPlanEvaluateService.evaluateRun(userId, mesoId).getMuscles()) {
            if (m.getWeeklySets() != null && m.getBand() != null && m.getBand().getLow() != null
                && m.getWeeklySets() < m.getBand().getLow()) {
                out.add(m.getMuscle());
            }
        }
        return out;
    }

    /** The style's prescription for a new row of this exercise; null on an unstyled block or an unstamped row. */
    static SuggestionPrescription prescription(ExerciseCatalogEntity c, TrainingStyle style, boolean stable,
                                               TrainStyleProperties props) {
        if (style == null) {
            return null;
        }
        GymExerciseJson base = new GymExerciseJson(null, c.getName(), c.getMuscle(), null, BASE_SETS, BASE_REP_MIN,
            BASE_REP_MAX, BASE_RIR, null, c.getType(), null, c.getId(), null, null, null, null, null, null, null);
        // The rows the stamper never styles (spec §11.3): not counting toward volume, or no style class (plyo).
        if (!base.countsTowardVolume() || ExerciseClass.of(base.type(), stable) == null) {
            return null;
        }
        GymExerciseJson s = StyleStamper.stamp(base, style, stable, props);
        return new SuggestionPrescription().workingSets(s.workingSets()).repMin(s.repMin()).repMax(s.repMax())
            .targetRIR(s.targetRir()).restSec(s.restSec());
    }
}
