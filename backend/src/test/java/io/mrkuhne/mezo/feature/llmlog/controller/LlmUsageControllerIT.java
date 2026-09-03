package io.mrkuhne.mezo.feature.llmlog.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.api.dto.LlmCallListResponse;
import io.mrkuhne.mezo.api.dto.LlmUsageBreakdownResponse;
import io.mrkuhne.mezo.api.dto.LlmUsageUserGroup;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.PricingSnapshot;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * mezo-qw37.3: every /api/llm-usage read is OWNER-only (the log holds every account's prompts),
 * the breakdown carries a per-account rollup, and the list can be narrowed to one account.
 */
class LlmUsageControllerIT extends ApiIntegrationTest {

    @Autowired private LlmLogPopulator llmLogPopulator;

    @Test
    void testEveryRead_shouldReturn403_whenCallerIsUser() {
        RegisteredUser anna = registerUser("Anna");
        for (String uri : new String[] {
            "/api/llm-usage/summary",
            "/api/llm-usage/breakdown?period=DAY",
            "/api/llm-usage/calls?period=DAY",
            "/api/llm-usage/calls/" + java.util.UUID.randomUUID()}) {
            String body = getForBody(uri, anna.headers(), HttpStatus.FORBIDDEN, String.class);
            assertHasRequestError(body, "AUTH_FORBIDDEN");
        }
    }

    @Test
    void testGetBreakdown_shouldGroupByUserWithNameAndBackgroundBucket_whenMixedRows() {
        RegisteredUser anna = registerUser("Anna");
        llmLogPopulator.log(anna.id(), CallKind.CHAT, "companion_chat", "gemini-2.5-flash", 1_000, 100, snapshot(), new BigDecimal("0.010000"));
        llmLogPopulator.log(anna.id(), CallKind.CHAT, "meal_coach", "gemini-2.5-flash", 500, 50, snapshot(), new BigDecimal("0.002000"));
        llmLogPopulator.log(null, CallKind.CHAT, "proactive_briefing", "gemini-2.5-flash", 9_000, 500, snapshot(), new BigDecimal("0.030000"));

        LlmUsageBreakdownResponse body = getForBody("/api/llm-usage/breakdown?period=DAY", ownerAuthHeaders(),
            HttpStatus.OK, LlmUsageBreakdownResponse.class);

        assertThat(body.getByUser()).hasSize(2);
        // cost-descending: the background bucket (0.03) precedes Anna (0.012)
        LlmUsageUserGroup background = body.getByUser().getFirst();
        assertThat(background.getUserId()).isNull();
        assertThat(background.getName()).isNull();
        assertThat(background.getCallCount()).isEqualTo(1);
        LlmUsageUserGroup annaGroup = body.getByUser().get(1);
        assertThat(annaGroup.getUserId()).isEqualTo(anna.id());
        assertThat(annaGroup.getName()).isEqualTo("Anna");
        assertThat(annaGroup.getCallCount()).isEqualTo(2);
        assertThat(annaGroup.getTotalTokens()).isEqualTo(1_650);
        assertThat(annaGroup.getCostUsd()).isEqualTo(0.012, within(1e-9));
    }

    @Test
    void testListCalls_shouldNarrowToOneAccount_whenUserIdGiven() {
        RegisteredUser anna = registerUser("Anna");
        RegisteredUser bela = registerUser("Béla");
        llmLogPopulator.log(anna.id(), CallKind.CHAT, "companion_chat", "gemini-2.5-flash", 10, 5);
        llmLogPopulator.log(bela.id(), CallKind.CHAT, "companion_chat", "gemini-2.5-flash", 10, 5);
        llmLogPopulator.log(null, CallKind.CHAT, "proactive_briefing", "gemini-2.5-flash", 10, 5);

        LlmCallListResponse all = getForBody("/api/llm-usage/calls?period=DAY", ownerAuthHeaders(), HttpStatus.OK, LlmCallListResponse.class);
        assertThat(all.getItems()).hasSize(3);
        assertThat(all.getItems()).extracting(i -> i.getCreatedBy()).containsExactlyInAnyOrder(anna.id(), bela.id(), null);

        LlmCallListResponse onlyAnna = getForBody("/api/llm-usage/calls?period=DAY&userId=" + anna.id(), ownerAuthHeaders(),
            HttpStatus.OK, LlmCallListResponse.class);
        assertThat(onlyAnna.getItems()).singleElement().satisfies(i -> assertThat(i.getCreatedBy()).isEqualTo(anna.id()));
    }

    private static PricingSnapshot snapshot() {
        return new PricingSnapshot("gemini-2.5-flash", "USD",
            new BigDecimal("0.30"), new BigDecimal("2.50"), new BigDecimal("2.50"),
            new BigDecimal("0.075"), null, LocalDate.now());
    }
}
