package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.entity.RecalledMemoriesEnvelope;
import io.mrkuhne.mezo.feature.people.entity.PersonFactEntity;
import io.mrkuhne.mezo.feature.people.service.MatchedPerson;
import io.mrkuhne.mezo.feature.people.service.MentionDetectionService;
import io.mrkuhne.mezo.feature.people.service.PersonFactService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * S8 (mezo-d6ivw.12): deterministic people recall — the 09-26 planner made zero people reads in
 * six turns, so code names the people now. The user message is matched with the mention
 * detector's own TextFold/word-start rule (read-only), the matched people (≤ {@value #MAX_PERSONS})
 * get an {@code [Emberek]} block in the VOLATILE half (the same rows the planner tool would fetch),
 * and those with prompt-enabled facts are disclosed as {@code kind=person} recalled items — the
 * chat's "Emlékszem" line. Fail-open: any failure = no block, no disclosure, the turn proceeds.
 * (A DataAccessException still poisons the surrounding turn transaction — the IDENT-3 caveat of
 * {@link PeopleSnapshotBlock} applies unchanged.)
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.COMPANION_PEOPLE_RECALL_SWITCH},
        havingValue = "true")
public class PeopleRecall {

    static final int MAX_PERSONS = 5;
    static final int FACTS_PER_PERSON = 3;

    private final MentionDetectionService mentionDetection;
    private final PeopleSnapshotBlock peopleSnapshotBlock;
    private final ObjectProvider<PersonFactService> personFactService;

    public record Result(String block, List<RecalledMemoriesEnvelope.Item> items) {
        public static final Result EMPTY = new Result("", List.of());
    }

    public Result recall(UUID userId, String userContent, LocalDate today) {
        try {
            List<MatchedPerson> matched = mentionDetection.matchActivePersons(userId, userContent, MAX_PERSONS);
            if (matched.isEmpty()) {
                return Result.EMPTY;
            }
            String block = peopleSnapshotBlock.renderMentioned(userId, today,
                    matched.stream().map(MatchedPerson::id).toList());
            return new Result(block.isEmpty() ? "" : "\n\n" + block, disclosed(userId, matched));
        } catch (RuntimeException e) {
            log.warn("People recall failed for user {} — the turn proceeds without it", userId, e);
            return Result.EMPTY;
        }
    }

    private List<RecalledMemoriesEnvelope.Item> disclosed(UUID userId, List<MatchedPerson> matched) {
        PersonFactService facts = personFactService.getIfAvailable();
        if (facts == null) {
            return List.of();
        }
        Map<UUID, List<String>> byPerson = facts.promptFacts(userId, matched.stream().map(MatchedPerson::id).toList())
                .stream()
                .collect(Collectors.groupingBy(PersonFactEntity::getPersonId, LinkedHashMap::new,
                        Collectors.mapping(PersonFactEntity::getFactText, Collectors.toList())));
        return matched.stream()
                .filter(p -> byPerson.containsKey(p.id()))
                .map(p -> new RecalledMemoriesEnvelope.Item(RecalledMemoriesEnvelope.KIND_PERSON, p.id(), null,
                        p.name(), String.join("\n", byPerson.get(p.id()).stream().limit(FACTS_PER_PERSON).toList()), 1.0))
                .toList();
    }
}
