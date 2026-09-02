package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.api.dto.MesoPlanGenerateRequest;
import io.mrkuhne.mezo.api.dto.MesoPlanGenerateResponse;
import io.mrkuhne.mezo.api.dto.MesoTemplateUpsertRequest;
import io.mrkuhne.mezo.api.dto.VolumeBaseline;
import io.mrkuhne.mezo.feature.train.config.MesoPlanProperties;
import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * POST /api/train/meso-plans/generate — the single Hypertrophy model of the wizard redesign.
 * Skeleton (pure) → deterministic fill (pure) → optional LLM pick through the train-owned
 * {@link MesoPlanLlm} port (absent when the AI/companion switch is off) → merge (pure) → a
 * {@code MesoTemplateUpsertRequest} the FE posts back to {@code createMesoTemplate} unchanged.
 * Nothing is persisted here.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MesoPlanGeneratorService {

    static final String GOAL_PRESET = "hypertrophy";
    static final String RATIONALE_DETERMINISTIC =
        "Determinisztikus kiosztás: a split a napszámból, a szettek a MEV/MAV/MRV sávokból — bármit cserélhetsz.";

    private final ExerciseCatalogRepository catalogRepository;
    private final VolumeProperties volumeProperties;
    private final MesoPlanProperties props;
    private final ObjectProvider<MesoPlanLlm> llm;

    @Transactional(readOnly = true)
    public MesoPlanGenerateResponse generate(UUID user, MesoPlanGenerateRequest req) {
        Map<String, String> priorities = PriorityTier.normalize(req.getPriorities());
        MesoPlanSkeleton.Skeleton skeleton = MesoPlanSkeleton.build(
            List.copyOf(req.getDaysOfWeek()), req.getWeeks(), priorities, volumeProperties.baselines());
        List<MesoPlanFiller.Candidate> candidates = candidates(user);
        List<MesoPlanFiller.FilledDay> days = MesoPlanFiller.fill(skeleton, candidates, props);

        boolean llmUsed = false;
        String rationale = RATIONALE_DETERMINISTIC;
        MesoPlanLlm port = llm.getIfAvailable();
        if (port != null) {
            Optional<MesoPlanLlm.Suggestion> s = port.propose(toRequest(skeleton, candidates, priorities, req.getGoalText()));
            if (s.isPresent()) {
                days = MesoPlanMerger.merge(skeleton, days, s.get(), candidates, props);
                llmUsed = true;
                if (s.get().rationale() != null && !s.get().rationale().isBlank()) {
                    rationale = s.get().rationale().strip();
                }
            }
        }
        return MesoPlanGenerateResponse.builder()
            .template(toTemplate(skeleton, days, priorities, req))
            .rationale(rationale)
            .llmUsed(llmUsed)
            .build();
    }

    /** Master rows + this user's own catalog rows; soft-deleted rows are already filtered by the entity. */
    private List<MesoPlanFiller.Candidate> candidates(UUID user) {
        List<MesoPlanFiller.Candidate> out = new ArrayList<>();
        for (ExerciseCatalogEntity e : catalogRepository.findAllByOrderByMuscleAscNameAsc()) {
            if (e.getCreatedBy() != null && !user.equals(e.getCreatedBy())) continue;
            if ("plyo".equals(e.getType())) continue;
            String group = MuscleGroup.of(e.getMuscle());
            if (!volumeProperties.baselines().containsKey(group)) continue;
            out.add(new MesoPlanFiller.Candidate(e.getId(), e.getName(), e.getMuscle(), group, e.getType(),
                e.getStim() == null ? 0.5 : e.getStim().doubleValue(),
                e.getFatigue() == null ? 0.5 : e.getFatigue().doubleValue()));
        }
        return List.copyOf(out);
    }

    private static MesoPlanLlm.Request toRequest(MesoPlanSkeleton.Skeleton s, List<MesoPlanFiller.Candidate> candidates,
                                                 Map<String, String> priorities, String goalText) {
        List<MesoPlanLlm.FramedDay> framed = s.days().stream()
            .filter(d -> !d.muscles().isEmpty())
            .map(d -> {
                Map<String, Integer> by = new LinkedHashMap<>();
                d.muscles().forEach(m -> by.put(m.group(), m.sets()));
                return new MesoPlanLlm.FramedDay(d.day(), d.type(), by);
            }).toList();
        return new MesoPlanLlm.Request(framed, candidates, priorities, goalText == null ? "" : goalText.strip());
    }

    private MesoTemplateUpsertRequest toTemplate(MesoPlanSkeleton.Skeleton s, List<MesoPlanFiller.FilledDay> days,
                                                 Map<String, String> priorities, MesoPlanGenerateRequest req) {
        Map<String, VolumeBaseline> baselines = new LinkedHashMap<>();
        volumeProperties.baselines().forEach((g, b) -> baselines.put(g, VolumeBaseline.builder()
            .name("RP guidelines · intermediate").mev(b.mev()).mav(b.mav()).mrv(b.mrv()).build()));
        List<MesoDayInput> dayInputs = new ArrayList<>(7);
        for (int i = 0; i < s.days().size(); i++) {
            MesoPlanSkeleton.DayFrame frame = s.days().get(i);
            MesoPlanFiller.FilledDay filled = days.get(i);
            if ("Rest".equals(frame.type())) {
                dayInputs.add(MesoDayInput.builder().day(frame.day()).type("Rest").muscle("").note("Pihenőnap").exercises(List.of()).build());
                continue;
            }
            String accent = frame.muscles().isEmpty() ? "" : frame.muscles().get(0).group();
            dayInputs.add(MesoDayInput.builder().day(frame.day()).type(frame.type()).muscle(accent)
                .exercises(filled.picks().stream().map(this::toExercise).toList()).build());
        }
        String title = "Hypertrophy · " + season(LocalDate.now());
        return MesoTemplateUpsertRequest.builder()
            .title(title).shortTitle("Hypertrophy").goal("Izomtömeg építés").goalPreset(GOAL_PRESET)
            .musclePriorities(priorities.isEmpty() ? null : priorities)
            .weeks(req.getWeeks()).split(s.splitLabel()).style("RP · " + req.getWeeks() + " hét")
            .phaseCurve(s.phaseCurve().stream().map(MesoTemplateUpsertRequest.PhaseCurveEnum::fromValue).toList())
            .notes(req.getGoalText() == null || req.getGoalText().isBlank() ? null : req.getGoalText().strip())
            .volumePerMuscle(baselines)
            .days(dayInputs)
            .build();
    }

    private GymExerciseInput toExercise(MesoPlanFiller.Pick p) {
        boolean compound = "compound".equals(p.candidate().type());
        return GymExerciseInput.builder()
            .name(p.candidate().name()).muscle(p.candidate().muscle()).catalogId(p.candidate().id())
            .warmupSets(compound ? props.compoundWarmup() : props.isolationWarmup())
            .workingSets(Math.max(1, Math.min(10, p.workingSets())))
            .repMin(compound ? props.compoundRepMin() : props.isolationRepMin())
            .repMax(compound ? props.compoundRepMax() : props.isolationRepMax())
            .targetRIR(props.targetRir())
            .type(GymExerciseInput.TypeEnum.fromValue(p.candidate().type()))
            .countsTowardVolume(true)
            .build();
    }

    static String season(LocalDate d) {
        return switch (d.getMonthValue()) {
            case 12, 1, 2 -> "Tél";
            case 3, 4, 5 -> "Tavasz";
            case 6, 7, 8 -> "Nyár";
            default -> "Ősz";
        };
    }
}
