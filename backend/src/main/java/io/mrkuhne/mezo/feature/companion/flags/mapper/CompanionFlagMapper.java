package io.mrkuhne.mezo.feature.companion.flags.mapper;

import io.mrkuhne.mezo.api.dto.FlagTraceDayResponse;
import io.mrkuhne.mezo.api.dto.FlagTraceRuleResponse;
import io.mrkuhne.mezo.api.dto.FlagTraceTransitionResponse;
import io.mrkuhne.mezo.api.dto.FlagTraceWinnerResponse;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagTraceReadService;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.mapstruct.Mapper;

/**
 * The observer's domain records → the generated DTOs (mezo-6269.2). Pure transport: it renames
 * nothing, derives nothing and drops nothing — every verdict already exists on
 * {@link FlagTraceReadService.TraceDay}.
 *
 * <p>String→enum goes through the generated {@code fromValue} (the WIRE value, e.g. "raised") and
 * not MapStruct's default {@code Enum.valueOf} (the constant NAME) — the service hands over the
 * lower-case strings the {@code companion_flag_trace} columns store. This is the
 * {@code ProactiveMapper.mapActionKey} precedent; each bridge needs its own NAME because two
 * methods differing only in return type are not a valid Java overload, and MapStruct then picks
 * them by that return type.
 */
@Mapper(componentModel = "spring")
public interface CompanionFlagMapper {

    FlagTraceDayResponse toResponse(FlagTraceReadService.TraceDay day);

    FlagTraceWinnerResponse toWinner(FlagTraceReadService.Winner winner);

    FlagTraceRuleResponse toRule(FlagTraceReadService.RuleState rule);

    FlagTraceTransitionResponse toTransition(FlagTraceReadService.Transition transition);

    default FlagTraceRuleResponse.OutcomeEnum mapOutcome(String value) {
        return value == null ? null : FlagTraceRuleResponse.OutcomeEnum.fromValue(value);
    }

    default FlagTraceRuleResponse.DispositionEnum mapDisposition(String value) {
        return value == null ? null : FlagTraceRuleResponse.DispositionEnum.fromValue(value);
    }

    default FlagTraceRuleResponse.CardOutcomeEnum mapCardOutcome(String value) {
        return value == null ? null : FlagTraceRuleResponse.CardOutcomeEnum.fromValue(value);
    }

    /** Null on a rule's very first traced row — "there was no state before this one". */
    default FlagTraceTransitionResponse.FromEnum mapTransitionFrom(String value) {
        return value == null ? null : FlagTraceTransitionResponse.FromEnum.fromValue(value);
    }

    default FlagTraceTransitionResponse.ToEnum mapTransitionTo(String value) {
        return value == null ? null : FlagTraceTransitionResponse.ToEnum.fromValue(value);
    }

    default OffsetDateTime map(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }
}
