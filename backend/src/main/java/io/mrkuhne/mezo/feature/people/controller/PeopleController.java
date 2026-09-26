package io.mrkuhne.mezo.feature.people.controller;

import io.mrkuhne.mezo.api.controller.PeopleApi;
import io.mrkuhne.mezo.api.dto.CreatePersonRequest;
import io.mrkuhne.mezo.api.dto.LogMentionRequest;
import io.mrkuhne.mezo.api.dto.MentionResponse;
import io.mrkuhne.mezo.api.dto.PeopleResponse;
import io.mrkuhne.mezo.api.dto.PersonDecisionRequest;
import io.mrkuhne.mezo.api.dto.PersonFactResponse;
import io.mrkuhne.mezo.api.dto.PersonResponse;
import io.mrkuhne.mezo.api.dto.UpdatePersonFactRequest;
import io.mrkuhne.mezo.api.dto.UpdatePersonRequest;
import io.mrkuhne.mezo.feature.people.mapper.PeopleMapper;
import io.mrkuhne.mezo.feature.people.service.PeopleService;
import io.mrkuhne.mezo.feature.people.service.PersonFactService;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.RestController;

/** Implements the generated contract interface — mappings/validation come from {@link PeopleApi}. */
@RestController
@RequiredArgsConstructor
public class PeopleController implements PeopleApi {

    private final PeopleService service;
    private final CurrentUserId currentUserId;
    private final PeopleMapper mapper;
    // ObjectProvider: a PersonFactService a PEOPLE_SWITCH-en ül — kikapcsolva a fact-végpontok 404-eznek.
    private final ObjectProvider<PersonFactService> personFactService;

    @Override
    public PeopleResponse getPeopleBootstrap() {
        return service.getBootstrap(currentUserId.get());
    }

    @Override
    public MentionResponse logMention(UUID personId, LogMentionRequest logMentionRequest) {
        return service.logMention(currentUserId.get(), personId, logMentionRequest);
    }

    @Override
    public PersonResponse createPerson(CreatePersonRequest createPersonRequest) {
        return service.createPerson(currentUserId.get(), createPersonRequest);
    }

    @Override
    public PersonResponse updatePerson(UUID personId, UpdatePersonRequest updatePersonRequest) {
        return service.updatePerson(currentUserId.get(), personId, updatePersonRequest);
    }

    @Override
    public void deletePerson(UUID personId) {
        service.deletePerson(currentUserId.get(), personId);
    }

    @Override
    public void deleteMention(UUID personId, UUID mentionId) {
        service.deleteMention(currentUserId.get(), personId, mentionId);
    }

    @Override
    public PersonResponse decidePerson(UUID personId, PersonDecisionRequest personDecisionRequest) {
        return service.decidePerson(currentUserId.get(), personId, personDecisionRequest);
    }

    @Override
    public List<PersonFactResponse> getFactsBySource(String sourceRefKind, String sourceRefId) {
        return facts().bySourceRef(currentUserId.get(), sourceRefKind, sourceRefId).stream()
                .map(mapper::toFactResponse)
                .toList();
    }

    @Override
    public void undoPersonFact(UUID personId, UUID factId) {
        facts().undo(currentUserId.get(), personId, factId);
    }

    @Override
    public PersonFactResponse updatePersonFact(UUID personId, UUID factId,
            UpdatePersonFactRequest updatePersonFactRequest) {
        return mapper.toFactResponse(facts().setIncludeInPrompt(
                currentUserId.get(), personId, factId, updatePersonFactRequest.getIncludeInPrompt()));
    }

    @Override
    public void markPersonFactsSeen(UUID personId) {
        facts().markSeen(currentUserId.get(), personId);
    }

    private PersonFactService facts() {
        PersonFactService svc = personFactService.getIfAvailable();
        if (svc == null) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
        }
        return svc;
    }
}
