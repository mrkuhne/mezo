package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
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
import io.mrkuhne.mezo.feature.companion.entity.ToolOutcomesEnvelope;
import io.mrkuhne.mezo.feature.companion.mapper.CompanionMapper;
import io.mrkuhne.mezo.feature.companion.memory.service.ChatMemoryContextAdapter;
import io.mrkuhne.mezo.feature.companion.memory.service.ChatMemoryContextAdapter.ChatMemoryPayload;
import io.mrkuhne.mezo.feature.companion.profile.service.ProfilePromptAssembler;
import io.mrkuhne.mezo.feature.companion.reflection.service.ReflectionPromptBlock;
import io.mrkuhne.mezo.feature.companion.reflection.service.ReflectionReplyRecorder;
import io.mrkuhne.mezo.feature.companion.repository.AiConversationRepository;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.companion.tools.CompanionToolRegistry;
import io.mrkuhne.mezo.feature.companion.tools.RecordingToolCallback;
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
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Consumer;

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
            Te vagy a mezo, {{NÉV}} személyes egészség- és teljesítmény-társa.
            Együtt dolgoztok: többes szám első személy („nézzük meg", „ezt visszük ma") — társ vagy, nem edző.
            Megfigyelsz és javasolsz, sosem osztályozol és sosem moralizálsz.

            [Hogyan beszélsz]
            Beszélgetsz, nem jelentést írsz. Élő mondatokban válaszolj; listát csak akkor használj, \
            ha {{NÉV}} listát kért, vagy ha négynél több egyenrangú tétel van.
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
            egy eszközhívásból vagy {{NÉV}} üzenetéből származik. Adatot kitalálni akkor is tilos, ha megjelölöd.
            Ha valamit nem tudsz, mondd ki őszintén, hogy nem tudod.
            Az [Emberek] sorai {{NÉV}} emberi köre: ha egy nevet említ, onnan tudod, ki ő (kapcsolat) \
            és hogyan áll most (e heti említés, hangulat-irány). Ennyit mondhatsz róluk, mást nem: \
            harmadik félről eseményt, tulajdonságot, véleményt nem találsz ki. Magadtól ne hozd szóba \
            őket — csak ha {{NÉV}} említi, vagy a téma egyértelműen róluk szól.
            A [Célok] blokk {{NÉV}} életcéljainak háttér-állása a személyre szabáshoz. Emlékeztetőt \
            a ha–akkor tervekről külön értesítés visz — te ne ismételd; a célokat akkor hozd szóba, \
            ha {{NÉV}} üzenete relevánssá teszi őket.

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
            - **Adatkérés:** amikor {{NÉV}} az adataira kíváncsi (edzés, étkezés, súly, alvás, protokoll, \
            gyógyszer, cél, XP, szokás, edzésterv, PR) — EKKOR használd a tool-okat. Tool nélkül ne \
            találgass. Ha tool kell, hívd meg ELŐBB, és csak a megkapott adatból válaszolj.
            - **Szabad beszélgetés:** amikor {{NÉV}} kifejezetten kéri az általános tudásodat (pl. "nézd \
            meg az általános tudásodból", "ne az adatokból"), vagy olyan kérdésről van szó, ami nem az \
            ő adataira vonatkozik (pl. gyakorlatkivitelezés, technika, általános egészség) — EKKOR \
            válaszolj az általános tudásodból, mintha sima LLM társ lennél. Nem kell tool, nem kell \
            adat. Ez a normál viselkedés, nem hiba.
            Ha nem egyértelmű, hogy melyikről van szó: a kérdés kontextusából ítélj. Ha {{NÉV}} személyes \
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
            - számszerű cél: súlycél, kalóriacél, heti ütem → get_goal
            - életcél, életterület (PERMAH), pillér, ha–akkor terv → get_life_goals
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

            [Emlékeztető] Ez beszélgetés a társaddal ({{NÉV}}), nem adatlekérdezés. \
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
    /** Shared OLD/SHADOW/NEW boundary used identically by synchronous and streamed turns. */
    private final ChatMemoryContextAdapter chatMemoryContextAdapter;
    /** W4.3 — the [Rólad tanultam] block (mezo-b3pp.17); absent (null) when the graph switch is off. */
    private final ObjectProvider<ProfilePromptAssembler> profilePromptAssembler;
    /** mezo-1gim.8 — the [Karakter] dossier block; absent (null) unless CHARACTER_SWITCH + COMPANION_SWITCH are both on. */
    private final ObjectProvider<CharacterPromptSource> characterPromptSource;
    /** mezo-p2tr — anchored conversations' [Heti adatok] block; "" for a plain conversation. */
    private final WeekContextRenderer weekContextRenderer;
    /** mezo-eq85.3 — the [Észrevételek] block; absent (null) unless Reflexió is on. */
    private final ObjectProvider<ReflectionPromptBlock> reflectionPromptBlock;
    /** mezo-eq85.3 — a seeded thread's turns become user_reply evidence; absent unless Reflexió is on. */
    private final ObjectProvider<ReflectionReplyRecorder> reflectionReplyRecorder;
    private final CompanionLlm companionLlm;
    /** V1.3 — present only when the advisors switch is on (bean-boundary gating). */
    private final ObjectProvider<CompanionAdvisorChain> advisorChain;
    private final CompanionToolRegistry toolRegistry;
    private final CompanionProperties properties;
    private final CompanionMapper mapper;
    private final ApplicationEventPublisher eventPublisher;
    private final LlmCallContextHolder llmCallContextHolder;
    private final PromptPersona promptPersona;
    /** spec 2026-09-16 — decides how much thinking a turn earns before any context is assembled. */
    private final TurnGearRouter turnGearRouter;
    /** mezo-rj214.7 — the LIVE pipeline: what to fetch (spec §6.2), never called blind (§6.3/§6.4). */
    private final TurnPlanner turnPlanner;
    private final PlanExecutor planExecutor;
    private final TurnAnswerer turnAnswerer;
    /** fix round 1 finding 2 — serializes a dropped plan step's args for its synthetic outcome. */
    private final ObjectMapper objectMapper;

    /** One prepared chat turn — everything the LLM call needs, produced inside one transaction.
     *  {@code recalledRefs} (W3.1 Memory refs followed by the W2.4 GraphNode refs) are the ambient
     *  refs the stream path adds to its audit;
     *  {@code recalled} (W3.1b) is the disclosure envelope the assistant row persists — null when
     *  the turn recalled nothing;
     *  {@code today} (Task 6 fix round 1 finding M2) is the SAME {@link LocalDate#now()} this
     *  transaction already resolved for context assembly — {@link ChatStreamService}'s pre-stream
     *  pipeline lap reads it instead of calling {@code LocalDate.now()} a second time, milliseconds
     *  later, which could skew the plan's "Ma:" context by a day across an exact-midnight turn. */
    public record PreparedTurn(UUID conversationId, UUID userMessageId, String systemPrompt,
                               String turnContext, List<Turn> history, String userContent,
                               List<RefsEnvelope.Ref> recalledRefs, RecalledMemoriesEnvelope recalled,
                               TurnGear gear, LocalDate today) {}

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
        List<Turn> history = toTurns(loadWindow(userId, conversationId));
        RoutedContext routed = routeAndAssemble(userId, conversation, request.getContent(), history, today);
        AiMessageEntity userRow = persistMessage(conversation, userId, AiMessageEntity.ROLE_USER,
                request.getContent(), null, null, null, false, null);
        recordSeedReply(userId, conversation, request.getContent());
        touchConversation(conversation, request.getContent());
        return new PreparedTurn(conversationId, userRow.getId(), routed.systemPrompt(),
                routed.turnContext(), history, request.getContent(),
                routed.memory().refs(), routed.memory().recalled(), routed.gear(), today);
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
        // mezo-rj214.7 S9.7 Task 4: the SYNC path (sendMessage) wires provenance below; the
        // streamed path's tool_outcomes wiring is a later task — null here keeps completeTurn's
        // persisted shape unchanged until that task lands.
        AiMessageEntity assistant = persistMessage(conversation, userId, AiMessageEntity.ROLE_ASSISTANT,
                answer, audit.toToolCallsEnvelope(), null, audit.toRefsEnvelope(), degraded, recalled);
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
        // Window BEFORE persisting the new message — the current content travels as the user param.
        List<Turn> history = toTurns(loadWindow(userId, conversationId));
        RoutedContext routed = routeAndAssemble(userId, conversation, request.getContent(), history, today);
        TurnGear gear = routed.gear();
        ChatMemoryPayload memory = routed.memory();
        String systemPrompt = routed.systemPrompt();
        String turnCtx = routed.turnContext();

        AiMessageEntity userRow = persistMessage(conversation, userId, AiMessageEntity.ROLE_USER,
                request.getContent(), null, null, null, false, null);
        recordSeedReply(userId, conversation, request.getContent());
        // V0.5: tools registered on the turn; the audit lands in the assistant row's envelopes
        ToolCallAudit audit = toolRegistry.newTurnAudit();
        String answer;
        boolean degraded = false;
        // S9.7 Task 4: non-null only on the PIPELINE branch below — the plan-truth outcome list
        // (lap 1, or lap1+replan merged) that produced `answer`. Stays null on every other branch
        // (CHAT, and the legacy tool-loop fallback), where provenance is built from the audit's
        // ran-truth list instead — see the persistMessage call at the bottom of this method.
        List<ToolCallAudit.ToolOutcome> pipelineOutcomes = null;
        // mezo-2zyu: the whole turn runs under the chat context — the advisor chain's own calls
        // rebind their own (companion_advisor) context, so only the primary round is billed here.
        LlmCallContext turnContext =
                new LlmCallContext("companion_chat", "send", "conversation", conversationId);
        CompanionAdvisorChain chain = advisorChain.getIfAvailable();
        if (gear == TurnGear.CHAT && chain != null) {
            // Tool-free and smart-tier (the ONLY shape in which a conversational turn can carry
            // reasoning on OpenAI Chat Completions — OpenAiCompanionLlm.optionsFor), but still
            // under the deterministic clinical check: the dose-change prohibition has no branch
            // where it does not apply, and a general question is exactly where a model volunteers
            // dosing advice. The LLM verdict is skipped — a CHAT turn has no context to grade.
            AdvisedAnswer advised = llmCallContextHolder.runWith(turnContext,
                    () -> chain.completeChat(systemPrompt, turnCtx, history, request.getContent()));
            answer = advised.answer();
            degraded = advised.degraded();
        } else if (gear == TurnGear.CHAT) {
            answer = llmCallContextHolder.runWith(turnContext,
                    () -> companionLlm.completeSmart(systemPrompt, turnCtx, history, request.getContent()));
        } else {
            // mezo-rj214.7: the LIVE pipeline (spec §5) — plan -> execute -> answer, with a replan
            // lap for ANALYSIS turns that hit a data gap. A null pipelined answer means the planner
            // produced nothing usable, and the turn falls straight to the UNCHANGED legacy branches
            // below (spec §8: degraded, but an answer) — the fallback the whole migration leans on.
            PipelineAnswer pipelined = properties.turn().pipelineEnabled()
                    ? pipelineAnswerGuarded(userId, conversationId, gear, systemPrompt, turnCtx,
                            history, request.getContent(), today, audit, turnContext)
                    : null;
            if (pipelined != null) {
                answer = pipelined.answer();
                pipelineOutcomes = pipelined.outcomes();
                if (chain != null) {
                    String pipelinedAnswer = pipelined.answer();
                    AdvisedAnswer advised = llmCallContextHolder.runWith(turnContext,
                            () -> chain.reviewChat(routed.systemPrompt(), routed.turnContext(), history,
                                    request.getContent(), pipelinedAnswer));
                    answer = advised.answer();
                    degraded = advised.degraded();
                }
            } else if (chain != null) {
                // V1.3: the advisor chain owns the LLM round(s) — retry-once, degraded on 2nd failure
                AdvisedAnswer advised = llmCallContextHolder.runWith(turnContext,
                        () -> chain.complete(systemPrompt, turnCtx, history, request.getContent(),
                                toolRegistry.callbacks(audit), toolRegistry.toolContext(userId, audit), audit));
                answer = advised.answer();
                degraded = advised.degraded();
            } else {
                answer = llmCallContextHolder.runWith(turnContext,
                        () -> companionLlm.complete(systemPrompt, turnCtx, history, request.getContent(),
                                toolRegistry.callbacks(audit), toolRegistry.toolContext(userId, audit)));
            }
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
        memory.refs().forEach(ref -> audit.addRef(ref.kind(), ref.id(), ref.label()));
        // S9.7 Task 4: ONE choke point for both provenance halves, never mixing the two truths in
        // one row — the PIPELINE branch's plan-truth outcomes (lap 1, or lap1+replan merged) when
        // present, otherwise the LEGACY tool-loop's ran-truth list. This REPLACES the previous bare
        // audit.toToolCallsEnvelope() argument; TurnProvenance reproduces the same ask shape for a
        // legacy turn (type "read", same name, same compact args, why null — pinned in
        // ChatServiceIT's scripted-tool test) and additionally now persists tool_outcomes, which a
        // legacy turn never wrote before this task.
        TurnProvenance.Built provenance = TurnProvenance.build(
                pipelineOutcomes != null ? pipelineOutcomes : audit.toolOutcomes(),
                properties.turn().provenance());
        // W3.1b: the answer also DISCLOSES what it was given — the same items, on the row
        AiMessageEntity assistant = persistMessage(conversation, userId, AiMessageEntity.ROLE_ASSISTANT,
                answer, provenance.ask(), provenance.result(), audit.toRefsEnvelope(), degraded,
                memory.recalled());

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
            String systemPrompt = stableSystemPrompt(userId);
            String turnCtx = turnContext(userId, LocalDate.now(),
                    knowledgeFactService.renderPromptBlock(userId), "", "",
                    conversation.getContextKind(), conversation.getContextDate());
            // mezo-ozri.8: tagged like every other LLM entry point. Without this the turn books as
            // feature='unknown' in the cost reports AND — since mezo-ozri.6 — it is the one chat
            // call that never passes the per-user budget gate, which lives inside runWith. A
            // refusal there throws, and the catch below swallows it: an out-of-budget account
            // simply gets a silent, empty conversation instead of a 429 on a turn it never asked for.
            String answer = llmCallContextHolder.runWith(
                    new LlmCallContext("companion_chat", "opening_turn", "conversation", conversationId),
                    () -> companionLlm.complete(
                            systemPrompt, turnCtx, List.of(), KICKOFF_PROMPT, List.of(), Map.of()));
            if (answer == null || answer.isBlank()) {
                log.warn("Opening turn for conversation {} produced no text — conversation stays empty",
                        conversationId);
                return;
            }
            persistMessage(conversation, userId, AiMessageEntity.ROLE_ASSISTANT,
                    answer, null, null, null, false, null);
            conversation.setLastMessageAt(Instant.now());
            conversationRepository.save(conversation);
        } catch (RuntimeException e) {
            log.warn("Opening turn failed for conversation {} — conversation stays empty", conversationId, e);
        }
    }

    /**
     * The canonical prompt order, unchanged since mezo-q71s but now delivered in TWO halves
     * (mezo-ozri.5): voice [stable] → snapshot (V0.3) → [Heti adatok] anchored-conversation block
     * (mezo-p2tr, "" for a plain conversation) → top-N facts (V1.1) → fresh pattern-facts
     * acknowledgment (V3.3) → [Karakter] dossier block (mezo-1gim.8, "" unless both the character
     * and companion switches are on) → [Rólad tanultam] pragmatic profile (W4.3, "" when the
     * profile is archived/absent) → [Emlékek] ambient recall (W3.1) → [Összefüggések] graph
     * context (W2.4, "" when the graph switch is off or nothing matched) → TONE_REMINDER
     * (mezo-q71s, always last). The history travels as real prior messages, not a transcript here.
     *
     * <p>This method returns the STABLE half only — the voice, and nothing that changes between
     * turns. It is what the provider caches: it sits in front of the 46 tool schemas in the request
     * the adapter builds, so anything volatile placed here would invalidate the tool definitions'
     * cache entry on every single turn and re-bill them at the full input rate.
     */
    private String stableSystemPrompt(UUID userId) {
        return promptPersona.render(userId, SYSTEM_PROMPT);
    }

    /**
     * Everything one turn's gear decides, decided once: the gear itself, whatever retrieval it
     * earned, and the two prompt halves that follow from both.
     *
     * @param memory {@link ChatMemoryPayload#empty()} on a CHAT turn — nothing was resolved
     * @param turnContext the VOLATILE half: lightened on CHAT, the full snapshot otherwise
     */
    private record RoutedContext(TurnGear gear, ChatMemoryPayload memory, String systemPrompt,
                                 String turnContext) {}

    /**
     * Route the turn, then assemble exactly the context that gear earns (spec 2026-09-16 §6.5).
     *
     * <p>The single place both turn paths share (mezo-rj214.7). {@code sendMessage} and
     * {@code prepareTurn} carried a byte-identical copy of this branch, held together only by a
     * comment on each site asking the next reader not to let them drift — which is not a mechanism.
     * A drift here is invisible in testing: the two paths would simply answer the same question
     * with different context, and both would still pass.
     *
     * <p>A CHAT turn skips {@code chatMemoryContextAdapter.resolve(..)} entirely: it triggers an
     * embedding call and a graph traversal that a tool-free, data-free turn has no use for.
     */
    private RoutedContext routeAndAssemble(UUID userId, AiConversationEntity conversation,
            String userContent, List<Turn> history, LocalDate today) {
        TurnGear gear = turnGearRouter.route(userContent);
        ChatMemoryPayload memory = gear == TurnGear.CHAT
                ? ChatMemoryPayload.empty()
                : chatMemoryContextAdapter.resolve(
                        userId, conversation.getId(), userContent, history, today);
        String turnContext = gear == TurnGear.CHAT
                ? chatGearContext(userId, today)
                : turnContext(userId, today, memory.factsBlock(),
                        memory.memoriesBlock(), memory.graphBlock(),
                        conversation.getContextKind(), conversation.getContextDate());
        return new RoutedContext(gear, memory, stableSystemPrompt(userId), turnContext);
    }

    /**
     * Sync-path twin of {@link ChatStreamService#runPipelinePreStream}: {@link #pipelineAnswer}
     * itself never throws by construction ({@link PlanExecutor} always turns a per-step failure
     * into an honest {@link ToolCallAudit.ToolOutcome} and never propagates it) — but the planner
     * and answerer calls it makes (via {@link TurnPlanner} / {@link TurnAnswerer}) hit an LLM
     * provider directly, and a provider failure (timeout, 5xx, malformed response) must not sink
     * the whole turn. Mirrors the streamed path's guard exactly: an answer via the caller's legacy
     * tool-loop fallback beats an error (spec §8's philosophy applies here too).
     */
    private PipelineAnswer pipelineAnswerGuarded(UUID userId, UUID conversationId, TurnGear gear, String systemPrompt,
            String turnCtx, List<Turn> history, String content, LocalDate today, ToolCallAudit audit,
            LlmCallContext turnContext) {
        try {
            return llmCallContextHolder.runWith(turnContext,
                    () -> pipelineAnswer(userId, conversationId, gear, systemPrompt, turnCtx,
                            history, content, today, audit, null));
        } catch (RuntimeException e) {
            log.warn("Turn pipeline failed on the sync path — falling back to the legacy tool loop", e);
            return null;
        }
    }

    /**
     * The live plan→execute→answer path (spec §5). Returns null when the planner produced no
     * usable plan — the caller falls back to the legacy tool-loop (spec §8: degraded, but an
     * answer). One turn = one audit: the plan is capped to the REMAINING budget (companion.md,
     * "Three seams") so the envelopes stay within max-calls-per-turn.
     *
     * <p>Package-private (mezo-rj214.7 S9.6, fix round 1 finding 4): {@link ChatStreamService}
     * reuses this and {@link #capToRemainingBudget} for the streamed path, the same way it already
     * reaches {@link #prepareTurn}/{@link #completeTurn}. Takes scalars rather than {@link
     * RoutedContext}: that record is {@code private} to this class, so a package-private caller in
     * another class could never have passed one in — the streamed path could not reach this method
     * at all before this signature change.
     *
     * @param onPhase mezo-rj214.7 S9.6 Task 2 — the phase-seam callback, nullable (the sync {@link
     *                #sendMessage} path passes {@code null}; {@link ChatStreamService}'s stream
     *                wiring supplies the real emitter, Task 3). Fires {@link TurnPhase#RETRIEVING}
     *                right before each lap's {@code planExecutor.execute} call and {@link
     *                TurnPhase#ANSWERING} right before each lap's {@code turnAnswerer.answer} call
     *                — never {@link TurnPhase#PLANNING}, which belongs to the caller at attempt
     *                start (see the class javadoc).
     */
    PipelineAnswer pipelineAnswer(UUID userId, UUID conversationId, TurnGear gear, String systemPrompt,
                          String turnContext, List<Turn> history, String content, LocalDate today,
                          ToolCallAudit audit, Consumer<TurnPhase> onPhase) {
        boolean replanAllowed = gear == TurnGear.ANALYSIS
                && properties.turn().replan().maxLaps() > 0;
        // Task 6 fix round 1 finding I2: lap 1 — plan -> cap -> execute -> build the volatile
        // half — used to be duplicated verbatim in ChatStreamService's LOOKUP branch. It now
        // lives ONCE, in planAndExecuteVolatile below, and both call sites share it.
        PlanLapResult lap1 = planAndExecuteVolatile(userId, conversationId, gear, turnContext,
                history, content, today, audit, replanAllowed, onPhase);
        if (lap1 == null) {
            return null;
        }
        notify(onPhase, TurnPhase.ANSWERING);
        String answer = llmCallContextHolder.runWith(
                new LlmCallContext("companion_chat", "answer", "conversation", conversationId),
                () -> turnAnswerer.answer(systemPrompt, lap1.volatileHalf(), history, content));

        Optional<String> gap = TurnAnswerer.dataGapReason(answer);
        if (gap.isEmpty() || !replanAllowed) {
            // A marker on a gear that never offered it is model noise; guardAgainstMarker strips
            // it defensively so it can never persist as an assistant message either way.
            return toPipelineAnswer(guardAgainstMarkerLogged(answer), lap1.outcomes());
        }
        String hint = content + "\n\n[KIEGÉSZÍTÉS] Az előző körből hiányzó adat: " + gap.get();
        Optional<ValidatedPlan> replanned = llmCallContextHolder.runWith(
                new LlmCallContext("companion_chat", "plan_replan", "conversation", conversationId),
                () -> turnPlanner.plan(history, hint, today));
        List<ToolCallAudit.ToolOutcome> merged = new ArrayList<>(lap1.outcomes());
        if (replanned.isPresent()) {
            CappedPlan secondCapped = capToRemainingBudget(replanned.get(), audit);
            // mirrors the other RETRIEVING gate in planAndExecuteVolatile — keep both in sync
            // (empty plans must not narrate retrieval)
            if (!secondCapped.plan().isEmpty()) {
                notify(onPhase, TurnPhase.RETRIEVING);
            }
            merged.addAll(planExecutor.execute(secondCapped.plan(), userId, audit));
            merged.addAll(secondCapped.dropped());
        }
        String lapTwoVolatile = turnAnswerer.buildReplanVolatile(turnContext, merged);
        notify(onPhase, TurnPhase.ANSWERING);
        String lapTwoAnswer = llmCallContextHolder.runWith(
                new LlmCallContext("companion_chat", "answer_replan", "conversation", conversationId),
                () -> turnAnswerer.answer(systemPrompt, lapTwoVolatile, history, content));
        // S9.7 Task 4: `merged` — lap 1 AND the replan lap, in that order — is the FINAL plan-truth
        // list a replanned turn persists. Threaded out via PipelineAnswer rather than an
        // out-parameter (task 4 brief) since it used to die right here once this method returned.
        return toPipelineAnswer(guardAgainstMarkerLogged(lapTwoAnswer), merged);
    }

    /** Null-propagating wrapper (fix round 1's marker guard can still veto the whole turn here,
     *  same as before PipelineAnswer existed): a null answer means "no pipeline answer at all",
     *  never a {@link PipelineAnswer} with a null {@code answer()}. */
    private static PipelineAnswer toPipelineAnswer(String answer, List<ToolCallAudit.ToolOutcome> outcomes) {
        return answer == null ? null : new PipelineAnswer(answer, outcomes);
    }

    /**
     * {@link #pipelineAnswer}'s result: the answer text AND the plan-truth outcome list that
     * produced it (S9.7 Task 4) — lap 1's list on the no-replan exit, the lap1+replan {@code
     * merged} list on the replan exit. {@code sendMessage}'s pipeline branch persists {@code
     * outcomes()} via {@link TurnProvenance#build}; {@link ChatStreamService} (the streamed twin)
     * reads only {@code answer()} today.
     */
    record PipelineAnswer(String answer, List<ToolCallAudit.ToolOutcome> outcomes) {}

    /**
     * Null-guard helper for the phase-seam callback (mezo-rj214.7 S9.6 Task 2): the sync path
     * passes {@code null} on purpose (no stream to narrate to), so every emission point goes
     * through here instead of calling {@code onPhase.accept(..)} directly.
     */
    private static void notify(Consumer<TurnPhase> onPhase, TurnPhase phase) {
        if (onPhase != null) {
            onPhase.accept(phase);
        }
    }

    /**
     * Lap 1 shared by {@link #pipelineAnswer} and the streamed LOOKUP path (Task 6 fix round 1
     * finding I2): plan -> cap to remaining budget -> execute -> build the volatile half. Package
     * private, like {@link #capToRemainingBudget}, so {@link ChatStreamService} can call it
     * directly instead of keeping its own copy of this mechanics. Returns {@code null} when the
     * planner produced no usable plan — the same "caller falls back to legacy" contract {@link
     * #pipelineAnswer} already has.
     *
     * <p>Returns the executed {@code outcomes} alongside the built volatile half — not a bare
     * {@code String} — because {@link #pipelineAnswer}'s replan lap needs lap 1's outcomes to
     * build the MERGED digest for its second answering call, and they cannot be re-derived from
     * {@code audit} afterwards: {@link #capToRemainingBudget}'s synthetic "budget exhausted"
     * outcomes for a dropped step never go through {@code audit.recordCall}, so {@code
     * audit.toolOutcomes()} would silently lose them.
     *
     * @param onPhase mezo-rj214.7 S9.6 Task 2 — nullable phase-seam callback (see {@link
     *                #pipelineAnswer}'s javadoc); fires {@link TurnPhase#RETRIEVING} once a usable
     *                plan exists, right before {@code planExecutor.execute}.
     */
    PlanLapResult planAndExecuteVolatile(UUID userId, UUID conversationId, TurnGear gear,
            String turnContext, List<Turn> history, String content, LocalDate today,
            ToolCallAudit audit, boolean replanAllowed, Consumer<TurnPhase> onPhase) {
        Optional<ValidatedPlan> planned = llmCallContextHolder.runWith(
                new LlmCallContext("companion_chat", "plan", "conversation", conversationId),
                () -> turnPlanner.plan(history, content, today));
        if (planned.isEmpty()) {
            return null;
        }
        CappedPlan capped = capToRemainingBudget(planned.get(), audit);
        // mirrors the RETRIEVING gate in the replan lap — keep both in sync (empty plans must
        // not narrate retrieval)
        if (!capped.plan().isEmpty()) {
            notify(onPhase, TurnPhase.RETRIEVING);
        }
        List<ToolCallAudit.ToolOutcome> outcomes = new ArrayList<>(
                planExecutor.execute(capped.plan(), userId, audit));
        outcomes.addAll(capped.dropped());
        String volatileHalf = turnAnswerer.buildVolatile(turnContext, outcomes, gear, replanAllowed);
        return new PlanLapResult(volatileHalf, outcomes);
    }

    /** What {@link #planAndExecuteVolatile} built for its caller: the volatile half ready to
     *  answer against, plus the outcomes that produced it (needed only by {@link #pipelineAnswer}'s
     *  replan lap — the streamed LOOKUP path reads {@code volatileHalf} alone). */
    record PlanLapResult(String volatileHalf, List<ToolCallAudit.ToolOutcome> outcomes) {}

    /**
     * Defensive backstop (fix round 1 finding 1): {@link TurnAnswerer#DATA_GAP_MARKER} must never
     * persist as an assistant message — not on the no-replan exit, not on the lap-2 exit, and not
     * on the stray-marker-on-a-gear-that-never-offered-it corner. Returns {@code null} whenever the
     * marker is present so the answer propagates as a pipeline failure and the caller's legacy
     * fallback answers fully: a full answer beats a broken one.
     *
     * <p>Package-private static, next to {@link #pipelineAnswer}, so {@link
     * ChatServiceMarkerGuardTest} can exercise it directly without a Spring context.
     */
    static String guardAgainstMarker(String answer) {
        return TurnAnswerer.dataGapReason(answer).isPresent() ? null : answer;
    }

    /**
     * {@link #pipelineAnswer}'s own wrapper around {@link #guardAgainstMarker} (minor finding 3):
     * the guard itself stays {@code static}+pure — {@link ChatServiceMarkerGuardTest} exercises it
     * without a Spring context — so the log line lives here instead, at the instance-level call
     * sites, logged exactly once per discarded leak instead of duplicated at both return statements.
     */
    private String guardAgainstMarkerLogged(String answer) {
        String guarded = guardAgainstMarker(answer);
        if (guarded == null && answer != null) {
            log.warn("Answer discarded — data-gap marker leaked outside the replan contract");
        }
        return guarded;
    }

    /**
     * Result of {@link #capToRemainingBudget}: the steps that still fit the remaining per-turn
     * budget, plus honest synthetic outcomes (fix round 1 finding 2) for whichever steps did not —
     * {@link #pipelineAnswer} appends {@code dropped} AFTER the executed outcomes, in plan order,
     * so the answerer's digest shows the drop instead of silently answering with fewer facts than
     * the plan asked for.
     *
     * <p>Package-private, not {@code private} (Task 6): a {@code private} nested type stays
     * inaccessible to a same-package caller even through {@code var} — the member itself is not
     * accessible once the declaring type is not, regardless of the member's own modifier (JLS
     * 6.6.1) — so {@link ChatStreamService}'s pre-stream LOOKUP execution could read
     * {@code capToRemainingBudget}'s return value but never call {@code plan()}/{@code dropped()}
     * on it while this stayed {@code private}.
     */
    record CappedPlan(ValidatedPlan plan, List<ToolCallAudit.ToolOutcome> dropped) {}

    /**
     * Package-private for the same reason as {@link #pipelineAnswer} (Task 6 reuse): a caller in
     * {@code ChatStreamService} can invoke this and read {@code plan()}/{@code dropped()} off the
     * result via {@code var} — {@link CappedPlan} itself is package-private too, so the type never
     * needs to be spelled out at the call site.
     */
    CappedPlan capToRemainingBudget(ValidatedPlan plan, ToolCallAudit audit) {
        int remaining = Math.max(0, properties.tools().maxCallsPerTurn() - audit.callCount());
        if (plan.steps().size() <= remaining) {
            return new CappedPlan(plan, List.of());
        }
        List<ToolCallAudit.ToolOutcome> dropped = plan.steps().stream()
                .skip(remaining)
                .map(step -> new ToolCallAudit.ToolOutcome(
                        step.tool(), argsJson(step), RecordingToolCallback.BUDGET_EXHAUSTED, step.why()))
                .toList();
        ValidatedPlan cappedPlan = new ValidatedPlan(
                List.copyOf(plan.steps().subList(0, remaining)), plan.rejections());
        return new CappedPlan(cappedPlan, dropped);
    }

    /** Best-effort JSON of a dropped step's args, for its synthetic {@link ToolCallAudit.ToolOutcome}. */
    private String argsJson(TurnPlan.PlanStep step) {
        try {
            return objectMapper.writeValueAsString(step.args());
        } catch (Exception e) {
            log.warn("Failed to serialize dropped plan step args for {}; substituting an empty object",
                    step.tool(), e);
            return "{}";
        }
    }

    /**
     * The VOLATILE half, in the order the javadoc above describes. Concatenated with NOTHING between
     * the halves: {@code stableSystemPrompt(..) + turnContext(..)} is character-for-character the
     * single string this pair replaced (mezo-ozri.5) — the audit column, the fake's prefix dispatch
     * and its {@code system=[…]} echo all depend on that identity.
     */
    private String turnContext(
            UUID userId,
            LocalDate today,
            String factsBlock,
            String memoriesBlock,
            String graphBlock,
            String contextKind,
            LocalDate contextDate) {
        return promptPersona.render(userId, contextSnapshotAssembler.render(userId, today)
                + anchoredBlock(userId, contextKind, contextDate)
                + factsBlock
                + knowledgeFactService.renderNewPatternFactsBlock(userId)
                + reflectionBlock(userId)
                + characterBlock(userId)
                + profileBlock(userId)
                + memoriesBlock
                + graphBlock
                + TONE_REMINDER);
    }

    /**
     * The volatile half for a CHAT-gear turn (spec 2026-09-16 §6.5): the voice's companion pieces
     * only. No snapshot digest, no week, no facts, no reflection, no character, no memories, no
     * graph — a turn that needs none of the user's data should not pay to carry all of it.
     */
    private String chatGearContext(UUID userId, LocalDate today) {
        return promptPersona.render(userId, "\n\nMa: " + today + "\n"
                + profileBlock(userId)
                + TONE_REMINDER);
    }

    /** mezo-p2tr: "" for a plain conversation (no anchor); the [Heti adatok] block otherwise. */
    private String anchoredBlock(UUID userId, String contextKind, LocalDate contextDate) {
        return contextKind == null ? "" : weekContextRenderer.render(userId, contextKind, contextDate);
    }

    /**
     * mezo-eq85.3: in a hypothesis-seeded thread the user's words ARE the evidence, so every user
     * turn is appended as a {@code user_reply} event. Swallow-and-log on any failure: a reflection
     * bookkeeping problem must never cost the user their chat turn.
     *
     * <p>The catch below only holds because {@code recordChatReply} runs {@code REQUIRES_NEW}
     * (see {@link ReflectionReplyRecorder}). Were it to join this turn's transaction, its throw
     * would set rollback-only and the swallowed failure would resurface as an
     * {@code UnexpectedRollbackException} at commit — the turn lost anyway.
     */
    private void recordSeedReply(UUID userId, AiConversationEntity conversation, String content) {
        if (conversation.getSeedPatternId() == null) {
            return;
        }
        ReflectionReplyRecorder recorder = reflectionReplyRecorder.getIfAvailable();
        if (recorder == null) {
            return;
        }
        try {
            recorder.recordChatReply(userId, conversation.getSeedPatternId(), content);
        } catch (RuntimeException e) {
            log.warn("Could not record the chat reply for seed pattern {} — the turn continues",
                    conversation.getSeedPatternId(), e);
        }
    }

    /** mezo-eq85.3: what Mezo is currently watching — "" when Reflexió is off or nothing is open. */
    private String reflectionBlock(UUID userId) {
        ReflectionPromptBlock block = reflectionPromptBlock.getIfAvailable();
        return block == null ? "" : block.render(userId);
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
            String content, ToolCallsEnvelope toolCalls, ToolOutcomesEnvelope toolOutcomes, RefsEnvelope refs,
            boolean degraded, RecalledMemoriesEnvelope recalled) {
        AiMessageEntity message = new AiMessageEntity();
        message.setConversation(conversation);
        message.setCreatedBy(userId);
        message.setRole(role);
        message.setContent(content);
        message.setToolCalls(toolCalls);
        message.setToolOutcomes(toolOutcomes);
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
