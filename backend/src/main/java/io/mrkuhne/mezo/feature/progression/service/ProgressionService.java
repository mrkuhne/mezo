package io.mrkuhne.mezo.feature.progression.service;

import io.mrkuhne.mezo.api.dto.ProfileHighlights;
import io.mrkuhne.mezo.api.dto.ProgressionProfileResponse;
import io.mrkuhne.mezo.api.dto.RadarAxis;
import io.mrkuhne.mezo.api.dto.SkillLevel;
import io.mrkuhne.mezo.api.dto.SkillRef;
import io.mrkuhne.mezo.feature.progression.PerkCatalog;
import io.mrkuhne.mezo.feature.progression.ProgressionCurve;
import io.mrkuhne.mezo.feature.progression.ProgressionTaxonomy;
import io.mrkuhne.mezo.feature.progression.config.ProgressionProperties;
import io.mrkuhne.mezo.feature.progression.entity.LevelUpEventEntity;
import io.mrkuhne.mezo.feature.progression.entity.LevelUpResult;
import io.mrkuhne.mezo.feature.progression.entity.PerkUnlockEntity;
import io.mrkuhne.mezo.feature.progression.entity.SkillProgressEntity;
import io.mrkuhne.mezo.feature.progression.gym.GymSignal;
import io.mrkuhne.mezo.feature.progression.repository.LevelUpEventRepository;
import io.mrkuhne.mezo.feature.progression.repository.PerkUnlockRepository;
import io.mrkuhne.mezo.feature.progression.repository.SkillProgressRepository;
import io.mrkuhne.mezo.feature.progression.run.RunSignal;
import io.mrkuhne.mezo.feature.progression.sport.SportSignal;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Grants XP from a finished workout, recomputes levels/perks/robustness, and records one
 * level_up_event. Idempotent per (source_type, source_ref_id): a re-applied workout returns the
 * stored payload without re-awarding. P2 implements the GYM family only.
 */
@Service
@RequiredArgsConstructor
public class ProgressionService {

    private static final String SOURCE_GYM = "GYM";
    private static final String SOURCE_RUN = "RUN";
    private static final String SOURCE_SPORT = "SPORT";
    private static final int[] MILESTONES = {5, 10, 15, 20, 25, 30};

    private final SkillProgressRepository skillProgressRepository;
    private final LevelUpEventRepository levelUpEventRepository;
    private final PerkUnlockRepository perkUnlockRepository;
    private final ProgressionCurve curve;
    private final PerkCatalog perkCatalog;
    private final RobustnessCalculator robustnessCalculator;
    private final ProgressionProperties properties;

    @Transactional
    public LevelUpResult applyGym(UUID createdBy, GymSignal signal) {
        // Build the GYM-specific deltas; award() performs the idempotency guard + shared tail.
        ProgressionProperties.Gym g = properties.gym();
        // skillKey → xp delta for this workout (LinkedHashMap to keep a stable order in the payload)
        Map<String, Long> deltas = new LinkedHashMap<>();
        Map<String, String> kinds = new LinkedHashMap<>();

        // muscle volume → per-muscle XP
        signal.volumeByMuscle().forEach((muscle, volume) -> {
            long xp = volume / g.volumeUnit() * g.volumeXpPerUnit();
            if (xp > 0) {
                deltas.merge(muscle, xp, Long::sum);
                kinds.put(muscle, "MUSCLE");
            }
        });
        // best e1RM → max_strength XP (+ PR bonus on the first-ever weighted session, v1 rule)
        if (signal.bestE1rm() != null) {
            boolean firstEver = skillProgressRepository
                .findByCreatedByAndSkillKey(createdBy, "max_strength").isEmpty();
            long xp = (long) signal.bestE1rm().intValue() * g.e1rmXpPerKg()
                + (firstEver ? g.prBonusXp() : 0L);
            deltas.merge("max_strength", xp, Long::sum);
            kinds.put("max_strength", "ATHLETIC");
        }
        // work sets → strength_endurance; bodyweight reps → flat strength_endurance too
        long enduranceXp = (long) signal.workSetCount() * g.strengthEnduranceXpPerSet()
            + (long) signal.bodyweightRepCount() * g.bodyweightXpPerRep();
        if (enduranceXp > 0) {
            deltas.merge("strength_endurance", enduranceXp, Long::sum);
            kinds.put("strength_endurance", "ATHLETIC");
        }

        return award(createdBy, SOURCE_GYM, signal.instanceId(), deltas, kinds,
            "Klasszik kondi", null, null);
    }

