package io.mrkuhne.mezo.feature.companion.memory.eval;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.memory.eval.MemoryEvalCorpus.EvalPersona;
import io.mrkuhne.mezo.feature.companion.memory.eval.MemoryEvalCorpus.EvalQuery;
import io.mrkuhne.mezo.feature.companion.memory.eval.MemoryEvalCorpus.EvalSource;
import io.mrkuhne.mezo.feature.companion.memory.eval.MemoryEvalCorpus.ReviewMetadata;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

/** Seeded corpus build, structural validation and explicit human-review approval entry point. */
class SyntheticMemoryCorpusGenerator {

    static final String CORPUS_VERSION = "memory-hu-v1";
    static final long GENERATOR_SEED = 20260904L;
    static final String RESOURCE_ROOT = "eval/memory/v1/";
    private static final Path OUTPUT_ROOT = Path.of("src/test/resources", RESOURCE_ROOT);
    private static final List<String> FAMILIES = List.of(
            "paraphrase", "follow_up", "exact_value", "old_salient", "near_negative",
            "negation", "superseded", "empty", "ownership");
    private static final List<String> PEOPLE = List.of(
            "Boglárka", "Márton", "Kata", "Levente", "Nóri",
            "Gergő", "Júlia", "András", "Réka", "Tamás",
            "Lilla", "Bence", "Zsófi", "Dávid", "Emese");
    private static final List<String> PLACES = List.of(
            "Pilis", "Börzsöny", "Mátra", "Bakony", "Mecsek",
            "Őrség", "Cserhát", "Zemplén", "Bükk", "Gerecse",
            "Kőszegi-hegység", "Vértes", "Badacsony", "Gemenc", "Szigetköz");
    private static final List<String> EMPTY_PHRASES = List.of(
            "Szia", "Helló", "Jó reggelt", "Jó estét", "Köszönöm", "Köszi", "Kösz",
            "Rendben", "Ok", "Oksa", "Ki vagy", "Mit tudsz", "Hogyan működsz",
            "Általános kérdésem van");
    private static final List<String> EMPTY_PUNCTUATION = List.of("!", ".", "?", "!!", "...", "?!");
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Clock UTC_CLOCK = Clock.systemUTC();

    static final List<EvalPersona> PERSONAS = List.of(
            new EvalPersona("rich", "Dóra", "Naponta több részletes bejegyzés",
                    "Budapesti terméktervező, fut, túrázik és rendszeresen reflektál."),
            new EvalPersona("sparse", "Áron", "Hetente néhány rövid bejegyzés",
                    "Szegedi fejlesztő, falat mászik; csak fontos eseményeket rögzít."),
            new EvalPersona("changing", "Eszter", "Rendszeres, de változó állapotokat rögzít",
                    "Pécsi tanár, költözés és munkahelyváltás közben régi terveket ír felül."));

    @Test
    void testGenerate_shouldWriteOrMatchDeterministicArtifacts() throws Exception {
        GeneratedCorpora generated = generate();
        validate(generated);

        if (Boolean.getBoolean("mezo.eval.write-corpus")) {
            writeArtifacts(generated);
        } else {
            assertArtifactMatches("personas.json", PERSONAS);
            assertArtifactMatches("development.json", generated.development());
            assertArtifactMatches("tuning.json", generated.tuning());
            assertArtifactMatches("holdout.json", generated.holdout());
        }
    }

    @Test
    void testApproveReview_shouldDeriveMetadataFromHoldoutBytes_whenHumanExplicitlyApproves() throws Exception {
        Assumptions.assumeTrue(Boolean.getBoolean("mezo.eval.approve-review"));
        String reviewer = System.getProperty("mezo.eval.reviewer", "").strip();
        assertThat(reviewer).as("-Dmezo.eval.reviewer must name the human reviewer").isNotBlank();
        byte[] holdoutBytes = Files.readAllBytes(OUTPUT_ROOT.resolve("holdout.json"));
        MemoryEvalCorpus holdout = MAPPER.readValue(holdoutBytes, MemoryEvalCorpus.class);
        ReviewMetadata metadata = new ReviewMetadata(
                holdout.corpusVersion(), holdout.generatorSeed(), reviewer,
                LocalDate.now(UTC_CLOCK), holdout.queries().size(),
                sha256(holdoutBytes), "approved");
        writeJson(OUTPUT_ROOT.resolve("review.json"), metadata);
    }

