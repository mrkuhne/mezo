package io.mrkuhne.mezo.feature.character.service.chat;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.character.entity.TeamChatThreadEntity;
import io.mrkuhne.mezo.feature.character.service.edition.EditionVoiceGuard;
import io.mrkuhne.mezo.feature.character.service.edition.TeamCharacter;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagCatalog;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * The team chat REPLY voice (Emlékezet S7 Task 5, mezo-d6ivw.7, spec 2026-09-27): ONE guarded LLM
 * call answers the user's own explanation on an open/just-closed ügy, in the owner character's
 * voice, and — when the answer reads as a concrete, rememberable context — hands back a candidate
 * exception (contextTag/factText/keywords) for the caller to persist.
 *
 * <p>Mirrors {@link TeamChatVoiceWriter}'s call, guard and never-throws contract, with one
 * difference: there is no owner/guest/skeptic split here — a single voiced line, or the honest
 * template ({@link TeamChatReplyDraft#template(String)}) on ANY guard, parse or budget failure
 * (ADR 0049).
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH,
                FeaturesConfiguration.PROACTIVE_SWITCH, FeaturesConfiguration.INTERVENTION_SWITCH,
                FeaturesConfiguration.TEAM_CHAT_SWITCH},
        havingValue = "true")
public class TeamChatReplyVoiceWriter {

    /** The prompt's FIRST line — {@code FakeCompanionLlm} mirrors it literally to dispatch on. */
    public static final String MARKER = "CSAPATFAL-VALASZ";

    static final Set<String> VERDICTS = Set.of("concrete_context", "mood", "disagreement", "question", "other");

    private static final String RULES = """
            A felhasználó ({{NÉV}}) válaszolt egy csapat-ügyre. Te az ügy gazdájaként felelsz, a saját hangodon.
            Szabályok: 1–2 mondat; nyugtázd, amit mondott, NE ismételd meg a tanácsot, NE moralizálj; ha konkrét
            okot mond (esemény, program, betegség, utazás, munka), fogadd el természetesen; hangulatra ("nem volt
            kedvem") megértően reagálj, szabályt ne csinálj belőle; kérdésre röviden válaszolj; egyet nem értésre
            ne vitatkozz. Számot csak a „tények:” sorokból vagy a felhasználó saját szövegéből írhatsz. Emoji csak a
            karakter készletéből, mértékkel. Szaknyelv tilos.
            Minősítsd a választ: concrete_context | mood | disagreement | question | other. Ha concrete_context:
            contextTag = 1–3 szavas címke (pl. „meccsnap”), factText = egy mondat, amit érdemes megjegyezni
            (pl. „Meccsnapokon későn eszel — ez rendben van.”), keywords = 1–6 kisbetűs szótő, amivel egy napi
            jegyzetben felismerhető (pl. ["meccs","kupa","röpi"]).""";

    private static final String ANSWER_CONTRACT = "\nVálasz: KIZÁRÓLAG JSON objektum: "
            + "{\"reply\":\"…\",\"verdict\":\"…\",\"contextTag\":\"…vagy null\",\"factText\":\"…vagy null\",\"keywords\":[…]}\n";

    static final String SYSTEM_PROMPT = MARKER + "\n" + RULES + PromptPersona.VOICE_HU + ANSWER_CONTRACT;

    private final CompanionLlm companionLlm;
    private final LlmCallContextHolder llmCallContextHolder;
    private final PromptPersona promptPersona;
    private final TeamChatBudget budget;
    private final TeamChatContext context;
    private final ObjectMapper objectMapper;

