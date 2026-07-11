package io.mrkuhne.mezo.feature.quest.service;

import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.quest.QuestCatalog;
import io.mrkuhne.mezo.feature.quest.config.QuestProperties;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.quest.entity.QuestTargetEnvelope;
import io.mrkuhne.mezo.feature.quest.repository.DailyQuestRepository;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Deterministic daily-quest selection (E1, bd mezo-df7q): rule-based, seeded by (user, date, slot)
 * — no LLM in the economy (ADR 0010). Filters: slot, day type (planned template → GYM else REST),
 * goal-prescription requirement, per-key cooldown window, distinct metrics within the day.
 * Cooldown yields to availability: an empty pool re-admits cooled-down keys rather than leaving
 * the slot empty.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.QUEST_SWITCH, havingValue = "true")
public class QuestSelector {

    private static final int COOLDOWN_LOOKBACK_DAYS = 7;
    private static final List<String> SLOTS =
        List.of(DailyQuestEntity.SLOT_BODY, DailyQuestEntity.SLOT_FUELBIO, DailyQuestEntity.SLOT_GROWTH);

    private final QuestCatalog catalog;
    private final DailyQuestRepository repository;
    private final WorkoutService workoutService;
    private final GoalRepository goalRepository;
    private final QuestProperties properties;

    @Transactional
    public List<DailyQuestEntity> generate(UUID userId, LocalDate date) {
        String dayType = workoutService.findPlannedTemplateForDate(userId, date).isPresent()
            ? "GYM" : "REST";
        GoalPrescriptionJson.Segment segment = currentSegment(userId, date);
        List<DailyQuestEntity> recent =
            repository.findByCreatedByAndQuestDateGreaterThanEqual(userId, date.minusDays(COOLDOWN_LOOKBACK_DAYS));

        List<DailyQuestEntity> out = new ArrayList<>();
        Set<String> usedMetrics = new HashSet<>();
        for (String slot : SLOTS) {
            pick(userId, date, slot, dayType, segment, recent, usedMetrics, 0)
                .ifPresent(q -> {
                    usedMetrics.add(q.getTarget().metric());
                    out.add(repository.saveAndFlush(q));
                });
        }
        return out;
    }

    /** Replacement for a reroll: same slot, excludes every catalog key already used today. */
    @Transactional
    public Optional<DailyQuestEntity> replacement(UUID userId, DailyQuestEntity old, int salt) {
        String dayType = workoutService.findPlannedTemplateForDate(userId, old.getQuestDate()).isPresent()
            ? "GYM" : "REST";
        GoalPrescriptionJson.Segment segment = currentSegment(userId, old.getQuestDate());
        List<DailyQuestEntity> today =
            repository.findByCreatedByAndQuestDateOrderBySlotAsc(userId, old.getQuestDate());
        Set<String> usedKeys = new HashSet<>();
        Set<String> usedMetrics = new HashSet<>();
        for (DailyQuestEntity q : today) {
            usedKeys.add(q.getCatalogKey());
            if (!DailyQuestEntity.STATUS_REROLLED.equals(q.getStatus()) && !q.getId().equals(old.getId())) {
                usedMetrics.add(q.getTarget().metric());
            }
        }
        List<QuestCatalog.QuestDef> eligiblePool = eligible(old.getSlot(), dayType, segment, usedMetrics).stream()
            .filter(d -> !usedKeys.contains(d.key()))
            .toList();
        if (eligiblePool.isEmpty()) {
            return Optional.empty();
        }
        Set<Integer> allowed = allowedDifficulties(userId, old.getQuestDate(), old.getSlot());
        List<QuestCatalog.QuestDef> pool = eligiblePool.stream()
            .filter(d -> allowed.contains(d.difficulty()))
            .toList();
        if (pool.isEmpty()) {
            pool = eligiblePool; // difficulty yields to availability
        }
        QuestCatalog.QuestDef def =
            pool.get(Math.floorMod(Objects.hash(userId, old.getQuestDate(), old.getSlot(), salt), pool.size()));
        return Optional.of(repository.saveAndFlush(toEntity(userId, old.getQuestDate(), def, segment)));
    }

