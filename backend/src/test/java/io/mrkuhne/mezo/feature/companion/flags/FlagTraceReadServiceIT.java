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
import io.mrkuhne.mezo.support.populator.FlagLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.support.TransactionTemplate;

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
    /** The house seam for a controlled {@code companion_flag_log.created_at}: the column is
     *  {@code @CreationTimestamp} + non-updatable on {@code OwnedEntity}, so only a native UPDATE
     *  can backdate it — {@code FlagLogPopulator.raiseAt} already does exactly that. */
    @Autowired
    private FlagLogPopulator flagLogPopulator;
    /** The card's created_at is @CreationTimestamp + non-updatable (OwnedEntity), so a controlled
     *  delivery instant needs a native UPDATE — the FlagLogPopulator.raiseAt seam's own idiom. */
    @PersistenceContext
    private EntityManager em;
    /** This class is deliberately NOT {@code @Transactional} (see the DAY field's javadoc), so the
     *  native UPDATE below has no ambient transaction of its own — the
     *  {@code GoalSuggestionNotificationIT}/{@code MemoryEmbeddingAnnQueryIT} house idiom for the
     *  same situation. */
    @Autowired
    private TransactionTemplate transactionTemplate;

    private UUID createUser() {
        return userPopulator.createUser().getId();
    }

    private static FlagPayloadEnvelope sleepDebt(double deficitHours) {
        return FlagPayloadEnvelope.sleepDebt(
            new FlagPayloadEnvelope.SleepDebt(8.0, 7, 6, 1.0, deficitHours, Map.of()));
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

    private UUID cardAt(UUID userId, String adviceKey, Instant deliveredAt) {
        UUID id = card(userId, adviceKey);
        transactionTemplate.executeWithoutResult(status -> em
            .createNativeQuery("update companion_message set created_at = :at where id = :id")
            .setParameter("at", deliveredAt).setParameter("id", id).executeUpdate());
        em.clear();
        return id;
    }

    @Test
    void a_day_reports_every_rule_in_severity_order() {
        UUID userId = createUser();
        trace(userId, FlagKey.SLEEP_DEBT, "clear", null, null,
            new FlagVerdict.ClearEvidence("deficit_hours", 0.4, 1.0, null), at(9));

        FlagTraceReadService.TraceDay day = service.read(userId, DAY);

        // Derived, not a literal: a round-2 rule landing in the catalog must not fail THIS test —
        // FlagCatalogTest is the one that guards the catalog's completeness.
        int ruleCount = FlagCatalog.KEYS.size();
        assertThat(day.rules()).hasSize(ruleCount);
        assertThat(day.rules()).extracting(FlagTraceReadService.RuleState::rank)
            .containsExactlyElementsOf(
                java.util.stream.IntStream.rangeClosed(1, ruleCount).boxed().toList());
        assertThat(day.rules().get(0).flagKey()).isEqualTo(FlagKey.ACUTE_BAD_DAY);
        assertThat(day.rules().get(ruleCount - 1).flagKey()).isEqualTo(FlagKey.ALL_HEALTHY);
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

    /**
     * A cooldown-suppressed raise writes NO log row, so the only frozen payload the read side can
     * find belongs to an EARLIER raise. The evidence stays (it is the rule's freshest real
     * measurement) but must be DATED, or old numbers would sit under today's {@code changedAt} and
     * read as today's measurement.
     */
    @Test
    void a_cooldown_suppressed_raise_dates_its_frozen_numbers_instead_of_passing_them_off_as_today() {
        UUID userId = createUser();
        LocalDate frozenOn = DAY.minusDays(4);
        flagLogPopulator.raiseAt(userId, FlagKey.SLEEP_DEBT, FlagKey.SOURCE_SWEEP,
            sleepDebt(1.4), frozenOn.atTime(9, 0).atZone(ZoneId.systemDefault()).toInstant());
        trace(userId, FlagKey.SLEEP_DEBT, "raised", null, "suppressed_by_cooldown", null, at(11));
        // a LOGGED raise on another rule: its log row IS the raise being explained, so no dating
        flagLogPopulator.raiseAt(userId, FlagKey.LATE_EATING, FlagKey.SOURCE_SWEEP,
            FlagPayloadEnvelope.lateEating(new FlagPayloadEnvelope.LateEating(
                120, 22.0, 2, 3, null, 2, Map.of(), Map.of())),
            at(9));
        trace(userId, FlagKey.LATE_EATING, "raised", null, "logged", null, at(10));

        Map<String, FlagTraceReadService.RuleState> byKey = service.read(userId, DAY).rules().stream()
            .collect(java.util.stream.Collectors.toMap(
                FlagTraceReadService.RuleState::flagKey, r -> r));

        FlagTraceReadService.RuleState suppressed = byKey.get(FlagKey.SLEEP_DEBT);
        assertThat(suppressed.facts()).hasSize(2);
        assertThat(suppressed.facts().get(0)).contains("1,4");
        assertThat(suppressed.facts().get(1))
            .isEqualTo(FlagTraceCopy.frozenNumbersFact(frozenOn));
        assertThat(suppressed.reasonText())
            .isEqualTo(FlagTraceCopy.suppressedRaiseText(frozenOn));
        assertThat(suppressed.changedAt()).isEqualTo(at(11));

        FlagTraceReadService.RuleState logged = byKey.get(FlagKey.LATE_EATING);
        assertThat(logged.facts()).isNotEmpty()
            .noneMatch(f -> f.contains("nem mai mérés"));
        assertThat(logged.reasonText()).isEqualTo(logged.facts().get(0));
    }

    /**
     * The design's stated property: a day's FIRST transition for a rule reads from YESTERDAY's
     * state, not from nothing. Only the antecedent query can supply that {@code from}.
     */
    @Test
    void the_days_first_transition_reads_from_yesterdays_state_not_from_nothing() {
        UUID userId = createUser();
        trace(userId, FlagKey.LOAD_FUEL_MISMATCH, "clear", null, null,
            new FlagVerdict.ClearEvidence("load_avg_min", 200.0, 400.0, null),
            DAY.minusDays(1).atTime(9, 0).atZone(ZoneId.systemDefault()).toInstant());
        trace(userId, FlagKey.LOAD_FUEL_MISMATCH, "raised", null, "logged", null, at(10));

        FlagTraceReadService.TraceDay day = service.read(userId, DAY);

        assertThat(day.transitions()).singleElement().satisfies(t -> {
            assertThat(t.from()).isEqualTo("clear");
            assertThat(t.to()).isEqualTo("raised");
        });
    }

    /**
     * The whole point of the frozen payload: a PAST day renders what was frozen THEN, not the
     * newest numbers. Both halves matter — the cutoff bound excludes the later row, and the
     * {@code OrderByCreatedAtDesc} picks the newest of the rows that survive the bound.
     */
    @Test
    void a_past_day_renders_the_payload_frozen_then_rather_than_todays_numbers() {
        UUID userId = createUser();
        LocalDate pastDay = DAY.minusDays(2);
        // oldest — inside the bound, but NOT the newest that survives it
        flagLogPopulator.raiseAt(userId, FlagKey.SLEEP_DEBT, FlagKey.SOURCE_SWEEP, sleepDebt(0.9),
            pastDay.minusDays(1).atTime(9, 0).atZone(ZoneId.systemDefault()).toInstant());
        // the raise that the past day is about
        flagLogPopulator.raiseAt(userId, FlagKey.SLEEP_DEBT, FlagKey.SOURCE_SWEEP, sleepDebt(1.4),
            pastDay.atTime(8, 0).atZone(ZoneId.systemDefault()).toInstant());
        // today's numbers — must be excluded by the cutoff
        flagLogPopulator.raiseAt(userId, FlagKey.SLEEP_DEBT, FlagKey.SOURCE_SWEEP, sleepDebt(2.7),
            DAY.atTime(8, 0).atZone(ZoneId.systemDefault()).toInstant());
        trace(userId, FlagKey.SLEEP_DEBT, "raised", null, "logged", null,
            pastDay.atTime(9, 0).atZone(ZoneId.systemDefault()).toInstant());

        FlagTraceReadService.RuleState state = service.read(userId, pastDay).rules().stream()
            .filter(r -> r.flagKey().equals(FlagKey.SLEEP_DEBT)).findFirst().orElseThrow();

        assertThat(state.outcome()).isEqualTo("raised");
        assertThat(state.facts()).singleElement().asString()
            .contains("1,4").doesNotContain("2,7").doesNotContain("0,9");
        assertThat(state.reasonText()).contains("1,4");
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

    @Test
    void a_rule_that_went_clear_after_winning_is_not_stamped_with_a_card_outcome() {
        UUID userId = createUser();
        // Won the card at 10:00 …
        flagLogPopulator.raiseAt(userId, FlagKey.SLEEP_DEBT, FlagKey.SOURCE_SWEEP, sleepDebt(1.4), at(10));
        trace(userId, FlagKey.SLEEP_DEBT, "raised", null, "logged", null, at(10));
        UUID cardId = cardAt(userId, FlagKey.SLEEP_DEBT, at(11));
        // … and turned clear by 20:00, which is the row the day CLOSES on.
        trace(userId, FlagKey.SLEEP_DEBT, "clear", null, null,
            new FlagVerdict.ClearEvidence("deficit_hours", 0.4, 1.0, null), at(20));

        FlagTraceReadService.TraceDay day = service.read(userId, DAY);
        FlagTraceReadService.RuleState sleep = day.rules().stream()
            .filter(r -> r.flagKey().equals(FlagKey.SLEEP_DEBT)).findFirst().orElseThrow();

        // The card is still the day's card — that is a fact about the DAY, not about the rule's
        // closing state, so the winner keeps naming it (the surface badges „Nyertes" from here).
        assertThat(day.winner()).isNotNull();
        assertThat(day.winner().flagKey()).isEqualTo(FlagKey.SLEEP_DEBT);
        assertThat(day.winner().cardId()).isEqualTo(cardId);
        // But the closing row is a LATER state than the decision, so it carries no card outcome:
        // „Rendben" plus a „Nyertes" stamp on the same tile is the contradiction this closes.
        assertThat(sleep.outcome()).isEqualTo("clear");
        assertThat(sleep.cardOutcome()).isNull();
    }

    @Test
    void a_rule_that_first_raised_after_the_card_never_competed_and_is_not_lost() {
        UUID userId = createUser();
        flagLogPopulator.raiseAt(userId, FlagKey.SLEEP_DEBT, FlagKey.SOURCE_SWEEP, sleepDebt(1.4), at(7));
        trace(userId, FlagKey.SLEEP_DEBT, "raised", null, "logged", null, at(7));
        cardAt(userId, FlagKey.SLEEP_DEBT, at(8));
        // Late-eating only becomes true in the evening — hours after the card was chosen.
        flagLogPopulator.raiseAt(userId, FlagKey.LATE_EATING, FlagKey.SOURCE_SWEEP,
            FlagPayloadEnvelope.lateEating(new FlagPayloadEnvelope.LateEating(
                120, 22.0, 2, 3, 22.0, 2, Map.of(), Map.of())),
            at(20));
        trace(userId, FlagKey.LATE_EATING, "raised", null, "logged", null, at(20));

        FlagTraceReadService.TraceDay day = service.read(userId, DAY);
        Map<String, FlagTraceReadService.RuleState> byKey = day.rules().stream()
            .collect(java.util.stream.Collectors.toMap(
                FlagTraceReadService.RuleState::flagKey, r -> r));

        assertThat(byKey.get(FlagKey.SLEEP_DEBT).cardOutcome()).isEqualTo("won");
        assertThat(byKey.get(FlagKey.LATE_EATING).outcome()).isEqualTo("raised");
        assertThat(byKey.get(FlagKey.LATE_EATING).cardOutcome()).isNull();
    }
}
