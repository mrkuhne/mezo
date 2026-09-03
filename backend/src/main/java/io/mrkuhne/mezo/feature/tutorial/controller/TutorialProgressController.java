package io.mrkuhne.mezo.feature.tutorial.controller;

import io.mrkuhne.mezo.api.controller.TutorialProgressApi;
import io.mrkuhne.mezo.api.dto.SetTutorialProgressRequest;
import io.mrkuhne.mezo.api.dto.TutorialProgressResponse;
import io.mrkuhne.mezo.feature.tutorial.service.TutorialProgressService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** /api/tutorial/progress surface (mezo-gb1s.1) — mappings come from the generated {@link TutorialProgressApi}. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.TUTORIAL_SWITCH, havingValue = "true")
public class TutorialProgressController implements TutorialProgressApi {

    private final TutorialProgressService service;
    private final CurrentUserId currentUserId;

    @Override
    public TutorialProgressResponse getTutorialProgress() {
        return service.getProgress(currentUserId.get());
    }

    @Override
    public TutorialProgressResponse setTutorialProgress(SetTutorialProgressRequest setTutorialProgressRequest) {
        return service.setProgress(currentUserId.get(), setTutorialProgressRequest);
    }

    @Override
    public void resetTutorialProgress() {
        service.resetProgress(currentUserId.get());
    }
}