    /** The model's answer; every field optional. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    private record Answer(String reply, String verdict, String contextTag, String factText, List<String> keywords) {
    }

    /**
     * The reply line for the user's own explanation on {@code thread}. {@code threadFacts} are the
     * ONLY numbers the guard allows besides the user's own words; {@code offerNote} is the optional
     * EXCUSE/REVIEW offer already surfaced to the user, when there is one. Never throws.
     */
    public TeamChatReplyDraft write(UUID owner, TeamChatThreadEntity thread, List<String> userTexts,
            List<String> threadFacts, String offerNote) {
        TeamCharacter who = TeamCharacter.valueOf(thread.getOwnerCharacter().toUpperCase(Locale.ROOT));
        TeamChatReplyDraft fallback = TeamChatReplyDraft.template(templateFor(who));
        Answer a;
        try {
            if (!budget.hasRoom(owner)) {
                log.info("Team chat reply budget spent for user {} — ügy {} keeps the template", owner, thread.getId());
                return fallback;
            }
            TeamChatContextBlock background = context.build(owner, thread, Instant.now());
            String system = promptPersona.render(owner, SYSTEM_PROMPT);
            String user = userMessage(who, thread, userTexts, threadFacts, offerNote, background);
            String raw = llmCallContextHolder.runWith(
                    new LlmCallContext(TeamChatBudget.FEATURE, "reply", "team_chat_thread", thread.getId()),
                    () -> companionLlm.complete(system, user));
            a = objectMapper.readValue(TeamChatVoiceWriter.stripFences(raw), Answer.class);
        } catch (RuntimeException e) {
            log.warn("Team chat reply voice call failed for user {} ügy {} — template", owner, thread.getId(), e);
            return fallback;
        }
        if (a == null || a.reply() == null || a.reply().isBlank()) {
            return fallback;
        }
        String body = a.reply().strip();
        String userText = String.join(" ", userTexts == null ? List.<String>of() : userTexts);
        if (EditionVoiceGuard.checkGuest(who, body, threadFacts, userText).isPresent()) {
            return fallback;
        }
        String verdict = a.verdict() != null && VERDICTS.contains(a.verdict().strip()) ? a.verdict().strip() : null;
        return new TeamChatReplyDraft(body, true, verdict, blankToNull(a.contextTag()), blankToNull(a.factText()),
                TeamChatExceptionMatcher.cleanKeywords(a.keywords()));
    }

    /** A fixed, honest per-character acknowledgement — no number, no emoji, every character the same. */
    public static String templateFor(TeamCharacter c) {
        return "Köszönöm, hogy elmondtad — ezt figyelembe veszem.";
    }

    /**
     * The event block: {@code karakter:}, {@code ügy:} (the raise's own Hungarian label), the
     * whitelisted {@code tények:}, the user's own {@code a felhasználó írta:} lines, the optional
     * {@code ajánlat:} and the same non-numeric {@code háttér} sections {@link TeamChatVoiceWriter}
     * sends — background only, never a source of allowed numbers.
     */
    private static String userMessage(TeamCharacter owner, TeamChatThreadEntity thread, List<String> userTexts,
            List<String> threadFacts, String offerNote, TeamChatContextBlock background) {
        StringBuilder sb = new StringBuilder();
        sb.append("karakter: ").append(describe(owner)).append(" · ").append(owner.voice()).append('\n');
        sb.append("ügy: ").append(FlagCatalog.labelOf(thread.getFlagKey())).append('\n');
        sb.append("tények:\n");
        for (String fact : threadFacts == null ? List.<String>of() : threadFacts) {
            sb.append("- ").append(TeamChatVoiceWriter.oneLine(fact)).append('\n');
        }
        sb.append("a felhasználó írta:\n");
        for (String text : userTexts == null ? List.<String>of() : userTexts) {
            sb.append("- ").append(TeamChatVoiceWriter.oneLine(text)).append('\n');
        }
        if (offerNote != null && !offerNote.isBlank()) {
            sb.append("ajánlat: ").append(TeamChatVoiceWriter.oneLine(offerNote)).append('\n');
        }
        sb.append("háttér — számot innen NE írj:\n");
        TeamChatVoiceWriter.section(sb, "ma eddig", background.todayLines());
        TeamChatVoiceWriter.section(sb, "korábbi esetek", background.pastEpisodes());
        TeamChatVoiceWriter.section(sb, "reakciók", background.reactions());
        TeamChatVoiceWriter.section(sb, "tudás", background.knowledge());
        return sb.toString().strip();
    }

    private static String describe(TeamCharacter c) {
        return c.displayName()
                + (c.area().isBlank() ? "" : " · " + c.area())
                + " · " + (c.emoji().isEmpty() ? "emoji nélkül" : "emoji: " + String.join(" ", new java.util.TreeSet<>(c.emoji())));
    }

    private static String blankToNull(String text) {
        return text == null || text.isBlank() ? null : text.strip();
    }
}
