package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.FlagTraceDayResponse;
import io.mrkuhne.mezo.api.dto.FlagTraceRuleResponse;
import io.mrkuhne.mezo.api.dto.FlagTraceTransitionResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagTraceEntity;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagTraceRepository;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagCatalog;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagTraceCopy;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEnvelope;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/**
 * The coaching observer's HTTP contract (mezo-6269.2, spec 2026-09-05 §5): the day read
 * round-trips the read service's records — every flag rule in severity order, the winner, the
 * per-rule enums and the day's transitions — and it is token-gated.
 */
class CompanionFlagTraceApiIT extends ApiIntegrationTest {

    /** A day in the past is safe here: {@code companion_flag_trace.occurred_at} is set explicitly
     *  by the fixture (unlike {@code companion_flag_log.created_at}, which is
     *  {@code @CreationTimestamp}), so every row this file seeds falls inside the cutoff. */
    private static final LocalDate DAY = LocalDate.of(2026, 9, 3);

    @Autowired private CompanionFlagTraceRepository traceRepository;
    @Autowired private CompanionMessageRepository companionMessageRepository;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
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

    private FlagTraceDayResponse read(String uri) {
        return getForBody(uri, ownerAuthHeaders(), HttpStatus.OK, FlagTraceDayResponse.class);
    }

    private static FlagTraceRuleResponse rule(FlagTraceDayResponse day, String flagKey) {
        return day.getRules().stream().filter(r -> flagKey.equals(r.getFlagKey()))
                .findFirst().orElseThrow();
    }

    @Test
    void testGetFlagTrace_shouldReturnEveryRuleInSeverityOrder_whenTheDayIsRequested() {
        UUID owner = ownerId();
        trace(owner, FlagKey.SLEEP_DEBT, "clear", null, null,
                new FlagVerdict.ClearEvidence("deficit_hours", 0.4, 1.0, null), at(9));

        FlagTraceDayResponse day = read("/api/companion/flags/trace?date=" + DAY);

        assertThat(day.getDate()).isEqualTo(DAY);
        // Derived, not a literal — a round-2 rule must not fail the HTTP contract test;
        // FlagCatalogTest is what guards the catalog being complete.
        int ruleCount = FlagCatalog.KEYS.size();
        assertThat(day.getRules()).hasSize(ruleCount);
        assertThat(day.getRules()).extracting(FlagTraceRuleResponse::getRank)
                .containsExactlyElementsOf(
                        java.util.stream.IntStream.rangeClosed(1, ruleCount).boxed().toList());
        assertThat(day.getRules().get(0).getFlagKey()).isEqualTo(FlagKey.ACUTE_BAD_DAY);
        assertThat(day.getRules().get(0).getLabel())
                .isEqualTo(FlagCatalog.labelOf(FlagKey.ACUTE_BAD_DAY));
        assertThat(day.getRules().get(0).getDomain())
                .isEqualTo(FlagCatalog.domainOf(FlagKey.ACUTE_BAD_DAY));
        assertThat(day.getEarliestDate()).isEqualTo(DAY);

        // An untraced rule is honestly "unavailable / not_evaluated_yet", never a fabricated clear.
        FlagTraceRuleResponse untraced = day.getRules().get(0);
        assertThat(untraced.getOutcome()).isEqualTo(FlagTraceRuleResponse.OutcomeEnum.UNAVAILABLE);
        assertThat(untraced.getReasonCode()).isEqualTo(FlagTraceCopy.NOT_EVALUATED_YET);
        assertThat(untraced.getChangedAt()).isNull();
        assertThat(untraced.getDisposition()).isNull();
        assertThat(untraced.getCardOutcome()).isNull();
        assertThat(untraced.getFacts()).isEmpty();

        FlagTraceRuleResponse sleep = rule(day, FlagKey.SLEEP_DEBT);
        assertThat(sleep.getOutcome()).isEqualTo(FlagTraceRuleResponse.OutcomeEnum.CLEAR);
        assertThat(sleep.getFacts()).hasSize(2);
        assertThat(sleep.getReasonText()).isNotEmpty();
        assertThat(sleep.getChangedAt()).isNotNull();
    }

