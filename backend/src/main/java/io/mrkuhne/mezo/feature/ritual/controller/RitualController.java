package io.mrkuhne.mezo.feature.ritual.controller;

import io.mrkuhne.mezo.api.controller.RitualApi;
import io.mrkuhne.mezo.api.dto.RitualCloseRequest;
import io.mrkuhne.mezo.api.dto.RitualDayResponse;
import io.mrkuhne.mezo.feature.ritual.service.RitualService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** /api/ritual surface (bd mezo-hvmx) — thin delegation; gated on RITUAL_SWITCH. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.RITUAL_SWITCH, havingValue = "true")
public class RitualController implements RitualApi {

    private final RitualService ritualService;
    private final CurrentUserId currentUserId;

    @Override
    public RitualDayResponse getRitualDay(LocalDate date) {
        return ritualService.getDay(currentUserId.get(), date);
    }

    @Override
    public RitualDayResponse closeRitualDay(RitualCloseRequest request) {
        return ritualService.close(currentUserId.get(), request.getDate());
    }
}
