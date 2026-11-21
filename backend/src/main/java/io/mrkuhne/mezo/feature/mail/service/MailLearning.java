package io.mrkuhne.mezo.feature.mail.service;

import io.mrkuhne.mezo.feature.mail.entity.MailFeedbackEntity;
import io.mrkuhne.mezo.feature.mail.entity.MailItemEntity;
import io.mrkuhne.mezo.feature.mail.entity.MailMessageEntity;
import io.mrkuhne.mezo.feature.mail.config.MailProperties;
import io.mrkuhne.mezo.feature.mail.repository.MailFeedbackRepository;
import io.mrkuhne.mezo.feature.mail.repository.MailItemRepository;
import io.mrkuhne.mezo.feature.mail.repository.MailMessageRepository;
import io.mrkuhne.mezo.feature.mail.service.classify.ScorePrompt;
import io.mrkuhne.mezo.feature.mail.service.classify.SenderPrior;
import io.mrkuhne.mezo.feature.mail.service.rules.SenderRule;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What the morning post learns from "érdekel / nem érdekel" (spec §5.5, mezo-r36n9.39): each tap is stored per item;
 * two effects follow — a per-sender prior outside the model ({@link SenderPrior}, 90-day half-life) and recent deal
 * verdicts as few-shot examples; three "nem érdekel" in a row from one sender propose a silent rule. Nothing is
 * applied without the owner's tap: a proposal is only returned.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.MAIL_SWITCH, havingValue = "true")
public class MailLearning {

    /** A sender the owner has dismissed several times in a row and is not silent yet: "csendben elteszem?". */
    public record SilentProposal(String fromAddr, int nopes) {
    }

    private static final int SUMMARY_MAX = 200;

    private final MailFeedbackRepository feedback;
    private final MailItemRepository items;
    private final MailMessageRepository messages;
    private final MailIntakeStore intakeStore;
    private final MailProperties properties;

    /**
     * Stores the owner's tap on one of his items. A second tap on the same item replaces the first. A sensitive item
     * keeps only its sender as the summary.
     */
    @Transactional
    public void feedback(UUID user, UUID itemId, Verdict verdict) {
        MailItemEntity item = items.findById(itemId).filter(i -> user.equals(i.getCreatedBy()))
            .orElseThrow(MailLearning::notFound);
        MailMessageEntity message = messages.findById(item.getMessageId()).orElseThrow(MailLearning::notFound);
        MailFeedbackEntity row = feedback.findByCreatedByAndItemId(user, itemId).orElseGet(() -> {
            MailFeedbackEntity f = new MailFeedbackEntity();
            f.setCreatedBy(user);
            f.setItemId(itemId);
            return f;
        });
        row.setVerdict(verdict.column());
        row.setFromAddr(message.getFromAddr());
        row.setSummary("sensitive".equals(item.getGrp()) ? clip(item.getTitle(), SUMMARY_MAX)
            : clip(item.getTitle() + " — " + item.getSummary(), SUMMARY_MAX));
        feedback.saveAndFlush(row);
    }

    /** Senders with at least {@code silentAfterNopes} "nem érdekel" in a row (latest taps first) and no silent rule. */
    @Transactional(readOnly = true)
    public List<SilentProposal> proposals(UUID user) {
        Map<String, Integer> streak = new LinkedHashMap<>();
        Map<String, Boolean> broken = new HashMap<>();
        for (MailFeedbackEntity f : feedback.findByCreatedByOrderByCreatedAtDescIdDesc(user)) {
            String sender = f.getFromAddr().toLowerCase(Locale.ROOT);
            if (Boolean.TRUE.equals(broken.get(sender))) {
                continue;
            }
            if (Verdict.NOPE.column().equals(f.getVerdict())) {
                streak.merge(sender, 1, Integer::sum);
            } else {
                broken.put(sender, true);
            }
        }
        List<SenderRule> silent = intakeStore.ownerRules(user).stream().filter(r -> r.kind() == SenderRule.Kind.SILENT)
            .toList();
        List<SilentProposal> out = new ArrayList<>();
        streak.forEach((sender, nopes) -> {
            if (nopes >= properties.silentAfterNopes() && silent.stream().noneMatch(r -> r.matches(sender))) {
                out.add(new SilentProposal(sender, nopes));
            }
        });
        return out;
    }

    /** Up to {@code limit} of the owner's most recent verdicts on deals, newest first, as few-shot examples. */
    @Transactional(readOnly = true)
    public List<ScorePrompt.Example> examples(UUID user, int limit) {
        if (limit <= 0) {
            return List.of();
        }
        return feedback.recentDealFeedback(user, PageRequest.of(0, limit)).stream()
            .map(f -> new ScorePrompt.Example(f.getSummary(), label(f.getVerdict()))).toList();
    }

    /**
     * The score shift per sender (lower-cased address), from every tap with a half-life weight at {@code now}.
     * Senders without taps are absent (no shift).
     */
    @Transactional(readOnly = true)
    public Map<String, Double> senderShifts(UUID user, Instant now) {
        record Tally(int[] counts, double[] weight) {
        }
        Map<String, Tally> tallies = new HashMap<>();
        for (MailFeedbackEntity f : feedback.findByCreatedByOrderByCreatedAtDescIdDesc(user)) {
            Tally t = tallies.computeIfAbsent(f.getFromAddr().toLowerCase(Locale.ROOT),
                k -> new Tally(new int[2], new double[1]));
            t.counts()[Verdict.INTEREST.column().equals(f.getVerdict()) ? 0 : 1]++;
            double ageDays = Duration.between(f.getCreatedAt(), now).toSeconds() / 86_400.0;
            t.weight()[0] += SenderPrior.weight(ageDays, properties.feedbackHalfLifeDays());
        }
        Map<String, Double> out = new HashMap<>();
        tallies.forEach((sender, t) -> out.put(sender, SenderPrior.shift(t.counts()[0], t.counts()[1], t.weight()[0])));
        return out;
    }

    private static String label(String column) {
        return Verdict.INTEREST.column().equals(column) ? Verdict.INTEREST.label() : Verdict.NOPE.label();
    }

    private static String clip(String s, int max) {
        String t = s == null ? "" : s.strip();
        return t.length() <= max ? t : t.substring(0, max).strip();
    }

    private static SystemRuntimeErrorException notFound() {
        return new SystemRuntimeErrorException(SystemMessage.error("MAIL_ITEM_NOT_FOUND").build(),
            HttpStatus.NOT_FOUND);
    }
}
