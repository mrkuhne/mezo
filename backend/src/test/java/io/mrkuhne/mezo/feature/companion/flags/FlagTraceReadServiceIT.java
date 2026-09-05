package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagLogEntity;
import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagTraceEntity;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagLogRepository;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagTraceRepository;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagCatalog;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagTraceCopy;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagTraceReadService;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEnvelope;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * The observer's read side (spec 2026-09-05 §5, §7). Content, not coverage: the closing state and
 * the timeline come from the SAME rows, a suppressed rule stays visible rather than vanishing, and
 * a rule the frontend has never seen still renders.
 */
class FlagTraceReadServiceIT extends AbstractIntegrationTest {

    // Deliberately "today" rather than a fixed literal: CompanionFlagLogEntity#createdAt is
    // @CreationTimestamp (OwnedEntity), so Hibernate stamps it with the ACTUAL wall-clock instant
    // at insert regardless of what the fixture sets elsewhere. A cutoff derived from a DAY fixed
    // in the past would filter that freshly-inserted log row out of every cutoff query — the exact
    // failure this file's javadoc warns about ("make sure that test genuinely reaches it").
    private static final LocalDate DAY = LocalDate.now();

    @Autowired
    private FlagTraceReadService service;
    @Autowired
    private CompanionFlagTraceRepository traceRepository;
    @Autowired
    private CompanionFlagLogRepository logRepository;
    @Autowired
    private CompanionMessageRepository companionMessageRepository;
    @Autowired
    private UserPopulator userPopulator;

    private UUID createUser() {
        return userPopulator.createUser().getId();
    }

    private static Instant at(int hour) {
        return DAY.atTime(hour, 0).atZone(ZoneId.systemDefault()).toInstant();
    }

    private void trace(UUID userId, String flagKey, String outcome, String reasonCode,
                       String disposition, FlagVerdict.ClearEvidence evidence, Instant when) {
        CompanionFlagTraceEntity e = new CompanionFlagTraceEntity();
        e.setCreatedBy(userId);
        e.setFlagKey(flagKey);
        e.setOutcome(outcome);
        e.setReasonCode(reasonCode);
        e.setDisposition(disposition);
        e.setEvidence(evidence);
        e.setOccurredAt(when);
        traceRepository.saveAndFlush(e);
    }

    private UUID card(UUID userId, String adviceKey) {
        CompanionMessageEntity row = new CompanionMessageEntity();
        row.setCreatedBy(userId);
        row.setMessageDate(DAY);
        row.setKind(CompanionMessageEntity.KIND_ADVICE);
        row.setContent(CompanionMessageEnvelope.advice("Alvás", "Aludj többet.", adviceKey,
            null, null, List.of(), List.of()));
        row.setGeneratedAt(Instant.now());
        return companionMessageRepository.saveAndFlush(row).getId();
    }

    @Test
    void a_day_reports_all_thirteen_rules_in_severity_order() {
        UUID userId = createUser();
        trace(userId, FlagKey.SLEEP_DEBT, "clear", null, null,
            new FlagVerdict.ClearEvidence("deficit_hours", 0.4, 1.0, null), at(9));

        FlagTraceReadService.TraceDay day = service.read(userId, DAY);

        assertThat(day.rules()).hasSize(13);
        assertThat(day.rules()).extracting(FlagTraceReadService.RuleState::rank)
            .containsExactlyElementsOf(java.util.stream.IntStream.rangeClosed(1, 13).boxed().toList());
        assertThat(day.rules().get(0).flagKey()).isEqualTo(FlagKey.ACUTE_BAD_DAY);
        assertThat(day.rules().get(12).flagKey()).isEqualTo(FlagKey.ALL_HEALTHY);
        assertThat(day.rules().stream()
            .filter(r -> r.flagKey().equals(FlagKey.LATE_EATING)).findFirst().orElseThrow().rank())
            .isEqualTo(9);
    }

    @Test
    void an_untraced_rule_is_honestly_not_evaluated_rather_than_a_fabricated_clear() {
        UUID userId = createUser();
        FlagTraceReadService.RuleState state = service.read(userId, DAY).rules().get(0);
        assertThat(state.outcome()).isEqualTo("unavailable");
        assertThat(state.reasonCode()).isEqualTo(FlagTraceCopy.NOT_EVALUATED_YET);
        assertThat(state.changedAt()).isNull();
        assertThat(state.facts()).isEmpty();
    }

    @Test
    void a_clear_rule_carries_the_observed_value_and_the_threshold() {
        UUID userId = createUser();
        trace(userId, FlagKey.SLEEP_DEBT, "clear", null, null,
            new FlagVerdict.ClearEvidence("deficit_hours", 0.4, 1.0, null), at(9));

        FlagTraceReadService.RuleState state = service.read(userId, DAY).rules().stream()
            .filter(r -> r.flagKey().equals(FlagKey.SLEEP_DEBT)).findFirst().orElseThrow();
        assertThat(state.outcome()).isEqualTo("clear");
        assertThat(state.reasonText()).contains("0,4").contains("1,0");
        assertThat(state.facts()).hasSize(2);
        assertThat(state.label()).isEqualTo(FlagCatalog.labelOf(FlagKey.SLEEP_DEBT));
        assertThat(state.domain()).isEqualTo(FlagCatalog.domainOf(FlagKey.SLEEP_DEBT));
    }

