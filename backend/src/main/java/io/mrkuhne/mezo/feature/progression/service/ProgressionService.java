package io.mrkuhne.mezo.feature.progression.service;

import io.mrkuhne.mezo.feature.progression.PerkCatalog;
import io.mrkuhne.mezo.feature.progression.ProgressionCurve;
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
import java.util.ArrayList;
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
