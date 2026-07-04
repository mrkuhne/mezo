package io.mrkuhne.mezo.feature.people.service;

import io.mrkuhne.mezo.api.dto.LogMentionRequest;
import io.mrkuhne.mezo.api.dto.MentionResponse;
import io.mrkuhne.mezo.api.dto.PeopleResponse;
import io.mrkuhne.mezo.api.dto.PersonResponse;
import io.mrkuhne.mezo.feature.people.entity.MentionEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.mapper.PeopleMapper;
import io.mrkuhne.mezo.feature.people.repository.MentionRepository;
import io.mrkuhne.mezo.feature.people.repository.PersonRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
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

        List<PersonResponse> personResponses = persons.stream()
            .map(p -> {
                List<MentionEntity> own = byPerson.getOrDefault(p.getId(), List.of());
                int thisWeek = (int) own.stream().filter(m -> !m.getTs().isBefore(weekAgo)).count();
                Instant lastAt = own.isEmpty() ? null : own.getFirst().getTs(); // list is ts-desc
                return mapper.toPersonResponse(p, own.size(), thisWeek, lastAt);
            })
            .sorted(Comparator.comparingInt(PersonResponse::getMentionCount).reversed()
                .thenComparing(PersonResponse::getName))
            .toList();

        List<MentionResponse> mentionResponses = mentions.stream()
            .limit(MENTION_FEED_LIMIT)
            .map(m -> mapper.toMentionResponse(m, nameById.getOrDefault(m.getPersonId(), "")))
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
        m.setFlagged(false);
        return mapper.toMentionResponse(mentionRepository.save(m), person.getName());
    }

    /** Ownership gate: missing and foreign rows are indistinguishable (404). */
    private PersonEntity requireOwnedPerson(UUID userId, UUID personId) {
        return personRepository.findByIdAndCreatedByAndDeletedFalse(personId, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }
}
