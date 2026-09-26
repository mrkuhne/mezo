package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.people.entity.PersonFactEntity;
import io.mrkuhne.mezo.feature.people.service.PersonFactService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/**
 * S3 (mezo-d6ivw.3): post-turn személy-tény kinyerés — a {@link FactExtractionService} testvére,
 * de a tények nem a felhasználóról, hanem az ISMERT személyekről szólnak, és a people-tulajdonú
 * {@link PersonFactService} kapun át íródnak (ArchUnit-irány: companion → people).
 *
 * <p>Földelés kódban, nem az LLM-ben: csak olyan tény marad meg, amelynek a neve PONTOSAN EGY
 * aktív személy nevére/aliasára illeszkedik (hu-fold, kisbetűs egyezés) — nulla vagy több találat
 * = eldobás (owner-döntés: sosem találgatunk két hasonló név között). Ismeretlen névből itt nem
 * lesz semmi: az éjszakai jelölt-út ({@code PersonExtractionService}) a chat-szöveget is olvassa,
 * így az új arc felvételi javaslata onnan érkezik.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class PersonFactExtractionService {

    /** A prompt első szava — a fake LLM erre kulcsolja a determinisztikus választ. */
    public static final String PERSON_FACT_MARKER = "SZEMÉLYTÉNY";

    static final String EXTRACTION_PROMPT = """
            SZEMÉLYTÉNY. A beszélgetés-fordulóból gyűjtsd ki az ISMERT SZEMÉLYEKRŐL szóló ÚJ, tartós tényeket
            — kizárólag azt, amit {{NÉV}} maga állított. NEM {{NÉV}}-ről: róla más gyűjtő gondoskodik.
            Fajták: preference (mit szeret/nem szeret), relationship_state (a kapcsolat mostani állapota),
            shared_activity (közös, ismétlődő tevékenység), important_date (fontos dátum),
            sensitivity (mire érzékeny, mivel bánj óvatosan).
            Csak az ISMERT SZEMÉLYEK listáján szereplő nevekhez írj tényt; bizonytalan egyezésnél hagyd ki.
            Egyszeri eseményt, kérdést, feltételezést NE vegyél fel.
            Válaszolj KIZÁRÓLAG egy JSON tömbbel, magyarázat nélkül, pontosan ebben a formában:
            [{"name":"...","kind":"preference","fact":"...","confidence":"low|medium|high"}]
            Ha nincs ilyen tény: []""";

    private static final Locale HU = Locale.forLanguageTag("hu");

    private final CompanionLlm companionLlm;
    private final LlmCallContextHolder llmCallContextHolder;
    private final ObjectMapper objectMapper;
    private final PromptPersona promptPersona;
    // ObjectProvider: a PEOPLE_SWITCH független a COMPANION párostól — kikapcsolva néma no-op.
    private final ObjectProvider<PersonFactService> personFactService;

    /** Egy kinyert elem, ahogy az LLM visszaadja. */
    record ExtractedPersonFact(String name, String kind, String fact, String confidence) {}

    /** A teljes kinyerés egy commitolt fordulóra; a perzisztált tények számát adja vissza. */
    public int extractFromTurn(UUID userId, UUID userMessageId, String userContent, String assistantContent) {
        PersonFactService facts = personFactService.getIfAvailable();
        if (facts == null) {
            return 0;
        }
        List<PersonFactService.KnownPerson> known = facts.knownPersons(userId);
        if (known.isEmpty()) {
            return 0;
        }
        String names = known.stream().map(PersonFactService.KnownPerson::name)
                .collect(Collectors.joining(", "));
        String transcript = PromptPersona.USER_TURN_LABEL + userContent + "\nMezo: " + assistantContent
                + "\n\nISMERT SZEMÉLYEK: " + names;
        String raw;
        try {
            raw = llmCallContextHolder.runWith(
                    new LlmCallContext("companion_person_fact_extract", "extract", null, null),
                    () -> companionLlm.complete(promptPersona.render(userId, EXTRACTION_PROMPT), transcript));
        } catch (Exception e) {
            log.warn("Person-fact extraction LLM call failed for user {}", userId, e);
            return 0;
        }
        List<PersonFactService.PersonFactCapture> captures = parse(raw).stream()
                .map(f -> resolve(known, f))
                .filter(Objects::nonNull)
                .toList();
        if (captures.isEmpty()) {
            return 0;
        }
        return facts.capture(userId, PersonFactEntity.SOURCE_CHAT_TURN, userMessageId.toString(), captures)
                .size();
    }

    /** Defensive parse: first '['..last ']' substring — a {@code FactExtractionService.parse} idióma. */
    private List<ExtractedPersonFact> parse(String raw) {
        int start = raw.indexOf('[');
        int end = raw.lastIndexOf(']');
        if (start < 0 || end <= start) {
            return List.of();
        }
        try {
            return objectMapper.readValue(raw.substring(start, end + 1), new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("Person-fact extraction answer was not parseable JSON — dropping: {}", raw, e);
            return List.of();
        }
    }

    /** Pontosan EGY aktív személyre illeszkedő név (név vagy alias, hu-fold) — különben eldobás. */
    private static PersonFactService.PersonFactCapture resolve(
            List<PersonFactService.KnownPerson> known, ExtractedPersonFact f) {
        if (f.name() == null || f.fact() == null || !PersonFactEntity.KINDS.contains(f.kind())) {
            return null;
        }
        String needle = f.name().strip().toLowerCase(HU);
        List<PersonFactService.KnownPerson> matches = known.stream()
                .filter(p -> p.name().toLowerCase(HU).equals(needle)
                        || p.aliases().stream().anyMatch(a -> a.toLowerCase(HU).equals(needle)))
                .toList();
        if (matches.size() != 1) {
            return null; // 0 = ismeretlen név (jelölt-út dolga), 2+ = kétértelmű — sosem találgatunk
        }
        return new PersonFactService.PersonFactCapture(
                matches.getFirst().id(), f.kind(), f.fact(), f.confidence());
    }
}
