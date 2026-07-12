package io.mrkuhne.mezo.feature.activity.service;

import io.mrkuhne.mezo.api.dto.ActivityResponse;
import io.mrkuhne.mezo.api.dto.ActivityWriteResponse;
import io.mrkuhne.mezo.feature.activity.config.ActivityProperties;
import io.mrkuhne.mezo.feature.activity.entity.ActivityExtract;
import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.activity.mapper.ActivityMapper;
import io.mrkuhne.mezo.feature.activity.repository.ActivityLogRepository;
import io.mrkuhne.mezo.feature.progression.ProgressionGate;
import io.mrkuhne.mezo.feature.progression.ProgressionTaxonomy;
import io.mrkuhne.mezo.feature.progression.activity.ActivitySignal;
import io.mrkuhne.mezo.feature.progression.entity.LevelUpResult;
import io.mrkuhne.mezo.feature.progression.mapper.LevelUpResultMapper;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.feature.quest.mapper.QuestMapper;
import io.mrkuhne.mezo.feature.quest.service.QuestService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Activity-log write/read/categorize (E2, bd mezo-jzca, spec §5). The classifier PROPOSES; this
 * service DISPOSES: XP clamped into [xpMin, xpMax], bounded by the per-skill and per-day daily
 * caps, granted once per entry through the idempotent progression tail (source ACTIVITY). A
 * confident classification (or manual categorization) also completes the day's matching open
 * activity-mode quest — the self-report tap is a mini-journal entry, never an empty checkbox.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.ACTIVITY_SWITCH, havingValue = "true")
public class ActivityService {

    private static final int LABEL_MAX = 60;

    private final ActivityLogRepository repository;
    private final ActivityMapper mapper;
    private final ActivityProperties properties;
    private final ObjectProvider<ActivityClassifier> classifier;      // needs companion switch too
    private final ObjectProvider<QuestService> questService;          // quest switch may be off
    private final ObjectProvider<ProgressionGate> progressionGate;    // progression switch may be off
    private final ProgressionService progressionService;
    private final LevelUpResultMapper levelUpResultMapper;
    private final QuestMapper questMapper;

