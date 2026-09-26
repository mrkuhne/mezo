package io.mrkuhne.mezo.feature.people.service;

import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonFactEntity;
import io.mrkuhne.mezo.feature.people.repository.PersonFactRepository;
import io.mrkuhne.mezo.feature.people.repository.PersonRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * S3 (mezo-d6ivw.3): a person_fact írókapu — a companion-oldali kinyerők KIZÁRÓLAG ezen a
 * people-tulajdonú szervizen át írnak (ArchUnit-irány: companion → people, sosem fordítva).
 *
 * <p>Szabályok (owner-döntések, 2026-09-26, spec S3 delta):
 * <ul>
 *   <li>Dedupe + tartós vétó: egy személy NEM törölt sorainak normalizált szövege ellen — egy
 *       visszavont (inaktív) tény szövege soha nem íródik újra.</li>
 *   <li>Supersede-not-append: a {@link PersonFactEntity#VOLATILE_KINDS} fajtáknál az új tény a
 *       régi aktív azonos-fajta sorokat deaktiválja.</li>
 *   <li>Érzékeny fajta ({@code sensitivity}): chat-kontextusban használható, proaktív üzenetben
 *       SOHA — a szabályt a {@link #PROACTIVE_EXCLUDED_KINDS} konstans hordozza (S5 fogyasztja).</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.PEOPLE_SWITCH, havingValue = "true")
public class PersonFactService {

    /** Owner-döntés 2026-09-26: kényes tény kéretlen (proaktív) üzenetbe soha nem kerül. */
    public static final Set<String> PROACTIVE_EXCLUDED_KINDS = Set.of(PersonFactEntity.KIND_SENSITIVITY);

    static final int MAX_FACTS_PER_SOURCE = 3;
    private static final Set<String> CONFIDENCES = Set.of("low", "medium", "high");
    private static final String CONFIDENCE_FALLBACK = "medium";
    private static final String STATUS_ACTIVE = "active";

    private final PersonFactRepository personFactRepository;
    private final PersonRepository personRepository;

    /** Egy kinyert tény-javaslat, ahogy a companion-oldali írók átadják. */
    public record PersonFactCapture(UUID personId, String kind, String text, String confidence) {}

    /** Aktív személy a kinyerők földeléséhez (név/alias szerinti feloldás az íróknál). */
    public record KnownPerson(UUID id, String name, List<String> aliases) {}

    /**
     * Javaslatok mentése egy forrásból. Kód dönt, az LLM sosem: fajta-whitelist, hossz-plafon,
     * normalizált dedupe + vétó, volatile-supersede, forrásonként {@value #MAX_FACTS_PER_SOURCE}
     * darab plafon. A kihagyott javaslat néma — sosem hiba.
     */
    @Transactional
    public List<PersonFactEntity> capture(UUID userId, String sourceRefKind, String sourceRefId,
            List<PersonFactCapture> captures) {
        List<PersonFactEntity> saved = new ArrayList<>();
        for (PersonFactCapture c : captures) {
            if (saved.size() >= MAX_FACTS_PER_SOURCE) {
                break;
            }
            if (c.personId() == null || c.text() == null || c.text().isBlank()
                    || c.text().trim().length() > PersonFactEntity.FACT_TEXT_MAX_CHARS
                    || !PersonFactEntity.KINDS.contains(c.kind())) {
                continue;
            }
            List<PersonFactEntity> existing = personFactRepository
                .findByCreatedByAndPersonIdAndDeletedFalseOrderByCreatedAtDesc(userId, c.personId());
            String normalized = normalize(c.text());
            boolean duplicate = existing.stream()
                .anyMatch(f -> normalize(f.getFactText()).equals(normalized));
            if (duplicate) {
                continue; // aktív duplum VAGY visszavont vétó — egyik sem íródik újra
            }
            if (PersonFactEntity.VOLATILE_KINDS.contains(c.kind())) {
                existing.stream()
                    .filter(f -> f.isActive() && c.kind().equals(f.getKind()))
                    .forEach(f -> {
                        f.setActive(false);
                        personFactRepository.save(f);
                    });
            }
            PersonFactEntity fact = new PersonFactEntity();
            fact.setCreatedBy(userId);
            fact.setPersonId(c.personId());
            fact.setKind(c.kind());
            fact.setFactText(c.text().trim());
            fact.setConfidence(CONFIDENCES.contains(c.confidence()) ? c.confidence() : CONFIDENCE_FALLBACK);
            fact.setSourceRefKind(sourceRefKind);
            fact.setSourceRefId(sourceRefId);
            saved.add(personFactRepository.saveAndFlush(fact));
        }
        return saved;
    }

    /** Visszavonás/nyugdíjazás: {@code active=false} — a sor megmarad vétónak. */
    @Transactional
    public void undo(UUID userId, UUID personId, UUID factId) {
        PersonFactEntity fact = requireOwnedFact(userId, personId, factId);
        fact.setActive(false);
        personFactRepository.save(fact);
    }

    @Transactional
    public PersonFactEntity setIncludeInPrompt(UUID userId, UUID personId, UUID factId, boolean include) {
        PersonFactEntity fact = requireOwnedFact(userId, personId, factId);
        fact.setIncludeInPrompt(include);
        return personFactRepository.save(fact);
    }

    /** A chip-fetch: egy forrás aktív tényei (üres, amíg a kinyerés fut — a FE ebből tud várni). */
    @Transactional(readOnly = true)
    public List<PersonFactEntity> bySourceRef(UUID userId, String sourceRefKind, String sourceRefId) {
        return personFactRepository
            .findByCreatedByAndSourceRefKindAndSourceRefIdAndActiveTrueAndDeletedFalseOrderByCreatedAtAsc(
                userId, sourceRefKind, sourceRefId);
    }

    /** Az „új" jelölések leszedése a személy oldalán: csak a még null seen_at sorokat bélyegzi. */
    @Transactional
    public void markSeen(UUID userId, UUID personId) {
        Instant now = Instant.now();
        personFactRepository.findByCreatedByAndPersonIdAndDeletedFalseOrderByCreatedAtDesc(userId, personId)
            .stream()
            .filter(f -> f.getSeenAt() == null)
            .forEach(f -> {
                f.setSeenAt(now);
                personFactRepository.save(f);
            });
    }

    /** A snapshot-blokk bemenete: aktív ÉS bekapcsolt tények az adott személyekhez. */
    @Transactional(readOnly = true)
    public List<PersonFactEntity> promptFacts(UUID userId, Collection<UUID> personIds) {
        if (personIds.isEmpty()) {
            return List.of();
        }
        return personFactRepository
            .findByCreatedByAndPersonIdInAndActiveTrueAndIncludeInPromptTrueAndDeletedFalseOrderByCreatedAtDesc(
                userId, personIds);
    }

    /** A kinyerők földelése: csak status=active személy — jelöltről/archívról nem jegyzünk tényt. */
    @Transactional(readOnly = true)
    public List<KnownPerson> knownPersons(UUID userId) {
        return personRepository.findAllByCreatedByAndDeletedFalseOrderByNameAsc(userId).stream()
            .filter(p -> STATUS_ACTIVE.equals(p.getStatus()))
            .map(p -> new KnownPerson(p.getId(), p.getName(), List.copyOf(p.getAliases())))
            .toList();
    }

    /** A személy oldala / bootstrap: az AKTÍV sorok, legfrissebb elöl. */
    @Transactional(readOnly = true)
    public List<PersonFactEntity> byPerson(UUID userId, UUID personId) {
        return personFactRepository
            .findByCreatedByAndPersonIdAndDeletedFalseOrderByCreatedAtDesc(userId, personId).stream()
            .filter(PersonFactEntity::isActive)
            .toList();
    }

    private PersonFactEntity requireOwnedFact(UUID userId, UUID personId, UUID factId) {
        return personFactRepository.findByIdAndCreatedByAndPersonIdAndDeletedFalse(factId, userId, personId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }

    private static String normalize(String text) {
        return text.trim().toLowerCase().replaceAll("\\s+", " ");
    }
}
