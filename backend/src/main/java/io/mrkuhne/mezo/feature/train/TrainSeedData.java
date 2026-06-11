package io.mrkuhne.mezo.feature.train;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.entity.ProvenanceEnvelope;
import io.mrkuhne.mezo.feature.train.entity.ProvenanceEnvelope.Adjustment;
import io.mrkuhne.mezo.feature.train.entity.ProvenanceEnvelope.Baseline;
import io.mrkuhne.mezo.feature.train.entity.SportSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.VolumeRecomputeJson;
import io.mrkuhne.mezo.feature.train.entity.VolumeRecomputeJson.Change;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ports the Phase 1 Train mock fixtures ({@code frontend/src/data/train.ts}) 1:1 so real mode
 * renders exactly what mock mode renders. These fixtures are <strong>opt-in demo data</strong>:
 * active only under {@code @Profile("demofixtures")}, so a plain {@code demodata} app starts on a
 * clean slate with the owner only ({@link io.mrkuhne.mezo.feature.auth.OwnerSeedData}). Run with
 * {@code --spring.profiles.active=demodata,demofixtures} to load the demo content; every row is
 * owned by the seeded owner ({@code demodata} supplies it, hence the dependency on both profiles).
 *
 * <p>All values below are copied verbatim from {@code train.ts}; display dates map to ISO with
 * year 2026 (Máj 1 → 2026-05-01, Jún 12 → 2026-06-12 …) and sport-session dates come from the
 * fixture ids ({@code vb-2026-05-20} → 2026-05-20).
 *
 * <p>Idempotent: if any mesocycle already exists the runner is a no-op (re-runnable in tests).
 */
@Component
@Profile("demofixtures")
@Order(100) // after OwnerSeedData — needs the seeded owner (from the demodata profile)
@RequiredArgsConstructor
public class TrainSeedData implements CommandLineRunner {

    private final AppUserRepository appUserRepository;
    private final OwnerProperties ownerProperties;
    private final MesocycleRepository mesocycleRepository;
    private final MuscleGroupVolumeLogRepository volumeLogRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseRepository exerciseRepository;
    private final SportSessionRepository sportSessionRepository;

    // Both run(...) overloads carry @Transactional: startup enters via run(String...) but its
    // call to run() is a self-invocation that bypasses the Spring proxy, so the no-arg @Transactional
    // alone would NOT wrap the startup seed. The IT enters via run() directly through the proxy.
    /** CommandLineRunner entry point (startup). */
    @Override
    @Transactional
    public void run(String... args) {
        run();
    }

    /** No-arg overload — used by the integration test to re-seed into a reset DB. */
    @Transactional
    public void run() {
        if (mesocycleRepository.count() > 0) return;
        AppUserEntity owner = appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow();
        UUID by = owner.getId();

        seedActiveMeso(by);
        seedPlannedAndArchivedMesos(by);
        seedSportSessions(by);
    }

    // --- active meso "Hypertrophy 04 · Tavasz" (hyp-04) + 8 volume logs + 7 days ---------------

