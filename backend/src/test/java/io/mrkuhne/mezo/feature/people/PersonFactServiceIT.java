package io.mrkuhne.mezo.feature.people;

import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonFactEntity;
import io.mrkuhne.mezo.feature.people.repository.PersonFactRepository;
import io.mrkuhne.mezo.feature.people.service.PersonFactService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * S3 (mezo-d6ivw.3): a people-oldali person_fact írókapu — capture (dedupe, vétó, supersede,
 * plafon), undo, toggle, seen, prompt-szűrés. LLM-mentes: a capture bemenete kész javaslat-lista.
 */
class PersonFactServiceIT extends AbstractIntegrationTest {

    @Autowired private PersonFactService personFactService;
    @Autowired private PersonFactRepository personFactRepository;
    @Autowired private PersonPopulator personPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    private static PersonFactService.PersonFactCapture cap(UUID personId, String kind, String text) {
        return new PersonFactService.PersonFactCapture(personId, kind, text, "medium");
    }

    @Test
    void testCapture_shouldPersistFact_forActivePerson() {
        UUID userId = databasePopulator.populateUser("pf-capture@test.local");
        PersonEntity anna = personPopulator.createPerson(userId, "Anna");

        List<PersonFactEntity> saved = personFactService.capture(userId,
            PersonFactEntity.SOURCE_CHAT_TURN, "msg-1",
            List.of(cap(anna.getId(), PersonFactEntity.KIND_PREFERENCE, "Nem szereti a meglepetéseket")));

        assertThat(saved).hasSize(1);
        PersonFactEntity fact = saved.get(0);
        assertThat(fact.getKind()).isEqualTo("preference");
        assertThat(fact.getFactText()).isEqualTo("Nem szereti a meglepetéseket");
        assertThat(fact.getConfidence()).isEqualTo("medium");
        assertThat(fact.getSourceRefKind()).isEqualTo("chat_turn");
        assertThat(fact.getSourceRefId()).isEqualTo("msg-1");
        assertThat(fact.isActive()).isTrue();
        assertThat(fact.isIncludeInPrompt()).isTrue();
        assertThat(fact.getSeenAt()).isNull();
    }

    @Test
    void testCapture_shouldDropInvalid_andKeepValid() {
        UUID userId = databasePopulator.populateUser("pf-invalid@test.local");
        PersonEntity anna = personPopulator.createPerson(userId, "Anna");

        List<PersonFactEntity> saved = personFactService.capture(userId,
            PersonFactEntity.SOURCE_CHAT_TURN, "msg-2",
            List.of(
                cap(anna.getId(), "rumor", "nem fajta"),
                cap(anna.getId(), PersonFactEntity.KIND_PREFERENCE, "   "),
                cap(anna.getId(), PersonFactEntity.KIND_PREFERENCE, "x".repeat(301)),
                cap(anna.getId(), PersonFactEntity.KIND_SHARED_ACTIVITY, "Szeretnek együtt futni")));

        assertThat(saved).hasSize(1);
        assertThat(saved.get(0).getFactText()).isEqualTo("Szeretnek együtt futni");
    }

    @Test
    void testCapture_shouldDedupeNormalizedText_andHonorUndoVeto() {
        UUID userId = databasePopulator.populateUser("pf-dedupe@test.local");
        PersonEntity anna = personPopulator.createPerson(userId, "Anna");
        List<PersonFactEntity> first = personFactService.capture(userId,
            PersonFactEntity.SOURCE_CHAT_TURN, "msg-3",
            List.of(cap(anna.getId(), PersonFactEntity.KIND_PREFERENCE, "Kávé nélkül nem ember")));
        assertThat(first).hasSize(1);

        // azonos szöveg (case/whitespace-eltéréssel) → nem íródik újra
        List<PersonFactEntity> dupe = personFactService.capture(userId,
            PersonFactEntity.SOURCE_CHAT_TURN, "msg-4",
            List.of(cap(anna.getId(), PersonFactEntity.KIND_PREFERENCE, "  kávé   nélkül nem EMBER ")));
        assertThat(dupe).isEmpty();

        // visszavonás után a szöveg tartós vétó
        personFactService.undo(userId, anna.getId(), first.get(0).getId());
        List<PersonFactEntity> resurrect = personFactService.capture(userId,
            PersonFactEntity.SOURCE_CHAT_TURN, "msg-5",
            List.of(cap(anna.getId(), PersonFactEntity.KIND_PREFERENCE, "Kávé nélkül nem ember")));
        assertThat(resurrect).isEmpty();
        assertThat(personFactRepository
            .findByCreatedByAndPersonIdAndDeletedFalseOrderByCreatedAtDesc(userId, anna.getId()))
            .hasSize(1)
            .allSatisfy(f -> assertThat(f.isActive()).isFalse());
    }

