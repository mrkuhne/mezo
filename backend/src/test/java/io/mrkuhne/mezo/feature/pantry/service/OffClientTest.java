package io.mrkuhne.mezo.feature.pantry.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.mrkuhne.mezo.feature.nutrition.service.AllergenKeys;
import io.mrkuhne.mezo.feature.nutrition.service.AllergenState;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** The OFF wire shape -> {@link AllergenState} mapping (spec §7.1, §7.3). */
class OffClientTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    private static OffClient.OffProduct parse(String productJson) throws Exception {
        return JSON.readValue(productJson, OffClient.OffProductResponse.class).product();
    }

    @Test
    void parsesAllergensAndTraces() throws Exception {
        OffClient.OffProduct p = parse("""
            {"status":1,"product":{"code":"5900512300108","product_name":"Müzli",
             "allergens_tags":["en:milk"],"traces_tags":["en:nuts"],
             "serving_size":"40 g","serving_quantity":40,
             "nutriments":{"energy-kcal_100g":370}}}""");

        Map<String, AllergenState> states = p.allergenStates();

        assertThat(states.get("milk")).isEqualTo(AllergenState.CONTAINS);
        assertThat(states.get("nuts")).isEqualTo(AllergenState.TRACES);
        assertThat(states.keySet()).isEqualTo(AllergenKeys.EU14);
        assertThat(states.entrySet().stream()
            .filter(e -> !e.getKey().equals("milk") && !e.getKey().equals("nuts")))
            .allSatisfy(e -> assertThat(e.getValue()).isEqualTo(AllergenState.UNKNOWN));
        assertThat(p.servingSize()).isEqualTo("40 g");
        assertThat(p.servingQuantity()).isEqualByComparingTo("40");
    }

    @Test
    void containsBeatsTracesAndOffSpecificTagsMapOntoOurKeys() throws Exception {
        OffClient.OffProduct p = parse("""
            {"status":1,"product":{"code":"1","product_name":"X",
             "allergens_tags":["en:sesame-seeds","en:sulphur-dioxide-and-sulphites","en:gluten","en:made-up"],
             "traces_tags":["en:gluten","en:eggs"]}}""");

        Map<String, AllergenState> states = p.allergenStates();

        assertThat(states.get("sesame")).isEqualTo(AllergenState.CONTAINS);
        assertThat(states.get("sulphites")).isEqualTo(AllergenState.CONTAINS);
        assertThat(states.get("gluten")).isEqualTo(AllergenState.CONTAINS);
        assertThat(states.get("eggs")).isEqualTo(AllergenState.TRACES);
        assertThat(states).doesNotContainKey("made-up");
    }

    @Test
    void absentTagFieldsNeverReadAsFreeOf() throws Exception {
        OffClient.OffProduct p = parse("{\"status\":1,\"product\":{\"code\":\"1\",\"product_name\":\"X\"}}");

        assertThat(p.allergenStates().values()).containsOnly(AllergenState.UNKNOWN);
        assertThat(p.allergenStates().keySet()).isEqualTo(AllergenKeys.EU14);
    }
}
