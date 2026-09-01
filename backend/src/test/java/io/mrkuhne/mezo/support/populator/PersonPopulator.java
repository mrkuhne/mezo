package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.repository.PersonRepository;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/**
 * Test data factory for the Person aggregate — see
 * docs/references/integration_test_framework.md (one populator per aggregate). Persists via
 * repository {@code saveAndFlush} so DB CHECKs fire.
 */
@TestComponent
@RequiredArgsConstructor
public class PersonPopulator {

    private final PersonRepository personRepository;

    /** Minimal person with sane defaults; relationship/affect exercise the DB CHECKs. */
    public PersonEntity createPerson(UUID owner, String name) {
        return createPerson(owner, name, "mentee", "positive");
    }

    public PersonEntity createPerson(UUID owner, String name, String relationship, String affectBaseline) {
        PersonEntity p = new PersonEntity();
        p.setCreatedBy(owner);
        p.setName(name);
        p.setInitial(name.substring(0, 1));
        p.setRelationship(relationship);
        p.setRelationshipHu("Mentee · teszt");
        p.setAffectBaseline(affectBaseline);
        p.setContactCadenceLabel("Havi 1:1");
        p.setNotes("Teszt személy.");
        p.setAliases(List.of("Marcika"));
        p.setKnownFacts(List.of("Teszt fact"));
        p.setTies(List.of());
        p.setAffectTrend(List.of(3, 4, 5));
        return personRepository.saveAndFlush(p);
    }

    /** S4 extractor-candidate row — status/sourceKind exercise the DB CHECKs. */
    public PersonEntity createCandidate(UUID owner, String name, String notes) {
        PersonEntity p = new PersonEntity();
        p.setCreatedBy(owner);
        p.setName(name);
        p.setInitial(name.substring(0, 1).toUpperCase());
        p.setRelationship("friend");
        p.setRelationshipHu("Ismerős");
        p.setAffectBaseline("neutral");
        p.setNotes(notes);
        p.setStatus("candidate");
        p.setSourceKind("extractor");
        return personRepository.saveAndFlush(p);
    }
}