    static MemoryEvalCorpus load(String split) {
        String resource = RESOURCE_ROOT + split + ".json";
        try (InputStream input = SyntheticMemoryCorpusGenerator.class.getClassLoader()
                .getResourceAsStream(resource)) {
            if (input == null) {
                throw new IllegalStateException("Missing eval resource: " + resource);
            }
            return MAPPER.readValue(input, MemoryEvalCorpus.class);
        } catch (IOException exception) {
            throw new IllegalStateException("Cannot read eval resource: " + resource, exception);
        }
    }

    static ReviewMetadata loadApprovedReview(MemoryEvalCorpus holdout) {
        byte[] bytes = readResourceBytes(RESOURCE_ROOT + "holdout.json");
        MemoryEvalCorpus artifact = MAPPER.readValue(bytes, MemoryEvalCorpus.class);
        ReviewMetadata review = MAPPER.readValue(
                readResourceBytes(RESOURCE_ROOT + "review.json"), ReviewMetadata.class);
        return validateApprovedReview(holdout, artifact, sha256(bytes), review);
    }

    static ReviewMetadata validateApprovedReview(
            MemoryEvalCorpus supplied, MemoryEvalCorpus artifact, String actualSha,
            ReviewMetadata review) {
        if (!supplied.equals(artifact)
                || !"holdout".equals(artifact.split())
                || !CORPUS_VERSION.equals(artifact.corpusVersion())
                || GENERATOR_SEED != artifact.generatorSeed()
                || !"approved".equals(review.status())
                || review.reviewedBy() == null
                || review.reviewedBy().isBlank()
                || review.reviewedAt() == null
                || !artifact.corpusVersion().equals(review.corpusVersion())
                || artifact.generatorSeed() != review.generatorSeed()
                || artifact.queries().size() != review.queryCount()
                || !actualSha.equals(review.holdoutSha256())) {
            throw new IllegalStateException("Memory eval holdout has no matching approved human review");
        }
        return review;
    }

    static GeneratedCorpora generate() {
        Map<String, SplitBuilder> splits = Map.of(
                "development", new SplitBuilder("development"),
                "tuning", new SplitBuilder("tuning"),
                "holdout", new SplitBuilder("holdout"));
        Random random = new Random(GENERATOR_SEED);
        for (int personaIndex = 0; personaIndex < PERSONAS.size(); personaIndex++) {
            EvalPersona persona = PERSONAS.get(personaIndex);
            for (int familyIndex = 0; familyIndex < FAMILIES.size(); familyIndex++) {
                for (int repetition = 0; repetition < 5; repetition++) {
                    addScenario(splits.get(splitFor(repetition)), persona, personaIndex,
                            FAMILIES.get(familyIndex), familyIndex, repetition, random);
                }
            }
        }
        return new GeneratedCorpora(
                splits.get("development").build(),
                splits.get("tuning").build(),
                splits.get("holdout").build());
    }

