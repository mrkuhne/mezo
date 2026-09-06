package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.habit.entity.HabitDayEntity;
import io.mrkuhne.mezo.feature.habit.repository.HabitDayRepository;
import io.mrkuhne.mezo.feature.journal.repository.DecisionEntryRepository;
import io.mrkuhne.mezo.feature.journal.repository.GratitudeEntryRepository;
import io.mrkuhne.mezo.feature.journal.repository.JournalEntryRepository;
import io.mrkuhne.mezo.feature.needs.repository.NeedsDayRepository;
import io.mrkuhne.mezo.feature.proactive.config.QuestionProperties;
import io.mrkuhne.mezo.feature.ritual.repository.RitualDayRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Round 2 S5 (bd mezo-d58h.7.5, spec 2026-09-05 §(17)): which feature FAMILY the user genuinely used
 * and then stopped touching. There is no usage-events table, so the signal is derived from the
 * domain tables' own {@code created_at} — the row IS the interaction.
 *
 * <p><b>Two families, fixed order.</b> {@code mind} (journal + gratitude + decisions + habits +
 * ritual + needs) is checked before {@code chat}. They are separate questions to ask, so a live
 * journal must not hide a chat that went silent months ago — but only ONE question is ever asked,
 * so the order has to be decided somewhere, and it is decided here.
 *
 * <p><b>Trap: not every row is a user action.</b> {@code habit_day} rows are materialized by
 * {@code HabitService} on any read ({@code pending}) and closed by a cron ({@code missed}) — only
 * {@code done} counts. {@code ai_message} holds the assistant's replies too — only
 * {@code role = 'user'} counts. Counting either naively would make an untouched surface look heavily
 * used, and would let the app's own writes revive an abandoned family.
 *
 * <p><b>Honesty gate:</b> fewer than {@code minPriorRows} rows EVER means the family was never
 * really used, which is not abandonment — {@link Optional#empty()}, never a question.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class FeatureAbandonmentDetector {

    /** Journal + gratitude + decisions + habits + ritual + needs — the "mind" surfaces. */
    public static final String FAMILY_MIND = "mind";
    /** The AI chat, as its own family (spec §(17): "separately: AI chat"). */
    public static final String FAMILY_CHAT = "chat";

    /**
     * @param family    {@link #FAMILY_MIND} or {@link #FAMILY_CHAT}
     * @param priorRows how much the user wrote there BEFORE going quiet (the card's evidence)
     * @param idleDays  the window that came back empty (the card's evidence)
     */
    public record Abandonment(String family, long priorRows, int idleDays) {
    }

    private final JournalEntryRepository journalEntryRepository;
    private final GratitudeEntryRepository gratitudeEntryRepository;
    private final DecisionEntryRepository decisionEntryRepository;
    private final HabitDayRepository habitDayRepository;
    private final RitualDayRepository ritualDayRepository;
    private final NeedsDayRepository needsDayRepository;
    private final AiMessageRepository aiMessageRepository;
    private final QuestionProperties properties;

    /** The first abandoned family, or empty when both are alive (or neither was ever used). */
    @Transactional(readOnly = true)
    public Optional<Abandonment> detect(UUID userId) {
        QuestionProperties.FeatureAbandonment cfg = properties.featureAbandonment();
        Instant since = Instant.now().minus(cfg.idleDays(), ChronoUnit.DAYS);
        Optional<Abandonment> mind =
            verdict(FAMILY_MIND, mindRows(userId), mindFresh(userId, since), cfg);
        return mind.isPresent() ? mind
            : verdict(FAMILY_CHAT, chatRows(userId), chatFresh(userId, since), cfg);
    }

    private static Optional<Abandonment> verdict(String family, long priorRows, boolean fresh,
                                                 QuestionProperties.FeatureAbandonment cfg) {
        if (fresh || priorRows < cfg.minPriorRows()) {
            return Optional.empty();
        }
        return Optional.of(new Abandonment(family, priorRows, cfg.idleDays()));
    }

    private long mindRows(UUID userId) {
        return journalEntryRepository.countByCreatedBy(userId)
            + gratitudeEntryRepository.countByCreatedBy(userId)
            + decisionEntryRepository.countByCreatedBy(userId)
            + habitDayRepository.countByCreatedByAndStatus(userId, HabitDayEntity.STATUS_DONE)
            + ritualDayRepository.countByCreatedBy(userId)
            + needsDayRepository.countByCreatedBy(userId);
    }

    private boolean mindFresh(UUID userId, Instant since) {
        return journalEntryRepository.existsByCreatedByAndCreatedAtAfter(userId, since)
            || gratitudeEntryRepository.existsByCreatedByAndCreatedAtAfter(userId, since)
            || decisionEntryRepository.existsByCreatedByAndCreatedAtAfter(userId, since)
            || habitDayRepository.existsByCreatedByAndStatusAndCreatedAtAfter(
                userId, HabitDayEntity.STATUS_DONE, since)
            || ritualDayRepository.existsByCreatedByAndCreatedAtAfter(userId, since)
            || needsDayRepository.existsByCreatedByAndCreatedAtAfter(userId, since);
    }

    private long chatRows(UUID userId) {
        return aiMessageRepository.countByCreatedByAndRole(userId, AiMessageEntity.ROLE_USER);
    }

    private boolean chatFresh(UUID userId, Instant since) {
        return aiMessageRepository.existsByCreatedByAndRoleAndCreatedAtAfter(
            userId, AiMessageEntity.ROLE_USER, since);
    }
}
