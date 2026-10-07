package io.mrkuhne.mezo.feature.auth.controller;

import io.mrkuhne.mezo.api.controller.LearningPauseApi;
import io.mrkuhne.mezo.api.dto.LearningPauseRequest;
import io.mrkuhne.mezo.api.dto.LearningPauseResponse;
import io.mrkuhne.mezo.feature.auth.service.LearningPauseService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.ZoneOffset;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** "Most ne tanulj" (mezo-rrjxe). Ungated like its service: the switch must stay reachable. */
@RestController
@RequiredArgsConstructor
public class LearningPauseController implements LearningPauseApi {

    private final CurrentUserId currentUserId;
    private final LearningPauseService service;

    @Override public LearningPauseResponse getLearningPause() {
        return toResponse(service.current(currentUserId.get()));
    }

    @Override public LearningPauseResponse startLearningPause(LearningPauseRequest request) {
        return toResponse(service.start(currentUserId.get(), request.getChoice().getValue()));
    }

    @Override public LearningPauseResponse endLearningPause() {
        return toResponse(service.end(currentUserId.get()));
    }

    private static LearningPauseResponse toResponse(LearningPauseService.Status s) {
        return new LearningPauseResponse()
                .paused(s.paused())
                .startedAt(s.startedAt() == null ? null : s.startedAt().atOffset(ZoneOffset.UTC))
                .until(s.until() == null ? null : s.until().atOffset(ZoneOffset.UTC))
                .choice(s.choice() == null ? null : LearningPauseResponse.ChoiceEnum.fromValue(s.choice()));
    }
}