    private static void addScenario(
            SplitBuilder split,
            EvalPersona persona,
            int personaIndex,
            String family,
            int familyIndex,
            int repetition,
            Random random) {
        String scenarioId = "%s:%s:%02d".formatted(persona.id(), family, repetition + 1);
        LocalDate date = scenarioDate(persona.id(), familyIndex, repetition);
        if ("old_salient".equals(family)) {
            date = date.minusYears(3);
        }
        int axis = personaIndex * 64 + familyIndex * 5 + repetition;
        int identityIndex = personaIndex * 5 + repetition;
        ScenarioCopy copy = scenarioCopy(
                persona, family, repetition, PEOPLE.get(identityIndex), PLACES.get(identityIndex), random);
        String primaryKey = sourceKey(persona.id(), copy.primaryKind(), date, "01");
        String supportKey = sourceKey(persona.id(), "daily_summary", date.plusDays(1), "02");
        LocalDate distractorDate = distractorDate(family, date);
        boolean ownership = "ownership".equals(family);
        boolean hasSupport = !"sparse".equals(persona.id()) || ownership;
        EvalPersona distractorPersona = ownership
                ? PERSONAS.get((personaIndex + 1) % PERSONAS.size()) : persona;
        String distractorKey = sourceKey(
                distractorPersona.id(), "journal_entry", distractorDate,
                "99-" + persona.id() + '-' + familyIndex + '-' + repetition);

        split.sources.add(source(primaryKey, persona.id(), scenarioId, copy.primaryKind(), date,
                copy.primary(), axis, "old_salient".equals(family) ? 0.98 : 0.78,
                "active", false));
        if (hasSupport) {
            split.sources.add(source(supportKey, persona.id(), scenarioId, "daily_summary", date.plusDays(1),
                    copy.support(), axis, 0.64,
                    "superseded".equals(family) ? "superseded" : "active", false));
        }
        split.sources.add(source(distractorKey, distractorPersona.id(), scenarioId, "journal_entry", distractorDate,
                copy.distractor(), ownership ? axis : (axis + 1) % 256,
                ownership ? 0.90 : 0.48, "active", ownership));
        addPersonaShapeSources(split, persona, scenarioId, date, copy, axis);

        for (int variant = 0; variant < copy.queries().size(); variant++) {
            boolean empty = "empty".equals(family);
            Map<String, Integer> relevance = new LinkedHashMap<>();
            if (!empty) {
                if ("ownership".equals(family) && variant == 2) {
                    relevance.put(primaryKey, 1);
                    relevance.put(supportKey, 2);
                } else {
                    relevance.put(primaryKey, 2);
                    if (hasSupport && !"superseded".equals(family)) {
                        relevance.put(supportKey, 1);
                    }
                }
            }
            String query = queryText(copy.queries().get(variant), personaIndex, repetition, variant, empty);
            List<CompanionLlm.Turn> history = "follow_up".equals(family)
                    ? List.of(
                            new CompanionLlm.Turn(CompanionLlm.Role.USER, copy.historyPrompt()),
                            new CompanionLlm.Turn(CompanionLlm.Role.ASSISTANT, "Igen, emlékszem erre."))
                    : List.of();
            split.queries.add(new EvalQuery(
                    scenarioId + ":q" + (variant + 1), persona.id(), scenarioId, family,
                    query, history, relevance, empty));
        }
    }

    private static EvalSource source(
            String key, String personaId, String scenarioId, String kind, LocalDate date,
            String content, int axis, double salience, String state, boolean foreign) {
        return new EvalSource(key, personaId, scenarioId, kind, date,
                content, axis, salience, state, foreign);
    }