    @Test
    void testGetFlagTrace_shouldCarryTheWinnerDispositionsAndTransitions_whenRulesRaised() {
        UUID owner = ownerId();
        trace(owner, FlagKey.SLEEP_DEBT, "raised", null, "logged", null, at(9));
        trace(owner, FlagKey.LATE_EATING, "raised", null, "logged", null, at(10));
        trace(owner, FlagKey.MISSED_WORKOUTS, "raised", null, "suppressed_by_cooldown", null, at(11));
        UUID cardId = card(owner, FlagKey.SLEEP_DEBT);

        FlagTraceDayResponse day = read("/api/companion/flags/trace?date=" + DAY);

        assertThat(day.getWinner()).isNotNull();
        assertThat(day.getWinner().getFlagKey()).isEqualTo(FlagKey.SLEEP_DEBT);
        assertThat(day.getWinner().getCardId()).isEqualTo(cardId);
        assertThat(day.getWinner().getRank()).isEqualTo(rule(day, FlagKey.SLEEP_DEBT).getRank());

        assertThat(rule(day, FlagKey.SLEEP_DEBT).getCardOutcome())
                .isEqualTo(FlagTraceRuleResponse.CardOutcomeEnum.WON);
        assertThat(rule(day, FlagKey.SLEEP_DEBT).getDisposition())
                .isEqualTo(FlagTraceRuleResponse.DispositionEnum.LOGGED);
        assertThat(rule(day, FlagKey.LATE_EATING).getCardOutcome())
                .isEqualTo(FlagTraceRuleResponse.CardOutcomeEnum.LOST);
        assertThat(rule(day, FlagKey.MISSED_WORKOUTS).getDisposition())
                .isEqualTo(FlagTraceRuleResponse.DispositionEnum.SUPPRESSED_BY_COOLDOWN);
        assertThat(rule(day, FlagKey.MISSED_WORKOUTS).getCardOutcome()).isNull();

        assertThat(day.getTransitions()).hasSize(3);
        assertThat(day.getTransitions()).extracting(FlagTraceTransitionResponse::getFlagKey)
                .containsExactly(FlagKey.SLEEP_DEBT, FlagKey.LATE_EATING, FlagKey.MISSED_WORKOUTS);
        assertThat(day.getTransitions()).extracting(FlagTraceTransitionResponse::getFrom)
                .containsOnlyNulls();
        assertThat(day.getTransitions().get(0).getTo())
                .isEqualTo(FlagTraceTransitionResponse.ToEnum.RAISED);
        assertThat(day.getTransitions().get(2).getTo())
                .isEqualTo(FlagTraceTransitionResponse.ToEnum.SUPPRESSED);
        assertThat(day.getTransitions().get(0).getAt()).isNotNull();
        assertThat(day.getTransitions().get(0).getLabel())
                .isEqualTo(FlagCatalog.labelOf(FlagKey.SLEEP_DEBT));
        assertThat(day.getTransitions().get(0).getReasonText()).isNotEmpty();
    }

    @Test
    void testGetFlagTrace_shouldDefaultToToday_whenNoDateIsGiven() {
        FlagTraceDayResponse day = read("/api/companion/flags/trace");

        assertThat(day.getDate()).isEqualTo(LocalDate.now());
        assertThat(day.getRules()).hasSize(FlagCatalog.KEYS.size());
        assertThat(day.getTransitions()).isEmpty();
        assertThat(day.getWinner()).isNull();
        assertThat(day.getEarliestDate()).isNull();
    }

    @Test
    void testGetFlagTrace_shouldReturnUnauthorized_whenNoTokenIsGiven() {
        ResponseEntity<String> response = exchangeForResponse(
                HttpMethod.GET, "/api/companion/flags/trace", null, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}