    private void seedActiveMeso(UUID by) {
        MesocycleEntity hyp04 = meso(by,
            "Hypertrophy 04 · Tavasz", "Hypertrophy 04", "active",
            "Felsőtest hypertrophy · izomtömeg építés",
            "2026-05-01", "2026-06-12", 6, 3,
            "Pull / Push / Legs · 5×/hét", "RP · 6 hét",
            List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload"),
            new VolumeRecomputeJson(
                "Vasárnap · Máj 18 · 21:00",
                "Vasárnap · Máj 25 · 21:00",
                "Heti pattern engine batch",
                List.of(
                    new Change("back", "MRV +2 (20 → 22)",
                        "Pull Day pumpa-tolerancia 4 héten át stabil RIR 1-en", null),
                    new Change("shoulder", "MRV -2 (20 → 18)",
                        "Jobb váll niggle reaktivált · Máj 14", true),
                    new Change("chest", "MAV +2 (12 → 14)",
                        "Bench Press progresszió Q1 retro óta", null))),
            null, null);
        UUID mesoId = hyp04.getId();

        // 8 volume logs (train.ts:63-151) — every baseline, adjustment, confidence, note verbatim.
        volume(by, mesoId, "chest", 8, 14, 20, 14, new ProvenanceEnvelope( // mev mav mrv cur
            new Baseline("RP guidelines · intermediate", 8, 12, 18),
            List.of(
                new Adjustment("pattern",
                    "Múlt Q1 retro: pumpa 18-20 szet körül stabil maradt", Map.of("mrv", 2), null),
                new Adjustment("recovery", "7.2h alvás átlag · stabil", Map.of("mav", 2), null)),
            0.78,
            "Daniel-personalizált MRV. Bench Press + Incline DB + Cable Fly historikusan jól tolerál"
                + " — 22-re is felmehetnénk, de Reta cycle alatt 20 a felső limit.",
            null));

        volume(by, mesoId, "back", 10, 16, 22, 16, new ProvenanceEnvelope(
            new Baseline("RP guidelines · intermediate", 10, 14, 20),
            List.of(
                new Adjustment("pattern",
                    "Pull Day konzisztencia 14 hete · magas hát-tolerancia",
                    Map.of("mrv", 2, "mav", 2), null),
                new Adjustment("sport-cross",
                    "Volleyball pull-mozgások (smash, set) +load", Map.of("mav", 0), null)),
            0.85,
            "A legjobban tolerált izomcsoportod — Chest Row + Lat Pulldown stim/fatigue ratio kiváló.",
            null));

        volume(by, mesoId, "shoulder", 8, 12, 18, 12, new ProvenanceEnvelope(
            new Baseline("RP guidelines · intermediate", 8, 14, 20),
            List.of(
                new Adjustment("niggle",
                    "Jobb váll niggle · márc 18 óta intermittent",
                    Map.of("mav", -2, "mrv", -2), true),
                new Adjustment("sport-cross",
                    "Volleyball szervák + smashek shoulder volumen", Map.of("mav", 0), null)),
            0.62,
            "A niggle miatt lejjebb húzzuk az MRV-t. Lateral Raise OK, Overhead Press kerülve.",
            null));

        volume(by, mesoId, "biceps", 6, 10, 14, 10, new ProvenanceEnvelope(
            new Baseline("RP guidelines · intermediate", 8, 14, 20),
            List.of(
                new Adjustment("pattern",
                    "Direct bicep work jobban reagált alacsonyabb volumenre",
                    Map.of("mev", -2, "mav", -4, "mrv", -6), null)),
            0.71,
            "Korábbi mesókban észrevettük: 14 szet/hét + Pull Day indirect = pumpa szintje stagnál."
                + " Daniel-specifikus alacsonyabb MRV.",
            null));

        volume(by, mesoId, "triceps", 6, 10, 14, 10, new ProvenanceEnvelope(
            new Baseline("RP guidelines · intermediate", 6, 10, 14),
            List.of(),
            0.74,
            "Standard RP range — Push Day indirect + Pushdown direct work bevált.",
            null));

        volume(by, mesoId, "quad", 8, 12, 18, 12, new ProvenanceEnvelope(
            new Baseline("RP guidelines · intermediate", 8, 14, 20),
            List.of(
                new Adjustment("sport-cross",
                    "Volleyball ugrás-volumen · jump count", Map.of("mav", -2, "mrv", -2), null)),
            0.68,
            "Heti 5×100+ ugrás a volleyball-ról a quad-fáradtságot megemeli — direct leg-volumen"
                + " kicsit alacsonyabb.",
            null));

        volume(by, mesoId, "ham", 6, 10, 14, 10, new ProvenanceEnvelope(
            new Baseline("RP guidelines · intermediate", 6, 12, 16),
            List.of(
                new Adjustment("sport-cross",
                    "Sprintek + ugrások hamstring eccentric load",
                    Map.of("mav", -2, "mrv", -2), null)),
            0.72,
            null,
            null));

        volume(by, mesoId, "glute", 8, 12, 18, 12, new ProvenanceEnvelope(
            new Baseline("RP guidelines · intermediate", 8, 12, 16),
            List.of(
                new Adjustment("pattern",
                    "Hip Thrust + Squat stim ratio kiváló · MRV bővíthető", Map.of("mrv", 2), null)),
            0.69,
            null,
            null));

        // 7 template days (train.ts:152-219). Status "planned" everywhere except Csü = "active".
        WorkoutSessionEntity het = session(by, mesoId, "Hét", "Push", "chest+shoulder+tricep",
            false, null, "planned", 0);
        exercise(by, het, "Barbell Bench Press", "chest", 4, "6-8", 1, "compound", null, 0);
        exercise(by, het, "Incline DB Press", "chest", 3, "8-10", 1, "compound", null, 1);
        exercise(by, het, "Overhead Press", "shoulder", 3, "8-10", 2, "compound",
            "Niggle-kíméletes verzió · cable variánssal helyettesítve", 2);
        exercise(by, het, "Lateral Raise", "shoulder", 3, "12-15", 1, "isolation", null, 3);
        exercise(by, het, "Tricep Pushdown", "triceps", 3, "10-12", 1, "isolation", null, 4);

        WorkoutSessionEntity kedd = session(by, mesoId, "Kedd", "Legs A", "quad+ham+glute",
            false, "Reggeli 07:30 gym · este 17:00 volleyball", "planned", 1);
        exercise(by, kedd, "Front Squat", "quad", 3, "8-10", 2, "compound", null, 0);
        exercise(by, kedd, "Leg Curl", "ham", 3, "10-12", 1, "isolation", null, 1);
        exercise(by, kedd, "Walking Lunge", "quad", 3, "12 / oldal", 1, "compound", null, 2);
        exercise(by, kedd, "Standing Calf Raise", "calf", 3, "12-15", 0, "isolation", null, 3);

        WorkoutSessionEntity sze = session(by, mesoId, "Sze", "Legs", "quad+ham+glute",
            false, null, "planned", 2);
        exercise(by, sze, "Barbell Squat", "quad", 4, "6-8", 1, "compound", null, 0);
        exercise(by, sze, "Romanian Deadlift", "ham", 3, "8-10", 1, "compound", null, 1);
        exercise(by, sze, "Leg Press", "quad", 3, "10-12", 1, "compound", null, 2);
        exercise(by, sze, "Leg Curl", "ham", 3, "10-12", 1, "isolation", null, 3);
        exercise(by, sze, "Hip Thrust", "glute", 3, "8-10", 1, "compound", null, 4);
        exercise(by, sze, "Standing Calf Raise", "calf", 3, "12-15", 0, "isolation", null, 5);

        // Csü — the CURRENT day (fixture: current: true, muscleAccent: true), status "active".
        WorkoutSessionEntity csu = session(by, mesoId, "Csü", "Pull", "back+bicep",
            true, null, "active", 3);
        exercise(by, csu, "Chest Supported Row", "back-mid", 4, "8-10", 1, "compound", null, 0);
        exercise(by, csu, "Lat Pulldown · Pronated", "lats", 3, "10-12", 2, "compound",
            "Pronated grif · csukló-kíméletes", 1);
        exercise(by, csu, "Cable Pull-Around", "back-mid", 3, "12-15", 1, "isolation", null, 2);
        exercise(by, csu, "Hammer Curl", "biceps", 3, "10-12", 1, "isolation", null, 3);
        exercise(by, csu, "Face Pull", "rear-delt", 3, "15-20", 1, "isolation", null, 4);

        WorkoutSessionEntity pen = session(by, mesoId, "Pén", "Push · light", "chest+shoulder",
            false, null, "planned", 4);
        exercise(by, pen, "Incline DB Press", "chest", 3, "10-12", 2, "compound", null, 0);
        exercise(by, pen, "Cable Fly", "chest", 3, "12-15", 1, "isolation", null, 1);
        exercise(by, pen, "Lateral Raise", "shoulder", 3, "12-15", 1, "isolation", null, 2);
        exercise(by, pen, "Overhead Tricep Ext", "triceps", 3, "10-12", 1, "isolation", null, 3);

        // Szo + Vas — no exercises.
        session(by, mesoId, "Szo", "Volleyball · meccs", "sport",
            false, "Szombati volleyball · random idő · gym day off", "planned", 5);
        session(by, mesoId, "Vas", "Rest", "",
            false, "Pihenőnap · weekly memoir 19:00", "planned", 6);
    }