    private static ScenarioCopy scenarioCopy(
            EvalPersona persona, String family, int repetition, String person, String place, Random random) {
        int value = 7 + repetition * 3 + random.nextInt(3);
        String owner = persona.displayName();
        return switch (family) {
            case "paraphrase" -> new ScenarioCopy(
                    "journal_entry", owner + " " + the(place) + "-túrán " + person
                            + " társaságában érezte újra igazán könnyűnek a mozgást.",
                    theAtSentenceStart(place) + "-kirándulás után " + owner + " energikus és nyugodt maradt.",
                    theAtSentenceStart(place) + " közelében tett másik séta esős és kimerítő volt.",
                    List.of("Kivel lett újra könnyed a mozgásom a " + place + "-kiránduláson?",
                            "Melyik " + place + " környéki túra adott nekem könnyedségérzést?",
                            "Ki volt velem " + place + " térségében, amikor energikusnak éreztem magam?",
                            "Melyik " + place + " környéki emlékem szól a felszabadult mozgásról?"), "");
            case "follow_up" -> followUpCopy(owner, person, place, value);
            case "exact_value" -> new ScenarioCopy(
                    "activity_note", owner + " " + the(place) + " útvonalon pontosan " + value
                            + " kilométert futott, 142-es átlagpulzussal.",
                    "A napi összegzésben a " + value + " kilométeres " + place + " futás volt a fő terhelés.",
                    "Egy másik " + place + " környéki útvonal " + (value + 1)
                            + " kilométeres volt, 151-es átlagpulzussal.",
                    List.of("Pontosan hány kilométert futottam " + place + " térségében?",
                            "Mi volt " + the(place) + "-futás távja?",
                            "Hány kilométer szerepel a 142-es pulzusú " + place + "-futásnál?",
                            "Mekkora volt számszerűen " + the(place) + "-edzésem?"), "");
            case "old_salient" -> new ScenarioCopy(
                    "decision", owner + " évekkel ezelőtt eldöntötte, hogy minden ősszel visszatér "
                            + person + " társaságában " + the(place) + "-túrára.",
                    "A régi " + place + "-döntés azóta is fontos éves kapaszkodó " + owner + " számára.",
                    "Egy friss, de jelentéktelen " + place + " környéki rövid sétáról szólt.",
                    List.of("Melyik régi " + place + " környéki őszi hagyomány fontos még mindig nekem?",
                            "Kivel terveztem évről évre visszatérni " + place + " térségébe túrázni?",
                            "Mi az a régi " + place + "-döntésem, amely ma is kapaszkodó?",
                            "Melyik többéves " + place + " emléket érdemes felidézni?"), "");
            case "near_negative" -> nearNegativeCopy(owner, person, place, value);
            case "negation" -> negationCopy(owner, person, place);
            case "superseded" -> supersededCopy(owner, place, value);
            case "empty" -> new ScenarioCopy(
                    "journal_entry", owner + " egy átlagos " + place
                            + " környéki napon röviden naplózott a munkáról.",
                    "A " + place + " környéki napi összegzés nem tartalmazott kiemelkedő eseményt.",
                    "Egy másik, hasonlóan átlagos " + place
                            + " környéki munkanapon csak egy rövid sétát jegyzett fel.",
                    List.of("Szia!", "Köszönöm!", "Rendben.", "Oksa."), "");
            case "ownership" -> ownershipCopy(owner, person, place, value);
            default -> throw new IllegalArgumentException("Unknown eval family: " + family);
        };
    }

    private static LocalDate distractorDate(String family, LocalDate primaryDate) {
        return switch (family) {
            case "follow_up" -> primaryDate.plusDays(2);
            case "old_salient" -> primaryDate.plusYears(3);
            case "near_negative" -> primaryDate.plusDays(7);
            case "negation" -> primaryDate.minusDays(21);
            case "superseded" -> primaryDate.minusDays(10);
            default -> primaryDate;
        };
    }

    private static LocalDate scenarioDate(String personaId, int familyIndex, int repetition) {
        LocalDate start = LocalDate.of(2026, 1, 5);
        return switch (personaId) {
            case "rich" -> start.plusDays(familyIndex * 5L + repetition);
            case "sparse" -> start.plusDays(35L + familyIndex * 18L + repetition * 3L);
            case "changing" -> start.plusDays(140L + familyIndex * 5L + repetition);
            default -> throw new IllegalArgumentException("Unknown persona: " + personaId);
        };
    }

    private static void addPersonaShapeSources(
            SplitBuilder split, EvalPersona persona, String scenarioId, LocalDate date,
            ScenarioCopy copy, int axis) {
        if ("rich".equals(persona.id())) {
            String firstKey = sourceKey(persona.id(), "reflection", date.minusDays(1), "70");
            split.sources.add(source(firstKey, persona.id(), scenarioId, "reflection", date.minusDays(1),
                    persona.displayName() + " a " + date.minusDays(1)
                            + "-i részletes reflexióban a napi teendőit rendezte.",
                    axis + 300, 0.42, "active", false));
            String secondKey = sourceKey(persona.id(), "activity_note", date.plusDays(2), "71");
            split.sources.add(source(secondKey, persona.id(), scenarioId, "activity_note", date.plusDays(2),
                    persona.displayName() + " a " + date.plusDays(2)
                            + "-i rövid átmozgatást külön bejegyzésben rögzítette.",
                    axis + 400, 0.38, "active", false));
        }
        if ("changing".equals(persona.id())) {
            String staleKey = sourceKey(persona.id(), "decision", date.minusDays(30), "80");
            split.sources.add(source(staleKey, persona.id(), scenarioId, "decision", date.minusDays(30),
                    "Korábbi, már felülírt állapot ugyanerről: " + copy.distractor(),
                    axis, 0.88, "superseded", false));
        }
    }