    @Test
    void a_raised_rule_renders_the_frozen_payload_and_the_winner_is_correlated() {
        UUID userId = createUser();
        CompanionFlagLogEntity log = new CompanionFlagLogEntity();
        log.setCreatedBy(userId);
        log.setFlagKey(FlagKey.SLEEP_DEBT);
        log.setSource(FlagKey.SOURCE_SWEEP);
        log.setPayload(FlagPayloadEnvelope.sleepDebt(new FlagPayloadEnvelope.SleepDebt(
            8.0, 7, 6, 1.0, 1.4, Map.of())));
        logRepository.saveAndFlush(log);
        trace(userId, FlagKey.SLEEP_DEBT, "raised", null, "logged", null, at(9));
        trace(userId, FlagKey.LATE_EATING, "raised", null, "logged", null, at(10));
        UUID cardId = card(userId, FlagKey.SLEEP_DEBT);

        FlagTraceReadService.TraceDay day = service.read(userId, DAY);

        assertThat(day.winner()).isNotNull();
        assertThat(day.winner().flagKey()).isEqualTo(FlagKey.SLEEP_DEBT);
        assertThat(day.winner().cardId()).isEqualTo(cardId);
        assertThat(day.winner().rank()).isEqualTo(6);
        Map<String, FlagTraceReadService.RuleState> byKey = day.rules().stream()
            .collect(java.util.stream.Collectors.toMap(
                FlagTraceReadService.RuleState::flagKey, r -> r));
        assertThat(byKey.get(FlagKey.SLEEP_DEBT).cardOutcome()).isEqualTo("won");
        assertThat(byKey.get(FlagKey.SLEEP_DEBT).facts()).isNotEmpty();
        assertThat(byKey.get(FlagKey.SLEEP_DEBT).reasonText()).contains("1,4");
        assertThat(byKey.get(FlagKey.LATE_EATING).cardOutcome()).isEqualTo("lost");
    }

    @Test
    void cooldown_suppression_is_visible_rather_than_vanishing() {
        UUID userId = createUser();
        trace(userId, FlagKey.LATE_EATING, "raised", null, "suppressed_by_cooldown", null, at(11));

        FlagTraceReadService.TraceDay day = service.read(userId, DAY);
        FlagTraceReadService.RuleState state = day.rules().stream()
            .filter(r -> r.flagKey().equals(FlagKey.LATE_EATING)).findFirst().orElseThrow();
        assertThat(state.outcome()).isEqualTo("raised");
        assertThat(state.disposition()).isEqualTo("suppressed_by_cooldown");
        assertThat(state.cardOutcome()).isNull();
        assertThat(day.transitions()).singleElement()
            .extracting(FlagTraceReadService.Transition::to).isEqualTo("suppressed");
    }

    @Test
    void closing_state_and_timeline_come_from_the_same_rows_and_a_past_day_reads_back_unchanged() {
        UUID userId = createUser();
        trace(userId, FlagKey.LOAD_FUEL_MISMATCH, "clear", null, null,
            new FlagVerdict.ClearEvidence("load_avg_min", 200.0, 400.0, null), at(8));
        trace(userId, FlagKey.LOAD_FUEL_MISMATCH, "raised", null, "logged", null, at(14));
        // the NEXT day changes again — must not leak into DAY's read
        trace(userId, FlagKey.LOAD_FUEL_MISMATCH, "clear", null, null,
            new FlagVerdict.ClearEvidence("load_avg_min", 100.0, 400.0, null),
            DAY.plusDays(1).atTime(9, 0).atZone(ZoneId.systemDefault()).toInstant());

        FlagTraceReadService.TraceDay day = service.read(userId, DAY);

        assertThat(day.rules().stream()
            .filter(r -> r.flagKey().equals(FlagKey.LOAD_FUEL_MISMATCH)).findFirst().orElseThrow()
            .outcome()).isEqualTo("raised");
        assertThat(day.transitions()).hasSize(2);
        assertThat(day.transitions().get(0).from()).isNull();
        assertThat(day.transitions().get(0).to()).isEqualTo("clear");
        assertThat(day.transitions().get(1).from()).isEqualTo("clear");
        assertThat(day.transitions().get(1).to()).isEqualTo("raised");
        assertThat(day.transitions().get(1).label())
            .isEqualTo(FlagCatalog.labelOf(FlagKey.LOAD_FUEL_MISMATCH));
        assertThat(day.earliestDate()).isEqualTo(DAY);
    }

    @Test
    void a_day_with_no_change_has_no_timeline_but_still_has_a_closing_state() {
        UUID userId = createUser();
        trace(userId, FlagKey.SLEEP_DEBT, "raised", null, "logged", null,
            DAY.minusDays(2).atTime(9, 0).atZone(ZoneId.systemDefault()).toInstant());

        FlagTraceReadService.TraceDay day = service.read(userId, DAY);
        assertThat(day.transitions()).isEmpty();
        assertThat(day.rules().stream()
            .filter(r -> r.flagKey().equals(FlagKey.SLEEP_DEBT)).findFirst().orElseThrow()
            .outcome()).isEqualTo("raised");
    }

    @Test
    void a_setup_sourced_card_leaves_the_thirteen_rules_without_a_winner() {
        UUID userId = createUser();
        trace(userId, FlagKey.SLEEP_DEBT, "raised", null, "logged", null, at(9));
        card(userId, "missing_sleep_goal");

        FlagTraceReadService.TraceDay day = service.read(userId, DAY);
        assertThat(day.winner()).isNull();
        assertThat(day.rules().stream()
            .filter(r -> r.flagKey().equals(FlagKey.SLEEP_DEBT)).findFirst().orElseThrow()
            .cardOutcome()).isNull();
    }
}
