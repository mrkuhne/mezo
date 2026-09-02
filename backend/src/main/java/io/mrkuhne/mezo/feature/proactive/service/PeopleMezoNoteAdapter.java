package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.people.PeopleMezoNoteSource;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * A {@link PeopleMezoNoteSource} proactive-oldali megvalósítása (Emberek S6, mezo-06o0.8): a mai
 * {@code people} companion-üzenet ({@link CompanionMessageEntity#KIND_PEOPLE}) bekezdéseit adja
 * vissza egyetlen mondatként.
 *
 * <p>Üres/blank eredmény {@code Optional.empty()}-re fordul — egy üres üzenet nem jobb a
 * {@code PeopleService} determinisztikus tartalékánál.
 *
 * <p>{@code @ConditionalOnProperty}: kikapcsolt companion/proaktív mellett ez a bean nem létezik,
 * és a {@code PeopleService} a saját tartalékával dolgozik tovább.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
    havingValue = "true")
public class PeopleMezoNoteAdapter implements PeopleMezoNoteSource {

    private final CompanionMessageRepository companionMessageRepository;

    @Override
    @Transactional(readOnly = true)
    public Optional<String> todaysNote(UUID userId, LocalDate today) {
        return companionMessageRepository
            .findByCreatedByAndMessageDateAndKind(userId, today, CompanionMessageEntity.KIND_PEOPLE)
            .map(m -> String.join(" ", m.getContent().body()))
            .map(String::strip)
            .filter(text -> !text.isEmpty());
    }
}
