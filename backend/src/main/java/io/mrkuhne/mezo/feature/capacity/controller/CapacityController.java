package io.mrkuhne.mezo.feature.capacity.controller;

import io.mrkuhne.mezo.api.controller.CapacityApi;
import io.mrkuhne.mezo.api.dto.CapacityEventFeedbackRequest;
import io.mrkuhne.mezo.api.dto.CapacitySeasonLoad;
import io.mrkuhne.mezo.feature.capacity.mapper.CapacitySeasonMapper;
import io.mrkuhne.mezo.feature.capacity.service.EventFeedbackService;
import io.mrkuhne.mezo.feature.capacity.service.SeasonLoadService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** /api/capacity surface (Boop B7, mezo-r36n9.17) — thin delegation, ownership from the principal. */
@RestController
@RequiredArgsConstructor
public class CapacityController implements CapacityApi {

    private final EventFeedbackService feedbackService;
    private final SeasonLoadService seasonLoadService;
    private final CurrentUserId currentUserId;

    @Override
    public void putCapacityEventFeedback(CapacityEventFeedbackRequest request) {
        feedbackService.label(currentUserId.get(), request.getEventKey(),
            request.getEffect() == null ? null : request.getEffect().getValue());
    }

    @Override
    public CapacitySeasonLoad getCapacitySeason() {
        return CapacitySeasonMapper.toDto(seasonLoadService.read(currentUserId.get()));
    }
}
