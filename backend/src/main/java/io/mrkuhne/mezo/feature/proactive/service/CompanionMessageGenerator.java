package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.service.WeightTrendService;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.DailySummaryRepository;
import io.mrkuhne.mezo.feature.companion.service.ContextSnapshotAssembler;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactService;
import io.mrkuhne.mezo.feature.companion.tools.CompanionToolRegistry;
import io.mrkuhne.mezo.feature.companion.tools.ToolCallAudit;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.people.entity.MentionEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.repository.MentionRepository;
import io.mrkuhne.mezo.feature.people.repository.MentionSignal;
import io.mrkuhne.mezo.feature.people.repository.PersonRepository;
import io.mrkuhne.mezo.feature.people.service.PersonAffectTrend;
import io.mrkuhne.mezo.feature.people.service.PersonAffectTrendCalculator;
import io.mrkuhne.mezo.feature.proactive.config.ProactiveProperties;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEnvelope;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.feature.companion.tools.ToolText;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * Companion-feed morning-kind generator (spec §3): the day's FIRST message, generated before
 * sleep/weight logging — its gather must not carry biometric state at all (a prompt prohibition
 * alone is not enough, so the gather is stripped at the source via {@link
 * ContextSnapshotAssembler#renderWithoutBiometrics}). Same idiom as the other companion-feed
 * generators (pure-code gather -> ONE cheap-tier LLM call -> defensive parse -> bounds-checked ref
 * resolution -> saveAndFlush); no summaries in the window or a broken answer ⇒ NO row (honest
 * absence). Existing row ⇒ returned untouched (idempotent).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class CompanionMessageGenerator {

    /** Prompt prefix the fake LLM dispatches on — MIRRORED as a literal in FakeCompanionLlm
     *  (a companion→proactive import would be a new package cycle). Keep the two in sync. */
    public static final String MORNING_MARKER = "REGGELI-ELIGAZITAS-FELADAT";

    private static final String MORNING_PROMPT = MORNING_MARKER + "\n"
            + "Írj rövid magyar reggeli eligazítást Danielnek a mai napra, kizárólag a megadott "
            + "tényadatokból. Ez a nap ELSŐ üzenete, még az alvás és a testsúly rögzítése ELŐTT "
            + "készül: (1) az éjszakai alvásról és a testsúlyról/súlytrendről NE írj — azokról "
            + "külön üzenet szól majd, amint Daniel rögzítette őket; (2) fókusz: a mai terv "
            + "(edzés, kalóriakeret, gyógyszer) és a hét trendje; (3) zárd 2-3 konkrét, apró "
            + "fókuszponttal; (4) számot vagy adatot kitalálni tilos; (5) gyógyszer adagolására "
            + "vonatkozó változtatást SOHA ne javasolj — az orvosi döntés. "
            + "Válaszolj KIZÁRÓLAG szigorú JSON-nal, markdown nélkül, pontosan ebben a formában: "
            + "{\"eyebrow\": \"egysoros fejléc\", \"body\": [\"bekezdés\", ...], "
            + "\"refIndexes\": [a felhasznált HIVATKOZÁS-JELÖLTEK sorszámai]}";

    /** Morning ref candidates — deliberately NO WeightTrend / Sleep (spec §3). */
    static final List<CompanionMessageEnvelope.Ref> MORNING_CANDIDATES = List.of(
            new CompanionMessageEnvelope.Ref("Goal", "cél"),
            new CompanionMessageEnvelope.Ref("Workout", "edzés"),
            new CompanionMessageEnvelope.Ref("FuelDay", "mai üzemanyag"),
            new CompanionMessageEnvelope.Ref("Medication", "gyógyszer"));

    /** Prompt prefix the fake LLM dispatches on — MIRRORED as a literal in FakeCompanionLlm
     *  (see {@link #MORNING_MARKER}'s doc for the cycle rationale). */
    public static final String SLEEP_MARKER = "ALVAS-REAKCIO-FELADAT";

    private static final String SLEEP_PROMPT = SLEEP_MARKER + "\n"
            + "Daniel most rögzítette a ma éjszakai alvását. Írj rövid magyar reakciót "
            + "társ-szemszögből, kizárólag a megadott tényadatokból: (1) értékeld a MOST RÖGZÍTETT "
            + "ALVÁS blokk adatait (időtartam, minőség) a cél és a szokásos mintázat tükrében; "
            + "(2) mondd ki, mit jelent ez a mai napra (edzés, fókusz, energia); (3) ha volt már "
            + "MAI KORÁBBI ÜZENET, ne ismételd. Számot kitalálni tilos; gyógyszer-adagolás "
            + "változtatást SOHA ne javasolj. Válaszolj KIZÁRÓLAG szigorú JSON-nal: "
            + "{\"eyebrow\": \"egysoros fejléc\", \"body\": [\"bekezdés\", ...], "
            + "\"refIndexes\": [a felhasznált HIVATKOZÁS-JELÖLTEK sorszámai]}";

    /** Prompt prefix the fake LLM dispatches on — MIRRORED as a literal in FakeCompanionLlm. */
    public static final String WEIGHT_MARKER = "SULY-REAKCIO-FELADAT";

    private static final String WEIGHT_PROMPT = WEIGHT_MARKER + "\n"
            + "Daniel most mérte meg a testsúlyát. Írj rövid magyar reakciót társ-szemszögből, "
            + "kizárólag a megadott tényadatokból: (1) a MOST RÖGZÍTETT MÉRÉS a kiindulópont — a "
            + "trendérték (EWMA) simított szám, a kettőt ne keverd össze, és a mérést nevezd "
            + "mérésnek, a trendet trendnek; (2) helyezd a mérést a heti trend és a cél "
            + "kontextusába; (3) egyetlen mérésből messzemenő következtetést ne vonj le; (4) ha "
            + "volt már MAI KORÁBBI ÜZENET, ne ismételd. Számot kitalálni tilos; gyógyszer-"
            + "adagolás változtatást SOHA ne javasolj. Válaszolj KIZÁRÓLAG szigorú JSON-nal: "
            + "{\"eyebrow\": \"egysoros fejléc\", \"body\": [\"bekezdés\", ...], "
            + "\"refIndexes\": [a felhasznált HIVATKOZÁS-JELÖLTEK sorszámai]}";

    static final List<CompanionMessageEnvelope.Ref> SLEEP_CANDIDATES = List.of(
            new CompanionMessageEnvelope.Ref("Sleep", "ma éjszakai alvás"),
            new CompanionMessageEnvelope.Ref("Goal", "cél"),
            new CompanionMessageEnvelope.Ref("Workout", "mai edzés"));

    static final List<CompanionMessageEnvelope.Ref> WEIGHT_CANDIDATES = List.of(
            new CompanionMessageEnvelope.Ref("WeightTrend", "súlytrend"),
            new CompanionMessageEnvelope.Ref("Goal", "cél"),
            new CompanionMessageEnvelope.Ref("FuelDay", "mai üzemanyag"));

    /** Prompt prefix the fake LLM dispatches on — the retired heartbeat generator's original
     *  marker/sentinel ({@code [fake-heartbeat:…]} in {@code FakeCompanionLlm}), reused verbatim
     *  so no new fake-LLM wiring is needed for the window kinds (midday/evening). */
    public static final String WINDOW_MARKER = "NAPKOZBENI-JEGYZET-FELADAT";

    private static final String WINDOW_PROMPT = WINDOW_MARKER + "\n"
            + "Írj magyar napközbeni jegyzetet Danielnek társ-szemszögből, 2-4 rövid bekezdésben, "
            + "kizárólag a megadott tényadatokból és a te eszközeidből (tool-hívások) származó "
            + "adatokból. Az ABLAK blokk mondja meg a jegyzet fajtáját: "
            + "- déli (nudge): (1) a nap EDDIGI állapota konkrét számokkal (ami már MEGTÖRTÉNT: "
            + "edzés, bevitel a célhoz képest, alvás ha van); (2) mi JÖN MÉG MA (edzés, étkezési "
            + "keret); (3) ha ma még hiányzik egy szokásos napló (check-in, alvás, testsúly), ezt "
            + "mondd ki egy mondatban; (4) 1-2 konkrét, cselekvési szintű fókuszpont a hátralévő "
            + "időre. "
            + "- esti (closing): zárd a napot 1-2 konkrét megfigyeléssel a mai tényleges adataiból "
            + "(mit sikerült, miben maradt el a célhoz képest) + egy rövid tanulság a holnapi napra. "
            + "Szabályok: "
            + "- Konkrét számot CSAK akkor idézhetsz, ha az a megadott pillanatképből vagy egy "
            + "tool-válaszból származik; kitalálni tilos. "
            + "- A pillanatkép \"Ma (terv)\" sora TERV, nem tény: edzést, sportot vagy futást CSAK "
            + "akkor írhatsz megtörténtnek, ha a \"Ma eddig naplózva\" sor vagy egy tool-válasz "
            + "igazolja. Ha nincs igazolva, a nap hátralévő feladataként beszélj róla. "
            + "- Ha a pillanatkép egy adatpontot nem ad meg pontosan (pl. mai edzésterv, "
            + "makró-maradék, alvási fázisok), hívd meg a megfelelő eszközt, mielőtt írsz. "
            + "- Ha van MAI KORÁBBI ÜZENETEK blokk, annak tartalmát NE ismételd. "
            + "- Gyógyszer adagolására vonatkozó változtatást SOHA ne javasolj — az orvosi döntés. "
            + "- Sima folyószöveg, markdown és felsorolás nélkül.";

    /** Emberek S6 (mezo-06o0.8) — a fake LLM erre a prefixre diszpécsel. */
    public static final String PEOPLE_MARKER = "EMBEREK-ESZREVETEL-FELADAT";

    private static final String PEOPLE_PROMPT = PEOPLE_MARKER + "\n"
            + "Írj EGYETLEN rövid magyar mondatot Danielnek társ-szemszögből az emberi köréről, "
            + "kizárólag a megadott heti összesítésből. "
            + "Szabályok: "
            + "- Pontosan egy mondat, legfeljebb 22 szó, sima folyószöveg. "
            + "- Csak azt állítsd, amit az összesítés kimond; nevet, számot kitalálni tilos. "
            + "- Ha valakinél lefelé fordult a hangulat vagy elhallgatott, azt emeld ki — "
            + "  ez a mondat arra való, hogy Daniel észrevegye, kire érdemes ránéznie. "
            + "- Ne adj utasítást és ne moralizálj; egy megfigyelés, nem feladat. "
            + "Válaszolj KIZÁRÓLAG szigorú JSON-nal, markdown nélkül, pontosan ebben a formában: "
            + "{\"eyebrow\": \"egysoros fejléc\", \"body\": [\"a mondat\"], "
            + "\"refIndexes\": [a felhasznált HIVATKOZÁS-JELÖLTEK sorszámai]}";

    record ParsedMessage(String eyebrow, List<String> body, List<Integer> refIndexes) {
    }

    private final CompanionMessageRepository companionMessageRepository;
    private final DailySummaryRepository dailySummaryRepository;
    private final ContextSnapshotAssembler contextSnapshotAssembler;
    private final KnowledgeFactService knowledgeFactService;
    private final CompanionLlm companionLlm;
    private final CompanionToolRegistry toolRegistry;
    private final LlmCallContextHolder llmCallContextHolder;
    private final ProactiveProperties properties;
    private final ObjectMapper objectMapper;
    private final SleepLogRepository sleepLogRepository;
    private final WeightLogRepository weightLogRepository;
    private final WeightTrendService weightTrendService;
    private final PersonRepository personRepository;
    private final MentionRepository mentionRepository;
    private final PersonAffectTrendCalculator affectTrendCalculator;

    /**
     * Generates (or returns the existing) morning message for one day. Returns null when there
     * is no narrative memory in the window or the answer is unusable — the caller renders honest
     * absence.
     */
    @Transactional
    public CompanionMessageEntity generateMorning(UUID userId, LocalDate date) {
        CompanionMessageEntity existing = companionMessageRepository
                .findByCreatedByAndMessageDateAndKind(userId, date, CompanionMessageEntity.KIND_MORNING)
                .orElse(null);
        if (existing != null) {
            return existing;
        }
        List<DailySummaryEntity> past = dailySummaryRepository
                .findByCreatedByAndSummaryDateGreaterThanEqualOrderBySummaryDateDesc(
                        userId, date.minusDays(properties.feed().pastDays()));
        if (past.isEmpty()) {
            log.debug("No daily summaries for {} in the {}-day window before {} — no morning message",
                    userId, properties.feed().pastDays(), date);
            return null;
        }
        List<CompanionMessageEnvelope.Ref> candidates = new ArrayList<>(MORNING_CANDIDATES);
        StringBuilder payload = new StringBuilder();
        payload.append(contextSnapshotAssembler.renderWithoutBiometrics(userId, date));
        payload.append(knowledgeFactService.renderPromptBlock(userId));
        payload.append("\n\nKORÁBBI NAPOK (legfrissebb elöl):\n");
        for (DailySummaryEntity summary : past) {
            payload.append("- ").append(summary.getSummaryDate()).append(": ")
                    .append(summary.getNarrative()).append('\n');
            candidates.add(new CompanionMessageEnvelope.Ref(
                    "Memory", summary.getSummaryDate().toString()));
        }
        payload.append("\nHIVATKOZÁS-JELÖLTEK (a refIndexes ezekre mutat):\n");
        for (int i = 0; i < candidates.size(); i++) {
            CompanionMessageEnvelope.Ref ref = candidates.get(i);
            payload.append(i).append(": [").append(ref.kind()).append("] ")
                    .append(ref.label()).append('\n');
        }

        String answer = llmCallContextHolder.runWith(
                new LlmCallContext("proactive_feed", "morning", null, null),
                () -> companionLlm.complete(MORNING_PROMPT, payload.toString()));
        ParsedMessage parsed = parse(answer, CompanionMessageEntity.KIND_MORNING);
        if (parsed == null || parsed.eyebrow() == null || parsed.eyebrow().isBlank()
                || parsed.body() == null || parsed.body().isEmpty()) {
            log.warn("Unusable morning-message answer for {} on {} — no row persisted", userId, date);
            return null;
        }
        CompanionMessageEntity message = new CompanionMessageEntity();
        message.setCreatedBy(userId);
        message.setMessageDate(date);
        message.setKind(CompanionMessageEntity.KIND_MORNING);
        message.setContent(new CompanionMessageEnvelope(
                parsed.eyebrow(), parsed.body(), resolveRefs(parsed.refIndexes(), candidates)));
        message.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return companionMessageRepository.saveAndFlush(message);
    }

    /**
     * Generates (or returns the existing) sleep-reaction message for one day. The freshly logged
     * sleep row IS the grounding event — no daily-summary window gate. Returns null when there is
     * no fresh sleep log (latest log missing, or not dated today/yesterday) or the answer is
     * unusable — the caller renders honest absence.
     */
    @Transactional
    public CompanionMessageEntity generateSleepReaction(UUID userId, LocalDate date) {
        CompanionMessageEntity existing = companionMessageRepository
                .findByCreatedByAndMessageDateAndKind(userId, date, CompanionMessageEntity.KIND_SLEEP)
                .orElse(null);
        if (existing != null) {
            return existing;
        }
        SleepLogEntity sleep = sleepLogRepository
                .findFirstByCreatedByAndDeletedFalseOrderByDateDesc(userId).orElse(null);
        if (sleep == null || !sleep.getDate().isAfter(date.minusDays(2))) {
            log.debug("No fresh sleep log for {} on {} — no sleep-reaction message", userId, date);
            return null;
        }
        List<CompanionMessageEnvelope.Ref> candidates = new ArrayList<>(SLEEP_CANDIDATES);
        StringBuilder payload = new StringBuilder();
        payload.append(contextSnapshotAssembler.render(userId, date));
        payload.append(knowledgeFactService.renderPromptBlock(userId));
        payload.append(earlierMessagesBlock(userId, date));
        payload.append("\n\nMOST RÖGZÍTETT ALVÁS (").append(sleep.getDate()).append("): ")
                .append(ToolText.num(sleep.getDurationH())).append(" h")
                .append(sleep.getQuality() != null ? ", minőség " + sleep.getQuality() + "/5" : "")
                .append(sleep.getAwakenings() != null ? ", ébredések: " + sleep.getAwakenings() : "");
        appendCandidates(payload, candidates);

        String answer = llmCallContextHolder.runWith(
                new LlmCallContext("proactive_feed", "sleep", null, null),
                () -> companionLlm.complete(SLEEP_PROMPT, payload.toString()));
        ParsedMessage parsed = parse(answer, CompanionMessageEntity.KIND_SLEEP);
        if (parsed == null || parsed.eyebrow() == null || parsed.eyebrow().isBlank()
                || parsed.body() == null || parsed.body().isEmpty()) {
            log.warn("Unusable sleep-reaction answer for {} on {} — no row persisted", userId, date);
            return null;
        }
        CompanionMessageEntity message = new CompanionMessageEntity();
        message.setCreatedBy(userId);
        message.setMessageDate(date);
        message.setKind(CompanionMessageEntity.KIND_SLEEP);
        message.setContent(new CompanionMessageEnvelope(
                parsed.eyebrow(), parsed.body(), resolveRefs(parsed.refIndexes(), candidates)));
        message.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return companionMessageRepository.saveAndFlush(message);
    }

    /**
     * Generates (or returns the existing) weight-reaction message for one day. The freshly logged
     * weigh-in IS the grounding event — no daily-summary window gate. Returns null when there is
     * no weigh-in dated exactly {@code date}, or the answer is unusable — the caller renders
     * honest absence.
     */
    @Transactional
    public CompanionMessageEntity generateWeightReaction(UUID userId, LocalDate date) {
        CompanionMessageEntity existing = companionMessageRepository
                .findByCreatedByAndMessageDateAndKind(userId, date, CompanionMessageEntity.KIND_WEIGHT)
                .orElse(null);
        if (existing != null) {
            return existing;
        }
        WeightLogEntity weight = weightLogRepository
                .findFirstByCreatedByAndDeletedFalseOrderByDateDescCreatedAtDesc(userId).orElse(null);
        if (weight == null || !weight.getDate().equals(date)) {
            log.debug("No today's weigh-in for {} on {} — no weight-reaction message", userId, date);
            return null;
        }
        List<CompanionMessageEnvelope.Ref> candidates = new ArrayList<>(WEIGHT_CANDIDATES);
        StringBuilder payload = new StringBuilder();
        payload.append(contextSnapshotAssembler.render(userId, date));
        payload.append(knowledgeFactService.renderPromptBlock(userId));
        payload.append(earlierMessagesBlock(userId, date));
        WeightTrendResponse trend = weightTrendService.computeTrend(userId);
        payload.append("\n\nMOST RÖGZÍTETT MÉRÉS (").append(weight.getDate()).append("): ")
                .append(ToolText.num(weight.getWeightKg())).append(" kg")
                .append(trend.getLatestTrendKg() != null
                        ? "; trendérték (EWMA, simított): " + ToolText.num(trend.getLatestTrendKg()) + " kg" : "")
                .append(trend.getWeeklyRateKgPerWeek() != null
                        ? ", heti " + ToolText.num(trend.getWeeklyRateKgPerWeek()) + " kg" : "");
        appendCandidates(payload, candidates);

        String answer = llmCallContextHolder.runWith(
                new LlmCallContext("proactive_feed", "weight", null, null),
                () -> companionLlm.complete(WEIGHT_PROMPT, payload.toString()));
        ParsedMessage parsed = parse(answer, CompanionMessageEntity.KIND_WEIGHT);
        if (parsed == null || parsed.eyebrow() == null || parsed.eyebrow().isBlank()
                || parsed.body() == null || parsed.body().isEmpty()) {
            log.warn("Unusable weight-reaction answer for {} on {} — no row persisted", userId, date);
            return null;
        }
        CompanionMessageEntity message = new CompanionMessageEntity();
        message.setCreatedBy(userId);
        message.setMessageDate(date);
        message.setKind(CompanionMessageEntity.KIND_WEIGHT);
        message.setContent(new CompanionMessageEnvelope(
                parsed.eyebrow(), parsed.body(), resolveRefs(parsed.refIndexes(), candidates)));
        message.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return companionMessageRepository.saveAndFlush(message);
    }

    /**
     * Generates (or returns the existing) window message (midday/evening) for one day. Ported
     * from the retired heartbeat generator: same window prompt and summary-emptiness gate, but the
     * "MAI BRIEFING" dedupe block is replaced by {@link #earlierMessagesBlock} (which now covers
     * morning/sleep/weight/midday), and the flat prose answer is wrapped as a
     * {@link CompanionMessageEnvelope} with a code-set eyebrow (no JSON parse, no refs). Returns
     * null when there is no daily summary in the window or the answer is blank — honest absence.
     */
    @Transactional
    public CompanionMessageEntity generateWindow(UUID userId, LocalDate date, String kind) {
        CompanionMessageEntity existing = companionMessageRepository
                .findByCreatedByAndMessageDateAndKind(userId, date, kind)
                .orElse(null);
        if (existing != null) {
            return existing;
        }
        List<DailySummaryEntity> past = dailySummaryRepository
                .findByCreatedByAndSummaryDateGreaterThanEqualOrderBySummaryDateDesc(
                        userId, date.minusDays(properties.feed().pastDays()));
        if (past.isEmpty()) {
            log.debug("No daily summaries for {} in the {}-day window before {} — no {} message",
                    userId, properties.feed().pastDays(), date, kind);
            return null;
        }
        DailySummaryEntity latest = past.getFirst();
        boolean evening = CompanionMessageEntity.KIND_EVENING.equals(kind);
        String window = evening ? "este (closing)" : "dél (nudge)";
        String eyebrow = evening ? "Napzárás" : "Napközi jegyzet";
        String payload = contextSnapshotAssembler.render(userId, date)
                + knowledgeFactService.renderPromptBlock(userId)
                + "\n\nUTOLSÓ NAPI ÖSSZEFOGLALÓ:\n- " + latest.getSummaryDate() + ": " + latest.getNarrative()
                + earlierMessagesBlock(userId, date)
                + "\n\nABLAK: " + window;

        ToolCallAudit audit = toolRegistry.newTurnAudit();
        String answer = llmCallContextHolder.runWith(
                new LlmCallContext("proactive_feed", kind, null, null),
                () -> companionLlm.complete(WINDOW_PROMPT, payload,
                        toolRegistry.callbacks(audit), toolRegistry.toolContext(userId, audit)));
        if (answer == null || answer.isBlank()) {
            log.warn("Unusable {} answer for {} on {} — no row persisted", kind, userId, date);
            return null;
        }
        RefsEnvelope toolRefs = audit.toRefsEnvelope();
        List<CompanionMessageEnvelope.Ref> refs = toolRefs == null
                ? List.of()
                : toolRefs.refs().stream()
                        .map(r -> new CompanionMessageEnvelope.Ref(r.kind(), r.id()))
                        .toList();
        CompanionMessageEntity message = new CompanionMessageEntity();
        message.setCreatedBy(userId);
        message.setMessageDate(date);
        message.setKind(kind);
        message.setContent(new CompanionMessageEnvelope(eyebrow, List.of(answer.strip()), refs));
        message.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return companionMessageRepository.saveAndFlush(message);
    }

    /**
     * Emberek S6 (mezo-06o0.8): a hét emberi képéről szóló egymondatos megfigyelés. Adat-kapu:
     * e heti említés nélkül NINCS LLM-hívás és nincs sor — az Emberek hub ilyenkor a
     * determinisztikus tartalék-mondatot mutatja (Task 3), nem üres sávot.
     *
     * <p>A payload SZÁNDÉKOSAN már aggregált (személyenként egy sor), nem nyers említés-lista:
     * a modellnek nem kell — és nem is szabad — idézeteket újraértelmeznie, csak a heti képet
     * megfogalmaznia. A hét hétfő-alapú (UTC), konzisztensen a
     * {@link PersonAffectTrendCalculator}-ral: a {@code date} hetének hétfőjétől a következő
     * hétfőig tartó félig-nyitott ablak.
     */
    @Transactional
    public CompanionMessageEntity generatePeopleObservation(UUID userId, LocalDate date) {
        CompanionMessageEntity existing = companionMessageRepository
                .findByCreatedByAndMessageDateAndKind(userId, date, CompanionMessageEntity.KIND_PEOPLE)
                .orElse(null);
        if (existing != null) {
            return existing;
        }
        LocalDate monday = date.with(DayOfWeek.MONDAY);
        Instant weekStart = monday.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant weekEnd = monday.plusDays(7).atStartOfDay(ZoneOffset.UTC).toInstant();
        List<MentionEntity> weekMentions = mentionRepository
                .findByCreatedByAndTsGreaterThanEqualAndTsLessThanAndDeletedFalse(userId, weekStart, weekEnd);
        if (weekMentions.isEmpty()) {
            log.debug("No mentions this week for {} on {} — no people-observation message", userId, date);
            return null;
        }
        List<PersonEntity> persons = personRepository
                .findAllByCreatedByAndDeletedFalseOrderByNameAsc(userId).stream()
                .filter(p -> "active".equals(p.getStatus()))
                .toList();
        Map<UUID, List<MentionSignal>> allByPerson = mentionRepository.findSignals(userId).stream()
                .collect(Collectors.groupingBy(MentionSignal::personId));
        Map<UUID, Long> weekCountByPerson = weekMentions.stream()
                .collect(Collectors.groupingBy(MentionEntity::getPersonId, Collectors.counting()));

        List<CompanionMessageEnvelope.Ref> candidates = new ArrayList<>();
        StringBuilder mentionedLines = new StringBuilder();
        List<String> silentNames = new ArrayList<>();
        for (PersonEntity p : persons) {
            long thisWeek = weekCountByPerson.getOrDefault(p.getId(), 0L);
            candidates.add(new CompanionMessageEnvelope.Ref("Person", p.getName()));
            if (thisWeek == 0) {
                silentNames.add(p.getName());
                continue;
            }
            PersonAffectTrend trend = affectTrendCalculator.calculate(
                    allByPerson.getOrDefault(p.getId(), List.of()), date);
            mentionedLines.append("- ").append(p.getName()).append(" (").append(p.getRelationshipHu())
                    .append("): ").append(thisWeek).append(" említés e héten, irány ")
                    .append(directionHu(trend.direction())).append(", ")
                    .append(trend.reason() == null ? "kevés adat" : trend.reason()).append('\n');
        }
        if (mentionedLines.isEmpty()) {
            // e heti mention volt, de egyikük sem tartozik aktív személyhez (pl. csak candidate) —
            // becsületes hiány, nem kitalált kép.
            log.debug("No active person has a mention this week for {} on {} — no people-observation message",
                    userId, date);
            return null;
        }
        StringBuilder payload = new StringBuilder();
        payload.append("HETI EMBERKÉP:\n").append(mentionedLines);
        if (!silentNames.isEmpty()) {
            payload.append("CSENDBEN MARADT: ").append(String.join(", ", silentNames)).append('\n');
        }
        appendCandidates(payload, candidates);

        String answer = llmCallContextHolder.runWith(
                new LlmCallContext("proactive_feed", "people", null, null),
                () -> companionLlm.complete(PEOPLE_PROMPT, payload.toString()));
        ParsedMessage parsed = parse(answer, CompanionMessageEntity.KIND_PEOPLE);
        if (parsed == null || parsed.eyebrow() == null || parsed.eyebrow().isBlank()
                || parsed.body() == null || parsed.body().isEmpty()) {
            log.warn("Unusable people-observation answer for {} on {} — no row persisted", userId, date);
            return null;
        }
        CompanionMessageEntity message = new CompanionMessageEntity();
        message.setCreatedBy(userId);
        message.setMessageDate(date);
        message.setKind(CompanionMessageEntity.KIND_PEOPLE);
        message.setContent(new CompanionMessageEnvelope(
                parsed.eyebrow(), parsed.body(), resolveRefs(parsed.refIndexes(), candidates)));
        message.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return companionMessageRepository.saveAndFlush(message);
    }

    /** Determinisztikus magyar irány-címke a payload-sorokhoz — nem a {@link PersonAffectTrend}
     *  indoklása, csak a puszta irány szava. */
    private static String directionHu(String direction) {
        return switch (direction) {
            case PersonAffectTrend.DIRECTION_UP -> "javuló";
            case PersonAffectTrend.DIRECTION_DOWN -> "romló";
            default -> "stagnáló";
        };
    }

    /** Numbered HIVATKOZÁS-JELÖLTEK block, identical shape to {@link #generateMorning}'s. */
    private void appendCandidates(StringBuilder payload, List<CompanionMessageEnvelope.Ref> candidates) {
        payload.append("\nHIVATKOZÁS-JELÖLTEK (a refIndexes ezekre mutat):\n");
        for (int i = 0; i < candidates.size(); i++) {
            CompanionMessageEnvelope.Ref ref = candidates.get(i);
            payload.append(i).append(": [").append(ref.kind()).append("] ")
                    .append(ref.label()).append('\n');
        }
    }

    /** Today's already-persisted feed messages as a "ne ismételd" block; "" when none. */
    private String earlierMessagesBlock(UUID userId, LocalDate date) {
        List<CompanionMessageEntity> earlier =
                companionMessageRepository.findByCreatedByAndMessageDateOrderByGeneratedAtAsc(userId, date);
        if (earlier.isEmpty()) {
            return "";
        }
        return "\n\nMAI KORÁBBI ÜZENETEK (ne ismételd):\n" + earlier.stream()
                .map(m -> "- [" + m.getKind() + "] " + String.join(" ", m.getContent().body()))
                .collect(Collectors.joining("\n"));
    }

    /** Defensive first-{ to last-} JSON parse (the FactExtractionService idiom); null on any failure. */
    private ParsedMessage parse(String answer, String kind) {
        if (answer == null) {
            return null;
        }
        int start = answer.indexOf('{');
        int end = answer.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return null;
        }
        try {
            return objectMapper.readValue(answer.substring(start, end + 1), ParsedMessage.class);
        } catch (Exception e) {
            log.warn("{}-message answer failed to parse: {}", kind, e.getMessage());
            return null;
        }
    }

    /** Bounds-checked, order-preserving, deduped index→candidate resolution. */
    private List<CompanionMessageEnvelope.Ref> resolveRefs(
            List<Integer> indexes, List<CompanionMessageEnvelope.Ref> candidates) {
        if (indexes == null) {
            return List.of();
        }
        return indexes.stream()
                .filter(i -> i != null && i >= 0 && i < candidates.size())
                .distinct()
                .map(candidates::get)
                .toList();
    }
}
