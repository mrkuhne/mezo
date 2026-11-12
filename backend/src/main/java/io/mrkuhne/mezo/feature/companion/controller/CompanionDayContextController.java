package io.mrkuhne.mezo.feature.companion.controller;

import io.mrkuhne.mezo.api.controller.CompanionDayContextApi;
import io.mrkuhne.mezo.api.dto.DayContextChip;
import io.mrkuhne.mezo.api.dto.DayContextResponse;
import io.mrkuhne.mezo.feature.companion.service.BoopDayContext;
import io.mrkuhne.mezo.feature.companion.service.OwnerToday;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.ZoneOffset;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/**
 * GET /api/companion/day-context (Boop B3, mezo-r36n9.13, spec §7.6): the "Boop látja" chips and the ready
 * questions, built from the SAME {@link BoopDayContext} block a Boop-channel chat turn carries — so the strip
 * shows exactly what the model sees. Mappings from the generated {@link CompanionDayContextApi}.
 */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class CompanionDayContextController implements CompanionDayContextApi {

    private final BoopDayContext dayContext;
    private final OwnerToday ownerToday;
    private final CurrentUserId currentUserId;

    @Override
    public DayContextResponse getDayContext() {
        var now = ownerToday.now();
        BoopDayContext.DayBlock day = dayContext.assemble(currentUserId.get(), ownerToday.today(), now);
        return DayContextResponse.builder()
            .chips(dayContext.chips(day).stream()
                .map(c -> DayContextChip.builder().key(c.key()).label(c.label()).value(c.value()).sub(c.sub()).build())
                .toList())
            .questions(dayContext.questions(day))
            .generatedAt(now.atOffset(ZoneOffset.UTC))
            .build();
    }
}
