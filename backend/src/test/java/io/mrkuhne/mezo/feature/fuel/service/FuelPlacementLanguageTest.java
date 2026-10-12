package io.mrkuhne.mezo.feature.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.api.dto.SlotPlanEvaluateRequest;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.techcore.message.UserMessages;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import tools.jackson.databind.json.JsonMapper;

/**
 * The Stack's "why here" sentence and the two fuel LLM prompts follow the account language
 * (mezo-n4wf5.5). Pure unit test: the LLM port is a capturing stub, the bundle is the real one.
 */
class FuelPlacementLanguageTest {

    private final List<String> sentPrompts = new ArrayList<>();

    @SuppressWarnings("unchecked")
    private static <T> ObjectProvider<T> provider(T bean) {
        ObjectProvider<T> p = mock(ObjectProvider.class);
        when(p.getIfAvailable()).thenReturn(bean);
        return p;
    }

    /** Runs the tagged body inline — the budget gate is not what this test is about. */
    @SuppressWarnings("unchecked")
    private static LlmCallContextHolder passThroughHolder() {
        LlmCallContextHolder holder = mock(LlmCallContextHolder.class);
        when(holder.runWith(any(LlmCallContext.class), any(Supplier.class)))
            .thenAnswer(inv -> ((Supplier<Object>) inv.getArgument(1)).get());
        return holder;
    }

    private PlacementEngine engine(String language, StackPlacementLlm llm) {
        return new PlacementEngine(provider(llm), JsonMapper.builder().build(), passThroughHolder(),
            UserMessages.fixed(language));
    }

    private static PantryItemEntity item(String name, String timing) {
        PantryCatalogEntity c = new PantryCatalogEntity();
        c.setName(name);
        PantryItemEntity e = new PantryItemEntity();
        e.setCatalog(c);
        e.setTiming(timing);
        return e;
    }

    @Test
    void testPlace_shouldKeepTheHungarianReasons_whenAccountIsHungarian() {
        PlacementEngine hu = engine("hu", null);

        assertThat(hu.place(item("Kreatin monohidrát", null)).reason())
            .isEqualTo("Kreatin ébredés után vízben — étkezéstől független, a napi konzisztencia számít.");
        assertThat(hu.place(item("Omega-3", null)).reason())
            .isEqualTo("Zsírban oldódó — zsíros étkezéssel 3–4× jobb a felszívódás.");
        assertThat(hu.place(item("Valami por", "midday")).reason())
            .isEqualTo("A Kamra-item ajánlott időzítése alapján.");
        assertThat(hu.place(item("Ismeretlen", null)).reason())
            .isEqualTo("Bizonytalan besorolás — helyezd át, ha máskor szeded.");
        assertThat(hu.dailyTotalHint("Kreatin"))
            .isEqualTo("ajánlott napi összmennyiség 15–20g — érdemes 3-4 bevételre osztani");
    }

    @Test
    void testPlace_shouldWriteEnglishReasons_whenAccountIsEnglish() {
        PlacementEngine en = engine("en", null);

        PlacementEngine.Placement creatine = en.place(item("Kreatin monohidrát", null));
        assertThat(creatine.slotKey()).isEqualTo("wake"); // the zone never depends on the language
        assertThat(creatine.reason()).isEqualTo(
            "Creatine in water after waking. It does not depend on meals; taking it every day is what counts.");
        assertThat(en.place(item("Valami por", "midday")).reason())
            .isEqualTo("Based on the timing suggested for this pantry item.");
        assertThat(en.place(item("Ismeretlen", null)).reason())
            .isEqualTo("Not sure about this one. Move it if you take it at another time.");
        assertThat(en.dailyTotalHint("Kreatin")).isEqualTo("suggested daily total 15–20 g, best split into 3–4 doses");
        assertThat(en.dailyTotalHint("Omega-3")).isNull();
    }

    @Test
    void testEveryRule_shouldHaveItsSentenceInBothBundles() {
        UserMessages hu = UserMessages.fixed("hu");
        UserMessages en = UserMessages.fixed("en");
        for (PlacementRules.Rule rule : PlacementRules.RULES) {
            // a missing key would be rendered as the key itself
            assertThat(hu.text(rule.reasonKey())).isNotEqualTo(rule.reasonKey());
            assertThat(en.text(rule.reasonKey())).isNotEqualTo(rule.reasonKey()).isNotEqualTo(hu.text(rule.reasonKey()));
            if (rule.dailyTotalHintKey() != null) {
                assertThat(en.text(rule.dailyTotalHintKey())).isNotEqualTo(rule.dailyTotalHintKey());
            }
        }
    }

    @Test
    void testPlacementPrompt_shouldNotDemandHungarian_whenAccountIsEnglish() {
        StackPlacementLlm llm = (system, user) -> {
            sentPrompts.add(system);
            return "{\"slotKey\":\"evening\",\"reasonHu\":\"Fits the evening.\"}";
        };

        PlacementEngine.Placement en = engine("en", llm).place(item("Ismeretlen", null));
        PlacementEngine.Placement hu = engine("hu", llm).place(item("Ismeretlen", null));

        assertThat(en.source()).isEqualTo("llm");
        assertThat(en.reason()).isEqualTo("Fits the evening."); // the JSON key stays reasonHu
        assertThat(hu.source()).isEqualTo("llm");
        assertThat(sentPrompts.get(0)).startsWith(PlacementEngine.SYSTEM_PROMPT_MARKER)
            .doesNotContainIgnoringCase("hungarian").contains("\"reasonHu\"");
        assertThat(sentPrompts.get(1)).contains("one short Hungarian sentence"); // Hungarian: untouched
    }

    @Test
    void testSlotPlanPrompt_shouldNotDemandHungarian_whenAccountIsEnglish() {
        SlotPlanLlm llm = (system, user) -> {
            sentPrompts.add(system);
            return "{\"verdict\":\"ok\",\"summary\":\"Fine.\",\"suggestions\":[]}";
        };
        SlotPlanEvaluateRequest request = new SlotPlanEvaluateRequest();

        new SlotPlanEvaluationService(provider(llm), JsonMapper.builder().build(), passThroughHolder(),
            UserMessages.fixed("en")).evaluate(request);
        new SlotPlanEvaluationService(provider(llm), JsonMapper.builder().build(), passThroughHolder(),
            UserMessages.fixed("hu")).evaluate(request);

        assertThat(sentPrompts.get(0)).startsWith(SlotPlanEvaluationService.SYSTEM_PROMPT_MARKER)
            .doesNotContainIgnoringCase("magyar")
            .contains("\"verdict\":\"ok\"|\"adjust\""); // the JSON contract is intact
        assertThat(sentPrompts.get(1)).isSameAs(SlotPlanEvaluationService.SYSTEM_PROMPT);
        // exactly the four language demands were taken out, nothing else moved
        assertThat(SlotPlanEvaluationService.SYSTEM_PROMPT.length() - sentPrompts.get(0).length())
            .isEqualTo(", magyarul".length() + 2 * " magyarul".length() + "magyar ".length());
    }
}