    private static String queryText(
            String raw, int personaIndex, int repetition, int variant, boolean empty) {
        if (empty) {
            List<String> splitPhrases;
            int index;
            if (repetition == 0) {
                splitPhrases = EMPTY_PHRASES.subList(0, 4);
                index = personaIndex * 4 + variant;
            } else if (repetition == 1) {
                splitPhrases = EMPTY_PHRASES.subList(4, 8);
                index = personaIndex * 4 + variant;
            } else {
                splitPhrases = EMPTY_PHRASES.subList(8, EMPTY_PHRASES.size());
                index = (repetition - 2) * 12 + personaIndex * 4 + variant;
            }
            String phrase = splitPhrases.get(index % splitPhrases.size());
            String punctuation = EMPTY_PUNCTUATION.get(index / splitPhrases.size());
            return phrase + punctuation;
        }
        return switch (repetition) {
            case 0 -> "A korábbi naplómból: " + lowerFirst(raw);
            case 1 -> "Segíts pontosítani: " + lowerFirst(raw);
            case 2 -> raw;
            case 3 -> "Emlékezz vissza velem: " + lowerFirst(raw);
            default -> "A feljegyzéseim alapján: " + lowerFirst(raw);
        };
    }

    private static String lowerFirst(String value) {
        return Character.toLowerCase(value.charAt(0)) + value.substring(1);
    }

    private static String the(String place) {
        return "AÁEÉIÍOÓÖŐUÚÜŰ".indexOf(place.charAt(0)) >= 0 ? "az " + place : "a " + place;
    }

    private static String theAtSentenceStart(String place) {
        String phrase = the(place);
        return Character.toUpperCase(phrase.charAt(0)) + phrase.substring(1);
    }

    private static ScenarioCopy followUpCopy(String owner, String person, String place, int value) {
        int sleepHours = 6 + Math.floorMod(value, 3);
        String primary = owner + " " + the(place) + "-futás előtti este " + sleepHours
                + " órát aludt, és " + person + " biztatása megnyugtatta.";
        return new ScenarioCopy(
                "journal_entry", primary,
                "Másnap " + owner + " frissen kezdte a " + place
                        + "-futást, a felkészülést sikeresnek írta le.",
                "A " + place + "-futás utáni este csak hat óra alvás jutott, ez egy másik nap volt.",
                List.of(
                        "És előtte, a " + place + "-futásnál?",
                        "Mi történt az azt megelőző este a " + place + "-futás előtt?",
                        "És az alvással előtte mi volt a " + place + "-futásnál?",
                        "Arról a " + place + "-futás előtti estéről mit jegyeztem fel?"),
                "Mesélj " + the(place) + "-futásomról.");
    }

    private static ScenarioCopy nearNegativeCopy(String owner, String person, String place, int value) {
        return new ScenarioCopy(
                "journal_entry", owner + " " + the(place) + "-túrán " + person
                        + " mellett a kék jelzésen ment, és " + value + " percet pihent a forrásnál.",
                "A " + place + " környéki napi összegzés a kék jelzést és a forrásnál tartott pihenőt emelte ki.",
                "Ugyanott, " + place + " térségében a piros jelzésen egy héttel később " + (value + 2)
                        + " perces pihenő volt, más társasággal.",
                List.of("Melyik jelzésen mentem " + person + " mellett?",
                        "Hány percet pihentem a kék jelzéses " + place + "-túrán?",
                        "A forrásnál tartott pihenő melyik " + place + "-túrához tartozott?",
                        "Ne a piros jelzéses napot: mi történt a kék " + place + "-útvonalon?"), "");
    }

    private static ScenarioCopy negationCopy(String owner, String person, String place) {
        return new ScenarioCopy(
                "decision", owner + " kifejezetten úgy döntött, hogy vasárnap NEM fut "
                        + the(place) + " útvonalon, hanem " + person + " társaságában pihen.",
                    "A heti terv vasárnapra pihenőt, nem " + place + "-edzést rögzített.",
                    "Egy korábbi terv még vasárnapi " + place + "-futást javasolt, de azt nem követte.",
                    List.of("Futást vagy pihenést terveztem vasárnapra " + place + " térségében?",
                            "Mit döntöttem arról, hogy vasárnap fussak-e a " + place + "-útvonalon?",
                            "Mi az, amit kifejezetten nem csinálok " + place + " térségében vasárnap?",
                            "A régi " + place + "-futásterv helyett mi lett a vasárnapi döntésem?"), "");
    }

