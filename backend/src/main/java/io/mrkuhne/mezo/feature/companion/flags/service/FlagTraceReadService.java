package io.mrkuhne.mezo.feature.companion.flags.service;

import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagLogEntity;
import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagTraceEntity;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagLogRepository;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagTraceRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * One day of the coaching engine's decision, rendered from what the engine already concluded
 * (spec 2026-09-05 §5). It RECOMPUTES NOTHING: the verdict comes from {@code companion_flag_trace},
 * the RAISED evidence from the raise's own frozen {@code companion_flag_log.payload}, the ordering
 * from {@link AdviceRankPort} and the winner from {@link DailyCardPort} — both sides read back.
 *
 * <p>Gated on BOTH switches because it depends on the two proactive-supplied ports: with proactive
 * off there is no card to explain, so the endpoint honestly does not exist rather than degrading to
 * a half-answer.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
    havingValue = "true")
public class FlagTraceReadService {

    /** Screen states, before the surface's Hungarian vocabulary is applied. */
    private static final String STATE_SUPPRESSED = "suppressed";
    private static final String OUTCOME_RAISED = "raised";
    private static final String OUTCOME_UNAVAILABLE = "unavailable";
    private static final String DISPOSITION_LOGGED = "logged";
    private static final String DISPOSITION_SUPPRESSED = "suppressed_by_cooldown";
    private static final String CARD_WON = "won";
    private static final String CARD_LOST = "lost";

    private final CompanionFlagTraceRepository traceRepository;
    private final CompanionFlagLogRepository logRepository;
    private final AdviceRankPort rankPort;
    private final DailyCardPort cardPort;

    /** The day, all 13 rules in severity order, plus the day's transitions. */
    public record TraceDay(LocalDate date, LocalDate earliestDate, Winner winner,
                           List<RuleState> rules, List<Transition> transitions) {
    }

    /** The rule whose raise became the day's card. Null when no card, or when the card came from a
     *  setup check rather than a flag — that key is none of the 13. */
    public record Winner(String flagKey, int rank, UUID cardId) {
    }

    /** One rule's CLOSING state for the day. {@code changedAt} is when it last changed, which may
     *  predate the day; null when the rule has never been evaluated. */
    public record RuleState(String flagKey, String label, String domain, int rank,
                            String outcome, String reasonCode, String reasonText,
                            List<String> facts, String disposition, String cardOutcome,
                            Instant changedAt) {
    }

    /** One change inside the day. {@code from} is null on a rule's very first row. */
    public record Transition(Instant at, String flagKey, String label,
                             String from, String to, String reasonText) {
    }

    @Transactional(readOnly = true)
    public TraceDay read(UUID userId, LocalDate date) {
        ZoneId zone = ZoneId.systemDefault();
        Instant dayStart = date.atStartOfDay(zone).toInstant();
        Instant dayEndExclusive = date.plusDays(1).atStartOfDay(zone).toInstant();
        Instant cutoff = dayEndExclusive.minusMillis(1);

        Optional<DailyCardPort.DeliveredCard> card = cardPort.forDay(userId, date);
        String winnerKey = card.map(DailyCardPort.DeliveredCard::adviceKey)
            .filter(FlagCatalog.KEYS::contains)
            .orElse(null);

        List<String> ordered = new ArrayList<>(FlagCatalog.KEYS);
        ordered.sort(Comparator.comparingInt(rankPort::rankOf));

        List<RuleState> rules = new ArrayList<>();
        for (int i = 0; i < ordered.size(); i++) {
            rules.add(stateOf(userId, ordered.get(i), i + 1, cutoff, winnerKey));
        }

        Winner winner = winnerKey == null ? null : new Winner(winnerKey,
            rules.stream().filter(r -> r.flagKey().equals(winnerKey))
                .findFirst().orElseThrow().rank(),
            card.orElseThrow().cardId());

        Instant earliest = traceRepository.earliestOccurredAt(userId);
        LocalDate earliestDate = earliest == null ? null : LocalDate.ofInstant(earliest, zone);

        return new TraceDay(date, earliestDate, winner, List.copyOf(rules),
            transitions(userId, dayStart, cutoff));
    }

