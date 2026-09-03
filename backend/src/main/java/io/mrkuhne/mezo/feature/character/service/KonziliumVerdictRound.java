package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.character.entity.ConferenceTranscriptEnvelope;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/**
 * The weekly konzílium's judgement round (Karakter spec §6 step 2, mezo-1gim.5): the Szkeptikus
 * attacks every expert proposal from step 1, then the Integrátor (Mezo) weighs the proposals
 * against the Szkeptikus's verdicts and rules on each one — plus, rarely, proposes a new chapter.
 * Both are ONE smart-tier {@link CompanionLlm} call each. A round that FAILS TO PARSE contributes
 * an empty/default set of rulings but writes NO transcript turn for that persona — fabricating a
 * narrative turn from a defaulted answer would misrepresent what actually happened; a genuinely
 * parsed answer (however uneventful) still gets its honest turn (mirrors
 * {@link KonziliumProposalRound}'s per-expert isolation).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH},
        havingValue = "true")
public class KonziliumVerdictRound {

    /** The Szkeptikus prompt's first line — the fake LLM keys its deterministic answer on it. */
    public static final String SKEPTIC_MARKER = "KARAKTER-SZKEPTIKUS-FELADAT";
    /** The Integrátor prompt's first line — the fake LLM keys its deterministic answer on it. */
    public static final String INTEGRATOR_MARKER = "KARAKTER-INTEGRATOR-FELADAT";

    private static final BigDecimal MIN_RULED_CONFIDENCE = new BigDecimal("0.30");
    private static final BigDecimal MAX_RULED_CONFIDENCE = new BigDecimal("0.90");
    private static final int MAX_CHAPTERS_PER_CONFERENCE = 1;
    private static final String NEW_KIND = "NEW";
    private static final String KEEP = "KEEP";
    private static final String KILL = "KILL";
    private static final String DEFAULT_ARGUMENT = "nincs ellenérv";
    private static final String DEFAULT_REASON = "nem került döntésre";

    private final CompanionLlm companionLlm;
    private final ObjectMapper objectMapper;
    private final LlmCallContextHolder llmCallContextHolder;

    /** One Szkeptikus verdict, before defaulting. */
    record SkepticVerdictDraft(Integer index, String verdict, String argument) {}

    /** One Integrátor ruling, before defaulting/clamping. */
    record IntegratorRulingDraft(Integer index, Boolean accept, BigDecimal confidence, String reason) {}

    /** One Integrátor chapter proposal, before the blank-title/cap filter. */
    record IntegratorChapterDraft(String title, String rationale) {}

    /** The Integrátor's full parsed answer. */
    record IntegratorAnswer(List<IntegratorRulingDraft> rulings, List<IntegratorChapterDraft> chapters) {}

    /** {@code verdicts} is always usable for downstream defaulting (empty when unparsed);
     *  {@code parsed} is the ONLY signal that decides whether a transcript turn is honest to
     *  write — never conflate "nothing came back" with "the model genuinely said nothing". */
    private record SkepticResult(Map<Integer, SkepticVerdictDraft> verdicts, boolean parsed) {}

    /** Same split as {@link SkepticResult}, for the Integrátor's answer. */
    private record IntegratorResult(IntegratorAnswer answer, boolean parsed) {}

    /** A rare, AI-proposed new dossier chapter — {@link ClaimLifecycle#openChapters} turns an
     *  accepted one into a {@code CharacterDimensionEntity} row. */
    public record ChapterProposal(String title, String rationale) {}

    /** The round's output: every proposal's final ruling, at most one chapter proposal, and one
     *  transcript turn per persona that answered (szkeptikus, mezo) — a persona whose round failed
     *  to parse contributes no turn at all. */
    public record Result(List<ClaimRuling> rulings, List<ChapterProposal> chapters,
                         List<ConferenceTranscriptEnvelope.Turn> turns) {}

    public Result run(UUID owner, LocalDate weekStart, List<ClaimProposal> proposals) {
        if (proposals.isEmpty()) {
            return new Result(List.of(), List.of(), List.of());
        }

        SkepticResult skepticResult = runSkeptic(owner, weekStart, proposals);
        List<ConferenceTranscriptEnvelope.Turn> turns = new ArrayList<>();
        if (skepticResult.parsed()) {
            turns.add(skepticTurn(proposals, skepticResult.verdicts()));
        }

        IntegratorResult integratorResult = runIntegrator(owner, weekStart, proposals, skepticResult.verdicts());
        IntegratorAnswer answer = integratorResult.answer();
        Map<Integer, IntegratorRulingDraft> rulingsByIndex = new LinkedHashMap<>();
        for (IntegratorRulingDraft draft : answer.rulings()) {
            if (draft.index() != null) {
                rulingsByIndex.put(draft.index(), draft);
            }
        }

        List<ClaimRuling> rulings = new ArrayList<>();
        for (int i = 0; i < proposals.size(); i++) {
            ClaimProposal proposal = proposals.get(i);
            IntegratorRulingDraft draft = rulingsByIndex.get(i);
            rulings.add(toRuling(proposal, draft));
        }

        List<ChapterProposal> chapters = new ArrayList<>();
        for (IntegratorChapterDraft draft : answer.chapters()) {
            if (draft.title() == null || draft.title().isBlank()) {
                continue;
            }
            if (chapters.size() >= MAX_CHAPTERS_PER_CONFERENCE) {
                break;
            }
            chapters.add(new ChapterProposal(draft.title(), draft.rationale()));
        }

        if (integratorResult.parsed()) {
            turns.add(integratorTurn(rulings, chapters));
        }
        return new Result(rulings, chapters, turns);
    }

    private static ClaimRuling toRuling(ClaimProposal proposal, IntegratorRulingDraft draft) {
        if (draft == null) {
            return new ClaimRuling(proposal, false, null, DEFAULT_REASON);
        }
        boolean accepted = draft.accept() != null && draft.accept();
        BigDecimal confidence = draft.confidence();
        // The proposal-confidence fallback is a NEW-only concern (there is no "current value" to
        // move for a brand-new claim). For UP/DOWN an omitted confidence must stay null so
        // ClaimLifecycle applies its own ±0.10 step off the CLAIM's current confidence — silently
        // substituting the proposal's confidence here would make that fallback unreachable.
        if (confidence == null && NEW_KIND.equals(proposal.kind())) {
            confidence = proposal.confidence();
        }
        if (accepted && confidence != null) {
            confidence = clamp(confidence);
        }
        String reason = draft.reason() != null && !draft.reason().isBlank() ? draft.reason() : DEFAULT_REASON;
        return new ClaimRuling(proposal, accepted, confidence, reason);
    }

    private static BigDecimal clamp(BigDecimal value) {
        if (value.compareTo(MIN_RULED_CONFIDENCE) < 0) {
            return MIN_RULED_CONFIDENCE;
        }
        if (value.compareTo(MAX_RULED_CONFIDENCE) > 0) {
            return MAX_RULED_CONFIDENCE;
        }
        return value;
    }

    // ── Szkeptikus ────────────────────────────────────────────────────────────

    private SkepticResult runSkeptic(UUID owner, LocalDate weekStart, List<ClaimProposal> proposals) {
        String systemPrompt = SKEPTIC_MARKER + "\n" + skepticPersona() + "\n" + skepticContract();
        String userMessage = numberedProposals(weekStart, proposals);
        String raw = callSmart(owner, "skeptic", systemPrompt, userMessage);
        if (raw == null || raw.isBlank()) {
            log.warn("Szkeptikus answer was blank for owner {} week {}", owner, weekStart);
            return new SkepticResult(Map.of(), false);
        }
        List<SkepticVerdictDraft> drafts;
        try {
            drafts = objectMapper.readValue(stripArrayFences(raw), new TypeReference<List<SkepticVerdictDraft>>() {});
        } catch (Exception e) {
            log.warn("Szkeptikus answer was not parseable JSON for owner {} week {} — {}", owner, weekStart, raw, e);
            return new SkepticResult(Map.of(), false);
        }
        Map<Integer, SkepticVerdictDraft> byIndex = new LinkedHashMap<>();
        for (SkepticVerdictDraft draft : drafts) {
            if (draft.index() != null) {
                byIndex.put(draft.index(), draft);
            }
        }
        return new SkepticResult(byIndex, true);
    }

    private static ConferenceTranscriptEnvelope.Turn skepticTurn(List<ClaimProposal> proposals,
                                                                  Map<Integer, SkepticVerdictDraft> verdicts) {
        StringBuilder sb = new StringBuilder("Szkeptikus: ").append(proposals.size()).append(" javaslat véleményezve.");
        for (int i = 0; i < proposals.size(); i++) {
            SkepticVerdictDraft draft = verdicts.get(i);
            String verdict = draft != null && KILL.equals(draft.verdict()) ? KILL : KEEP;
            String argument = draft != null && draft.argument() != null && !draft.argument().isBlank()
                    ? draft.argument() : DEFAULT_ARGUMENT;
            sb.append("\nP").append(i).append(": ").append(verdict).append(" — ").append(argument);
        }
        return new ConferenceTranscriptEnvelope.Turn("szkeptikus", sb.toString(), List.of());
    }

    private static String skepticPersona() {
        return """
                Te vagy a Szkeptikus, Daniel profilozó csapatának kritikus tagja. Száraz, tárgyilagos \
                hangon írsz. A feladatod, hogy minden javaslatot megtámadj: kérdőjelezd meg a \
                bizonyíték elégségességét, keress alternatív magyarázatot, és figyelj a \
                túlinterpretálásra. Az érzékeny (sensitive=true) javaslatokat fokozott szigorral vizsgáld. \
                A "self-audit" dimenzió javaslatai a saját megfigyelő-szerepedből \
                jöttek — ezeket ugyanezzel a szigorral bíráld, és külön ellenőrizd, hogy az alanyuk \
                valóban a rendszer (Mezo teljesítménye), nem Daniel tulajdonsága.""";
    }

    private static String skepticContract() {
        return """
                Válaszolj KIZÁRÓLAG egy JSON tömbbel, magyarázat és formázás nélkül, pontosan ebben \
                a formában: [{"index":0,"verdict":"KEEP|KILL","argument":"..."}]. A felsorolt \
                javaslatok mindegyikéhez (P0, P1, …) pontosan egy bejegyzést adj, a sorszáma szerinti \
                "index" mezővel.""";
    }

    // ── Integrátor ────────────────────────────────────────────────────────────

    private IntegratorResult runIntegrator(UUID owner, LocalDate weekStart, List<ClaimProposal> proposals,
                                            Map<Integer, SkepticVerdictDraft> verdicts) {
        String systemPrompt = INTEGRATOR_MARKER + "\n" + integratorPersona() + "\n" + integratorContract();
        String userMessage = numberedProposals(weekStart, proposals) + "\n" + skepticVerdictsBlock(proposals, verdicts);
        String raw = callSmart(owner, "integrate", systemPrompt, userMessage);
        if (raw == null || raw.isBlank()) {
            log.warn("Integrátor answer was blank for owner {} week {}", owner, weekStart);
            return new IntegratorResult(new IntegratorAnswer(List.of(), List.of()), false);
        }
        try {
            IntegratorAnswer answer = objectMapper.readValue(stripObjectFences(raw), IntegratorAnswer.class);
            return new IntegratorResult(answer, true);
        } catch (Exception e) {
            log.warn("Integrátor answer was not parseable JSON for owner {} week {} — {}", owner, weekStart, raw, e);
            return new IntegratorResult(new IntegratorAnswer(List.of(), List.of()), false);
        }
    }

    private static ConferenceTranscriptEnvelope.Turn integratorTurn(List<ClaimRuling> rulings,
                                                                     List<ChapterProposal> chapters) {
        long accepted = rulings.stream().filter(ClaimRuling::accepted).count();
        StringBuilder sb = new StringBuilder("Mezo: ").append(accepted).append('/').append(rulings.size())
                .append(" javaslat elfogadva.");
        for (int i = 0; i < rulings.size(); i++) {
            ClaimRuling ruling = rulings.get(i);
            sb.append("\nP").append(i).append(": ").append(ruling.accepted() ? "ELFOGADVA" : "ELUTASÍTVA")
                    .append(" (").append(ruling.ruledConfidence()).append(") — ").append(ruling.reason());
        }
        for (ChapterProposal chapter : chapters) {
            sb.append("\nÚj fejezet: ").append(chapter.title()).append(" — ").append(chapter.rationale());
        }
        return new ConferenceTranscriptEnvelope.Turn("mezo", sb.toString(), List.of());
    }

    private static String integratorPersona() {
        return """
                Te vagy Mezo, Daniel személyes egészség- és teljesítmény-társa, most integrátor \
                szerepben a heti konzíliumon. Higgadt, tárgyszerű hangon döntesz. Minden javaslatot \
                a Szkeptikus ellenérveivel együtt mérlegelsz, és csak azt fogadod el, amit a \
                bizonyíték tényleg alátámaszt. Új fejezetet (chapter) csak akkor javasolsz, ha valóban \
                önálló, tartós témáról van szó — ritkán.""";
    }

    private static String integratorContract() {
        return """
                Válaszolj KIZÁRÓLAG egy JSON objektummal, magyarázat és formázás nélkül, pontosan \
                ebben a formában: {"rulings":[{"index":0,"accept":true|false,"confidence":0.0-1.0,\
                "reason":"..."}],"chapters":[{"title":"...","rationale":"..."}]}. A felsorolt \
                javaslatok mindegyikéhez (P0, P1, …) adj egy rulings-bejegyzést. Legfeljebb 1 \
                chapters-bejegyzést adj, és csak akkor, ha tényleg indokolt.""";
    }

    // ── shared rendering/parsing ──────────────────────────────────────────────

    private String callSmart(UUID owner, String operation, String systemPrompt, String userMessage) {
        try {
            return llmCallContextHolder.runWith(
                    new LlmCallContext("character", operation, "character_conference", null),
                    () -> companionLlm.completeSmart(systemPrompt, userMessage));
        } catch (Exception e) {
            log.warn("{} call failed for owner {}", operation, owner, e);
            return null;
        }
    }

    private static String numberedProposals(LocalDate weekStart, List<ClaimProposal> proposals) {
        // The monthly bootstrap konzílium (Karakter S4, mezo-1gim.6) has no week — CharacterBootstrapService
        // passes weekStart=null here. weekStart.plusDays(6) would NPE, so render a null-safe label instead
        // of a week range for that path.
        String periodLabel = weekStart != null
                ? "Hét: " + weekStart + " – " + weekStart.plusDays(6)
                : "Teljes eddigi történet";
        StringBuilder sb = new StringBuilder(periodLabel)
                .append(" (a javaslatok korábbi, még fel nem dolgozott megfigyelésekből is származhatnak)");
        for (int i = 0; i < proposals.size(); i++) {
            ClaimProposal p = proposals.get(i);
            String target = NEW_KIND.equals(p.kind()) ? p.dimensionKey() : String.valueOf(p.claimId());
            sb.append("\nP").append(i).append(". ").append(p.kind()).append(' ').append(target)
                    .append(" — ").append(p.text()).append(" (biztonság ").append(p.confidence())
                    .append(p.sensitive() ? ", ÉRZÉKENY" : "").append(") indoklás: ").append(p.rationale());
        }
        return sb.toString();
    }

    private static String skepticVerdictsBlock(List<ClaimProposal> proposals, Map<Integer, SkepticVerdictDraft> verdicts) {
        StringBuilder sb = new StringBuilder("Szkeptikus döntések:");
        for (int i = 0; i < proposals.size(); i++) {
            SkepticVerdictDraft draft = verdicts.get(i);
            String verdict = draft != null && KILL.equals(draft.verdict()) ? KILL : KEEP;
            String argument = draft != null && draft.argument() != null && !draft.argument().isBlank()
                    ? draft.argument() : DEFAULT_ARGUMENT;
            sb.append("\nP").append(i).append(": ").append(verdict).append(" — ").append(argument);
        }
        return sb.toString();
    }

    /** Strips optional ```json fences (and surrounding prose) around a JSON ARRAY. */
    private static String stripArrayFences(String raw) {
        String trimmed = unfenced(raw);
        int start = trimmed.indexOf('[');
        int end = trimmed.lastIndexOf(']');
        return start >= 0 && end > start ? trimmed.substring(start, end + 1) : trimmed.strip();
    }

    /** Strips optional ```json fences (and surrounding prose) around a JSON OBJECT. */
    private static String stripObjectFences(String raw) {
        String trimmed = unfenced(raw);
        int start = trimmed.indexOf('{');
        int end = trimmed.lastIndexOf('}');
        return start >= 0 && end > start ? trimmed.substring(start, end + 1) : trimmed.strip();
    }

    private static String unfenced(String raw) {
        String trimmed = raw.strip();
        if (trimmed.startsWith("```")) {
            int firstNewline = trimmed.indexOf('\n');
            trimmed = firstNewline >= 0 ? trimmed.substring(firstNewline + 1) : trimmed;
            int fenceEnd = trimmed.lastIndexOf("```");
            if (fenceEnd >= 0) {
                trimmed = trimmed.substring(0, fenceEnd);
            }
        }
        return trimmed;
    }
}
