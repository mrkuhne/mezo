package io.mrkuhne.mezo.feature.pantry.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.mrkuhne.mezo.feature.nutrition.service.AllergenKeys;
import io.mrkuhne.mezo.feature.nutrition.service.AllergenState;
import io.mrkuhne.mezo.feature.pantry.config.PantryImportProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.http.client.ClientHttpRequestFactoryBuilder;
import org.springframework.boot.http.client.HttpClientSettings;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestClientException;

/**
 * The project's first outbound HTTP client: a thin OpenFoodFacts adapter (Fuel P6, mezo-bka).
 * Deterministic REST, not AI — OFF ships {@code nova_group}, so NOVA arrives as a passthrough.
 * Failures map to {@code PANTRY_IMPORT_LOOKUP_FAILED} (502); an unknown barcode is an empty
 * result, not an error.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.PANTRY_IMPORT_SWITCH, havingValue = "true")
public class OffClient {

    /** Nutriment fields requested from OFF — keeps payloads small and the mapping explicit. */
    private static final String FIELDS = "code,product_name,brands,nova_group,nutriments,"
        + "allergens_tags,traces_tags,serving_size,serving_quantity";

    private final RestClient rest;
    private final PantryImportProperties props;

    public OffClient(RestClient.Builder builder, PantryImportProperties props) {
        this.props = props;
        HttpClientSettings settings = HttpClientSettings.defaults()
            .withTimeouts(Duration.ofMillis(props.timeoutMs()), Duration.ofMillis(props.timeoutMs()));
        this.rest = builder
            .baseUrl(props.baseUrl())
            .defaultHeader(HttpHeaders.USER_AGENT, props.userAgent())
            .requestFactory(ClientHttpRequestFactoryBuilder.detect().build(settings))
            .build();
    }

    /** Free-text search via the stable v1 search endpoint. */
    public List<OffProduct> search(String query) {
        try {
            OffSearchResponse response = rest.get()
                .uri(uri -> uri.path("/cgi/search.pl")
                    .queryParam("search_terms", query)
                    .queryParam("search_simple", 1)
                    .queryParam("action", "process")
                    .queryParam("json", 1)
                    .queryParam("page_size", props.searchPageSize())
                    .queryParam("fields", FIELDS)
                    .build())
                .retrieve()
                .body(OffSearchResponse.class);
            return response == null || response.products() == null ? List.of() : response.products();
        } catch (RestClientException ex) {
            throw lookupFailed(ex);
        }
    }

    /** Barcode fetch via the v2 product endpoint; unknown barcode (404 / status 0) -> empty. */
    public List<OffProduct> byBarcode(String barcode) {
        try {
            OffProductResponse response = rest.get()
                .uri(uri -> uri.path("/api/v2/product/{code}")
                    .queryParam("fields", FIELDS)
                    .build(barcode))
                .retrieve()
                .body(OffProductResponse.class);
            return response == null || response.status() != 1 || response.product() == null
                ? List.of() : List.of(response.product());
        } catch (RestClientResponseException ex) {
            if (ex.getStatusCode().value() == 404) return List.of();
            throw lookupFailed(ex);
        } catch (RestClientException ex) {
            throw lookupFailed(ex);
        }
    }

    private SystemRuntimeErrorException lookupFailed(RestClientException cause) {
        log.warn("OpenFoodFacts lookup failed: {}", cause.getMessage());
        return new SystemRuntimeErrorException(
            SystemMessage.error("PANTRY_IMPORT_LOOKUP_FAILED").build(), HttpStatus.BAD_GATEWAY);
    }

    // --- OFF wire shapes (only the fields we consume) ---

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record OffSearchResponse(List<OffProduct> products) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record OffProductResponse(int status, OffProduct product) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record OffProduct(
        String code,
        @JsonProperty("product_name") String productName,
        String brands,
        @JsonProperty("nova_group") Integer novaGroup,
        OffNutriments nutriments,
        @JsonProperty("allergens_tags") List<String> allergensTags,
        @JsonProperty("traces_tags") List<String> tracesTags,
        @JsonProperty("serving_size") String servingSize,
        @JsonProperty("serving_quantity") BigDecimal servingQuantity) {

        /**
         * All EU-14 keys: CONTAINS from {@code allergens_tags}, TRACES from {@code traces_tags}
         * (CONTAINS wins), everything else UNKNOWN. OFF omitting a tag is not evidence the product
         * is free of it, so an absent key is never mapped to "free".
         */
        public Map<String, AllergenState> allergenStates() {
            Map<String, AllergenState> states = new LinkedHashMap<>();
            AllergenKeys.EU14.stream().sorted().forEach(k -> states.put(k, AllergenState.UNKNOWN));
            mark(states, tracesTags, AllergenState.TRACES);
            mark(states, allergensTags, AllergenState.CONTAINS);
            return states;
        }

        private static void mark(Map<String, AllergenState> states, List<String> tags, AllergenState state) {
            if (tags == null) return;
            for (String tag : tags) {
                String key = tag == null ? null : OFF_TAG_TO_KEY.get(tag.strip().toLowerCase(java.util.Locale.ROOT));
                if (key != null) states.put(key, state);
            }
        }
    }

    /** OFF taxonomy tags -> our EU-14 keys; tags outside the EU-14 are ignored. */
    private static final Map<String, String> OFF_TAG_TO_KEY = Map.ofEntries(
        Map.entry("en:gluten", "gluten"),
        Map.entry("en:crustaceans", "crustaceans"),
        Map.entry("en:eggs", "eggs"),
        Map.entry("en:fish", "fish"),
        Map.entry("en:peanuts", "peanuts"),
        Map.entry("en:soybeans", "soybeans"),
        Map.entry("en:milk", "milk"),
        Map.entry("en:nuts", "nuts"),
        Map.entry("en:celery", "celery"),
        Map.entry("en:mustard", "mustard"),
        Map.entry("en:sesame-seeds", "sesame"),
        Map.entry("en:sulphur-dioxide-and-sulphites", "sulphites"),
        Map.entry("en:lupin", "lupin"),
        Map.entry("en:molluscs", "molluscs"));

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record OffNutriments(
        @JsonProperty("energy-kcal_100g") BigDecimal kcal100g,
        @JsonProperty("proteins_100g") BigDecimal proteins100g,
        @JsonProperty("carbohydrates_100g") BigDecimal carbohydrates100g,
        @JsonProperty("fat_100g") BigDecimal fat100g,
        @JsonProperty("fiber_100g") BigDecimal fiber100g,
        @JsonProperty("sugars_100g") BigDecimal sugars100g,
        @JsonProperty("salt_100g") BigDecimal salt100g,
        @JsonProperty("saturated-fat_100g") BigDecimal saturatedFat100g) {
    }
}
