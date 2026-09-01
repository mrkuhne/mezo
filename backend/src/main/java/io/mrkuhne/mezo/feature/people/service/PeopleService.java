package io.mrkuhne.mezo.feature.people.service;

import io.mrkuhne.mezo.api.dto.CreatePersonRequest;
import io.mrkuhne.mezo.api.dto.LogMentionRequest;
import io.mrkuhne.mezo.api.dto.MentionResponse;
import io.mrkuhne.mezo.api.dto.PeopleResponse;
import io.mrkuhne.mezo.api.dto.PersonDecisionRequest;
import io.mrkuhne.mezo.api.dto.PersonGraphEdge;
import io.mrkuhne.mezo.api.dto.PersonResponse;
import io.mrkuhne.mezo.api.dto.UpdatePersonRequest;
import io.mrkuhne.mezo.feature.people.PersonGraphEdgeSource;
import io.mrkuhne.mezo.feature.people.entity.MentionEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.mapper.PeopleMapper;
import io.mrkuhne.mezo.feature.people.repository.MentionRepository;
import io.mrkuhne.mezo.feature.people.repository.PersonRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PeopleService {

    /** Bootstrap feed cap — the view renders at most 8 rows; 50 leaves filter headroom. */
    private static final int MENTION_FEED_LIMIT = 50;
    private static final Duration WEEK = Duration.ofDays(7);

    private final PersonRepository personRepository;
    private final MentionRepository mentionRepository;
    private final PeopleMapper mapper;
    private final ApplicationEventPublisher eventPublisher;
    // ObjectProvider: kikapcsolt gráfnál nincs implementáció, és a személy-lista attól még teljes.
    private final ObjectProvider<PersonGraphEdgeSource> graphEdgeSource;
    private final PersonAffectTrendCalculator affectTrendCalculator;

    /**
     * One-call bootstrap (the knowledge pattern): persons with mention-derived stats computed
     * from live rows (count / rolling-7d / last ts), ordered mention-count desc then name asc
     * (the mock's "active circle" ordering); plus the recent-mention feed (ts desc, capped).
     * Single-user data volumes — in-memory aggregation over one owned scan is fine.
     */
    public PeopleResponse getBootstrap(UUID userId) {
        List<PersonEntity> persons = personRepository.findAllByCreatedByAndDeletedFalseOrderByNameAsc(userId);
        List<MentionEntity> mentions = mentionRepository.findAllByCreatedByAndDeletedFalseOrderByTsDesc(userId);

        Map<UUID, String> nameById = persons.stream()
            .collect(Collectors.toMap(PersonEntity::getId, PersonEntity::getName));
        Map<UUID, List<MentionEntity>> byPerson = mentions.stream()
            .collect(Collectors.groupingBy(MentionEntity::getPersonId));
        Instant weekAgo = Instant.now().minus(WEEK);
        Map<UUID, List<PersonGraphEdgeSource.Edge>> edgesByPerson = graphEdgeSource
            .getIfAvailable(() -> u -> Map.of())
            .edgesByPerson(userId);

        List<PersonResponse> personResponses = persons.stream()
            .map(p -> {
                List<MentionEntity> own = byPerson.getOrDefault(p.getId(), List.of());
                int thisWeek = (int) own.stream().filter(m -> !m.getTs().isBefore(weekAgo)).count();
                Instant lastAt = own.isEmpty() ? null : own.getFirst().getTs(); // list is ts-desc
                PersonResponse response = mapper.toPersonResponse(p, own.size(), thisWeek, lastAt);
                response.setGraphEdges(edgesByPerson.getOrDefault(p.getId(), List.of()).stream()
                    .map(e -> new PersonGraphEdge(e.nodeKind(), e.title(), e.relationHu(), e.strength()))
                    .toList());
                PersonAffectTrend trend = affectTrendCalculator.calculate(own, LocalDate.now());
                response.setAffectTrend(trend.readings());
                response.setAffectTrendStart(trend.startWeek());
                response.setDirection(PersonResponse.DirectionEnum.fromValue(trend.direction()));
                response.setDirectionReason(trend.reason());
                return response;
            })
            .sorted(Comparator.comparingInt(PersonResponse::getMentionCount).reversed()
                .thenComparing(PersonResponse::getName))
            .toList();

        List<MentionResponse> mentionResponses = mentions.stream()
            .filter(m -> nameById.containsKey(m.getPersonId())) // törölt személy sora nem szivárog
            .limit(MENTION_FEED_LIMIT)
            .map(m -> mapper.toMentionResponse(m, nameById.get(m.getPersonId())))
            .toList();

        return new PeopleResponse(personResponses, mentionResponses);
    }

    /** v1 chip write path: server stamps ts=now, source=chip, flagged=false (see MentionEntity). */
    @Transactional
    public MentionResponse logMention(UUID userId, UUID personId, LogMentionRequest req) {
        PersonEntity person = requireOwnedPerson(userId, personId);
        MentionEntity m = new MentionEntity();
        m.setCreatedBy(userId); // server-side from principal, never from client
        m.setPersonId(person.getId());
        m.setTs(Instant.now());
        m.setSource("chip");
        m.setExcerpt(req.getText() == null ? "" : req.getText());
        m.setTone(req.getTone());
        m.setContextLabel(req.getContextLabel() == null ? null : req.getContextLabel().getValue());
        m.setFlagged(false);
        return mapper.toMentionResponse(mentionRepository.save(m), person.getName());
    }

    /** Ownership gate: missing and foreign rows are indistinguishable (404). */
    private PersonEntity requireOwnedPerson(UUID userId, UUID personId) {
        return personRepository.findByIdAndCreatedByAndDeletedFalse(personId, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }

    @Transactional
    public PersonResponse createPerson(UUID userId, CreatePersonRequest req) {
        PersonEntity p = new PersonEntity();
        p.setCreatedBy(userId);
        applyEditableFields(p, req.getName(), req.getAliases(), req.getRelationship().getValue(),
            req.getRelationshipHu(),
            req.getAffectBaseline() == null ? "neutral" : req.getAffectBaseline().getValue(),
            req.getContactCadenceLabel(), req.getNotes());
        PersonEntity saved = personRepository.save(p);
        eventPublisher.publishEvent(new PersonSavedEvent(userId, saved.getId()));
        PersonResponse response = mapper.toPersonResponse(saved, 0, 0, null);
        response.setGraphEdges(List.of());
        response.setDirection(PersonResponse.DirectionEnum.FLAT);
        return response;
    }

    @Transactional
    public PersonResponse updatePerson(UUID userId, UUID personId, UpdatePersonRequest req) {
        PersonEntity p = requireOwnedPerson(userId, personId);
        applyEditableFields(p, req.getName(), req.getAliases(), req.getRelationship().getValue(),
            req.getRelationshipHu(),
            req.getAffectBaseline() == null ? p.getAffectBaseline() : req.getAffectBaseline().getValue(),
            req.getContactCadenceLabel(), req.getNotes());
        PersonEntity saved = personRepository.save(p);
        eventPublisher.publishEvent(new PersonSavedEvent(userId, personId));
        List<MentionEntity> own = mentionRepository
            .findAllByCreatedByAndDeletedFalseOrderByTsDesc(userId).stream()
            .filter(m -> m.getPersonId().equals(personId)).toList();
        Instant weekAgo = Instant.now().minus(WEEK);
        int thisWeek = (int) own.stream().filter(m -> !m.getTs().isBefore(weekAgo)).count();
        PersonResponse response = mapper.toPersonResponse(saved, own.size(), thisWeek,
            own.isEmpty() ? null : own.getFirst().getTs());
        response.setGraphEdges(List.of());
        response.setDirection(PersonResponse.DirectionEnum.FLAT);
        return response;
    }

    @Transactional
    public void deletePerson(UUID userId, UUID personId) {
        personRepository.delete(requireOwnedPerson(userId, personId)); // @SQLDelete → soft
        eventPublisher.publishEvent(new PersonDeletedEvent(userId, personId));
    }

    /** ✕ visszavonás: bármely saját mention soft-deletálható; a személy-scope a 404-hez kell. */
    @Transactional
    public void deleteMention(UUID userId, UUID personId, UUID mentionId) {
        MentionEntity m = mentionRepository.findByIdAndCreatedByAndDeletedFalse(mentionId, userId)
            .filter(x -> x.getPersonId().equals(personId))
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        mentionRepository.delete(m); // @SQLDelete → soft
    }

    /** S4 jelölt-döntés: accept aktivál, reject soft-delete-tel elvet — a soft-deleted candidate
     *  sor az extraktor reject-listája (a nevet nem javasolja újra). Egy döntés per jelölt. */
    @Transactional
    public PersonResponse decidePerson(UUID userId, UUID personId, PersonDecisionRequest req) {
        PersonEntity p = requireOwnedPerson(userId, personId);
        if (!"candidate".equals(p.getStatus())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("PEOPLE_CANDIDATE_ALREADY_DECIDED").build());
        }
        if ("reject".equals(req.getDecision())) {
            PersonResponse snapshot = mapper.toPersonResponse(p, 0, 0, null);
            snapshot.setGraphEdges(List.of());
            snapshot.setDirection(PersonResponse.DirectionEnum.FLAT);
            personRepository.delete(p);   // @SQLDelete → soft; a sor marad reject-listának
            eventPublisher.publishEvent(new PersonDeletedEvent(userId, personId));
            return snapshot;
        }
        p.setStatus("active");
        PersonResponse response = mapper.toPersonResponse(personRepository.save(p), 0, 0, null);
        response.setGraphEdges(List.of());
        response.setDirection(PersonResponse.DirectionEnum.FLAT);
        eventPublisher.publishEvent(new PersonSavedEvent(userId, personId));
        return response;
    }

    /** Az AI-kurálta mezők (knownFacts/ties/affectTrend) szándékosan érintetlenek. */
    private void applyEditableFields(PersonEntity p, String name, List<String> aliases,
        String relationship, String relationshipHu, String affectBaseline,
        String contactCadenceLabel, String notes) {
        String strippedName = name.strip();
        if (strippedName.isEmpty()) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "name").build(), HttpStatus.BAD_REQUEST);
        }
        p.setName(strippedName);
        p.setInitial(p.getName().substring(0, 1).toUpperCase());
        p.setAliases(aliases == null ? new ArrayList<>() : new ArrayList<>(aliases));
        p.setRelationship(relationship);
        p.setRelationshipHu(relationshipHu);
        p.setAffectBaseline(affectBaseline);
        p.setContactCadenceLabel(contactCadenceLabel);
        p.setNotes(notes);
    }
}
