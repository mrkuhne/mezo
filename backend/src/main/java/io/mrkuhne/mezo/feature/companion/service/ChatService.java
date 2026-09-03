package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.CharacterPromptSource;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.CompanionLlm.Role;
import io.mrkuhne.mezo.feature.companion.CompanionLlm.Turn;
import io.mrkuhne.mezo.feature.companion.advisor.AdvisedAnswer;
import io.mrkuhne.mezo.feature.companion.advisor.CompanionAdvisorChain;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.RecalledMemoriesEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.ToolCallsEnvelope;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphPromptAssembler;
import io.mrkuhne.mezo.feature.companion.mapper.CompanionMapper;
import io.mrkuhne.mezo.feature.companion.profile.service.ProfilePromptAssembler;
import io.mrkuhne.mezo.feature.companion.repository.AiConversationRepository;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.companion.tools.CompanionToolRegistry;
import io.mrkuhne.mezo.feature.companion.tools.ToolCallAudit;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class ChatService {

    /**
     * Static Hungarian companion voice — IDENT-1 (companion, not coach), the clinical guard and
     * grounding-lite from the design spec §6. V0.3 appends the context snapshot below; V1.1 adds
     * the knowledge facts. Ends with the {@code [Eszköz-útmutató]} question-type→tool routing hint
     * (mezo-xixu) — keep it in sync with the {@code @Tool} descriptions per
     * {@code docs/references/companion_tool_conventions.md}. Also carries a tool-call timing rule
     * (mezo-280): the routing hint says WHICH tool, this says WHEN.
     *
     * <p>mezo-q71s: named blocks instead of one instruction stream, and the voice block states
     * BEHAVIOUR, not adjectives — "legyél barátságos" is inert on the cheap tier, "listát csak
     * akkor, ha…" is not. {@code [Mit szabad állítani]} encodes the marked-speculation policy
     * (see the ADR): a hunch is allowed if it is linguistically marked; an invented number is not,
     * marked or otherwise. The advisor's {@code unmarkedClaim} check is the enforcement half —
     * keep the two in sync.
     */
    static final String SYSTEM_PROMPT = """
            [Ki vagy]
            Te vagy a mezo, Daniel személyes egészség- és teljesítmény-társa.
            Együtt dolgoztok: többes szám első személy („nézzük meg", „ezt visszük ma") — társ vagy, nem edző.
            Megfigyelsz és javasolsz, sosem osztályozol és sosem moralizálsz.

            [Hogyan beszélsz]
            Beszélgetsz, nem jelentést írsz. Élő mondatokban válaszolj; listát csak akkor használj, \
            ha Daniel listát kért, vagy ha négynél több egyenrangú tétel van.
            A válasz hossza kövesse a kérdést: egy konkrét tényre egy-két mondat, egy nyitott vagy \
            elgondolkodtató kérdésre valódi bekezdés. Ne told fel, de ne is csonkold le.
            Van véleményed. Ha feltűnik valami az adatban, mondd ki, hogy feltűnt, és hogy szerinted mit jelent.
            Ha a válasz után tényleg érdekel valami, kérdezz vissza — de csak valódi kérdést; \
            udvariassági záró kérdést soha ne tegyél fel.
            Építs arra, ami már elhangzott a beszélgetésben; ne kezdd újra minden körben.

            [Mit szabad állítani]
            Sejtésed, hipotézised lehet, és ki is mondhatod — de jelöld meg nyelvileg: \
            „tippelek", „erős a gyanúm", „lehet, hogy", „ezt csak sejtem".
            Konkrét számot, dátumot vagy múltbeli adatot viszont CSAK akkor mondj, ha a kontextusból, \
            egy eszközhívásból vagy Daniel üzenetéből származik. Adatot kitalálni akkor is tilos, ha megjelölöd.
            Ha valamit nem tudsz, mondd ki őszintén, hogy nem tudod.
            Az [Emberek] sorai Daniel emberi köre: ha egy nevet említ, onnan tudod, ki ő (kapcsolat) \
            és hogyan áll most (e heti említés, hangulat-irány). Ennyit mondhatsz róluk, mást nem: \
            harmadik félről eseményt, tulajdonságot, véleményt nem találsz ki. Magadtól ne hozd szóba \
            őket — csak ha Daniel említi, vagy a téma egyértelműen róluk szól.

            [Példa a hangnemre]
            Kérdés: „hogy állok a súllyal?"
            ROSSZ: „Aktuális: 88,4 kg. 7 napos trend: -0,6 kg. Cél: 85 kg."
            JÓ: „88,4 — a héten fél kilót lement, ami pont a tervezett ütem. Ami engem jobban érdekel: \
            múlt héten megállt, most meg simán viszi tovább. Tippelem, hogy az alvás a különbség, \
            de ezt tényleg csak sejtem.”
            (A példában minden szám a kontextusból jött volna — a formát másold, ne a számokat.)

            [Tiltás]
            Gyógyszer adagolására vonatkozó változtatást SOHA ne javasolj — az orvosi döntés.

            [Két mód]
            A beszélgetésednek két módja van:
            - **Adatkérés:** amikor Daniel az adataira kíváncsi (edzés, étkezés, súly, alvás, protokoll, \
            gyógyszer, cél, XP, szokás, edzésterv, PR) — EKKOR használd a tool-okat. Tool nélkül ne \
            találgass. Ha tool kell, hívd meg ELŐBB, és csak a megkapott adatból válaszolj.
            - **Szabad beszélgetés:** amikor Daniel kifejezetten kéri az általános tudásodat (pl. "nézd \
            meg az általános tudásodból", "ne az adatokból"), vagy olyan kérdésről van szó, ami nem az \
            ő adataira vonatkozik (pl. gyakorlatkivitelezés, technika, általános egészség) — EKKOR \
            válaszolj az általános tudásodból, mintha sima LLM társ lennél. Nem kell tool, nem kell \
            adat. Ez a normál viselkedés, nem hiba.
            Ha nem egyértelmű, hogy melyikről van szó: a kérdés kontextusából ítélj. Ha Daniel személyes \
            teljesítményére vagy állapotára kérdez → adatkérés. Ha általános információt kér → szabad \
            beszélgetés.

            [Eszközhasználat]
            Múltbeli vagy összesítő kérdéshez (edzések, étkezés, súly, alvás, protokoll, gyógyszerciklus) \
            használd a kapott tool-okat — a pillanatkép csak a mai napot mutatja; tool nélkül ne találgass.
            Ha tool kell a válaszhoz, ELŐBB hívd meg, és csak a megkapott adatból válaszolj — ne írd \
            le előre, hogy „megnézem" vagy „megpróbálom", és ne ígérj utólagos utánanézést.
            Válaszolj magyarul.

            [Eszköz-útmutató] — kérdéstípus → tool (ne találgass, hívd meg a megfelelőt):
            - PR / rekord / „megdöntöm?" → get_exercise_records
            - mai/holnapi/heti edzésterv, mezociklus → get_training_plan
            - múltbeli edzés/sport/futás → get_training_log
            - súlytrend, fogyás ÜTEME (simított) → get_weight_trend
            - napi súlyok, egy-egy nap súlya, INGADOZÁS/kilengés → get_weight_log
            - alvás, alvási cél, közérzet (energia/stressz) → get_recovery
            - konkrét nap alvási adata / fázisai / hypnogram → get_recovery (date vagy from/to)
            - gyógyszer, gyógyszer-ciklus → get_medication
            - recept, mit főzzek → get_recipes | mi van a kamrában → get_pantry
            - napi/heti étkezés, makró, víz → get_fuel_log
            - supplement, protokoll → get_protocol
            - cél, kalóriacél, heti ütem → get_goal
            - XP, szint, skill, streak → get_growth | napi rutin, küldetés, szokás → get_daily_practice
            - minták, „mit vettél észre rólam" → get_insights (csak megerősített minták; predikció/kísérlet még nem elérhető)
            - hasonló korábbi nap → find_similar_past_days
            - két időszak összevetése (negyedév/hónap) → compare_periods""";

    /**
     * mezo-q71s: a persona a prompt TETEJÉN áll, alatta a futásidejű adatblokkok (pillanatkép,
     * tények, felismerések). Ez a két sor a recency-ellensúly — az utolsó dolog, amit a modell a
     * saját válasza előtt olvas.
     */
    public static final String TONE_REMINDER = """

            [Emlékeztető] Ez beszélgetés Daniellel, nem adatlekérdezés. \
            A fenti adatblokk nyersanyag, nem a válasz formája.""";

    /**
     * mezo-p2tr — anchored conversations: the server-generated opening turn's user content. Never
     * persisted as a user message (the {@link #openingTurn} javadoc); the fixed Hungarian text asks
     * Mezo to open on the anchored day/week from the {@code [Heti adatok]} block already in the
     * system prompt.
     */
    static final String KICKOFF_PROMPT =
            "Nyisd meg a beszélgetést te: rövid, 3-5 mondatos reflexió a [Heti adatok] blokk kiemelt "
                    + "napjáról (ha van kijelölt nap) vagy a hétről — mi tűnt fel, mi az egy dolog, "
                    + "amiről érdemes beszélni. Kérdéssel zárj.";

    private final AiConversationRepository conversationRepository;
    private final AiMessageRepository messageRepository;
    private final ConversationService conversationService;
    private final ContextSnapshotAssembler contextSnapshotAssembler;
    private final KnowledgeFactService knowledgeFactService;
    /** W3.1 — the always-on [Emlékek] block (mezo-b3pp.12). */
    private final PromptMemoryAssembler promptMemoryAssembler;
    /** W2.4 — the [Összefüggések] block (mezo-b3pp.9); absent (null) when the graph switch is off. */
    private final ObjectProvider<GraphPromptAssembler> graphPromptAssembler;
    /** W4.3 — the [Rólad tanultam] block (mezo-b3pp.17); absent (null) when the graph switch is off. */
    private final ObjectProvider<ProfilePromptAssembler> profilePromptAssembler;
    /** mezo-1gim.8 — the [Karakter] dossier block; absent (null) unless CHARACTER_SWITCH + COMPANION_SWITCH are both on. */
    private final ObjectProvider<CharacterPromptSource> characterPromptSource;
    /** mezo-p2tr — anchored conversations' [Heti adatok] block; "" for a plain conversation. */
    private final WeekContextRenderer weekContextRenderer;
    private final CompanionLlm companionLlm;
    /** V1.3 — present only when the advisors switch is on (bean-boundary gating). */
    private final ObjectProvider<CompanionAdvisorChain> advisorChain;
    private final CompanionToolRegistry toolRegistry;
    private final CompanionProperties properties;
    private final CompanionMapper mapper;
    private final ApplicationEventPublisher eventPublisher;
    private final LlmCallContextHolder llmCallContextHolder;

    /** One prepared chat turn — everything the LLM call needs, produced inside one transaction.
     *  {@code recalledRefs} (W3.1 Memory refs followed by the W2.4 GraphNode refs) are the ambient
     *  refs the stream path adds to its audit;
     *  {@code recalled} (W3.1b) is the disclosure envelope the assistant row persists — null when
     *  the turn recalled nothing. */
    public record PreparedTurn(UUID conversationId, UUID userMessageId, String systemPrompt,
                               List<Turn> history, String userContent, List<RefsEnvelope.Ref> recalledRefs,
                               RecalledMemoriesEnvelope recalled) {}

    /**
     * First half of a STREAMED turn (own transaction when called through the proxy):
     * ownership check, prompt assembly (window BEFORE persisting the new message), persist
     * the USER row, set title-once + lastMessageAt. Splitting the turn means a later LLM
     * failure keeps the user message — honest history for the streamed path (the sync
     * {@link #sendMessage} keeps its single-transaction rollback semantics).
     */
    @Transactional
    public PreparedTurn prepareTurn(UUID userId, UUID conversationId, SendMessageRequest request) {
        AiConversationEntity conversation = conversationService.getOwned(userId, conversationId);
        LocalDate today = LocalDate.now();
        PromptMemoryAssembler.AmbientRecall recalled =
                promptMemoryAssembler.recall(userId, conversationId, request.getContent(), today);
        GraphPromptAssembler.GraphContext graph = graphContext(userId, request.getContent());
        String systemPrompt = assembleSystemPrompt(userId, today, recalled.block(), graph.block(),
                conversation.getContextKind(), conversation.getContextDate());
        List<Turn> history = toTurns(loadWindow(userId, conversationId));
        AiMessageEntity userRow = persistMessage(
                conversation, userId, AiMessageEntity.ROLE_USER, request.getContent(), null, null, false, null);
        touchConversation(conversation, request.getContent());
        return new PreparedTurn(conversationId, userRow.getId(), systemPrompt, history, request.getContent(),
                ambientRefs(recalled, graph), RecalledMemoriesEnvelope.ofOrNull(recalled.items()));
    }

    /**
     * Second half of a STREAMED turn (own transaction): persist the ASSISTANT row with the turn's
     * tool audit (V0.5) + bump lastMessageAt. Publishes {@link ChatTurnCompleted} for the V1.2
     * post-turn extraction (fires AFTER this transaction commits).
     */
    @Transactional
    public MessageResponse completeTurn(
            UUID userId, UUID conversationId, UUID userMessageId, String userContent,
            String answer, ToolCallAudit audit, boolean degraded, RecalledMemoriesEnvelope recalled) {
        AiConversationEntity conversation = conversationService.getOwned(userId, conversationId);
        AiMessageEntity assistant = persistMessage(conversation, userId, AiMessageEntity.ROLE_ASSISTANT,
                answer, audit.toToolCallsEnvelope(), audit.toRefsEnvelope(), degraded, recalled);
        conversation.setLastMessageAt(Instant.now());
        conversationRepository.save(conversation);
        eventPublisher.publishEvent(new ChatTurnCompleted(userId, userMessageId, userContent,
                assistant.getId(), answer));
        return mapper.toMessageResponse(assistant);
    }

    @Transactional
    public MessageResponse sendMessage(UUID userId, UUID conversationId, SendMessageRequest request) {
        AiConversationEntity conversation = conversationService.getOwned(userId, conversationId);

        // Prompt order: see assembleSystemPrompt. The history travels as real prior messages
        // (mezo-q71s), not a transcript inside the system prompt.
        LocalDate today = LocalDate.now();
        PromptMemoryAssembler.AmbientRecall recalled =
                promptMemoryAssembler.recall(userId, conversationId, request.getContent(), today);
        GraphPromptAssembler.GraphContext graph = graphContext(userId, request.getContent());
        String systemPrompt = assembleSystemPrompt(userId, today, recalled.block(), graph.block(),
                conversation.getContextKind(), conversation.getContextDate());
        // Window BEFORE persisting the new message — the current content travels as the user param.
        List<Turn> history = toTurns(loadWindow(userId, conversationId));

        AiMessageEntity userRow = persistMessage(
                conversation, userId, AiMessageEntity.ROLE_USER, request.getContent(), null, null, false, null);
        // V0.5: tools registered on the turn; the audit lands in the assistant row's envelopes
        ToolCallAudit audit = toolRegistry.newTurnAudit();
        String answer;
        boolean degraded = false;
        // mezo-2zyu: the whole turn runs under the chat context — the advisor chain's own calls
        // rebind their own (companion_advisor) context, so only the primary round is billed here.
        LlmCallContext turnContext =
                new LlmCallContext("companion_chat", "send", "conversation", conversationId);
        CompanionAdvisorChain chain = advisorChain.getIfAvailable();
        if (chain != null) {
            // V1.3: the advisor chain owns the LLM round(s) — retry-once, degraded on 2nd failure
            AdvisedAnswer advised = llmCallContextHolder.runWith(turnContext,
                    () -> chain.complete(systemPrompt, history, request.getContent(),
                            toolRegistry.callbacks(audit), toolRegistry.toolContext(userId, audit), audit));
            answer = advised.answer();
            degraded = advised.degraded();
        } else {
            answer = llmCallContextHolder.runWith(turnContext,
                    () -> companionLlm.complete(systemPrompt, history, request.getContent(),
                            toolRegistry.callbacks(audit), toolRegistry.toolContext(userId, audit)));
        }
        // mezo-8z79: same guard as the streamed path — a blank answer is a failed turn. Here the
        // whole method is ONE transaction, so throwing also rolls the user row back; the FE's
        // catch-and-refetch then leaves the thread exactly as it was before the send.
        if (answer == null || answer.isBlank()) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error(ChatStreamService.EMPTY_ANSWER_CODE).build());
        }
        // W3.1/W2.4: ambient refs (Memory, then GraphNode) join the audit AFTER the LLM round — tool
        // refs are the answer's own provenance and win the per-turn ref cap.
        ambientRefs(recalled, graph).forEach(ref -> audit.addRef(ref.kind(), ref.id(), ref.label()));
        // W3.1b: the answer also DISCLOSES what it was given — the same items, on the row
        AiMessageEntity assistant = persistMessage(conversation, userId, AiMessageEntity.ROLE_ASSISTANT,
                answer, audit.toToolCallsEnvelope(), audit.toRefsEnvelope(), degraded,
                RecalledMemoriesEnvelope.ofOrNull(recalled.items()));

        touchConversation(conversation, request.getContent());
        // V1.2: post-turn extraction trigger — the async listener runs AFTER this turn commits
        eventPublisher.publishEvent(new ChatTurnCompleted(userId, userRow.getId(), request.getContent(),
                assistant.getId(), answer));
        return mapper.toMessageResponse(assistant);
    }

    /**
     * mezo-p2tr — anchored conversations: the server-generated opening turn. Called by {@link
     * ConversationService#create} AFTER the conversation row is saved, only when a context was
     * given. Assembles the SAME anchored system prompt every turn gets, then calls the LLM with
     * empty history, no tools, and {@link #KICKOFF_PROMPT} as the user content — persisting ONLY
     * the assistant row (the kickoff itself is never written as a user message, so it never shows
     * up in the transcript or the history window). Swallow-and-log on ANY failure: the conversation
     * simply stays empty, exactly as a plain {@code createConversation()} call would leave it.
     */
    @Transactional
    public void openingTurn(UUID userId, UUID conversationId) {
        try {
            AiConversationEntity conversation = conversationService.getOwned(userId, conversationId);
            String systemPrompt = assembleSystemPrompt(userId, LocalDate.now(), "", "",
                    conversation.getContextKind(), conversation.getContextDate());
            String answer = companionLlm.complete(
                    systemPrompt, List.of(), KICKOFF_PROMPT, List.of(), Map.of());
            if (answer == null || answer.isBlank()) {
                log.warn("Opening turn for conversation {} produced no text — conversation stays empty",
                        conversationId);
                return;
            }
            persistMessage(conversation, userId, AiMessageEntity.ROLE_ASSISTANT, answer, null, null, false, null);
            conversation.setLastMessageAt(Instant.now());
            conversationRepository.save(conversation);
        } catch (RuntimeException e) {
            log.warn("Opening turn failed for conversation {} — conversation stays empty", conversationId, e);
        }
    }

    /**
     * The canonical system prompt: voice → snapshot (V0.3) → [Heti adatok] anchored-conversation
     * block (mezo-p2tr, "" for a plain conversation) → top-N facts (V1.1) → fresh pattern-facts
     * acknowledgment (V3.3) → [Karakter] dossier block (mezo-1gim.8, "" unless both the character
     * and companion switches are on) → [Rólad tanultam] pragmatic profile (W4.3, "" when the
     * profile is archived/absent) → [Emlékek] ambient recall (W3.1) → [Összefüggések] graph
     * context (W2.4, "" when the graph switch is off or nothing matched) → TONE_REMINDER
     * (mezo-q71s, always last). The history travels as real prior messages, not a transcript here.
     */
    private String assembleSystemPrompt(UUID userId, LocalDate today, String memoriesBlock, String graphBlock,
            String contextKind, LocalDate contextDate) {
        return SYSTEM_PROMPT
                + contextSnapshotAssembler.render(userId, today)
                + anchoredBlock(userId, contextKind, contextDate)
                + knowledgeFactService.renderPromptBlock(userId)
                + knowledgeFactService.renderNewPatternFactsBlock(userId)
                + characterBlock(userId)
                + profileBlock(userId)
                + memoriesBlock
                + graphBlock
                + TONE_REMINDER;
    }

    /** mezo-p2tr: "" for a plain conversation (no anchor); the [Heti adatok] block otherwise. */
    private String anchoredBlock(UUID userId, String contextKind, LocalDate contextDate) {
        return contextKind == null ? "" : weekContextRenderer.render(userId, contextKind, contextDate);
    }

    /** W2.4: the graph's contribution — EMPTY when the switch is off (no bean) or nothing matched. */
    private GraphPromptAssembler.GraphContext graphContext(UUID userId, String userMessage) {
        GraphPromptAssembler assembler = graphPromptAssembler.getIfAvailable();
        return assembler == null ? GraphPromptAssembler.GraphContext.EMPTY : assembler.assemble(userId, userMessage);
    }

    /** W4.3: the profile's contribution — "" when the bean is absent or nothing is stored. */
    private String profileBlock(UUID userId) {
        ProfilePromptAssembler assembler = profilePromptAssembler.getIfAvailable();
        return assembler == null ? "" : assembler.render(userId);
    }

    /** mezo-1gim.8: the [Karakter] dossier's contribution — "" when the bean is absent (either
     *  switch off) or the dossier has nothing worth injecting. */
    private String characterBlock(UUID userId) {
        CharacterPromptSource source = characterPromptSource.getIfAvailable();
        return source == null ? "" : source.render(userId);
    }

    /** Memory refs first (W3.1), GraphNode refs after (W2.4) — one list so the stream path stays unchanged. */
    private static List<RefsEnvelope.Ref> ambientRefs(PromptMemoryAssembler.AmbientRecall recalled,
                                                      GraphPromptAssembler.GraphContext graph) {
        if (graph.refs().isEmpty()) {
            return recalled.refs();
        }
        List<RefsEnvelope.Ref> refs = new ArrayList<>(recalled.refs());
        refs.addAll(graph.refs());
        return List.copyOf(refs);
    }

    private List<AiMessageEntity> loadWindow(UUID userId, UUID conversationId) {
        return messageRepository
                .findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtDesc(
                        conversationId, userId, PageRequest.of(0, properties.chat().historyWindow()))
                .reversed();
    }

    /**
     * Az ablak entitásai -> a port provider-független Turn-jei, legrégebbitől a legújabbig.
     *
     * <p>mezo-8z79: üres tartalmú sorok KIMARADNAK. A blank-guard óta ilyen sor már nem keletkezik,
     * de a 2026-08-23 előtt bekerültek ott vannak az adatbázisban — és egy üres {@code
     * AssistantMessage} part-ot a Gemini elutasíthat, ami visszamenőleg megmérgezné az egész szálat.
     * A szűrés ezért nem a guard duplikálása, hanem a MÁR meglévő sorok elleni védelem.
     */
    private static List<Turn> toTurns(List<AiMessageEntity> window) {
        return window.stream()
                .filter(message -> message.getContent() != null && !message.getContent().isBlank())
                .map(message -> new Turn(
                        AiMessageEntity.ROLE_USER.equals(message.getRole()) ? Role.USER : Role.ASSISTANT,
                        message.getContent()))
                .toList();
    }

    private AiMessageEntity persistMessage(AiConversationEntity conversation, UUID userId, String role,
            String content, ToolCallsEnvelope toolCalls, RefsEnvelope refs, boolean degraded,
            RecalledMemoriesEnvelope recalled) {
        AiMessageEntity message = new AiMessageEntity();
        message.setConversation(conversation);
        message.setCreatedBy(userId);
        message.setRole(role);
        message.setContent(content);
        message.setToolCalls(toolCalls);
        message.setRefs(refs);
        message.setRecalledMemories(recalled);
        message.setDegraded(degraded);
        // saveAndFlush so the two rows of a turn get distinct created_at (history ordering key)
        return messageRepository.saveAndFlush(message);
    }

    private void touchConversation(AiConversationEntity conversation, String userContent) {
        conversation.setLastMessageAt(Instant.now());
        if (conversation.getTitle() == null) {
            int max = properties.chat().titleMaxChars();
            conversation.setTitle(
                    userContent.length() <= max ? userContent : userContent.substring(0, max));
        }
        conversationRepository.save(conversation);
    }
}
