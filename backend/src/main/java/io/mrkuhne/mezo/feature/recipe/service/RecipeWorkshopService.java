package io.mrkuhne.mezo.feature.recipe.service;

import io.mrkuhne.mezo.api.dto.WorkshopChatMessage;
import io.mrkuhne.mezo.api.dto.WorkshopDraft;
import io.mrkuhne.mezo.api.dto.WorkshopTurnRequest;
import io.mrkuhne.mezo.api.dto.WorkshopTurnResponse;
import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.feature.recipe.config.RecipeWorkshopProperties;
import io.mrkuhne.mezo.feature.recipe.service.RecipeWorkshopValidator.RawDraft;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * Stateless Receptműhely AI turn (mezo-92pb): the client sends the chat history + current draft,
 * ONE cheap-tier LLM call answers with prose + a FULL updated draft (the manual edits arrive in
 * the input draft, so returning full state preserves them — the FE renders the diff). The draft
 * is sanitized deterministically ({@link RecipeWorkshopValidator}); nothing is persisted here —
 * saving goes through the existing recipe CRUD.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.RECIPE_WORKSHOP_SWITCH, havingValue = "true")
public class RecipeWorkshopService {

    private static final Map<String, String> GOAL_DIRECTIVES = Map.of(
            "high_protein", "Cél: HIGH PROTEIN — maximalizáld az adagonkénti fehérjét, a kcal maradjon hasonló.",
            "pre_workout", "Cél: PRE-WORKOUT — gyors szénhidrát hangsúly, alacsony zsír, könnyen emészthető.",
            "post_workout", "Cél: POST-WORKOUT — fehérje + gyors szénhidrát a regenerációhoz.",
            "before_bed", "Cél: LEFEKVÉS ELŐTT — lassú fehérje (kazein), alacsony szénhidrát, könnyű étel.",
            "breakfast", "Cél: REGGELI — könnyű indítás, magas fehérje, reggelihez illő alapanyagok.");

    private final ObjectProvider<RecipeWorkshopLlm> llm;
    private final PantryItemRepository pantryItemRepository;
    private final RecipeWorkshopProperties props;
    private final RecipeWorkshopValidator validator;
    private final ObjectMapper objectMapper;
    private final LlmCallContextHolder llmCallContextHolder;

    record LlmAnswer(String reply, RawDraft draft) {
    }

    public RecipeWorkshopLlm requireAvailable() {
        RecipeWorkshopLlm port = llm.getIfAvailable();
        if (port == null) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("RECIPE_WORKSHOP_LLM_UNAVAILABLE").build(), HttpStatus.SERVICE_UNAVAILABLE);
        }
        return port;
    }

    @Transactional(readOnly = true)
    public WorkshopTurnResponse turn(UUID userId, WorkshopTurnRequest req) {
        RecipeWorkshopLlm port = requireAvailable();

        String systemPrompt = buildSystemPrompt(userId, req.getGoal());
        String userMessage = buildUserMessage(req);

        String answer = llmCallContextHolder.runWith(
                new LlmCallContext("recipe_workshop", "turn", null, null),
                () -> port.complete(systemPrompt, userMessage));

        LlmAnswer parsed = parse(answer);
        WorkshopDraft draft = validator.sanitize(parsed.draft(),
                id -> pantryItemRepository.findByIdAndCreatedByAndDeletedFalse(id, userId));

        WorkshopTurnResponse res = new WorkshopTurnResponse();
        res.setReply(parsed.reply() == null || parsed.reply().isBlank()
                ? "Frissítettem a vázlatot." : parsed.reply());
        res.setDraft(draft);
        return res;
    }

    private String buildSystemPrompt(UUID userId, String goal) {
        StringBuilder sb = new StringBuilder("""
            Te a Receptműhely vagy: magyar nyelvű, iteratív recept-tervező társ.
            Válaszolj EGYETLEN JSON objektummal, pontosan ezekkel a kulcsokkal:
            {"reply":string,"draft":{"name":string,"category":"breakfast"|"lunch"|"dinner"|"snack",
             "servings":number,"steps":[string],
             "lines":[{"pantryItemId":string|null,"name":string,"amount":number,"unit":string,
                       "kcal":number|null,"proteinG":number|null,"carbsG":number|null,"fatG":number|null}]}}
            Szabályok:
            - MINDIG a TELJES frissített vázlatot add vissza. A felhasználó által kézzel állított
              sorokhoz és értékekhez NE nyúlj, csak ha kifejezetten kéri.
            - Ha egy hozzávaló egyértelműen megvan a lenti KAMRA katalógusban, másold be az id-ját
              a pantryItemId-be és hagyd null-on a makrókat (a rendszer számolja). SOHA ne találj ki id-t.
            - Kamrán kívüli hozzávalónál pantryItemId=null és add meg a becsült kcal/proteinG/carbsG/fatG
              értékeket a MEGADOTT mennyiségre.
            - amount grammban (g), ahol értelmes; a mennyiségek az EGÉSZ receptre vonatkoznak.
            - reply: rövid magyar indoklás, mit és miért változtattál (makró-hatással).
            """);
        if (goal != null && GOAL_DIRECTIVES.containsKey(goal)) {
            sb.append('\n').append(GOAL_DIRECTIVES.get(goal)).append('\n');
        }
        sb.append("\nKAMRA KATALÓGUS (id | név | márka | alap):\n");
        for (PantryItemEntity p : pantryItemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(userId)) {
            sb.append(p.getId()).append(" | ").append(p.getName()).append(" | ")
              .append(p.getBrand() == null ? "-" : p.getBrand()).append(" | ")
              .append(p.getServingAmount() == null ? "100" : p.getServingAmount())
              .append(' ').append(p.getServingUnit() == null ? "g" : p.getServingUnit()).append('\n');
        }
        return sb.toString();
    }

    private String buildUserMessage(WorkshopTurnRequest req) {
        StringBuilder sb = new StringBuilder();
        List<WorkshopChatMessage> history = req.getHistory() == null ? List.of() : req.getHistory();
        int from = Math.max(0, history.size() - props.maxHistoryTurns());
        if (from < history.size()) {
            sb.append("KORÁBBI BESZÉLGETÉS:\n");
            for (WorkshopChatMessage m : history.subList(from, history.size())) {
                sb.append("user".equals(m.getRole()) ? PromptPersona.USER_TURN_LABEL : "Műhely: ").append(m.getText()).append('\n');
            }
        }
        if (req.getDraft() != null) {
            sb.append("\nAKTUÁLIS VÁZLAT (JSON):\n").append(toJson(req.getDraft())).append('\n');
        }
        sb.append("\nMOSTANI ÜZENET:\n").append(req.getMessage());
        return sb.toString();
    }

    private String toJson(WorkshopDraft draft) {
        try {
            return objectMapper.writeValueAsString(draft);
        } catch (Exception e) {
            log.warn("Workshop draft serialization failed", e);
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("RECIPE_WORKSHOP_DRAFT_SERIALIZE_FAILED").build(),
                    HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    private LlmAnswer parse(String answer) {
        try {
            String json = answer.substring(answer.indexOf('{'), answer.lastIndexOf('}') + 1);
            return objectMapper.readValue(json, LlmAnswer.class);
        } catch (Exception e) {
            log.warn("Workshop turn unparseable: {}", answer, e);
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("RECIPE_WORKSHOP_EXTRACT_FAILED").build(), HttpStatus.BAD_GATEWAY);
        }
    }
}
