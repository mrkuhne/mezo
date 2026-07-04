package io.mrkuhne.mezo.feature.people.controller;

import io.mrkuhne.mezo.api.controller.PeopleApi;
import io.mrkuhne.mezo.api.dto.LogMentionRequest;
import io.mrkuhne.mezo.api.dto.MentionResponse;
import io.mrkuhne.mezo.api.dto.PeopleResponse;
import io.mrkuhne.mezo.feature.people.service.PeopleService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** Implements the generated contract interface — mappings/validation come from {@link PeopleApi}. */
@RestController
@RequiredArgsConstructor
public class PeopleController implements PeopleApi {

    private final PeopleService service;
    private final CurrentUserId currentUserId;

    @Override
    public PeopleResponse getPeopleBootstrap() {
        return service.getBootstrap(currentUserId.get());
    }

    @Override
    public MentionResponse logMention(UUID personId, LogMentionRequest logMentionRequest) {
        return service.logMention(currentUserId.get(), personId, logMentionRequest);
    }
}
