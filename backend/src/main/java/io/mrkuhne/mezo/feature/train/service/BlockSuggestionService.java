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
import java.util.LinkedHashMap;
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
 * {@code add} ranks only the chosen coarse group's catalogue rows against a synthetic outgoing exercise. Muscles
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
        List<ExerciseCatalogEntity> pool;
        Candidate out;
        if (replace) {
            pool = all;
            out = replaceOut(all, req.getOutgoing());
        } else {
            String group = req.getMuscle().strip();
            pool = all.stream().filter(c -> group.equals(MuscleGroup.of(c.getMuscle()))).toList();
            out = addOut(pool, group, inDay);
        }

        // History only for rows that can ever rank: the outgoing muscle's body region.
        String region = ExerciseSubstituteRanker.region(out.muscle());
        List<ExerciseCatalogEntity> relevant = pool.stream()
            .filter(c -> Objects.equals(region, ExerciseSubstituteRanker.region(c.getMuscle())))
            .toList();
        GymAvailability gym = gymProfileService.availability(userId);
        Map<UUID, PainLevel> pain = discomfortHistory.levels(userId, pool, today);
        Map<UUID, ExerciseSetEntity> topSets = reads.topSets(userId, relevant);
        List<Candidate> candidates = SubstituteReads.candidates(pool, gym, pain, topSets);

        boolean editsToday = req.getDayIndex() != null && req.getDayIndex() == weekdayIndex(today);
        Set<String> painJoints = editsToday ? reads.painJointsToday(userId, today) : Set.of();
        Context ctx = new Context(block.getGoalPreset(), false, painJoints, inDay, underBandGroups(userId, mesoId));
        Result result = ExerciseSubstituteRanker.rank(out, candidates, ctx);

        TrainingStyle style = TrainingStyle.fromWire(block.getTrainingStyle());
        CatalogAttributes.Lookup stability = style == null ? CatalogAttributes.Lookup.EMPTY
            : catalogAttributes.load(result.suggestions().stream().map(Ranked::id).toList());
        return reads.response(viewer, pool, result, SubstituteReads.painJointHu(painJoints, out.joints()), topSets,
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

    /**
     * The synthetic outgoing exercise of an add: the group's most common catalogue token among the day's rows
     * (else the group's first catalogue token), a compound unless the day already has a compound of that group,
     * every attribute null. {@code pool} is already the group's rows.
     */
    static Candidate addOut(List<ExerciseCatalogEntity> pool, String group, Set<UUID> inDay) {
        List<ExerciseCatalogEntity> dayRows = pool.stream().filter(c -> inDay.contains(c.getId())).toList();
        Map<String, Integer> counts = new LinkedHashMap<>(); // first-seen order breaks ties
        dayRows.forEach(c -> counts.merge(c.getMuscle(), 1, Integer::sum));
        String token = counts.entrySet().stream()
            .reduce((a, b) -> b.getValue() > a.getValue() ? b : a).map(Map.Entry::getKey)
            .orElse(pool.isEmpty() ? group : pool.get(0).getMuscle());
        String type = dayRows.stream().anyMatch(c -> "compound".equals(c.getType())) ? "isolation" : "compound";
        return new Candidate(null, token, type, null, null, null, null, null, null, null, null,
            false, true, PainLevel.NONE, false);
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
        GymExerciseJson s = StyleStamper.stamp(base, style, stable, props);
        if (s == base) { // the stamper left it alone: plyo / not counting toward volume
            return null;
        }
        return new SuggestionPrescription().workingSets(s.workingSets()).repMin(s.repMin()).repMax(s.repMax())
            .targetRIR(s.targetRir()).restSec(s.restSec());
    }
}
