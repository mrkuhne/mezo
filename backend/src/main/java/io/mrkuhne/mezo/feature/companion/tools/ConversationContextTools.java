package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.feature.companion.CharacterPromptSource;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.config.ConversationProperties;
import io.mrkuhne.mezo.feature.companion.memory.service.ChatMemoryContextAdapter;
import io.mrkuhne.mezo.feature.companion.reflection.service.ReflectionPromptBlock;
import io.mrkuhne.mezo.feature.companion.repository.AiConversationRepository;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.companion.service.ContextSnapshotAssembler;
import io.mrkuhne.mezo.feature.companion.service.ConversationHistory;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactService;
import io.mrkuhne.mezo.feature.companion.service.PeopleSnapshotBlock;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

/** On-demand context, memory and history. Identity and conversation come only from the server. */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class ConversationContextTools {
    public static final String CONVERSATION_ID = "conversationId";
    public static final String HISTORY = "history";
    private final ContextSnapshotAssembler snapshot;
    private final KnowledgeFactService facts;
    private final PeopleSnapshotBlock people;
    private final ObjectProvider<CharacterPromptSource> character;
    private final ObjectProvider<ReflectionPromptBlock> reflection;
    private final ChatMemoryContextAdapter memory;
    private final AiMessageRepository messages;
    private final AiConversationRepository conversations;
    private final ConversationHistory historyRenderer;
    private final ConversationProperties properties;
    private final LlmCallContextHolder callContext;

    @Tool(name = "get_personal_context", description = "Személyes háttér egy kiválasztott része. "
            + "scope=facts (alapértelmezés): megerősített tények; people: ismert emberek és kapcsolatuk; "
            + "character: tárolt karakterleírás; reflections: nyitott észrevételek; today: aktuális "
            + "egészség/nap állapotösszesítő. Használd, amikor a kérdéshez ez a személyes háttér kell. "
            + "Nem teljes napló és nem automatikus téma: a részletes mérésekhez a megfelelő domain eszköz kell.")
    public String personalContext(@ToolParam(required = false, description =
            "facts (alapértelmezés), people, character, reflections vagy today") String scope, ToolContext ctx) {
        UUID user = ToolContexts.userId(ctx);
        String result = switch (scope == null ? "facts" : scope) {
            case "facts" -> facts.renderPromptBlock(user);
            case "people" -> people.render(user, LocalDate.now());
            case "character" -> character.getIfAvailable() == null ? "" : character.getObject().render(user);
            case "reflections" -> reflection.getIfAvailable() == null ? "" : reflection.getObject().render(user);
            case "today" -> snapshot.render(user, LocalDate.now());
            default -> "Ismeretlen scope. Használható: facts, people, character, reflections, today.";
        };
        return result.isBlank() ? ToolText.NO_DATA : result;
    }

    @Tool(name = "search_personal_memory", description = "Témához kapcsolódó hosszú távú emlékek, "
            + "tények és kapcsolatok keresése. query: önállóan érthető keresőkérdés, kötelező. "
            + "Használd, amikor korábbi élmény, beszélgetés, ember vagy személyes háttér felidézése segít. "
            + "Releváns kivonatokat ad; nem teljes adatbázis és nem friss mérés.")
    @SuppressWarnings("unchecked")
    public String searchMemory(@ToolParam(description = "Önálló témaleírás az előzmények alapján") String query,
            ToolContext ctx) {
        if (query == null || query.isBlank()) {
            return "Adj meg keresőkérdést.";
        }
        UUID conversation = (UUID)ctx.getContext().get(CONVERSATION_ID);
        List<CompanionLlm.Turn> history = (List<CompanionLlm.Turn>)ctx.getContext().getOrDefault(HISTORY, List.of());
        var payload = callContext.runWith(new LlmCallContext("companion_chat", "memory_read", "conversation", conversation),
                () -> memory.resolve(ToolContexts.userId(ctx), conversation, query, history, LocalDate.now()));
        var audit = ToolContexts.audit(ctx);
        payload.refs().forEach(ref -> audit.addRef(ref.kind(), ref.id(), ref.label()));
        audit.addRecalled(payload.recalled());
        String result = payload.factsBlock() + payload.memoriesBlock() + payload.graphBlock();
        return result.isBlank() ? ToolText.NO_DATA : result;
    }

    @Tool(name = "get_conversation_history", description = "A JELENLEGI beszélgetés tárolt üzeneteinek "
            + "lapozható olvasása, régi eszközadatokkal, időbélyeggel. page=0 a legújabb oldal "
            + "(alapértelmezés); nagyobb page régebbi, messageOffset=0 az üzenetszöveg eleje. "
            + "Használd, amikor egy korábbi részlet kiesett az előzményből vagy a szöveg levágott. "
            + "A válasz jelzi a további oldalt és szöveget; másik beszélgetést nem ér el.")
    public String conversationHistory(
            @ToolParam(required = false, description = "Oldalszám 0-tól; nagyobb = régebbi") Integer page,
            @ToolParam(required = false, description = "Karaktereltolás a hosszú üzenetekben, alapértelmezés 0") Integer messageOffset,
            ToolContext ctx) {
        UUID user = ToolContexts.userId(ctx);
        UUID conversation = (UUID)ctx.getContext().get(CONVERSATION_ID);
        if (conversation == null || conversations.findByIdAndCreatedByAndDeletedFalse(conversation, user).isEmpty()) {
            return ToolText.NO_DATA;
        }
        int index = page == null ? 0 : Math.max(0, page);
        int offset = messageOffset == null ? 0 : Math.max(0, messageOffset);
        if (index > Integer.MAX_VALUE / properties.historyPageSize()) {
            return "Az oldalszám túl nagy.";
        }
        var rows = messages.findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtDesc(
                conversation, user, PageRequest.of(index, properties.historyPageSize()));
        StringBuilder result = new StringBuilder("Beszélgetési előzmény; page=" + index + "\n");
        // Leave room for timestamps, roles and continuation instructions inside the tool's
        // result budget; every message on a page remains reachable via messageOffset.
        int messageCap = Math.min(properties.historyMessageMaxChars(),
                Math.max(100, (properties.resultMaxChars() - 500) / properties.historyPageSize() - 150));
        for (var row : rows.reversed()) {
            String text = historyRenderer.render(row);
            String rest = text.substring(Math.min(offset, text.length()));
            result.append(row.getCreatedAt()).append(' ').append(row.getRole()).append(": ")
                    .append(ConversationHistory.clip(rest, messageCap)).append('\n');
            if (rest.length() > messageCap) {
                result.append("Folytatás: messageOffset=").append((long)offset + messageCap
                        - ConversationHistory.CLIPPED.length()).append('\n');
            }
        }
        return result.append(rows.size() < properties.historyPageSize() ? "Nincs régebbi oldal."
                : "Régebbi oldal: page=" + (index + 1)).toString();
    }
}
