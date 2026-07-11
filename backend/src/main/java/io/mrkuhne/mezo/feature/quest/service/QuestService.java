package io.mrkuhne.mezo.feature.quest.service;

import io.mrkuhne.mezo.api.dto.QuestDayResponse;
import io.mrkuhne.mezo.api.dto.QuestResponse;
import io.mrkuhne.mezo.feature.progression.ProgressionGate;
import io.mrkuhne.mezo.feature.progression.entity.LevelUpResult;
import io.mrkuhne.mezo.feature.progression.mapper.LevelUpResultMapper;
import io.mrkuhne.mezo.feature.progression.quest.QuestSignal;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.feature.quest.config.QuestProperties;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.quest.mapper.QuestMapper;
import io.mrkuhne.mezo.feature.quest.repository.DailyQuestRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Daily-quest read + lifecycle (E1, bd mezo-df7q): the day read lazily generates (today only),
 * evaluates offered derived quests (completion awards XP through progression — atomically with
 * the status flip), and quietly expires offered quests of past days (ADR 0010 — no failure
 * state). Rerolled rows are excluded from display. levelUps carries exactly the payloads this
 * evaluation pass produced — re-reads return [] (award is idempotent, statuses are terminal).
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.QUEST_SWITCH, havingValue = "true")
public class QuestService {

    private final DailyQuestRepository repository;
    private final QuestSelector selector;
    private final QuestEvaluator evaluator;
    private final QuestMapper mapper;
    private final ProgressionService progressionService;
    private final LevelUpResultMapper levelUpResultMapper;
    private final ObjectProvider<ProgressionGate> progressionGate;
    private final QuestProperties properties;

    @Transactional
    public QuestDayResponse getDay(UUID userId, LocalDate date) {
        List<DailyQuestEntity> rows = repository.findByCreatedByAndQuestDateOrderBySlotAsc(userId, date);
        if (rows.isEmpty() && date.equals(LocalDate.now())) {
            try {
                rows = selector.generate(userId, date); // lazy first offer, today only
            } catch (DataIntegrityViolationException e) {
                // lost the race against the morning generate cron — the rows exist now, re-read
                rows = repository.findByCreatedByAndQuestDateOrderBySlotAsc(userId, date);
            }
        }
        List<LevelUpResult> levelUps = evaluateAndFinalize(rows, LocalDate.now());
        int rerollsUsed = repository.countByCreatedByAndQuestDateAndStatus(
            userId, date, DailyQuestEntity.STATUS_REROLLED);
        return QuestDayResponse.builder()
            .date(date)
            .quests(rows.stream()
                .filter(q -> !DailyQuestEntity.STATUS_REROLLED.equals(q.getStatus()))
                .map(mapper::toQuestResponse).toList())
            .levelUps(levelUps.stream().map(levelUpResultMapper::toDto).toList())
            .rerollsLeft(Math.max(0, properties.rerollPerDay() - rerollsUsed))
            .build();
    }

    /** Shared with the nightly cron: complete satisfied offered rows (award XP), expire passed ones. */
    @Transactional
    public List<LevelUpResult> evaluateAndFinalize(List<DailyQuestEntity> rows, LocalDate today) {
        List<LevelUpResult> levelUps = new ArrayList<>();
        for (DailyQuestEntity q : rows) {
            if (!DailyQuestEntity.STATUS_OFFERED.equals(q.getStatus())) {
                continue;
            }
            if (evaluator.satisfied(q)) {
                q.setStatus(DailyQuestEntity.STATUS_COMPLETED);
                q.setCompletedAt(Instant.now());
                repository.save(q);
                if (progressionGate.getIfAvailable() != null) {
                    levelUps.add(progressionService.applyQuest(q.getCreatedBy(), new QuestSignal(
                        q.getId(), q.getSkillKey(), q.getSkillKind(), q.getXp(), q.getTitle())));
                }
            } else if (q.getQuestDate().isBefore(today)) {
                q.setStatus(DailyQuestEntity.STATUS_EXPIRED); // quiet — no failure state (ADR 0010)
                repository.save(q);
            }
        }
        return levelUps;
    }

    @Transactional
    public QuestResponse reroll(UUID userId, UUID id) {
        DailyQuestEntity q = repository.findByIdAndCreatedBy(id, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("QUEST_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        if (!DailyQuestEntity.STATUS_OFFERED.equals(q.getStatus())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("QUEST_NOT_OFFERED").build(), HttpStatus.CONFLICT);
        }
        if (!q.getQuestDate().equals(LocalDate.now())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("QUEST_NOT_TODAY").build(), HttpStatus.CONFLICT);
        }
        int rerollsUsed = repository.countByCreatedByAndQuestDateAndStatus(
            userId, q.getQuestDate(), DailyQuestEntity.STATUS_REROLLED);
        if (rerollsUsed >= properties.rerollPerDay()) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("QUEST_REROLL_EXHAUSTED").build(), HttpStatus.CONFLICT);
        }
        q.setStatus(DailyQuestEntity.STATUS_REROLLED);
        repository.saveAndFlush(q); // flush first — the partial unique index frees the slot
        DailyQuestEntity replacement = selector.replacement(userId, q, rerollsUsed + 1)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("QUEST_REROLL_NO_ALTERNATIVE").build(), HttpStatus.CONFLICT));
        return mapper.toQuestResponse(replacement);
    }
}