    // --- 3 more mesos: str-02 (planned), maint-01 (planned), rec-03 (archived) -----------------

    private void seedPlannedAndArchivedMesos(UUID by) {
        meso(by,
            "Strength 02 · Nyár", "Strength 02", "planned",
            "Maximális erő · 1RM növelés Squat/Bench/Deadlift",
            "2026-06-16", "2026-08-04", 7, 0,
            "Upper / Lower · 4×/hét", "Linear · 7 hét",
            List.of("MEV", "MEV", "MAV", "MAV", "MRV", "MRV", "Deload"),
            null,
            "Daniel: 'Idő egy erő-blokkra is.' Reta cycle befejezésével szinkronban indul.",
            null);

        meso(by,
            "Pre-cut maintenance · Aug", "Maintenance", "planned",
            "Karbantartás · zsírvesztés-előkészítés",
            "2026-08-07", "2026-08-28", 3, 0,
            "Full body · 4×/hét", "Maintenance · 3 hét",
            List.of("MAV", "MAV", "MAV"),
            null,
            "Reta cycle vége — kalória deficit nélkül erő- és izom-tartás.",
            null);

        meso(by,
            "Recovery rebuild · Tél", "Recovery 03", "archived",
            "Január niggle után · izolációs munka",
            "2026-02-12", "2026-04-23", 8, 8,
            "Push / Pull / Legs · 3-4×/hét", "RP · 8 hét",
            List.of("MEV", "MEV", "MEV", "MAV", "MAV", "MRV", "MRV", "Deload"),
            null,
            null,
            "8/10 — Chest Row +12.5kg, jobb váll niggle stabilizálva, alvás 7.2h átlag.");
    }