    private static ScenarioCopy supersededCopy(String owner, String place, int value) {
        return new ScenarioCopy(
                "decision", owner + " jelenlegi terve szerint hetente " + value
                        + " kilométert fut, a hosszú edzés helyszíne " + the(place) + ".",
                "A korábbi " + place + "-terv heti " + (value + 8)
                        + " kilométer és másik útvonal volt; ezt felülírta.",
                "A " + place + "-tervhez ötletként felmerült heti " + (value + 4)
                        + " kilométer, de sosem lett érvényes.",
                List.of("Mi a jelenlegi heti futástávom a " + place + "-tervben?",
                        "Melyik " + place + "-futásterv érvényes most?",
                        "Hány kilométerre módosítottam a heti " + place + "-tervet?",
                        "Mi írta felül a régi, hosszabb " + place + "-futástervet?"), "");
    }

    private static ScenarioCopy ownershipCopy(
            String owner, String person, String place, int value) {
        String foreignPerson = PEOPLE.get((PEOPLE.indexOf(person) + 1) % PEOPLE.size());
        return new ScenarioCopy(
                "journal_entry", owner + " a hétvégén " + place + " térségében " + person
                        + " társaságában " + value + " kilométert túrázott.",
                "A saját napi összegzés szerint a " + place + "-túra feltöltő volt.",
                "Egy másik felhasználó a hétvégén " + place + " térségében " + foreignPerson
                        + " társaságában " + value + " kilométert túrázott.",
                List.of("Kivel túráztam " + place + " térségében azon a hétvégén?",
                        "Mekkora volt a saját " + place + "-túrám?",
                        "Mit írtam a saját napi összegzésemben a " + place + "-túráról?",
                        "Az én " + place + " környéki emlékeim szerint ki kísért el?"), "");
    }

    private static String splitFor(int repetition) {
        return switch (repetition) {
            case 0 -> "development";
            case 1 -> "tuning";
            default -> "holdout";
        };
    }

    private static String sourceKey(String personaId, String kind, LocalDate date, String ordinal) {
        return personaId + ':' + kind + ':' + date + ':' + ordinal;
    }

    static void validate(GeneratedCorpora generated) {
        List<MemoryEvalCorpus> corpora = List.of(
                generated.development(), generated.tuning(), generated.holdout());
        Set<String> allScenarios = new HashSet<>();
        for (MemoryEvalCorpus corpus : corpora) {
            validateCorpus(corpus);
            Set<String> scenarios = new HashSet<>();
            corpus.queries().forEach(query -> scenarios.add(query.scenarioId()));
            for (String scenario : scenarios) {
                if (!allScenarios.add(scenario)) {
                    throw new IllegalStateException("Scenario leaked across splits: " + scenario);
                }
            }
        }
        validateNoExactLeakage(corpora);
        validateNoNearDuplicateQueryLeakage(corpora);
        validatePersonaShapes(corpora);
        MemoryEvalCorpus holdout = generated.holdout();
        if (holdout.queries().size() < 300) {
            throw new IllegalStateException("Holdout must contain at least 300 queries");
        }
        for (EvalPersona persona : PERSONAS) {
            long count = holdout.queries().stream()
                    .filter(query -> persona.id().equals(query.personaId())).count();
            if (count < 100) {
                throw new IllegalStateException("Holdout persona minimum missed: " + persona.id());
            }
            for (String family : FAMILIES) {
                long familyCount = holdout.queries().stream()
                        .filter(query -> persona.id().equals(query.personaId()))
                        .filter(query -> family.equals(query.family())).count();
                if (familyCount < 10) {
                    throw new IllegalStateException("Holdout family minimum missed: "
                            + persona.id() + '/' + family);
                }
            }
        }
    }