    @Transactional
    public LevelUpResult applyRun(UUID createdBy, RunSignal signal) {
        ProgressionProperties.Run r = properties.run();
        Map<String, Long> deltas = new LinkedHashMap<>();
        Map<String, String> kinds = new LinkedHashMap<>();

        boolean sprint = "sprint".equals(signal.kind()) || "pyramid".equals(signal.kind());
        if (sprint) {
            int rounds = signal.completedRounds() != null ? signal.completedRounds() : 0;
            addAthletic(deltas, kinds, "sprint_speed", (long) rounds * r.sprintXpPerRound());
            addAthletic(deltas, kinds, "anaerobic_capacity", (long) rounds * r.anaerobicXpPerRound());
            if (signal.rpeActual() != null) {
                addAthletic(deltas, kinds, "explosiveness",
                    (long) signal.rpeActual() * r.rpeXpPerPoint());
            }
        } else { // steady (default)
            int min = signal.durationMin() != null ? signal.durationMin() : 0;
            addAthletic(deltas, kinds, "strength_endurance", (long) min * r.steadyXpPerMin());
            long aerobic = (long) min * r.aerobicXpPerMin()
                + (signal.hrRecoverySec() != null ? r.hrRecoveryBonusXp() : 0L);
            addAthletic(deltas, kinds, "aerobic_capacity", aerobic);
        }

        String label = sprint ? "Sprint futás" : "Futás";
        return award(createdBy, SOURCE_RUN, signal.logId(), deltas, kinds,
            label, signal.durationMin(), signal.rpeActual());
    }

    @Transactional
    public LevelUpResult applySport(UUID createdBy, SportSignal signal) {
        ProgressionProperties.Sport sp = properties.sport();
        Map<String, Long> deltas = new LinkedHashMap<>();
        Map<String, String> kinds = new LinkedHashMap<>();

        int min = signal.durationMin() != null ? signal.durationMin() : 0;
        int rpe = signal.rpe() != null ? signal.rpe() : 0;
        int sets = signal.setsPlayed() != null ? signal.setsPlayed() : 0;
        int rounds = signal.rounds() != null ? signal.rounds() : 0;

        String label;
        switch (signal.kind() != null ? signal.kind() : "volleyball") {
            case "cross" -> {
                label = "Cross training";
                addAthletic(deltas, kinds, "anaerobic_capacity", (long) rounds * sp.xpPerRound());
                addAthletic(deltas, kinds, "strength_endurance", (long) rounds * sp.xpPerRound());
                addAthletic(deltas, kinds, "explosiveness", (long) rpe * sp.rpeXpPerPoint());
                addAthletic(deltas, kinds, "core_stability", (long) rpe * sp.rpeXpPerPoint());
            }
            case "trx" -> {
                label = "TRX köredzés";
                addAthletic(deltas, kinds, "core_stability", (long) rounds * sp.xpPerRound());
                addAthletic(deltas, kinds, "strength_endurance", (long) rounds * sp.xpPerRound());
                addAthletic(deltas, kinds, "anaerobic_capacity", (long) rpe * sp.rpeXpPerPoint());
                addAthletic(deltas, kinds, "mobility", (long) min * sp.xpPerMin());
            }
            default -> { // volleyball
                label = "Röplabda";
                addAthletic(deltas, kinds, "vertical_jump", (long) sets * sp.xpPerSet());
                addAthletic(deltas, kinds, "agility", (long) sets * sp.xpPerSet());
                addAthletic(deltas, kinds, "coordination", (long) sets * sp.xpPerSet());
                addAthletic(deltas, kinds, "explosiveness", (long) rpe * sp.rpeXpPerPoint());
                addAthletic(deltas, kinds, "aerobic_capacity", (long) min * sp.xpPerMin());
            }
        }

        return award(createdBy, SOURCE_SPORT, signal.sessionId(), deltas, kinds,
            label, signal.durationMin(), signal.rpe());
    }