    private RuleState stateOf(UUID userId, String flagKey, int rank, Instant cutoff,
                              String winnerKey) {
        String label = FlagCatalog.labelOf(flagKey);
        String domain = FlagCatalog.domainOf(flagKey);
        CompanionFlagTraceEntity row = traceRepository
            .findFirstByCreatedByAndFlagKeyAndOccurredAtLessThanEqualOrderByOccurredAtDesc(
                userId, flagKey, cutoff)
            .orElse(null);

        if (row == null) {
            // Honest: the engine has never judged this rule. NOT a fabricated "fine".
            return new RuleState(flagKey, label, domain, rank, OUTCOME_UNAVAILABLE,
                FlagTraceCopy.NOT_EVALUATED_YET,
                FlagTraceCopy.unavailableText(FlagTraceCopy.NOT_EVALUATED_YET),
                List.of(), null, null, null);
        }

        List<String> facts;
        String reasonText;
        if (OUTCOME_RAISED.equals(row.getOutcome())) {
            CompanionFlagLogEntity log = logRepository
                .findFirstByCreatedByAndFlagKeyAndDeletedFalseAndCreatedAtLessThanEqualOrderByCreatedAtDesc(
                    userId, flagKey, cutoff)
                .orElse(null);
            List<String> rendered = log == null
                ? List.of() : FlagFactRenderer.render(flagKey, log.getPayload());
            if (log != null && DISPOSITION_SUPPRESSED.equals(row.getDisposition())) {
                // A cooldown-suppressed raise writes NO log row (FlagService logs only on the
                // LOGGED branch), so this payload belongs to a PREVIOUS raise — genuinely the
                // rule's freshest frozen evidence, but NOT today's measurement. Keep it (it is the
                // only real evidence there is) and DATE it: `changedAt` points at today's row, so
                // undated numbers here would read as measured today. That is the dishonesty the
                // observer exists to prevent, hence the date is part of the copy, not a garnish.
                LocalDate frozenOn = LocalDate.ofInstant(log.getCreatedAt(), ZoneId.systemDefault());
                List<String> dated = new ArrayList<>(rendered);
                dated.add(FlagTraceCopy.frozenNumbersFact(frozenOn));
                facts = List.copyOf(dated);
                reasonText = FlagTraceCopy.suppressedRaiseText(frozenOn);
            } else {
                // A LOGGED raise's log row IS the raise being explained — nothing to qualify.
                facts = rendered;
                reasonText = rendered.isEmpty() ? label : rendered.get(0);
            }
        } else if (OUTCOME_UNAVAILABLE.equals(row.getOutcome())) {
            reasonText = FlagTraceCopy.unavailableText(row.getReasonCode());
            facts = List.of();
        } else {
            facts = FlagTraceCopy.clearFacts(row.getEvidence());
            reasonText = FlagTraceCopy.clearText(row.getEvidence());
        }

        String cardOutcome = null;
        if (OUTCOME_RAISED.equals(row.getOutcome())
            && DISPOSITION_LOGGED.equals(row.getDisposition())
            && winnerKey != null) {
            cardOutcome = flagKey.equals(winnerKey) ? CARD_WON : CARD_LOST;
        }

        return new RuleState(flagKey, label, domain, rank, row.getOutcome(), row.getReasonCode(),
            reasonText, facts, row.getDisposition(), cardOutcome, row.getOccurredAt());
    }

    private List<Transition> transitions(UUID userId, Instant from, Instant to) {
        List<CompanionFlagTraceEntity> rows =
            traceRepository.findByCreatedByAndOccurredAtBetweenOrderByOccurredAtAsc(userId, from, to);
        Map<String, String> previous = new HashMap<>();
        for (CompanionFlagTraceEntity row : rows) {
            // The row BEFORE the day's first change for this rule — so a day's first transition
            // reads "from yesterday's state", not "from nothing". A plain containsKey/put (rather
            // than computeIfAbsent) is deliberate: computeIfAbsent does NOT record a mapping when
            // the function returns null, so a rule whose very first-ever row falls on THIS day
            // would be re-queried on its second row of the day too — and that second lookup's
            // cutoff (just before the SECOND row) would find the first row and wrongly report it
            // as the antecedent of itself.
            if (!previous.containsKey(row.getFlagKey())) {
                String state = traceRepository
                    .findFirstByCreatedByAndFlagKeyAndOccurredAtLessThanEqualOrderByOccurredAtDesc(
                        userId, row.getFlagKey(), row.getOccurredAt().minusMillis(1))
                    .map(FlagTraceReadService::stateOf)
                    .orElse(null);
                previous.put(row.getFlagKey(), state);
            }
        }
        List<Transition> transitions = new ArrayList<>();
        for (CompanionFlagTraceEntity row : rows) {
            String to0 = stateOf(row);
            transitions.add(new Transition(row.getOccurredAt(), row.getFlagKey(),
                FlagCatalog.labelOf(row.getFlagKey()), previous.get(row.getFlagKey()), to0,
                textOf(row)));
            previous.put(row.getFlagKey(), to0);
        }
        return List.copyOf(transitions);
    }

    /** raised + suppressed_by_cooldown reads as its own state — "true, but it stayed quiet". */
    private static String stateOf(CompanionFlagTraceEntity row) {
        return OUTCOME_RAISED.equals(row.getOutcome())
            && DISPOSITION_SUPPRESSED.equals(row.getDisposition())
            ? STATE_SUPPRESSED : row.getOutcome();
    }

    private static String textOf(CompanionFlagTraceEntity row) {
        if (OUTCOME_UNAVAILABLE.equals(row.getOutcome())) {
            return FlagTraceCopy.unavailableText(row.getReasonCode());
        }
        if (OUTCOME_RAISED.equals(row.getOutcome())) {
            // Timeline text, not closing-state text: a transition states WHAT changed and carries
            // no frozen payload of its own, so there are no numbers here to date. The sentences
            // live in FlagTraceCopy — the one place a verdict's user-facing wording is produced.
            return DISPOSITION_SUPPRESSED.equals(row.getDisposition())
                ? FlagTraceCopy.suppressedRaiseText()
                : FlagTraceCopy.raisedText();
        }
        return FlagTraceCopy.clearText(row.getEvidence());
    }
}