    private static void validateCorpus(MemoryEvalCorpus corpus) {
        if (!CORPUS_VERSION.equals(corpus.corpusVersion()) || corpus.generatorSeed() != GENERATOR_SEED) {
            throw new IllegalStateException("Unexpected corpus identity: " + corpus.split());
        }
        Map<String, EvalSource> sources = new HashMap<>();
        for (EvalSource source : corpus.sources()) {
            if (sources.put(source.key(), source) != null) {
                throw new IllegalStateException("Duplicate source key: " + source.key());
            }
        }
        Set<String> queryIds = new HashSet<>();
        for (EvalQuery query : corpus.queries()) {
            if (!queryIds.add(query.id())) {
                throw new IllegalStateException("Duplicate query id: " + query.id());
            }
            if (!FAMILIES.contains(query.family())) {
                throw new IllegalStateException("Unknown family: " + query.family());
            }
            if (query.expectsEmpty() != query.relevanceBySourceKey().isEmpty()) {
                throw new IllegalStateException("Empty/gold mismatch: " + query.id());
            }
            for (Map.Entry<String, Integer> relevance : query.relevanceBySourceKey().entrySet()) {
                EvalSource source = sources.get(relevance.getKey());
                if (source == null) {
                    throw new IllegalStateException("Gold source missing: " + relevance.getKey());
                }
                if (!query.personaId().equals(source.personaId())) {
                    throw new IllegalStateException("Foreign source labelled relevant: " + query.id());
                }
                if (relevance.getValue() < 0 || relevance.getValue() > 2) {
                    throw new IllegalStateException("Invalid relevance grade: " + query.id());
                }
            }
            if ("ownership".equals(query.family())) {
                boolean hasForeignDistractor = corpus.sources().stream()
                        .filter(source -> query.scenarioId().equals(source.scenarioId()))
                        .anyMatch(source -> source.foreignDistractor()
                                && !query.personaId().equals(source.personaId()));
                if (!hasForeignDistractor) {
                    throw new IllegalStateException("Ownership query lacks foreign distractor: " + query.id());
                }
            }
        }
        Set<String> personas = new HashSet<>();
        corpus.queries().forEach(query -> personas.add(query.personaId()));
        if (!personas.equals(Set.of("rich", "sparse", "changing"))) {
            throw new IllegalStateException("Every split must cover exactly three personas");
        }
    }

    private static void validateNoExactLeakage(List<MemoryEvalCorpus> corpora) {
        Set<String> queries = new HashSet<>();
        Set<String> sourceTexts = new HashSet<>();
        for (MemoryEvalCorpus corpus : corpora) {
            for (EvalQuery query : corpus.queries()) {
                String signature = normalized(query.query());
                if (!queries.add(signature)) {
                    throw new IllegalStateException("Exact query leaked across cases: " + query.id());
                }
            }
            for (EvalSource source : corpus.sources()) {
                String signature = normalized(source.content());
                if (!sourceTexts.add(signature)) {
                    throw new IllegalStateException("Exact source text leaked across cases: " + source.key());
                }
            }
        }
    }

    private static void validateNoNearDuplicateQueryLeakage(List<MemoryEvalCorpus> corpora) {
        for (int leftIndex = 0; leftIndex < corpora.size(); leftIndex++) {
            MemoryEvalCorpus left = corpora.get(leftIndex);
            for (int rightIndex = leftIndex + 1; rightIndex < corpora.size(); rightIndex++) {
                MemoryEvalCorpus right = corpora.get(rightIndex);
                for (EvalQuery leftQuery : left.queries()) {
                    Set<String> leftTokens = tokens(leftQuery.query());
                    for (EvalQuery rightQuery : right.queries()) {
                        Set<String> rightTokens = tokens(rightQuery.query());
                        if (jaccard(leftTokens, rightTokens) >= 0.90) {
                            throw new IllegalStateException("Near-duplicate query leaked across splits: "
                                    + leftQuery.id() + " / " + rightQuery.id());
                        }
                    }
                }
            }
        }
    }

    private static Set<String> tokens(String value) {
        return new HashSet<>(List.of(normalized(value)
                .replaceAll("[^\\p{L}\\p{N}]+", " ")
                .trim()
                .split("\\s+")));
    }

    private static double jaccard(Set<String> left, Set<String> right) {
        Set<String> intersection = new HashSet<>(left);
        intersection.retainAll(right);
        Set<String> union = new HashSet<>(left);
        union.addAll(right);
        return union.isEmpty() ? 1.0 : (double) intersection.size() / union.size();
    }