    /**
     * The athletic+muscle progression profile (read): all skill levels over the fixed taxonomy
     * (missing skill → level 1), athlete-level (mean of the 11 non-robustness athletic; null when
     * the user has no XP → ghost), 6 fixed radar axes (Erő blends the muscle-level mean), the
     * streak, and the best athletic/muscle highlights. No @Transactional — pure read.
     */
    public ProgressionProfileResponse getProfile(UUID createdBy) {
        List<SkillProgressEntity> rows = skillProgressRepository.findByCreatedByOrderBySkillKeyAsc(createdBy);
        Map<String, SkillProgressEntity> byKey = new HashMap<>();
        rows.forEach(r -> byKey.put(r.getSkillKey(), r));

        List<SkillLevel> athletic = new ArrayList<>();
        ProgressionTaxonomy.ATHLETIC.forEach(k -> athletic.add(skillLevel(byKey, k, "ATHLETIC")));
        athletic.add(skillLevel(byKey, ProgressionTaxonomy.ROBUSTNESS, "ATHLETIC"));
        List<SkillLevel> muscle = ProgressionTaxonomy.MUSCLE.stream()
            .map(k -> skillLevel(byKey, k, "MUSCLE")).toList();

        BigDecimal athleteLevel = rows.isEmpty() ? null
            : round1(ProgressionTaxonomy.ATHLETIC.stream().mapToInt(k -> levelOf(byKey, k)).average().orElse(1));

        double muscleMean = ProgressionTaxonomy.MUSCLE.stream().mapToInt(k -> levelOf(byKey, k)).average().orElse(1);
        double blend = properties.radar().strengthMuscleBlend();
        double ero = levelOf(byKey, "max_strength") * (1 - blend) + muscleMean * blend;
        List<RadarAxis> axes = List.of(
            axis("Erő", round1(ero)),
            axis("Robbanékonyság", meanLevel(byKey, "explosiveness", "vertical_jump")),
            axis("Sebesség", meanLevel(byKey, "sprint_speed")),
            axis("Állóképesség", meanLevel(byKey, "aerobic_capacity", "strength_endurance", "anaerobic_capacity")),
            axis("Mozgékonyság", meanLevel(byKey, "mobility", "core_stability")),
            axis("Koordináció", meanLevel(byKey, "agility", "coordination")));

        ProfileHighlights highlights = ProfileHighlights.builder()
            .bestAthletic(bestRow(rows, "ATHLETIC", true))
            .bestMuscle(bestRow(rows, "MUSCLE", false))
            .build();

        return ProgressionProfileResponse.builder()
            .athleteLevel(athleteLevel)
            .streakWeeks(robustnessCalculator.streakWeeks(createdBy))
            .athletic(athletic).muscle(muscle).radarAxes(axes).highlights(highlights)
            .build();
    }

    private SkillLevel skillLevel(Map<String, SkillProgressEntity> byKey, String key, String kind) {
        SkillProgressEntity r = byKey.get(key);
        long cum = r != null ? r.getCumulativeXp() : 0L;
        int level = r != null ? r.getCurrentLevel() : 1;
        return SkillLevel.builder().skillKey(key).kind(kind).level(level)
            .cumulativeXp(cum).progressPct(round1(curve.progressPct(cum, level))).build();
    }

    private int levelOf(Map<String, SkillProgressEntity> byKey, String key) {
        SkillProgressEntity r = byKey.get(key);
        return r != null ? r.getCurrentLevel() : 1;
    }

    private BigDecimal meanLevel(Map<String, SkillProgressEntity> byKey, String... keys) {
        return round1(Arrays.stream(keys).mapToInt(k -> levelOf(byKey, k)).average().orElse(1));
    }

    private RadarAxis axis(String name, BigDecimal value) {
        return RadarAxis.builder().axis(name).value(value).build();
    }

    /** Best EXISTING row of a kind by (level, cumulativeXp); athletic optionally excludes robustness. */
    private SkillRef bestRow(List<SkillProgressEntity> rows, String kind, boolean excludeRobustness) {
        return rows.stream()
            .filter(r -> kind.equals(r.getSkillKind()))
            .filter(r -> !excludeRobustness || !ProgressionTaxonomy.ROBUSTNESS.equals(r.getSkillKey()))
            .max(Comparator.comparingInt(SkillProgressEntity::getCurrentLevel)
                .thenComparingLong(SkillProgressEntity::getCumulativeXp))
            .map(r -> SkillRef.builder().skillKey(r.getSkillKey()).level(r.getCurrentLevel()).build())
            .orElse(null);
    }

    private static BigDecimal round1(double v) {
        return BigDecimal.valueOf(Math.round(v * 10) / 10.0);
    }

    /** Add an ATHLETIC delta only when positive (keeps the payload free of 0-XP gains). */
    private void addAthletic(Map<String, Long> deltas, Map<String, String> kinds, String key, long xp) {
        if (xp > 0) {
            deltas.merge(key, xp, Long::sum);
            kinds.put(key, "ATHLETIC");
        }
    }

