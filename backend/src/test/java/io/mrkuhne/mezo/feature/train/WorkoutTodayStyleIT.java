package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.PrescribedSet;
import io.mrkuhne.mezo.api.dto.StyleOverride;
import io.mrkuhne.mezo.api.dto.TodayExercise;
import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.VolumeRecomputeJson;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.service.TrainService;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;
import tools.jackson.databind.node.StringNode;

/**
 * The training style in the today view (mezo-r36n9.79, T1 Task 8): the effort ramp, the prescribed
 * rest, the per-style overshoot — and an unstyled run that prescribes exactly as before.
 */
class WorkoutTodayStyleIT extends AbstractIntegrationTest {

    private static final Path GOLDEN = Path.of("src/test/resources/train/golden/unstyled-today.json");
    private static final Pattern UUID_RE =
        Pattern.compile("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$");
    private static final Pattern DATE_RE = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}.*");

    @Autowired WorkoutService workoutService;
    @Autowired TrainPopulator train;
    @Autowired MesocycleRepository mesocycleRepository;
    @Autowired ObjectMapper objectMapper;
    @Autowired DatabasePopulator databasePopulator;
    @Autowired OwnerProperties ownerProperties;
    @Autowired TrainService trainService;
    @Autowired ExerciseCatalogRepository catalogRepository;
    @Autowired io.mrkuhne.mezo.support.populator.RecoveryPeriodPopulator recovery;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private static String todayLabel() {
        return WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
    }

    /** An active run pinned at {@code week} (the volume rollover is a guaranteed no-op). */
    private MesocycleEntity run(UUID owner, String style, int week, List<String> curve) {
        MesocycleEntity m = train.createActiveMeso(owner);
        m.setPhaseCurve(curve);
        m.setCurrentWeek(week);
        m.setTrainingStyle(style);
        m.setVolumeRecompute(new VolumeRecomputeJson("W999", "W1000", "batch", List.of()));
        return mesocycleRepository.saveAndFlush(m);
    }

    private ExerciseEntity exercise(UUID owner, UUID day, String name, String muscle, String type,
                                    int repMin, int repMax, int rir) {
        ExerciseEntity e = train.createExercise(owner, day, name, muscle, type);
        e.setRepMin(repMin);
        e.setRepMax(repMax);
        e.setTargetRir(rir);
        return train.save(e);
    }

    /**
     * Golden: the full today JSON of an unstyled run, captured on the commit before the style wiring
     * (ac1fab4c1). Ids and dates are normalised; everything else must be byte-identical.
     */
    @Test
    void unstyledRunPrescribesAsBefore() throws IOException {
        UUID owner = ownerId();
        MesocycleEntity meso = run(owner, null, 2, List.of("MEV", "MAV", "MAV", "Deload"));
        WorkoutSessionEntity day = train.createTemplateDay(owner, meso.getId(), todayLabel());
        ExerciseEntity bench = exercise(owner, day.getId(), "Fekvenyomás", "chest", "compound", 6, 8, 1);
        ExerciseEntity lateral = exercise(owner, day.getId(), "Oldalemelés", "shoulders", "isolation", 10, 15, 2);
        ExerciseEntity squat = exercise(owner, day.getId(), "Guggolás", "quad", "compound", 5, 8, 2);
        squat.setAnchorWeightKg(BigDecimal.valueOf(80));
        train.save(squat);
        ExerciseEntity hyper = exercise(owner, day.getId(), "Hiperextenzió", "back", "isolation", 10, 15, 2);
        ExerciseEntity row = exercise(owner, day.getId(), "Evezés", "back", "compound", 8, 10, 1);
        WorkoutSessionEntity past = train.createWorkoutInstance(owner, day, LocalDate.now().minusDays(7), "completed");
        train.createLoggedSet(owner, bench.getId(), past.getId(), 0, "60", 8, 1);
        train.createLoggedSet(owner, bench.getId(), past.getId(), 1, "60", 7, 0);
        train.createLoggedSet(owner, lateral.getId(), past.getId(), 0, "10", 12, 2);
        train.createLoggedSet(owner, hyper.getId(), past.getId(), 0, "0", 15, 2);
        train.createLoggedSet(owner, row.getId(), past.getId(), 0, "70", 7, 0);

        WorkoutTodayResponse res = workoutService.getToday(owner, null);
        String actual = objectMapper.writerWithDefaultPrettyPrinter()
            .writeValueAsString(normalise(objectMapper.valueToTree(res)));

        if (System.getenv("GOLDEN_WRITE") != null) {
            Files.createDirectories(GOLDEN.getParent());
            Files.writeString(GOLDEN, actual + "\n", StandardCharsets.UTF_8);
        }
        assertThat(actual + "\n").isEqualTo(Files.readString(GOLDEN, StandardCharsets.UTF_8));
    }

    private UUID catalog(String slug) {
        return catalogRepository.findBySlug(slug).orElseThrow().getId();
    }

    private static GymExerciseInput input(String name, String muscle, GymExerciseInput.TypeEnum type, UUID catalogId) {
        return GymExerciseInput.builder().name(name).muscle(muscle).warmupSets(2).workingSets(3)
            .repMin(8).repMax(12).targetRIR(3).type(type).catalogId(catalogId).build();
    }

    /** A styled run's today day, its rows written through the real day edit (so they are stamped). */
    private MesocycleEntity styledDay(UUID owner, String style, int week, List<GymExerciseInput> inputs) {
        MesocycleEntity meso = run(owner, style, week, SIX_WEEKS);
        WorkoutSessionEntity day = train.createTemplateDay(owner, meso.getId(), todayLabel());
        trainService.replaceDayExercises(owner, meso.getId(), day.getId(), inputs);
        return meso;
    }

    private static final List<String> SIX_WEEKS = List.of("MAV", "MAV", "MAV", "MAV", "MAV", "Deload");

    private static TodayExercise byName(WorkoutTodayResponse res, String name) {
        return res.getExercises().stream().filter(e -> e.getName().equals(name)).findFirst().orElseThrow();
    }

    private static List<PrescribedSet> working(TodayExercise t) {
        return t.getPrescribedSets().stream().filter(p -> p.getKind() == PrescribedSet.KindEnum.WORKING).toList();
    }

    @Test
    void styledRunRampsReserve() {
        UUID owner = ownerId();
        MesocycleEntity meso = styledDay(owner, "balanced", 1, List.of(
            input("Machine Chest Press", "chest-mid", GymExerciseInput.TypeEnum.COMPOUND, catalog("machine-chest-press"))));

        TodayExercise week1 = byName(workoutService.getToday(owner, null), "Machine Chest Press");
        meso.setCurrentWeek(5);
        mesocycleRepository.saveAndFlush(meso);
        TodayExercise week5 = byName(workoutService.getToday(owner, null), "Machine Chest Press");
        meso.setCurrentWeek(6);
        mesocycleRepository.saveAndFlush(meso);
        TodayExercise deload = byName(workoutService.getToday(owner, null), "Machine Chest Press");

        // balanced stable compound: reserve 2 → first third 2, last loading week 0, deload week 2 + 2
        assertThat(week1.getTargetRIR()).isEqualTo(2);
        assertThat(working(week1)).allSatisfy(p -> assertThat(p.getTargetRIR()).isEqualTo(2));
        assertThat(week5.getTargetRIR()).isZero();
        assertThat(working(week5)).allSatisfy(p -> assertThat(p.getTargetRIR()).isZero());
        assertThat(deload.getTargetRIR()).isEqualTo(4);
    }

    @Test
    void styledRunCarriesRest() {
        UUID owner = ownerId();
        GymExerciseInput press = input("Machine Chest Press", "chest-mid", GymExerciseInput.TypeEnum.COMPOUND,
            catalog("machine-chest-press"));
        press.setRestSec(100);
        press.setOverrides(List.of(StyleOverride.REST_SEC));
        styledDay(owner, "balanced", 1, List.of(press,
            input("Cable Fly", "chest-mid", GymExerciseInput.TypeEnum.ISOLATION, catalog("cable-fly"))));

        WorkoutTodayResponse res = workoutService.getToday(owner, null);

        TodayExercise p = byName(res, "Machine Chest Press");
        assertThat(p.getRestSec()).isEqualTo(100);
        assertThat(p.getOverrides()).containsExactly(StyleOverride.REST_SEC);
        assertThat(p.getTrainingStyle()).isNull();
        assertThat(p.getEffectiveTrainingStyle()).isEqualTo(io.mrkuhne.mezo.api.dto.TrainingStyle.BALANCED);
        assertThat(p.getPrescribedSets()).isNotEmpty().allSatisfy(s -> assertThat(s.getRestSec()).isEqualTo(100));
        TodayExercise fly = byName(res, "Cable Fly");
        assertThat(fly.getRestSec()).isEqualTo(90);
        assertThat(fly.getPrescribedSets()).isNotEmpty().allSatisfy(s -> assertThat(s.getRestSec()).isEqualTo(90));
    }

    @Test
    void alloutRunPrescribesTwoSetsAtZero() {
        UUID owner = ownerId();
        styledDay(owner, "allout", 1, List.of(
            input("Machine Chest Press", "chest-mid", GymExerciseInput.TypeEnum.COMPOUND, catalog("machine-chest-press"))));

        TodayExercise t = byName(workoutService.getToday(owner, null), "Machine Chest Press");

        assertThat(t.getEffectiveTrainingStyle()).isEqualTo(io.mrkuhne.mezo.api.dto.TrainingStyle.ALLOUT);
        assertThat(t.getWorkingSets()).isEqualTo(2);
        assertThat(t.getTargetRIR()).isZero();
        assertThat(working(t)).hasSize(2).allSatisfy(p -> {
            assertThat(p.getTargetRIR()).isZero();
            assertThat(p.getRestSec()).isEqualTo(180);
        });
    }

    @Test
    void freeExerciseInStyledRunNeverBelowOne() {
        UUID owner = ownerId();
        styledDay(owner, "balanced", 5, List.of(
            input("Barbell Bench Press", "chest-mid", GymExerciseInput.TypeEnum.COMPOUND, catalog("barbell-bench-press")),
            input("Machine Chest Press", "chest-mid", GymExerciseInput.TypeEnum.COMPOUND, catalog("machine-chest-press"))));

        WorkoutTodayResponse res = workoutService.getToday(owner, null);

        // last loading week: 2 − 2 = 0, but a free exercise keeps one rep in reserve
        TodayExercise free = byName(res, "Barbell Bench Press");
        assertThat(free.getTargetRIR()).isEqualTo(1);
        assertThat(working(free)).allSatisfy(p -> assertThat(p.getTargetRIR()).isEqualTo(1));
        assertThat(byName(res, "Machine Chest Press").getTargetRIR()).isZero();
    }

    @Test
    void alloutOnFreeExerciseFallsBackToHeavyAtOne() {
        UUID owner = ownerId();
        styledDay(owner, "allout", 5, List.of(
            input("Barbell Bench Press", "chest-mid", GymExerciseInput.TypeEnum.COMPOUND, catalog("barbell-bench-press"))));

        TodayExercise t = byName(workoutService.getToday(owner, null), "Barbell Bench Press");

        assertThat(t.getEffectiveTrainingStyle()).isEqualTo(io.mrkuhne.mezo.api.dto.TrainingStyle.HEAVY);
        assertThat(t.getTargetRIR()).isEqualTo(1);
        assertThat(working(t)).allSatisfy(p -> assertThat(p.getRestSec()).isEqualTo(180));
    }

    @Test
    void styledRunKeepsTheComebackRirFloor() {
        UUID owner = ownerId();
        styledDay(owner, "balanced", 5, List.of(
            input("Machine Chest Press", "chest-mid", GymExerciseInput.TypeEnum.COMPOUND, catalog("machine-chest-press"))));
        // a released / comeback day floors every working set's RIR at 3 — on top of the ramped 0
        LocalDate today = LocalDate.now(java.time.ZoneId.of("Europe/Budapest"));
        recovery.ended(owner, io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity.Reason.ILLNESS,
            today.minusDays(4), today);

        TodayExercise t = byName(workoutService.getToday(owner, null), "Machine Chest Press");

        assertThat(working(t)).allSatisfy(p -> assertThat(p.getTargetRIR()).isEqualTo(3));
    }

    /** Ids → "<uuid>", dates/instants → "<date>", the weekday label dropped (all run-dependent). */
    private static JsonNode normalise(JsonNode node) {
        if (node instanceof ObjectNode obj) {
            obj.remove("dayLabel");
            List<String> names = new ArrayList<>(obj.propertyNames());
            for (String name : names) {
                obj.set(name, normalise(obj.get(name)));
            }
            return obj;
        }
        if (node.isArray()) {
            for (int i = 0; i < node.size(); i++) {
                ((tools.jackson.databind.node.ArrayNode) node).set(i, normalise(node.get(i)));
            }
            return node;
        }
        if (node.isString()) {
            String s = node.asString();
            if (UUID_RE.matcher(s).matches()) return StringNode.valueOf("<uuid>");
            if (DATE_RE.matcher(s).matches()) return StringNode.valueOf("<date>");
        }
        return node;
    }
}