    private Optional<DailyQuestEntity> pick(UUID userId, LocalDate date, String slot, String dayType,
        GoalPrescriptionJson.Segment segment, List<DailyQuestEntity> recent,
        Set<String> usedMetrics, int salt) {

        Set<Integer> allowed = allowedDifficulties(userId, date, slot);
        List<QuestCatalog.QuestDef> base = eligible(slot, dayType, segment, usedMetrics);
        List<QuestCatalog.QuestDef> banded = base.stream()
            .filter(d -> allowed.contains(d.difficulty()))
            .toList();
        if (banded.isEmpty()) {
            banded = base; // difficulty yields to availability
        }
        List<QuestCatalog.QuestDef> pool = banded.stream()
            .filter(d -> !inCooldown(d, date, recent))
            .toList();
        if (pool.isEmpty()) {
            pool = banded; // cooldown yields to availability (existing rule)
        }
        if (pool.isEmpty()) {
            return Optional.empty(); // honest: no eligible quest for this slot today
        }
        QuestCatalog.QuestDef def =
            pool.get(Math.floorMod(Objects.hash(userId, date, slot, salt), pool.size()));
        return Optional.of(toEntity(userId, date, def, segment));
    }

    /** Allowed difficulty tiers for a slot from its trailing completion ratio (E3, spec §4). */
    private Set<Integer> allowedDifficulties(UUID userId, LocalDate date, String slot) {
        QuestProperties.Adaptive a = properties.adaptive();
        LocalDate from = date.minusDays(a.windowDays());
        LocalDate to = date.minusDays(1);
        int completed = repository.countByCreatedByAndSlotAndStatusAndQuestDateBetween(
            userId, slot, DailyQuestEntity.STATUS_COMPLETED, from, to);
        int expired = repository.countByCreatedByAndSlotAndStatusAndQuestDateBetween(
            userId, slot, DailyQuestEntity.STATUS_EXPIRED, from, to);
        int closed = completed + expired;
        if (closed < a.minSample()) {
            return Set.of(1, 2, 3); // not enough signal — v1 behavior
        }
        double ratio = (double) completed / closed;
        if (ratio >= a.highRatio()) {
            return Set.of(1, 2, 3);
        }
        if (ratio <= a.lowRatio()) {
            return Set.of(1);
        }
        return Set.of(1, 2);
    }

    private List<QuestCatalog.QuestDef> eligible(String slot, String dayType,
        GoalPrescriptionJson.Segment segment, Set<String> usedMetrics) {
        return catalog.all().stream()
            .filter(d -> d.slot().equals(slot))
            .filter(d -> d.dayTypes().contains("ANY") || d.dayTypes().contains(dayType))
            .filter(d -> !d.requiresGoalPrescription() || segment != null)
            .filter(d -> !usedMetrics.contains(d.metric()))
            .toList();
    }

    private boolean inCooldown(QuestCatalog.QuestDef d, LocalDate date, List<DailyQuestEntity> recent) {
        if (d.cooldownDays() == 0) {
            return false;
        }
        return recent.stream().anyMatch(q -> q.getCatalogKey().equals(d.key())
            && !q.getQuestDate().isBefore(date.minusDays(d.cooldownDays()))
            && q.getQuestDate().isBefore(date));
    }

    private DailyQuestEntity toEntity(UUID userId, LocalDate date, QuestCatalog.QuestDef def,
        GoalPrescriptionJson.Segment segment) {
        DailyQuestEntity e = new DailyQuestEntity();
        e.setCreatedBy(userId);
        e.setQuestDate(date);
        e.setSlot(def.slot());
        e.setCatalogKey(def.key());
        e.setSkillKey(def.skillKey());
        e.setSkillKind(def.skillKind());
        e.setTitle(def.title());
        e.setWhy(def.why());
        e.setCompletionMode(def.mode());
        e.setTarget(new QuestTargetEnvelope(def.metric(), resolveThreshold(def, segment)));
        e.setXp(def.xp());
        e.setCoins(def.coins());
        e.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return e;
    }

    /** protein_target resolves from the prescription's current segment; everything else is catalog-static. */
    private BigDecimal resolveThreshold(QuestCatalog.QuestDef def, GoalPrescriptionJson.Segment segment) {
        if ("protein_target".equals(def.metric()) && segment != null && segment.proteinG() != null) {
            return BigDecimal.valueOf(segment.proteinG());
        }
        return def.threshold();
    }

    private GoalPrescriptionJson.Segment currentSegment(UUID userId, LocalDate date) {
        GoalEntity goal = goalRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active")
            .stream().findFirst().orElse(null);
        if (goal == null || goal.getPrescription() == null) {
            return null;
        }
        long week = ChronoUnit.DAYS.between(goal.getStartDate(), date) / 7 + 1;
        return GoalPrescriptionJson.currentSegment(goal.getPrescription(), week);
    }
}