    // --- 5 sport sessions (train.ts:378-383) — dates from ids, times/values verbatim -----------

    private void seedSportSessions(UUID by) {
        sport(by, "2026-05-20", "18:00", 90, 5, 7, "6.8", 6, 38,
            "Smashek tisztábbak, jobb váll után érzem délután");
        sport(by, "2026-05-18", "10:00", 120, 6, 8, "7.2", 7, 52,
            "Hosszú meccs · maradt erő utána");
        sport(by, "2026-05-15", "19:30", 90, 4, 7, "6.5", 5, 31, null);
        sport(by, "2026-05-13", "18:00", 90, 5, 7, "6.9", 6, 35, null);
        sport(by, "2026-05-11", "10:00", 120, 6, 8, "7.5", 8, 48,
            "Sok smash · vasárnap pihentem");
    }

    // --- plain builders ------------------------------------------------------------------------

    private MesocycleEntity meso(UUID by, String title, String shortTitle, String status,
        String goal, String startDate, String endDate, int weeks, int currentWeek,
        String split, String style, List<String> phaseCurve, VolumeRecomputeJson volumeRecompute,
        String notes, String summary) {
        MesocycleEntity m = new MesocycleEntity();
        m.setCreatedBy(by);
        m.setTitle(title);
        m.setShortTitle(shortTitle);
        m.setStatus(status);
        m.setGoal(goal);
        m.setStartDate(LocalDate.parse(startDate));
        m.setEndDate(LocalDate.parse(endDate));
        m.setWeeks(weeks);
        m.setCurrentWeek(currentWeek);
        m.setSplit(split);
        m.setStyle(style);
        m.setPhaseCurve(phaseCurve);
        m.setVolumeRecompute(volumeRecompute);
        m.setNotes(notes);
        m.setSummary(summary);
        return mesocycleRepository.save(m);
    }

    // Param order of the four adjacent ints: mev, mav, mrv, current(Sets). Easy to transpose —
    // call sites pass them positionally; see the "// mev mav mrv cur" hint on the first call.
    private void volume(UUID by, UUID mesocycleId, String muscle, int mev, int mav, int mrv,
        int current, ProvenanceEnvelope source) {
        MuscleGroupVolumeLogEntity v = new MuscleGroupVolumeLogEntity();
        v.setCreatedBy(by);
        v.setMesocycleId(mesocycleId);
        v.setMuscle(muscle);
        v.setMev(mev);
        v.setMav(mav);
        v.setMrv(mrv);
        v.setCurrentSets(current);
        v.setSource(source);
        volumeLogRepository.save(v);
    }

    private WorkoutSessionEntity session(UUID by, UUID mesocycleId, String dayLabel, String type,
        String muscle, boolean muscleAccent, String note, String status, int orderIndex) {
        WorkoutSessionEntity s = new WorkoutSessionEntity();
        s.setCreatedBy(by);
        s.setMesocycleId(mesocycleId);
        s.setDayLabel(dayLabel);
        s.setType(type);
        s.setMuscle(muscle);
        s.setMuscleAccent(muscleAccent);
        s.setNote(note);
        s.setStatus(status);
        s.setOrderIndex(orderIndex);
        return workoutSessionRepository.save(s);
    }

    private void exercise(UUID by, WorkoutSessionEntity session, String name, String muscle,
        int sets, String targetReps, int targetRir, String type, String warning, int orderIndex) {
        ExerciseEntity e = new ExerciseEntity();
        e.setCreatedBy(by);
        e.setWorkoutSessionId(session.getId());
        e.setName(name);
        e.setMuscle(muscle);
        e.setSets(sets);
        e.setTargetReps(targetReps);
        e.setTargetRir(targetRir);
        e.setType(type);
        e.setWarning(warning);
        e.setOrderIndex(orderIndex);
        exerciseRepository.save(e);
    }

    private void sport(UUID by, String date, String time, int durationMin, int setsPlayed,
        int intensity, String rpe, int shoulderStrain, int jumpCount, String notes) {
        SportSessionEntity s = new SportSessionEntity();
        s.setCreatedBy(by);
        // sport stays the entity default "volleyball".
        s.setDate(LocalDate.parse(date));
        s.setTime(time);
        s.setDurationMin(durationMin);
        s.setSetsPlayed(setsPlayed);
        s.setIntensity(intensity);
        s.setRpe(new BigDecimal(rpe));
        s.setShoulderStrain(shoulderStrain);
        s.setJumpCount(jumpCount);
        s.setNotes(notes);
        sportSessionRepository.save(s);
    }
}
