package io.mrkuhne.mezo.feature.recipe;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig;
import static org.assertj.core.api.Assertions.assertThat;

import com.github.tomakehurst.wiremock.WireMockServer;
import io.mrkuhne.mezo.api.dto.RecipeImportResponse;
import io.mrkuhne.mezo.api.dto.RecipeImportTextRequest;
import io.mrkuhne.mezo.api.dto.RecipeImportUrlRequest;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;

/**
 * Import on, companion off: no AI bean. Text and photo answer a clean 503; a URL still works when the
 * page carries its own structured recipe (no AI needed) and answers 503 only when it would need one.
 */
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class RecipeImportLlmUnavailableApiIT extends ApiIntegrationTest {

    static final WireMockServer SITE = new WireMockServer(wireMockConfig().dynamicPort());

    @DynamicPropertySource
    static void siteProps(DynamicPropertyRegistry registry) {
        SITE.start();
        registry.add("mezo.pantry-scrape.allow-private-hosts", () -> "true");
    }

    @AfterAll
    static void stop() {
        SITE.stop();
    }

    @Test
    void textIs503WithoutTheAi() {
        RecipeImportTextRequest req = new RecipeImportTextRequest();
        req.setText("Gulyás");
        ResponseEntity<String> resp = exchangeForResponse(HttpMethod.POST, "/api/recipe/import/text", req, ownerAuthHeaders());
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertHasRequestError(resp.getBody(), "RECIPE_IMPORT_LLM_UNAVAILABLE");
    }

    @Test
    void urlWithAStructuredRecipeNeedsNoAi_andAPlainPageIs503() {
        SITE.stubFor(get(urlPathEqualTo("/s")).willReturn(aResponse().withHeader("Content-Type", "text/html").withBody(
            "<script type=\"application/ld+json\">{\"@type\":\"Recipe\",\"name\":\"Leves\","
                + "\"recipeIngredient\":[\"1 db répa\"]}</script>")));
        SITE.stubFor(get(urlPathEqualTo("/p")).willReturn(aResponse().withHeader("Content-Type", "text/html")
            .withBody("<html><body>semmi</body></html>")));

        RecipeImportUrlRequest ok = new RecipeImportUrlRequest();
        ok.setUrl(SITE.baseUrl() + "/s");
        RecipeImportResponse body = postForBody("/api/recipe/import/url", ok, ownerAuthHeaders(), HttpStatus.OK, RecipeImportResponse.class);
        assertThat(body.getResult().getName()).isEqualTo("Leves");

        RecipeImportUrlRequest plain = new RecipeImportUrlRequest();
        plain.setUrl(SITE.baseUrl() + "/p");
        ResponseEntity<String> resp = exchangeForResponse(HttpMethod.POST, "/api/recipe/import/url", plain, ownerAuthHeaders());
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertHasRequestError(resp.getBody(), "RECIPE_IMPORT_LLM_UNAVAILABLE");
    }
}