    @Transactional
    public ActivityWriteResponse create(UUID userId, String text, LocalDate occurredOn) {
        if (text == null || text.isBlank()) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("ACTIVITY_TEXT_REQUIRED").build(), HttpStatus.BAD_REQUEST);
        }
        LocalDate day = occurredOn != null ? occurredOn : LocalDate.now();
        ActivityLogEntity e = new ActivityLogEntity();
        e.setCreatedBy(userId);
        e.setOccurredOn(day);
        e.setText(text.strip());
        e.setXpSuggested(properties.defaultXp());

        ActivityClassifier c = classifier.getIfAvailable();
        if (c != null) {
            c.classify(e.getText()).ifPresent(cl -> {
                if (cl.xpSuggestion() != null) {
                    e.setXpSuggested(clamp(cl.xpSuggestion()));
                }
                e.setConfidence(cl.confidence());
                e.setExtracted(cl.durationMin() != null || cl.amountHuf() != null
                    ? new ActivityExtract(cl.durationMin(), cl.amountHuf()) : null);
                boolean confident = cl.skillKey() != null && cl.confidence() != null
                    && cl.confidence().doubleValue() >= properties.confidenceThreshold();
                if (confident) {
                    e.setSkillKey(cl.skillKey());
                    e.setCategorizedBy(ActivityLogEntity.BY_AI);
                }
            });
        }
        repository.saveAndFlush(e); // id needed for the idempotent award + quest provenance
        List<LevelUpResult> levelUps = new ArrayList<>();
        QuestService.ActivityQuestCompletion completion = null;
        if (e.getSkillKey() != null) {
            grantXp(userId, e, levelUps);
            completion = completeQuest(userId, e, levelUps);
        }
        return response(e, completion, levelUps);
    }

    @Transactional(readOnly = true)
    public List<ActivityResponse> getDay(UUID userId, LocalDate date) {
        return repository.findByCreatedByAndOccurredOnOrderByCreatedAtDesc(userId, date)
            .stream().map(mapper::toResponse).toList();
    }

    /** Growth-journal read: entries of the inclusive range, newest first. */
    @Transactional(readOnly = true)
    public List<ActivityResponse> history(UUID userId, LocalDate from, LocalDate to) {
        if (from.isAfter(to)) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("ACTIVITY_INVALID_DATE_RANGE").build(), HttpStatus.BAD_REQUEST);
        }
        return repository.findByCreatedByAndOccurredOnBetween(userId, from, to).stream()
            .sorted(java.util.Comparator.comparing(ActivityLogEntity::getOccurredOn).reversed()
                .thenComparing(ActivityLogEntity::getCreatedAt, java.util.Comparator.reverseOrder()))
            .map(mapper::toResponse)
            .toList();
    }

    @Transactional
    public ActivityWriteResponse categorize(UUID userId, UUID id, String skillKey) {
        if (!ProgressionTaxonomy.LIFE.contains(skillKey)) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("ACTIVITY_SKILL_UNKNOWN").build(), HttpStatus.BAD_REQUEST);
        }
        ActivityLogEntity e = repository.findByIdAndCreatedBy(id, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("ACTIVITY_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        List<LevelUpResult> levelUps = new ArrayList<>();
        QuestService.ActivityQuestCompletion completion = null;
        String previous = e.getSkillKey();
        if (!skillKey.equals(previous)) {
            e.setSkillKey(skillKey);
            e.setCategorizedBy(ActivityLogEntity.BY_USER);
            if (e.getXpAwarded() == 0) {
                grantXp(userId, e, levelUps); // first categorization → grant within remaining caps
            } else if (previous != null && progressionGate.getIfAvailable() != null) {
                progressionService.moveActivityXp(userId, previous, skillKey, e.getXpAwarded());
            }
            completion = completeQuest(userId, e, levelUps);
            repository.save(e);
        }
        return response(e, completion, levelUps);
    }

    /** Deterministic guardrails: clamp the suggestion, bound by the day's remaining budgets. */
    private void grantXp(UUID userId, ActivityLogEntity e, List<LevelUpResult> levelUps) {
        List<ActivityLogEntity> day =
            repository.findByCreatedByAndOccurredOnOrderByCreatedAtDesc(userId, e.getOccurredOn());
        int skillUsed = day.stream()
            .filter(r -> !r.getId().equals(e.getId()) && e.getSkillKey().equals(r.getSkillKey()))
            .mapToInt(ActivityLogEntity::getXpAwarded).sum();
        int dayUsed = day.stream()
            .filter(r -> !r.getId().equals(e.getId()))
            .mapToInt(ActivityLogEntity::getXpAwarded).sum();
        int grant = Math.max(0, Math.min(e.getXpSuggested(),
            Math.min(properties.perSkillDailyCap() - skillUsed, properties.dailyCap() - dayUsed)));
        e.setXpAwarded(grant);
        repository.save(e);
        if (grant > 0 && progressionGate.getIfAvailable() != null) {
            levelUps.add(progressionService.applyActivity(userId,
                new ActivitySignal(e.getId(), e.getSkillKey(), grant, label(e.getText()))));
        }
    }

    private QuestService.ActivityQuestCompletion completeQuest(
        UUID userId, ActivityLogEntity e, List<LevelUpResult> levelUps) {
        QuestService qs = questService.getIfAvailable();
        if (qs == null) {
            return null;
        }
        QuestService.ActivityQuestCompletion completion = qs
            .completeMatchingActivityQuest(userId, e.getOccurredOn(), e.getSkillKey(), e.getId())
            .orElse(null);
        if (completion != null && completion.levelUp() != null) {
            levelUps.add(completion.levelUp());
        }
        return completion;
    }

    private ActivityWriteResponse response(ActivityLogEntity e,
        QuestService.ActivityQuestCompletion completion, List<LevelUpResult> levelUps) {
        return ActivityWriteResponse.builder()
            .entry(mapper.toResponse(e))
            .completedQuest(completion != null ? questMapper.toQuestResponse(completion.quest()) : null)
            .levelUps(levelUps.stream().map(levelUpResultMapper::toDto).toList())
            .build();
    }

    private int clamp(int suggestion) {
        return Math.max(properties.xpMin(), Math.min(properties.xpMax(), suggestion));
    }

    private static String label(String text) {
        return text.length() <= LABEL_MAX ? text : text.substring(0, LABEL_MAX - 1) + "…";
    }
}