    private static void validatePersonaShapes(List<MemoryEvalCorpus> corpora) {
        for (MemoryEvalCorpus corpus : corpora) {
            Map<String, Long> sourceCounts = new HashMap<>();
            Map<String, Long> supersededCounts = new HashMap<>();
            for (EvalPersona persona : PERSONAS) {
                sourceCounts.put(persona.id(), corpus.sources().stream()
                        .filter(source -> persona.id().equals(source.personaId())).count());
                supersededCounts.put(persona.id(), corpus.sources().stream()
                        .filter(source -> persona.id().equals(source.personaId()))
                        .filter(source -> "superseded".equals(source.state())).count());
            }
            if (!(sourceCounts.get("rich") > sourceCounts.get("changing")
                    && sourceCounts.get("changing") > sourceCounts.get("sparse"))) {
                throw new IllegalStateException("Persona source densities must differ: " + sourceCounts);
            }
            if (!(supersededCounts.get("changing") > supersededCounts.get("rich")
                    && supersededCounts.get("rich") > supersededCounts.get("sparse"))) {
                throw new IllegalStateException("Changing persona must dominate state changes: "
                        + supersededCounts);
            }
        }
    }

    private static String normalized(String value) {
        return value.toLowerCase(java.util.Locale.ROOT).replaceAll("\\s+", " ").trim();
    }

    private static void writeArtifacts(GeneratedCorpora generated) throws IOException {
        Files.createDirectories(OUTPUT_ROOT);
        Path holdoutPath = OUTPUT_ROOT.resolve("holdout.json");
        byte[] nextHoldout = jsonBytes(generated.holdout());
        boolean holdoutChanged = !Files.exists(holdoutPath)
                || !Arrays.equals(Files.readAllBytes(holdoutPath), nextHoldout);
        writeJson(OUTPUT_ROOT.resolve("personas.json"), PERSONAS);
        writeJson(OUTPUT_ROOT.resolve("development.json"), generated.development());
        writeJson(OUTPUT_ROOT.resolve("tuning.json"), generated.tuning());
        Files.write(holdoutPath, nextHoldout);
        if (holdoutChanged) {
            Files.deleteIfExists(OUTPUT_ROOT.resolve("review.json"));
        }
    }

    private static void assertArtifactMatches(String filename, Object expected) throws IOException {
        Path path = OUTPUT_ROOT.resolve(filename);
        assertThat(path).as("Generate the corpus with -Dmezo.eval.write-corpus=true").exists();
        assertThat(Files.readAllBytes(path)).isEqualTo(jsonBytes(expected));
    }

    private static void writeJson(Path path, Object value) throws IOException {
        Files.write(path, jsonBytes(value));
    }

    private static byte[] jsonBytes(Object value) throws IOException {
        String json = MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(value) + '\n';
        return json.getBytes(StandardCharsets.UTF_8);
    }

    private static byte[] readResourceBytes(String resource) {
        try (InputStream input = SyntheticMemoryCorpusGenerator.class.getClassLoader()
                .getResourceAsStream(resource)) {
            if (input == null) {
                throw new IllegalStateException("Missing eval resource: " + resource);
            }
            return input.readAllBytes();
        } catch (IOException exception) {
            throw new IllegalStateException("Cannot read eval resource: " + resource, exception);
        }
    }

    private static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 must be available", exception);
        }
    }

    record GeneratedCorpora(
            MemoryEvalCorpus development,
            MemoryEvalCorpus tuning,
            MemoryEvalCorpus holdout) {
    }

    private record ScenarioCopy(
            String primaryKind,
            String primary,
            String support,
            String distractor,
            List<String> queries,
            String historyPrompt) {
    }

    private static final class SplitBuilder {
        private final String split;
        private final List<EvalSource> sources = new ArrayList<>();
        private final List<EvalQuery> queries = new ArrayList<>();

        private SplitBuilder(String split) {
            this.split = split;
        }

        private MemoryEvalCorpus build() {
            return new MemoryEvalCorpus(CORPUS_VERSION, GENERATOR_SEED, split, sources, queries);
        }
    }
}
