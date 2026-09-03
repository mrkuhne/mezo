package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphEdgeStructurer;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphPromotionService;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphService;
import io.mrkuhne.mezo.feature.companion.repository.DailySummaryRepository;
import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.JournalEntryRepository;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.people.entity.MentionEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.repository.MentionRepository;
import io.mrkuhne.mezo.feature.people.repository.PersonRepository;
import io.mrkuhne.mezo.feature.ritual.repository.RitualDayRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.text.SafeTruncate;
import io.mrkuhne.mezo.techcore.text.TextFold;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * Emberek S4 (bd mezo-06o0.3, spec §3 harmadik írási út): az éjszakai people-kör — a
 * {@code LifeEventExtractionService} ikertestvére. Egy olcsó-LLM hívás a nap narratív szövegeire
 * és tone-nélküli mention-jeire, két feladattal: (1) a nap tone-nélküli mention-jeinek gazdagítása
 * (tónus + intenzitás + kontextus-címke); (2) ismeretlen, VISSZATÉRŐ nevekre
 * {@code person(status='candidate', source_kind='extractor')} javaslat, evidencia-idézetekkel a
 * {@code notes}-ban. A harmadik, S5-ben (mezo-06o0.4) élesedő feladat — {@link #linkPersonEdges} —
 * a nap aznap említett, még éltelen PERSON node-jait futtatja végig a {@code GraphEdgeStructurer}-en;
 * a fenti két feladat viszont sosem ír gráfot, ez a passz is csak a {@code persistNight} UTÁN,
 * külön tranzakcióban.
 *
 * <p><b>Bizonytalan utalás SOHA nem ír.</b> A modell javaslata csak jelölt: a szerviz maga
 * validál — a név foldja nem eshet egybe egyetlen ismert névvel/aliasszal sem (a soft-deleted,
 * azaz elvetett jelölt sorokat IS beleértve — reject-lista), és a névnek ténylegesen vissza kell
 * térnie a saját szövegekben: a nap narratívájában legalább {@value #DAY_MIN_OCCURRENCES}, vagy a
 * záró 7 nap narratívájában legalább {@value #WEEK_MIN_OCCURRENCES} szó-eleji előfordulás.
 *
 * <p><b>Pre-spend kapu:</b> ha a napnak se tone-nélküli mentionje, se narratívája — nincs hívás.
 * Nap-kapu nem kell a LifeEvent-féle {@code countExtractorNodesOnDay} formában: az újrafutás
 * önmagában idempotens (a gazdagított mention már nem tone-nélküli; a javasolt/elvetett név a
 * dedup-listán van).
 *
 * <p>IDENT-3: minden hibaág (modell, parse, persist) warn + {@link PersonExtractionResult#ZERO},
 * kivétel sosem szökik ki. A persist a LifeEvent-minta szerint EGY tranzakció a self-proxyn át
 * ({@link #persistNight}) — fél éjszaka sosem íródik.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PEOPLE_SWITCH},
    havingValue = "true")
public class PersonExtractionService {

    /** Dispatch key for FakeCompanionLlm (a GraphEdgeStructurer.STRUCTURER_MARKER idióma). */
    public static final String EXTRACTOR_MARKER = "[person-extractor]";

    /** person.source_kind for extractor-born candidates. */
    public static final String SOURCE_EXTRACTOR = "extractor";

    static final int DAY_MIN_OCCURRENCES = 2;
    static final int WEEK_MIN_OCCURRENCES = 3;
    private static final int MAX_CANDIDATES = 3;
    private static final int MAX_QUOTES = 3;
    private static final int QUOTE_MAX_CHARS = 200;
    private static final int MIN_NAME_FOLD_LENGTH = 3;
    /** person.notes VARCHAR(500) (202607041030) — a join(quotes) sosem lépheti túl, különben a
     *  candidate-sor persistálása kidobja az EGÉSZ éjszakát (persistNight egy tranzakció). */
    static final int NOTES_MAX_CHARS = 500;

    /** Egy éjszaka legfeljebb ennyi személy-node-ért fizet él-strukturálást (cheap-tier hívás,
     *  de node-onként egy): a maradék a következő éjszakákon kerül sorra. */
    private static final int MAX_EDGE_LINKS_PER_NIGHT = 3;
    /** Az él-evidencia forrás-fajtája: a konkrét említés, ami miatt a személy aznap felmerült. */
    private static final String EDGE_EVIDENCE_KIND = "mention";
    /** Code review fix (mezo-06o0.4): a node.meta jsonb kulcsa, ami azt jelzi, hogy a
     *  {@link #linkPersonEdges} MÁR megpróbálta strukturálni ezt a node-ot — az érték az a nap
     *  (ISO dátum), amikor ez történt. Ez zárja be a „legfeljebb egyszer fusson végig" kaput
     *  akkor is, ha a strukturáló válasza üres vagy minden javaslata a konfidencia-küszöb alatt
     *  van: egy éltelen kimenet enélkül minden éjjel újra megpróbálná ugyanazt a node-ot,
     *  kiszorítva a napi sapkából a valódi, még meg sem próbált jelölteket. */
    static final String META_EDGE_STRUCTURED_ON = "edgeStructuredOn";

    private static final Set<String> TONES = Set.of("positive", "neutral", "mixed", "negative");
    private static final Set<String> CONTEXTS = Set.of("munka", "csalad", "baratok", "edzes",
        "konfliktus", "kozos_program", "segitseg", "egyeb");

    private static final String SYSTEM_PROMPT = EXTRACTOR_MARKER + """

        Te egy kapcsolat-figyelő vagy. Bemenet: {{NÉV}} egy napjának saját szövegei, a nap
        tónus nélküli említéseinek számozott listája, és az ismert személynevek listája.
        Két feladatod van:

        1. GAZDAGÍTÁS: minden számozott említéshez döntsd el a szöveg alapján a tónust,
           az intenzitást és a kontextust.
        2. ÚJ ARCOK: ha a nap szövegeiben VISSZATÉRŐ, az ismert listán NEM szereplő
           személynév bukkan fel, javasold jelöltnek, szó szerinti idézetekkel.

        Válasz KIZÁRÓLAG JSON objektum, magyarázat nélkül:
        {"mentions": [{"index": 0, "tone": "positive", "intensity": 2, "context": "munka"}],
         "candidates": [{"name": "Név", "quotes": ["szó szerinti mondat a szövegből"]}]}

        - tone ∈ positive | neutral | mixed | negative; intensity ∈ 1 | 2 | 3
        - context ∈ munka | csalad | baratok | edzes | konfliktus | kozos_program | segitseg | egyeb
        - Bizonytalan utalást ("a főnököm", vezetéknév nélkül több emberre illő név) HAGYJ KI
          mindkét listából. Ha nincs mit írni, a mező üres tömb.
        - Jelöltet csak ténylegesen visszatérő névre javasolj, legfeljebb 3-at.
        """;

    private final CompanionLlm companionLlm;
    private final PersonRepository personRepository;
    private final MentionRepository mentionRepository;
    private final JournalEntryRepository journalEntryRepository;
    private final RitualDayRepository ritualDayRepository;
    private final DailySummaryRepository dailySummaryRepository;
    private final LlmCallContextHolder llmCallContextHolder;
    private final ObjectMapper objectMapper;
    private final PromptPersona promptPersona;
    // Self-injected proxy — lásd LifeEventExtractionService: a persistNight csak a proxyn át kap
    // tranzakciós advice-t.
    private final ObjectProvider<PersonExtractionService> self;
    // ObjectProvider, nem közvetlen függés: a gráf-kapcsoló (KNOWLEDGE_GRAPH) függetlenül
    // kapcsolható a COMPANION∧PEOPLE pártól, ami ezt a szervizt élteti — kikapcsolt gráfnál
    // ezek a beanek nem léteznek, és az él-passz egyszerűen kimarad.
    private final ObjectProvider<GraphService> graphService;
    private final ObjectProvider<GraphEdgeStructurer> edgeStructurer;

    public PersonExtractionResult extractFor(UUID userId, LocalDate day) {
        Instant from = day.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant to = day.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        // A teljes napi mention-lista mellékterméke a lekérdezésnek — a tone-szűrés itt, Java
        // oldalon fut, ezért NEM kell egy második lekérdezés az él-passz számára (lásd
        // linkPersonEdges hívásai lent): a `dayMentions` és a `toneless` ugyanabból a listából ered.
        List<MentionEntity> dayMentions = mentionRepository
            .findByCreatedByAndTsGreaterThanEqualAndTsLessThanAndDeletedFalse(userId, from, to);
        List<MentionEntity> toneless = dayMentions.stream().filter(m -> m.getTone() == null).toList();
        String narrative = gatherNarrative(userId, day);
        if (toneless.isEmpty() && narrative.isBlank()) {
            // Pre-spend kapu: nincs tone-nélküli mention ÉS nincs narratíva — a gazdagítás/jelölt
            // LLM-hívás elmarad. De ha VOLT aznapi említés (csak épp mindegyik már tónusos), az
            // él-passznak akkor is futnia kell (S5, mezo-06o0.4) — egy teljesen üres napon nincs
            // kit összekötni, de egy csak-már-gazdagított napon van. linkPersonEdges maga no-op
            // egy üres listán, úgyhogy a hívás feltétel nélkül biztonságos.
            int edgeLinked = linkPersonEdgesSafely(userId, day, dayMentions);
            return edgeLinked == 0 ? PersonExtractionResult.ZERO
                : new PersonExtractionResult(0, 0, edgeLinked);
        }
        List<PersonEntity> persons = personRepository.findAllByCreatedByAndDeletedFalseOrderByNameAsc(userId);
        NightAnswer answer;
        try {
            String raw = llmCallContextHolder.runWith(
                new LlmCallContext("people_extraction", "enrich_and_candidates", "day", null),
                () -> companionLlm.complete(promptPersona.render(userId, SYSTEM_PROMPT), buildUserMessage(narrative, toneless, persons)));
            answer = parse(raw);
        } catch (Exception e) {
            log.warn("Person extraction failed for {} on {}", userId, day, e);
            return PersonExtractionResult.ZERO;
        }
        List<Enrichment> enrichments = validEnrichments(answer, toneless);
        List<CandidateProposal> candidates = validCandidates(answer, userId, day, narrative);
        if (enrichments.isEmpty() && candidates.isEmpty()) {
            // Nincs mit gazdagítani/jelölni ebből a válaszból — de az él-passz ettől független: ha
            // van aznapi említés, akkor is lefut (S5, mezo-06o0.4). Ez a gate akkor is igaz tud
            // lenni, amikor a fenti pre-spend kapu nem zárta ki a napot (pl. van tone-nélküli
            // mention, de a modell válasza üres) — pontosan ilyenkor is kell az él-passz.
            int edgeLinked = linkPersonEdgesSafely(userId, day, dayMentions);
            return edgeLinked == 0 ? PersonExtractionResult.ZERO
                : new PersonExtractionResult(0, 0, edgeLinked);
        }
        PersonExtractionResult night;
        try {
            night = self.getObject().persistNight(userId, toneless, enrichments, candidates);
        } catch (Exception e) {
            log.warn("Person-extraction persistence failed for {} on {} — degrading to zero so the"
                + " night stays reprocessable", userId, day, e);
            return PersonExtractionResult.ZERO;
        }
        // Külön tranzakció, a gazdagítás/jelölt commitja UTÁN — külön try/catch a persistNight-étól
        // is: egy gráf-hiba itt SOHA nem viheti el a fenti persistNight már commitolt eredményét
        // (IDENT-3), sem a saját tranzakcióját (linkPersonEdges), sem a visszaadott enriched/
        // candidates számokat.
        int edgeLinked = linkPersonEdgesSafely(userId, day, dayMentions);
        return new PersonExtractionResult(night.enriched(), night.candidates(), edgeLinked);
    }

    private int linkPersonEdgesSafely(UUID userId, LocalDate day, List<MentionEntity> dayMentions) {
        if (dayMentions.isEmpty()) {
            // Hoisted out of linkPersonEdges (code review fix): an empty day must cost NOTHING,
            // not even an empty @Transactional round-trip — checking here, before the self-proxy
            // call, means the transactional method is never even entered.
            return 0;
        }
        try {
            return self.getObject().linkPersonEdges(userId, day, dayMentions);
        } catch (Exception e) {
            log.warn("Person edge-linking pass failed for {} on {}", userId, day, e);
            return 0;
        }
    }

    /**
     * S5 esemény-él passz (mezo-06o0.4): a nap említett személyei közül azok kapnak
     * él-strukturálást, akiknek van AKTÍV PERSON node-juk, de még egyszer sem próbálta meg a
     * strukturáló, és még egyetlen élük sincs. A {@code syncPerson} szándékosan nem hív
     * strukturálót (egy névjavítás nem indokol LLM-hívást), így ez a passz az egyetlen hely, ahol
     * egy már promótált személy élt kap.
     *
     * <p><b>A „legfeljebb egyszer" kapu perzisztens, nem edge-count-alapú (code review fix).</b>
     * Egy PUSZTA edge-count gate ({@code edgesFrom/edgesTo} üres) nem záródna be egy olyan
     * személynél, akinek a strukturáló válasza üres volt, vagy minden javaslata a
     * konfidencia-küszöb alatt maradt — az a személy MINDEN éjjel újra megpróbálná, valahányszor
     * megemlítik, ami (a) felesleges LLM-költség, és (b) mivel a {@code linked++} a KÍSÉRLETEKET
     * számolja, egy pár permanensen éltelen személy örökre kiszoríthatná a determinisztikus
     * dayMentions-sorrend elején állókat a napi {@value #MAX_EDGE_LINKS_PER_NIGHT}-es sapkából.
     * Ezért a node {@link GraphNodeEntity#getMeta()}-jába egy {@value #META_EDGE_STRUCTURED_ON}
     * jelzőt írunk MINDEN sikeres futás után (a kimenetétől függetlenül) — a kapu ez ÉS az
     * edge-count együtt: {@code !hasMarker && edgesFrom.isEmpty() && edgesTo.isEmpty()}.
     *
     * <p>Evidencia: a konkrét említés id-ja ({@code mention}), nem a személy — így az él
     * visszavezethető arra a mondatra, ami miatt megszületett.
     *
     * <p><b>A hurok izolációja NEM teljes (code review fix, javított javadoc).</b> A {@link
     * GraphEdgeStructurer} class javadocjának "Transaction shape" bekezdése szerint egy {@link
     * DataAccessException} szándékosan kiszökik a strukturálóból, hogy a hívó tranzakciója
     * ténylegesen rollback-only legyen. Mivel ez a metódus EGY {@code @Transactional} a teljes
     * napi hurok köré, egy ilyen kivétel a Hibernate session-t itt is rollback-only-ra állítja —
     * a hurok többi tagját tovább próbálni ilyenkor hamis biztonságot adna (mindegyik
     * {@code UnexpectedRollbackException}-nel bukna), ezért egy {@link DataAccessException}
     * SZÁNDÉKOSAN kiszökik ebből a metódusból is, a self-proxy hívóján ({@link
     * #linkPersonEdgesSafely}) át degradálva 0-ra — az egész éjszakai passz feladja, de a fenti
     * {@code persistNight} már commitolt eredménye (IDENT-3) és maga a hívó tranzakciója
     * (linkPersonEdgesSafely nem ugyanabban a tranzakcióban fut) érintetlen marad. Minden MÁS
     * kivétel (pl. egy nem-DB hiba egyetlen node feldolgozásában) node-onként izolált marad —
     * ilyenkor a hurok folytatódik a következő személlyel.
     *
     * @return hány személy-node esetén futott le ténylegesen a strukturálás kísérlete (a kimenettől —
     *         létrejött-e él vagy sem — függetlenül, lásd fent)
     */
    @Transactional
    public int linkPersonEdges(UUID userId, LocalDate day, List<MentionEntity> dayMentions) {
        GraphService graph = graphService.getIfAvailable();
        GraphEdgeStructurer structurer = edgeStructurer.getIfAvailable();
        if (graph == null || structurer == null) {
            return 0;   // gráf kikapcsolva
        }
        Map<UUID, MentionEntity> firstMentionByPerson = new LinkedHashMap<>();
        for (MentionEntity m : dayMentions) {
            firstMentionByPerson.putIfAbsent(m.getPersonId(), m);
        }
        int linked = 0;
        for (Map.Entry<UUID, MentionEntity> entry : firstMentionByPerson.entrySet()) {
            if (linked >= MAX_EDGE_LINKS_PER_NIGHT) {
                break;
            }
            try {
                Optional<GraphNodeEntity> found =
                    graph.findBySource(userId, GraphPromotionService.SOURCE_PERSON, entry.getKey());
                if (found.isEmpty()) {
                    continue;   // jelölt vagy sosem promótált személy — nincs mit összekötni
                }
                GraphNodeEntity node = found.get();
                boolean alreadyAttempted = node.getMeta() != null
                    && node.getMeta().containsKey(META_EDGE_STRUCTURED_ON);
                if (!GraphNodeEntity.STATUS_ACTIVE.equals(node.getStatus())
                        || alreadyAttempted
                        || !graph.edgesFrom(userId, node.getId()).isEmpty()
                        || !graph.edgesTo(userId, node.getId()).isEmpty()) {
                    continue;   // archivált, már megpróbálva, vagy már van éle — egyszer fut, nem éjszakánként
                }
                structurer.structureEdges(userId, node, EDGE_EVIDENCE_KIND, entry.getValue().getId());
                graph.putMeta(userId, node.getId(), META_EDGE_STRUCTURED_ON, day.toString());
                linked++;
            } catch (DataAccessException e) {
                // Szándékosan kiszökik — lásd a metódus javadocjának izolációs bekezdését.
                throw e;
            } catch (Exception e) {
                log.warn("Person edge structuring failed for person {} (user {})", entry.getKey(), userId, e);
            }
        }
        return linked;
    }

    /** Az éjszaka minden írása EGY tranzakcióban (LifeEvent-minta, self-proxyn át hívva). */
    @Transactional
    public PersonExtractionResult persistNight(UUID userId, List<MentionEntity> toneless,
            List<Enrichment> enrichments, List<CandidateProposal> candidates) {
        int enriched = 0;
        for (Enrichment e : enrichments) {
            MentionEntity m = toneless.get(e.index());
            m.setTone(e.tone());
            m.setIntensity(e.intensity().shortValue());
            if (m.getContextLabel() == null) {
                m.setContextLabel(e.context());
            }
            mentionRepository.save(m);
            enriched++;
        }
        int created = 0;
        for (CandidateProposal c : candidates) {
            PersonEntity p = new PersonEntity();
            p.setCreatedBy(userId);
            p.setName(c.name());
            p.setInitial(c.name().substring(0, 1).toUpperCase());
            p.setRelationship("friend");
            p.setRelationshipHu("Ismerős");
            p.setAffectBaseline("neutral");
            p.setStatus("candidate");
            p.setSourceKind(SOURCE_EXTRACTOR);
            p.setNotes(joinNotes(c.quotes()));
            personRepository.save(p);
            created++;
        }
        return new PersonExtractionResult(enriched, created, 0);
    }

    /** Ugyanaz a nap-narratíva, mint a LifeEvent-extraktoré: napló + esti reflexió + napi összefoglaló. */
    private String gatherNarrative(UUID userId, LocalDate day) {
        StringBuilder sb = new StringBuilder();
        for (JournalEntryEntity entry : journalEntryRepository
                .findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnDescCreatedAtDesc(userId, day, day)) {
            append(sb, "NAPLÓ", entry.getText());
        }
        ritualDayRepository.findByCreatedByAndRitualDate(userId, day)
            .ifPresent(r -> append(sb, "ESTI REFLEXIÓ", r.getReflectionText()));
        dailySummaryRepository.findByCreatedByAndSummaryDate(userId, day)
            .ifPresent(s -> append(sb, "NAPI ÖSSZEFOGLALÓ", s.getNarrative()));
        return sb.toString().trim();
    }

    private static void append(StringBuilder sb, String label, String text) {
        if (text != null && !text.isBlank()) {
            sb.append(label).append(": ").append(text.trim()).append('\n');
        }
    }

    private String buildUserMessage(String narrative, List<MentionEntity> toneless,
            List<PersonEntity> persons) {
        StringBuilder sb = new StringBuilder("A NAP SZÖVEGEI:\n").append(narrative).append('\n');
        sb.append("\nTÓNUS NÉLKÜLI EMLÍTÉSEK:\n");
        for (int i = 0; i < toneless.size(); i++) {
            sb.append(i).append(". ").append(nameOf(persons, toneless.get(i).getPersonId()))
                .append(": ").append(toneless.get(i).getExcerpt()).append('\n');
        }
        sb.append("\nISMERT SZEMÉLYEK:\n");
        for (PersonEntity p : persons) {
            sb.append("- ").append(p.getName());
            if (!p.getAliases().isEmpty()) {
                sb.append(" (").append(String.join(", ", p.getAliases())).append(')');
            }
            sb.append('\n');
        }
        return sb.toString();
    }

    private static String nameOf(List<PersonEntity> persons, UUID personId) {
        return persons.stream().filter(p -> p.getId().equals(personId))
            .map(PersonEntity::getName).findFirst().orElse("?");
    }

    /** Index-en kívüli, ismeretlen tónusú/kontextusú vagy sávon kívüli intenzitású gazdagítás
     *  DOBVA, sosem csonkolva (a LifeEvent drop-never-clamp szabálya); egy indexre az első nyer. */
    private List<Enrichment> validEnrichments(NightAnswer answer, List<MentionEntity> toneless) {
        List<Enrichment> valid = new ArrayList<>();
        Set<Integer> seen = new HashSet<>();
        for (Enrichment e : answer.mentions() == null ? List.<Enrichment>of() : answer.mentions()) {
            if (e == null || e.index() == null || e.index() < 0 || e.index() >= toneless.size()
                || !seen.add(e.index())
                || e.tone() == null || !TONES.contains(e.tone())
                || e.intensity() == null || e.intensity() < 1 || e.intensity() > 3
                || e.context() == null || !CONTEXTS.contains(e.context())) {
                continue;
            }
            valid.add(e);
        }
        return valid;
    }

    /** A jelölt-kapu: ismert/elvetett név ki (fold-egyenlőség a nevek+aliasok ellen, soft-deleted
     *  sorokkal együtt), és csak ténylegesen visszatérő név marad (nap ≥2 vagy 7 nap ≥3 szó-eleji
     *  előfordulás a narratívában). */
    private List<CandidateProposal> validCandidates(NightAnswer answer, UUID userId, LocalDate day,
            String dayNarrative) {
        List<CandidateProposal> raw = answer.candidates() == null ? List.of() : answer.candidates();
        if (raw.isEmpty()) {
            return List.of();
        }
        Set<String> knownFolds = new HashSet<>();
        for (String known : personRepository.findAllNamesAndAliasesIncludingDeleted(userId)) {
            knownFolds.add(TextFold.fold(known));
        }
        String dayFold = TextFold.fold(dayNarrative);
        String weekFold = null;   // lustán: csak ha a nap-küszöb nem elég
        List<CandidateProposal> valid = new ArrayList<>();
        Set<String> proposedFolds = new HashSet<>();
        for (CandidateProposal c : raw) {
            if (valid.size() >= MAX_CANDIDATES || c == null || c.name() == null) {
                continue;
            }
            String name = c.name().strip();
            String fold = TextFold.fold(name);
            if (name.isEmpty() || name.length() > 120 || fold.length() < MIN_NAME_FOLD_LENGTH
                || knownFolds.contains(fold) || !proposedFolds.add(fold)) {
                continue;
            }
            boolean recurring = countAtWordStart(dayFold, fold) >= DAY_MIN_OCCURRENCES;
            if (!recurring) {
                if (weekFold == null) {
                    StringBuilder week = new StringBuilder();
                    for (int i = 6; i >= 0; i--) {
                        week.append(gatherNarrative(userId, day.minusDays(i))).append('\n');
                    }
                    weekFold = TextFold.fold(week.toString());
                }
                recurring = countAtWordStart(weekFold, fold) >= WEEK_MIN_OCCURRENCES;
            }
            if (!recurring) {
                continue;
            }
            valid.add(new CandidateProposal(name, cleanQuotes(c.quotes())));
        }
        return valid;
    }

    /** Szó-ELEJI előfordulások száma szabad szóvéggel (a magyar ragok miatt) — a
     *  MentionDetectionService.containsAtWordStart számláló párja. */
    static int countAtWordStart(String foldedHaystack, String foldedNeedle) {
        int count = 0;
        int idx = foldedHaystack.indexOf(foldedNeedle);
        while (idx >= 0) {
            if (idx == 0 || !Character.isLetterOrDigit(foldedHaystack.charAt(idx - 1))) {
                count++;
            }
            idx = foldedHaystack.indexOf(foldedNeedle, idx + 1);
        }
        return count;
    }

    private static List<String> cleanQuotes(List<String> quotes) {
        List<String> clean = new ArrayList<>();
        for (String q : quotes == null ? List.<String>of() : quotes) {
            if (q == null || q.isBlank() || clean.size() >= MAX_QUOTES) {
                continue;
            }
            String s = q.strip();
            clean.add(s.length() <= QUOTE_MAX_CHARS ? s : s.substring(0, QUOTE_MAX_CHARS - 1) + "…");
        }
        return clean;
    }

    /** Az idézetek {@code \n}-nel összefűzött notes-szövege — ez a person.notes VARCHAR(500)
     *  oszlopba kerül, ezért itt kap egy második, oszlop-szintű sapkát a cleanQuotes
     *  idézetenkénti {@link #QUOTE_MAX_CHARS} sapkája fölé (a "…" idióma ugyanaz). */
    private static String joinNotes(List<String> quotes) {
        String joined = String.join("\n", quotes);
        if (joined.length() <= NOTES_MAX_CHARS) {
            return joined;
        }
        return SafeTruncate.truncate(joined, NOTES_MAX_CHARS - 1) + "…";
    }

    private NightAnswer parse(String raw) throws Exception {
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return new NightAnswer(List.of(), List.of());
        }
        return objectMapper.readValue(raw.substring(start, end + 1), NightAnswer.class);
    }

    /** A modellválasz alakja — ismeretlen mezőkre toleráns rekordok. */
    public record NightAnswer(List<Enrichment> mentions, List<CandidateProposal> candidates) { }

    public record Enrichment(Integer index, String tone, Integer intensity, String context) { }

    public record CandidateProposal(String name, List<String> quotes) { }
}
