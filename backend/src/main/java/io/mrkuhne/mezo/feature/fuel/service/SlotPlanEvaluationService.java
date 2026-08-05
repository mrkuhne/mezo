package io.mrkuhne.mezo.feature.fuel.service;

import io.mrkuhne.mezo.api.dto.ResolvedSlotTime;
import io.mrkuhne.mezo.api.dto.SlotPlanBlock;
import io.mrkuhne.mezo.api.dto.SlotPlanBudget;
import io.mrkuhne.mezo.api.dto.SlotPlanEvaluateRequest;
import io.mrkuhne.mezo.api.dto.SlotPlanEvaluateResponse;
import io.mrkuhne.mezo.api.dto.SlotPlanSuggestion;
import io.mrkuhne.mezo.api.dto.SlotTemplateSlot;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

/**
 * Gated "judge my split" evaluate call over a (draft) meal-slot template (mezo-7102): ONE cheap-tier
 * {@link SlotPlanLlm} call judging the slot split against the goal balance + training placement.
 * Stateless — nothing is persisted, the request/response IS the wire contract, no domain mapping.
 *
 * <p>{@link SlotPlanLlm} is the fuel-owned port; the companion feature provides the adapter, so
 * fuel never imports {@code feature.companion} (ADR 0012; the ArchUnit slice-cycle check stays
 * closed). The port is reached through {@link ObjectProvider} because the slot-template-ai switch
 * is independent of the companion switch: with either off there is no adapter bean, so a call
 * degrades to a clean 503 ({@link #requireAvailable()}) rather than a 500.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SlotPlanEvaluationService {

    /** First word of the system prompt — FakeCompanionLlm mirrors it (literal, no import back). */
    public static final String SYSTEM_PROMPT_MARKER = "SLOT-TERV-ERTEKELES";

    static final String SYSTEM_PROMPT = SYSTEM_PROMPT_MARKER + """
        : Egy étkezési slot-terv (napi étkezési blokkok) elosztását ítéled meg.
        Válaszolj KIZÁRÓLAG egyetlen szigorú JSON objektummal, magyarul, pontosan ezekkel a kulcsokkal:
        {"verdict":"ok"|"adjust","summary":"<egy-két mondat magyarul>",
         "suggestions":[{"slotLabel":"<opcionális, egy konkrét slot neve>","text":"<javaslat magyarul>"}]}
        Szabályok:
        - "ok", ha a slotok kalória/makró-elosztása illeszkedik a napi célhoz és az edzés körüli
          időzítéshez (pre/post workout slotok a megfelelő oldalon vannak, arányuk ésszerű).
        - "adjust", ha bármelyik slot budget-aránya vagy időzítése rontja az edzés körüli ellátást
          vagy a napi cél teljesülését.
        - A summary egy-két mondatos, tömör magyar értékelés.
        - A suggestions tömb üres is lehet (jellemzően "ok" esetén); minden eleme egy konkrét,
          végrehajtható javaslat egy adott slotra vagy általánosságban.
        - Ne találj ki új slotokat, időpontokat vagy számokat a bemeneten kívül.
        """;

    private final ObjectProvider<SlotPlanLlm> llm;
    private final ObjectMapper objectMapper;
    private final LlmCallContextHolder llmCallContextHolder;

    /** Returns the LLM port, or fails with a clean 503 when either gating switch is off (no adapter bean). */
    public SlotPlanLlm requireAvailable() {
        SlotPlanLlm port = llm.getIfAvailable();
        if (port == null) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("FUEL_SLOT_TEMPLATE_LLM_UNAVAILABLE").build(), HttpStatus.SERVICE_UNAVAILABLE);
        }
        return port;
    }

    public SlotPlanEvaluateResponse evaluate(SlotPlanEvaluateRequest request) {
        SlotPlanLlm port = requireAvailable();
        String userMessage = buildUserMessage(request);
        try {
            String raw = llmCallContextHolder.runWith(
                new LlmCallContext("slot_template", "evaluate", null, null),
                () -> port.complete(SYSTEM_PROMPT, userMessage));
            String json = raw.substring(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
            SlotPlanEvaluateResponse response = objectMapper.readValue(json, SlotPlanEvaluateResponse.class);
            // Strict-JSON contract: a null/blank verdict or summary is a parse failure, not a valid
            // "empty" answer — degrade the same way as an unparseable payload (the sibling
            // MealAiDraftService/MealCoachService/RecipeBreakdownProseService idiom using SystemRuntimeErrorException).
            if (response.getVerdict() == null || response.getSummary() == null || response.getSummary().isBlank()) {
                throw new SystemRuntimeErrorException(
                    SystemMessage.error("FUEL_SLOT_TEMPLATE_LLM_UNAVAILABLE").build(), HttpStatus.SERVICE_UNAVAILABLE);
            }
            response.setSuggestions(normalizeSuggestions(response.getSuggestions()));
            return response;
        } catch (SystemRuntimeErrorException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Slot-plan evaluation failed: {}", e.getMessage(), e);
            throw new SystemRuntimeErrorException(
                SystemMessage.error("FUEL_SLOT_TEMPLATE_LLM_UNAVAILABLE").build(), HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    /** Null/omitted -> empty (never null on the wire, contract says `required: [suggestions]`);
     *  a malformed entry with no text is dropped, mirroring improve()/fitsFor() in the sibling
     *  LLM-parsing services (MealCoachService, RecipeBreakdownProseService). */
    private static List<SlotPlanSuggestion> normalizeSuggestions(List<SlotPlanSuggestion> raw) {
        return raw == null ? List.of() : raw.stream()
            .filter(s -> s != null && s.getText() != null && !s.getText().isBlank())
            .toList();
    }

    /** Compact plain-text serialization (not JSON — keeps sentinel planting/matching in ITs simple). */
    private String buildUserMessage(SlotPlanEvaluateRequest request) {
        Map<String, String> timeByLabel = request.getResolvedTimes() == null ? Map.of()
            : request.getResolvedTimes().stream()
                .collect(Collectors.toMap(ResolvedSlotTime::getLabel, ResolvedSlotTime::getTime, (a, b) -> a));

        StringBuilder sb = new StringBuilder();
        sb.append("Nap típusa: ").append(request.getDayType()).append('\n');
        sb.append("Slotok:\n");
        List<SlotTemplateSlot> slots = request.getSlots();
        if (slots != null) {
            for (SlotTemplateSlot slot : slots) {
                String time = timeByLabel.get(slot.getLabel());
                sb.append("- ").append(slot.getLabel())
                    .append(" [szerep=").append(slot.getRole())
                    .append(", típus=").append(slot.getSlotKind())
                    .append(", arány=").append(slot.getBudgetPct()).append('%');
                if (time != null) {
                    sb.append(", idő=").append(time);
                }
                sb.append("]\n");
            }
        }
        if (request.getResolvedTimes() != null && !request.getResolvedTimes().isEmpty()) {
            sb.append("Feloldott idők:\n");
            for (ResolvedSlotTime resolvedTime : request.getResolvedTimes()) {
                sb.append("- ").append(resolvedTime.getLabel()).append(": ").append(resolvedTime.getTime()).append('\n');
            }
        }
        SlotPlanBudget budget = request.getBudget();
        if (budget != null) {
            sb.append("Napi cél: kcal=").append(budget.getKcal())
                .append(" fehérje=").append(budget.getP())
                .append("g szénhidrát=").append(budget.getC())
                .append("g zsír=").append(budget.getF()).append("g\n");
        }
        sb.append("Edzés körüli egyensúly-kcal cél: ").append(request.getBalanceKcal()).append('\n');
        List<SlotPlanBlock> blocks = request.getBlocks();
        if (blocks != null && !blocks.isEmpty()) {
            sb.append("Napi blokkok:\n");
            for (SlotPlanBlock block : blocks) {
                sb.append("- ").append(block.getKind()).append(" @ ").append(block.getTime());
                if (block.getDurationMin() != null) {
                    sb.append(" (").append(block.getDurationMin()).append(" perc)");
                }
                sb.append('\n');
            }
        }
        return sb.toString();
    }
}