    @Test
    void testCapture_shouldSupersedeVolatileKind_andAccumulateOthers() {
        UUID userId = databasePopulator.populateUser("pf-supersede@test.local");
        PersonEntity anna = personPopulator.createPerson(userId, "Anna");
        PersonFactEntity oldState = personFactService.capture(userId,
            PersonFactEntity.SOURCE_CHAT_TURN, "msg-6",
            List.of(cap(anna.getId(), PersonFactEntity.KIND_RELATIONSHIP_STATE, "Épp együtt járnak Petivel")))
            .get(0);

        List<PersonFactEntity> saved = personFactService.capture(userId,
            PersonFactEntity.SOURCE_CHAT_TURN, "msg-7",
            List.of(cap(anna.getId(), PersonFactEntity.KIND_RELATIONSHIP_STATE, "Szakítottak Petivel")));

        assertThat(saved).hasSize(1);
        assertThat(personFactRepository.findById(oldState.getId()).orElseThrow().isActive()).isFalse();

        // nem-volatile fajta halmozódik
        personFactService.capture(userId, PersonFactEntity.SOURCE_CHAT_TURN, "msg-8",
            List.of(cap(anna.getId(), PersonFactEntity.KIND_PREFERENCE, "Szereti a teát")));
        personFactService.capture(userId, PersonFactEntity.SOURCE_CHAT_TURN, "msg-9",
            List.of(cap(anna.getId(), PersonFactEntity.KIND_PREFERENCE, "Utálja a hideget")));
        assertThat(personFactService.byPerson(userId, anna.getId()))
            .filteredOn(f -> f.getKind().equals(PersonFactEntity.KIND_PREFERENCE))
            .hasSize(2);
    }

    @Test
    void testCapture_shouldCapPerSource() {
        UUID userId = databasePopulator.populateUser("pf-cap@test.local");
        PersonEntity anna = personPopulator.createPerson(userId, "Anna");

        List<PersonFactEntity> saved = personFactService.capture(userId,
            PersonFactEntity.SOURCE_NIGHTLY_DAY, "2026-09-25",
            List.of(
                cap(anna.getId(), PersonFactEntity.KIND_PREFERENCE, "Egy"),
                cap(anna.getId(), PersonFactEntity.KIND_PREFERENCE, "Kettő"),
                cap(anna.getId(), PersonFactEntity.KIND_PREFERENCE, "Három"),
                cap(anna.getId(), PersonFactEntity.KIND_PREFERENCE, "Négy")));

        assertThat(saved).hasSize(3);
    }

    @Test
    void testUndo_shouldThrow404_onForeignFact() {
        UUID userId = databasePopulator.populateUser("pf-foreign@test.local");
        UUID stranger = databasePopulator.populateUser("pf-stranger@test.local");
        PersonEntity anna = personPopulator.createPerson(userId, "Anna");
        PersonFactEntity fact = personFactService.capture(userId,
            PersonFactEntity.SOURCE_CHAT_TURN, "msg-10",
            List.of(cap(anna.getId(), PersonFactEntity.KIND_SENSITIVITY, "Érzékeny téma a munka")))
            .get(0);

        assertThatThrownBy(() -> personFactService.undo(stranger, anna.getId(), fact.getId()))
            .isInstanceOf(SystemRuntimeErrorException.class);
        assertThatThrownBy(() -> personFactService.undo(userId, UUID.randomUUID(), fact.getId()))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }

    @Test
    void testToggleAndPromptFacts_shouldRespectFlags() {
        UUID userId = databasePopulator.populateUser("pf-toggle@test.local");
        PersonEntity anna = personPopulator.createPerson(userId, "Anna");
        PersonEntity beni = personPopulator.createPerson(userId, "Beni");
        PersonFactEntity keep = personFactService.capture(userId,
            PersonFactEntity.SOURCE_CHAT_TURN, "msg-11",
            List.of(cap(anna.getId(), PersonFactEntity.KIND_PREFERENCE, "Szereti a túrázást"))).get(0);
        PersonFactEntity muted = personFactService.capture(userId,
            PersonFactEntity.SOURCE_CHAT_TURN, "msg-12",
            List.of(cap(beni.getId(), PersonFactEntity.KIND_PREFERENCE, "Éjszakai bagoly"))).get(0);

        PersonFactEntity toggled = personFactService.setIncludeInPrompt(userId, beni.getId(), muted.getId(), false);
        assertThat(toggled.isIncludeInPrompt()).isFalse();

        List<PersonFactEntity> prompt = personFactService.promptFacts(userId,
            List.of(anna.getId(), beni.getId()));
        assertThat(prompt).extracting(PersonFactEntity::getId).containsExactly(keep.getId());
    }

    @Test
    void testMarkSeenAndKnownPersons() {
        UUID userId = databasePopulator.populateUser("pf-seen@test.local");
        PersonEntity anna = personPopulator.createPerson(userId, "Anna");
        personPopulator.createCandidate(userId, "Új Arc", "jegyzet");
        PersonFactEntity fact = personFactService.capture(userId,
            PersonFactEntity.SOURCE_NIGHTLY_DAY, "2026-09-25",
            List.of(cap(anna.getId(), PersonFactEntity.KIND_IMPORTANT_DATE, "Születésnap: október 12."))).get(0);
        assertThat(fact.getSeenAt()).isNull();

        personFactService.markSeen(userId, anna.getId());
        assertThat(personFactRepository.findById(fact.getId()).orElseThrow().getSeenAt()).isNotNull();

        List<PersonFactService.KnownPerson> known = personFactService.knownPersons(userId);
        assertThat(known).extracting(PersonFactService.KnownPerson::name).containsExactly("Anna");
        assertThat(known.get(0).aliases()).contains("Marcika");
    }
}
