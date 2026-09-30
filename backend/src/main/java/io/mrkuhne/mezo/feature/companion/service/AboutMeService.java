package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.people.entity.PersonFactEntity;
import io.mrkuhne.mezo.feature.people.service.PersonFactService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.text.TextFold;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * „Rólam is" (mezo-d6ivw.13): a chat person fact the user also claims as their own. The person
 * memory keeps the fact (person first — the owner-fact extractor no longer proposes it); this tap
 * copies it into {@code knowledge_fact} (source {@code person_fact}, owner mezo / category life),
 * linked by {@code source_person_fact_id}, one live copy per person fact. Tapping again removes the
 * copy WITHOUT a forget veto — it is the user changing their mind, not "never learn this". The
 * copy goes with its person fact: {@link AboutMeUndoListener} on an undo, and the chat forget flow
 * calls {@link #remove} directly. Every write publishes {@link KnowledgeFactChangedEvent} (graph).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class AboutMeService {

    private final KnowledgeFactRepository repository;
    private final ApplicationEventPublisher eventPublisher;
    private final ObjectProvider<PersonFactService> personFactService;

    /** Copies the person fact (idempotent); returns the live copy's id. PEOPLE off, foreign,
     *  deleted or undone person fact ⇒ 404. */
    @Transactional
    public UUID add(UUID userId, UUID personFactId) {
        PersonFactService facts = personFactService.getIfAvailable();
        if (facts == null) {
            throw new SystemRuntimeErrorException(SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
        }
        PersonFactEntity personFact = facts.ownedActiveFact(userId, personFactId);
        List<KnowledgeFactEntity> existing = repository.findByCreatedByAndSourcePersonFactIdInAndDeletedFalse(
                userId, List.of(personFactId));
        if (!existing.isEmpty()) {
            return existing.getFirst().getId();
        }
        String name = facts.personNames(userId, List.of(personFact.getPersonId())).getOrDefault(personFact.getPersonId(), "");
        KnowledgeFactEntity fact = new KnowledgeFactEntity();
        fact.setCreatedBy(userId);
        fact.setFactText(withName(personFact.getFactText(), name));
        fact.setOwner("mezo");
        fact.setCategory("life");
        fact.setSource(KnowledgeFactEntity.SOURCE_PERSON_FACT);
        fact.setSourcePersonFactId(personFactId);
        fact.setLastReinforcedAt(Instant.now());
        fact.setProvenance(MemoryProvenanceEnvelope.personFact());
        KnowledgeFactEntity saved = repository.saveAndFlush(fact);
        eventPublisher.publishEvent(new KnowledgeFactChangedEvent(userId, saved.getId()));
        return saved.getId();
    }

    /** Removes the live copy (soft delete, no veto); nothing to remove is not an error. Needs no
     *  people bean — the copy is companion data. */
    @Transactional
    public void remove(UUID userId, UUID personFactId) {
        for (KnowledgeFactEntity copy : repository.findByCreatedByAndSourcePersonFactIdInAndDeletedFalse(
                userId, List.of(personFactId))) {
            repository.delete(copy); // @SQLDelete → soft delete
            eventPublisher.publishEvent(new KnowledgeFactChangedEvent(userId, copy.getId()));
        }
    }

    /** person fact id → live copy id, for the turn-memory chips. Deliberately NOT
     *  {@code @Transactional} (the TurnMemoryService read idiom): it joins the caller's transaction. */
    public Map<UUID, UUID> aboutMeFactIds(UUID userId, Collection<UUID> personFactIds) {
        if (personFactIds.isEmpty()) {
            return Map.of();
        }
        return repository.findByCreatedByAndSourcePersonFactIdInAndDeletedFalse(userId, personFactIds).stream()
                .collect(Collectors.toMap(KnowledgeFactEntity::getSourcePersonFactId, KnowledgeFactEntity::getId,
                        (first, second) -> first));
    }

    /** The person fact already reads as the user's sentence when it names the person (any
     *  inflection — "Dórival" names Dóri); otherwise the name leads, so the Tudástár line is not
     *  an orphan ("tavasz óta a strandröpi-párod" → "Dóri: tavasz óta …"). */
    static String withName(String text, String name) {
        if (name == null || name.isBlank() || TextFold.fold(text).contains(TextFold.fold(name))) {
            return text;
        }
        return name + ": " + text;
    }
}
