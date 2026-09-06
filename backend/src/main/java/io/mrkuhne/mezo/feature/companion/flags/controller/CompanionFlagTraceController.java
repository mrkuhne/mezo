package io.mrkuhne.mezo.feature.companion.flags.controller;

import io.mrkuhne.mezo.api.controller.CompanionFlagsApi;
import io.mrkuhne.mezo.api.dto.FlagTraceDayResponse;
import io.mrkuhne.mezo.feature.companion.flags.mapper.CompanionFlagMapper;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagTraceReadService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/**
 * The coaching observer's read surface (mezo-6269.2, spec 2026-09-05 §5). It lives in
 * {@code companion.flags} and not in {@code proactive} on purpose: a proactive controller reading
 * {@code CompanionFlagLogRepository} would cross a feature boundary. READ-ONLY — the observer never
 * writes and never recomputes; every verdict here was concluded by the engine at evaluation time.
 *
 * <p>Gated on BOTH switches, exactly like {@link FlagTraceReadService}: with proactive off there is
 * no card to explain, so the endpoint honestly does not exist rather than 500-ing on a missing bean.
 */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class CompanionFlagTraceController implements CompanionFlagsApi {

    private final FlagTraceReadService readService;
    private final CompanionFlagMapper mapper;
    private final CurrentUserId currentUserId;

    /** {@code date} is an optional query parameter, so it arrives null when the client omits it —
     *  the server's today is the honest default (the FE sends its own LOCAL date otherwise). */
    @Override
    public FlagTraceDayResponse getFlagTrace(LocalDate date) {
        LocalDate day = date == null ? LocalDate.now() : date;
        return mapper.toResponse(readService.read(currentUserId.get(), day));
    }
}