    /**
     * Shared progression tail for every family: idempotent on (sourceType, sourceRefId), applies
     * the per-skill XP deltas, builds gains/level-ups/perks, recomputes streak robustness, writes
     * one level_up_event, and returns the payload. Called inside the caller's @Transactional.
     */
    private LevelUpResult award(UUID createdBy, String sourceType, UUID sourceRefId,
        Map<String, Long> deltas, Map<String, String> kinds, String label,
        Integer durationMin, Integer rpe) {

        // Idempotency: a workout grants XP once — return the stored payload on re-apply.
        var existing = levelUpEventRepository
            .findByCreatedByAndSourceTypeAndSourceRefId(createdBy, sourceType, sourceRefId);
        if (existing.isPresent()) {
            return existing.get().getPayload();
        }

        // apply deltas → skill_progress, build gains + level-ups + perks
        List<LevelUpResult.Gain> gains = new ArrayList<>();
        List<String> levelUps = new ArrayList<>();
        List<LevelUpResult.Perk> perks = new ArrayList<>();
        long totalXp = 0;
        for (Map.Entry<String, Long> e : deltas.entrySet()) {
            String key = e.getKey();
            long delta = e.getValue();
            totalXp += delta;
            SkillProgressEntity row = upsert(createdBy, key, kinds.get(key), delta);
            int before = levelBefore(row.getCumulativeXp() - delta);
            int after = curve.levelFor(row.getCumulativeXp());
            gains.add(new LevelUpResult.Gain(key, kinds.get(key), key, null, delta, before, after,
                curve.progressPct(row.getCumulativeXp() - delta, before),
                curve.progressPct(row.getCumulativeXp(), after)));
            if (after > before) {
                levelUps.add(key);
                perks.addAll(resolvePerks(createdBy, key, before, after));
            }
        }

        // robustness (streak-only, absolute target → idempotent within a week)
        int streak = robustnessCalculator.streakWeeks(createdBy);
        long robustnessTarget = (long) streak * properties.robustness().perWeekXp();
        SkillProgressEntity rob = skillProgressRepository
            .findByCreatedByAndSkillKey(createdBy, "robustness").orElseGet(() -> {
                SkillProgressEntity r = new SkillProgressEntity();
                r.setCreatedBy(createdBy);
                r.setSkillKey("robustness");
                r.setSkillKind("ATHLETIC");
                return r;
            });
        long robustnessDelta = Math.max(0, robustnessTarget - rob.getCumulativeXp());
        rob.setCumulativeXp(robustnessTarget);
        rob.setCurrentLevel(curve.levelFor(robustnessTarget));
        skillProgressRepository.save(rob);
        totalXp += robustnessDelta;

        LevelUpResult payload = new LevelUpResult(sourceType, label, durationMin, rpe, totalXp,
            gains, levelUps, perks, new LevelUpResult.Robustness(robustnessDelta, streak));

        LevelUpEventEntity event = new LevelUpEventEntity();
        event.setCreatedBy(createdBy);
        event.setSourceType(sourceType);
        event.setSourceRefId(sourceRefId);
        event.setTotalXp(totalXp);
        event.setPayload(payload);
        levelUpEventRepository.save(event);

        return payload;
    }

    private SkillProgressEntity upsert(UUID createdBy, String key, String kind, long delta) {
        SkillProgressEntity row = skillProgressRepository
            .findByCreatedByAndSkillKey(createdBy, key).orElseGet(() -> {
                SkillProgressEntity r = new SkillProgressEntity();
                r.setCreatedBy(createdBy);
                r.setSkillKey(key);
                r.setSkillKind(kind);
                return r;
            });
        row.setCumulativeXp(row.getCumulativeXp() + delta);
        row.setCurrentLevel(curve.levelFor(row.getCumulativeXp()));
        return skillProgressRepository.save(row);
    }

    private int levelBefore(long cumBefore) {
        return curve.levelFor(Math.max(0, cumBefore));
    }

    /** Every milestone strictly crossed by before→after unlocks its perk (if catalogued, once). */
    private List<LevelUpResult.Perk> resolvePerks(UUID createdBy, String key, int before, int after) {
        List<LevelUpResult.Perk> out = new ArrayList<>();
        for (int m : MILESTONES) {
            if (m > before && m <= after) {
                perkCatalog.find(key, m).ifPresent(def -> {
                    if (perkUnlockRepository.findByCreatedByOrderByUnlockedAtAsc(createdBy).stream()
                        .noneMatch(p -> p.getPerkKey().equals(def.perkKey()))) {
                        PerkUnlockEntity unlock = new PerkUnlockEntity();
                        unlock.setCreatedBy(createdBy);
                        unlock.setSkillKey(key);
                        unlock.setPerkKey(def.perkKey());
                        unlock.setMilestoneLevel(m);
                        perkUnlockRepository.save(unlock);
                        out.add(new LevelUpResult.Perk(key, def.perkKey(), def.name(),
                            def.effectCopy(), m));
                    }
                });
            }
        }
        return out;
    }
}
